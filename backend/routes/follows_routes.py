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

OMEGA FASE B1 — entity_type="group"
-----------------------------------
Groups became followable entities. `group` is a plain entry in `VALID_TYPES`,
so the generic machinery (idempotent upsert, one relation per user+entity,
bulk status, `my_follows`, `count`) applies unchanged.

Two things are specific to groups:

* **Existence** — following a group that does not exist would store a relation
  pointing at nothing, so a group follow 404s instead of inserting.
* **Privacy** — a private group may only be followed by its members, its
  `admin_id`, a `group_members.role == "admin"`, or a platform admin. The rule
  is *not* restated here: it comes from `evaluate_access` in
  `services.group_permissions` (OMEGA F0.8), the same helper the read endpoints
  use, so a change to group privacy cannot drift between reading and following.

**No `group_followers_count` and no new collection.** `follows` stays the single
source of truth (SOCIAL_GRAPH_CONTRACT v1 §1); `GET /{type}/{id}/count` derives
the number from it. Adding a denormalised counter here is exactly the class of
bug OMEGA F0 fixed for companies.

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
from services.group_permissions import DENIED, evaluate_access
from services.notifications import dispatch as dispatch_notif
from services.activities import record as record_activity


logger = logging.getLogger("punto-cero-api.follows")

router = APIRouter(prefix="/api/follows", tags=["follows"])

EntityType = Literal["user", "company", "hashtag", "country", "vertical", "event", "group"]
VALID_TYPES = {"user", "company", "hashtag", "country", "vertical", "event", "group"}


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

    # OMEGA FASE B1 — entity_type="group". Existence + privacy are resolved with
    # the F0.8 helper instead of restating the rule, so following a group cannot
    # grant more access than reading it. No counter is written: the count is
    # derived from `follows` by GET /{type}/{id}/count.
    if entity_type == "group":
        group = await db.groups.find_one({"id": eid}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
        if await evaluate_access(db, group, user) == DENIED:
            raise HTTPException(status_code=403, detail="Este grupo es privado")

    doc = {"user_id": user["id"], "entity_type": entity_type, "entity_id": eid, "created_at": _now()}
    try:
        res = await db.follows.update_one(
            {"user_id": user["id"], "entity_type": entity_type, "entity_id": eid},
            {"$setOnInsert": doc}, upsert=True,
        )
        inserted = getattr(res, "upserted_id", None) is not None
        # Bridge to company_follows and increment company counter only when a new
        # follow was actually inserted. This prevents double-counting on retries
        # or repeated requests.
        if entity_type == "company" and inserted:
            res2 = await db.company_follows.update_one(
                {"user_id": user["id"], "company_id": eid},
                {"$setOnInsert": {"user_id": user["id"], "company_id": eid, "created_at": _now()}},
                upsert=True,
            )
            # Only increment when company_follows was newly inserted as well.
            if getattr(res2, "upserted_id", None) is not None:
                # OMEGA F0 — `followers_count` (plural) is the canonical field:
                # it is what CompanyPublic declares and what company_routes.py
                # (legacy endpoint) increments. This route used to write
                # `follower_count`, a phantom field nothing reads or creates,
                # so counters never surfaced and the $gt guard below could
                # never match on unfollow.
                await db.companies.update_one({"id": eid}, {"$inc": {"followers_count": 1}})
    except Exception as e:
        logger.warning("follows.follow write failed: %s", e)
        raise HTTPException(status_code=502, detail="No se pudo registrar la relación")

    count = await db.follows.count_documents({"entity_type": entity_type, "entity_id": eid})

    # FASE 2.1 — Activity Layer: el hecho "X siguió a Y" queda en el log
    # append-only `activities`, EN PARALELO a la notificación de más abajo (que
    # sigue saliendo del productor con su texto personalizado). No se llama
    # `publish()`: el consumidor `notifications` entregaría una SEGUNDA
    # notificación — regla R8 del diseño F0.9.2, escritura en un solo sitio.
    # Solo cuenta un follow NUEVO: repetir el POST no cambió nada, no hay hecho.
    # `record()` nunca lanza y el try/except repite la invariante de F0.9.5 en
    # el call site — un fallo del log de actividades no puede bloquear seguir.
    if inserted and entity_type in ("user", "company"):
        try:
            await record_activity(
                db,
                kind="user.followed",
                actor_id=user["id"],
                subject_type=entity_type,
                subject_id=eid,
                audience={"type": entity_type, "id": eid},
                visibility="private",
                metadata={"subject_url": f"/u/{user['id']}"},
            )
        except Exception:
            logger.debug("follows.follow activity not recorded", exc_info=True)

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
        # OMEGA F0 — guard now matches the canonical `followers_count`, so the
        # decrement actually fires. Clamped at 0 to stay idempotent.
        await db.companies.update_one({"id": eid, "followers_count": {"$gt": 0}}, {"$inc": {"followers_count": -1}})
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


# ---------- Followers / Following lists (users only) ---------------------
#
# Simple LIST endpoints that reuse the existing `follows` collection. No new
# collections, no schema changes. Used by the profile page modal to show
# who follows / is followed by a user.

async def _hydrate_users(db, user_ids: list[str]) -> list[dict]:
    """Return public-safe user snippets for a list of user_ids."""
    if not user_ids:
        return []
    docs = db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "picture": 1,
         "headline": 1, "country": 1, "current_company": 1},
    )
    return [d async for d in docs]


@router.get("/user/{user_id}/followers")
async def list_followers(user_id: str, request: Request,
                         limit: int = Query(default=50, ge=1, le=200)):
    """Users who follow `user_id`."""
    db = request.app.state.db
    cursor = db.follows.find(
        {"entity_type": "user", "entity_id": user_id},
        {"_id": 0, "user_id": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit)
    rows = [r async for r in cursor]
    users = await _hydrate_users(db, [r["user_id"] for r in rows])
    by_id = {u["id"]: u for u in users}
    ordered = [by_id[r["user_id"]] for r in rows if r["user_id"] in by_id]
    return {"user_id": user_id, "count": len(ordered), "items": ordered}


@router.get("/user/{user_id}/following")
async def list_following(user_id: str, request: Request,
                         limit: int = Query(default=50, ge=1, le=200)):
    """Users that `user_id` is following."""
    db = request.app.state.db
    cursor = db.follows.find(
        {"user_id": user_id, "entity_type": "user"},
        {"_id": 0, "entity_id": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit)
    rows = [r async for r in cursor]
    users = await _hydrate_users(db, [r["entity_id"] for r in rows])
    by_id = {u["id"]: u for u in users}
    ordered = [by_id[r["entity_id"]] for r in rows if r["entity_id"] in by_id]
    return {"user_id": user_id, "count": len(ordered), "items": ordered}
