"""Global Search — one query, many collections.

GET /api/search?q=&types=people,companies,posts,jobs,events,hashtags,categories
                    &limit=8

Delegates to per-collection regex/text searches. Text indexes are created at
startup where reasonable. Ranking is intentionally simple (recent-first) —
plug an Atlas Search / Meilisearch backend later behind this same endpoint.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Cookie, Header, Query, Request

from services.discovery.regional import regional_sort, normalize_country, LATAM_PLUS_ES
# OMEGA CARRIL B4.1 — la visibilidad vive ahora en el servicio compartido.
# Hasta B4.1 estos dos se importaban de `routes.feed_routes`, lo que obligaba a
# un `service` (`feed_engine`, que cerrará B4) a depender de una RUTA. La
# dependencia queda en un solo sentido: routes → services.
#
# `_visibility_clause` es la MISMA función que usa `list_posts`: los tres
# endpoints que leen `posts` coinciden por construcción y no pueden divergir.
from services.feed_visibility import _visibility_clause, _viewer_group_ids

#: `current_user_or_none` es el resolver de sesión ya consolidado del proyecto
#: (`services.community_deps`), el mismo que usa `feed_routes`: cookie
#: `session_token`, fallback `Authorization: Bearer`, y validación de `expires_at`.
#: Se reutiliza en lugar de reimplementarlo. `_viewer_country` NO se toca: sigue
#: resolviendo el país exactamente igual, porque su precedencia (override →
#: sesión → headers) es parte del contrato de búsqueda pública.
from services.community_deps import current_user_or_none


router = APIRouter(prefix="/api/search", tags=["search"])


async def _viewer_country(db, request: Request,
                          session_token: Optional[str],
                          authorization: Optional[str],
                          override: Optional[str]) -> Optional[str]:
    if override:
        return normalize_country(override)
    token = None
    if session_token:
        token = session_token
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if token:
        s = await db.user_sessions.find_one({"session_token": token}, {"_id": 0, "user_id": 1})
        if s:
            u = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "country": 1})
            if u and u.get("country"):
                return normalize_country(u["country"])
    hdr = request.headers.get("x-region-country")
    if hdr:
        return normalize_country(hdr)
    al = request.headers.get("accept-language", "")
    if al and "-" in al:
        tail = al.split(",", 1)[0].split("-", 1)[1].split(";", 1)[0].strip().upper()
        if len(tail) == 2 and tail in LATAM_PLUS_ES:
            return tail
    return None


def _regex(q: str) -> dict:
    # escape simple regex metachars
    import re
    return {"$regex": re.escape(q), "$options": "i"}


@router.get("")
async def search(
    request: Request,
    q: str = Query(min_length=1, max_length=120),
    types: Optional[str] = Query(default=None, description="Comma-separated: people,companies,posts,jobs,events,hashtags,categories"),
    limit: int = Query(default=8, ge=1, le=25),
    country: Optional[str] = Query(default=None),
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Fan-out to every requested resource type and merge results with a
    consistent shape:
        [{ type, id, title, subtitle?, image?, meta?, url }]
    """
    db = request.app.state.db
    user_country = await _viewer_country(db, request, session_token, authorization, country)
    wanted = [t.strip() for t in (types or "people,companies,posts,jobs,events,videos,repos,news,hashtags,categories").split(",") if t.strip()]
    results: dict[str, list] = {t: [] for t in wanted}

    if "people" in results:
        cur = db.users.find(
            {"$or": [
                {"name": _regex(q)}, {"email": _regex(q)},
                {"headline": _regex(q)}, {"current_company": _regex(q)},
                {"skills": _regex(q)}, {"specialties": _regex(q)},
            ]},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "headline": 1, "picture": 1,
             "role": 1, "current_company": 1, "current_title": 1,
             "country": 1, "city": 1, "interests": 1, "specialties": 1, "skills": 1},
        ).limit(limit)
        results["people"] = [{
            "type": "people", "id": u["id"],
            "title": u.get("name") or u.get("email", ""),
            "subtitle": u.get("headline") or u.get("current_title") or "Miembro de la comunidad",
            "image": u.get("picture"),
            "url": f"/u/{u['id']}",
            "meta": {
                "headline": u.get("current_title") or u.get("headline"),
                "company": u.get("current_company"),
                "location": ", ".join([x for x in [u.get("city"), u.get("country")] if x]) or None,
                "tags": ((u.get("specialties") or []) + (u.get("interests") or []) + (u.get("skills") or []))[:6],
                "profile_type": u.get("role") or "member",
            },
        } async for u in cur]

    if "companies" in results:
        cur = db.companies.find(
            {"is_deleted": {"$ne": True}, "$or": [
                {"name": _regex(q)}, {"tagline": _regex(q)}, {"description": _regex(q)},
                {"tags": _regex(q)}, {"hashtags": _regex(q)},
            ]},
            {"_id": 0, "id": 1, "name": 1, "tagline": 1, "logo_url": 1, "slug": 1, "vertical": 1, "country": 1, "is_public_seed": 1, "verification": 1, "origin": 1},
        ).limit(limit)
        results["companies"] = [{
            "type": "companies", "id": c["id"],
            "title": c["name"], "subtitle": c.get("tagline") or c.get("vertical"),
            "image": c.get("logo_url"), "meta": c.get("country"),
            "url": f"/empresas/{c.get('slug') or c['id']}",
            # `verified` means an identity check happened — never implied by the
            # company being part of the curated directory.
            "verified": c.get("verification") == "verified",
            "origin": c.get("origin") or ("directory" if c.get("is_public_seed") else "member"),
            "is_public": bool(c.get("is_public_seed")),
        } async for c in cur]

    if "posts" in results:
        # OMEGA CARRIL B3 — la visibilidad va EN LA QUERY, no como filtro en
        # Python. Dos razones, ambas obligatorias:
        #
        #   1. Un post `members` no debe aparecer NUNCA: filtrar después lo
        #      dejaría filtrarse por otro camino y exigiría recortar el item a
        #      mano (title/subtitle/url), que es exactamente la fuga parcial que
        #      este carril cierra.
        #   2. El `.limit()` de más abajo es lo que hace peligroso filtrar
        #      tarde: los posts ocultos ocuparían plazas del `limit` y
        #      desplazarían a los públicos, convirtiendo la búsqueda en un
        #      oráculo ("si no aparece, existe pero no lo ves"). Con la
        #      visibilidad en la query, la página se llena solo con lo que el
        #      viewer puede leer y el conteo sigue siendo correcto.
        #
        # El `$or` de la búsqueda se conserva: se fusiona la cláusula en una
        # `$and` implícita por claves distintas, no se sobrescribe nada.
        viewer_user = await current_user_or_none(request)
        post_query: dict = {
            "status": "published",
            "$or": [{"body": _regex(q)}, {"hashtags": q.lower().lstrip("#")}],
        }
        vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer_user))
        if "$or" in vis_clause:
            # El `$or` de búsqueda ya está ocupado: la cláusula va como `$and`
            # para no pisarlo.
            post_query["$and"] = [vis_clause]
        else:
            post_query["visibility"] = vis_clause["visibility"]
        cur = db.posts.find(
            post_query,
            {"_id": 0, "id": 1, "body": 1, "author_id": 1, "hashtags": 1},
        ).sort("created_at", -1).limit(limit)
        results["posts"] = [{
            "type": "posts", "id": p["id"],
            "title": p["body"][:80] + ("…" if len(p["body"]) > 80 else ""),
            "subtitle": " ".join(f"#{h}" for h in (p.get("hashtags") or [])[:4]) or None,
            "url": f"/?post={p['id']}",
        } async for p in cur]

    if "jobs" in results:
        cur = db.jobs.find(
            {"is_deleted": {"$ne": True}, "is_active": True,
             "$or": [{"title": _regex(q)}, {"description": _regex(q)}, {"tags": _regex(q)}]},
            {"_id": 0, "id": 1, "title": 1, "company_id": 1, "company_name": 1,
             "company_logo": 1, "location": 1, "modality": 1, "url": 1, "external_source": 1},
        ).sort("created_at", -1).limit(limit)
        results["jobs"] = []
        async for j in cur:
            c = None
            if j.get("company_id"):
                c = await db.companies.find_one({"id": j["company_id"]}, {"_id": 0, "name": 1, "logo_url": 1})
            company_name = (c or {}).get("name") or j.get("company_name") or ""
            logo = (c or {}).get("logo_url") or j.get("company_logo")
            # External (Remotive) jobs link to the source URL; internal ones to /empleos/:id
            job_url = j["url"] if j.get("external_source") and j.get("url") else f"/empleos/{j['id']}"
            results["jobs"].append({
                "type": "jobs", "id": j["id"], "title": j["title"],
                "subtitle": f"{company_name} · {j.get('location') or j.get('modality') or ''}",
                "image": logo,
                "url": job_url,
            })

    if "events" in results:
        cur = db.events.find(
            {"is_deleted": {"$ne": True}, "is_public": True,
             "$or": [{"title": _regex(q)}, {"description": _regex(q)}, {"tags": _regex(q)}]},
            {"_id": 0, "id": 1, "title": 1, "starts_at": 1, "location": 1, "modality": 1, "cover_url": 1},
        ).sort("starts_at", 1).limit(limit)
        results["events"] = [{
            "type": "events", "id": e["id"], "title": e["title"],
            "subtitle": f"{e.get('starts_at', '')[:10]} · {e.get('location') or e.get('modality')}",
            "image": e.get("cover_url"),
            "url": f"/eventos/{e['id']}",
        } async for e in cur]

    if "hashtags" in results:
        cur = db.hashtags.find({"tag": _regex(q.lstrip("#"))}, {"_id": 0}).sort("posts_total", -1).limit(limit)
        results["hashtags"] = [{
            "type": "hashtags", "id": h["tag"],
            "title": f"#{h['tag']}",
            "subtitle": f"{h.get('posts_total', 0)} publicaciones",
            "url": f"/?hashtag={h['tag']}",
        } async for h in cur]

    if "categories" in results:
        cur = db.categories.find(
            {"active": True, "$or": [{"key": _regex(q)}, {"label": _regex(q)}]},
            {"_id": 0}
        ).sort("order", 1).limit(limit)
        results["categories"] = [{
            "type": "categories", "id": c["key"],
            "title": c["label"], "subtitle": c.get("group", "vertical"),
            "url": f"/?category={c['key']}",
        } async for c in cur]

    # Videos + News come from `growth_items` (regional RSS + YouTube RSS
    # ingestion via the Growth Engine). We split them by kind so the search
    # panel can group them cleanly for the user.
    if "videos" in results or "news" in results:
        cur = db.growth_items.find(
            {"$or": [
                {"title": _regex(q)}, {"summary": _regex(q)},
                {"source_name": _regex(q)}, {"tags": _regex(q)},
            ]},
            {"_id": 0, "id": 1, "title": 1, "summary": 1, "link": 1, "source_name": 1,
             "kind": 1, "media": 1, "published_at": 1, "image_url": 1},
        ).sort("published_at", -1).limit(limit * 2)
        vids, news = [], []
        async for g in cur:
            item = {
                "id": g["id"],
                "title": g.get("title") or "",
                "subtitle": g.get("source_name") or (g.get("published_at") or "")[:10],
                "image": g.get("image_url") or (g.get("media") or {}).get("thumbnail"),
                "url": g.get("link"),
            }
            if (g.get("kind") or "").lower() == "video" and len(vids) < limit:
                vids.append({**item, "type": "videos"})
            elif len(news) < limit:
                news.append({**item, "type": "news"})
        if "videos" in results:
            results["videos"] = vids
        if "news" in results:
            results["news"] = news

    # Public repositories (populated by Sources Center's `github_org` source)
    if "repos" in results:
        cur = db.github_repos.find(
            {"$or": [
                {"name": _regex(q)}, {"full_name": _regex(q)},
                {"description": _regex(q)}, {"topics": _regex(q)},
                {"owner_login": _regex(q)},
            ]},
            {"_id": 0, "id": 1, "full_name": 1, "name": 1, "description": 1,
             "html_url": 1, "stars": 1, "language": 1, "owner_login": 1},
        ).sort("stars", -1).limit(limit)
        results["repos"] = [{
            "type": "repos", "id": str(r.get("id") or r.get("full_name")),
            "title": r.get("full_name") or r.get("name"),
            "subtitle": (r.get("description") or "")[:110] or (r.get("language") or "repo"),
            "meta": f"★ {r.get('stars', 0)}",
            "url": r.get("html_url"),
        } async for r in cur]

    # Regional weighting — companies/news/videos/jobs/events fetched above
    # already carry a country attribute (companies.country, growth_items.country,
    # jobs.location country, events.country). Reorder them so the user sees
    # local hits first without dropping global matches.
    if user_country:
        # Companies get a synthetic `country` key from `meta` for the helper.
        for c in results.get("companies", []):
            c.setdefault("country", c.get("meta"))
        results["companies"] = regional_sort(results.get("companies", []), user_country)
        for key in ("news", "videos", "jobs", "events"):
            if key in results and results[key]:
                results[key] = regional_sort(results[key], user_country)

    total = sum(len(v) for v in results.values())
    return {
        "q": q, "total": total, "by_type": results,
        "user_country": user_country,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/suggest")
async def suggest(request: Request, q: str = Query(min_length=1, max_length=60), limit: int = Query(default=8, ge=1, le=15)):
    """Lightweight autocomplete — just people + companies + hashtags."""
    return await search(request=request, q=q, types="people,companies,hashtags", limit=limit)
