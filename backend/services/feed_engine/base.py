"""Types + provider protocol for the feed engine."""
from __future__ import annotations

from enum import Enum
from typing import Optional, Protocol
from pydantic import BaseModel


class FeedMode(str, Enum):
    CHRONOLOGICAL = "CHRONOLOGICAL"
    FOLLOW_BASED = "FOLLOW_BASED"
    TRENDING = "TRENDING"
    AI_RECOMMENDED = "AI_RECOMMENDED"


class FeedSignals(BaseModel):
    """Pre-loaded user context. Assembled once per request."""
    user_id: Optional[str] = None
    followed_user_ids: set[str] = set()          # placeholder: not implemented yet
    followed_company_ids: set[str] = set()
    followed_company_owner_ids: set[str] = set() # authors get boosted via their company
    verticals: set[str] = set()                  # category keys user cares about
    interests: set[str] = set()
    country: Optional[str] = None
    # Author-affinity: authors this user reacted/commented/saved posts by.
    interaction_author_ids: set[str] = set()
    interaction_hashtags: set[str] = set()

    class Config:
        arbitrary_types_allowed = True


class FeedItem(BaseModel):
    """A ranked post + the debug score breakdown (kept small for observability)."""
    post: dict
    score: float = 0.0
    reasons: list[str] = []


class FeedProvider(Protocol):
    name: str

    async def score(self, db, post: dict, signals: FeedSignals) -> tuple[float, str | None]:
        """Return (delta, reason). `reason` is a short human tag or None."""
        ...
