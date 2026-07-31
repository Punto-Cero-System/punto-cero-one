"""USD/COP FX rate — free open.er-api.com endpoint (no key required)."""
from __future__ import annotations

from .base import WidgetResponse, WidgetStatus, http, get_cache, set_cache, _now_iso

TTL = 900  # 15 min


_MOCK = {"base_code": "USD", "rates": {"COP": 4000.0}, "time_last_update_unix": 0}


async def fetch_fx(db=None, base: str = "USD", targets: str = "COP") -> WidgetResponse:
    cache_key = f"{base}:{targets}"
    try:
        r = await http().get(f"https://open.er-api.com/v6/latest/{base}")
        r.raise_for_status()
        raw = r.json()
        rates = raw.get("rates", {}) or {}
        wanted = [t.strip().upper() for t in targets.split(",") if t.strip()]
        payload = {
            "base_code": raw.get("base_code", base),
            "rates": {t: rates.get(t) for t in wanted if t in rates},
            "time_last_update_unix": raw.get("time_last_update_unix"),
        }
        if not payload["rates"]:
            raise ValueError("no requested target rates present in response")
        await set_cache(db, "fx", cache_key, payload, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="open.er-api",
                              data=payload, updated_at=_now_iso())
    except Exception as e:
        cached = await get_cache(db, "fx", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="open.er-api",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="open.er-api",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
