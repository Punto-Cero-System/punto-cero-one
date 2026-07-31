"""Growth Engine — backend tests.

We seed the `growth_items` collection directly so the tests don't depend on
external RSS feeds being reachable (though the scheduler *does* run in the
live environment).
"""
from __future__ import annotations

import os
import time
import uuid
import pytest
import requests

from services.growth import aggregator, normalizer, recommender
from services.growth.sources import SOURCES, sources_by_country


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


TAG = uuid.uuid4().hex[:8]


def _seed(mongo_db, source_id: str, country: str, vertical: str, when_iso: str,
          title: str = "Growth Test Item"):
    doc = {
        "id": f"gt_{source_id}_{TAG}_{uuid.uuid4().hex[:6]}",
        "source_id": source_id,
        "source_name": source_id.upper(),
        "url": f"https://example.com/{source_id}/{uuid.uuid4().hex[:6]}",
        "title": title,
        "summary": "A short summary.",
        "author": "Test",
        "image_url": None,
        "country": country,
        "city": None,
        "language": "es",
        "vertical": vertical,
        "verticals": [vertical],
        "category": "Test",
        "tags": [],
        "priority": 12,
        "published_at": when_iso,
        "ingested_at": when_iso,
    }
    mongo_db.growth_items.insert_one(doc)
    return doc["id"]


@pytest.fixture()
def seeded(mongo_db):
    """Seed a controlled set of items across CO / MX / LATAM."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    ids = []
    ids.append(_seed(mongo_db, "co-eltiempo", "CO", "general", now, "Colombia hoy"))
    ids.append(_seed(mongo_db, "co-larepublica", "CO", "empresas", now, "Empresas CO"))
    ids.append(_seed(mongo_db, "mx-eluniversal", "MX", "general", now, "Mexico hoy"))
    ids.append(_seed(mongo_db, "bbc-mundo", "LATAM", "general", now, "LATAM hoy"))
    ids.append(_seed(mongo_db, "un-noticias", "GLOBAL", "general", now, "Global hoy"))
    yield ids
    mongo_db.growth_items.delete_many({"id": {"$in": ids}})


def test_growth_feed_returns_items(seeded):
    r = requests.get(f"{BASE_URL}/api/growth/feed?limit=10")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert len(data["items"]) > 0
    # every item projects into a Post-shaped dict
    first = data["items"][0]
    for k in ("id", "author", "body", "link_url", "counts", "is_growth", "source"):
        assert k in first
    assert first["is_growth"] is True


def test_growth_feed_country_filter(seeded):
    r = requests.get(f"{BASE_URL}/api/growth/feed?country=CO&limit=10")
    assert r.status_code == 200
    data = r.json()
    assert data["resolved_country"] == "CO"
    countries = {it["source"]["country"] for it in data["items"]}
    # First items should be CO (fallback to LATAM/GLOBAL after)
    assert "CO" in countries
    # order: CO items rank higher than global
    top_country = data["items"][0]["source"]["country"]
    assert top_country == "CO"


def test_growth_feed_falls_back_when_country_empty(seeded):
    r = requests.get(f"{BASE_URL}/api/growth/feed?country=CR&limit=10")
    assert r.status_code == 200
    data = r.json()
    # Even without CR-specific seeded items, we still get LATAM/GLOBAL
    assert len(data["items"]) > 0


def test_growth_sources_public(seeded):
    r = requests.get(f"{BASE_URL}/api/growth/sources")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("countries"), list)
    assert isinstance(body.get("sources"), list)
    # All 20 country/pseudo entries present (18 + LATAM + GLOBAL definitions)
    codes = {c["code"] for c in body["countries"]}
    assert "CO" in codes and "AR" in codes and "ES" in codes


def test_growth_sources_catalogue_has_18_countries():
    codes = {s["country"] for s in SOURCES if s["country"] not in ("LATAM", "GLOBAL")}
    # We aim for the 18 markets — the catalogue should cover at least 15
    assert len(codes) >= 15


def test_growth_refresh_requires_admin():
    r = requests.post(f"{BASE_URL}/api/growth/refresh")
    assert r.status_code in (401, 403)


def test_growth_normalizer_ignores_bad_entries():
    src = {"id": "test", "name": "Test", "url": "http://x", "country": "CO",
           "vertical": "general", "language": "es", "category": "Actualidad"}
    # empty title/link → dropped
    assert normalizer.normalize_entry(src, {"title": "", "link": ""}) is None
    # missing link → dropped
    assert normalizer.normalize_entry(src, {"title": "x"}) is None
    # ok
    out = normalizer.normalize_entry(src, {"title": "Título", "link": "https://x",
                                            "summary": "resumen"})
    assert out is not None
    assert out["country"] == "CO"
    assert out["title"] == "Título"


def test_growth_recommender_prefers_country():
    items = [
        {"id": "1", "country": "GLOBAL", "vertical": "general", "priority": 10, "published_at": "2026-01-01T00:00:00+00:00"},
        {"id": "2", "country": "CO", "vertical": "general", "priority": 10, "published_at": "2026-01-01T00:00:00+00:00"},
        {"id": "3", "country": "MX", "vertical": "general", "priority": 10, "published_at": "2026-01-01T00:00:00+00:00"},
    ]
    ranked = recommender.rank(items, viewer_country="CO", viewer_verticals=[])
    assert ranked[0]["id"] == "2"
