"""Content Sources System — HTTP layer (Wave 12).

Exposes:
    GET /api/content-sources/types              → available content types
    GET /api/content-sources/ai-tools           → curated AI tools catalogue
    GET /api/content-sources/videos             → curated video channels
    GET /api/content-sources/by-type/{type}     → curated list by type
                                                   (country-aware if given)
    GET /api/content-sources/mixed-feed         → the Intelligent Mixed
                                                   Feed: weighted mix of
                                                   news / jobs / events /
                                                   videos / communities /
                                                   companies / user posts,
                                                   with anti-repetition.

The mixed-feed endpoint reuses the existing `growth_items` collection
(populated by the Growth Scheduler) for dynamic content and the curated
JSON registry for zero-config content. It NEVER scrapes external sites at
request time — everything is either DB-cached or hand-curated.
"""
from __future__ import annotations

import logging
import random
from typing import Optional

from fastapi import APIRouter, Cookie, Header, Query, Request

from services.content_sources import (
    list_ai_tools, list_videos, list_by_type,
    all_countries, types_available,
)
from services.growth import aggregator
from services.growth.sources import COUNTRY_LABELS

logger = logging.getLogger("punto-cero-api.content_sources_api")

router = APIRouter(prefix="/api/content-sources", tags=["content-sources"])


ACCEPT_LANG_COUNTRY_MAP = {
    "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO",
    "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY",
    "PE", "UY", "VE", "ES",
}


def _country_from_headers(accept_language: str | None,
                          cf_country: str | None,
                          x_country: str | None) -> Optional[str]:
    for c in (cf_country, x_country):
        if c and c.upper() in ACCEPT_LANG_COUNTRY_MAP:
            return c.upper()
    if accept_language:
        first = accept_language.split(",")[0].strip()
        if "-" in first:
            region = first.split("-", 1)[1][:2].upper()
            if region in ACCEPT_LANG_COUNTRY_MAP:
                return region
    return None


async def _viewer(request: Request, session_token: Optional[str]) -> Optional[dict]:
    if not session_token:
        return None
    db = request.app.state.db
    s = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not s:
        return None
    return await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "password_hash": 0})


# ---------------------------------------------------------------------------
# Catalog endpoints
# ---------------------------------------------------------------------------

@router.get("/types")
async def types():
    return {
        "types": types_available(),
        "countries": all_countries(),
    }


@router.get("/ai-tools")
async def ai_tools(category: Optional[str] = Query(default=None)):
    items = list_ai_tools()
    if category:
        items = [e for e in items if (e.get("category") or "").lower() == category.lower()]
    return {"items": items, "total": len(items)}


@router.get("/videos")
async def videos(category: Optional[str] = Query(default=None), limit: int = Query(default=30, ge=1, le=100)):
    return {"items": list_videos(category=category)[:limit]}


@router.get("/by-type/{type_key}")
async def by_type(
    type_key: str,
    request: Request,
    country: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    session_token: Optional[str] = Cookie(default=None),
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language"),
    cf_country: Optional[str] = Header(default=None, alias="CF-IPCountry"),
    x_country: Optional[str] = Header(default=None, alias="X-User-Country"),
):
    viewer = await _viewer(request, session_token)
    resolved = (country and country.upper()) \
        or (viewer and (viewer.get("country") or "").upper()) \
        or _country_from_headers(accept_language, cf_country, x_country) \
        or None
    items = list_by_type(type_key, country=resolved, limit=limit)
    return {
        "items": items,
        "resolved_country": resolved,
        "resolved_country_label": COUNTRY_LABELS.get(resolved) if resolved else None,
        "type": type_key,
    }


# ---------------------------------------------------------------------------
# INTELLIGENT MIXED FEED
# ---------------------------------------------------------------------------

# Target distribution — the composer tries to hit these ratios but adapts
# when a bucket is empty (so users in low-signal countries still get a
# full feed).
MIX_TARGET = [
    ("news",         0.20),
    ("job",          0.15),
    ("event",        0.10),
    ("marketplace",  0.10),
    ("company",      0.10),
    ("user_post",    0.10),
    ("video",        0.10),
    ("podcast",      0.05),
    ("repo",         0.05),
    ("dataset",      0.05),
]


