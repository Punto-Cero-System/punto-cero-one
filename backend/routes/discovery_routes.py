"""Discovery routes — expose the entity-related aggregations.

Cero pantallas nuevas: la ficha se sigue renderizando con
CompanyProfilePage. Simplemente extendemos el backend para que la ficha
también sepa entregar noticias, videos, repos, empleos, eventos y
entidades similares.

Endpoints
---------
    GET /api/discovery/entity/{slug}          → ficha + resolved public metadata
    GET /api/discovery/entity/{slug}/related  → news + repos + videos + jobs + events + similar
    GET /api/discovery/suggested              → recomendaciones basadas en los follows del usuario
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Cookie, Header, HTTPException, Query, Request

from services.discovery import resolver
from services.discovery.regional import (
    normalize_country, regional_sort, filter_scope, LATAM_PLUS_ES,
)


async def _resolve_user_context(request: Request,
                                 session_token: Optional[str] = None,
                                 authorization: Optional[str] = None,
                                 override: Optional[str] = None,
                                 city_override: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Resolve (user_country, user_city). Same priority chain as before:
      1. explicit override
      2. authenticated user's stored country/city
      3. `X-Region-Country` / `X-Region-City` headers
      4. `Accept-Language` (country only)
    """
    country: Optional[str] = normalize_country(override) if override else None
    city: Optional[str] = (city_override or "").strip() or None
    db = request.app.state.db
    if not country or not city:
        try:
            token = None
            if session_token:
                token = session_token
            elif authorization and authorization.lower().startswith("bearer "):
                token = authorization.split(" ", 1)[1].strip()
            if token:
                sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0, "user_id": 1})
                if sess:
                    u = await db.users.find_one(
                        {"id": sess["user_id"]},
                        {"_id": 0, "country": 1, "city": 1},
                    )
                    if u:
                        if not country and u.get("country"):
                            country = normalize_country(u["country"])
                        if not city and u.get("city"):
                            city = u["city"]
        except Exception:
            pass
    if not country:
        hdr = request.headers.get("x-region-country")
        if hdr:
            country = normalize_country(hdr)
    if not city:
        hdr = request.headers.get("x-region-city")
        if hdr:
            city = hdr.strip() or None
    if not country:
        al = request.headers.get("accept-language", "")
        if al:
            first = al.split(",", 1)[0].strip()
            if "-" in first:
                tail = first.split("-", 1)[1].split(";", 1)[0].strip().upper()
                if len(tail) == 2 and tail in LATAM_PLUS_ES:
                    country = tail
    return country, city


# Back-compat wrapper — some routes still call the older signature.
async def _resolve_user_country(request: Request, **kw) -> Optional[str]:
    c, _ = await _resolve_user_context(request, **kw)
    return c


logger = logging.getLogger("punto-cero-api.discovery")
router = APIRouter(prefix="/api/discovery", tags=["discovery"])


