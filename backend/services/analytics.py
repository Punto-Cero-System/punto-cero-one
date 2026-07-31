"""Analytics recording — a single write path every module uses.

record_event(db, name, actor_id, subject, payload)
    → inserts into `analytics_events` and (optionally) rolls counters in
      `analytics_counters` for cheap dashboards.

Events used across the platform:
    user.signup, user.login, user.profile_update
    company.created, company.updated, company.followed, company.unfollowed
    job.posted, job.applied, job.status_changed
    event.created, event.rsvp
    post.created, post.reacted, post.commented, post.shared, post.saved
    document.downloaded, document.viewed
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def record_event(
    db,
    name: str,
    *,
    actor_id: Optional[str] = None,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    country: Optional[str] = None,
    vertical: Optional[str] = None,
    payload: Optional[dict] = None,
) -> None:
    """Fire-and-forget in normal request paths; wrap in try/except at callsite
    if you can't tolerate an analytics write failure.

    Keeps a single row per event AND increments per-day and per-vertical
    counters (used by /api/analytics/summary).
    """
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    doc = {
        "name": name,
        "actor_id": actor_id,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "country": country,
        "vertical": vertical,
        "payload": payload or {},
        "created_at": now.isoformat(),
        "day": day,
    }
    await db.analytics_events.insert_one(doc)
    # roll a per-day counter — cheap upsert with $inc
    await db.analytics_counters.update_one(
        {"day": day, "name": name},
        {"$inc": {"count": 1}, "$set": {"day": day, "name": name}},
        upsert=True,
    )
    if vertical:
        await db.analytics_counters.update_one(
            {"day": day, "name": name, "vertical": vertical},
            {"$inc": {"count": 1}, "$set": {"day": day, "name": name, "vertical": vertical}},
            upsert=True,
        )
    if country:
        await db.analytics_counters.update_one(
            {"day": day, "name": name, "country": country},
            {"$inc": {"count": 1}, "$set": {"day": day, "name": name, "country": country}},
            upsert=True,
        )
