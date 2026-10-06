"""Feed engine — assembles signals, fans out to providers, ranks posts."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

from .base import FeedItem, FeedSignals, FeedMode
from .providers import DEFAULT_PROVIDERS

# OMEGA B4.2 — la visibilidad del Feed, desde la autoridad compartida.
#
# Se importa de `services.feed_visibility` y NUNCA de `routes.feed_routes`:
# un servicio no puede depender de una ruta. B4.1 movió la regla precisamente
# para que este import fuera posible sin invertir la arquitectura.
# `_visibility_clause` es la MISMA función que usan `list_posts` (A2), las seis
# interacciones (A3), el Mixed Feed (A4.1) y la búsqueda global (B3), así que
# todos los endpoints que leen `posts` coinciden por construcción.
from services.feed_visibility import _visibility_clause, _viewer_group_ids


def _pool_query(base: dict, viewer_group_ids: set) -> dict:
    """La query del pool con la visibilidad YA integrada.

    B4.2 — la visibilidad se aplica AQUÍ, al construir el pool, y nunca después
    del ranking. La razón no es estética: el ranking termina en
    `top = ranked[:limit]`, así que un post invisible que hubiera entrado en el
    pool expulsaría a uno visible del `limit`. Filtrar tarde no solo deja pasar
    la fuga: además convierte el endpoint en un oráculo ("no veo este post que
    sé que existe, luego hay algo oculto ocupándome el sitio").

    Integrarlo en la query tiene un segundo efecto que sí cambia el ranking, y es
    a mejor: el pool de `pool_size` se llena solo con posts visibles, así que el
    presupuesto de ranking se aprovecha íntegro. Filtrando en memoria se perderían
    plazas de las 200 con contenido que nadie puede leer.

    Se fusiona como `visibility` o como `$or` según lo que devuelva la cláusula,
    igual que hace `list_posts`. Las queries de este módulo no usan `$or` por su
    cuenta, así que no hay conflicto posible.
    """
    vis_clause = _visibility_clause(viewer_group_ids)
    if "$or" in vis_clause:
        base["$or"] = vis_clause["$or"]
    else:
        base["visibility"] = vis_clause["visibility"]
    return base


async def load_user_signals(db, user: Optional[dict]) -> FeedSignals:
    """Load everything we need to rank in one pass."""
    if not user:
        return FeedSignals()

    user_id = user["id"]
    verticals = set([v.lower() for v in (user.get("verticals") or [])])
    interests = set([i.lower() for i in (user.get("interests") or [])])
    country = user.get("country")

    # Load unified social graph — Wave 4A adds user/hashtag/country/vertical/event follows
    # alongside the legacy company_follows collection.
    followed_user_ids: set[str] = set()
    followed_hashtags: set[str] = set()
    followed_countries: set[str] = set()
    followed_event_ids: set[str] = set()
    async for f in db.follows.find({"user_id": user_id}, {"_id": 0, "entity_type": 1, "entity_id": 1}):
        et, eid = f.get("entity_type"), f.get("entity_id")
        if not eid:
            continue
        if et == "user":
            followed_user_ids.add(eid)
        elif et == "hashtag":
            followed_hashtags.add(eid.lower().lstrip("#"))
        elif et == "country":
            followed_countries.add(eid.lower())
        elif et == "event":
            followed_event_ids.add(eid)
        elif et == "vertical":
            verticals.add(eid.lower())

    # Followed companies (and their owners → author-level boost)
    followed_company_ids: set[str] = set()
    followed_company_owner_ids: set[str] = set()
    async for f in db.company_follows.find({"user_id": user_id}, {"_id": 0, "company_id": 1}):
        followed_company_ids.add(f["company_id"])
    if followed_company_ids:
        # company_follows historically stored either the numeric `id` or the
        # human-friendly `slug`. Query companies by both `id` and `slug` so
        # follows are resolved regardless of which form was persisted.
        ids_list = list(followed_company_ids)
        async for c in db.companies.find(
            {"$or": [{"id": {"$in": ids_list}}, {"slug": {"$in": ids_list}}]},
            {"_id": 0, "owner_id": 1, "vertical": 1, "hashtags": 1, "tags": 1, "country": 1},
        ):
            if c.get("owner_id"):
                followed_company_owner_ids.add(c["owner_id"])
            if c.get("vertical"):
                verticals.add(c["vertical"].lower())
            # Feed inherit: hashtags + tags declared on the followed company
            # feed the hashtag/interaction scoring providers, so following a
            # company immediately raises related content in the ranking even
            # when the company itself doesn't have posts yet.
            for t in (c.get("hashtags") or []):
                followed_hashtags.add((t or "").lower().lstrip("#"))
            for t in (c.get("tags") or []):
                followed_hashtags.add((t or "").lower().lstrip("#"))
            if c.get("country"):
                followed_countries.add(str(c["country"]).lower())

    # Author affinity from past reactions + comments + saves (last 90 days).
    interaction_author_ids: set[str] = set()
    interaction_hashtags: set[str] = set()
    since_iso = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

    # 1) reactions/saves → look up target posts
    interacted_post_ids: set[str] = set()
    async for r in db.post_reactions.find({"user_id": user_id, "created_at": {"$gte": since_iso}},
                                          {"_id": 0, "post_id": 1}):
        interacted_post_ids.add(r["post_id"])
    async for s in db.post_saves.find({"user_id": user_id, "created_at": {"$gte": since_iso}},
                                      {"_id": 0, "post_id": 1}):
        interacted_post_ids.add(s["post_id"])
    # 2) comments (comments live in `post_comments`)
    async for c in db.post_comments.find({"author_id": user_id, "created_at": {"$gte": since_iso}},
                                         {"_id": 0, "post_id": 1}):
        interacted_post_ids.add(c["post_id"])

    if interacted_post_ids:
        async for p in db.posts.find(
            {"id": {"$in": list(interacted_post_ids)}},
            {"_id": 0, "author_id": 1, "hashtags": 1},
        ):
            if p.get("author_id"):
                interaction_author_ids.add(p["author_id"])
            for t in (p.get("hashtags") or []):
                interaction_hashtags.add((t or "").lower())

    return FeedSignals(
        user_id=user_id,
        followed_user_ids=followed_user_ids,
        followed_company_ids=followed_company_ids,
        followed_company_owner_ids=followed_company_owner_ids,
        verticals=verticals,
        interests=interests,
        country=country,
        interaction_author_ids=interaction_author_ids,
        interaction_hashtags=interaction_hashtags | followed_hashtags,
    )


async def _rank_posts(db, posts: list[dict], signals: FeedSignals) -> list[FeedItem]:
    """Fan out scoring per post × provider. Providers are cheap and in-memory."""
    async def score_one(p: dict) -> FeedItem:
        total = 0.0
        reasons: list[str] = []
        for prov in DEFAULT_PROVIDERS:
            delta, reason = await prov.score(db, p, signals)
            total += delta
            if reason:
                reasons.append(reason)
        return FeedItem(post=p, score=round(total, 3), reasons=reasons)

    return await asyncio.gather(*(score_one(p) for p in posts))


async def build_for_you_feed(
    db,
    user: Optional[dict],
    *,
    limit: int = 20,
    pool_size: int = 200,
    lookback_days: int = 30,
) -> tuple[list[FeedItem], FeedMode]:
    """Rank the last `pool_size` published posts within `lookback_days` and
    return the top `limit`. Anonymous users skip ranking entirely.

    B4.2 — el pool se construye ya filtrado por visibilidad, en los DOS caminos
    (anónimo y autenticado). Antes solo filtraba `status`, así que un post
    `members` aparecía en "Para Ti" para cualquiera, mientras `/api/feed/posts`
    y el Mixed Feed ya lo ocultaban.

    La firma pública no cambia: `user` ya era el contexto del viewer y es lo que
    se pasa a `_viewer_group_ids`. El anónimo resuelve a `set()` sin lanzar
    ninguna consulta, así que este camino no cuesta nada adicional.
    """
    # Una sola resolución por petición, compartida por ambos caminos.
    # `_viewer_group_ids` corta en seco si el viewer no trae `id` (anónimo), así
    # que en ese caso no se toca `group_members` ni `groups`: cero consultas
    # extra para el visitante.
    viewer_group_ids = await _viewer_group_ids(db, user)

    if not user:
        cursor = db.posts.find(
            _pool_query({"status": "published"}, viewer_group_ids), {"_id": 0},
        ).sort("created_at", -1).limit(limit)
        docs = [d async for d in cursor]
        return [FeedItem(post=d, score=0.0) for d in docs], FeedMode.CHRONOLOGICAL

    since = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat()
    cursor = db.posts.find(
        _pool_query({"status": "published", "created_at": {"$gte": since}},
                    viewer_group_ids),
        {"_id": 0},
    ).sort("created_at", -1).limit(pool_size)
    pool = [d async for d in cursor]
    if not pool:
        return [], FeedMode.CHRONOLOGICAL

    # A partir de aquí nada cambia: mismas señales, mismos providers, mismos
    # pesos, mismo desempate y mismo corte a `limit`. La visibilidad ya está
    # resuelta en la query, así que el ranking solo ve posts que el viewer puede
    # leer y ninguna de sus decisiones se altera.
    signals = await load_user_signals(db, user)
    ranked = await _rank_posts(db, pool, signals)
    ranked.sort(key=lambda x: (x.score, x.post["created_at"]), reverse=True)

    # Decide the mode label for observability
    top = ranked[:limit]
    top_reasons = [r for it in top for r in it.reasons]
    if any("empresa/persona seguida" in r or "vertical" in r or "hashtags afines" in r
           or "autor con el que" in r for r in top_reasons):
        mode = FeedMode.FOLLOW_BASED
    elif any(it.post.get("counts", {}).get("reactions", 0) > 3 for it in top):
        mode = FeedMode.TRENDING
    else:
        mode = FeedMode.CHRONOLOGICAL
    return top, mode
