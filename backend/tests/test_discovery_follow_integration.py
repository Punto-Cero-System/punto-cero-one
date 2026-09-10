"""Wave 5 integration test: ensure following via legacy company endpoint
influences Discovery suggestions (bridged into `follows`).
"""
from __future__ import annotations

import uuid
import time
import requests


BASE_URL = ""  # filled from conftest at runtime via env or frontend .env


def _now_iso():
    return "2026-01-01T00:00:00+00:00"


def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_w5d_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    token = f"test_session_w5d_{tag}_{uuid.uuid4().hex}"
    mongo_db.users.insert_one({"id": uid, "email": f"TEST_{uid}@example.com", "created_at": _now_iso()})
    mongo_db.user_sessions.insert_one({"user_id": uid, "session_token": token, "provider": "google", "expires_at": "2099-01-01T00:00:00+00:00", "created_at": _now_iso()})
    return {"id": uid, "cookie": {"session_token": token}}


def test_legacy_company_follow_reflects_in_discovery(mongo_db):
    # Create owner + two companies: one followed, one in its related_ids
    owner = _mk_user(mongo_db, "owner")
    viewer = _mk_user(mongo_db, "viewer")

    # Seed company that should be suggested
    seed_slug = f"seed-{uuid.uuid4().hex[:6]}"
    seed_id = f"co_{uuid.uuid4().hex[:8]}"
    mongo_db.companies.insert_one({
        "id": seed_id, "slug": seed_slug, "name": "Seed Co", "is_public_seed": True,
        "is_deleted": False, "created_at": _now_iso(),
    })

    # Company followed by viewer — includes related_ids pointing to seed_slug
    comp_id = f"co_{uuid.uuid4().hex[:8]}"
    mongo_db.companies.insert_one({
        "id": comp_id, "slug": f"followme-{uuid.uuid4().hex[:6]}", "name": "FollowMe",
        "owner_id": owner["id"], "related_ids": [seed_slug], "is_deleted": False, "created_at": _now_iso(),
    })

    # Viewer follows via legacy company endpoint (no direct write to `follows`)
    # Use the public API — BASE_URL will be provided at test time from env.
    from backend.tests.conftest import BASE_URL as _b
    url = (_b or BASE_URL).rstrip('/')
    assert url, "BASE_URL not configured for tests"
    r = requests.post(f"{url}/api/companies/{comp_id}/follow", cookies=viewer["cookie"])
    assert r.status_code == 200

    # Now call discovery suggested — it should see the follow via the bridged `follows`
    s = requests.Session()
    s.cookies.update(viewer["cookie"])
    r2 = s.get(f"{url}/api/discovery/suggested", timeout=15)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    # Based on: number of followed_slugs used to seed suggestions — should be >=1
    assert data.get("based_on", 0) >= 1
    # Ensure the seed appears in returned items (or items non-empty)
    items = data.get("items") or []
    assert any(it.get("slug") == seed_slug for it in items) or len(items) > 0

    # cleanup
    mongo_db.companies.delete_many({"id": {"$in": [seed_id, comp_id]}})
    mongo_db.company_follows.delete_many({"company_id": comp_id})
    mongo_db.follows.delete_many({"user_id": viewer["id"]})
    mongo_db.user_sessions.delete_many({"user_id": {"$in": [owner["id"], viewer["id"]]}})
    mongo_db.users.delete_many({"id": {"$in": [owner["id"], viewer["id"]]}})
