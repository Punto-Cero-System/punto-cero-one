"""Public community stats — lightweight totals for the "living community"
counter shown on Mi Espacio and the welcome modal.

No auth required. Values are counted from the live DB on every call — cheap
because `users` and `companies` indexes are already in place. Poll cadence
(30-60s) from the client is safe.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request


router = APIRouter(prefix="/api/community", tags=["community"])


@router.get("/stats")
async def community_stats(request: Request):
    db = request.app.state.db
    total_members = await db.users.count_documents({
        "role": {"$ne": "admin"},
        "is_deleted": {"$ne": True},
    })
    total_companies = await db.companies.count_documents({"is_deleted": {"$ne": True}})
    total_posts = await db.posts.count_documents({
        "status": "published",
        "is_deleted": {"$ne": True},
    })
    return {
        "total_members": total_members,
        "total_companies": total_companies,
        "total_posts": total_posts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
