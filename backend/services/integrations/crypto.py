"""CoinGecko free-tier crypto prices — no API key required.

Uses BOTH a short-lived in-memory success snapshot AND the shared Mongo cache:
the in-memory copy is served first (5 min) so CoinGecko free-tier 429s never
flip the widget to ERROR under normal traffic. Falls back to Mongo cache, then
mock, so the widget never crashes.
"""
from __future__ import annotations

import time

from .base import WidgetResponse, WidgetStatus, http, get_cache, set_cache, _now_iso

DEFAULT_IDS = "bitcoin,ethereum"
DEFAULT_VS = "usd"
TTL = 300  # 5 min


_MOCK = {
    "bitcoin":   {"usd": 65000.0, "usd_market_cap": 1_290_000_000_000, "last_updated_at": 0},
    "ethereum":  {"usd": 3200.0,  "usd_market_cap": 385_000_000_000,   "last_updated_at": 0},
}


# In-memory snapshot: { cache_key: (fetched_at_ts, data) } — process-local, no locks needed for a small map.
_MEM_SNAPSHOT: dict[str, tuple[float, dict]] = {}
_MEM_TTL_SECONDS = 60  # serve the same live data for up to 60s per key


async def fetch_crypto(db=None, ids: str = DEFAULT_IDS, vs: str = DEFAULT_VS) -> WidgetResponse:
    cache_key = f"{ids}:{vs}"

    # Fast path: in-memory snapshot still fresh.
    snap = _MEM_SNAPSHOT.get(cache_key)
    if snap and (time.time() - snap[0]) < _MEM_TTL_SECONDS:
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="coingecko",
                              data=snap[1], updated_at=_now_iso())

    try:
        r = await http().get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": ids, "vs_currencies": vs,
                    "include_market_cap": "true", "include_last_updated_at": "true"},
        )
        r.raise_for_status()
        data = r.json()
        _MEM_SNAPSHOT[cache_key] = (time.time(), data)
        await set_cache(db, "coingecko", cache_key, data, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="coingecko",
                              data=data, updated_at=_now_iso())
    except Exception as e:
        # Priority order for fallback: in-memory (any age) → mongo cache → mock
        if snap:
            return WidgetResponse(status=WidgetStatus.ACTIVE, source="coingecko",
                                  data=snap[1], updated_at=_now_iso(),
                                  error=f"served from in-memory snapshot ({e})")
        cached = await get_cache(db, "coingecko", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="coingecko",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="coingecko",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
