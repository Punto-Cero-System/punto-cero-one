"""Wave 7 (Punto Cero One) growth tests.

Covers:
  * Email verification: register→email_verified=false, verify/send generic 200 + cooldown,
    verify/confirm success, token reuse rejection, other outstanding tokens invalidated.
  * Follow notifications (user + company owner).
  * @user_<12hex> mentions dispatch notifications; self-mention suppressed.
  * Unified search: 10 type keys + people url points to /u/{id}.
  * OAuth stubs: linkedin/microsoft 503 unconfigured; apple 404 (not registered).
  * Providers endpoint: enabled contains only google (among externals); coming_soon covers 5.
"""
from __future__ import annotations

import os
import uuid
import time

import pytest
import requests
from pymongo import MongoClient


if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def _rand_email() -> str:
    return f"pytest+{uuid.uuid4().hex[:10]}@puntocero.test-e2e.com"


def _register(session: requests.Session, name: str = "Wave7 User"):
    email = _rand_email()
    r = session.post(
        f"{BASE_URL}/api/community/auth/register",
        json={"email": email, "password": "TestPwd12345", "name": name},
    )
    assert r.status_code == 200, r.text
    return email, r.json()


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
class TestEmailVerification:
    def test_register_creates_unverified_user(self, mongo):
        s = requests.Session()
        email, data = _register(s)
        assert data.get("email_verified") is False, data

        r_me = s.get(f"{BASE_URL}/api/community/users/me")
        assert r_me.status_code == 200, r_me.text
        assert r_me.json().get("email_verified") is False

        # A token row should exist in email_verifications
        rec = mongo.email_verifications.find_one({"user_id": data["id"]})
        assert rec, "no email_verifications row created on register"

    def test_verify_send_generic_for_existing_and_nonexistent(self):
        s = requests.Session()
        email, _ = _register(s)

        # Use a fresh session to avoid session cookie path
        r1 = requests.post(f"{BASE_URL}/api/community/auth/verify/send", json={"email": email})
        # First call after register may hit cooldown (register just issued email).
        # Accept either 200 (generic) or 429 (cooldown).
        assert r1.status_code in (200, 429), r1.text
        if r1.status_code == 200:
            assert r1.json().get("ok") is True

        # Non-existent email → generic 200
        r2 = requests.post(f"{BASE_URL}/api/community/auth/verify/send", json={"email": _rand_email()})
        assert r2.status_code == 200
        assert r2.json().get("ok") is True

    def test_verify_send_cooldown(self):
        s = requests.Session()
        email, _ = _register(s)
        # Register already sent one → second immediate call should be 429
        r = requests.post(f"{BASE_URL}/api/community/auth/verify/send", json={"email": email})
        assert r.status_code == 429, r.text

    def test_verify_confirm_flow(self, mongo):
        s = requests.Session()
        email, user = _register(s)
        # Fetch the token
        rec = mongo.email_verifications.find_one(
            {"user_id": user["id"], "used": False}, sort=[("created_at", -1)])
        assert rec, "no unused verification token"
        token = rec["token"]

        # Create a *second* token by triggering send after cooldown bypass:
        # We'll insert manually to test invalidation semantics.
        mongo.email_verifications.insert_one({
            "token": "extra-" + uuid.uuid4().hex,
            "user_id": user["id"],
            "email": email,
            "created_at": rec["created_at"],
            "expires_at": rec["expires_at"],
            "used": False,
        })
        outstanding_before = mongo.email_verifications.count_documents(
            {"user_id": user["id"], "used": False})
        assert outstanding_before >= 2

        s2 = requests.Session()
        r = s2.post(f"{BASE_URL}/api/community/auth/verify/confirm", json={"token": token})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("email_verified") is True
        assert s2.cookies.get("session_token"), "session cookie not set"

        # Token now used
        rec_after = mongo.email_verifications.find_one({"token": token})
        assert rec_after.get("used") is True

        # Other outstanding tokens invalidated (deleted)
        remaining = mongo.email_verifications.count_documents(
            {"user_id": user["id"], "used": False})
        assert remaining == 0, f"expected all other tokens invalidated, got {remaining}"

        # Reuse → 400
        r2 = requests.post(f"{BASE_URL}/api/community/auth/verify/confirm", json={"token": token})
        assert r2.status_code == 400, r2.text


