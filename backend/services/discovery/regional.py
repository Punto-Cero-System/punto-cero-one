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


def region_score(item_country: Optional[str], user_country: Optional[str]) -> float:
    """Return the 0..100 weight of an item given the user's country."""
    wc, wl, wg = weights()
    tier = country_tier(item_country, user_country)
    return {"country": wc, "latam": wl, "global": wg}[tier]


def regional_sort(items: Iterable[dict], user_country: Optional[str],
                  country_key: str = "country") -> list[dict]:
    """Stable sort: country tier → LATAM tier → global tier. Preserves the
    original order inside each tier (so recency / relevance from upstream is
    retained).

    Items may live at different depths — an optional `country_key` lets you
    dig for e.g. `origin.country` etc. Missing/blank → treated as global.
    """
    uc = normalize_country(user_country)
    if not uc:
        return list(items)  # No preference → keep upstream order.

    def _get_country(it: dict) -> Optional[str]:
        v = it.get(country_key)
        if v is None and "meta" in it and isinstance(it["meta"], dict):
            v = it["meta"].get("country")
        return normalize_country(v)

    tier_rank = {"country": 0, "latam": 1, "global": 2}
    return sorted(
        items,
        key=lambda it: tier_rank[country_tier(_get_country(it), uc)],
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
