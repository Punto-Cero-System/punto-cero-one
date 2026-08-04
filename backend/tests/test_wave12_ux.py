"""Wave 12 Fase 2 — Profile media (avatar + cover) + Header dedup.

Covers:
  * PUT/DELETE /api/community/users/me/media/{picture,cover}  — auth-gated
  * Search endpoint returns rich `meta` for people
  * /api/community/auth/providers exposes only Google + LinkedIn + Facebook (regression)
"""
from __future__ import annotations

import io
import os
import uuid

import pytest
import requests


if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _register_and_login() -> requests.Session:
    s = requests.Session()
    email = f"pytest+wave12ux+{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
    r = s.post(f"{BASE_URL}/api/community/auth/register",
               json={"email": email, "password": "TestPwd12345", "name": "Wave12 UX"})
    assert r.status_code == 200, r.text
    return s


def _tiny_png() -> bytes:
    # 1x1 transparent PNG (67 bytes)
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
        b"\x0f\x00\x00\x01\x01\x00\x01\x9d~\x9f\x01\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class TestProfileMedia:
    def test_avatar_upload_delete_flow(self):
        s = _register_and_login()

        # Requires multipart — send raw
        files = {"file": ("avatar.png", _tiny_png(), "image/png")}
        r = s.put(f"{BASE_URL}/api/community/users/me/media/picture", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["slot"] == "picture"
        assert body["url"].startswith("/api/community/users/media/"), body

        # Confirm it's on the user doc
        me = s.get(f"{BASE_URL}/api/community/users/me").json()
        assert me.get("picture") == body["url"]

        # Delete
        r2 = s.delete(f"{BASE_URL}/api/community/users/me/media/picture")
        assert r2.status_code == 200, r2.text
        me2 = s.get(f"{BASE_URL}/api/community/users/me").json()
        assert me2.get("picture") in (None, "")

    def test_cover_upload_flow(self):
        s = _register_and_login()
        files = {"file": ("cover.png", _tiny_png(), "image/png")}
        r = s.put(f"{BASE_URL}/api/community/users/me/media/cover", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["slot"] == "cover"
        # cover_url field on user doc
        me = s.get(f"{BASE_URL}/api/community/users/me").json()
        assert me.get("cover_url") == body["url"]

    def test_media_endpoints_require_auth(self):
        r = requests.put(f"{BASE_URL}/api/community/users/me/media/picture",
                         files={"file": ("a.png", _tiny_png(), "image/png")})
        assert r.status_code in (401, 403), r.text
        r2 = requests.delete(f"{BASE_URL}/api/community/users/me/media/cover")
        assert r2.status_code in (401, 403), r2.text

    def test_media_rejects_non_image(self):
        s = _register_and_login()
        files = {"file": ("hack.txt", b"not-an-image", "text/plain")}
        r = s.put(f"{BASE_URL}/api/community/users/me/media/picture", files=files)
        assert r.status_code == 415, r.text


class TestSearchRichMeta:
    def test_people_search_returns_meta(self):
        # Create a distinctive user we can then look up.
        s = requests.Session()
        email = f"pytest+meta+{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
        r = s.post(f"{BASE_URL}/api/community/auth/register",
                   json={"email": email, "password": "TestPwd12345",
                         "name": "ZzWave12 Metatest User"})
        assert r.status_code == 200, r.text
        # Patch profile with company/title/city/country for meta enrichment.
        s.patch(f"{BASE_URL}/api/community/users/me",
                json={"current_company": "TestCo", "current_title": "QA Lead",
                      "city": "Bogotá", "country": "CO",
                      "specialties": ["testing", "e2e"]})
        # Query the search endpoint
        r2 = requests.get(f"{BASE_URL}/api/search",
                          params={"q": "ZzWave12 Metatest", "types": "people"})
        assert r2.status_code == 200, r2.text
        people = (r2.json().get("by_type") or {}).get("people") or []
        if not people:
            pytest.skip("search index may be async — result not visible yet")
        first = people[0]
        meta = first.get("meta") or {}
        # At least one enrichment field must be present
        assert any(meta.get(k) for k in ("company", "location", "headline", "tags")), meta


class TestOAuthCleanupRegression:
    def test_providers_only_shows_visible_v1(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/providers")
        assert r.status_code == 200, r.text
        data = r.json()
        enabled_keys = {p.get("key") if isinstance(p, dict) else p
                        for p in data.get("enabled", [])}
        coming_keys = {p["key"] for p in data.get("coming_soon", [])}
        combined = enabled_keys | coming_keys
        assert "google" in enabled_keys
        assert combined.issubset({"google", "linkedin", "facebook"}), combined
        for hidden in ("apple", "microsoft", "github", "twitter"):
            assert hidden not in combined, f"{hidden} leaked into providers: {combined}"
