"""Content Sources System (Wave 12).

A zero-dependency, zero-API-key layer that surfaces curated external
resources per country and per type (jobs, events, videos, ai_tools,
communities, etc.). The registry loads a single JSON file at import time
so lookups are O(1). Every item exposes an `external_url` so the frontend
can render it as a "click-out" card without any scraping or ingestion.

This module is intentionally **read-only** and stateless — it does not
touch MongoDB. When callers need to weave these entries into the mixed
feed, they use `list_by_type` / `list_by_country` and combine with dynamic
`growth_items` from the database.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger("punto-cero-api.content_sources")

_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "countries_sources.json"


@lru_cache(maxsize=1)
def _load() -> dict:
    try:
        with open(_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("content_sources: failed to load %s: %s", _DATA_FILE, e)
        return {}


# ---------------------------------------------------------------------------
# Universal type map — turns a raw entry into a ContentSource-like dict
# ---------------------------------------------------------------------------
def _normalise(entry: dict, *, kind: str, country: Optional[str] = None,
               category: Optional[str] = None) -> dict:
    return {
        "id": entry.get("id"),
        "kind": kind,
        "title": entry.get("name") or entry.get("title"),
        "description": entry.get("description") or "",
        "image": entry.get("logo") or entry.get("cover") or entry.get("image") or None,
        "category": category or entry.get("category"),
        "location": entry.get("city"),
        "country": country or entry.get("country"),
        "source": entry.get("channel") or entry.get("source") or entry.get("name"),
        "external_url": entry.get("url"),
        "metadata": {k: v for k, v in entry.items()
                     if k not in ("id", "name", "title", "description",
                                  "logo", "cover", "image", "category",
                                  "city", "country", "channel", "source", "url")},
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def list_ai_tools() -> list[dict]:
    data = _load()
    return [_normalise(e, kind="ai_tool", category=e.get("category"))
            for e in (data.get("ai_tools") or [])]


def list_videos(category: Optional[str] = None) -> list[dict]:
    data = _load()
    items = data.get("videos") or []
    if category:
        items = [e for e in items if (e.get("category") or "").lower() == category.lower()]
    return [_normalise(e, kind="video") for e in items]


def list_communities(country: Optional[str] = None) -> list[dict]:
    data = _load()
    items = data.get("communities") or []
    if country:
        cc = country.upper()
        items = [e for e in items if (e.get("country") or "").upper() in (cc, "LATAM")]
    return [_normalise(e, kind="community") for e in items]


def list_by_country(country: str, type_key: str) -> list[dict]:
    """Return curated entries for `country` + `type_key`, e.g. ('CO', 'jobs').

    Falls back to the global `fallback` bucket when the country has no
    entries for the requested type.
    """
    data = _load()
    cc = (country or "").upper()
    by_country = (data.get("by_country") or {}).get(cc) or {}
    items = by_country.get(type_key) or []
    if not items:
        items = (data.get("fallback") or {}).get(type_key) or []
    kind = {"jobs": "job", "events": "event", "news": "news",
            "companies": "company", "marketplace": "marketplace",
            "communities": "community", "education": "education"}.get(type_key, type_key)
    return [_normalise(e, kind=kind, country=cc) for e in items]


def list_by_type(type_key: str, *, country: Optional[str] = None,
                 limit: int = 50) -> list[dict]:
    """Aggregate curated items across countries for a given type.

    Priority order: country → LATAM communities → fallback pool → all.
    """
    if type_key == "ai_tools":
        return list_ai_tools()[:limit]
    if type_key == "videos":
        return list_videos()[:limit]
    if type_key == "communities":
        return list_communities(country=country)[:limit]

    out: list[dict] = []
    seen: set[str] = set()

    def add_many(entries: list[dict]):
        for e in entries:
            if e["id"] in seen:
                continue
            seen.add(e["id"])
            out.append(e)
            if len(out) >= limit:
                return

    if country:
        add_many(list_by_country(country, type_key))
    # Also pull the global fallback pool so the client never sees a full
    # empty state even when a small-market country has no curated entries.
    data = _load()
    fallback = (data.get("fallback") or {}).get(type_key) or []
    kind = {"jobs": "job", "events": "event", "news": "news"}.get(type_key, type_key)
    add_many([_normalise(e, kind=kind) for e in fallback])
    return out


def all_countries() -> list[str]:
    data = _load()
    return sorted(list((data.get("by_country") or {}).keys()))


def types_available() -> list[str]:
    data = _load()
    return list((data.get("_meta") or {}).get("types") or [])
