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

    def test_template_order_respected_with_cycling(self, mixed_feed_20):
        """Items must appear as a subsequence of EXPECTED_TEMPLATE, possibly across
        multiple cycles. On any cycle beyond the first, the layout of the emitted
        item MUST be 'medium' (never 'hero' or 'large') per FIX 4.
        """
        items = mixed_feed_20["items"]
        t_idx = 0
        cycle = 0
        for i, it in enumerate(items):
            found = False
            # Try up to a few cycles
            for _ in range(len(EXPECTED_TEMPLATE) * 3):
                if t_idx >= len(EXPECTED_TEMPLATE):
                    t_idx = 0
                    cycle += 1
                exp_kind, _exp_layout = EXPECTED_TEMPLATE[t_idx]
                t_idx += 1
                if exp_kind == it["kind"]:
                    found = True
                    if cycle >= 1:
                        assert it["layout"] == "medium", (
                            f"item[{i}] kind={it['kind']} from recycled pass "
                            f"must be medium, got {it['layout']}"
                        )
                    break
            assert found, (
                f"item[{i}] kind={it['kind']} not found in template subsequence"
            )

    def test_first_four_items_follow_template(self, mixed_feed_20):
        """FIX 5: primeros items siguen orden del template (con skips permitidos)."""
        items = mixed_feed_20["items"]
        # first item must be news+hero
        assert items[0]["kind"] == "news" and items[0]["layout"] == "hero"
        # walk template and verify subsequence for first 4 items
        expected_kinds_prefix = ["news", "job", "event", "user_post"]
        seen = [items[i]["kind"] for i in range(min(4, len(items)))]
        # each of the first 4 items must be one of the first 4 template kinds
        # AND appear in the same relative order
        t_pos = 0
        for k in seen:
            while t_pos < len(expected_kinds_prefix) and expected_kinds_prefix[t_pos] != k:
                t_pos += 1
            assert t_pos < len(expected_kinds_prefix), (
                f"first-4 kind {k} out of expected order {expected_kinds_prefix}"
            )
            t_pos += 1

    def test_community_pool_present(self, mixed_feed_20):
        """FIX 2: community pool must contribute at least 1 item (5 LATAM curated)."""
        kinds = [it["kind"] for it in mixed_feed_20["items"]]
        assert "community" in kinds, f"no community item in feed: kinds={kinds}"

    def test_recycled_slots_never_hero_or_large(self, mixed_feed_20):
        """FIX 4: hero appears exactly once, large only on user_post slots."""
        items = mixed_feed_20["items"]
        hero_count = sum(1 for it in items if it["layout"] == "hero")
        assert hero_count == 1, f"hero must be exactly 1, got {hero_count}"
        for it in items:
            if it["layout"] == "large":
                assert it["kind"] == "user_post", (
                    f"large layout must only be user_post, got {it['kind']}"
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
