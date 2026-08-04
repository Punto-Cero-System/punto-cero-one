"""Wave 12 — Intelligent Mixed Feed + Content Sources System.

Covers:
  * /api/content-sources/types
  * /api/content-sources/ai-tools
  * /api/content-sources/videos
  * /api/content-sources/by-type/{jobs|events|news|videos|ai_tools}
  * /api/content-sources/mixed-feed  (weighted mix, kind-tagged items)
"""
from __future__ import annotations

import os

import pytest
import requests

if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


class TestContentSources:
    def test_types_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/types")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("types"), list) and len(data["types"]) >= 5
        assert "jobs" in data["types"]
        assert "ai_tools" in data["types"]
        assert isinstance(data.get("countries"), list)
        # Must include at least one LATAM country
        assert "CO" in data["countries"] or "MX" in data["countries"]

    def test_ai_tools_returns_curated_list(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/ai-tools")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 5, data
        # Every entry must have id/title/external_url/kind='ai_tool'
        for it in data["items"]:
            assert it["kind"] == "ai_tool"
            assert it["title"]
            assert it["external_url"]

    def test_videos_returns_curated_channels(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/videos")
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) >= 3
        for it in items:
            assert it["kind"] == "video"
            assert it["external_url"]

    @pytest.mark.parametrize("type_key", ["jobs", "events", "news"])
    def test_by_type_country_aware(self, type_key):
        r = requests.get(
            f"{BASE_URL}/api/content-sources/by-type/{type_key}",
            params={"country": "CO", "limit": 8},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["type"] == type_key
        assert isinstance(data["items"], list)
        # Country resolution should surface CO
        assert data.get("resolved_country") in ("CO", None)

    def test_mixed_feed_variety_and_anti_repetition(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed", params={"limit": 20})
        assert r.status_code == 200, r.text
        data = r.json()
        items = data["items"]
        assert len(items) > 0
        # Every item must carry a `kind`
        for it in items:
            assert "kind" in it and it["kind"], it
        # Anti-repetition: no more than 3 consecutive items with the same kind.
        # (We allow occasional pairs when a bucket is too dominant, but never
        # runs of 4+.)
        streak = 1
        max_streak = 1
        for i in range(1, len(items)):
            if items[i]["kind"] == items[i - 1]["kind"]:
                streak += 1
                max_streak = max(max_streak, streak)
            else:
                streak = 1
        assert max_streak < 4, (
            f"Feed has a run of {max_streak} identical kinds — "
            f"anti-repetition broke. Sequence: {[i['kind'] for i in items]}"
        )

    def test_mixed_feed_distribution_report(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed", params={"limit": 12})
        assert r.status_code == 200, r.text
        data = r.json()
        # The endpoint should return an observability report we can eyeball.
        assert "distribution" in data
        assert "pool_sizes" in data
        # Sum of distribution items equals len(items)
        assert sum(data["distribution"].values()) == len(data["items"])
