"""Aggregator — orchestrates fetch → normalize → dedupe → upsert.

Public helpers
--------------
    active_sources(db)       → list[dict] (catalogue merged with overrides)
    run_once(db)             → dict{fetched, ingested, skipped, errors}
    latest_items(db, filter) → list[GrowthItem]
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from .sources import SOURCES, merge_with_overrides
from .providers import fetch_all
from .normalizer import normalize_entry


logger = logging.getLogger("punto-cero-api.growth.aggregator")


async def active_sources(db) -> list[dict]:
    overrides = [o async for o in db.growth_sources.find({}, {"_id": 0})]
    merged = merge_with_overrides(overrides)
    return [s for s in merged if s.get("enabled", True)]


async def run_once(db) -> dict[str, Any]:
    """Fetch all active sources and upsert the resulting items.

    Idempotent: uses `id` (derived from source_id + link/guid) so re-runs
    won't create duplicates.
    """
    sources = await active_sources(db)
    if not sources:
        return {"sources": 0, "ingested": 0, "updated": 0}

    fetched = await fetch_all(sources)
    now = datetime.now(timezone.utc).isoformat()
    ingested = 0
    updated = 0
    for src, entries in fetched:
        for e in entries[:30]:  # cap per-source to keep DB compact
            item = normalize_entry(src, e)
            if not item:
                continue
            res = await db.growth_items.update_one(
                {"id": item["id"]},
                {
                    "$setOnInsert": {
                        "id": item["id"], "ingested_at": item["ingested_at"],
                    },
                    "$set": {
                        **{k: v for k, v in item.items() if k not in {"id", "ingested_at"}},
                        "last_seen_at": now,
                    },
                },
                upsert=True,
            )
            if res.upserted_id:
                ingested += 1
            elif res.modified_count:
                updated += 1
    logger.info("growth run sources=%d ingested=%d updated=%d",
                len(sources), ingested, updated)
    return {"sources": len(sources), "ingested": ingested, "updated": updated}


async def latest_items(
    db,
    *,
    countries: Optional[list[str]] = None,
    vertical: Optional[str] = None,
    limit: int = 20,
    exclude_ids: Optional[list[str]] = None,
    since: Optional[str] = None,
) -> list[dict]:
    """Fetch normalized items for a given country/vertical, most recent first."""
    query: dict[str, Any] = {}
    if countries:
        query["country"] = {"$in": [c.upper() for c in countries]}
    if vertical:
        query["$or"] = [{"vertical": vertical}, {"verticals": vertical}]
    if exclude_ids:
        query["id"] = {"$nin": exclude_ids}
    if since:
        query["published_at"] = {"$gte": since}
    cursor = db.growth_items.find(query, {"_id": 0}).sort([("published_at", -1)]).limit(limit)
    return [d async for d in cursor]


async def set_source_enabled(db, source_id: str, enabled: bool) -> dict:
    """Persist an on/off override for a source in the static catalogue."""
    valid_ids = {s["id"] for s in SOURCES}
    if source_id not in valid_ids:
        raise ValueError(f"unknown source_id {source_id}")
    await db.growth_sources.update_one(
        {"source_id": source_id},
        {"$set": {"source_id": source_id, "enabled": bool(enabled),
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"source_id": source_id, "enabled": enabled}
