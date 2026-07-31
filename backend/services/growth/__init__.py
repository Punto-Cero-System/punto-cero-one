"""Growth Engine — public content ingestion.

Design goals
------------
1. NEVER store full articles — only title, summary (<= 400 chars), image URL,
   source, author, published_at, country, city, vertical, category, url.
2. Modular providers → adding a new source = a new `Source` dict, no core edit.
3. Cache-friendly: aggregator dedupes by URL/id; a scheduler runs every N min.
4. Country-first ranking: 18 LatAm/Iberia targets, falling back to LATAM/GLOBAL.

Public API
----------
    from services.growth import aggregator, sources, recommender

Everything is designed to be called from FastAPI routes and background tasks.
"""
from . import sources, aggregator, recommender, scheduler  # noqa: F401
