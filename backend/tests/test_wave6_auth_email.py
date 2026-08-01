"""Wave 6 — Email/Password Auth + Password Reset (community).

Covers:
  * /api/community/auth/register happy path + duplicate detection
  * /api/community/auth/login success + failure
  * /api/community/auth/password/forgot always 200 (no enumeration)
  * /api/community/auth/password/reset happy path + re-use rejection
  * ui_preferences PATCH on /api/community/users/me
  * PUT /api/community/users/me/media/{slot} + public streaming
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


def _random_email() -> str:
    return f"pytest+{uuid.uuid4().hex[:10]}@puntocero.test-e2e.com"


def test_register_login_flow():
    email = _random_email()
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/community/auth/register",
               json={"email": email, "password": "TestPwd12345", "name": "Test"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == email
    assert "password" in data["providers"]

    r2 = s.post(f"{BASE_URL}/api/community/auth/register",
                json={"email": email, "password": "Another12345"})
    assert r2.status_code == 409

    s2 = requests.Session()
    r3 = s2.post(f"{BASE_URL}/api/community/auth/login",
                 json={"email": email, "password": "TestPwd12345"})
    assert r3.status_code == 200
    assert s2.cookies.get("session_token")

    r4 = requests.post(f"{BASE_URL}/api/community/auth/login",
                       json={"email": email, "password": "wrong___password"})
    assert r4.status_code == 401


def test_password_reset_flow():
    email = _random_email()
    r = requests.post(f"{BASE_URL}/api/community/auth/register",
                      json={"email": email, "password": "OldPwd12345", "name": "Reset"})
    assert r.status_code == 200

    r_f = requests.post(f"{BASE_URL}/api/community/auth/password/forgot",
                        json={"email": email})
    assert r_f.status_code == 200
    assert r_f.json().get("ok") is True

    # Same generic 200 for non-existent email
    r_ne = requests.post(f"{BASE_URL}/api/community/auth/password/forgot",
                         json={"email": _random_email()})
    assert r_ne.status_code == 200

    # Fetch the reset token from Mongo (test backdoor)
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    rec = db.password_reset_tokens.find_one(
        {"email": email, "used": False}, sort=[("created_at", -1)])
    assert rec, "no reset token stored"
    token = rec["token"]

    s3 = requests.Session()
    r_ok = s3.post(f"{BASE_URL}/api/community/auth/password/reset",
                   json={"token": token, "password": "NewPwd99999"})
    assert r_ok.status_code == 200, r_ok.text
    assert s3.cookies.get("session_token")

    r_reuse = requests.post(f"{BASE_URL}/api/community/auth/password/reset",
                            json={"token": token, "password": "Nope99999"})
    assert r_reuse.status_code == 400

    r_new = requests.post(f"{BASE_URL}/api/community/auth/login",
                          json={"email": email, "password": "NewPwd99999"})
    assert r_new.status_code == 200
    r_old = requests.post(f"{BASE_URL}/api/community/auth/login",
                          json={"email": email, "password": "OldPwd12345"})
    assert r_old.status_code == 401


def test_ui_preferences_and_media():
    email = _random_email()
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/community/auth/register",
               json={"email": email, "password": "MediaPwd12345", "name": "Media"})
    assert r.status_code == 200

    r_pref = s.patch(
        f"{BASE_URL}/api/community/users/me",
        json={"ui_preferences": {"theme": "dark", "primary_color": "#EC4899",
                                 "gradient": "linear-gradient(135deg,#8B5CF6,#EC4899)"}},
    )
    assert r_pref.status_code == 200, r_pref.text
    ui = r_pref.json()["ui_preferences"]
    assert ui["theme"] == "dark"
    assert ui["primary_color"] == "#EC4899"

    import base64
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    r_up = s.put(
        f"{BASE_URL}/api/community/users/me/media/picture",
        files={"file": ("tiny.png", png, "image/png")},
    )
    assert r_up.status_code == 200, r_up.text
    url = r_up.json()["url"]
    assert url.startswith("/api/community/users/media/")

    # public streaming (no cookie required)
    r_pub = requests.get(f"{BASE_URL}{url}")
    assert r_pub.status_code == 200
    assert r_pub.headers["content-type"].startswith("image/")

    # invalid extension rejected
    r_bad = s.put(
        f"{BASE_URL}/api/community/users/me/media/picture",
        files={"file": ("bad.txt", b"hello", "text/plain")},
    )
    assert r_bad.status_code == 415
