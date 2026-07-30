"""Community Auth API tests - /api/community/auth/*

Covers: providers listing, session exchange errors, cookie/bearer /me,
logout invalidation. Uses mongosh via a synchronous mongo insert through
motor is heavy — instead we seed via the public /session flow's siblings
using pymongo directly (available in requirements).
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

from pymongo import MongoClient

def _load_base_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_base_url()
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def seeded_user(db):
    """Insert a TEST_ user + session into Mongo; teardown deletes both."""
    ts = int(time.time() * 1000)
    user_id = f"TEST_user_{ts}"
    session_token = f"TEST_sess_{uuid.uuid4().hex}"
    email = f"TEST_member_{ts}@example.com"
    now_iso = datetime.now(timezone.utc).isoformat()
    exp_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    db.users.insert_one({
        "id": user_id,
        "email": email,
        "name": "Test Member",
        "role": "member",
        "picture": "https://via.placeholder.com/150",
        "auth_providers": [{
            "provider": "google",
            "provider_user_id": f"g_{ts}",
            "linked_at": now_iso,
        }],
        "created_at": now_iso,
    })
    db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "provider": "google",
        "expires_at": exp_iso,
        "created_at": now_iso,
    })

    yield {"user_id": user_id, "session_token": session_token, "email": email}

    db.user_sessions.delete_many({"user_id": user_id})
    db.users.delete_one({"id": user_id})


class TestProviders:
    def test_providers_returns_google(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/providers", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "enabled" in data and "session_ttl_days" in data
        assert data["session_ttl_days"] == 7
        keys = [p["key"] for p in data["enabled"]]
        assert "google" in keys
        google = next(p for p in data["enabled"] if p["key"] == "google")
        assert google["label"] == "Google"


class TestMeEndpoint:
    def test_me_without_credentials_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_cookie(self, seeded_user):
        r = requests.get(
            f"{BASE_URL}/api/community/auth/me",
            cookies={"session_token": seeded_user["session_token"]},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == seeded_user["user_id"]
        assert data["email"] == seeded_user["email"]
        assert data["name"] == "Test Member"
        assert data["role"] == "member"
        assert data["picture"] == "https://via.placeholder.com/150"
        assert data["providers"] == ["google"]

    def test_me_with_bearer_token(self, seeded_user):
        r = requests.get(
            f"{BASE_URL}/api/community/auth/me",
            headers={"Authorization": f"Bearer {seeded_user['session_token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["id"] == seeded_user["user_id"]

    def test_me_with_bad_token(self):
        r = requests.get(
            f"{BASE_URL}/api/community/auth/me",
            cookies={"session_token": "does_not_exist_xyz"},
            timeout=15,
        )
        assert r.status_code == 401


class TestSessionExchange:
    def test_session_bad_id_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/community/auth/session",
            json={"provider": "google", "session_id": "invalid_session_id_zzz"},
            timeout=20,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text}"

    def test_session_disabled_provider_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/community/auth/session",
            json={"provider": "microsoft", "session_id": "anything_here"},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "microsoft" in r.text.lower() or "no habilit" in r.text.lower()


class TestLogout:
    def test_logout_invalidates_session(self, db):
        # Seed a fresh session for this test
        ts = int(time.time() * 1000)
        user_id = f"TEST_logout_user_{ts}"
        token = f"TEST_logout_sess_{uuid.uuid4().hex}"
        now_iso = datetime.now(timezone.utc).isoformat()
        exp_iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        db.users.insert_one({
            "id": user_id, "email": f"TEST_logout_{ts}@example.com",
            "name": "Logout Tester", "role": "member",
            "auth_providers": [{"provider": "google", "provider_user_id": "g", "linked_at": now_iso}],
            "created_at": now_iso,
        })
        db.user_sessions.insert_one({
            "user_id": user_id, "session_token": token, "provider": "google",
            "expires_at": exp_iso, "created_at": now_iso,
        })

        try:
            # Verify auth works
            r = requests.get(f"{BASE_URL}/api/community/auth/me",
                             cookies={"session_token": token}, timeout=15)
            assert r.status_code == 200

            # Logout
            r = requests.post(f"{BASE_URL}/api/community/auth/logout",
                              cookies={"session_token": token}, timeout=15)
            assert r.status_code == 200
            body = r.json()
            assert body.get("ok") is True

            # After logout, session should be gone
            r = requests.get(f"{BASE_URL}/api/community/auth/me",
                             cookies={"session_token": token}, timeout=15)
            assert r.status_code == 401
        finally:
            db.user_sessions.delete_many({"user_id": user_id})
            db.users.delete_one({"id": user_id})


class TestAdminRegression:
    def test_admin_login_still_works(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@puntocerosystem.com", "password": "PuntoCero2026Admin"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
