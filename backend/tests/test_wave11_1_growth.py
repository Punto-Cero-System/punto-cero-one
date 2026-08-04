"""Wave 11.1 — OAuth GitHub/Facebook + Invitations + SEO/sitemap tests."""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://future-core-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = "member.demo@puntocero.test-e2e.com"
TEST_PASS = "MemberDemo2026"


@pytest.fixture(scope="module")
def member_session():
    s = requests.Session()
    # Ensure the account exists first (best-effort register — 409 ok)
    s.post(f"{API}/community/auth/register",
           json={"email": TEST_EMAIL, "password": TEST_PASS, "name": "Member Demo"})
    r = s.post(f"{API}/community/auth/login",
               json={"email": TEST_EMAIL, "password": TEST_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# --- OAuth providers registry -----------------------------------------------
class TestProviders:
    def test_providers_registry(self):
        r = requests.get(f"{API}/community/auth/providers")
        assert r.status_code == 200
        data = r.json()
        enabled = {p["key"] for p in data["enabled"]}
        coming = {p["key"] for p in data.get("coming_soon", [])}
        assert "google" in enabled, f"google should be enabled, got {enabled}"
        # required coming_soon set
        for k in ["linkedin", "microsoft", "github", "facebook", "apple", "twitter"]:
            assert k in coming, f"{k} missing from coming_soon: {coming}"


# --- GitHub / Facebook start endpoint returns 503 when unconfigured ---------
class TestOAuthStart:
    def test_github_start_503(self):
        r = requests.get(f"{API}/community/auth/oauth/github/start", allow_redirects=False)
        # If not enabled → 503 "no configurado"
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:200]}"
        assert "configurado" in r.text.lower() or "configur" in r.text.lower()

    def test_facebook_start_503(self):
        r = requests.get(f"{API}/community/auth/oauth/facebook/start", allow_redirects=False)
        assert r.status_code == 503
        assert "configur" in r.text.lower()


# --- Invite endpoints -------------------------------------------------------
class TestInvite:
    def test_get_invite(self, member_session):
        r = member_session.get(f"{API}/community/auth/me/invite")
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["code", "url", "invited_registered", "share_message"]).issubset(data.keys())
        code = data["code"]
        assert re.fullmatch(r"[A-Z0-9]{8}", code), f"bad code: {code}"
        assert f"/join?invite={code}" in data["url"], data["url"]

    def test_invite_credit_on_register(self, member_session):
        # Snapshot current counter
        before = member_session.get(f"{API}/community/auth/me/invite").json()
        code = before["code"]
        base_count = before["invited_registered"]

        # Register two new users with that code
        e1 = f"test_wave111_{uuid.uuid4().hex[:8]}@example.com"
        e2 = f"test_wave111_{uuid.uuid4().hex[:8]}@example.com"
        r1 = requests.post(f"{API}/community/auth/register",
                           json={"email": e1, "password": "SomePass2026",
                                 "name": "Invitee 1", "invite_code": code})
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/community/auth/register",
                           json={"email": e2, "password": "SomePass2026",
                                 "name": "Invitee 2", "invite_code": code})
        assert r2.status_code == 200, r2.text

        after = member_session.get(f"{API}/community/auth/me/invite").json()
        assert after["invited_registered"] == base_count + 2, \
            f"expected +2, got before={base_count} after={after['invited_registered']}"

    def test_invite_idempotent_dup_email(self, member_session):
        before = member_session.get(f"{API}/community/auth/me/invite").json()
        code = before["code"]
        base_count = before["invited_registered"]

        e = f"test_wave111dup_{uuid.uuid4().hex[:8]}@example.com"
        r1 = requests.post(f"{API}/community/auth/register",
                           json={"email": e, "password": "SomePass2026",
                                 "name": "Dup", "invite_code": code})
        assert r1.status_code == 200, r1.text
        # Second register with same email
        r2 = requests.post(f"{API}/community/auth/register",
                           json={"email": e, "password": "SomePass2026",
                                 "name": "Dup2", "invite_code": code})
        assert r2.status_code in (400, 409), f"expected 400/409, got {r2.status_code}"

        after = member_session.get(f"{API}/community/auth/me/invite").json()
        assert after["invited_registered"] == base_count + 1, \
            f"expected +1 (not +2), got before={base_count} after={after['invited_registered']}"

    def test_invalid_invite_code_still_succeeds(self, member_session):
        before = member_session.get(f"{API}/community/auth/me/invite").json()
        base_count = before["invited_registered"]

        e = f"test_wave111bad_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/community/auth/register",
                          json={"email": e, "password": "SomePass2026",
                                "name": "Bad", "invite_code": "XXXXXXXX"})
        assert r.status_code == 200, r.text

        after = member_session.get(f"{API}/community/auth/me/invite").json()
        assert after["invited_registered"] == base_count, \
            f"unknown code should NOT increment referrer count"


# --- SEO / sitemap / robots -------------------------------------------------
class TestSeo:
    def test_sitemap(self):
        r = requests.get(f"{API}/seo/sitemap.xml")
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "").lower()
        body = r.text
        assert "<urlset" in body
        url_count = body.count("<url>")
        assert url_count >= 15, f"expected >=15 urls, got {url_count}"
        assert "/empresas" in body
        assert "/join" in body
        assert "/noticias" in body

    def test_robots(self):
        r = requests.get(f"{API}/seo/robots.txt")
        assert r.status_code == 200
        assert "Sitemap:" in r.text

    def test_og_company_microsoft(self):
        r = requests.get(f"{API}/seo/og/company/microsoft")
        assert r.status_code == 200
        body = r.text
        assert 'property="og:title"' in body
        assert "Microsoft" in body
        assert 'property="og:description"' in body
        assert 'property="og:image"' in body
        assert 'rel="canonical"' in body
        assert 'application/ld+json' in body
        assert '"Organization"' in body or "'Organization'" in body

    def test_og_company_404(self):
        r = requests.get(f"{API}/seo/og/company/nonexistent-slug-zzz")
        assert r.status_code == 404
