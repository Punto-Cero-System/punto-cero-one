"""Discovery Platform bootstrap.

Idempotently upserts the curated public entities into the existing
`companies` collection so:
  • the existing global search returns them,
  • the existing CompanyProfilePage renders them,
  • the existing follow system lets users follow them.

We mark them with `is_public_seed: True` + `origin: "directory"` so the UI can
distinguish "curated public directory entry" from a member-created company.

NOTE: they are written with `verification: "unverified"` on purpose. Being in
the directory is a statement about *provenance*, not about *identity*: nothing
here checks the organisation against any official registry. `verification:
"verified"` is reserved for that future check, and until it exists no
directory entry may claim it. The previous code wrote "verified" and the
frontend rendered a green shield, which read as a legal endorsement.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from services.discovery.seeds import SEED_ORGS


logger = logging.getLogger("punto-cero-api.discovery.seeder")


def _logo_from_website(url: str | None) -> str | None:
    """Public logo URL derived from a website.

    We used to point at ``logo.clearbit.com`` but Clearbit discontinued its
    public logo API in 2025 and its hostname no longer resolves — every
    company card ended up with a broken image which made the app feel like
    it "didn't load". Google's ``s2/favicons`` endpoint is a stable, cache-
    friendly and DNS-resolving fallback that returns a PNG for any domain.

    NOTE: the frontend still handles ``onError`` to fall back to initials
    for edge cases (e.g. Google returning a placeholder).
    """
    if not url:
        return None
    try:
        host = urlparse(url).netloc.replace("www.", "")
        if not host:
            return None
        return f"https://www.google.com/s2/favicons?domain={host}&sz=128"
    except Exception:
        return None


async def seed_public_entities(db) -> dict:
    """Upsert all seed orgs. Returns metrics."""
    now = datetime.now(timezone.utc).isoformat()
    upserted = 0
    updated = 0

    # a shared system owner id used by public seeds — allows the follow /
    # company APIs to work without collisions with a real user.
    SYSTEM_OWNER = "system-discovery"

    for e in SEED_ORGS:
        slug = e["id"]
        website = (e.get("social") or {}).get("website") or e.get("website")
        logo_url = _logo_from_website(website)

        doc = {
            "id": f"co_seed_{slug}",
            "slug": slug,
            "name": e["name"],
            "tagline": e.get("tagline"),
            "description": e.get("description"),
            "vertical": e.get("vertical") or "empresas",
            "country": e.get("country"),
            "city": e.get("city"),
            "website": website,
            "social": e.get("social") or {},
            "services": [],
            "team": [],
            "logo_url": logo_url,
            "banner_url": None,
            "cover_url": None,
            "gallery": [],
            # Directory provenance, NOT a legal validation. See module docstring.
            "origin": "directory",
            "verification": "unverified",
            "owner_id": SYSTEM_OWNER,
            "is_public_seed": True,
            "is_deleted": False,
            "hashtags": e.get("hashtags") or [],
            "tags": e.get("tags") or [],
            "related_ids": e.get("related") or [],
            "updated_at": now,
        }

        res = await db.companies.update_one(
            {"slug": slug, "is_public_seed": True},
            {
                "$setOnInsert": {"created_at": now, "id": doc["id"]},
                "$set": {k: v for k, v in doc.items() if k not in ("id",)},
            },
            upsert=True,
        )
        if res.upserted_id:
            upserted += 1
        elif res.modified_count:
            updated += 1

    logger.info("discovery seed complete upserted=%d updated=%d total=%d",
                upserted, updated, len(SEED_ORGS))
    return {"upserted": upserted, "updated": updated, "total": len(SEED_ORGS)}
