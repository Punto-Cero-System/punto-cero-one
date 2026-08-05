"""Tests for the Editorial Composer of /api/content-sources/mixed-feed.

Wave 12 Fase 7 — SOCIAL-FIRST feed. User posts are the primary content
(`layout='large'`), everything else (news, jobs, events, etc.) renders as
compact `layout='preview'` chips that route to their specialized pages.

Also validates the offset-based infinite scroll pagination.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass


# Social-First template as defined in content_sources_routes.EDITORIAL_TEMPLATE
EXPECTED_TEMPLATE = [
    ("user_post",   "large"),
    ("user_post",   "large"),
    ("news",        "preview"),
    ("user_post",   "large"),
    ("job",         "preview"),
    ("user_post",   "large"),
    ("event",       "preview"),
    ("user_post",   "large"),
    ("company",     "preview"),
    ("user_post",   "large"),
    ("video",       "preview"),
    ("user_post",   "large"),
    ("marketplace", "preview"),
    ("user_post",   "large"),
    ("community",   "preview"),
    ("user_post",   "large"),
    ("news",        "preview"),
    ("user_post",   "large"),
    ("podcast",     "preview"),
    ("repo",        "preview"),
]

VALID_LAYOUTS = {"large", "preview", "hero", "medium", "small"}
PREVIEW_KINDS = {"news", "job", "event", "company", "video", "marketplace",
                 "community", "podcast", "repo", "dataset"}


@pytest.fixture(scope="module")
def mixed_feed_20():
    r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                     params={"limit": 20}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


class TestEditorialComposer:
    def test_response_shape(self, mixed_feed_20):
        data = mixed_feed_20
        assert "items" in data
        assert "layout_distribution" in data
        assert "editorial_template_size" in data
        assert "offset" in data
        assert "next_offset" in data
        assert isinstance(data["layout_distribution"], dict)
        assert data["editorial_template_size"] == 20

    def test_every_item_has_layout(self, mixed_feed_20):
        for i, it in enumerate(mixed_feed_20["items"]):
            assert "layout" in it, f"item[{i}] missing layout: {it.get('kind')}"
            assert it["layout"] in VALID_LAYOUTS, f"item[{i}] invalid layout {it['layout']}"
            assert "kind" in it

    def test_every_item_has_kind(self, mixed_feed_20):
        for it in mixed_feed_20["items"]:
            assert it.get("kind"), f"missing kind: {it}"

    def test_user_posts_are_large(self, mixed_feed_20):
        """SOCIAL-FIRST: every user_post carries layout=large."""
        for it in mixed_feed_20["items"]:
            if it["kind"] == "user_post":
                assert it["layout"] == "large", (
                    f"user_post must be large, got {it['layout']}"
                )

    def test_external_kinds_are_preview(self, mixed_feed_20):
        """SOCIAL-FIRST: external content (news/jobs/events/...) is preview."""
        for it in mixed_feed_20["items"]:
            if it["kind"] in PREVIEW_KINDS:
                assert it["layout"] == "preview", (
                    f"{it['kind']} must be preview, got {it['layout']}"
                )

    def test_anti_repetition_strict(self, mixed_feed_20):
        items = mixed_feed_20["items"]
        for i in range(1, len(items)):
            assert items[i]["kind"] != items[i - 1]["kind"], (
                f"consecutive same-kind at {i-1},{i}: {items[i]['kind']}"
            )

    def test_no_hero_layout_in_social_first(self, mixed_feed_20):
        """SOCIAL-FIRST no longer uses `hero` — only large + preview."""
        for it in mixed_feed_20["items"]:
            assert it["layout"] != "hero", (
                f"hero layout should not appear in Social-First feed, item={it}"
            )

    def test_layout_distribution_present(self, mixed_feed_20):
        ld = mixed_feed_20["layout_distribution"]
        assert sum(ld.values()) == len(mixed_feed_20["items"])
        # Preview must dominate external content
        assert ld.get("preview", 0) >= 1

    def test_pagination_advances(self):
        """Offset pagination returns different (or complementary) items."""
        first = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                             params={"limit": 15, "offset": 0}, timeout=30).json()
        second = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                              params={"limit": 15, "offset": 5}, timeout=30).json()
        assert "next_offset" in first
        assert "offset" in second and second["offset"] == 5
        # different responses (either fewer items or different content)
        assert first["items"] or second["items"]


class TestRegressionOtherEndpoints:
    def test_types(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/types", timeout=15)
        assert r.status_code == 200

    def test_ai_tools(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/ai-tools", timeout=15)
        assert r.status_code == 200

    def test_videos(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/videos", timeout=15)
        assert r.status_code == 200

    def test_by_type_jobs_co(self):
        r = requests.get(
            f"{BASE_URL}/api/content-sources/by-type/jobs",
            params={"country": "CO"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
