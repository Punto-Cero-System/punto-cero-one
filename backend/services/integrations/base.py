"""Shared plumbing for widget providers: response model + Mongo TTL cache."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

import httpx
from pydantic import BaseModel


class WidgetStatus(str, Enum):
    ACTIVE = "ACTIVE"
    MOCK = "MOCK"
    CONFIG_PENDING = "CONFIG_PENDING"
    ERROR = "ERROR"


class WidgetResponse(BaseModel):
    status: WidgetStatus
    source: str
    data: Any
    updated_at: str
    error: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_cache(db, provider: str, cache_key: str) -> Optional[dict]:
    if db is None:
        return None
    try:
        doc = await db.widget_cache.find_one(
            {"provider": provider, "cache_key": cache_key}, {"_id": 0}
        )
        return doc
    except Exception:
        return None


async def set_cache(db, provider: str, cache_key: str, payload: Any, ttl_seconds: int) -> None:
    if db is None:
        return
    try:
        now = datetime.now(timezone.utc)
        await db.widget_cache.update_one(
            {"provider": provider, "cache_key": cache_key},
            {"$set": {
                "provider": provider,
                "cache_key": cache_key,
                "payload": payload,
                "created_at": now,
                "expires_at": now + timedelta(seconds=ttl_seconds),
            }},
            upsert=True,
        )
    except Exception:
        pass


# One shared HTTP client — reused across providers. Timeouts kept short so
# a slow upstream doesn't hang the API for the entire polling window.
_http_client: Optional[httpx.AsyncClient] = None


def http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=4.0),
            headers={"User-Agent": "PuntoCeroWidgets/1.0"},
        )
    return _http_client


def env_key(name: str) -> Optional[str]:
    """Read an API key from env; treat `config_pending`, empty and whitespace as missing.
    Lets the .env file document required keys without accidentally activating them."""
    v = os.environ.get(name, "")
    v = (v or "").strip()
    if not v or v.lower() == "config_pending":
        return None
    return v
