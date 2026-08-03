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

from fastapi import APIRouter, Cookie, HTTPException, Query, Request

from services.discovery import resolver


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
async def entity_related(slug: str, request: Request):
    db = request.app.state.db
    entity = await _find_entity(db, slug)
    if not entity:
        raise HTTPException(404, "entity not found")
    return await resolver.gather(db, entity)


@router.get("/trending")
async def trending_companies(
    request: Request,
    limit: int = Query(default=8, ge=1, le=30),
    hours: int = Query(default=48, ge=1, le=720),
):
    """Empresas trending del ecosistema — ranking calculado a partir de datos
    reales que ya viven en Mongo:
      • mentions      = # de `growth_items` recientes con `related_companies`
      • followers     = valor cacheado en `companies.followers` (bridged)
      • posts         = # de posts sociales que mencionen tag/hashtag/slug
    Fórmula: mentions*3 + followers*1 + posts*2 · reciente < `hours`.
    """
    from datetime import datetime, timedelta, timezone
    db = request.app.state.db
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
        score = m * 3 + p * 2 + f * 1
        if score <= 0:
            continue
        ranked.append({
            **c,
            "score": score,
            "mentions_recent": m,
            "posts_recent": p,
            "followers": f,
        })
    ranked.sort(key=lambda x: (-x["score"], x.get("name") or ""))
    return {"items": ranked[:limit], "hours": hours,
            "generated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/suggested")
async def suggested_entities(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    limit: int = Query(default=10, ge=1, le=30),
):
    """Recommend entities based on the viewer's follows.

    Strategy:
      1. Load the entities the viewer already follows (kind=company).
      2. Collect their `related_ids`.
      3. Return those minus the ones already followed. Fill up with popular
         seeds if we don't hit the limit.
    """
    db = request.app.state.db

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

    # Fallback: fill up with popular public seeds not yet followed
    if len(entities) < limit:
        already = followed_slugs | {e["slug"] for e in entities}
        cursor = db.companies.find(
            {"is_public_seed": True, "is_deleted": {"$ne": True},
             "slug": {"$nin": list(already)}},
            {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
             "country": 1, "logo_url": 1, "hashtags": 1}
        ).limit(limit - len(entities))
        entities.extend([c async for c in cursor])

    return {"items": entities, "based_on": len(followed_slugs)}
