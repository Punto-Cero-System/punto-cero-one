"""Wave UX — Bienvenida Dinámica: /api/community/stats + register-increments-total_members."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

pytestmark = pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not set")


def _get_stats():
    r = requests.get(f"{BASE_URL}/api/community/stats", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_community_stats_shape_no_auth():
    data = _get_stats()
    assert set(["total_members", "total_companies", "total_posts", "generated_at"]).issubset(data.keys())
    assert isinstance(data["total_members"], int) and data["total_members"] >= 1
    assert isinstance(data["total_companies"], int) and data["total_companies"] >= 1
    assert isinstance(data["total_posts"], int) and data["total_posts"] >= 0
    assert isinstance(data["generated_at"], str) and "T" in data["generated_at"]


def test_register_increments_total_members():
    before = _get_stats()["total_members"]
    ts = int(time.time() * 1000)
    email = f"welcome.qa.{ts}@puntocero.test-e2e.com"
    payload = {"email": email, "password": "Welcome2026!", "name": "Welcome QA"}
    r = requests.post(f"{BASE_URL}/api/community/auth/register", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    # tiny grace period
    time.sleep(0.6)
    after = _get_stats()["total_members"]
    assert after >= before + 1, f"expected members to increase from {before}; got {after}"


def test_regression_trending_and_related():
    r = requests.get(f"{BASE_URL}/api/discovery/trending?limit=5", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and len(body["items"]) >= 1

    r2 = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related", timeout=20)
    assert r2.status_code == 200
    b2 = r2.json()
    for k in ("news", "repos", "videos", "similar", "hashtags"):
        assert k in b2, f"missing {k} in microsoft/related"
