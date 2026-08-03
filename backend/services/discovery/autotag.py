"""Inline auto-tagger — computes `related_companies` for a growth_item in-line
during ingestion, so every new RSS/YouTube/Repo/Job/Event is discoverable via
the Company Discovery ficha the moment it lands.

Design goals
------------
* Zero external calls — pure DB alias lookup.
* In-memory alias cache with a TTL so we don't hammer Mongo per item.
* Idempotent — safe to call on both fresh items (inline) and existing items
  (backfill).

Public helpers
--------------
    get_company_aliases(db)              → dict[alias_lowercase, slug] (cached)
    invalidate_aliases_cache()           → wipe cache (call after new seed)
    compute_related_companies(text, al)  → list[slug] (order-preserving, capped)
    autotag_item_payload(text, aliases)  → {'related_companies': [...], 'tags': [...]}
    backfill_autotag(db, limit=2000)     → int (# items tagged)
"""
from __future__ import annotations

import time
from typing import Optional


_ALIAS_CACHE: dict[str, str] = {}
_ALIAS_CACHE_AT: float = 0.0
_ALIAS_CACHE_TTL_SECONDS = 300  # 5 min


def invalidate_aliases_cache() -> None:
    global _ALIAS_CACHE_AT
    _ALIAS_CACHE_AT = 0.0


async def get_company_aliases(db) -> dict[str, str]:
    """Build/refresh alias→slug map from public companies.

    An alias is any of: exact company name (lowercased), tags, hashtags.
    Aliases shorter than 3 chars are dropped to avoid noise.
    """
    global _ALIAS_CACHE, _ALIAS_CACHE_AT
    now = time.time()
    if _ALIAS_CACHE and (now - _ALIAS_CACHE_AT) < _ALIAS_CACHE_TTL_SECONDS:
        return _ALIAS_CACHE

    aliases: dict[str, str] = {}
    async for c in db.companies.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "slug": 1, "name": 1, "tags": 1, "hashtags": 1},
    ):
        slug = c.get("slug")
        if not slug:
            continue
        if c.get("name"):
            aliases.setdefault(c["name"].lower(), slug)
        for t in (c.get("tags") or []) + (c.get("hashtags") or []):
            k = str(t).lower().strip().lstrip("#")
            if len(k) >= 3:
                aliases.setdefault(k, slug)
    _ALIAS_CACHE = aliases
    _ALIAS_CACHE_AT = now
    return aliases


def compute_related_companies(
    text: str, aliases: dict[str, str], *, max_matches: int = 5
) -> list[str]:
    """Return the ordered list of company slugs mentioned in `text`.

    Text is matched case-insensitive. Short aliases (≤4 chars) require a
    whitespace-bounded match to prevent false positives like "AI" matching
    "email".
    """
    if not text or not aliases:
        return []
    haystack = f" {text.lower()} "
    matches: list[str] = []
    for alias, slug in aliases.items():
        needle = f" {alias} " if len(alias) <= 4 else alias
        if needle in haystack and slug not in matches:
            matches.append(slug)
            if len(matches) >= max_matches:
                break
    return matches


def autotag_item_payload(
    title: str,
    summary: str,
    aliases: dict[str, str],
    *,
    existing_tags: Optional[list[str]] = None,
) -> Optional[dict]:
    """Compute the auto-tag payload for a single growth_item.

    Returns None if there are no matches — call sites should skip the update
    in that case to avoid pointless writes.
    """
    text = f"{title or ''} {summary or ''}"
    matches = compute_related_companies(text, aliases)
    if not matches:
        return None
    merged = sorted(set(existing_tags or []) | set(matches))
    return {"related_companies": matches, "tags": merged}


async def backfill_autotag(db, *, limit: int = 2000) -> int:
    """Run a one-pass tag over items missing `related_companies`.

    Idempotent — subsequent calls target only items still missing the field.
    """
    aliases = await get_company_aliases(db)
    if not aliases:
        return 0
    tagged = 0
    query = {"$or": [
        {"related_companies": {"$exists": False}},
        {"related_companies": []},
    ]}
    async for g in db.growth_items.find(
        query,
        {"_id": 0, "id": 1, "title": 1, "summary": 1, "tags": 1},
    ).limit(limit):
        payload = autotag_item_payload(
            g.get("title"), g.get("summary"), aliases,
            existing_tags=g.get("tags") or [],
        )
        if not payload:
            continue
        await db.growth_items.update_one(
            {"id": g["id"]},
            {"$set": payload},
        )
        tagged += 1
    return tagged
