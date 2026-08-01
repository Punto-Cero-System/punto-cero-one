"""Discovery Platform — backend tests.

Validate:
  1. Public entities are seeded into `companies` at startup.
  2. Universal `/api/search` returns them (name + tag + hashtag matches).
  3. `/api/discovery/entity/{slug}` returns the ficha.
  4. `/api/discovery/entity/{slug}/related` returns aggregations.
  5. `/api/discovery/suggested` falls back to popular seeds when the
     visitor doesn't follow anything yet.
"""
from __future__ import annotations

import os
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


def test_public_entities_are_seeded():
    r = requests.get(f"{BASE_URL}/api/companies?search=Microsoft&limit=5")
    assert r.status_code == 200
    body = r.json()
    slugs = [c.get("slug") for c in body.get("items", [])]
    assert "microsoft" in slugs


def test_universal_search_finds_seeded_entity_by_name():
    r = requests.get(f"{BASE_URL}/api/search?q=OpenAI&types=companies")
    body = r.json()
    titles = [c["title"] for c in body["by_type"]["companies"]]
    assert "OpenAI" in titles


def test_universal_search_finds_by_tag():
    """A user searching for 'LegalTech' must find all seeded legal companies."""
    r = requests.get(f"{BASE_URL}/api/search?q=legaltech&types=companies&limit=15")
    body = r.json()
    slugs = {c["url"].rsplit("/", 1)[-1] for c in body["by_type"]["companies"]}
    assert {"vlex", "clio", "harvey-ai"}.issubset(slugs)


def test_discovery_entity_ficha():
    r = requests.get(f"{BASE_URL}/api/discovery/entity/pepsi")
    assert r.status_code == 200
    e = r.json()
    assert e["name"] == "PepsiCo"
    assert e.get("is_public_seed") is True
    assert e["social"]["twitter"]


def test_discovery_entity_related_bundles_public_signals():
    r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related")
    assert r.status_code == 200
    d = r.json()
    for key in ("news", "repos", "videos", "jobs", "events", "similar"):
        assert key in d
    # similar entities from the curated `related_ids`
    similar_slugs = {s["slug"] for s in d["similar"]}
    # at least one of the curated pairs is present
    assert any(s in similar_slugs for s in ("github", "aws", "openai", "google-cloud", "nvidia"))


def test_discovery_suggested_falls_back_to_popular():
    """Unauthenticated call should still surface entities."""
    r = requests.get(f"{BASE_URL}/api/discovery/suggested?limit=5")
    assert r.status_code == 200
    body = r.json()
    assert body["based_on"] == 0
    assert len(body["items"]) > 0


def test_discovery_entity_404_for_unknown_slug():
    r = requests.get(f"{BASE_URL}/api/discovery/entity/does-not-exist-XYZ")
    assert r.status_code == 404
