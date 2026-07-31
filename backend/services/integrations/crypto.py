"""CoinGecko free-tier crypto prices — no API key required."""
from __future__ import annotations

from .base import WidgetResponse, WidgetStatus, http, get_cache, set_cache, _now_iso

DEFAULT_IDS = "bitcoin,ethereum"
DEFAULT_VS = "usd"
TTL = 300  # 5 min


_MOCK = {
    "bitcoin":   {"usd": 65000.0, "usd_market_cap": 1_290_000_000_000, "last_updated_at": 0},
    "ethereum":  {"usd": 3200.0,  "usd_market_cap": 385_000_000_000,   "last_updated_at": 0},
}


async def fetch_crypto(db=None, ids: str = DEFAULT_IDS, vs: str = DEFAULT_VS) -> WidgetResponse:
    cache_key = f"{ids}:{vs}"
    try:
        r = await http().get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": ids, "vs_currencies": vs,
                    "include_market_cap": "true", "include_last_updated_at": "true"},
        )
        r.raise_for_status()
        data = r.json()
        await set_cache(db, "coingecko", cache_key, data, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="coingecko",
                              data=data, updated_at=_now_iso())
    except Exception as e:
        cached = await get_cache(db, "coingecko", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="coingecko",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="coingecko",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
