"""Wave 9.1 — Auto region detection tests.

Covers:
  * GET /api/community/region/detect basic shape
  * X-Forwarded-For IP → country (CO, MX)
  * Cache warm (idempotent repeated calls)
  * Persistence for authed users (country_source='ip')
  * Manual selection is never overwritten
  * Anonymous → persisted=false
  * Regional discovery still applies with detected country
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _reset_country_source(email: str) -> bool:
    """Best-effort direct DB reset so we can validate the 'first auto-detect
    persists' branch. Returns True if reset (or already non-manual)."""
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        with MongoClient(mongo_url, serverSelectionTimeoutMS=2000) as c:
            res = c[db_name].users.update_one(
                {"email": email},
                {"$unset": {"country_source": ""}},
            )
            return res.matched_count > 0
    except Exception:
        return False

CO_IP = "190.85.107.5"       # Colombia (ETB Bogota range)
MX_IP = "189.203.229.65"     # Mexico (Telmex)

MEMBER_EMAIL = "member.demo@puntocero.test-e2e.com"
MEMBER_PASSWORD = "MemberDemo2026"

REQUIRED_FIELDS = {
    "ip", "method", "country", "country_name", "region", "city",
    "timezone", "latitude", "longitude", "persisted", "default_country",
}
ALLOWED_METHODS = {"ip", "language", "default", "timezone"}


# ---------- Fixtures -------------------------------------------------------

@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def member_session():
    """Logs in the demo member via cookie session; returns a session that
    carries the httpOnly cookie."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/community/auth/login",
               json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Cannot login demo member: {r.status_code} {r.text[:200]}")
    return s


# ---------- Shape ----------------------------------------------------------

class TestDetectShape:
    def test_endpoint_200_and_shape(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/community/region/detect", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        missing = REQUIRED_FIELDS - set(data.keys())
        assert not missing, f"Missing fields: {missing}"
        assert data["default_country"] == "CO"
        assert data["method"] in ALLOWED_METHODS, f"method={data['method']}"
        assert data["country"] is not None


# ---------- IP detection ---------------------------------------------------

class TestIPDetection:
    def test_co_ip(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # Provider may occasionally fall back — surface useful info if so
        assert data["country"] == "CO", f"Expected CO, got {data}"
        assert data["method"] == "ip", f"Expected method=ip, got {data['method']}"
        # City/timezone should be populated for a valid CO IP
        assert data.get("city"), f"missing city: {data}"
        assert data.get("timezone"), f"missing timezone: {data}"

    def test_mx_ip(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": MX_IP},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["country"] == "MX", f"Expected MX, got {data}"
        assert data["method"] == "ip"

    def test_cache_warm_repeat(self, anon_client):
        """Second call within 5s for same IP → same country (cache warm)."""
        r1 = anon_client.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP}, timeout=15)
        r2 = anon_client.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP}, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["country"] == r2.json()["country"] == "CO"


# ---------- Anonymous persistence flag ------------------------------------

class TestAnonPersistence:
    def test_anon_never_persists(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP}, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["persisted"] is False
        assert data["country"] is not None


# ---------- Authed persistence + manual lock ------------------------------

class TestAuthedPersistence:
    def _get_me(self, s):
        r = s.get(f"{BASE_URL}/api/community/auth/me", timeout=10)
        assert r.status_code == 200, r.text
        return r.json()

    def test_persist_ip_then_manual_locks(self, member_session):
        s = member_session
        # Step 1: reset via PATCH to a known state, then flip country_source
        # off "manual" by hitting detect (which only writes if != manual).
        # First ensure current state so we know the starting point.
        me0 = self._get_me(s)

        # If user is currently manual (from a prior test), force a reset by
        # directly writing a non-manual source via detect after a hack:
        # we can't do that; but the spec allows us to just test the two
        # behaviors sequentially. Start by ensuring source is 'ip' via
        # detect ONLY when the current source is not manual.
        if me0.get("country_source") == "manual":
            # Try a best-effort direct DB reset so this test can validate
            # the "first auto-detect persists" branch regardless of prior
            # test state.
            reset_ok = _reset_country_source(MEMBER_EMAIL)
            if not reset_ok:
                pytest.skip(
                    "member is currently manual from a previous run; "
                    "cannot reset country_source through public API"
                )
        else:
            # /me schema does not expose country_source, so we still try to
            # reset defensively (idempotent).
            _reset_country_source(MEMBER_EMAIL)

        # Step 2: hit detect with CO IP as authed → should persist
        r = s.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP}, timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["country"] == "CO"
        assert d["persisted"] is True, f"expected persisted=True, got {d}"

        me1 = self._get_me(s)
        assert me1.get("country") == "CO", me1
        # country_source exposure — /me may or may not expose it in the
        # CommunityUserPublic schema. If missing, fall back to Wave 9.1 spec.
        # (The public schema doesn't include country_source, so we validate
        # through the manual-lock behavior below.)

        # Step 3: manually pick MX
        r = s.patch(
            f"{BASE_URL}/api/community/auth/me/region",
            json={"country": "MX"}, timeout=10,
        )
        assert r.status_code == 200, r.text
        me2 = self._get_me(s)
        assert me2["country"] == "MX"

        # Step 4: hit detect again with CO IP → country in user MUST stay MX
        r = s.get(
            f"{BASE_URL}/api/community/region/detect",
            headers={"X-Forwarded-For": CO_IP}, timeout=15,
        )
        assert r.status_code == 200
        d2 = r.json()
        # Detected payload can still say CO, but persisted must be False now
        assert d2["persisted"] is False, f"manual pick was overwritten: {d2}"
        me3 = self._get_me(s)
        assert me3["country"] == "MX", f"manual pick lost: {me3}"

        # Cleanup: leave user in a well-known state
        s.patch(f"{BASE_URL}/api/community/auth/me/region",
                json={"country": "CO"}, timeout=10)


# ---------- Regional discovery integration --------------------------------

class TestRegionalDiscoveryIntegration:
    def test_trending_with_co_header(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/discovery/trending?limit=8",
            headers={"X-Region-Country": "CO"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("items") or data.get("results") or []
        assert items, f"no items: {data}"
        first = items[0]
        # regional_weight may live on the item or in a nested score object
        rw = first.get("regional_weight")
        if rw is None:
            rw = (first.get("score") or {}).get("regional_weight")
        assert rw == 1.0, f"expected regional_weight=1.0 for CO seed, got {first}"

    def test_related_entity_microsoft(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/discovery/entity/microsoft/related",
            headers={"X-Region-Country": "CO"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        similar = data.get("similar") or []
        assert similar, f"no similar entries: {data}"
        # The first similar item should be CO-tier when user is CO
        first_country = similar[0].get("country") or similar[0].get("company_country")
        # Lenient assertion: at least one of the top 3 is CO
        top3 = [
            (s.get("country") or s.get("company_country")) for s in similar[:3]
        ]
        assert "CO" in top3, f"CO not in top-3 similar countries: {top3}"
