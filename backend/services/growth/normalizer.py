"""Content normalizer — RSS entry → GrowthItem dict.

Strict about what gets stored: only public metadata + a truncated summary
(<= 400 chars, HTML stripped). Full articles are NEVER cached.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Optional
from email.utils import parsedate_to_datetime

from .classifier import detect_verticals, detect_city, priority


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
SUMMARY_MAX = 400
TITLE_MAX = 240


def _strip_html(txt: str) -> str:
    if not txt:
        return ""
    return _WS_RE.sub(" ", _TAG_RE.sub("", txt)).strip()


def _to_iso(raw: str | None) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _extract_image(entry: dict) -> Optional[str]:
    # 1) media_thumbnail / media_content
    for key in ("media_thumbnail", "media_content"):
        v = entry.get(key)
        if isinstance(v, list) and v:
            u = v[0].get("url") if isinstance(v[0], dict) else None
            if u:
                return u
    # 2) enclosures
    for enc in entry.get("enclosures", []) or []:
        if isinstance(enc, dict) and enc.get("type", "").startswith("image/") and enc.get("href"):
            return enc["href"]
    # 3) links[rel="enclosure"]
    for lnk in entry.get("links", []) or []:
        if isinstance(lnk, dict) and lnk.get("type", "").startswith("image/") and lnk.get("href"):
            return lnk["href"]
    return None


def _item_id(source_id: str, entry: dict) -> str:
    key = (entry.get("id") or entry.get("guid") or entry.get("link") or entry.get("title") or "").strip()
    hh = hashlib.sha1(f"{source_id}::{key}".encode("utf-8")).hexdigest()[:20]
    return f"growth_{source_id}_{hh}"


def normalize_entry(source: dict, entry: dict) -> Optional[dict]:
    """Convert a feedparser entry into a GrowthItem-ready dict.

    Returns None if the entry lacks the minimum viable fields.
    """
    link = (entry.get("link") or "").strip()
    title_raw = _strip_html(entry.get("title") or "")
    if not link or not title_raw:
        return None

    title = title_raw[:TITLE_MAX]
    summary = _strip_html(entry.get("summary") or entry.get("description") or "")[:SUMMARY_MAX]
    author = (entry.get("author") or source["name"]).strip()[:120]
    published = _to_iso(entry.get("published") or entry.get("updated"))
    image = _extract_image(entry)

    verticals = list(dict.fromkeys([source.get("vertical") or "general"] + detect_verticals([title, summary])))
    city = detect_city(source.get("country") or "", [title, summary])

    return {
        "id": _item_id(source["id"], entry),
        "source_id": source["id"],
        "source_name": source["name"],
        "url": link,
        "title": title,
        "summary": summary,
        "author": author,
        "image_url": image,
        "country": source.get("country"),
        "city": city,
        "language": source.get("language") or "es",
        "vertical": source.get("vertical") or "general",
        "verticals": verticals,
        "category": source.get("category"),
        "tags": [],
        "priority": priority(source, verticals[1:] if verticals else []),
        "published_at": published,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
    }