def _shape_growth_item(it: dict, *, kind_hint: Optional[str] = None) -> dict:
    """Project a growth_items doc into a ContentSource-ish shape."""
    country = (it.get("country") or "").upper() or None
    kind = kind_hint or it.get("kind") or "news"
    return {
        "id": it.get("id"),
        "kind": kind,
        "title": it.get("title") or "",
        "description": (it.get("summary") or "")[:280],
        "image": it.get("image_url"),
        "category": it.get("category") or it.get("vertical"),
        "location": it.get("city"),
        "country": country,
        "country_label": COUNTRY_LABELS.get(country) if country else None,
        "source": it.get("source_name") or it.get("source_id"),
        "external_url": it.get("url"),
        "created_at": it.get("published_at") or it.get("ingested_at"),
        "metadata": {
            "vertical": it.get("vertical"),
            "author": it.get("author"),
            "tags": it.get("tags") or [],
            "meta": it.get("meta") or {},
        },
    }


async def _pool_growth(db, *, kind: str, country: Optional[str], limit: int) -> list[dict]:
    """Query growth_items filtered by kind + country priority (Ciudad→País→LATAM→Global)."""
    countries: list[str] = []
    if country:
        countries = [country]
    countries.extend(["LATAM", "GLOBAL"])

    q: dict = {"kind": kind}
    q["country"] = {"$in": countries + [None]}
    cursor = db.growth_items.find(q, {"_id": 0}).sort([("published_at", -1)]).limit(limit * 2)
    docs = [d async for d in cursor]
    # Re-rank: exact-country first, then LATAM, then rest.
    if country:
        def bucket(d):
            c = (d.get("country") or "").upper()
            if c == country: return 0
            if c == "LATAM": return 1
            if c == "GLOBAL": return 2
            return 3
        docs.sort(key=bucket)
    return [_shape_growth_item(d) for d in docs[:limit]]


async def _pool_user_posts(db, *, limit: int) -> list[dict]:
    cursor = db.posts.find({"status": "published"}, {"_id": 0}).sort("created_at", -1).limit(limit)
    out: list[dict] = []
    async for p in cursor:
        author = await db.users.find_one(
            {"id": p.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "headline": 1, "country": 1},
        ) or {}
        out.append({
            "id": p["id"],
            "kind": "user_post",
            "title": (p.get("body") or "")[:120],
            "description": (p.get("body") or "")[:280],
            "image": None,
            "category": p.get("category_key"),
            "country": (author.get("country") or "").upper() or None,
            "source": author.get("name"),
            "external_url": None,
            "created_at": p.get("created_at"),
            "metadata": {
                "post": {
                    "id": p["id"],
                    "body": p.get("body"),
                    "hashtags": p.get("hashtags") or [],
                    "counts": p.get("counts") or {},
                },
                "author": {
                    "id": author.get("id"),
                    "name": author.get("name"),
                    "picture": author.get("picture"),
                    "headline": author.get("headline"),
                },
            },
        })
    return out


async def _pool_companies(db, *, country: Optional[str], limit: int) -> list[dict]:
    q: dict = {"is_deleted": {"$ne": True}, "verification": {"$in": ["verified", "pending"]}}
    if country:
        q["country"] = country
    cursor = db.companies.find(q, {"_id": 0}).sort("updated_at", -1).limit(limit * 2)
    docs = [d async for d in cursor]
    return [{
        "id": c.get("id"),
        "kind": "company",
        "title": c.get("name") or "",
        "description": (c.get("description") or c.get("tagline") or "")[:280],
        "image": c.get("logo_url") or c.get("banner_url"),
        "category": c.get("vertical"),
        "location": c.get("city"),
        "country": c.get("country"),
        "country_label": COUNTRY_LABELS.get(c.get("country")) if c.get("country") else None,
        "source": c.get("website"),
        "external_url": f"/empresa/{c.get('slug') or c.get('id')}",
        "created_at": c.get("updated_at") or c.get("created_at"),
        "metadata": {
            "slug": c.get("slug"),
            "vertical": c.get("vertical"),
            "hashtags": c.get("hashtags") or [],
        },
    } for c in docs[:limit]]


def _curated_pool(kind: str, *, country: Optional[str], limit: int) -> list[dict]:
    """Fallback pool from the curated JSON registry."""
    # Map internal kinds → registry type keys
    type_key = {
        "news": "news", "job": "jobs", "event": "events",
        "video": "videos", "marketplace": "marketplace",
        "podcast": "communities",  # podcasts share the community feel; TODO expand
        "community": "communities",
    }.get(kind)
    if not type_key:
        return []
    items = list_by_type(type_key, country=country, limit=limit)
    return items


