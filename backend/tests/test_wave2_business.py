"""Wave 2 backend tests — Companies, Jobs, Events, Profile, Analytics.

Creates ephemeral community sessions via direct MongoDB writes (matches the
pattern in /app/auth_testing.md). Two distinct users are used for ownership
scenarios. All test data (users, sessions, companies, jobs, events, RSVPs,
applications, follows, analytics events) is cleaned up at end of session.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    _env_path = "/app/frontend/.env"
    if os.path.exists(_env_path):
        with open(_env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break


# ---------------------------------------------------------------------------
# Session-scoped community user fixtures
# ---------------------------------------------------------------------------
def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_test_{tag}_{uuid.uuid4().hex[:8]}"
    token = f"test_session_{tag}_{uuid.uuid4().hex[:12]}"
    email = f"TEST_{tag}_{uuid.uuid4().hex[:6]}@example.com"
    now = datetime.now(timezone.utc)
    mongo_db.users.insert_one({
        "id": uid,
        "email": email,
        "name": f"Test {tag}",
        "role": "member",
        "picture": "https://via.placeholder.com/150",
        "auth_providers": [{
            "provider": "google",
            "provider_user_id": f"g_{uid}",
            "linked_at": now.isoformat(),
        }],
        "created_at": now.isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": token,
        "provider": "google",
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    })
    return {"id": uid, "email": email, "token": token}


@pytest.fixture(scope="module")
def user_a(mongo_db):
    return _mk_user(mongo_db, "usera")


@pytest.fixture(scope="module")
def user_b(mongo_db):
    return _mk_user(mongo_db, "userb")


def _hdr(u):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {u['token']}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup_wave2(mongo_db, user_a, user_b):
    yield
    uids = [user_a["id"], user_b["id"]]
    mongo_db.user_sessions.delete_many({"user_id": {"$in": uids}})
    mongo_db.users.delete_many({"id": {"$in": uids}})
    # cascade cleanup for entities created during tests
    companies = list(mongo_db.companies.find({"owner_id": {"$in": uids}}, {"id": 1}))
    cids = [c["id"] for c in companies]
    if cids:
        mongo_db.jobs.delete_many({"company_id": {"$in": cids}})
        mongo_db.events.delete_many({"company_id": {"$in": cids}})
        mongo_db.company_follows.delete_many({"company_id": {"$in": cids}})
    mongo_db.companies.delete_many({"owner_id": {"$in": uids}})
    mongo_db.events.delete_many({"organizer_id": {"$in": uids}})
    mongo_db.job_applications.delete_many({"applicant_id": {"$in": uids}})
    mongo_db.job_saves.delete_many({"user_id": {"$in": uids}})
    mongo_db.event_rsvps.delete_many({"user_id": {"$in": uids}})
    mongo_db.analytics_events.delete_many({"actor_id": {"$in": uids}})


# ---------------------------------------------------------------------------
# COMPANIES
# ---------------------------------------------------------------------------
class TestCompanies:
    def test_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/companies", json={"name": "TEST Anonymous Co"})
        assert r.status_code == 401

    def test_create_ok_and_slug(self, user_a):
        payload = {
            "name": f"TEST Alpha Co {uuid.uuid4().hex[:6]}",
            "tagline": "Impact tech",
            "vertical": "legal",
            "country": "co",
            "city": "Bogota",
            "description": "A test company",
        }
        r = requests.post(f"{BASE_URL}/api/companies", json=payload, headers=_hdr(user_a))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("co_")
        assert d["slug"]
        assert d["owner_id"] == user_a["id"]
        assert d["vertical"] == "legal"
        assert d["followers_count"] == 0
        pytest.company_id = d["id"]
        pytest.company_slug = d["slug"]

    def test_filter_by_vertical(self, user_a):
        r = requests.get(f"{BASE_URL}/api/companies?vertical=legal")
        assert r.status_code == 200
        data = r.json()
        assert any(c["id"] == pytest.company_id for c in data["items"])

    def test_get_by_slug(self):
        r = requests.get(f"{BASE_URL}/api/companies/{pytest.company_slug}")
        assert r.status_code == 200
        assert r.json()["id"] == pytest.company_id

    def test_get_future_core_5_slug(self):
        # Spec mentions this specific test; ensure the endpoint responds coherently
        r = requests.get(f"{BASE_URL}/api/companies/future-core-5")
        # If not present, 404 is acceptable per spec ("funciona" == endpoint works)
        assert r.status_code in (200, 404)

    def test_patch_forbidden_for_other_user(self, user_b):
        r = requests.patch(
            f"{BASE_URL}/api/companies/{pytest.company_id}",
            json={"tagline": "hacked"}, headers=_hdr(user_b),
        )
        assert r.status_code == 403

    def test_patch_ok_for_owner(self, user_a):
        r = requests.patch(
            f"{BASE_URL}/api/companies/{pytest.company_id}",
            json={"tagline": "updated tagline"}, headers=_hdr(user_a),
        )
        assert r.status_code == 200
        assert r.json()["tagline"] == "updated tagline"

    def test_follow_toggle(self, user_b):
        r1 = requests.post(f"{BASE_URL}/api/companies/{pytest.company_id}/follow", headers=_hdr(user_b))
        assert r1.status_code == 200
        assert r1.json()["following"] is True
        # verify counter
        g = requests.get(f"{BASE_URL}/api/companies/{pytest.company_id}", headers=_hdr(user_b))
        assert g.json()["followers_count"] == 1
        assert g.json()["my_following"] is True
        # toggle off
        r2 = requests.post(f"{BASE_URL}/api/companies/{pytest.company_id}/follow", headers=_hdr(user_b))
        assert r2.json()["following"] is False
        g2 = requests.get(f"{BASE_URL}/api/companies/{pytest.company_id}", headers=_hdr(user_b))
        assert g2.json()["followers_count"] == 0

    def test_soft_delete_hides_from_list(self, user_a, mongo_db):
        # Create a throwaway company then delete it
        r = requests.post(
            f"{BASE_URL}/api/companies",
            json={"name": f"TEST DeleteMe {uuid.uuid4().hex[:6]}", "vertical": "ia"},
            headers=_hdr(user_a),
        )
        cid = r.json()["id"]
        d = requests.delete(f"{BASE_URL}/api/companies/{cid}", headers=_hdr(user_a))
        assert d.status_code == 200
        lst = requests.get(f"{BASE_URL}/api/companies?vertical=ia").json()
        assert all(c["id"] != cid for c in lst["items"])

    def test_analytics_event_company_created(self, mongo_db):
        ev = mongo_db.analytics_events.find_one({"name": "company.created", "subject_id": pytest.company_id})
        assert ev is not None


# ---------------------------------------------------------------------------
# JOBS
# ---------------------------------------------------------------------------
class TestJobs:
    def test_create_job_forbidden_for_non_owner(self, user_b):
        r = requests.post(
            f"{BASE_URL}/api/jobs",
            json={
                "company_id": pytest.company_id,
                "title": "TEST Job Forbidden",
                "description": "Should fail — not company owner.",
            },
            headers=_hdr(user_b),
        )
        assert r.status_code == 403

    def test_create_job_ok_for_owner(self, user_a):
        r = requests.post(
            f"{BASE_URL}/api/jobs",
            json={
                "company_id": pytest.company_id,
                "title": "TEST Senior Lawyer",
                "description": "Wave2 test job description content.",
                "modality": "remote",
                "employment": "full_time",
                "country": "co",
                "tags": ["legal", "senior"],
            },
            headers=_hdr(user_a),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("job_")
        assert d["company_id"] == pytest.company_id
        pytest.job_id = d["id"]

    def test_list_jobs_public(self):
        r = requests.get(f"{BASE_URL}/api/jobs")
        assert r.status_code == 200
        assert any(j["id"] == pytest.job_id for j in r.json()["items"])

    def test_apply_creates_application(self, user_b):
        r = requests.post(
            f"{BASE_URL}/api/jobs/{pytest.job_id}/apply",
            json={"cover_letter": "TEST cover letter"},
            headers=_hdr(user_b),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("app_")
        assert d["status"] == "submitted"
        pytest.application_id = d["id"]

    def test_apply_twice_conflict(self, user_b):
        r = requests.post(
            f"{BASE_URL}/api/jobs/{pytest.job_id}/apply",
            json={"cover_letter": "another"},
            headers=_hdr(user_b),
        )
        assert r.status_code == 409

    def test_list_applications_owner_only(self, user_a, user_b):
        rb = requests.get(f"{BASE_URL}/api/jobs/{pytest.job_id}/applications", headers=_hdr(user_b))
        assert rb.status_code == 403
        ra = requests.get(f"{BASE_URL}/api/jobs/{pytest.job_id}/applications", headers=_hdr(user_a))
        assert ra.status_code == 200
        assert any(a["id"] == pytest.application_id for a in ra.json())

    def test_update_application_status(self, user_a):
        r = requests.patch(
            f"{BASE_URL}/api/applications/{pytest.application_id}/status",
            json={"status": "reviewing"}, headers=_hdr(user_a),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "reviewing"

    def test_me_applications(self, user_b):
        r = requests.get(f"{BASE_URL}/api/me/applications", headers=_hdr(user_b))
        assert r.status_code == 200
        assert any(a["id"] == pytest.application_id for a in r.json())

    def test_analytics_job_applied(self, mongo_db):
        ev = mongo_db.analytics_events.find_one({"name": "job.applied", "subject_id": pytest.job_id})
        assert ev is not None


# ---------------------------------------------------------------------------
# EVENTS
# ---------------------------------------------------------------------------
class TestEvents:
    def test_create_event_with_company_ownership(self, user_b):
        # Non-owner attempting company-bound event → 403
        starts = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "company_id": pytest.company_id,
                "title": "TEST Event Forbidden",
                "starts_at": starts,
                "modality": "online",
            },
            headers=_hdr(user_b),
        )
        assert r.status_code == 403

    def test_create_event_without_company(self, user_b):
        starts = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "title": "TEST Personal Meetup",
                "starts_at": starts,
                "modality": "online",
                "country": "co",
            },
            headers=_hdr(user_b),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("ev_")
        assert d["organizer_id"] == user_b["id"]
        assert d["company_id"] is None
        pytest.event_id = d["id"]

    def test_list_upcoming_only(self):
        r = requests.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        assert any(e["id"] == pytest.event_id for e in r.json()["items"])

    def test_rsvp_going_increments(self, user_a):
        r = requests.post(
            f"{BASE_URL}/api/events/{pytest.event_id}/rsvp",
            json={"status": "going"}, headers=_hdr(user_a),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "going"
        g = requests.get(f"{BASE_URL}/api/events/{pytest.event_id}", headers=_hdr(user_a))
        assert g.json()["attendees_count"] == 1
        assert g.json()["my_rsvp"] == "going"

    def test_rsvp_same_toggles_off(self, user_a):
        r = requests.post(
            f"{BASE_URL}/api/events/{pytest.event_id}/rsvp",
            json={"status": "going"}, headers=_hdr(user_a),
        )
        assert r.status_code == 200
        assert r.json()["status"] is None
        g = requests.get(f"{BASE_URL}/api/events/{pytest.event_id}", headers=_hdr(user_a))
        assert g.json()["attendees_count"] == 0

    def test_rsvp_change_going_to_interested(self, user_a):
        requests.post(
            f"{BASE_URL}/api/events/{pytest.event_id}/rsvp",
            json={"status": "going"}, headers=_hdr(user_a),
        )
        r = requests.post(
            f"{BASE_URL}/api/events/{pytest.event_id}/rsvp",
            json={"status": "interested"}, headers=_hdr(user_a),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "interested"
        g = requests.get(f"{BASE_URL}/api/events/{pytest.event_id}", headers=_hdr(user_a))
        assert g.json()["attendees_count"] == 0
        assert g.json()["interested_count"] == 1

    def test_analytics_event_rsvp(self, mongo_db):
        ev = mongo_db.analytics_events.find_one({"name": "event.rsvp", "subject_id": pytest.event_id})
        assert ev is not None


# ---------------------------------------------------------------------------
# PROFILE
# ---------------------------------------------------------------------------
class TestProfile:
    def test_get_me(self, user_a):
        r = requests.get(f"{BASE_URL}/api/community/users/me", headers=_hdr(user_a))
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == user_a["id"]
        assert "providers" in d
        assert "google" in d["providers"]

    def test_patch_me_persists(self, user_a):
        payload = {
            "headline": "Senior Engineer",
            "bio": "wave2 bio",
            "country": "co",
            "city": "Medellin",
            "skills": ["python", "react"],
            "specialties": ["backend", "systems"],
            "verticals": ["ia", "legal"],
            "languages": ["es", "en"],
            "interests": ["ai"],
            "current_company": "PC",
            "current_title": "Lead",
            "portfolio_url": "https://example.com/p",
        }
        r = requests.patch(f"{BASE_URL}/api/community/users/me", json=payload, headers=_hdr(user_a))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["headline"] == "Senior Engineer"
        assert d["skills"] == ["python", "react"]
        assert set(d["verticals"]) == {"ia", "legal"}
        # verify GET returns persisted values
        g = requests.get(f"{BASE_URL}/api/community/users/me", headers=_hdr(user_a)).json()
        assert g["bio"] == "wave2 bio"
        assert g["current_company"] == "PC"

    def test_public_profile(self, user_a):
        r = requests.get(f"{BASE_URL}/api/community/users/{user_a['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == user_a["id"]

    def test_analytics_profile_update(self, mongo_db, user_a):
        ev = mongo_db.analytics_events.find_one({"name": "user.profile_update", "actor_id": user_a["id"]})
        assert ev is not None


# ---------------------------------------------------------------------------
# ANALYTICS
# ---------------------------------------------------------------------------
class TestAnalytics:
    def test_summary_requires_admin(self, user_a):
        r = requests.get(f"{BASE_URL}/api/analytics/summary", headers=_hdr(user_a))
        assert r.status_code in (401, 403)

    def test_summary_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/analytics/summary")
        assert r.status_code in (401, 403)

    def test_summary_admin_ok(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/analytics/summary", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "totals" in d
        for k in ["users", "companies", "posts", "jobs", "events", "documents",
                  "reactions", "comments", "applications", "rsvps"]:
            assert k in d["totals"], f"missing totals.{k}"
        assert "active_users_30d" in d
        assert "today" in d
        assert "signups_by_country" in d

    def test_timeseries_admin_ok(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/analytics/timeseries?name=company.created&days=30",
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert "points" in r.json()

    def test_timeseries_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/analytics/timeseries?name=post.created")
        assert r.status_code in (401, 403)