async def _find_entity(db, slug: str) -> Optional[dict]:
    # First try seed entities (slug is stable), then fall back to member companies.
    doc = await db.companies.find_one(
        {"slug": slug, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    return doc


@router.get("/entity/{slug}")
async def entity_ficha(slug: str, request: Request):
    db = request.app.state.db
    entity = await _find_entity(db, slug)
    if not entity:
        raise HTTPException(404, "entity not found")
    return entity


@router.get("/entity/{slug}/related")
async def entity_related(
    slug: str,
    request: Request,
    country: Optional[str] = Query(default=None, description="ISO alpha-2 override (e.g. CO)"),
    city: Optional[str] = Query(default=None, description="City override"),
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    db = request.app.state.db
    entity = await _find_entity(db, slug)
    if not entity:
        raise HTTPException(404, "entity not found")
    user_country, user_city = await _resolve_user_context(
        request, session_token=session_token, authorization=authorization,
        override=country, city_override=city,
    )
    return await resolver.gather(db, entity, user_country=user_country, user_city=user_city)


@router.get("/trending")
async def trending_companies(
    request: Request,
    limit: int = Query(default=8, ge=1, le=30),
    hours: int = Query(default=48, ge=1, le=720),
    scope: str = Query(default="all", pattern="^(all|country|latam|global)$"),
    country: Optional[str] = Query(default=None),
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Empresas trending del ecosistema — ranking calculado a partir de datos
    reales que ya viven en Mongo:
      • mentions      = # de `growth_items` recientes con `related_companies`
      • followers     = valor cacheado en `companies.followers` (bridged)
      • posts         = # de posts sociales que mencionen tag/hashtag/slug
    Fórmula base: mentions*3 + followers*1 + posts*2 · reciente < `hours`.

    Regional weighting (60/25/15 country/LATAM/global) is applied on top of
    the base score. `scope` allows the frontend to slice into a specific
    tier without new endpoints — 'Trending Colombia', 'Trending LATAM' and
    'Trending Global' all live here.
    """
    from datetime import datetime, timedelta, timezone
    from services.discovery.regional import region_score, filter_scope as _filter_scope
    db = request.app.state.db
    user_country = await _resolve_user_country(
        request, session_token=session_token, authorization=authorization, override=country,
    )
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    # 1) Recuento de menciones en growth_items recientes (fuente principal).
    mentions_pipeline = [
        {"$match": {"related_companies": {"$exists": True, "$ne": []},
                     "published_at": {"$gte": since}}},
        {"$unwind": "$related_companies"},
        {"$group": {"_id": "$related_companies", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": limit * 4},
    ]
    mentions: dict[str, int] = {}
    async for r in db.growth_items.aggregate(mentions_pipeline):
        if r.get("_id"):
            mentions[r["_id"]] = r.get("n", 0)

    # 2) Recuento de posts recientes con menciones (hashtag/slug/company_id).
    posts_pipeline = [
        {"$match": {"created_at": {"$gte": since},
                     "moderation_status": {"$ne": "removed"}}},
        {"$project": {"tags": {"$ifNull": ["$hashtags", []]},
                       "company_id": 1}},
    ]
    posts_by_slug: dict[str, int] = {}
    # Cheap: iterate small window
    async for p in db.posts.find({"created_at": {"$gte": since},
                                    "moderation_status": {"$ne": "removed"}},
                                   {"_id": 0, "hashtags": 1, "body": 1, "company_id": 1}).limit(2000):
        seen_here: set[str] = set()
        for h in (p.get("hashtags") or []):
            k = str(h).lower().lstrip("#")
            if k and k not in seen_here:
                seen_here.add(k)
        if p.get("company_id"):
            seen_here.add(str(p["company_id"]))
        for s in seen_here:
            posts_by_slug[s] = posts_by_slug.get(s, 0) + 1

    # 3) Merge slug universe.
    candidate_slugs: set[str] = set(mentions.keys()) | set(posts_by_slug.keys())
    if not candidate_slugs:
        return {"items": [], "hours": hours, "generated_at": datetime.now(timezone.utc).isoformat()}

    # 4) Enrich with company metadata + follower counts.
    companies = {}
    async for c in db.companies.find(
        {"slug": {"$in": list(candidate_slugs)}, "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
         "country": 1, "logo_url": 1, "hashtags": 1, "tags": 1},
    ):
        companies[c["slug"]] = c

    # Follower counts (bridged in follows/company_follows).
    follower_counts: dict[str, int] = {}
    if companies:
        ids_or_slugs = list(companies.keys()) + [c["id"] for c in companies.values() if c.get("id")]
        async for r in db.follows.aggregate([
            {"$match": {"entity_type": "company", "entity_id": {"$in": ids_or_slugs}}},
            {"$group": {"_id": "$entity_id", "n": {"$sum": 1}}},
        ]):
            follower_counts[r["_id"]] = r.get("n", 0)

    ranked: list[dict] = []
    for slug, c in companies.items():
        m = mentions.get(slug, 0)
        p = posts_by_slug.get(slug, 0)
        f = follower_counts.get(slug, 0) or follower_counts.get(c.get("id") or "", 0)
        base = m * 3 + p * 2 + f * 1
        if base <= 0:
            continue
        # Regional boost — multiplies by 1.0 (country), 0.42 (LATAM), 0.25 (global)
        # by default (60/25/15 normalized to 100 → 1.0/0.417/0.25).
        reg_w = region_score(c.get("country"), user_country) / 60.0 if user_country else 1.0
        score = base * (reg_w if user_country else 1.0)
        ranked.append({
            **c,
            "score": round(score, 3),
            "base_score": base,
            "regional_weight": round(reg_w, 3),
            "mentions_recent": m,
            "posts_recent": p,
            "followers": f,
        })
    # Optional slice by explicit tier.
    if scope != "all" and user_country:
        ranked = _filter_scope(ranked, scope, user_country)
    ranked.sort(key=lambda x: (-x["score"], x.get("name") or ""))
    return {"items": ranked[:limit], "hours": hours,
            "user_country": user_country, "scope": scope,
            "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/suggested")
async def suggested_entities(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=10, ge=1, le=30),
    country: Optional[str] = Query(default=None),
):
    """Recommend entities based on the viewer's follows.

    Strategy:
      1. Load the entities the viewer already follows (kind=company).
      2. Collect their `related_ids`.
      3. Return those minus the ones already followed. Fill up with popular
         seeds if we don't hit the limit.
      4. Apply the regional 60/25/15 sort so local companies come first.
    """
    db = request.app.state.db
    user_country = await _resolve_user_country(
        request, session_token=session_token, authorization=authorization, override=country,
    )

    followed_slugs: set[str] = set()
    if session_token:
        s = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if s:
            uid = s["user_id"]
            async for f in db.follows.find({"user_id": uid, "entity_type": "company"},
                                           {"_id": 0, "entity_id": 1}):
                # entity_id can be either the company `id` or the `slug` —
                # try both so recommendations kick in for both writer paths.
                c = await db.companies.find_one(
                    {"$or": [{"id": f["entity_id"]}, {"slug": f["entity_id"]}]},
                    {"_id": 0, "slug": 1}
                )
                if c and c.get("slug"):
                    followed_slugs.add(c["slug"])

    candidate_slugs: list[str] = []
    if followed_slugs:
        cursor = db.companies.find(
            {"slug": {"$in": list(followed_slugs)}},
            {"_id": 0, "related_ids": 1}
        )
        async for c in cursor:
            for r in (c.get("related_ids") or []):
                if r not in followed_slugs and r not in candidate_slugs:
                    candidate_slugs.append(r)

    entities: list[dict] = []
    if candidate_slugs:
        cursor = db.companies.find(
            {"slug": {"$in": candidate_slugs}, "is_public_seed": True,
             "is_deleted": {"$ne": True}},
            {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
             "country": 1, "logo_url": 1, "hashtags": 1}
        ).limit(limit)
        entities.extend([c async for c in cursor])

    # Fallback: fill up with popular public seeds not yet followed. When we
    # know the user's country, prefer local seeds first so the fallback tier
    # also feels regional.
    if len(entities) < limit:
        already = followed_slugs | {e["slug"] for e in entities}
        base_q = {"is_public_seed": True, "is_deleted": {"$ne": True},
                  "slug": {"$nin": list(already)}}
        if user_country:
            local_q = {**base_q, "country": user_country}
            cursor = db.companies.find(
                local_q,
                {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
                 "country": 1, "logo_url": 1, "hashtags": 1}
            ).limit(limit - len(entities))
            entities.extend([c async for c in cursor])
            already |= {e["slug"] for e in entities}
        if len(entities) < limit:
            cursor = db.companies.find(
                {**base_q, "slug": {"$nin": list(already)}},
                {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
                 "country": 1, "logo_url": 1, "hashtags": 1}
            ).limit(limit - len(entities))
            entities.extend([c async for c in cursor])

    entities = regional_sort(entities, user_country)
    return {"items": entities, "based_on": len(followed_slugs),
            "user_country": user_country}
