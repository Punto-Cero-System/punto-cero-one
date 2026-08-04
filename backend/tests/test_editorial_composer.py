"""Tests for the Editorial Composer of /api/content-sources/mixed-feed.

Validates the deterministic template-driven composer replacing the previous
random weighted interleave.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to reading frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

# The exact template documented in the review request
EXPECTED_TEMPLATE = [
    ("news", "hero"),
    ("job", "medium"),
    ("event", "medium"),
    ("user_post", "large"),
    ("news", "medium"),
    ("company", "medium"),
    ("marketplace", "medium"),
    ("video", "medium"),
    ("job", "medium"),
    ("community", "small"),
    ("news", "medium"),
    ("user_post", "large"),
    ("event", "medium"),
    ("company", "medium"),
    ("job", "medium"),
    ("news", "medium"),
    ("marketplace", "medium"),
    ("video", "medium"),
    ("podcast", "small"),
    ("repo", "small"),
]

VALID_LAYOUTS = {"hero", "large", "medium", "small"}


@pytest.fixture(scope="module")
def mixed_feed_20():
    r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed", params={"limit": 20}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


class TestEditorialComposer:
    def test_response_shape(self, mixed_feed_20):
        data = mixed_feed_20
        assert "items" in data
        assert "layout_distribution" in data
        assert "editorial_template_size" in data
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

    def test_first_item_is_news_hero(self, mixed_feed_20):
        items = mixed_feed_20["items"]
        assert len(items) > 0
        assert items[0]["kind"] == "news", f"expected news, got {items[0]['kind']}"
        assert items[0]["layout"] == "hero"

    def test_user_posts_are_large(self, mixed_feed_20):
        for it in mixed_feed_20["items"]:
            if it["kind"] == "user_post":
                assert it["layout"] == "large", f"user_post must be large, got {it['layout']}"

    def test_small_kinds_layout(self, mixed_feed_20):
        for it in mixed_feed_20["items"]:
            if it["kind"] in ("community", "podcast", "repo"):
                assert it["layout"] == "small", (
                    f"{it['kind']} must be small, got {it['layout']}"
                )

    def test_anti_repetition_strict(self, mixed_feed_20):
        items = mixed_feed_20["items"]
        for i in range(1, len(items)):
            assert items[i]["kind"] != items[i - 1]["kind"], (
                f"consecutive same-kind at {i-1},{i}: {items[i]['kind']}"
            )

    def test_template_order_respected(self, mixed_feed_20):
        """Items must appear in the subsequence of EXPECTED_TEMPLATE (with skips allowed)."""
        items = mixed_feed_20["items"]
        t_idx = 0
        for i, it in enumerate(items):
            found = False
            while t_idx < len(EXPECTED_TEMPLATE):
                exp_kind, exp_layout = EXPECTED_TEMPLATE[t_idx]
                t_idx += 1
                if exp_kind == it["kind"]:
                    # layout must match template (hero preserved only on first news slot)
                    # For repeated news slots, layout is 'medium'; user_post always 'large' etc.
                    found = True
                    break
            assert found, (
                f"item[{i}] kind={it['kind']} does not match remaining template. "
                f"cursor_after={t_idx}"
            )

    def test_news_distribution(self, mixed_feed_20):
        dist = mixed_feed_20.get("distribution", {})
        assert dist.get("news", 0) >= 3, f"news={dist.get('news')} expected >=3"

    def test_jobs_distribution(self, mixed_feed_20):
        dist = mixed_feed_20.get("distribution", {})
        assert dist.get("job", 0) >= 2, f"job={dist.get('job')} expected >=2"

    def test_layout_distribution_present(self, mixed_feed_20):
        ld = mixed_feed_20["layout_distribution"]
        # sum should equal number of items
        assert sum(ld.values()) == len(mixed_feed_20["items"])
        # at most 1 hero
        assert ld.get("hero", 0) <= 1


class TestRegressionOtherEndpoints:
    def test_types(self):
        r = requests.get(f"{BASE_URL}/api/content-sources/types", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, (list, dict))

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
