"""External integrations subsystem for Punto Cero widgets.

Every provider implements the same async contract:
    async def fetch(**kwargs) -> WidgetResponse

Design goals
------------
1. **Portable**: pure httpx + Motor cache. No Emergent-specific hooks.
2. **Fallback-safe**: If a provider fails or its key is missing, the caller
   receives a valid WidgetResponse with `status` reflecting the reason and
   `data` set to the provider's mock payload. Nothing raises.
3. **Multi-tenant ready**: cache_key can be namespaced per tenant when the
   platform grows into other verticals.
4. **Env driven**: every key/URL/TTL is read via `os.environ.get()`.

Status values (surfaced verbatim in the API response):
    ACTIVE          — Live upstream call succeeded.
    MOCK            — Upstream failed OR cached upstream failed too → mock returned.
    CONFIG_PENDING  — No API key configured → provider returns mock and asks caller
                      to plug the key. Non-error condition.
    ERROR           — Upstream failed; a stale cache was returned instead.
"""
from .base import WidgetResponse, WidgetStatus, get_cache, set_cache
from .weather import fetch_weather
from .crypto import fetch_crypto
from .fx import fetch_fx
from .rss import fetch_rss
from .youtube import fetch_youtube

__all__ = [
    "WidgetResponse", "WidgetStatus",
    "get_cache", "set_cache",
    "fetch_weather", "fetch_crypto", "fetch_fx", "fetch_rss", "fetch_youtube",
]
