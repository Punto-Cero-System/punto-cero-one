"""Feed Engine — pluggable providers + scoring for the "Para Ti" feed.

Architecture
------------
Every ranking strategy implements one function:
    async def score(db, post, signals) -> float

`signals` is a dict of already-loaded user context (followed companies,
followed categories, interests, verticals, country, recent interactions) so
providers stay cheap and never re-query Mongo per post.

Providers
---------
- follow_provider       : boosts posts by authors the user follows OR whose
                          company the user follows.
- category_provider     : boosts posts whose category_key matches the user's
                          verticals / interests.
- interaction_provider  : boosts posts by authors the user has previously
                          interacted with (react / comment / save).
- recency_provider      : universal time-decay factor so old posts fade.
- trending_provider     : global engagement uplift (reactions + comments + views).

The recommender aggregates every provider's score into a single ranking value.
No ML, no embeddings — this is the MVP the user asked for; the abstraction is
designed so a future AI ranker (embeddings, learn-to-rank) can plug in as a
new provider without touching callers.

State names for observability (exposed on the response envelope):
    CHRONOLOGICAL  — default; sort by created_at desc (fallback for anon users)
    FOLLOW_BASED   — follow_provider + category_provider drive the ranking
    TRENDING       — trending_provider is the dominant signal
    AI_RECOMMENDED — (future) full ML pipeline
"""
from .base import FeedItem, FeedProvider, FeedSignals, FeedMode
from .engine import build_for_you_feed, load_user_signals

__all__ = ["FeedItem", "FeedProvider", "FeedSignals", "FeedMode",
           "build_for_you_feed", "load_user_signals"]
