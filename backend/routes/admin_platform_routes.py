"""Unified admin platform — read+moderation over every core resource.

All endpoints require an admin JWT. The frontend renders these as tabs of a
single `/admin/platform` page. This is the ONLY admin surface — future
verticals plug into the same endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from auth import require_admin


router = APIRouter(prefix="/api/admin", tags=["admin-platform"])


def _now(): return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@router.get("/users")
async def list_users(
    request: Request, admin: dict = Depends(require_admin),
    limit: int = Query(default=50, ge=1, le=200),
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    db = request.app.state.db
    q: dict = {}
    if role: q["role"] = role
    if search:
        import re
        e = re.escape(search)
        q["$or"] = [{"name": {"$regex": e, "$options": "i"}}, {"email": {"$regex": e, "$options": "i"}}]
    cur = db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(limit)
    return [u async for u in cur]


class RoleUpdate(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def update_user_role(user_id: str, payload: RoleUpdate, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    r = await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role, "updated_at": _now()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------
@router.get("/companies")
async def list_companies(request: Request, admin: dict = Depends(require_admin),
                         limit: int = Query(default=50, ge=1, le=200),
                         verification: Optional[str] = None):
    db = request.app.state.db
    q: dict = {"is_deleted": {"$ne": True}}
    if verification: q["verification"] = verification
    cur = db.companies.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [c async for c in cur]


# ---------------------------------------------------------------------------
# Posts moderation
# ---------------------------------------------------------------------------
@router.get("/posts")
async def list_posts(request: Request, admin: dict = Depends(require_admin),
                     status: Optional[str] = None, limit: int = Query(default=50, ge=1, le=200)):
    db = request.app.state.db
    q: dict = {}
    if status: q["status"] = status
    cur = db.posts.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [p async for p in cur]


# ---------------------------------------------------------------------------
# Reports (from feed)
# ---------------------------------------------------------------------------
@router.get("/reports")
async def list_reports(request: Request, admin: dict = Depends(require_admin),
                       resolved: bool = False, limit: int = Query(default=50, ge=1, le=200)):
    db = request.app.state.db
    cur = db.post_reports.find({"resolved": resolved}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [r async for r in cur]


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    await db.post_reports.update_one({"_id": report_id}, {"$set": {"resolved": True, "resolved_at": _now(), "resolved_by": admin["id"]}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Jobs / Events / Documents / Categories are already admin-accessible via
# their own routers with role checks — expose light index endpoints here for
# unified dashboards.
# ---------------------------------------------------------------------------
@router.get("/jobs")
async def list_jobs(request: Request, admin: dict = Depends(require_admin), limit: int = Query(default=50, ge=1, le=200)):
    db = request.app.state.db
    cur = db.jobs.find({"is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [j async for j in cur]


@router.get("/events")
async def list_events(request: Request, admin: dict = Depends(require_admin), limit: int = Query(default=50, ge=1, le=200)):
    db = request.app.state.db
    cur = db.events.find({"is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [e async for e in cur]


@router.get("/documents")
async def list_docs(request: Request, admin: dict = Depends(require_admin), limit: int = Query(default=100, ge=1, le=300)):
    db = request.app.state.db
    cur = db.documents.find({"is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [d async for d in cur]


# ---------------------------------------------------------------------------
# Logs / activity — bird's-eye view of latest analytics events
# ---------------------------------------------------------------------------
@router.get("/activity")
async def latest_activity(request: Request, admin: dict = Depends(require_admin), limit: int = Query(default=100, ge=1, le=500)):
    db = request.app.state.db
    cur = db.analytics_events.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [e async for e in cur]
