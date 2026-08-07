"""Regression tests for iteration 34: filter test artifacts + dedupe regional feed."""
import os
import re
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://future-core-5.preview.emergentagent.com").rstrip("/")

TEST_BODY_RE = re.compile(r"^\s*(?:case\s?\d+|mixedfeedcase\b|list-endpoint-check\b|mixed-feed image\b|📷)\s*$", re.IGNORECASE)


def _get(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
    return r.json()


def _assert_no_test_artifacts(items):
    for it in items:
        if it.get("kind") == "user_post":
            body = (it.get("body") or "").strip()
            assert not TEST_BODY_RE.match(body), f"Test artifact leaked: body={body!r}"
            author = it.get("author") or {}
            email = (author.get("email") or "").lower()
            assert not email.endswith(".test-e2e.com"), f"Test-e2e author leaked: {email}"


def test_no_test_artifacts_default():
    data = _get("/api/content-sources/mixed-feed?limit=15")
    items = data.get("items", [])
    assert len(items) > 0
    _assert_no_test_artifacts(items)


def test_no_test_artifacts_country_co():
    data = _get("/api/content-sources/mixed-feed?limit=15&country=CO")
    items = data.get("items", [])
    _assert_no_test_artifacts(items)
    assert data.get("resolved_country") == "CO"


def test_titles_deduplicated():
    data = _get("/api/content-sources/mixed-feed?limit=12")
    items = data.get("items", [])
    titles = [(it.get("title") or "").strip().lower() for it in items if (it.get("title") or "").strip()]
    assert len(set(titles)) == len(titles), f"Duplicate titles found: {[t for t in titles if titles.count(t) > 1]}"


def test_regional_priority_co():
    data = _get("/api/content-sources/mixed-feed?limit=12&country=CO")
    items = data.get("items", [])
    regional_kinds = [it for it in items if it.get("kind") in ("news", "event", "job")]
    matching = [it for it in regional_kinds if (it.get("country") or "").upper() in ("CO", "LATAM")]
    assert len(matching) >= 3, f"Expected >=3 regional items for CO, got {len(matching)}"


def test_regional_priority_mx():
    data = _get("/api/content-sources/mixed-feed?limit=12&country=MX")
    assert data.get("resolved_country") == "MX"
    items = data.get("items", [])
    regional_kinds = [it for it in items if it.get("kind") in ("news", "event", "job")]
    matching = [it for it in regional_kinds if (it.get("country") or "").upper() in ("MX", "LATAM")]
    assert len(matching) >= 3


def test_regional_priority_ar():
    data = _get("/api/content-sources/mixed-feed?limit=12&country=AR")
    assert data.get("resolved_country") == "AR"


def test_response_shape():
    data = _get("/api/content-sources/mixed-feed?limit=12")
    for key in ("items", "offset", "next_offset", "resolved_country", "resolved_country_label", "distribution", "layout_distribution", "editorial_template_size"):
        assert key in data, f"Missing key: {key}"
