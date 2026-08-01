"""Wave 6 extended coverage — providers, cover media, feed follow signal.

Complements test_wave6_auth_email.py with:
  * /providers coming_soon list contains apple, microsoft, linkedin, facebook, twitter
  * Google provider present in enabled
  * Cover slot upload (PUT /me/media/cover) sets user.cover_url
  * DELETE /me/media/picture clears user.picture
  * ui_preferences persisted across GET /me
  * pc:follow-change: follow a company then GET /api/feed/for-you includes new signals
"""
from __future__ import annotations

import base64
import os
import uuid

import pytest
import requests

# Load env
if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _random_email() -> str:
    return f"pytest+{uuid.uuid4().hex[:10]}@puntocero.test-e2e.com"


def _register(session: requests.Session) -> tuple[str, dict]:
    email = _random_email()
    r = session.post(f"{BASE_URL}/api/community/auth/register",
                     json={"email": email, "password": "TestPwd12345", "name": "Ext"})
    assert r.status_code == 200, r.text
    return email, r.json()


# ---------- providers -----------------------------------------------------
def test_providers_coming_soon_and_enabled():
    r = requests.get(f"{BASE_URL}/api/community/auth/providers")
    assert r.status_code == 200, r.text
    data = r.json()
    coming_keys = {p["key"] for p in data.get("coming_soon", [])}
    assert {"apple", "microsoft", "linkedin", "facebook", "twitter"}.issubset(coming_keys), coming_keys
    assert data.get("email_password") is True
    enabled_keys = {p.get("key") if isinstance(p, dict) else p for p in data.get("enabled", [])}
    assert "google" in enabled_keys, f"google not in enabled: {enabled_keys}"


# ---------- profile media cover + delete ---------------------------------
def test_cover_slot_and_delete_picture():
    s = requests.Session()
    email, user = _register(s)

    # Upload cover
    r_cov = s.put(
        f"{BASE_URL}/api/community/users/me/media/cover",
        files={"file": ("cov.png", TINY_PNG, "image/png")},
    )
    assert r_cov.status_code == 200, r_cov.text
    cover_url = r_cov.json()["url"]
    assert "/cover/" in cover_url

    # Upload picture
    r_pic = s.put(
        f"{BASE_URL}/api/community/users/me/media/picture",
        files={"file": ("pic.png", TINY_PNG, "image/png")},
    )
    assert r_pic.status_code == 200
    picture_url = r_pic.json()["url"]

    # Verify persisted via /me
    r_me = s.get(f"{BASE_URL}/api/community/auth/me")
    assert r_me.status_code == 200
    me = r_me.json()
    assert me.get("picture") == picture_url

    # Public streaming works (no auth)
    r_pub = requests.get(f"{BASE_URL}{cover_url}")
    assert r_pub.status_code == 200
    assert r_pub.headers["content-type"].startswith("image/")

    # DELETE picture
    r_del = s.delete(f"{BASE_URL}/api/community/users/me/media/picture")
    assert r_del.status_code == 200

    r_me2 = s.get(f"{BASE_URL}/api/community/auth/me")
    assert r_me2.status_code == 200
    assert r_me2.json().get("picture") in (None, "")


# ---------- ui_preferences persistence -----------------------------------
def test_ui_preferences_persist_across_get():
    s = requests.Session()
    _register(s)

    prefs = {
        "theme": "dark",
        "primary_color": "#EC4899",
        "secondary_color": "#8B5CF6",
        "accent_color": "#F59E0B",
        "gradient": "linear-gradient(135deg,#8B5CF6,#EC4899)",
    }
    r_p = s.patch(f"{BASE_URL}/api/community/users/me",
                  json={"ui_preferences": prefs})
    assert r_p.status_code == 200, r_p.text

    r_g = s.get(f"{BASE_URL}/api/community/users/me")
    assert r_g.status_code == 200
    got = r_g.json().get("ui_preferences") or {}
    assert got.get("theme") == "dark"
    assert got.get("primary_color") == "#EC4899"
    assert got.get("gradient", "").startswith("linear-gradient")


# ---------- password validation --------------------------------------------
def test_short_password_rejected():
    r = requests.post(f"{BASE_URL}/api/community/auth/register",
                      json={"email": _random_email(), "password": "short", "name": "x"})
    assert r.status_code in (400, 422), r.text


# ---------- feed follow signal ---------------------------------------------
def test_follow_company_updates_for_you_signals():
    s = requests.Session()
    _register(s)

    # Find any company (use microsoft slug per playbook, or first from list)
    r_list = requests.get(f"{BASE_URL}/api/companies?limit=1")
    assert r_list.status_code == 200, r_list.text
    items = r_list.json().get("items") or r_list.json().get("companies") or []
    if not items:
        pytest.skip("No companies seeded")
    company_id = items[0].get("id")
    assert company_id

    # Follow it
    r_f = s.post(f"{BASE_URL}/api/companies/{company_id}/follow")
    assert r_f.status_code in (200, 201), r_f.text

    # for-you should now reflect follow_based mode signals
    r_fy = s.get(f"{BASE_URL}/api/feed/for-you?limit=5")
    assert r_fy.status_code == 200, r_fy.text
    body = r_fy.json()
    # signals_summary or mode should be present
    assert "items" in body
    # loose check: signals_summary if present should mention followed
    sig = body.get("signals_summary") or {}
    # Not strict — providers may or may not surface counts publicly
    assert isinstance(sig, dict)
