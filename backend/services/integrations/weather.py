"""OpenWeather current-weather provider.

Requires OPENWEATHER_API_KEY. Missing → CONFIG_PENDING + mock.
"""
from __future__ import annotations

from .base import WidgetResponse, WidgetStatus, http, env_key, get_cache, set_cache, _now_iso

TTL = 600  # 10 min per OpenWeather guidance


_MOCK = {
    "name": "Bogotá",
    "main": {"temp": 18, "humidity": 65},
    "weather": [{"description": "parcialmente nublado", "icon": "02d"}],
    "wind": {"speed": 3.2},
    "dt": 0,
}


async def fetch_weather(db=None, city: str = "Bogota,CO") -> WidgetResponse:
    key = env_key("OPENWEATHER_API_KEY")
    if not key:
        return WidgetResponse(status=WidgetStatus.CONFIG_PENDING, source="openweather",
                              data=_MOCK, updated_at=_now_iso())
    cache_key = city.lower()
    try:
        r = await http().get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": city, "units": "metric", "lang": "es", "appid": key},
        )
        r.raise_for_status()
        data = r.json()
        await set_cache(db, "openweather", cache_key, data, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="openweather",
                              data=data, updated_at=_now_iso())
    except Exception as e:
        cached = await get_cache(db, "openweather", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="openweather",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="openweather",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