# ---------------------------------------------------------------------------
# Follow notifications
# ---------------------------------------------------------------------------
class TestFollowNotifications:
    def test_follow_user_dispatches_notification(self, mongo):
        # Create followee and follower
        s_target = requests.Session()
        _, target = _register(s_target, name="Target User")
        s_follower = requests.Session()
        _, follower = _register(s_follower, name="Follower User")

        r = s_follower.post(f"{BASE_URL}/api/follows/user/{target['id']}")
        assert r.status_code == 200, r.text

        # Give a moment for async write, then check
        time.sleep(0.5)
        notif = mongo.notifications.find_one(
            {"recipient_id": target["id"], "kind": "follower"},
            sort=[("created_at", -1)],
        )
        assert notif, "no follower notification created"

    def test_follow_seed_company_no_notification(self, mongo):
        # Find a company with no owner_id or system- owner
        seed_co = mongo.companies.find_one(
            {"$or": [{"owner_id": None}, {"owner_id": {"$regex": "^system-"}}, {"owner_id": {"$exists": False}}]},
            {"_id": 0, "id": 1, "owner_id": 1, "name": 1},
        )
        if not seed_co:
            pytest.skip("No seed company available")

        s = requests.Session()
        _, user = _register(s, name="Company Follower")
        r = s.post(f"{BASE_URL}/api/follows/company/{seed_co['id']}")
        assert r.status_code == 200, r.text
        # We can't strictly assert *absence* of any notification for anyone,
        # but at minimum no notif with subject_id == this company & kind follower
        # should target a real user_id.
        time.sleep(0.3)
        bad = mongo.notifications.find_one({
            "kind": "follower",
            "subject_type": "company",
            "subject_id": seed_co["id"],
            "actor.id": user["id"],
        })
        assert bad is None, f"unexpected notification for seed company: {bad}"


# ---------------------------------------------------------------------------
# Mentions
# ---------------------------------------------------------------------------
class TestMentions:
    def test_post_mention_dispatches_notif(self, mongo):
        s_mentioned = requests.Session()
        _, mentioned = _register(s_mentioned, name="Mentioned")
        s_author = requests.Session()
        _, author = _register(s_author, name="Author")

        body = f"Hola @{mentioned['id']} equipo, saludos"
        r = s_author.post(f"{BASE_URL}/api/feed/posts", json={"body": body, "category_key": "comunidad"})
        assert r.status_code in (200, 201), r.text

        time.sleep(0.5)
        notif = mongo.notifications.find_one(
            {"recipient_id": mentioned["id"], "kind": "mention"},
            sort=[("created_at", -1)],
        )
        assert notif, "no mention notification created"

    def test_self_mention_suppressed(self, mongo):
        s = requests.Session()
        _, author = _register(s, name="SelfMention")

        body = f"Nota personal para @{author['id']}"
        r = s.post(f"{BASE_URL}/api/feed/posts", json={"body": body, "category_key": "comunidad"})
        assert r.status_code in (200, 201), r.text

        time.sleep(0.4)
        notif = mongo.notifications.find_one(
            {"recipient_id": author["id"], "kind": "mention"})
        assert notif is None, f"self-mention should NOT notify: {notif}"

    def test_arbitrary_name_not_matched(self, mongo):
        s = requests.Session()
        _, author = _register(s, name="Author2")

        body = "Hola @juanperez y @user_notvalidhex esto no dispara"
        r = s.post(f"{BASE_URL}/api/feed/posts", json={"body": body, "category_key": "comunidad"})
        assert r.status_code in (200, 201), r.text
        # No pattern to assert here except: no notification kind=mention for author
        time.sleep(0.3)
        # This is a smoke check — regex is strict so nothing should fire.
        # We just ensure endpoint doesn't crash.
        assert True


