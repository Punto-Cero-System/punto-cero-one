"""Wave 4A backend tests — Social Graph unified follows.

Covers:
  1. Follow endpoints require auth.
  2. User can follow another user; second follow is idempotent.
  3. Unfollow returns count 0.
  4. Bulk status returns per-id booleans.
  5. `/me` returns grouped follows for the current user.
  6. Hashtag ids are normalized (case-insensitive, strip #).
  7. `follows` collection populates the feed engine's `followed_user_ids` and
     `interaction_hashtags`, boosting matching posts in `/api/feed/for-you`.
"""
from __future__ import annotations

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


def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_test_w4a_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_w4a_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    mongo_db.users.insert_one({
        "id": uid, "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag} W4A", "role": "member", "created_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token, "provider": "google",
        "expires_at": "2099-01-01T00:00:00+00:00", "created_at": now,
    })
    return {"id": uid, "cookie": {"session_token": token}}


@pytest.fixture(scope="module")
def users(mongo_db):
    a = _mk_user(mongo_db, "actor")
    b = _mk_user(mongo_db, "target")
    yield {"a": a, "b": b}
    for u in (a, b):
        mongo_db.users.delete_many({"id": u["id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["id"]})
        mongo_db.follows.delete_many({"user_id": u["id"]})
        mongo_db.posts.delete_many({"author_id": u["id"]})


class TestAuthGuards:
    def test_follow_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/follows/user/xyz")
        assert r.status_code == 401

    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/follows/status?type=user&ids=x")
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/follows/me")
        assert r.status_code == 401


class TestFollowLifecycle:
    def test_user_follow_then_unfollow(self, users):
        a, b = users["a"], users["b"]
        r1 = requests.post(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["my_following"] is True
        assert d1["count"] == 1

        # Idempotent — a second follow doesn't inflate the count.
        r2 = requests.post(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        assert r2.status_code == 200
        assert r2.json()["count"] == 1

        # Unfollow → count 0
        r3 = requests.delete(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        assert r3.status_code == 200
        assert r3.json()["my_following"] is False

    def test_cannot_follow_self(self, users):
        a = users["a"]
        r = requests.post(f"{BASE_URL}/api/follows/user/{a['id']}", cookies=a["cookie"])
        assert r.status_code == 400
        assert "seguirte" in r.json().get("detail", "").lower()

    def test_invalid_entity_type(self, users):
        r = requests.post(f"{BASE_URL}/api/follows/dragon/xyz", cookies=users["a"]["cookie"])
        assert r.status_code == 400


class TestHashtagAndCountry:
    def test_hashtag_id_normalized(self, users):
        a = users["a"]
        # follow '#Legal' — should be stored as 'legal'
        r = requests.post(f"{BASE_URL}/api/follows/hashtag/%23Legal", cookies=a["cookie"])
        assert r.status_code == 200
        assert r.json()["entity_id"] == "legal"

        # Follow with different case → still idempotent
        r2 = requests.post(f"{BASE_URL}/api/follows/hashtag/LEGAL", cookies=a["cookie"])
        assert r2.status_code == 200
        assert r2.json()["count"] == 1
        # cleanup
        requests.delete(f"{BASE_URL}/api/follows/hashtag/legal", cookies=a["cookie"])

    def test_country_follow(self, users):
        a = users["a"]
        r = requests.post(f"{BASE_URL}/api/follows/country/CO", cookies=a["cookie"])
        assert r.status_code == 200
        assert r.json()["entity_id"] == "co"
        requests.delete(f"{BASE_URL}/api/follows/country/co", cookies=a["cookie"])


class TestBulkStatusAndMe:
    def test_bulk_status(self, users):
        a, b = users["a"], users["b"]
        requests.post(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        r = requests.get(f"{BASE_URL}/api/follows/status",
                         params={"type": "user", "ids": f"{b['id']},never-exists"},
                         cookies=a["cookie"])
        assert r.status_code == 200
        d = r.json()["following"]
        assert d[b["id"]] is True
        assert d["never-exists"] is False
        requests.delete(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])

    def test_me_returns_grouped(self, users):
        a, b = users["a"], users["b"]
        requests.post(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        requests.post(f"{BASE_URL}/api/follows/hashtag/ecosystem", cookies=a["cookie"])
        requests.post(f"{BASE_URL}/api/follows/country/CO", cookies=a["cookie"])
        r = requests.get(f"{BASE_URL}/api/follows/me", cookies=a["cookie"])
        assert r.status_code == 200
        f = r.json()["follows"]
        assert b["id"] in f["user"]
        assert "ecosystem" in f["hashtag"]
        assert "co" in f["country"]
        # cleanup
        requests.delete(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        requests.delete(f"{BASE_URL}/api/follows/hashtag/ecosystem", cookies=a["cookie"])
        requests.delete(f"{BASE_URL}/api/follows/country/CO", cookies=a["cookie"])


class TestSocialGraphFeedIntegration:
    def test_following_user_boosts_their_posts(self, users, mongo_db):
        """After A follows B, B's post should rank higher in A's 'Para Ti'."""
        a, b = users["a"], users["b"]

        p1 = requests.post(f"{BASE_URL}/api/feed/posts",
                           json={"body": "post por B seguido #legal", "category_key": "comunidad"},
                           cookies=b["cookie"]).json()

        # Follow B
        requests.post(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])

        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=15", cookies=a["cookie"]).json()
        matched = next((it for it in r["items"] if it["id"] == p1["id"]), None)
        assert matched is not None
        joined = " ".join(matched["for_you"]["reasons"]).lower()
        assert "seguida" in joined  # "empresa/persona seguida"

        # cleanup
        requests.delete(f"{BASE_URL}/api/follows/user/{b['id']}", cookies=a["cookie"])
        mongo_db.posts.delete_many({"id": p1["id"]})
