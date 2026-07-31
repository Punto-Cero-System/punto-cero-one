"""Wave 3C backend tests — Company Media (logo, banner, cover, gallery).

End-to-end:
  1. Owner uploads a logo → company.logo_url points at /api/companies/media/...
  2. Public GET on that URL returns the same bytes with the right content-type.
  3. Non-owner (a different community user) cannot upload media.
  4. Owner can replace, delete, and populate gallery. Deleting by index shifts remainder.
  5. Public endpoint refuses paths outside the company namespace.
"""
from __future__ import annotations

import io
import os
import time
import uuid
import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


# 1x1 PNG (transparent) — small deterministic byte payload for uploads.
PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c62000100000005000106e6f4b1000000004945"
    "4e44ae426082"
)


def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_test_w3c_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_w3c_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    mongo_db.users.insert_one({
        "id": uid, "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag} W3C", "role": "member",
        "created_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token, "provider": "google",
        "expires_at": "2099-01-01T00:00:00+00:00", "created_at": now,
    })
    return {"id": uid, "cookie": {"session_token": token}}


@pytest.fixture(scope="module")
def users(mongo_db):
    owner = _mk_user(mongo_db, "owner")
    other = _mk_user(mongo_db, "other")
    yield {"owner": owner, "other": other}
    for u in (owner, other):
        mongo_db.users.delete_many({"id": u["id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["id"]})


@pytest.fixture(scope="module")
def company(users, mongo_db):
    r = requests.post(f"{BASE_URL}/api/companies",
                      json={"name": f"TEST W3C Media Co {uuid.uuid4().hex[:6]}",
                            "tagline": "media test", "description": "d",
                            "vertical": "empresas", "country": "co"},
                      cookies=users["owner"]["cookie"])
    assert r.status_code == 200, r.text
    doc = r.json()
    yield doc
    mongo_db.companies.delete_one({"id": doc["id"]})


class TestCompanyMediaSlots:
    def test_owner_uploads_logo_and_url_is_public(self, users, company):
        files = {"file": ("logo.png", io.BytesIO(PNG_1x1), "image/png")}
        r = requests.put(f"{BASE_URL}/api/companies/{company['id']}/media/logo",
                         files=files, cookies=users["owner"]["cookie"])
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/companies/media/")
        # public fetch
        r2 = requests.get(f"{BASE_URL}{url}")
        assert r2.status_code == 200
        assert r2.content == PNG_1x1
        assert r2.headers.get("Content-Type", "").startswith("image/")
        # Ensure company doc reflects it
        r3 = requests.get(f"{BASE_URL}/api/companies/{company['id']}").json()
        assert r3["logo_url"] == url

    def test_non_owner_cannot_upload(self, users, company):
        files = {"file": ("logo.png", io.BytesIO(PNG_1x1), "image/png")}
        r = requests.put(f"{BASE_URL}/api/companies/{company['id']}/media/logo",
                         files=files, cookies=users["other"]["cookie"])
        assert r.status_code == 403

    def test_disallowed_content_type_is_rejected(self, users, company):
        files = {"file": ("hack.exe", io.BytesIO(b"MZ..."), "application/x-msdownload")}
        r = requests.put(f"{BASE_URL}/api/companies/{company['id']}/media/logo",
                         files=files, cookies=users["owner"]["cookie"])
        assert r.status_code == 415

    def test_owner_can_clear_slot(self, users, company):
        r = requests.delete(f"{BASE_URL}/api/companies/{company['id']}/media/banner",
                            cookies=users["owner"]["cookie"])
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/companies/{company['id']}").json()
        assert r2.get("banner_url") in (None, "")


class TestCompanyGallery:
    def test_gallery_append_and_remove_by_index(self, users, company):
        # start clean
        r = requests.get(f"{BASE_URL}/api/companies/{company['id']}").json()
        initial = len(r.get("gallery") or [])

        # add two images
        for i in range(2):
            files = {"file": (f"g{i}.png", io.BytesIO(PNG_1x1), "image/png")}
            r = requests.post(f"{BASE_URL}/api/companies/{company['id']}/gallery",
                              files=files, cookies=users["owner"]["cookie"])
            assert r.status_code == 200, r.text
        r = requests.get(f"{BASE_URL}/api/companies/{company['id']}").json()
        gal = r["gallery"]
        assert len(gal) == initial + 2
        second_url = gal[initial + 1]

        # remove index initial (first newly added)
        r = requests.delete(f"{BASE_URL}/api/companies/{company['id']}/gallery/{initial}",
                            cookies=users["owner"]["cookie"])
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/companies/{company['id']}").json()
        gal2 = r["gallery"]
        assert len(gal2) == initial + 1
        # the previously-second URL is still present
        assert second_url in gal2


class TestPublicMediaGuard:
    def test_public_endpoint_rejects_paths_outside_namespace(self):
        r = requests.get(f"{BASE_URL}/api/companies/media/etc/passwd", allow_redirects=False)
        assert r.status_code in (403, 404)
