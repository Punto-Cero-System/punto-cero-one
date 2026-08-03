"""Sources Center — sync engine.

The engine keeps CRUD/UI logic completely decoupled from the underlying
integration code. It dispatches by `kind` to a small set of handlers, each
returning a metrics dict `{ ingested, updated, errors: [str,...] }`.

Reuses:
    services.growth.providers.RSSProvider  — for rss / jobs_feed / events_feed
    services.growth.normalizer             — for rss items
    services.discovery.resolver.related_repos  — for github_org
    services.discovery.seeder              — for entity_seed
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

from services.growth.providers import RSSProvider
from services.growth.normalizer import normalize_entry
from services.growth.aggregator import active_sources as growth_active_sources  # noqa: F401
from services.integrations.base import http
from models_source import FREQUENCY_SECONDS


logger = logging.getLogger("punto-cero-api.sources_center.engine")


# ---------------------------------------------------------------------------
# Individual handlers
# ---------------------------------------------------------------------------

_rss_provider = RSSProvider()


async def _sync_rss_like(db, source: dict, *, target_collection: str,
                         extra_defaults: dict | None = None) -> dict:
    """Generic RSS ingester used for rss / jobs_feed / events_feed / youtube.

    Items land in `growth_items` regardless of the requesting collection —
    that's the canonical store the Feed already consumes. Jobs & events
    additionally land in their native collection via a small projection.
    """
    src_shape = {
        "id": source["id"],
        "name": source["name"],
        "url": source.get("url"),
        "country": (source.get("country") or "").upper() or None,
        "vertical": source.get("vertical") or "general",
        "language": source.get("language") or "es",
        "category": source.get("category"),
    }
    if not src_shape["url"]:
        return {"ingested": 0, "updated": 0, "errors": ["missing url"]}

    entries = await _rss_provider.fetch(src_shape)
    ingested = 0
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    for e in entries[:40]:
        item = normalize_entry(src_shape, e)
        if not item:
            continue
        if extra_defaults:
            for k, v in extra_defaults.items():
                item.setdefault(k, v)
        res = await db.growth_items.update_one(
            {"id": item["id"]},
            {
                "$setOnInsert": {"id": item["id"], "ingested_at": item["ingested_at"]},
                "$set": {**{k: v for k, v in item.items() if k not in ("id", "ingested_at")},
                         "last_seen_at": now},
            },
            upsert=True,
        )
        if res.upserted_id:
            ingested += 1
        elif res.modified_count:
            updated += 1
    return {"ingested": ingested, "updated": updated, "errors": []}


async def sync_rss(db, source: dict) -> dict:
    return await _sync_rss_like(db, source, target_collection="growth_items",
                                extra_defaults={"kind": "news"})


async def sync_jobs_feed(db, source: dict) -> dict:
    return await _sync_rss_like(db, source, target_collection="growth_items",
                                extra_defaults={"vertical": "empleos", "kind": "job"})


async def sync_events_feed(db, source: dict) -> dict:
    return await _sync_rss_like(db, source, target_collection="growth_items",
                                extra_defaults={"vertical": "eventos", "kind": "event"})


async def sync_youtube_channel(db, source: dict) -> dict:
    channel_id = (source.get("config") or {}).get("channel_id")
    url = source.get("url") or ""
    if not channel_id:
        m = re.search(r"/channel/(UC[\w-]+)", url)
        if m:
            channel_id = m.group(1)
    if not channel_id:
        return {"ingested": 0, "updated": 0, "errors": ["missing channel_id (config.channel_id or /channel/UC... url)"]}
    feed = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    return await _sync_rss_like(db, {**source, "url": feed}, target_collection="growth_items",
                                extra_defaults={"kind": "video", "vertical": source.get("vertical") or "videos"})


async def sync_github_org(db, source: dict) -> dict:
    org = (source.get("config") or {}).get("org")
    if not org and source.get("url"):
        try:
            org = [s for s in urlparse(source["url"]).path.split("/") if s][0]
        except Exception:
            org = None
    if not org:
        return {"ingested": 0, "updated": 0, "errors": ["missing github org"]}
    try:
        r = await http().get(
            f"https://api.github.com/orgs/{org}/repos",
            params={"sort": "updated", "per_page": 15},
            headers={"Accept": "application/vnd.github+json",
                     "User-Agent": "punto-cero-one/1.0"},
            timeout=8.0,
        )
        r.raise_for_status()
        repos = r.json()
    except Exception as e:
        return {"ingested": 0, "updated": 0, "errors": [f"github: {e}"]}
    if not isinstance(repos, list):
        return {"ingested": 0, "updated": 0, "errors": ["github returned non-list"]}
    now = datetime.now(timezone.utc).isoformat()
    ingested = updated = 0
    for it in repos:
        doc_id = f"gh_{it.get('id')}"
        payload = {
            "id": doc_id,
            "org": org,
            "name": it.get("name"),
            "full_name": it.get("full_name"),
            "description": it.get("description"),
            "url": it.get("html_url"),
            "language": it.get("language"),
            "stars": it.get("stargazers_count", 0),
            "forks": it.get("forks_count", 0),
            "updated_at": it.get("updated_at"),
            "source_id": source["id"],
            "last_seen_at": now,
        }
        res = await db.github_repos.update_one(
            {"id": doc_id},
            {"$setOnInsert": {"first_seen_at": now}, "$set": payload},
            upsert=True,
        )
        if res.upserted_id:
            ingested += 1
        elif res.modified_count:
            updated += 1
    return {"ingested": ingested, "updated": updated, "errors": []}


async def sync_entity_seed(db, source: dict) -> dict:
    """Upsert a curated company/organization into `companies`.

    Config shape mirrors the discovery seed schema. Any missing field
    falls back gracefully.
    """
    cfg = source.get("config") or {}
    slug = cfg.get("slug")
    if not slug:
        return {"ingested": 0, "updated": 0, "errors": ["missing config.slug"]}
    from services.discovery.seeder import _logo_from_website
    website = (cfg.get("social") or {}).get("website") or cfg.get("website") or source.get("url")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"co_seed_{slug}",
        "slug": slug,
        "name": cfg.get("name") or source["name"],
        "tagline": cfg.get("tagline"),
        "description": cfg.get("description") or source.get("description"),
        "vertical": cfg.get("vertical") or source.get("vertical") or "empresas",
        "country": cfg.get("country") or source.get("country"),
        "city": cfg.get("city"),
        "website": website,
        "social": cfg.get("social") or {},
        "services": [], "team": [], "gallery": [],
        "logo_url": cfg.get("logo_url") or _logo_from_website(website),
        "banner_url": None, "cover_url": None,
        "verification": "verified",
        "owner_id": "system-discovery",
        "is_public_seed": True,
        "is_deleted": False,
        "hashtags": cfg.get("hashtags") or [],
        "tags": cfg.get("tags") or [],
        "related_ids": cfg.get("related") or [],
        "source_id": source["id"],
        "updated_at": now,
    }
    res = await db.companies.update_one(
        {"slug": slug, "is_public_seed": True},
        {"$setOnInsert": {"created_at": now, "id": doc["id"]},
         "$set": {k: v for k, v in doc.items() if k != "id"}},
        upsert=True,
    )
    return {"ingested": 1 if res.upserted_id else 0,
            "updated": 1 if res.modified_count and not res.upserted_id else 0,
            "errors": []}


async def sync_api(db, source: dict) -> dict:
    """Generic JSON API poll — stores raw items in `growth_items` when
    the response is a list of objects with a `link` or `url` field."""
    url = source.get("url")
    cfg = source.get("config") or {}
    method = (cfg.get("method") or "GET").upper()
    headers = cfg.get("headers") or {}
    if source.get("api_key") and "Authorization" not in headers:
        headers["Authorization"] = f"Bearer {source['api_key']}"
    if not url:
        return {"ingested": 0, "updated": 0, "errors": ["missing url"]}
    try:
        r = await http().request(method, url, headers=headers,
                                 params=cfg.get("params") or None,
                                 timeout=8.0)
        r.raise_for_status()
        payload = r.json()
    except Exception as e:
        return {"ingested": 0, "updated": 0, "errors": [f"api: {e}"]}
    # Normalize: expect a list at root or at cfg.items_path
    items = payload
    for step in (cfg.get("items_path") or "").split("."):
        if step and isinstance(items, dict):
            items = items.get(step, [])
    if not isinstance(items, list):
        return {"ingested": 0, "updated": 0, "errors": ["response is not a list"]}

    now = datetime.now(timezone.utc).isoformat()
    ingested = updated = 0
    country = (source.get("country") or "").upper() or None
    for raw in items[:40]:
        link = raw.get("url") or raw.get("link") or raw.get("html_url")
        title = raw.get("title") or raw.get("name")
        if not link or not title:
            continue
        norm = normalize_entry(
            {"id": source["id"], "name": source["name"], "url": url,
             "country": country, "vertical": source.get("vertical") or "general",
             "language": source.get("language") or "es",
             "category": source.get("category")},
            {"title": title, "link": link,
             "summary": raw.get("description") or raw.get("summary") or "",
             "published": raw.get("published_at") or raw.get("created_at") or ""}
        )
        if not norm:
            continue
        res = await db.growth_items.update_one(
            {"id": norm["id"]},
            {"$setOnInsert": {"id": norm["id"], "ingested_at": norm["ingested_at"]},
             "$set": {**{k: v for k, v in norm.items() if k not in ("id", "ingested_at")},
                      "last_seen_at": now}},
            upsert=True,
        )
        if res.upserted_id:
            ingested += 1
        elif res.modified_count:
            updated += 1
    return {"ingested": ingested, "updated": updated, "errors": []}


HANDLERS = {
    "rss": sync_rss,
    "github_org": sync_github_org,
    "youtube_channel": sync_youtube_channel,
    "entity_seed": sync_entity_seed,
    "jobs_feed": sync_jobs_feed,
    "events_feed": sync_events_feed,
    "api": sync_api,
    "remotive_jobs": None,  # patched below to avoid forward-ref
}


# ---------------------------------------------------------------------------
# Remotive — free public jobs feed (no key). https://remotive.com/api/remote-jobs
# ---------------------------------------------------------------------------

async def sync_remotive_jobs(db, source: dict) -> dict:
    """Ingest remote-jobs from Remotive.com's free public API.
    Items land in BOTH `growth_items` (kind=job) and the `jobs` collection
    so the existing `/api/community/jobs` endpoint surfaces them directly.
    """
    try:
        cfg = source.get("config") or {}
        params = {}
        if cfg.get("category"):
            params["category"] = cfg["category"]
        if cfg.get("company"):
            params["company_name"] = cfg["company"]
        if cfg.get("search"):
            params["search"] = cfg["search"]
        r = await http().get("https://remotive.com/api/remote-jobs", params=params, timeout=15.0)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        return {"ingested": 0, "updated": 0, "errors": [f"remotive: {e}"]}
    jobs = data.get("jobs") or []
    now = datetime.now(timezone.utc).isoformat()
    ingested = updated = 0
    for j in jobs[:40]:
        doc_id = f"rmv_{j.get('id')}"
        item = {
            "id": doc_id,
            "source_id": source["id"],
            "source_name": "Remotive",
            "url": j.get("url"),
            "title": j.get("title"),
            "summary": (j.get("description") or "").replace("<", "&lt;")[:400],
            "author": j.get("company_name"),
            "image_url": j.get("company_logo"),
            "language": "en",
            "country": None,
            "city": None,
            "vertical": "empleos",
            "category": j.get("category"),
            "tags": [t.lower() for t in (j.get("tags") or [])[:10]],
            "kind": "job",
            "published_at": j.get("publication_date"),
            "ingested_at": now,
            "priority": 3,
            "meta": {
                "company_name": j.get("company_name"),
                "job_type": j.get("job_type"),
                "salary": j.get("salary"),
                "candidate_required_location": j.get("candidate_required_location"),
            },
        }
        res = await db.growth_items.update_one(
            {"id": doc_id},
            {"$setOnInsert": {"first_seen_at": now}, "$set": item},
            upsert=True,
        )
        if res.upserted_id:
            ingested += 1
        elif res.modified_count:
            updated += 1
        # Also mirror into `jobs` collection (surfaced by /api/community/jobs)
        job_id = doc_id
        await db.jobs.update_one(
            {"id": job_id},
            {"$setOnInsert": {"id": job_id, "created_at": now, "is_deleted": False},
             "$set": {
                 "title": j.get("title") or "",
                 "company_name": j.get("company_name"),
                 "company_logo": j.get("company_logo"),
                 "description": item["summary"],
                 "url": j.get("url"),
                 "location": j.get("candidate_required_location"),
                 "remote": True,
                 "job_type": j.get("job_type"),
                 "salary": j.get("salary"),
                 "tags": item["tags"],
                 "external_source": "remotive",
                 "external_id": str(j.get("id")),
                 "is_active": True,
                 "updated_at": now,
             }},
            upsert=True,
        )
    return {"ingested": ingested, "updated": updated, "errors": []}


HANDLERS["remotive_jobs"] = sync_remotive_jobs


# ---------------------------------------------------------------------------
# Auto-tagging — after any RSS/YouTube/Jobs ingest we relate items to public
# companies whose name/tag/hashtag appears in the item's title+summary. Result
# stored on `growth_items.related_companies` (list of slugs). This is what
# powers Discovery ficha "news / videos / jobs" for a given company.
# ---------------------------------------------------------------------------

async def _autotag_growth_items(db, source: dict, since_iso: str) -> int:
    """Scan growth_items missing `related_companies` and tag them with matching
    company slugs. Idempotent: only touches items without the field yet, so it
    scales linearly with fresh ingests.
    """
    # Build the alias → slug map from seeded + member companies (single query).
    companies = await db.companies.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "slug": 1, "name": 1, "tags": 1, "hashtags": 1}
    ).to_list(length=500)
    if not companies:
        return 0

    aliases: dict[str, str] = {}  # lowercased alias → slug
    for c in companies:
        slug = c.get("slug")
        if not slug:
            continue
        if c.get("name"):
            aliases[c["name"].lower()] = slug
        for t in (c.get("tags") or []) + (c.get("hashtags") or []):
            k = str(t).lower().strip()
            if len(k) >= 3:
                aliases.setdefault(k, slug)

    tagged = 0
    # Idempotent: only touch items still missing the field.
    query = {"$or": [
        {"related_companies": {"$exists": False}},
        {"related_companies": []},
    ]}
    async for g in db.growth_items.find(query, {"_id": 0, "id": 1, "title": 1, "summary": 1, "tags": 1}).limit(2000):
        haystack = f" {(g.get('title') or '').lower()} {(g.get('summary') or '').lower()} "
        matches: list[str] = []
        for alias, slug in aliases.items():
            needle = f" {alias} " if len(alias) <= 4 else alias
            if needle in haystack:
                if slug not in matches:
                    matches.append(slug)
            if len(matches) >= 5:
                break
        if matches:
            existing_tags = set(g.get("tags") or [])
            existing_tags.update(matches)
            await db.growth_items.update_one(
                {"id": g["id"]},
                {"$set": {
                    "related_companies": matches,
                    "tags": sorted(existing_tags),
                }},
            )
            tagged += 1
    return tagged


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_sync(db, source: dict) -> dict:
    """Execute a sync for a single source and record everything in `source_syncs`."""
    from models_source import new_sync_id, now_iso
    kind = source.get("kind")
    handler = HANDLERS.get(kind)
    started_at = now_iso()
    if not handler:
        result = {"ingested": 0, "updated": 0, "errors": [f"unknown kind: {kind}"]}
    else:
        try:
            result = await handler(db, source)
        except Exception as e:
            logger.exception("sync failed src=%s kind=%s", source.get("id"), kind)
            result = {"ingested": 0, "updated": 0, "errors": [str(e)]}
    finished_at = now_iso()

    # After a successful ingest into growth_items, run the auto-tagger over
    # the newly-added items only. This is what wires news/videos/jobs to the
    # company ficha (Discovery) without any manual mapping.
    if not result.get("errors") and result.get("ingested", 0) and kind in (
        "rss", "jobs_feed", "events_feed", "youtube_channel", "remotive_jobs"
    ):
        try:
            tagged = await _autotag_growth_items(db, source, started_at)
            result["auto_tagged"] = tagged
        except Exception as e:
            logger.warning("autotag failed src=%s: %s", source.get("id"), e)

    errors: list[str] = result.get("errors") or []
    ok = not errors

    log = {
        "id": new_sync_id(),
        "source_id": source["id"],
        "kind": kind,
        "started_at": started_at,
        "finished_at": finished_at,
        "ingested": result.get("ingested", 0),
        "updated": result.get("updated", 0),
        "errors": errors,
        "ok": ok,
    }
    await db.source_syncs.insert_one({**log})

    inc = (result.get("ingested") or 0)
    next_sync_at = None
    freq = source.get("frequency") or "1h"
    if freq != "manual":
        secs = FREQUENCY_SECONDS.get(freq, 60 * 60)
        next_sync_at = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat()

    await db.sources.update_one(
        {"id": source["id"]},
        {"$set": {
            "last_sync_at": finished_at,
            "last_sync_status": "ok" if ok else "error",
            "last_sync_error": None if ok else (errors[0] if errors else "unknown"),
            "next_sync_at": next_sync_at,
            "updated_at": finished_at,
        }, "$inc": {"imported_count": inc}},
    )
    if not ok:
        # Best-effort notification to admins.
        try:
            from datetime import datetime as _dt
            await db.notifications.insert_one({
                "id": f"note_src_{log['id']}",
                "kind": "source_sync_failed",
                "title": f"Sincronización fallida — {source.get('name')}",
                "body": errors[0] if errors else "Error desconocido",
                "role": "admin",
                "created_at": _dt.now(timezone.utc).isoformat(),
                "read": False,
                "source_id": source["id"],
            })
        except Exception:
            pass

    return log


async def due_sources(db) -> list[dict]:
    """Return sources whose `next_sync_at` is in the past (or never set)."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.sources.find({
        "status": "active",
        "frequency": {"$ne": "manual"},
        "$or": [{"next_sync_at": None}, {"next_sync_at": {"$lte": now}}],
    }, {"_id": 0})
    return [d async for d in cursor]
