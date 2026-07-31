"""Analytics API — read-only aggregations for the admin panel.

GET /api/analytics/summary   → global KPIs (admin only)
GET /api/analytics/timeseries?name=post.created&days=30 → daily buckets
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from auth import require_admin


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
async def summary(request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    since_30 = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    totals = {
        "users": await db.users.count_documents({}),
        "companies": await db.companies.count_documents({"is_deleted": {"$ne": True}}),
        "posts": await db.posts.count_documents({"status": "published"}),
        "jobs": await db.jobs.count_documents({"is_deleted": {"$ne": True}}),
        "events": await db.events.count_documents({"is_deleted": {"$ne": True}}),
        "documents": await db.documents.count_documents({"is_deleted": {"$ne": True}}),
        "reactions": await db.post_reactions.count_documents({}),
        "comments": await db.post_comments.count_documents({}),
        "shares": await db.post_shares.count_documents({}),
        "saves": await db.post_saves.count_documents({}),
        "applications": await db.job_applications.count_documents({"is_deleted": {"$ne": True}}),
        "rsvps": await db.event_rsvps.count_documents({}),
    }

    active_users_30d = await db.analytics_events.distinct("actor_id", {"created_at": {"$gte": since_30}})

    # signups per country (top 10)
    country_pipeline = [
        {"$match": {"name": "user.signup"}},
        {"$group": {"_id": "$country", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    signups_by_country = [
        {"country": r["_id"], "count": r["count"]}
        async for r in db.analytics_events.aggregate(country_pipeline)
    ]

    # today's counts across all named events
    todays = {}
    async for row in db.analytics_counters.find({"day": today}, {"_id": 0}):
        if "vertical" in row or "country" in row:
            continue
        todays[row["name"]] = int(row.get("count", 0))

    return {
        "totals": totals,
        "active_users_30d": len([u for u in active_users_30d if u]),
        "today": todays,
        "signups_by_country": signups_by_country,
    }


@router.get("/timeseries")
async def timeseries(
    request: Request,
    name: str = Query(...),
    days: int = Query(default=30, ge=1, le=180),
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    since = datetime.now(timezone.utc) - timedelta(days=days)
    cur = db.analytics_counters.find(
        {"name": name, "day": {"$gte": since.strftime("%Y-%m-%d")}},
        {"_id": 0},
    ).sort("day", 1)
    return {"points": [{"day": r["day"], "count": int(r.get("count", 0))} async for r in cur if "vertical" not in r and "country" not in r]}
