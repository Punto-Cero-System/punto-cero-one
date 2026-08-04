"""Regional Discovery — country / LATAM / global weighting.

Central helper that turns any content list into a country-first, LATAM-second,
global-last ordering — the same 60 / 25 / 15 tier system the product wants
applied everywhere (Discovery ficha, Trending, Search, Feed).

Design goals
------------
* Zero DB overhead — pure Python sort with a stable tie-break.
* Env-configurable weights (`REGIONAL_WEIGHT_COUNTRY`,
  `REGIONAL_WEIGHT_LATAM`, `REGIONAL_WEIGHT_GLOBAL`).
* Country codes follow ISO 3166-1 alpha-2. Special values:
    - "LATAM"  → LATAM tier
    - "GLOBAL" → global tier
    - None / "" → treated as global (unknown)
"""
from __future__ import annotations

import os
from typing import Iterable, Optional


LATAM_COUNTRIES: set[str] = {
    "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO",
    "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY",
    "PE", "UY", "VE",
}
# Spain (ES) is not LATAM but shares language — treat as LATAM tier for
# es-speakers so El País / El Mundo aren't demoted to the global bucket.
LATAM_PLUS_ES: set[str] = LATAM_COUNTRIES | {"ES"}


def _weight(name: str, default: float) -> float:
    try:
        v = float(os.environ.get(name, str(default)))
        return v if v >= 0 else default
    except (TypeError, ValueError):
        return default


def weights() -> tuple[float, float, float]:
    """(country, latam, global) — sums to 100 by default (60/25/15)."""
    return (
        _weight("REGIONAL_WEIGHT_COUNTRY", 60.0),
        _weight("REGIONAL_WEIGHT_LATAM", 25.0),
        _weight("REGIONAL_WEIGHT_GLOBAL", 15.0),
    )


def normalize_country(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    c = str(code).strip().upper()
    return c or None


def country_tier(item_country: Optional[str], user_country: Optional[str]) -> str:
    """Return one of: 'country' | 'latam' | 'global'."""
    uc = normalize_country(user_country)
    ic = normalize_country(item_country)
    if uc and ic and ic == uc:
        return "country"
    if ic in LATAM_PLUS_ES:
        return "latam"
    return "global"


def _normalize_city(city: Optional[str]) -> Optional[str]:
    if not city:
        return None
    s = str(city).strip().lower()
    return s or None


def hyperlocal_tier(item_country: Optional[str], item_city: Optional[str],
                    user_country: Optional[str], user_city: Optional[str]) -> str:
    """Return one of: 'city' | 'country' | 'latam' | 'global'.

    'city' is a *stronger* tier than 'country' — used by the Hyperlocal
    Discovery Engine (Wave 9.2). It requires BOTH a matching country and a
    matching city (case-insensitive).
    """
    uc = normalize_country(user_country)
    ic = normalize_country(item_country)
    ucity = _normalize_city(user_city)
    icity = _normalize_city(item_city)
    if uc and ic and ic == uc and ucity and icity and icity == ucity:
        return "city"
    if uc and ic and ic == uc:
        return "country"
    if ic in LATAM_PLUS_ES:
        return "latam"
    return "global"


def region_score(item_country: Optional[str], user_country: Optional[str],
                 *, item_city: Optional[str] = None,
                 user_city: Optional[str] = None) -> float:
    """Return the 0..100 weight of an item given the user's country + optional
    city. City tier (hyperlocal) inherits a `country_weight * 1.5` boost so
    the same-city items always land on top without breaking the 60/25/15
    intent for country/LATAM/global.
    """
    wc, wl, wg = weights()
    tier = hyperlocal_tier(item_country, item_city, user_country, user_city)
    return {"city": wc * 1.5, "country": wc, "latam": wl, "global": wg}[tier]


def regional_sort(items: Iterable[dict], user_country: Optional[str],
                  country_key: str = "country",
                  user_city: Optional[str] = None,
                  city_key: str = "city") -> list[dict]:
    """Stable sort: city → country → LATAM → global. Preserves the original
    order inside each tier (so recency / relevance from upstream is
    retained).

    When `user_city` is supplied, items whose `city` matches (case-insensitive)
    AND whose `country` matches are floated to a dedicated top tier.
    """
    uc = normalize_country(user_country)
    if not uc:
        return list(items)  # No preference → keep upstream order.

    def _get_country(it: dict) -> Optional[str]:
        v = it.get(country_key)
        if v is None and "meta" in it and isinstance(it["meta"], dict):
            v = it["meta"].get("country")
        return normalize_country(v)

    def _get_city(it: dict) -> Optional[str]:
        v = it.get(city_key)
        if v is None and "meta" in it and isinstance(it["meta"], dict):
            v = it["meta"].get("city")
        return _normalize_city(v)

    tier_rank = {"city": 0, "country": 1, "latam": 2, "global": 3}
    return sorted(
        items,
        key=lambda it: tier_rank[hyperlocal_tier(
            _get_country(it), _get_city(it), uc, user_city,
        )],
    )


def filter_scope(items: Iterable[dict], scope: str, user_country: Optional[str],
                 country_key: str = "country") -> list[dict]:
    """Filter items by explicit scope: 'country' | 'latam' | 'global' | 'all'."""
    scope = (scope or "all").lower()
    if scope == "all":
        return list(items)
    uc = normalize_country(user_country)

    def _get_country(it: dict) -> Optional[str]:
        v = it.get(country_key)
        if v is None and "meta" in it and isinstance(it["meta"], dict):
            v = it["meta"].get("country")
        return normalize_country(v)

    out = []
    for it in items:
        tier = country_tier(_get_country(it), uc)
        if tier == scope:
            out.append(it)
        elif scope == "latam" and tier == "country":  # country ⊂ LATAM
            out.append(it)
    return out
