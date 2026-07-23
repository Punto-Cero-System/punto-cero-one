"""Auth endpoint tests: login, me, brute-force lockout."""
import time
import pytest
import requests

ADMIN_EMAIL = "admin@puntocerosystem.com"
ADMIN_PASSWORD = "PuntoCero2026Admin"


class TestAdminSeedAndIndexes:
    """Verify seed_admin ran on startup and indexes are in place."""

    def test_admin_user_exists_with_bcrypt_hash(self, mongo_db):
        user = mongo_db.users.find_one({"email": ADMIN_EMAIL})
        assert user is not None, "Admin user was not seeded"
        assert user.get("role") == "admin"
        pw_hash = user.get("password_hash", "")
        assert pw_hash.startswith("$2b$"), f"Expected bcrypt $2b$ hash, got: {pw_hash[:6]}"

    def test_exactly_one_admin(self, mongo_db):
        count = mongo_db.users.count_documents({"role": "admin"})
        assert count >= 1

    def test_indexes(self, mongo_db):
        u_idx = mongo_db.users.index_information()
        # email should be unique
        assert any(
            i.get("unique") and i.get("key") == [("email", 1)]
            for i in u_idx.values()
        ), f"users.email unique index missing. Found: {u_idx}"
        assert any(
            i.get("unique") and i.get("key") == [("id", 1)]
            for i in u_idx.values()
        ), f"users.id unique index missing"

        r_idx = mongo_db.investor_requests.index_information()
        assert any(
            i.get("unique") and i.get("key") == [("id", 1)]
            for i in r_idx.values()
        )
        assert any(i.get("key") == [("email", 1)] for i in r_idx.values())
        assert any(i.get("key") == [("status", 1)] for i in r_idx.values())
        assert any(i.get("key") == [("submitted_at", 1)] for i in r_idx.values())

        la_idx = mongo_db.login_attempts.index_information()
        assert any(
            i.get("unique") and i.get("key") == [("identifier", 1)]
            for i in la_idx.values()
        )


class TestLogin:
    def test_login_success(self, base_url, api_client, mongo_db):
        # Ensure no lockout for admin
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": ADMIN_EMAIL}})
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str) and data["access_token"]
        assert data.get("token_type") == "bearer"
        assert isinstance(data.get("expires_in_hours"), int)
        user = data.get("user", {})
        assert user.get("email") == ADMIN_EMAIL
        assert user.get("role") == "admin"
        # password_hash must not leak
        assert "password_hash" not in user

    def test_login_wrong_password(self, base_url, api_client, mongo_db):
        # Use a distinct identifier to avoid interfering with other tests
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": ADMIN_EMAIL}})
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpass-xyz-1"},
            timeout=15,
        )
        assert r.status_code == 401, r.text
        assert "Credenciales" in r.json().get("detail", "")
        # cleanup so subsequent tests aren't impacted
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": ADMIN_EMAIL}})

    def test_login_unknown_email(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "no-such-user@example.com", "password": "whatever"},
            timeout=15,
        )
        assert r.status_code == 401


class TestMe:
    def test_me_with_token(self, base_url, api_client, admin_headers):
        r = api_client.get(f"{base_url}/api/auth/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("role") == "admin"
        assert "password_hash" not in data

    def test_me_without_token(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_malformed_token(self, base_url, api_client):
        r = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": "Bearer not-a-real-jwt"},
            timeout=10,
        )
        assert r.status_code == 401


class TestBruteForceLockout:
    """5 failed attempts -> 6th returns 429. Successful login resets counter."""

    # Use a UNIQUE email (unknown user) so we don't interfere with admin login and don't need
    # a real password. login_attempts key is (ip+email).
    TARGET_EMAIL = "bruteforce-target@example.com"

    def _clear(self, mongo_db):
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": self.TARGET_EMAIL}})

    def test_lockout_after_5_failures(self, base_url, api_client, mongo_db):
        self._clear(mongo_db)
        # 5 failed attempts -> all return 401
        for i in range(5):
            r = api_client.post(
                f"{base_url}/api/auth/login",
                json={"email": self.TARGET_EMAIL, "password": f"wrong-{i}"},
                timeout=10,
            )
            assert r.status_code == 401, f"Attempt {i+1} expected 401, got {r.status_code}: {r.text}"

        # 6th attempt -> should be locked out (429)
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": self.TARGET_EMAIL, "password": "wrong-final"},
            timeout=10,
        )
        assert r.status_code == 429, f"Expected 429 lockout, got {r.status_code}: {r.text}"
        assert "minutos" in r.json().get("detail", "").lower()
        self._clear(mongo_db)

    def test_successful_login_resets_counter(self, base_url, api_client, mongo_db):
        """After some failures with admin's email, a successful admin login resets counter."""
        # Clean the admin login_attempts entries
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": ADMIN_EMAIL}})

        # 3 failed attempts
        for i in range(3):
            r = api_client.post(
                f"{base_url}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": f"wrong-{i}"},
                timeout=10,
            )
            assert r.status_code == 401

        # Now successful login should reset the counter
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10,
        )
        assert r.status_code == 200, r.text

        # Counter should be gone (deleted upon success)
        remaining = list(mongo_db.login_attempts.find({"identifier": {"$regex": ADMIN_EMAIL}}))
        assert remaining == [], f"login_attempts should be cleared after successful login, got: {remaining}"


class TestLogout:
    def test_logout_ok(self, base_url, api_client, admin_headers):
        r = api_client.post(f"{base_url}/api/auth/logout", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True
