"""Events API — belongs to a company or hosted by a member.

Endpoints
---------
POST   /api/events                    — create (auth required)
GET    /api/events                    — list (public) with filters
GET    /api/events/{id}               — single
PATCH  /api/events/{id}               — update (organizer/admin/company mgr)
DELETE /api/events/{id}               — soft delete
POST   /api/events/{id}/rsvp          — set status: going|interested|cancelled
GET    /api/events/{id}/attendees     — organizer/admin only
GET    /api/me/events                 — my upcoming events (RSVP'd)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from services.community_deps import current_user_or_none, require_current_user
from services.analytics import record_event
from services.notifications import dispatch as dispatch_notif
from models_business import (
    EventCreate, EventUpdate, EventPublic, EventListResponse,
    RsvpInput, RsvpStatus, new_event_id, new_rsvp_id,
)


logger = logging.getLogger("punto-cero-api.events")

router = APIRouter(prefix="/api/events", tags=["events"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _can_manage_event(db, event: dict, user: dict) -> bool:
    if user.get("role") == "admin":
        return True
    if event.get("organizer_id") == user["id"]:
        return True
    if event.get("company_id"):
        company = await db.companies.find_one({"id": event["company_id"]}, {"_id": 0})
        if company and (company.get("owner_id") == user["id"] or any(
            tm.get("user_id") == user["id"] for tm in (company.get("team") or [])
        )):
            return True
    return False


async def _event_to_public(db, event: dict, viewer: Optional[dict]) -> EventPublic:
    company_name = None
    if event.get("company_id"):
        c = await db.companies.find_one({"id": event["company_id"]}, {"_id": 0, "name": 1})
        company_name = (c or {}).get("name")
    my_rsvp = None
    if viewer:
        rsvp = await db.event_rsvps.find_one(
            {"event_id": event["id"], "user_id": viewer["id"]}, {"_id": 0, "status": 1},
        )
        my_rsvp = (rsvp or {}).get("status")
    return EventPublic(
        id=event["id"],
        company_id=event.get("company_id"),
        company_name=company_name,
        organizer_id=event["organizer_id"],
        title=event["title"],
        description=event.get("description"),
        modality=event["modality"],
        starts_at=event["starts_at"],
        ends_at=event.get("ends_at"),
        timezone=event.get("timezone"),
        location=event.get("location"),
        country=event.get("country"),
        city=event.get("city"),
        stream_url=event.get("stream_url"),
        cover_url=event.get("cover_url"),
        tags=event.get("tags", []),
        is_public=bool(event.get("is_public", True)),
        attendees_count=int(event.get("attendees_count", 0)),
        interested_count=int(event.get("interested_count", 0)),
        my_rsvp=my_rsvp,
        created_at=event["created_at"], updated_at=event["updated_at"],
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
@router.post("", response_model=EventPublic)
async def create_event(
    payload: EventCreate, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    if payload.company_id:
        company = await db.companies.find_one({"id": payload.company_id, "is_deleted": {"$ne": True}}, {"_id": 0})
        if not company:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")
        # only company managers can bind an event to a company
        if company.get("owner_id") != user["id"] and user.get("role") != "admin" and not any(
            tm.get("user_id") == user["id"] for tm in (company.get("team") or [])
        ):
            raise HTTPException(status_code=403, detail="No puedes crear eventos para esta empresa")
    now = _now()
    doc = {
        **payload.model_dump(),
        "id": new_event_id(),
        "organizer_id": user["id"],
        "attendees_count": 0,
        "interested_count": 0,
        "is_deleted": False,
        "created_at": now, "updated_at": now,
    }
    await db.events.insert_one(doc)
    if doc.get("company_id"):
        await db.companies.update_one({"id": doc["company_id"]}, {"$inc": {"events_count": 1}})
    await record_event(db, "event.created",
                       actor_id=user["id"], subject_type="event", subject_id=doc["id"],
                       country=payload.country)
    return await _event_to_public(db, doc, user)


@router.get("", response_model=EventListResponse)
async def list_events(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    company_id: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    modality: Optional[str] = Query(default=None),
    upcoming_only: bool = Query(default=True),
    search: Optional[str] = Query(default=None),
):
    viewer = await current_user_or_none(request)
    db = request.app.state.db
    query: dict = {"is_deleted": {"$ne": True}, "is_public": True}
    if company_id: query["company_id"] = company_id
    if country: query["country"] = country
    if modality: query["modality"] = modality
    if upcoming_only:
        query["starts_at"] = {"$gte": _now()}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if cursor:
        # events sort by starts_at ASC (soonest first); cursor holds last starts_at
        query.setdefault("starts_at", {})
        query["starts_at"]["$gt"] = cursor
    cur = db.events.find(query, {"_id": 0}).sort("starts_at", 1).limit(limit + 1)
    docs = [d async for d in cur]
    has_more = len(docs) > limit
    docs = docs[:limit]
    items = [await _event_to_public(db, d, viewer) for d in docs]
    return EventListResponse(
        items=items, total=len(items),
        next_cursor=(docs[-1]["starts_at"] if has_more and docs else None),
    )


@router.get("/{event_id}", response_model=EventPublic)
async def get_event(event_id: str, request: Request):
    viewer = await current_user_or_none(request)
    db = request.app.state.db
    doc = await db.events.find_one({"id": event_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return await _event_to_public(db, doc, viewer)


@router.patch("/{event_id}", response_model=EventPublic)
async def update_event(
    event_id: str, payload: EventUpdate, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await db.events.find_one({"id": event_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not await _can_manage_event(db, doc, user):
        raise HTTPException(status_code=403, detail="No puedes editar este evento")
    diff = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    diff["updated_at"] = _now()
    await db.events.update_one({"id": event_id}, {"$set": diff})
    fresh = await db.events.find_one({"id": event_id}, {"_id": 0})
    return await _event_to_public(db, fresh, user)


@router.delete("/{event_id}")
async def delete_event(event_id: str, request: Request,
                       user: dict = Depends(require_current_user)):
    db = request.app.state.db
    doc = await db.events.find_one({"id": event_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not await _can_manage_event(db, doc, user):
        raise HTTPException(status_code=403, detail="No puedes borrar este evento")
    await db.events.update_one({"id": event_id}, {"$set": {"is_deleted": True, "updated_at": _now()}})
    if doc.get("company_id"):
        await db.companies.update_one({"id": doc["company_id"]}, {"$inc": {"events_count": -1}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# RSVP
# ---------------------------------------------------------------------------
@router.post("/{event_id}/rsvp")
async def set_rsvp(
    event_id: str, payload: RsvpInput,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    ev = await db.events.find_one({"id": event_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    existing = await db.event_rsvps.find_one({"event_id": event_id, "user_id": user["id"]}, {"_id": 0})
    now = _now()

    def _inc(status: RsvpStatus, delta: int) -> dict:
        field = "attendees_count" if status == "going" else ("interested_count" if status == "interested" else None)
        return {field: delta} if field else {}

    if existing:
        old = existing["status"]
        if old == payload.status:
            # toggle off
            await db.event_rsvps.delete_one({"event_id": event_id, "user_id": user["id"]})
            dec = _inc(old, -1)
            if dec:
                await db.events.update_one({"id": event_id}, {"$inc": dec})
            return {"status": None}
        # change status
        await db.event_rsvps.update_one(
            {"event_id": event_id, "user_id": user["id"]},
            {"$set": {"status": payload.status, "updated_at": now}},
        )
        upd = {}
        for k, v in {**_inc(old, -1), **_inc(payload.status, 1)}.items():
            upd[k] = upd.get(k, 0) + v
        if upd:
            await db.events.update_one({"id": event_id}, {"$inc": upd})
        return {"status": payload.status}

    await db.event_rsvps.insert_one({
        "id": new_rsvp_id(),
        "event_id": event_id, "user_id": user["id"],
        "status": payload.status,
        "created_at": now, "updated_at": now,
    })
    inc = _inc(payload.status, 1)
    if inc:
        await db.events.update_one({"id": event_id}, {"$inc": inc})
    await record_event(db, "event.rsvp",
                       actor_id=user["id"], subject_type="event", subject_id=event_id,
                       payload={"status": payload.status})
    # Notify organizer (only when someone confirms going)
    if payload.status == "going" and ev.get("organizer_id") != user["id"]:
        await dispatch_notif(
            db, recipient_id=ev.get("organizer_id"), kind="rsvp",
            title=f"Nueva confirmación a {ev['title']}",
            body=f"{user.get('name','Alguien')} asistirá",
            actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
            subject_type="event", subject_id=event_id, subject_url=f"/eventos/{event_id}",
        )
    return {"status": payload.status}


@router.get("/{event_id}/attendees")
async def list_attendees(
    event_id: str, request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    ev = await db.events.find_one({"id": event_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not await _can_manage_event(db, ev, user):
        raise HTTPException(status_code=403, detail="Solo el organizador puede ver la lista")
    cur = db.event_rsvps.find({"event_id": event_id}, {"_id": 0}).sort("created_at", 1)
    out = []
    async for r in cur:
        u = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1, "headline": 1}) or {}
        out.append({**r, "user": u})
    return out
