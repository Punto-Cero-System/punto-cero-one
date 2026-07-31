"""RSS aggregator — parses public feeds via feedparser.

Supports:
  - fetch_rss(url="https://...")   → single feed
  - fetch_rss(feed_key="tecnologia") → resolves against RSS_FEEDS env var (JSON map)

RSS_FEEDS env format:
    RSS_FEEDS='{"noticias":"https://x.com/feed","tecnologia":"..."}'
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Optional

import feedparser

from .base import WidgetResponse, WidgetStatus, http, get_cache, set_cache, _now_iso

TTL = 600  # 10 min

_MOCK = {
    "feed": "Punto Cero News (mock)",
    "items": [
        {"title": "Ejemplo: nueva vertical Legal disponible", "link": "https://puntocerosystem.com/",
         "published": "", "summary": "Contenido demostración cuando no hay feed configurado."},
        {"title": "Ecosystem Live: pronto conectaremos fuentes reales", "link": "https://puntocerosystem.com/",
         "published": "", "summary": "Los feeds RSS se pueden configurar en RSS_FEEDS."},
    ],
}


def _load_feed_map() -> dict[str, str]:
    raw = os.environ.get("RSS_FEEDS", "").strip()
    if not raw:
        return {}
    try:
        m = json.loads(raw)
        return {k: v for k, v in m.items() if isinstance(v, str)}
    except Exception:
        return {}


async def fetch_rss(db=None, url: Optional[str] = None,
                    feed_key: Optional[str] = None, limit: int = 6) -> WidgetResponse:
    feed_url = url
    if not feed_url and feed_key:
        feed_url = _load_feed_map().get(feed_key)

    if not feed_url:
        # No URL and no matching key → this is a "config pending" state.
        return WidgetResponse(status=WidgetStatus.CONFIG_PENDING, source="rss",
                              data=_MOCK, updated_at=_now_iso())

    cache_key = feed_url
    try:
        r = await http().get(feed_url)
        r.raise_for_status()
        # feedparser.parse is blocking, so we push it to a thread.
        parsed = await asyncio.to_thread(feedparser.parse, r.content)
        items = []
        for e in (parsed.entries or [])[:limit]:
            items.append({
                "title": e.get("title") or "",
                "link": e.get("link") or "",
                "published": e.get("published") or e.get("updated") or "",
                "summary": (e.get("summary") or e.get("description") or "")[:400],
            })
        payload = {"feed": (parsed.feed or {}).get("title") or feed_url, "items": items}
        await set_cache(db, "rss", cache_key, payload, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="rss",
                              data=payload, updated_at=_now_iso())
    except Exception as e:
        cached = await get_cache(db, "rss", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="rss",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="rss",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