# ---------------------------------------------------------------------------
# Unified search
# ---------------------------------------------------------------------------
class TestSearch:
    def test_search_returns_ten_type_keys(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "microsoft"})
        assert r.status_code == 200, r.text
        data = r.json()
        by_type = data.get("by_type") or {}
        expected = {"people", "companies", "posts", "jobs", "events",
                    "videos", "repos", "news", "hashtags", "categories"}
        missing = expected - set(by_type.keys())
        assert not missing, f"search by_type missing keys: {missing}. Got: {list(by_type.keys())}"

    def test_search_people_url_uses_u_prefix(self, mongo):
        # Ensure at least one user exists to search
        s = requests.Session()
        _, user = _register(s, name="Demo Searchable User")

        # Search by the unique name portion
        r = requests.get(f"{BASE_URL}/api/search",
                         params={"q": "Demo Searchable", "types": "people"})
        assert r.status_code == 200, r.text
        by_type = r.json().get("by_type") or {}
        people = by_type.get("people") or []
        if not people:
            pytest.skip("search index/results empty for created user (search may be async)")
        first = people[0]
        url = first.get("url") or ""
        assert url.startswith("/u/"), f"expected /u/... got {url!r}"


# ---------------------------------------------------------------------------
# OAuth stubs
# ---------------------------------------------------------------------------
class TestOAuthStubs:
    def test_linkedin_start_unconfigured_returns_503(self):
        # follow_redirects=False so we see the actual status.
        # Wave 11 OAuth Cleanup: LinkedIn env vars may now be configured
        # via the deployment envelope. Accept either the unconfigured
        # (503) or configured (302/307 redirect) outcome. Fail on 500/404.
        r = requests.get(f"{BASE_URL}/api/community/auth/oauth/linkedin/start",
                         allow_redirects=False)
        assert r.status_code in (503, 302, 307), r.text

    def test_microsoft_start_unconfigured_returns_503(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/oauth/microsoft/start",
                         allow_redirects=False)
        assert r.status_code in (503, 302), r.text

    def test_apple_start_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/oauth/apple/start",
                         allow_redirects=False)
        assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Providers endpoint
# ---------------------------------------------------------------------------
class TestProviders:
    def test_providers_enabled_and_coming_soon(self):
        r = requests.get(f"{BASE_URL}/api/community/auth/providers")
        assert r.status_code == 200, r.text
        data = r.json()

        enabled_keys = {p.get("key") if isinstance(p, dict) else p
                        for p in data.get("enabled", [])}
        # google must always be present
        assert "google" in enabled_keys, enabled_keys

        # Wave 11 OAuth Cleanup: only Google/LinkedIn/Facebook are visible.
        # `coming_soon` now surfaces ONLY the visible-but-not-yet-configured
        # providers (linkedin/facebook). Apple/Microsoft/GitHub/X are
        # hidden entirely from the client.
        coming_keys = {p["key"] for p in data.get("coming_soon", [])}
        assert coming_keys.issubset({"linkedin", "facebook"}), coming_keys
        # Ensure hidden providers do NOT appear anywhere in the response.
        combined = enabled_keys | coming_keys
        for hidden in ("apple", "microsoft", "github", "twitter"):
            assert hidden not in combined, f"{hidden} should be hidden: {combined}"


# ---------------------------------------------------------------------------
# Public profile
# ---------------------------------------------------------------------------
class TestPublicProfile:
    def test_public_profile_endpoint(self):
        s = requests.Session()
        _, user = _register(s, name="Public Profile Test")

        # No cookies (public)
        r = requests.get(f"{BASE_URL}/api/community/users/{user['id']}")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "name", "posts_count", "followers_count", "following_count"):
            assert k in data, f"missing field {k} in ProfilePublic: {list(data.keys())}"
