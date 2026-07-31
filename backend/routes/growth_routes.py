"""Growth Engine — public API.

Endpoints
---------
    GET  /api/growth/feed         → growth items projected as feed posts
                                     (renderable by the existing FeedPostCard)
    GET  /api/growth/sources      → catalogue + enabled state (public info)
    POST /api/growth/refresh      → force an immediate ingestion (admin only)
    POST /api/growth/sources/{id} → toggle enabled (admin only)

Country detection for anonymous visitors uses `Accept-Language` + a couple of
Cloudflare / X-Forwarded headers when present. No IP geolocation service is
called — we only read hints the client already sent.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request

from auth import require_admin
from services.growth import aggregator, sources, recommender
from services.growth.sources import COUNTRIES, COUNTRY_LABELS


logger = logging.getLogger("punto-cero-api.growth")

router = APIRouter(prefix="/api/growth", tags=["growth"])


ACCEPT_LANG_COUNTRY_MAP = {
    "AR": "AR", "BO": "BO", "BR": "BR", "CL": "CL", "CO": "CO", "CR": "CR",
    "CU": "CU", "DO": "DO", "EC": "EC", "SV": "SV", "GT": "GT", "HN": "HN",
    "MX": "MX", "NI": "NI", "PA": "PA", "PY": "PY", "PE": "PE", "UY": "UY",
    "VE": "VE", "ES": "ES",
}


def _country_from_headers(accept_language: str | None,
                          cf_country: str | None,
                          x_country: str | None) -> Optional[str]:
    for candidate in (cf_country, x_country):
        if candidate and candidate.upper() in ACCEPT_LANG_COUNTRY_MAP:
            return candidate.upper()
    if accept_language:
        # es-CO,es;q=0.9 → look at first tag
        first = accept_language.split(",")[0].strip()
        if "-" in first:
            region = first.split("-", 1)[1][:2].upper()
            if region in ACCEPT_LANG_COUNTRY_MAP:
                return region
    return None


async def _viewer_from_cookie(request: Request, session_token: Optional[str]) -> Optional[dict]:
    if not session_token:
        return None
    db = request.app.state.db
    s = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not s:
        return None
    return await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "password_hash": 0})


def _project_as_post(item: dict) -> dict:
    """Project a growth item into the shape the frontend Feed already renders.

    Uses a stable synthetic author (`source-<sourceId>`) so the card can be
    rendered by FeedPostCard without any modification. `is_growth`/`source`
    let the UI optionally show a subtle badge.
    """
    country = (item.get("country") or "").upper()
    country_label = COUNTRY_LABELS.get(country) or country
    return {
        "id": item["id"],
        "author": {
            "id": f"source-{item['source_id']}",
            "name": item.get("source_name") or item.get("source_id"),
            "headline": f"{item.get('category') or 'Fuente pública'}"
                        + (f" · {country_label}" if country_label else ""),
            "picture": None,
            "email": None,
            "role": "source",
        },
        "body": _compose_body(item),
        "hashtags": _hashtags_for(item),
        "category_key": item.get("vertical") or None,
        "visibility": "public",
        "link_url": item["url"],
        "counts": {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0},
        "reactions_by_kind": {},
        "my_reaction": None,
        "my_saved": False,
        "status": "published",
        "created_at": item.get("published_at"),
        "updated_at": item.get("published_at"),

        # extra metadata for the Feed card
        "is_growth": True,
        "source": {
            "id": item.get("source_id"),
            "name": item.get("source_name"),
            "country": country,
            "country_label": country_label,
            "city": item.get("city"),
            "vertical": item.get("vertical"),
            "image_url": item.get("image_url"),
            "url": item.get("url"),
        },
    }


def _compose_body(item: dict) -> str:
    title = item.get("title") or ""
    summary = item.get("summary") or ""
    if not summary:
        return title
    if summary.startswith(title[:60]):
        return summary
    return f"{title}\n\n{summary}"


def _hashtags_for(item: dict) -> list[str]:
    tags: list[str] = []
    if item.get("country") and item["country"] not in ("LATAM", "GLOBAL"):
        tags.append(item["country"].lower())
    if item.get("vertical") and item["vertical"] != "general":
        tags.append(item["vertical"])
    if item.get("city"):
        tags.append(item["city"].lower().replace(" ", ""))
    return tags[:5]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/feed")
async def growth_feed(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    country: Optional[str] = Query(default=None, description="ISO 3166-1 alpha-2 override"),
    vertical: Optional[str] = Query(default=None),
    session_token: Optional[str] = Cookie(default=None),
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language"),
    cf_country: Optional[str] = Header(default=None, alias="CF-IPCountry"),
    x_country: Optional[str] = Header(default=None, alias="X-User-Country"),
):
    """Return growth items projected as feed posts.

    Country resolution order:
        query.country → viewer.country → headers → LATAM
    """
    db = request.app.state.db
    viewer = await _viewer_from_cookie(request, session_token)

    viewer_country = None
    viewer_verticals: list[str] = []
    viewer_language: Optional[str] = None
    if viewer:
        viewer_country = (viewer.get("country") or "").upper() or None
        viewer_verticals = [v.lower() for v in (viewer.get("verticals") or [])]

    resolved = (country and country.upper()) \
        or viewer_country \
        or _country_from_headers(accept_language, cf_country, x_country) \
        or None

    # Compose the layered query: country → LATAM → GLOBAL, with cascading
    # fallback so the feed is NEVER empty.
    pool: list[dict] = []
    seen: set[str] = set()

    async def take(countries: list[str] | None, vert: Optional[str], want: int):
        nonlocal pool, seen
        if want <= 0:
            return
        items = await aggregator.latest_items(
            db,
            countries=countries,
            vertical=vert,
            limit=want * 2,
            exclude_ids=list(seen),
        )
        for it in items:
            if it["id"] in seen:
                continue
            seen.add(it["id"])
            pool.append(it)
            if len(pool) >= limit:
                break

    # 1) User country
    if resolved:
        await take([resolved], vertical, limit)
    # 2) LATAM fallback
    if len(pool) < limit:
        await take(["LATAM"], vertical, limit - len(pool))
    # 3) Global fallback
    if len(pool) < limit:
        await take(["GLOBAL"], vertical, limit - len(pool))
    # 4) Anything (last-resort)
    if len(pool) < limit:
        await take(None, vertical, limit - len(pool))

    ranked = recommender.rank(
        pool, viewer_country=resolved,
        viewer_verticals=(viewer_verticals or ([vertical] if vertical else [])),
        viewer_language=viewer_language,
    )

    items = [_project_as_post(it) for it in ranked[:limit]]
    return {
        "items": items,
        "next_cursor": None,
        "resolved_country": resolved,
        "resolved_country_label": COUNTRY_LABELS.get(resolved) if resolved else None,
    }


@router.get("/sources")
async def list_sources(request: Request):
    """Public catalogue with enabled state (safe: only public URLs)."""
    db = request.app.state.db
    return {
        "countries": [{"code": c, "label": COUNTRY_LABELS.get(c)} for c in COUNTRIES],
        "sources": await aggregator.active_sources(db),
    }


@router.post("/refresh")
async def refresh(request: Request, admin: dict = Depends(require_admin)):
    """Force a new run. Admin only — protects RSS servers from abuse."""
    db = request.app.state.db
    result = await aggregator.run_once(db)
    return result


@router.post("/sources/{source_id}")
async def toggle_source(source_id: str, request: Request,
                        enabled: bool = Query(...),
                        admin: dict = Depends(require_admin)):
    db = request.app.state.db
    try:
        result = await aggregator.set_source_enabled(db, source_id, enabled)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
