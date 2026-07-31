"""Recommender — ranks growth items for a viewer.

Given a viewer profile (or None), produce the ordered list of growth items
following the priority defined in the product brief:

    1. País del usuario
    2. Verticales activas
    3. LATAM
    4. Global

Scoring is deterministic and cheap:
    +40  country match (viewer country == item country)
    +25  vertical match (viewer vertical in item.verticals)
    +15  LATAM item and viewer has no country
    +8   item is < 24h old
    +4   priority bonus from the classifier
    +2   language match
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Iterable, Optional


def _recent_boost(published_at: str) -> int:
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except Exception:
        return 0
    delta = datetime.now(timezone.utc) - dt
    if delta < timedelta(hours=24):
        return 8
    if delta < timedelta(days=3):
        return 4
    return 0


def score_item(item: dict, viewer_country: Optional[str], viewer_verticals: Iterable[str],
               viewer_language: Optional[str] = None) -> tuple[int, list[str]]:
    reasons: list[str] = []
    score = item.get("priority", 0)
    vc = (viewer_country or "").upper() or None
    if vc and item.get("country") == vc:
        score += 40
        reasons.append(f"país {vc}")
    if vc is None and item.get("country") == "LATAM":
        score += 15
        reasons.append("LATAM")
    vv = set([v.lower() for v in (viewer_verticals or []) if v])
    if vv:
        item_v = set([item.get("vertical", "")] + list(item.get("verticals") or []))
        if item_v & vv:
            score += 25
            reasons.append("vertical afín")
    score += _recent_boost(item.get("published_at") or "")
    if viewer_language and item.get("language") == viewer_language:
        score += 2
    return score, reasons


def rank(items: list[dict], viewer_country: Optional[str], viewer_verticals: Iterable[str],
         viewer_language: Optional[str] = None) -> list[dict]:
    verticals = list(viewer_verticals or [])
    scored = [(score_item(it, viewer_country, verticals, viewer_language), it) for it in items]
    scored.sort(key=lambda x: (x[0][0], x[1].get("published_at") or ""), reverse=True)
    out: list[dict] = []
    for (sc, reasons), it in scored:
        item = dict(it)
        item["score"] = sc
        item["reasons"] = reasons
        out.append(item)
    return out
