"""Pluggable ranking providers."""
from __future__ import annotations

from datetime import datetime, timezone
from math import log1p
from typing import Optional

from .base import FeedSignals


class FollowProvider:
    """+3 if the post's author is a company owner the user follows."""
    name = "follow"
    WEIGHT = 3.0

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        author_id = post.get("author_id")
        if not author_id:
            return 0.0, None
        if author_id in signals.followed_company_owner_ids or author_id in signals.followed_user_ids:
            return self.WEIGHT, "empresa/persona seguida"
        return 0.0, None


class CategoryProvider:
    """+2 if the post's category matches a vertical or interest the user cares about."""
    name = "category"
    WEIGHT = 2.0

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        cat = (post.get("category_key") or "").lower()
        if not cat:
            return 0.0, None
        if cat in signals.verticals:
            return self.WEIGHT, "en tu vertical"
        if cat in signals.interests:
            return self.WEIGHT * 0.6, "en tus intereses"
        return 0.0, None


class HashtagProvider:
    """+1 per matching hashtag (capped)."""
    name = "hashtag"
    WEIGHT = 1.0
    CAP = 3.0

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        tags = set((post.get("hashtags") or []))
        matched = tags & signals.interaction_hashtags
        if not matched:
            return 0.0, None
        return min(self.CAP, self.WEIGHT * len(matched)), f"hashtags afines: {len(matched)}"


class InteractionProvider:
    """+1.5 if the user has previously interacted with this author."""
    name = "interaction"
    WEIGHT = 1.5

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        author_id = post.get("author_id")
        if author_id and author_id in signals.interaction_author_ids:
            return self.WEIGHT, "autor con el que ya interactuaste"
        return 0.0, None


class RecencyProvider:
    """Universal time-decay: a smooth curve peaking at 0h and half-life ~48h."""
    name = "recency"

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        created = post.get("created_at")
        if not created:
            return 0.0, None
        try:
            ts = datetime.fromisoformat(created)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            return 0.0, None
        hours = max(0.0, (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0)
        # decay: 1.0 at t=0, ~0.5 at 48h, ~0.2 at 7d
        decay = 1.0 / (1.0 + hours / 48.0)
        return 3.0 * decay, None  # up to +3 for very recent


class TrendingProvider:
    """Adds log-scaled engagement — reactions + 2·comments + 0.05·views."""
    name = "trending"
    WEIGHT = 1.0

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, Optional[str]]:
        counts = post.get("counts") or {}
        engagement = (
            int(counts.get("reactions", 0))
            + 2 * int(counts.get("comments", 0))
            + 0.05 * int(counts.get("views", 0))
        )
        if engagement <= 0:
            return 0.0, None
        # log-scaled so a viral post doesn't drown out affinity signals
        return min(4.0, self.WEIGHT * log1p(engagement)), None


DEFAULT_PROVIDERS = [
    FollowProvider(),
    CategoryProvider(),
    HashtagProvider(),
    InteractionProvider(),
    RecencyProvider(),
    TrendingProvider(),
]
