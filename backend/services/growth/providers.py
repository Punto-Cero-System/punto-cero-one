"""Provider abstraction — currently RSS-only, ready for HTTP/JSON extensions.

Each provider knows how to turn a Source dict into a list of raw entries.
Normalization happens outside so that new providers only need to implement
`fetch(source) -> list[entry]`.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Iterable

import feedparser

from services.integrations.base import http


logger = logging.getLogger("punto-cero-api.growth.providers")


class RSSProvider:
    """Fetches an RSS/Atom feed via httpx + feedparser (in a thread)."""

    kind = "rss"

    async def fetch(self, source: dict, timeout: float = 8.0) -> list[dict]:
        url = source["url"]
        try:
            r = await http().get(url, timeout=timeout, follow_redirects=True)
            r.raise_for_status()
            parsed = await asyncio.to_thread(feedparser.parse, r.content)
            return list(parsed.entries or [])
        except Exception as e:
            logger.info("rss fetch failed src=%s err=%s", source["id"], e)
            return []


PROVIDERS: dict[str, RSSProvider] = {
    "rss": RSSProvider(),
}


def provider_for(source: dict) -> RSSProvider | None:
    kind = source.get("provider") or "rss"
    return PROVIDERS.get(kind)


async def fetch_all(sources: Iterable[dict], concurrency: int = 6) -> list[tuple[dict, list[dict]]]:
    """Fan out fetches with bounded concurrency. Returns [(source, entries)]."""
    sem = asyncio.Semaphore(concurrency)

    async def one(src: dict):
        prov = provider_for(src)
        if not prov:
            return src, []
        async with sem:
            entries = await prov.fetch(src)
            return src, entries

    return await asyncio.gather(*(one(s) for s in sources))
