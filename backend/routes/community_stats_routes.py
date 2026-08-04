"""Public community stats + region auto-detection.

Combines two lightweight, unauthenticated endpoints so we don't create a
new module just for region:
    * GET /api/community/stats  — live member counter
    * GET /api/community/region/detect — IP → {country, region, city, timezone}

Region detection uses ipapi.co (free tier, no API key required, ~1 000
requests/day/IP). Results are cached in-memory for 6 h per client IP so a
single burst of Punto Cero traffic doesn't burn the free quota.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Header, Request

from services.discovery.regional import LATAM_PLUS_ES, normalize_country


router = APIRouter(prefix="/api/community", tags=["community"])
logger = logging.getLogger("punto-cero-api.community_stats")

# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats")
async def community_stats(request: Request):
    db = request.app.state.db
    total_members = await db.users.count_documents({
        "role": {"$ne": "admin"},
        "is_deleted": {"$ne": True},
    })
    total_companies = await db.companies.count_documents({"is_deleted": {"$ne": True}})
    total_posts = await db.posts.count_documents({
        "status": "published",
        "is_deleted": {"$ne": True},
    })
    return {
        "total_members": total_members,
        "total_companies": total_companies,
        "total_posts": total_posts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Region auto-detection
# ---------------------------------------------------------------------------

_IPAPI_ENDPOINT = os.environ.get("REGION_LOOKUP_URL", "https://ipapi.co/{ip}/json/")
_CACHE_TTL_SECONDS = 6 * 60 * 60
_DEFAULT_COUNTRY = os.environ.get("REGION_DEFAULT_COUNTRY", "CO")

# {ip: (timestamp, payload)}
_region_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = asyncio.Lock()


def _client_ip(request: Request) -> Optional[str]:
    """Extract the best-effort client IP from proxy-safe headers first."""
    for h in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        v = request.headers.get(h)
        if v:
            # X-Forwarded-For may contain a chain — first item is the client.
            ip = v.split(",")[0].strip()
            if ip and ip not in {"127.0.0.1", "::1", "unknown"}:
                return ip
    if request.client and request.client.host:
        ip = request.client.host
        if ip not in {"127.0.0.1", "::1"}:
            return ip
    return None


async def _lookup_ip(ip: str) -> dict:
    """Call ipapi.co and normalize the response. Cached 6h per IP."""
    now = time.time()
    async with _cache_lock:
        hit = _region_cache.get(ip)
        if hit and (now - hit[0]) < _CACHE_TTL_SECONDS:
            return hit[1]
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(_IPAPI_ENDPOINT.format(ip=ip),
                                  headers={"User-Agent": "PuntoCeroOne/1.0"})
            r.raise_for_status()
            data = r.json() or {}
    except Exception as e:
        logger.warning("ipapi lookup failed for %s: %s", ip, e)
        return {}
    payload = {
        "country": normalize_country(data.get("country") or data.get("country_code")),
        "country_name": data.get("country_name"),
        "region": data.get("region"),
        "city": data.get("city"),
        "timezone": data.get("timezone"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
    }
    async with _cache_lock:
        _region_cache[ip] = (now, payload)
    return payload


def _lang_country(accept_language: Optional[str]) -> Optional[str]:
    """navigator.language fallback → country ISO code."""
    if not accept_language:
        return None
    first = accept_language.split(",", 1)[0].strip()
    if "-" in first:
        tail = first.split("-", 1)[1].split(";", 1)[0].strip().upper()
        if len(tail) == 2 and tail in LATAM_PLUS_ES:
            return tail
    return None


@router.get("/region/detect")
async def region_detect(
    request: Request,
    accept_language: Optional[str] = Header(default=None),
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    persist: bool = True,
):
    """Detect the visitor's country/region/city/timezone from the request IP.

    Priority chain (matches the spec):
      1. Explicit lookup via ipapi.co (IP → country + region + city + tz)
      2. Accept-Language header fallback (`es-CO` → CO)
      3. Configurable default (`REGION_DEFAULT_COUNTRY`, defaults to CO)

    When the visitor is authenticated (community session cookie or Bearer),
    the detected country is persisted into `users.country` — unless the user
    has ALREADY set it manually, in which case we NEVER overwrite. This
    honors Wave 9's manual selection + Wave 9.1's "auto-detect on first
    visit" behavior simultaneously.
    """
    ip = _client_ip(request)
    payload: dict = {"ip": ip, "method": None, "country": None}
    if ip:
        lookup = await _lookup_ip(ip)
        if lookup.get("country"):
            payload.update(lookup)
            payload["method"] = "ip"

    if not payload.get("country"):
        lang_code = _lang_country(accept_language)
        if lang_code:
            payload["country"] = lang_code
            payload["method"] = "language"

    if not payload.get("country"):
        payload["country"] = _DEFAULT_COUNTRY
        payload["method"] = "default"

    # Persist to the user profile if authenticated + not already set manually.
    persisted = False
    if persist and payload.get("country"):
        try:
            db = request.app.state.db
            token = None
            if session_token:
                token = session_token
            elif authorization and authorization.lower().startswith("bearer "):
                token = authorization.split(" ", 1)[1].strip()
            if token:
                sess = await db.user_sessions.find_one({"session_token": token},
                                                        {"_id": 0, "user_id": 1})
                if sess:
                    existing = await db.users.find_one({"id": sess["user_id"]},
                                                        {"_id": 0, "country": 1,
                                                         "country_source": 1})
                    # Only auto-fill if the user hasn't set it manually.
                    if existing and existing.get("country_source") != "manual":
                        await db.users.update_one(
                            {"id": sess["user_id"]},
                            {"$set": {
                                "country": payload["country"],
                                "country_source": payload["method"],
                                "city": payload.get("city") or existing.get("city"),
                                "timezone": payload.get("timezone"),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }},
                        )
                        persisted = True
        except Exception as e:  # pragma: no cover — never break detection on write
            logger.debug("region_detect persist skipped: %s", e)

    payload["persisted"] = persisted
    payload["default_country"] = _DEFAULT_COUNTRY
    return payload
