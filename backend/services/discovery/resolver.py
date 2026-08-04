"""Related-content resolver.

Given a public entity (company) in the DB, gather:
  • news     — from growth_items, matched by tags / hashtags / name
  • repos    — from GitHub REST API (public, unauthenticated)
  • videos   — from YouTube channel RSS (public)
  • jobs     — from the existing `jobs` collection, matched by tags/company
  • events   — from the existing `events` collection, matched by tags
  • similar  — from the entity's `related_ids` list

Everything is optional. If a source doesn't apply we simply skip it.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from services.integrations.base import http
from services.discovery.regional import regional_sort


logger = logging.getLogger("punto-cero-api.discovery.resolver")


# ---------------------------------------------------------------------------
# News (Growth Engine reuse)
# ---------------------------------------------------------------------------

def _keywords_for_entity(entity: dict) -> list[str]:
    kw = set()
    if entity.get("name"):
        kw.add(entity["name"].lower())
    for t in entity.get("tags") or []:
        kw.add(str(t).lower())
    for h in entity.get("hashtags") or []:
        kw.add(str(h).lower())
    return [k for k in kw if len(k) >= 3]


async def related_news(db, entity: dict, limit: int = 8) -> list[dict]:
    """Prefer the pre-computed relation index (populated by the source-center
    auto-tagger) and fall back to keyword regex for entities not yet indexed.
    """
    slug = entity.get("slug")
    docs: list[dict] = []
    if slug:
        cursor = db.growth_items.find(
            {"related_companies": slug, "kind": {"$in": ["news", None]}},
            {"_id": 0}
        ).sort([("published_at", -1)]).limit(limit)
        docs = [d async for d in cursor]
    if docs:
        return docs

    keywords = _keywords_for_entity(entity)
    if not keywords:
        return []
    ors: list[dict] = []
    for k in keywords:
        escaped = re.escape(k)
        ors.append({"title": {"$regex": escaped, "$options": "i"}})
        ors.append({"summary": {"$regex": escaped, "$options": "i"}})
        ors.append({"tags": k})
    cursor = db.growth_items.find({"$or": ors}, {"_id": 0}).sort([("published_at", -1)]).limit(limit)
    return [d async for d in cursor]


async def related_videos_stored(db, entity: dict, limit: int = 6) -> list[dict]:
    """Videos surfaced from growth_items with kind='video' + auto-tag match.
    Complements the on-demand YouTube RSS fetch (related_videos) which needs
    a channel URL. Uses the same pre-computed relation index as news.
    """
    slug = entity.get("slug")
    if not slug:
        return []
    cursor = db.growth_items.find(
        {"related_companies": slug, "kind": "video"},
        {"_id": 0}
    ).sort([("published_at", -1)]).limit(limit)
    return [d async for d in cursor]


async def related_jobs_stored(db, entity: dict, limit: int = 5) -> list[dict]:
    """Jobs from growth_items kind='job' matched via auto-tagger."""
    slug = entity.get("slug")
    if not slug:
        return []
    cursor = db.growth_items.find(
        {"related_companies": slug, "kind": "job"},
        {"_id": 0}
    ).sort([("published_at", -1)]).limit(limit)
    return [d async for d in cursor]


async def related_repos_stored(db, entity: dict, limit: int = 6) -> list[dict]:
    """Repos previously ingested by the Sources Center (via github_org kind).
    Falls back to related_repos() on-demand call if we have none in DB.
    """
    social = entity.get("social") or {}
    gh = social.get("github") or ""
    if not gh:
        return []
    org = _github_org_from_url(gh)
    if not org:
        return []
    cursor = db.github_repos.find(
        {"org": {"$regex": f"^{re.escape(org)}$", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "description": 1,
         "url": 1, "language": 1, "stars": 1, "forks": 1, "updated_at": 1}
    ).sort([("stars", -1)]).limit(limit)
    return [d async for d in cursor]


async def related_people(db, entity: dict, limit: int = 6) -> list[dict]:
    """Members who follow the given company/organization — pure DB lookup on
    the existing `follows` collection. Zero external calls.
    """
    slug = entity.get("slug")
    if not slug:
        return []
    # slug OR id may be used as entity_id — try both
    ids = [slug]
    if entity.get("id"):
        ids.append(entity["id"])
    follower_ids: list[str] = []
    cursor = db.follows.find(
        {"entity_type": "company", "entity_id": {"$in": ids}},
        {"_id": 0, "user_id": 1}
    ).limit(limit * 3)
    async for f in cursor:
        if f.get("user_id") and f["user_id"] not in follower_ids:
            follower_ids.append(f["user_id"])
        if len(follower_ids) >= limit:
            break
    if not follower_ids:
        return []
    users = await db.users.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "id": 1, "name": 1, "picture": 1, "headline": 1, "current_company": 1}
    ).to_list(length=limit)
    return [{
        "id": u["id"], "name": u.get("name"),
        "picture": u.get("picture"), "headline": u.get("headline"),
        "current_company": u.get("current_company"),
        "url": f"/u/{u['id']}",
    } for u in users]


async def related_hashtags(db, entity: dict, limit: int = 8) -> list[dict]:
    """Hashtags inferred from the growth_items tagged to this company."""
    slug = entity.get("slug")
    if not slug:
        return []
    pipeline = [
        {"$match": {"related_companies": slug, "tags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$tags"},
        {"$match": {"tags": {"$ne": slug}}},  # exclude the company's own slug
        {"$group": {"_id": "$tags", "c": {"$sum": 1}}},
        {"$sort": {"c": -1}},
        {"$limit": limit},
    ]
    out: list[dict] = []
    async for r in db.growth_items.aggregate(pipeline):
        tag = r.get("_id")
        if not tag:
            continue
        out.append({"tag": tag, "count": r.get("c", 0),
                    "url": f"/h/{tag.lstrip('#')}"})
    # If nothing indexed yet, fall back to the entity's own hashtags
    if not out:
        for h in (entity.get("hashtags") or [])[:limit]:
            out.append({"tag": h, "count": 0, "url": f"/h/{str(h).lstrip('#')}"})
    return out


# ---------------------------------------------------------------------------
# GitHub — public REST (unauthenticated). 60 req/h/IP is enough for ficha calls.
# ---------------------------------------------------------------------------

def _github_org_from_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        p = urlparse(url)
        if "github.com" not in p.netloc:
            return None
        parts = [s for s in p.path.split("/") if s]
        if parts:
            return parts[0]
    except Exception:
        pass
    return None


async def related_repos(entity: dict, limit: int = 6) -> list[dict]:
    org = _github_org_from_url((entity.get("social") or {}).get("github"))
    if not org:
        return []
    try:
        r = await http().get(
            f"https://api.github.com/orgs/{org}/repos",
            params={"sort": "updated", "per_page": limit},
            headers={"Accept": "application/vnd.github+json",
                     "User-Agent": "punto-cero-one/1.0"},
            timeout=8.0,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.info("github repos fetch failed org=%s err=%s", org, e)
        return []
    out = []
    for it in (data if isinstance(data, list) else [])[:limit]:
        out.append({
            "id": f"gh_{it.get('id')}",
            "name": it.get("name"),
            "full_name": it.get("full_name"),
            "description": it.get("description"),
            "url": it.get("html_url"),
            "language": it.get("language"),
            "stars": it.get("stargazers_count", 0),
            "forks": it.get("forks_count", 0),
            "updated_at": it.get("updated_at"),
        })
    return out


# ---------------------------------------------------------------------------
# YouTube — public channel RSS
# ---------------------------------------------------------------------------

_YT_CHANNEL_RE = re.compile(r"/channel/(UC[\w-]+)")
_YT_HANDLE_RE = re.compile(r"youtube\.com/@([\w.-]+)")


async def related_videos(entity: dict, limit: int = 6) -> list[dict]:
    yt = (entity.get("social") or {}).get("youtube")
    if not yt:
        return []
    # Try channel-id RSS first
    m = _YT_CHANNEL_RE.search(yt)
    if not m:
        # handle-based (e.g. /@openai) — YouTube doesn't publish a
        # public URL to resolve handles → channel_id without an
        # authenticated API call, so we bail rather than scrape.
        return []
    feed = f"https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}"
    try:
        r = await http().get(feed, timeout=8.0)
        r.raise_for_status()
        import feedparser
        parsed = await asyncio.to_thread(feedparser.parse, r.content)
    except Exception as e:
        logger.info("yt rss fetch failed feed=%s err=%s", feed, e)
        return []
    out = []
    for entry in (parsed.entries or [])[:limit]:
        out.append({
            "id": entry.get("id"),
            "title": entry.get("title"),
            "url": entry.get("link"),
            "published_at": entry.get("published"),
            "thumbnail": (entry.get("media_thumbnail") or [{}])[0].get("url") if entry.get("media_thumbnail") else None,
        })
    return out


# ---------------------------------------------------------------------------
# Jobs (existing collection)
# ---------------------------------------------------------------------------

async def related_jobs(db, entity: dict, limit: int = 5) -> list[dict]:
    tags = [t.lower() for t in (entity.get("tags") or []) if t]
    name = (entity.get("name") or "").lower()
    ors: list[dict] = []
    if name:
        esc = re.escape(name)
        ors.append({"title": {"$regex": esc, "$options": "i"}})
        ors.append({"description": {"$regex": esc, "$options": "i"}})
    for t in tags:
        ors.append({"tags": t})
    if not ors:
        return []
    cursor = db.jobs.find(
        {"is_active": True, "is_deleted": {"$ne": True}, "$or": ors},
        {"_id": 0}
    ).sort([("created_at", -1)]).limit(limit)
    return [j async for j in cursor]


# ---------------------------------------------------------------------------
# Events (existing collection)
# ---------------------------------------------------------------------------

async def related_events(db, entity: dict, limit: int = 5) -> list[dict]:
    tags = [t.lower() for t in (entity.get("tags") or []) if t]
    if not tags:
        return []
    cursor = db.events.find(
        {"is_public": True, "is_deleted": {"$ne": True}, "tags": {"$in": tags}},
        {"_id": 0}
    ).sort([("starts_at", 1)]).limit(limit)
    return [e async for e in cursor]


# ---------------------------------------------------------------------------
# Similar entities (from curated related_ids + same vertical fallback)
# ---------------------------------------------------------------------------

async def similar_entities(db, entity: dict, limit: int = 8) -> list[dict]:
    related_slugs = entity.get("related_ids") or []
    result: list[dict] = []
    if related_slugs:
        cursor = db.companies.find(
            {"slug": {"$in": related_slugs}, "is_public_seed": True, "is_deleted": {"$ne": True}},
            {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
             "country": 1, "city": 1, "logo_url": 1}
        ).limit(limit)
        result = [c async for c in cursor]
    if len(result) < limit and entity.get("vertical"):
        already = {c["slug"] for c in result} | {entity.get("slug")}
        need = limit - len(result)
        cursor2 = db.companies.find(
            {"vertical": entity["vertical"], "is_public_seed": True,
             "slug": {"$nin": list(already)}, "is_deleted": {"$ne": True}},
            {"_id": 0, "id": 1, "slug": 1, "name": 1, "tagline": 1, "vertical": 1,
             "country": 1, "city": 1, "logo_url": 1}
        ).limit(need)
        result.extend([c async for c in cursor2])
    return result


# ---------------------------------------------------------------------------
# One-shot bundle
# ---------------------------------------------------------------------------

async def gather(db, entity: dict, user_country: Optional[str] = None,
                 user_city: Optional[str] = None) -> dict:
    (news, repos_stored, videos_stored, jobs_stored,
     repos_live, videos_live, jobs_local, events,
     similar, people, hashtags) = await asyncio.gather(
        related_news(db, entity),
        related_repos_stored(db, entity),
        related_videos_stored(db, entity),
        related_jobs_stored(db, entity),
        related_repos(entity),          # live GitHub fallback
        related_videos(entity),         # live YouTube fallback
        related_jobs(db, entity),
        related_events(db, entity),
        similar_entities(db, entity),
        related_people(db, entity),
        related_hashtags(db, entity),
    )
    # Prefer stored content, keep live results as backfill (deduped by url/id)
    def _merge(stored: list, live: list) -> list:
        seen = {i.get("url") or i.get("id") for i in stored}
        for it in live:
            if (it.get("url") or it.get("id")) not in seen:
                stored.append(it)
        return stored

    repos = _merge(list(repos_stored), repos_live)
    videos = _merge(list(videos_stored), videos_live)
    jobs = _merge(list(jobs_stored), list(jobs_local))

    # Hyperlocal weighting — city → country → LATAM → global. When user_city
    # is known, matching-city items land on top, then same-country, then
    # LATAM, then global. When user_city is None, behavior falls back to the
    # Wave-9 country/LATAM/global sort.
    news = regional_sort(news, user_country, user_city=user_city)
    videos = regional_sort(videos, user_country, user_city=user_city)
    jobs = regional_sort(jobs, user_country, user_city=user_city)
    events = regional_sort(events, user_country, user_city=user_city)
    similar = regional_sort(similar, user_country, user_city=user_city)
    people = regional_sort(people, user_country, user_city=user_city)

    return {
        "entity": {
            "id": entity.get("id"), "slug": entity.get("slug"),
            "name": entity.get("name"), "logo_url": entity.get("logo_url"),
            "vertical": entity.get("vertical"), "country": entity.get("country"),
        },
        "user_country": user_country or None,
        "user_city": user_city or None,
        "news": news, "repos": repos, "videos": videos,
        "jobs": jobs, "events": events, "similar": similar,
        "people": people, "hashtags": hashtags,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
