"""Wave 4B backend tests — Mi Espacio workspace persistence."""
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
    uid = f"user_test_ws_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_ws_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    mongo_db.users.insert_one({
        "id": uid, "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag} WS", "role": "member", "created_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token, "provider": "google",
        "expires_at": "2099-01-01T00:00:00+00:00", "created_at": now,
    })
    return {"id": uid, "cookie": {"session_token": token}}


@pytest.fixture(scope="module")
def user(mongo_db):
    u = _mk_user(mongo_db, "alpha")
    yield u
    mongo_db.users.delete_one({"id": u["id"]})
    mongo_db.user_sessions.delete_many({"user_id": u["id"]})
    mongo_db.user_workspaces.delete_one({"user_id": u["id"]})


def test_workspace_requires_auth():
    r = requests.get(f"{BASE_URL}/api/workspace/me")
    assert r.status_code == 401


def test_workspace_returns_defaults_when_empty(user):
    r = requests.get(f"{BASE_URL}/api/workspace/me", cookies=user["cookie"])
    assert r.status_code == 200
    payload = r.json()
    assert "workspace" in payload
    assert "defaults" in payload
    ws = payload["workspace"]
    assert set(ws["panels"].keys()) == {"left", "center", "right"}
    # feed must be present by default
    assert "feed" in ws["panels"]["center"]
    # right panel has crypto-live + news + messages
    assert "rss-news" in ws["panels"]["right"]
    assert "messages" in ws["panels"]["right"]


def test_workspace_full_replace_persists(user):
    body = {
        "panels": {
            "left": ["profile-card", "activity"],
            "center": ["feed"],
            "right": ["crypto-live"],
        },
        "widgets": {"feed": {"enabled": True, "collapsed": False, "size": "md"}},
        "theme": "dark",
    }
    r = requests.put(f"{BASE_URL}/api/workspace/me", json=body, cookies=user["cookie"])
    assert r.status_code == 200
    ws = r.json()["workspace"]
    assert ws["panels"]["left"] == ["profile-card", "activity"]
    assert ws["panels"]["right"] == ["crypto-live"]
    assert ws["theme"] == "dark"

    # re-fetch — persisted
    r2 = requests.get(f"{BASE_URL}/api/workspace/me", cookies=user["cookie"])
    assert r2.status_code == 200
    ws2 = r2.json()["workspace"]
    assert ws2["panels"]["center"] == ["feed"]
    assert ws2["theme"] == "dark"


def test_workspace_patch_merges_state(user):
    r = requests.patch(f"{BASE_URL}/api/workspace/me",
                       json={"widgets": {"activity": {"enabled": False}}},
                       cookies=user["cookie"])
    assert r.status_code == 200
    ws = r.json()["workspace"]
    assert ws["widgets"]["activity"]["enabled"] is False
    # feed still present
    assert ws["widgets"]["feed"]["enabled"] is True


def test_workspace_dedupes_and_sanitizes(user):
    body = {
        "panels": {
            "left": ["profile-card", "profile-card", " ", "", "activity"],
            "center": ["feed"],
            "right": ["crypto-live"],
        },
        "widgets": {},
        "theme": "not-a-real-theme",
    }
    r = requests.put(f"{BASE_URL}/api/workspace/me", json=body, cookies=user["cookie"])
    assert r.status_code == 200
    ws = r.json()["workspace"]
    assert ws["panels"]["left"] == ["profile-card", "activity"]
    assert ws["theme"] == "auto"   # invalid theme is coerced


def test_workspace_reset_wipes_and_returns_defaults(user):
    r = requests.post(f"{BASE_URL}/api/workspace/me/reset", cookies=user["cookie"])
    assert r.status_code == 200
    assert r.json().get("reset") is True

    # loading again returns defaults (feed present in center)
    r2 = requests.get(f"{BASE_URL}/api/workspace/me", cookies=user["cookie"])
    ws = r2.json()["workspace"]
    assert "feed" in ws["panels"]["center"]
    assert "rss-news" in ws["panels"]["right"]


def test_workspace_bad_payload_rejected(user):
    # panels must be a list
    r = requests.put(f"{BASE_URL}/api/workspace/me",
                     json={"panels": {"left": "not-a-list"}},
                     cookies=user["cookie"])
    assert r.status_code == 400
