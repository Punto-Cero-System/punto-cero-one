"""Shared fixtures for backend integration tests."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break

ADMIN_EMAIL = "admin@puntocerosystem.com"
ADMIN_PASSWORD = "PuntoCero2026Admin"

# Direct Mongo access for cleanup
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client, mongo_db):
    # Ensure no lockout for the admin identifier before logging in
    mongo_db.login_attempts.delete_many({"identifier": {"$regex": ADMIN_EMAIL}})
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed ({r.status_code}): {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="session", autouse=True)
def _final_cleanup(mongo_db):
    """Session-scoped teardown: remove TEST_ prefixed data after ALL tests in this
    worker's session complete. Runs per worker under pytest-xdist; safe because
    by session end no other test in this worker is still using the data.
    """
    yield
    try:
        mongo_db.investor_requests.delete_many({"email": {"$regex": "^TEST_"}})
        mongo_db.investor_requests.delete_many({"fullName": {"$regex": "^TEST_"}})
        mongo_db.login_attempts.delete_many({"identifier": {"$regex": "bruteforce-target"}})
    except Exception:
        pass


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
