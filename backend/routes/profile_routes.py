"""Profile API — read + edit the community user's expanded profile.

Endpoints
---------
GET  /api/community/users/me     — full expanded profile of the auth'd member
PATCH /api/community/users/me    — partial update
GET  /api/community/users/{id}   — public profile view (no PII beyond name/pic/headline)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends

from services.community_deps import require_current_user
from services.analytics import record_event
from models_profile import ProfileUpdate, ProfilePublic


logger = logging.getLogger("punto-cero-api.profile")

router = APIRouter(prefix="/api/community/users", tags=["profile"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_public(user: dict) -> ProfilePublic:
    providers = [p.get("provider") for p in (user.get("auth_providers") or []) if p.get("provider")]
    return ProfilePublic(
        id=user["id"], email=user.get("email", ""), name=user.get("name") or user.get("email", ""),
        picture=user.get("picture"),
        cover_url=user.get("cover_url"),
        role=user.get("role", "member"),
        headline=user.get("headline"), bio=user.get("bio"),
        country=user.get("country"), city=user.get("city"),
        language=user.get("language"),
        languages=user.get("languages") or [],
        interests=user.get("interests") or [],
        skills=user.get("skills") or [],
        specialties=user.get("specialties") or [],
        verticals=user.get("verticals") or [],
        current_company=user.get("current_company"),
        current_title=user.get("current_title"),
        experience=user.get("experience") or [],
        certifications=user.get("certifications") or [],
        portfolio_url=user.get("portfolio_url"),
        social=user.get("social") or {},
        ui_preferences=user.get("ui_preferences") or {},
        providers=providers,
        posts_count=int(user.get("posts_count", 0)),
        followers_count=int(user.get("followers_count", 0)),
        following_count=int(user.get("following_count", 0)),
        created_at=user.get("created_at", _now()),
    )


@router.get("/me", response_model=ProfilePublic)
async def get_me(request: Request, user: dict = Depends(require_current_user)):
    return _to_public(user)


@router.patch("/me", response_model=ProfilePublic)
async def update_me(payload: ProfileUpdate, request: Request,
                    user: dict = Depends(require_current_user)):
    db = request.app.state.db
    diff = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "social" in diff and hasattr(diff["social"], "model_dump"):
        diff["social"] = diff["social"].model_dump()
    if "ui_preferences" in diff and hasattr(diff["ui_preferences"], "model_dump"):
        diff["ui_preferences"] = diff["ui_preferences"].model_dump()
    if "experience" in diff:
        diff["experience"] = [e.model_dump() if hasattr(e, "model_dump") else e for e in diff["experience"]]
    if "certifications" in diff:
        diff["certifications"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in diff["certifications"]]
    diff["updated_at"] = _now()
    await db.users.update_one({"id": user["id"]}, {"$set": diff})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    await record_event(db, "user.profile_update", actor_id=user["id"], subject_type="user", subject_id=user["id"])
    return _to_public(fresh)


@router.get("/{user_id}", response_model=ProfilePublic)
async def get_public_profile(user_id: str, request: Request):
    db = request.app.state.db
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # public view: keep the same shape but callers know they're not the owner
    return _to_public(doc)
