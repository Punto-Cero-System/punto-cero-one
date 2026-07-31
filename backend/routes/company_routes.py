"""Companies API — the multi-tenant entity of the platform.

Every future vertical (Legal, Salud, Contabilidad, Turismo, Seguros…) uses
this same module. The `vertical` field on a Company scopes it. Do NOT split
per-vertical.

Endpoints
---------
POST   /api/companies                — create (owner = current user)
GET    /api/companies                — list (public) with filters + cursor
GET    /api/companies/{id_or_slug}   — single (public)
PATCH  /api/companies/{id}           — update (owner or admin)
DELETE /api/companies/{id}           — soft-delete (owner or admin)
POST   /api/companies/{id}/follow    — toggle follow
POST   /api/companies/{id}/verify    — admin verification status change
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from auth import require_admin
from services.community_deps import current_user_or_none, require_current_user
from services.analytics import record_event
from services.notifications import dispatch as dispatch_notif
from models_business import (
    CompanyCreate, CompanyUpdate, CompanyPublic, CompanyListResponse,
    VerificationStatus, new_company_id, make_slug, new_follow_id,
)

logger = logging.getLogger("punto-cero-api.companies")

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_slug_conflict(db, name: str) -> str:
    """Reserve a unique slug — adds a short suffix if the base is taken."""
    base = make_slug(name)
    if not await db.companies.find_one({"slug": base}, {"_id": 0, "id": 1}):
        return base
    import uuid
    return make_slug(name, uuid.uuid4().hex[:5])


async def _company_to_public(db, doc: dict, viewer: Optional[dict]) -> CompanyPublic:
    my_following = False
    my_role = None
    if viewer:
        f = await db.company_follows.find_one({"company_id": doc["id"], "user_id": viewer["id"]}, {"_id": 0, "id": 1})
        my_following = bool(f)
        if doc.get("owner_id") == viewer["id"]:
            my_role = "owner"
        else:
            for tm in (doc.get("team") or []):
                if tm.get("user_id") == viewer["id"]:
                    my_role = tm.get("role", "member")
                    break
    return CompanyPublic(**{
        **doc,
        "my_following": my_following,
        "my_role": my_role,
    })


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
@router.post("", response_model=CompanyPublic)
async def create_company(
    payload: CompanyCreate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    slug = await _resolve_slug_conflict(db, payload.name)
    now = _now()
    doc = {
        **payload.model_dump(),
        "id": new_company_id(),
        "slug": slug,
        "owner_id": user["id"],
        "verification": "unverified",
        "followers_count": 0, "posts_count": 0,
        "jobs_count": 0, "events_count": 0,
        "is_deleted": False,
        "created_at": now, "updated_at": now,
    }
    # ensure nested defaults survive Mongo (SocialLinks pydantic → dict)
    if isinstance(doc.get("social"), object) and hasattr(doc["social"], "model_dump"):
        doc["social"] = doc["social"].model_dump()
    await db.companies.insert_one(doc)
    await record_event(db, "company.created",
                       actor_id=user["id"], subject_type="company", subject_id=doc["id"],
                       country=payload.country, vertical=payload.vertical)
    return await _company_to_public(db, doc, user)


@router.get("", response_model=CompanyListResponse)
async def list_companies(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    vertical: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    owner_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    viewer = await current_user_or_none(request)  # graceful
    db = request.app.state.db
    query: dict = {"is_deleted": {"$ne": True}}
    if vertical:
        query["vertical"] = vertical
    if country:
        query["country"] = country
    if owner_id:
        query["owner_id"] = owner_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"tagline": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if cursor:
        query["created_at"] = {"$lt": cursor}

    cur = db.companies.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1)
    docs = [d async for d in cur]
    has_more = len(docs) > limit
    docs = docs[:limit]
    items = [await _company_to_public(db, d, viewer) for d in docs]
    return CompanyListResponse(
        items=items,
        total=len(items),
        next_cursor=(docs[-1]["created_at"] if has_more and docs else None),
    )


async def _find_company(db, id_or_slug: str) -> dict:
    doc = await db.companies.find_one(
        {"$or": [{"id": id_or_slug}, {"slug": id_or_slug}], "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return doc


@router.get("/{id_or_slug}", response_model=CompanyPublic)
async def get_company(id_or_slug: str, request: Request):
    viewer = await current_user_or_none(request)
    db = request.app.state.db
    doc = await _find_company(db, id_or_slug)
    return await _company_to_public(db, doc, viewer)


@router.patch("/{company_id}", response_model=CompanyPublic)
async def update_company(
    company_id: str,
    payload: CompanyUpdate,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await _find_company(db, company_id)
    if doc["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No puedes editar esta empresa")
    diff = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "social" in diff and hasattr(diff["social"], "model_dump"):
        diff["social"] = diff["social"].model_dump()
    if "name" in diff and diff["name"] != doc["name"]:
        diff["slug"] = await _resolve_slug_conflict(db, diff["name"])
    diff["updated_at"] = _now()
    await db.companies.update_one({"id": doc["id"]}, {"$set": diff})
    fresh = await db.companies.find_one({"id": doc["id"]}, {"_id": 0})
    await record_event(db, "company.updated",
                       actor_id=user["id"], subject_type="company", subject_id=doc["id"],
                       vertical=fresh.get("vertical"))
    return await _company_to_public(db, fresh, user)


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await _find_company(db, company_id)
    if doc["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No puedes borrar esta empresa")
    await db.companies.update_one({"id": doc["id"]}, {"$set": {"is_deleted": True, "updated_at": _now()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# FOLLOW / VERIFICATION
# ---------------------------------------------------------------------------
@router.post("/{company_id}/follow")
async def toggle_follow(
    company_id: str,
    request: Request,
    user: dict = Depends(require_current_user),
):
    db = request.app.state.db
    doc = await _find_company(db, company_id)
    existing = await db.company_follows.find_one({"company_id": doc["id"], "user_id": user["id"]}, {"_id": 0})
    if existing:
        await db.company_follows.delete_one({"company_id": doc["id"], "user_id": user["id"]})
        await db.companies.update_one({"id": doc["id"]}, {"$inc": {"followers_count": -1}})
        await record_event(db, "company.unfollowed",
                           actor_id=user["id"], subject_type="company", subject_id=doc["id"])
        return {"following": False}
    await db.company_follows.insert_one({
        "id": new_follow_id(),
        "company_id": doc["id"],
        "user_id": user["id"],
        "created_at": _now(),
    })
    await db.companies.update_one({"id": doc["id"]}, {"$inc": {"followers_count": 1}})
    await record_event(db, "company.followed",
                       actor_id=user["id"], subject_type="company", subject_id=doc["id"])
    # Notify company owner
    await dispatch_notif(
        db, recipient_id=doc.get("owner_id"), kind="follower",
        title=f"{user.get('name','Alguien')} sigue tu empresa",
        body=doc.get("name"),
        actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
        subject_type="company", subject_id=doc["id"], subject_url=f"/empresas/{doc.get('slug') or doc['id']}",
    )
    return {"following": True}


class VerificationUpdate(BaseModel):
    status: VerificationStatus


@router.post("/{company_id}/verify")
async def set_verification(
    company_id: str,
    payload: VerificationUpdate,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    doc = await _find_company(db, company_id)
    await db.companies.update_one({"id": doc["id"]},
                                   {"$set": {"verification": payload.status, "updated_at": _now()}})
    return {"ok": True, "status": payload.status}