def _interleave(pools: dict[str, list[dict]], *, total: int) -> list[dict]:
    """Weighted interleave. Never places two consecutive items of the same kind.

    We honour MIX_TARGET as a probability distribution and adapt when a
    bucket empties.
    """
    out: list[dict] = []
    last_kind: Optional[str] = None
    # Copy to avoid mutating caller state
    pools = {k: list(v) for k, v in pools.items()}
    weights = {k: w for k, w in MIX_TARGET}

    while len(out) < total:
        # Available buckets (non-empty)
        avail = [(k, weights.get(k, 0.05)) for k, v in pools.items() if v]
        if not avail:
            break
        # Avoid picking the same kind as the previous card if possible.
        candidates = [(k, w) for (k, w) in avail if k != last_kind] or avail
        # Weighted random choice
        total_w = sum(w for _, w in candidates)
        r = random.random() * total_w
        acc = 0.0
        pick = candidates[0][0]
        for k, w in candidates:
            acc += w
            if r <= acc:
                pick = k
                break
        item = pools[pick].pop(0)
        out.append(item)
        last_kind = pick
    return out


@router.get("/mixed-feed")
async def mixed_feed(
    request: Request,
    limit: int = Query(default=30, ge=6, le=80),
    country: Optional[str] = Query(default=None),
    session_token: Optional[str] = Cookie(default=None),
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language"),
    cf_country: Optional[str] = Header(default=None, alias="CF-IPCountry"),
    x_country: Optional[str] = Header(default=None, alias="X-User-Country"),
):
    """The Intelligent Mixed Feed. Returns a heterogeneous list of typed
    content items with anti-repetition and weighted distribution.

    Response items always carry a `kind` field so the frontend can pick
    the right visual card (NewsCard / JobCard / EventCard / ...).
    """
    db = request.app.state.db
    viewer = await _viewer(request, session_token)
    resolved = (country and country.upper()) \
        or (viewer and (viewer.get("country") or "").upper()) \
        or _country_from_headers(accept_language, cf_country, x_country) \
        or None

    # Ceiling per pool — we pull double the expected quota so the mixer has
    # slack to satisfy the "no two consecutive of same kind" rule.
    per_pool = max(6, limit // 4)

    news = await _pool_growth(db, kind="news", country=resolved, limit=per_pool)
    jobs = await _pool_growth(db, kind="job", country=resolved, limit=per_pool)
    events = await _pool_growth(db, kind="event", country=resolved, limit=per_pool)
    videos_dyn = await _pool_growth(db, kind="video", country=resolved, limit=per_pool)
    user_posts = await _pool_user_posts(db, limit=per_pool)
    companies = await _pool_companies(db, country=resolved, limit=per_pool)

    # Fill curated pools where dynamic pool came back empty or short.
    if len(news) < 3:
        news += _curated_pool("news", country=resolved, limit=per_pool - len(news))
    if len(jobs) < 3:
        jobs += _curated_pool("job", country=resolved, limit=per_pool - len(jobs))
    if len(events) < 3:
        events += _curated_pool("event", country=resolved, limit=per_pool - len(events))
    if len(videos_dyn) < 3:
        videos_dyn += _curated_pool("video", country=resolved, limit=per_pool - len(videos_dyn))
    marketplace_pool = _curated_pool("marketplace", country=resolved, limit=per_pool)
    podcasts_pool = []  # Reserved for future podcast connectors
    repos_pool: list[dict] = []
    async for r in db.github_repos.find({}, {"_id": 0}).sort("updated_at", -1).limit(per_pool):
        repos_pool.append({
            "id": r.get("id"),
            "kind": "repo",
            "title": r.get("full_name") or r.get("name"),
            "description": (r.get("description") or "")[:280],
            "image": None,
            "category": r.get("language"),
            "country": None,
            "source": r.get("org"),
            "external_url": r.get("url"),
            "created_at": r.get("updated_at"),
            "metadata": {"stars": r.get("stars"), "forks": r.get("forks")},
        })
    datasets_pool: list[dict] = []
    async for d in db.growth_items.find(
        {"kind": "dataset"}, {"_id": 0},
    ).sort("published_at", -1).limit(per_pool):
        datasets_pool.append(_shape_growth_item(d, kind_hint="dataset"))

    pools = {
        "news": news,
        "job": jobs,
        "event": events,
        "video": videos_dyn,
        "user_post": user_posts,
        "company": companies,
        "marketplace": marketplace_pool,
        "podcast": podcasts_pool,
        "repo": repos_pool,
        "dataset": datasets_pool,
    }

    mix = _interleave(pools, total=limit)

    # Signals summary — helps the client understand *why* it got this mix.
    summary = {k: len(v) + sum(1 for it in mix if it.get("kind") == k)
               for k, v in pools.items()}

    return {
        "items": mix,
        "resolved_country": resolved,
        "resolved_country_label": COUNTRY_LABELS.get(resolved) if resolved else None,
        "pool_sizes": {k: len(v) for k, v in pools.items()},
        "distribution": {k: sum(1 for it in mix if it.get("kind") == k) for k in pools.keys()},
    }
