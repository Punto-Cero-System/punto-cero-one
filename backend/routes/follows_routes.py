"""Generic follows service — unified Social Graph.

Design
------
One collection `follows` with shape:
    { user_id, entity_type, entity_id, created_at }

Companies keep their pre-existing `company_follows` collection intact — this
service is a superset that:
  1. Bridges to `company_follows` when entity_type == 'company' (idempotent
     writes to both, so old code keeps working).
  2. Introduces first-class support for follows on entity_type ∈
     { user, hashtag, country, vertical, event }.
  3. Exposes aggregated queries used by the feed engine (Wave 3 P2 upgrade)
     and by the frontend Social Graph UI.

Endpoints
---------
POST   /api/follows/{entity_type}/{entity_id}   → follow
DELETE /api/follows/{entity_type}/{entity_id}   → unfollow
GET    /api/follows/status                       → bulk status check
                     ?type=user&ids=a,b,c
GET    /api/follows/me                           → grouped follows for current user
GET    /api/follows/{entity_type}/{entity_id}/count  → follower count for entity
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from services.community_deps import require_current_user
from services.notifications import dispatch as dispatch_notif


logger = logging.getLogger("punto-cero-api.follows")

router = APIRouter(prefix="/api/follows", tags=["follows"])

EntityType = Literal["user", "company", "hashtag", "country", "vertical", "event"]
VALID_TYPES = {"user", "company", "hashtag", "country", "vertical", "event"}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _normalize_entity_id(entity_type: str, entity_id: str) -> str:
    """Hashtags and countries are case-insensitive; users/companies/events keep raw ids."""
    if entity_type in ("hashtag", "country", "vertical"):
        return (entity_id or "").strip().lower().lstrip("#")
    return (entity_id or "").strip()


@router.post("/{entity_type}/{entity_id}")
async def follow(entity_type: str, entity_id: str, request: Request,
                 user: dict = Depends(require_current_user)):
    if entity_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"entity_type inválido. Valores: {sorted(VALID_TYPES)}")
    eid = _normalize_entity_id(entity_type, entity_id)
    if not eid:
        raise HTTPException(status_code=400, detail="entity_id vacío")
    if entity_type == "user" and eid == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes seguirte a ti mismo")

    db = request.app.state.db
    doc = {"user_id": user["id"], "entity_type": entity_type, "entity_id": eid, "created_at": _now()}
    try:
        await db.follows.update_one(
            {"user_id": user["id"], "entity_type": entity_type, "entity_id": eid},
            {"$setOnInsert": doc}, upsert=True,
        )
        # Bridge to company_follows so all Wave 2 logic keeps working unchanged.
        if entity_type == "company":
            await db.company_follows.update_one(
                {"user_id": user["id"], "company_id": eid},
                {"$setOnInsert": {"user_id": user["id"], "company_id": eid, "created_at": _now()}},
                upsert=True,
            )
            await db.companies.update_one({"id": eid}, {"$inc": {"follower_count": 1}})
    except Exception as e:
        logger.warning("follows.follow write failed: %s", e)
        raise HTTPException(status_code=502, detail="No se pudo registrar la relación")

    count = await db.follows.count_documents({"entity_type": entity_type, "entity_id": eid})

    # ---- Notification fan-out (Wave 7) ----------------------------------
    # Notify the entity owner / subject when someone follows it. Uses the
    # unified NotificationCenter — no second notification system.
    try:
        actor = {"id": user["id"], "name": user.get("name"), "picture": user.get("picture")}
        recipient_id: Optional[str] = None
        title = ""
        subject_url = None
        if entity_type == "user":
            recipient_id = eid
            title = f"{user.get('name') or 'Alguien'} empezó a seguirte"
            subject_url = f"/u/{user['id']}"
        elif entity_type == "company":
            co = await db.companies.find_one({"$or": [{"id": eid}, {"slug": eid}]},
                                             {"_id": 0, "owner_id": 1, "name": 1, "slug": 1, "id": 1})
            if co and co.get("owner_id") and not str(co["owner_id"]).startswith("system-"):
                recipient_id = co["owner_id"]
                title = f"{user.get('name') or 'Alguien'} sigue a {co.get('name') or 'tu empresa'}"
                subject_url = f"/empresas/{co.get('slug') or co.get('id')}"
        if recipient_id:
            await dispatch_notif(
                db, recipient_id=recipient_id, kind="follower",
                title=title, actor=actor,
                subject_type=entity_type, subject_id=eid, subject_url=subject_url,
                vertical="community",
            )
    except Exception as e:
        logger.debug("follows.follow notification skipped: %s", e)

    return {"ok": True, "entity_type": entity_type, "entity_id": eid, "count": count, "my_following": True}


@router.delete("/{entity_type}/{entity_id}")
async def unfollow(entity_type: str, entity_id: str, request: Request,
                   user: dict = Depends(require_current_user)):
    if entity_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="entity_type inválido")
    eid = _normalize_entity_id(entity_type, entity_id)
    db = request.app.state.db
    r = await db.follows.delete_one({"user_id": user["id"], "entity_type": entity_type, "entity_id": eid})
    if entity_type == "company" and r.deleted_count:
        await db.company_follows.delete_one({"user_id": user["id"], "company_id": eid})
        await db.companies.update_one({"id": eid, "follower_count": {"$gt": 0}}, {"$inc": {"follower_count": -1}})
    count = await db.follows.count_documents({"entity_type": entity_type, "entity_id": eid})
    return {"ok": True, "entity_type": entity_type, "entity_id": eid, "count": count, "my_following": False}


@router.get("/status")
async def bulk_status(request: Request,
                      type: str = Query(...),
                      ids: str = Query(default=""),
                      user: dict = Depends(require_current_user)):
    if type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="type inválido")
    id_list = [_normalize_entity_id(type, x) for x in (ids or "").split(",") if x.strip()]
    if not id_list:
        return {"following": {}}
    db = request.app.state.db
    out: dict[str, bool] = {i: False for i in id_list}
    async for f in db.follows.find(
        {"user_id": user["id"], "entity_type": type, "entity_id": {"$in": id_list}},
        {"_id": 0, "entity_id": 1},
    ):
        out[f["entity_id"]] = True
    return {"following": out}


@router.get("/me")
async def my_follows(request: Request, user: dict = Depends(require_current_user)):
    db = request.app.state.db
    grouped: dict[str, list[str]] = {t: [] for t in VALID_TYPES}
    async for f in db.follows.find({"user_id": user["id"]}, {"_id": 0}):
        grouped.setdefault(f["entity_type"], []).append(f["entity_id"])
    return {"user_id": user["id"], "follows": grouped}


@router.get("/{entity_type}/{entity_id}/count")
async def entity_count(entity_type: str, entity_id: str, request: Request):
    if entity_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="entity_type inválido")
    eid = _normalize_entity_id(entity_type, entity_id)
    db = request.app.state.db
    count = await db.follows.count_documents({"entity_type": entity_type, "entity_id": eid})
    # For companies keep parity with the legacy counter to avoid double-counting mismatches.
    if entity_type == "company":
        legacy = await db.company_follows.count_documents({"company_id": eid})
        count = max(count, legacy)
    return {"entity_type": entity_type, "entity_id": eid, "count": count}
