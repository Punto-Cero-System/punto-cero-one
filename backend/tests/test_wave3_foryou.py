"""Wave 3E backend tests — "Para Ti" personalized feed engine.

Covers:
  1. Anonymous request degrades to CHRONOLOGICAL and never crashes.
  2. Authenticated user with matching verticals sees follow-based ranking.
  3. Post authored by a followed-company owner ranks above unrelated recent posts.
  4. Signals summary is populated with the user's verticals + interaction counts.
"""
from __future__ import annotations

import os
import time
import uuid
import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


def _mk_user(mongo_db, tag: str, extra: dict | None = None) -> dict:
    uid = f"user_test_w3e_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_w3e_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    doc = {
        "id": uid, "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag} W3E", "role": "member",
        "created_at": now,
    }
    if extra:
        doc.update(extra)
    mongo_db.users.insert_one(doc)
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token, "provider": "google",
        "expires_at": "2099-01-01T00:00:00+00:00", "created_at": now,
    })
    return {"id": uid, "cookie": {"session_token": token}}


@pytest.fixture(scope="module")
def users_and_content(mongo_db):
    # curator (author) — writes posts
    curator = _mk_user(mongo_db, "curator")
    # viewer — has interest in "medicina" vertical, follows a company owned by curator
    viewer = _mk_user(mongo_db, "viewer", extra={"verticals": ["medicina"], "interests": ["salud"]})

    tracker = {"users": [curator["id"], viewer["id"]],
               "companies": [], "posts": []}

    # curator publishes a medicina post
    p1 = requests.post(f"{BASE_URL}/api/feed/posts",
                       json={"body": "Post relevante para viewer #salud", "category_key": "medicina"},
                       cookies=curator["cookie"])
    assert p1.status_code == 200, p1.text
    tracker["posts"].append(p1.json()["id"])
    matched_post_id = p1.json()["id"]

    # curator also publishes an unrelated post
    p2 = requests.post(f"{BASE_URL}/api/feed/posts",
                       json={"body": "Otro post cualquiera #general", "category_key": "comunidad"},
                       cookies=curator["cookie"])
    assert p2.status_code == 200
    tracker["posts"].append(p2.json()["id"])

    # A THIRD user (background noise) posts something unrelated
    other = _mk_user(mongo_db, "noise")
    tracker["users"].append(other["id"])
    p3 = requests.post(f"{BASE_URL}/api/feed/posts",
                       json={"body": "Publicación aleatoria de otra persona", "category_key": "comunidad"},
                       cookies=other["cookie"])
    assert p3.status_code == 200
    tracker["posts"].append(p3.json()["id"])

    # viewer follows a company owned by curator
    c = requests.post(f"{BASE_URL}/api/companies",
                      json={"name": f"TEST W3E FollowCo {uuid.uuid4().hex[:6]}",
                            "tagline": "t", "description": "d",
                            "vertical": "medicina", "country": "co"},
                      cookies=curator["cookie"]).json()
    tracker["companies"].append(c["id"])
    r = requests.post(f"{BASE_URL}/api/companies/{c['id']}/follow", cookies=viewer["cookie"])
    assert r.status_code == 200

    yield {"curator": curator, "viewer": viewer, "matched_post_id": matched_post_id,
           "unrelated_post_id": tracker["posts"][1], "noise_post_id": tracker["posts"][2]}

    # cleanup
    for uid in tracker["users"]:
        mongo_db.users.delete_many({"id": uid})
        mongo_db.user_sessions.delete_many({"user_id": uid})
        mongo_db.post_reactions.delete_many({"user_id": uid})
        mongo_db.post_saves.delete_many({"user_id": uid})
        mongo_db.post_comments.delete_many({"author_id": uid})
    if tracker["companies"]:
        mongo_db.companies.delete_many({"id": {"$in": tracker["companies"]}})
        mongo_db.company_follows.delete_many({"company_id": {"$in": tracker["companies"]}})
    if tracker["posts"]:
        mongo_db.posts.delete_many({"id": {"$in": tracker["posts"]}})


class TestForYouAnon:
    def test_anon_falls_back_to_chronological(self):
        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=5")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "CHRONOLOGICAL"
        assert isinstance(d["items"], list)
        assert d["signals_summary"] == {}


class TestForYouPersonalized:
    def test_authed_response_shape(self, users_and_content):
        viewer = users_and_content["viewer"]
        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=10", cookies=viewer["cookie"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] in ("CHRONOLOGICAL", "FOLLOW_BASED", "TRENDING", "AI_RECOMMENDED")
        for item in d["items"]:
            assert "for_you" in item
            assert "score" in item["for_you"]
            assert "reasons" in item["for_you"]

    def test_signals_summary_populated(self, users_and_content):
        viewer = users_and_content["viewer"]
        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=10", cookies=viewer["cookie"]).json()
        summary = r["signals_summary"]
        assert "medicina" in summary["verticals"]
        assert summary["followed_companies"] >= 1

    def test_matched_post_ranks_above_noise(self, users_and_content):
        viewer = users_and_content["viewer"]
        matched = users_and_content["matched_post_id"]
        noise = users_and_content["noise_post_id"]
        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=30", cookies=viewer["cookie"]).json()
        ids = [it["id"] for it in r["items"]]
        # Both should appear (they're recent)
        assert matched in ids, f"matched post missing from feed: {ids[:10]}"
        assert noise in ids, f"noise post missing from feed: {ids[:10]}"
        # matched should come first
        assert ids.index(matched) < ids.index(noise), \
            f"expected matched < noise. Got positions: matched={ids.index(matched)}, noise={ids.index(noise)}"

    def test_reasons_include_follow_and_vertical(self, users_and_content):
        viewer = users_and_content["viewer"]
        matched = users_and_content["matched_post_id"]
        r = requests.get(f"{BASE_URL}/api/feed/for-you?limit=30", cookies=viewer["cookie"]).json()
        it = next((x for x in r["items"] if x["id"] == matched), None)
        assert it is not None
        reasons = it["for_you"]["reasons"]
        joined = " ".join(reasons).lower()
        # Expected two signals: company follow + vertical match
        assert "seguida" in joined or "empresa" in joined
        assert "vertical" in joined
        assert it["for_you"]["score"] > 0
