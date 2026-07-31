"""Notifications API — cross-vertical inbox.

GET  /api/notifications                 — list (cursor); adds `unread` count
POST /api/notifications/{id}/read       — mark one read (or unread with ?unread=true)
POST /api/notifications/mark-all-read   — bulk
DELETE /api/notifications/{id}          — dismiss
GET  /api/notifications/preferences     — user prefs
PATCH /api/notifications/preferences    — update prefs
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from services.community_deps import require_current_user
from services.notifications import (
    NotificationPublic, NotificationListResponse, NotificationPreferences,
)


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _now(): return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    request: Request,
    user: dict = Depends(require_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    unread_only: bool = Query(default=False),
):
    db = request.app.state.db
    query: dict = {"recipient_id": user["id"]}
    if unread_only:
        query["is_read"] = False
    if cursor:
        query["created_at"] = {"$lt": cursor}
    cur = db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1)
    docs = [d async for d in cur]
    has_more = len(docs) > limit
    docs = docs[:limit]
    unread = await db.notifications.count_documents({"recipient_id": user["id"], "is_read": False})
    return NotificationListResponse(
        items=[NotificationPublic(**d) for d in docs],
        unread=unread,
        next_cursor=(docs[-1]["created_at"] if has_more and docs else None),
    )


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str, request: Request,
    unread: bool = Query(default=False),
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    now = None if unread else _now()
    await db.notifications.update_one(
        {"id": notification_id, "recipient_id": user["id"]},
        {"$set": {"is_read": not unread, "read_at": now}},
    )
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_read(request: Request, user: dict = Depends(require_current_user)):
    db = request.app.state.db
    r = await db.notifications.update_many(
        {"recipient_id": user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": _now()}},
    )
    return {"ok": True, "updated": r.modified_count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    await db.notifications.delete_one({"id": notification_id, "recipient_id": user["id"]})
    return {"ok": True}


@router.get("/preferences", response_model=NotificationPreferences)
async def get_preferences(request: Request, user: dict = Depends(require_current_user)):
    db = request.app.state.db
    doc = await db.notification_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        return NotificationPreferences(user_id=user["id"])
    return NotificationPreferences(**doc)


class PrefsUpdate(BaseModel):
    disabled_kinds: Optional[list[str]] = None
    channels: Optional[dict] = None


@router.patch("/preferences", response_model=NotificationPreferences)
async def update_preferences(
    payload: PrefsUpdate, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    diff = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    diff["user_id"] = user["id"]
    diff["updated_at"] = _now()
    await db.notification_preferences.update_one(
        {"user_id": user["id"]}, {"$set": diff}, upsert=True,
    )
    fresh = await db.notification_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    return NotificationPreferences(**fresh)
