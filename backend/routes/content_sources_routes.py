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
import re
from typing import Optional

from fastapi import APIRouter, Cookie, Header, Query, Request

from services.content_sources import (
    list_ai_tools, list_videos, list_by_type,
    all_countries, types_available,
)
from services.growth import aggregator
from services.growth.sources import COUNTRY_LABELS

# OMEGA CARRIL A4.1 / B4.1 — el modelo de visibilidad del Feed, reutilizado.
#
# La regla está consolidada en `services/feed_visibility.py`: `_visibility_clause`
# la traduce a una condición de Mongo y `_viewer_group_ids` resuelve los grupos
# del viewer. Este endpoint era la fuga B2 porque leía `posts` con un
# `{"status": "published"}` plano, sin ninguna de las dos.
#
# Se importa en vez de copiarse: las copias divergen, y una copia que se desvía
# es exactamente la fuga. Hasta B4.1 se importaba de `routes.feed_routes`, lo que
# obligaba a un `service` como `feed_engine` a depender de una RUTA. Con la
# extracción la dependencia queda en un solo sentido: routes → services.
# `_visibility_clause` es la MISMA función que usa `list_posts`, `search_routes` y
# (en B4) `feed_engine`: todos los endpoints que leen `posts` coinciden por
# construcción y no pueden separarse. El acceso queda acotado a estas dos llamadas.
from services.feed_visibility import _visibility_clause, _viewer_group_ids

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


# ---------------------------------------------------------------------------
# EDITORIAL COMPOSER (Wave 12 Fase 6)
# ---------------------------------------------------------------------------
# Sustituimos el interleave aleatorio por una plantilla EDITORIAL fija de 20
# slots que respeta la distribución objetivo (news 20% · job 15% · event 10%
# · user_post 10% · company 10% · marketplace 10% · video 10% · community 5%
# · podcast 5% · repo 5% · dataset 5%) Y define la jerarquía visual de cada
# slot (hero / large / medium / small) para que el frontend pueda componer
# un feed tipo revista sin decidir tamaños por su cuenta.
# ---------------------------------------------------------------------------
# Wave 12 Fase 7 — Feed SOCIAL FIRST. Las publicaciones de usuarios son
# el contenido principal; el resto se renderiza como previews compactos
# que redirigen a las páginas especializadas (Noticias, Empleos, etc.).
# El Feed sirve para DESCUBRIR — cada módulo profundiza.
EDITORIAL_TEMPLATE: list[tuple[str, str]] = [
    ("user_post",   "large"),   # 01 · publicación
    ("user_post",   "large"),   # 02 · publicación
    ("news",        "preview"), # 03 → /noticias
    ("user_post",   "large"),   # 04 · publicación
    ("job",         "preview"), # 05 → /empleos
    ("user_post",   "large"),   # 06 · publicación
    ("event",       "preview"), # 07 → /eventos
    ("user_post",   "large"),   # 08 · publicación
    ("company",     "preview"), # 09 → /empresas
    ("user_post",   "large"),   # 10 · publicación
    ("video",       "preview"), # 11 → /videos
    ("user_post",   "large"),   # 12 · publicación
    ("marketplace", "preview"), # 13 → /marketplace
    ("user_post",   "large"),   # 14 · publicación
    ("community",   "preview"), # 15 → /comunidad
    ("user_post",   "large"),   # 16 · publicación
    ("news",        "preview"), # 17 → /noticias
    ("user_post",   "large"),   # 18 · publicación
    ("podcast",     "preview"), # 19
    ("repo",        "preview"), # 20
]


def _clean_html(text: str) -> str:
    """Strip HTML entities/tags from summaries so they render as plain text."""
    if not text:
        return ""
    import html
    import re
    decoded = html.unescape(text)
    stripped = re.sub(r"<[^>]+>", " ", decoded)
    return re.sub(r"\s+", " ", stripped).strip()


