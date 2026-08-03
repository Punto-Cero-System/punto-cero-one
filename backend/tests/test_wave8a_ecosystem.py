"""Wave 8A · Ecosystem Activation tests.

Coverage:
- Search returns populated by_type buckets for microsoft/mongodb/google/kubernetes.
- Discovery entity/{slug}/related returns news/videos/repos + optional people/hashtags.
- Follow -> suggested returns based_on>=1 with real related companies.
- Growth items kind classification (news/video/job) counts.
- External jobs (Remotive) tolerated by /api/jobs.
- Regression: /api/companies, /api/feed/posts, providers, community auth.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

# Load backend/.env so MONGO_URL is available even without shell export
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

MEMBER_EMAIL = "member.demo@puntocero.test-e2e.com"
MEMBER_PASSWORD = "MemberDemo2026"


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def member_session(session):
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/community/auth/login",
        json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        # Register on demand
        r2 = s.post(
            f"{BASE_URL}/api/community/auth/register",
            json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD, "name": "Member Demo"},
            timeout=15,
        )
        assert r2.status_code in (200, 201), f"register failed: {r2.status_code} {r2.text}"
    return s


# ---------------- Search ----------------
@pytest.mark.parametrize(
    "q,requires",
    [
        ("microsoft", {"companies": 1, "news": 2, "videos": 2, "repos": 2}),
        ("mongodb", {"news": 1, "videos": 1, "repos": 1}),
        ("google", {"companies": 1, "news": 1, "repos": 1, "videos": 1, "jobs": 1}),
        ("kubernetes", {"repos": 1, "news": 1, "jobs": 1}),
    ],
)
def test_search_populated(session, q, requires):
    r = session.get(f"{BASE_URL}/api/search", params={"q": q}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("total", 0) > 0, f"search '{q}' total==0"
    by_type = data.get("by_type", {})
    for bucket, minimum in requires.items():
        got = len(by_type.get(bucket, []))
        assert got >= minimum, f"search '{q}' bucket {bucket}={got} < {minimum}: {by_type}"


# ---------------- Discovery Related ----------------
def test_discovery_related_microsoft(session):
    r = session.get(f"{BASE_URL}/api/discovery/entity/microsoft/related", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["news"]) >= 5, d
    assert len(d["videos"]) >= 5, d
    assert len(d["repos"]) >= 5, d
    assert len(d["jobs"]) >= 1, d
    assert len(d["similar"]) >= 5, d
    assert len(d["people"]) >= 1, d
    assert len(d["hashtags"]) >= 5, d


def test_discovery_related_mongodb(session):
    r = session.get(f"{BASE_URL}/api/discovery/entity/mongodb/related", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["news"]) >= 5, d
    assert len(d["videos"]) >= 5, d
    assert len(d["repos"]) >= 5, d


# ---------------- Follow -> Suggested ----------------
def test_follow_then_suggested(member_session):
    r = member_session.post(f"{BASE_URL}/api/follows/company/microsoft", timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("my_following") is True

    r2 = member_session.get(f"{BASE_URL}/api/discovery/suggested", timeout=15)
    assert r2.status_code == 200, r2.text
    d = r2.json()
    based_on = d.get("based_on", 0)
    # accept int or list
    if isinstance(based_on, list):
        assert len(based_on) >= 1
    else:
        assert int(based_on) >= 1, f"based_on={based_on}"
    items = d.get("items", [])
    assert len(items) >= 1, "no suggested items"
    slugs = {i.get("slug") for i in items}
    # real related content, not just fallback -> we expect at least one of these
    assert slugs & {"aws", "google-cloud", "openai", "github", "nvidia", "vercel"}, slugs


# ---------------- Growth items classification ----------------
def test_growth_items_kinds(db):
    assert db.growth_items.count_documents({"kind": "news"}) > 1000
    assert db.growth_items.count_documents({"kind": "video"}) > 50
    assert db.growth_items.count_documents({"kind": "job"}) > 25


def test_github_repos_populated(db):
    assert db.github_repos.count_documents({}) > 100
    assert db.sources.count_documents({"kind": "github_org"}) >= 1


def test_youtube_videos_have_urls(db):
    assert (
        db.growth_items.count_documents({"kind": "video", "url": {"$regex": "youtube"}}) > 50
    )


def test_remotive_jobs_ingested(db):
    assert db.jobs.count_documents({"external_source": "remotive"}) > 20


# ---------------- Jobs endpoint tolerates external jobs ----------------
def test_jobs_endpoint_handles_external(session):
    r = session.get(f"{BASE_URL}/api/jobs", params={"limit": 5}, timeout=15)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    assert len(items) >= 1
    # At least one item may have company_id=None (external Remotive) -> endpoint didn't crash
    for it in items:
        # company_id may be None; must not throw
        assert "id" in it


# ---------------- Regression ----------------
def test_regression_companies(session):
    r = session.get(f"{BASE_URL}/api/companies", params={"limit": 5}, timeout=15)
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert len(items) >= 1
    # No clearbit logos
    for c in items:
        logo = c.get("logo_url") or ""
        assert "clearbit" not in logo, f"clearbit still used in {c.get('slug')}: {logo}"


def test_regression_feed_posts(session):
    r = session.get(f"{BASE_URL}/api/feed/posts", params={"limit": 3}, timeout=15)
    assert r.status_code == 200


def test_regression_feed_for_you(session):
    r = session.get(f"{BASE_URL}/api/feed/for-you", params={"limit": 3}, timeout=15)
    assert r.status_code == 200


def test_regression_providers_google(session):
    r = session.get(f"{BASE_URL}/api/community/auth/providers", timeout=15)
    assert r.status_code == 200
    enabled = r.json().get("enabled", [])
    keys = {p.get("key") for p in enabled}
    assert "google" in keys


def test_regression_community_auth_register_login_verify_forgot(session):
    """Smoke-test wave6 auth endpoints still respond."""
    email = f"TEST_wave8a_{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
    pw = "TestPwd12345"
    s = requests.Session()

    r = s.post(
        f"{BASE_URL}/api/community/auth/register",
        json={"email": email, "password": pw, "name": "Wave8A"},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text

    r = s.post(
        f"{BASE_URL}/api/community/auth/login",
        json={"email": email, "password": pw},
        timeout=15,
    )
    assert r.status_code == 200, r.text

    r = s.post(f"{BASE_URL}/api/community/auth/verify/send", json={"email": email}, timeout=15)
    # 429 is acceptable (cooldown from auto-send at register)
    assert r.status_code in (200, 202, 429), r.text

    r = requests.post(
        f"{BASE_URL}/api/community/auth/password/forgot",
        json={"email": email},
        timeout=15,
    )
    assert r.status_code == 200, r.text
