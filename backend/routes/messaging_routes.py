"""Internal Messaging service.

Data model
----------
conversations:
  id, kind (dm|company|group), participants:[{id,type=user|company, name, picture?}],
  last_message?, last_message_at, unread_by:{user_id: count}, created_at

messages:
  id, conversation_id, sender_id, sender_kind (user|company),
  body?, attachments:[{doc_id, filename, content_type, size_bytes}],
  shared_ref:{type=post|event|job, id, snapshot?},
  read_by:[user_id...], created_at
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from services.community_deps import require_current_user
from services.notifications import dispatch as dispatch_notif


logger = logging.getLogger("punto-cero-api.messaging")

router = APIRouter(prefix="/api/messages", tags=["messaging"])


ConversationKind = Literal["dm", "company", "group"]
SenderKind = Literal["user", "company"]


def _uid_conv(): return f"cv_{uuid.uuid4().hex[:12]}"
def _uid_msg(): return f"msg_{uuid.uuid4().hex[:12]}"
def _now(): return datetime.now(timezone.utc).isoformat()


class ParticipantMini(BaseModel):
    id: str
    kind: SenderKind = "user"
    name: str
    picture: Optional[str] = None


class Attachment(BaseModel):
    doc_id: Optional[str] = None
    filename: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    url: Optional[str] = None


class SharedRef(BaseModel):
    type: Literal["post", "event", "job", "company"]
    id: str
    snapshot: Optional[dict] = None


class MessagePublic(BaseModel):
    id: str
    conversation_id: str
    sender: ParticipantMini
    body: Optional[str] = None
    attachments: list[Attachment] = []
    shared_ref: Optional[SharedRef] = None
    read_by: list[str] = []
    created_at: str


class ConversationPublic(BaseModel):
    id: str
    kind: ConversationKind
    participants: list[ParticipantMini]
    last_message: Optional[MessagePublic] = None
    unread_count: int = 0
    created_at: str
    updated_at: str


class ConversationListResponse(BaseModel):
    items: list[ConversationPublic]


class CreateOrGetConversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    kind: ConversationKind = "dm"
    participants: list[ParticipantMini] = Field(min_length=1)


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    body: Optional[str] = Field(default=None, max_length=8000)
    attachments: list[Attachment] = []
    shared_ref: Optional[SharedRef] = None
    sender_kind: SenderKind = "user"
    sender_id: Optional[str] = None       # for user acting on behalf of company


async def _me_participant(user: dict) -> dict:
    return {
        "id": user["id"], "kind": "user",
        "name": user.get("name") or user.get("email", "Miembro"),
        "picture": user.get("picture"),
    }


async def _serialize_conv(db, conv: dict, viewer_id: str) -> ConversationPublic:
    last_msg = None
    if conv.get("last_message"):
        last_msg = MessagePublic(**conv["last_message"])
    return ConversationPublic(
        id=conv["id"], kind=conv["kind"],
        participants=[ParticipantMini(**p) for p in conv.get("participants", [])],
        last_message=last_msg,
        unread_count=int((conv.get("unread_by") or {}).get(viewer_id, 0)),
        created_at=conv["created_at"],
        updated_at=conv.get("updated_at", conv["created_at"]),
    )


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
@router.post("/conversations", response_model=ConversationPublic)
async def create_or_get_conversation(
    payload: CreateOrGetConversation,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    me = await _me_participant(user)
    participants_map = {(p.id, p.kind): p.model_dump() for p in payload.participants}
    participants_map[(me["id"], me["kind"])] = me
    parts = list(participants_map.values())
    participant_ids = sorted([f"{p['kind']}:{p['id']}" for p in parts])

    # DMs are idempotent — same participant set returns the same conversation.
    if payload.kind == "dm":
        existing = await db.conversations.find_one(
            {"kind": "dm", "participant_key": ":".join(participant_ids)},
            {"_id": 0},
        )
        if existing:
            return await _serialize_conv(db, existing, user["id"])

    now = _now()
    doc = {
        "id": _uid_conv(),
        "kind": payload.kind,
        "participants": parts,
        "participant_key": ":".join(participant_ids),
        "unread_by": {},
        "last_message": None,
        "last_message_at": None,
        "created_at": now, "updated_at": now,
    }
    await db.conversations.insert_one(doc)
    return await _serialize_conv(db, doc, user["id"])


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    request: Request,
    user: dict = Depends(require_current_user),
    limit: int = Query(default=30, ge=1, le=100),
):
    db = request.app.state.db
    cur = db.conversations.find(
        {"participants.id": user["id"]}, {"_id": 0},
    ).sort("updated_at", -1).limit(limit)
    items = [await _serialize_conv(db, c, user["id"]) async for c in cur]
    return ConversationListResponse(items=items)


@router.get("/conversations/{conv_id}/messages", response_model=list[MessagePublic])
async def list_messages(
    conv_id: str, request: Request,
    user: dict = Depends(require_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    before: Optional[str] = Query(default=None),
):
    db = request.app.state.db
    conv = await db.conversations.find_one({"id": conv_id, "participants.id": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    q: dict = {"conversation_id": conv_id}
    if before:
        q["created_at"] = {"$lt": before}
    cur = db.chat_messages.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = [d async for d in cur]
    docs.reverse()
    # Mark all as read for viewer (async is OK; last-writer-wins tolerated)
    await db.conversations.update_one(
        {"id": conv_id}, {"$set": {f"unread_by.{user['id']}": 0}}
    )
    return [MessagePublic(**d) for d in docs]


@router.post("/conversations/{conv_id}/messages", response_model=MessagePublic)
async def send_message(
    conv_id: str, payload: MessageCreate, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    conv = await db.conversations.find_one({"id": conv_id, "participants.id": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    if not (payload.body and payload.body.strip()) and not payload.attachments and not payload.shared_ref:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    sender_participant = None
    if payload.sender_kind == "company" and payload.sender_id:
        # sender speaks on behalf of a company they manage
        company = await db.companies.find_one({"id": payload.sender_id, "is_deleted": {"$ne": True}}, {"_id": 0})
        if not company or (company.get("owner_id") != user["id"] and user.get("role") != "admin"):
            raise HTTPException(status_code=403, detail="No puedes escribir por esa empresa")
        sender_participant = {"id": company["id"], "kind": "company",
                              "name": company["name"], "picture": company.get("logo_url")}
    else:
        sender_participant = await _me_participant(user)

    now = _now()
    doc = {
        "id": _uid_msg(),
        "conversation_id": conv_id,
        "sender": sender_participant,
        "body": (payload.body or "").strip() or None,
        "attachments": [a.model_dump() for a in payload.attachments],
        "shared_ref": payload.shared_ref.model_dump() if payload.shared_ref else None,
        "read_by": [user["id"]],
        "created_at": now,
    }
    await db.chat_messages.insert_one(doc)

    # Bump conversation state + unread counters for everyone except sender
    unread_inc = {f"unread_by.{p['id']}": 1 for p in conv["participants"] if p["id"] != user["id"] and p.get("kind") == "user"}
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"last_message": doc, "last_message_at": now, "updated_at": now},
         "$inc": unread_inc} if unread_inc else
        {"$set": {"last_message": doc, "last_message_at": now, "updated_at": now}},
    )

    # Fan-out notifications to the other user participants
    preview = (doc.get("body") or "").strip()[:120]
    for p in conv["participants"]:
        if p.get("kind") == "user" and p["id"] != user["id"]:
            await dispatch_notif(
                db,
                recipient_id=p["id"], kind="message",
                title=f"Nuevo mensaje de {sender_participant['name']}",
                body=preview or "Nuevo mensaje",
                actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
                subject_type="conversation", subject_id=conv_id,
                subject_url=f"/mensajes/{conv_id}",
            )
    return MessagePublic(**doc)