def _shape_growth_item(it: dict, *, kind_hint: Optional[str] = None) -> dict:
    """Project a growth_items doc into a ContentSource-ish shape."""
    country = (it.get("country") or "").upper() or None
    kind = kind_hint or it.get("kind") or "news"
    return {
        "id": it.get("id"),
        "kind": kind,
        "title": _clean_html(it.get("title") or ""),
        "description": _clean_html(it.get("summary") or "")[:280],
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


async def _pool_growth(db, *, kind: str, country: Optional[str], limit: int, skip: int = 0) -> list[dict]:
    """Query growth_items filtered by kind + country priority (Ciudad→País→LATAM→Global)."""
    countries: list[str] = []
    if country:
        countries = [country]
    countries.extend(["LATAM", "GLOBAL"])

    q: dict = {"kind": kind}
    q["country"] = {"$in": countries + [None]}
    cursor = db.growth_items.find(q, {"_id": 0}).sort([("published_at", -1)]).skip(skip).limit(limit * 3)
    docs = [d async for d in cursor]
    # Dedupe by title (case-insensitive) so the same headline sourced under
    # multiple countries (e.g. CO + LATAM) doesn't appear twice in one page.
    seen_titles: set[str] = set()
    unique: list[dict] = []
    for d in docs:
        key = (d.get("title") or "").strip().lower()
        if not key or key in seen_titles:
            continue
        seen_titles.add(key)
        unique.append(d)
    docs = unique
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


# Regex catches automated-test post bodies ("Case1", "Case42", "MixedFeedCase",
# "list-endpoint-check", "mixed-feed image", bare "📷" placeholder, …) so they
# never reach the public feed. The feed then backfills with regional news /
# events / jobs — informative content for real visitors.
_TEST_POST_BODY_RE = re.compile(
    r"^\s*(?:case\s?\d+|mixedfeedcase\b|list-endpoint-check\b|mixed-feed image\b|📷)\s*$",
    re.IGNORECASE,
)


def _is_test_post(body: str | None) -> bool:
    if not body:
        return True  # empty body without image is also uninformative
    if _TEST_POST_BODY_RE.match(body.strip()):
        return True
    return False


async def _pool_user_posts(db, *, limit: int, skip: int = 0,
                          viewer: Optional[dict] = None) -> list[dict]:
    # Pull a wider window (limit * 3) then filter out test artifacts client-side
    # so the informative pool ends up close to `limit`. We can't do the regex
    # entirely inside Mongo because the filter also excludes empty-body posts
    # unless they have an image_url.
    #
    # OMEGA CARRIL A4.1 — la visibilidad va EN LA QUERY, no en el bucle de Python.
    # Es la misma razón que en `feed_routes.list_posts`: si se filtrara después,
    # el pool se llenaría con posts invisibles y `offset` paginaría sobre huecos —
    # el usuario vería posts saltados y el resultado NO coincidiría con el Feed.
    # Integrada en la query, este endpoint devuelve exactamente el mismo
    # conjunto que vería el viewer en `/api/feed/posts`.
    raw_limit = max(limit * 3, limit + 10)
    query: dict = {"status": "published"}
    vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))
    if "$or" in vis_clause:
        query["$or"] = vis_clause["$or"]
    else:
        query["visibility"] = vis_clause["visibility"]
    cursor = db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(raw_limit)
    out: list[dict] = []
    async for p in cursor:
        body = p.get("body")
        # Keep the post if body is meaningful OR it carries a real image_url.
        if _is_test_post(body) and not p.get("image_url"):
            continue
        # Body still matches a test-artifact pattern → skip even if it has
        # a (usually 1×1) test image.
        if body and _TEST_POST_BODY_RE.match(body.strip()):
            continue
        author = await db.users.find_one(
            {"id": p.get("author_id")},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "headline": 1, "country": 1, "email": 1},
        ) or {}
        # Also skip posts from the automated e2e community accounts.
        if (author.get("email") or "").endswith(".test-e2e.com"):
            continue
        out.append({
            "id": p["id"],
            "kind": "user_post",
            "title": (body or "")[:120],
            "description": (body or "")[:280],
            "image": p.get("image_url"),
            "category": p.get("category_key"),
            "country": (author.get("country") or "").upper() or None,
            "source": author.get("name"),
            "external_url": None,
            "created_at": p.get("created_at"),
            "metadata": {
                "post": {
                    "id": p["id"],
                    "body": body,
                    "hashtags": p.get("hashtags") or [],
                    "image_url": p.get("image_url"),
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
        if len(out) >= limit:
            break
    return out


async def _pool_companies(db, *, country: Optional[str], limit: int, skip: int = 0) -> list[dict]:
    # A company earns a slot in this pool by being either a curated directory
    # entry OR a record that has been through verification. Directory entries
    # are `origin: "directory"` + `verification: "unverified"`, so filtering on
    # `verification` alone would silently drop the whole catalogue.
    # `is_public_seed` is kept in the OR as the legacy marker for documents
    # written before `origin` existed, so the pool is identical to before the
    # origin/verification split.
    q: dict = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"origin": "directory"},
            {"is_public_seed": True},
            {"verification": {"$in": ["verified", "pending"]}},
        ],
    }
    if country:
        q["country"] = country
    cursor = db.companies.find(q, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit * 2)
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


def _compose_editorial(pools: dict[str, list[dict]], *, total: int) -> list[dict]:
    """Editorial composer — deterministic, magazine-style.

    Recorre `EDITORIAL_TEMPLATE` en pases. Cada pase que empieza produce
    como máximo un item por slot, en el orden del template. Slots cuyo
    pool esté vacío se OMITEN (no se sustituyen para no romper el ritmo
    editorial). Cuando el template se acabó pero aún faltan items para
    llegar a `total`, damos otro pase — pero **forzando** el layout a
    'medium' para NO duplicar el `hero` inicial ni los `large` (evita el
    bug reportado por el testing agent en iteration 29).

    Reglas invariantes:
      1. Nunca dos cards consecutivas con el mismo `kind`.
      2. Solo un item con `layout='hero'` en todo el output.
      3. Los `layout='large'` solo aparecen en el primer pase.
    """
    pools = {k: list(v) for k, v in pools.items()}
    out: list[dict] = []
    last_kind: Optional[str] = None
    pass_index = 0
    empty_passes = 0

    while len(out) < total:
        made_progress = False
        for slot_idx, (kind, layout) in enumerate(EDITORIAL_TEMPLATE):
            if len(out) >= total:
                break
            if not pools.get(kind):
                continue
            if kind == last_kind:
                # Skip para no repetir kind consecutivo.
                continue
            # Downgrade hero/large en pases subsiguientes (evita heros
            # duplicados). Preview mantiene su tamaño compacto siempre.
            if pass_index > 0 and layout in ("hero", "large"):
                effective_layout = "medium"
            else:
                effective_layout = layout
            item = pools[kind].pop(0)
            out.append({
                **item,
                "layout": effective_layout,
                "block": slot_idx + 1,
            })
            last_kind = kind
            made_progress = True

        pass_index += 1
        if not made_progress:
            empty_passes += 1
            if empty_passes >= 2:
                # Ningún pool tiene items nuevos que respeten anti-repetición.
                break
        else:
            empty_passes = 0
    return out


@router.get("/mixed-feed")
async def mixed_feed(
    request: Request,
    limit: int = Query(default=30, ge=6, le=80),
    offset: int = Query(default=0, ge=0, le=1000),
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

    Pagination: pass `offset` to skip N items from each pool and get the
    next batch. When `next_offset` in the response is null, the pools
    are exhausted for this session.
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

    news = await _pool_growth(db, kind="news", country=resolved, limit=per_pool, skip=offset)
    jobs = await _pool_growth(db, kind="job", country=resolved, limit=per_pool, skip=offset)
    events = await _pool_growth(db, kind="event", country=resolved, limit=per_pool, skip=offset)
    videos_dyn = await _pool_growth(db, kind="video", country=resolved, limit=per_pool, skip=offset)
    # OMEGA CARRIL A4.1 — el viewer ya se resolvía aquí para el país; ahora también
    # gobierna qué posts del pool son visibles. Es el MISMO viewer que la
    # resolución de país, sin ninguna consulta extra.
    user_posts = await _pool_user_posts(db, limit=per_pool, skip=offset, viewer=viewer)
    companies = await _pool_companies(db, country=resolved, limit=per_pool, skip=offset)

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
    community_pool = _curated_pool("community", country=resolved, limit=per_pool)
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
        "community": community_pool,
        "podcast": podcasts_pool,
        "repo": repos_pool,
        "dataset": datasets_pool,
    }

    mix = _compose_editorial(pools, total=limit)

    # Signals summary — helps the client understand *why* it got this mix.
    layout_counts: dict[str, int] = {}
    for it in mix:
        layout_counts[it.get("layout", "medium")] = layout_counts.get(it.get("layout", "medium"), 0) + 1

    # next_offset for infinite scroll — advance by whatever we returned.
    # When all pools returned empty (mix is short of `limit`), we've
    # exhausted the sources and signal EOF via next_offset=None.
    next_offset: Optional[int] = None
    if len(mix) >= max(6, limit // 3):  # meaningful batch → try next page
        next_offset = offset + per_pool

    return {
        "items": mix,
        "offset": offset,
        "next_offset": next_offset,
        "resolved_country": resolved,
        "resolved_country_label": COUNTRY_LABELS.get(resolved) if resolved else None,
        "pool_sizes": {k: len(v) for k, v in pools.items()},
        "distribution": {k: sum(1 for it in mix if it.get("kind") == k) for k in pools.keys()},
        "layout_distribution": layout_counts,
        "editorial_template_size": len(EDITORIAL_TEMPLATE),
    }
