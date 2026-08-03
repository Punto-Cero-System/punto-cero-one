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
