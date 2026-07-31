"""Wave 2.5 backend tests — Notifications, Messaging, Search, Admin Platform.

Creates two community users (actor & recipient) via direct Mongo writes and
exercises the notification dispatch paths (reaction, comment, follow, apply,
rsvp, message), search endpoints, notification CRUD/preferences, and admin
platform endpoints. Cleans up after itself.
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_test_w25_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_w25_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    mongo_db.users.insert_one({
        "id": uid,
        "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag.title()} User",
        "role": "member",
        "picture": "https://via.placeholder.com/64",
        "auth_providers": [{"provider": "google", "provider_user_id": f"g_{uid}", "linked_at": now}],
        "created_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": token,
        "provider": "google",
        # far in the future
        "expires_at": "2099-01-01T00:00:00+00:00",
        "created_at": now,
    })
    return {"id": uid, "token": token, "cookie": {"session_token": token},
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def users(mongo_db):
    a = _mk_user(mongo_db, "actor")
    b = _mk_user(mongo_db, "recip")
    yield {"a": a, "b": b}
    # Cleanup
    for u in (a, b):
        mongo_db.users.delete_many({"id": u["id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["id"]})
        mongo_db.notifications.delete_many({"recipient_id": u["id"]})
        mongo_db.notification_preferences.delete_many({"user_id": u["id"]})
        mongo_db.company_follows.delete_many({"user_id": u["id"]})
        mongo_db.post_saves.delete_many({"user_id": u["id"]})
        mongo_db.post_reactions.delete_many({"user_id": u["id"]})


@pytest.fixture(scope="module")
def cleanup_created(mongo_db):
    tracker = {"companies": [], "posts": [], "jobs": [], "events": [],
               "conversations": [], "messages": [], "applications": [], "rsvps": []}
    yield tracker
    try:
        if tracker["companies"]:
            mongo_db.companies.delete_many({"id": {"$in": tracker["companies"]}})
            mongo_db.company_follows.delete_many({"company_id": {"$in": tracker["companies"]}})
        if tracker["posts"]:
            mongo_db.posts.delete_many({"id": {"$in": tracker["posts"]}})
            mongo_db.post_reactions.delete_many({"post_id": {"$in": tracker["posts"]}})
            mongo_db.post_comments.delete_many({"post_id": {"$in": tracker["posts"]}})
        if tracker["jobs"]:
            mongo_db.jobs.delete_many({"id": {"$in": tracker["jobs"]}})
            mongo_db.job_applications.delete_many({"job_id": {"$in": tracker["jobs"]}})
        if tracker["events"]:
            mongo_db.events.delete_many({"id": {"$in": tracker["events"]}})
            mongo_db.event_rsvps.delete_many({"event_id": {"$in": tracker["events"]}})
        if tracker["conversations"]:
            mongo_db.conversations.delete_many({"id": {"$in": tracker["conversations"]}})
            mongo_db.chat_messages.delete_many({"conversation_id": {"$in": tracker["conversations"]}})
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 1. Notifications: auth guards + basic list shape
# ---------------------------------------------------------------------------
class TestNotificationsAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 401

    def test_prefs_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/notifications/preferences")
        assert r.status_code == 401

    def test_list_empty_shape(self, users):
        r = requests.get(f"{BASE_URL}/api/notifications", cookies=users["b"]["cookie"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "unread" in data and "next_cursor" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["unread"], int)


# ---------------------------------------------------------------------------
# 2. Notification dispatch — reaction & comment on someone else's post
# ---------------------------------------------------------------------------
class TestReactionCommentNotifications:
    def test_reaction_generates_notification_for_recipient(self, users, cleanup_created):
        b = users["b"]; a = users["a"]
        # B (recipient) creates a post
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "TEST post by B #wave25", "category_key": "comunidad"},
                          cookies=b["cookie"])
        assert r.status_code == 200, r.text
        post = r.json()
        post_id = post["id"]
        cleanup_created["posts"].append(post_id)

        # A reacts
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react",
                          json={"kind": "like"}, cookies=a["cookie"])
        assert r.status_code == 200, r.text

        # B should have a reaction notification
        time.sleep(0.5)
        r = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"])
        assert r.status_code == 200
        data = r.json()
        kinds = [n["kind"] for n in data["items"]]
        assert "reaction" in kinds
        # find that item
        item = next(n for n in data["items"] if n["kind"] == "reaction")
        assert item["actor_id"] == a["id"]
        assert item["subject_id"] == post_id
        assert item["is_read"] is False

    def test_self_reaction_does_not_notify(self, users, cleanup_created):
        b = users["b"]
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "TEST self post", "category_key": "comunidad"},
                          cookies=b["cookie"])
        assert r.status_code == 200
        post_id = r.json()["id"]
        cleanup_created["posts"].append(post_id)

        before = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["unread"]
        # B reacts to own post
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react",
                          json={"kind": "insight"}, cookies=b["cookie"])
        assert r.status_code == 200
        time.sleep(0.3)
        after = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["unread"]
        assert after == before  # no self-notification

    def test_comment_generates_notification(self, users, cleanup_created):
        b = users["b"]; a = users["a"]
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "TEST post for comment", "category_key": "comunidad"},
                          cookies=b["cookie"])
        post_id = r.json()["id"]
        cleanup_created["posts"].append(post_id)

        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/comments",
                          json={"body": "great post!"}, cookies=a["cookie"])
        assert r.status_code == 200, r.text
        time.sleep(0.4)
        data = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()
        assert any(n["kind"] == "comment" and n["subject_id"] == post_id for n in data["items"])


# ---------------------------------------------------------------------------
# 3. Notification dispatch — follow, apply, rsvp
# ---------------------------------------------------------------------------
class TestBusinessNotifications:
    def test_follow_company_notifies_owner(self, users, cleanup_created):
        # B creates a company; A follows it → B gets a "follower" notification
        b = users["b"]; a = users["a"]
        r = requests.post(f"{BASE_URL}/api/companies",
                          json={"name": f"TEST W25 Co {uuid.uuid4().hex[:6]}",
                                "tagline": "test", "description": "d",
                                "vertical": "empresas", "country": "co"},
                          cookies=b["cookie"])
        assert r.status_code == 200, r.text
        company = r.json()
        cleanup_created["companies"].append(company["id"])

        r = requests.post(f"{BASE_URL}/api/companies/{company['id']}/follow",
                          cookies=a["cookie"])
        assert r.status_code == 200
        assert r.json()["following"] is True
        time.sleep(0.4)
        data = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()
        assert any(n["kind"] == "follower" and n["subject_id"] == company["id"] for n in data["items"])

    def test_job_apply_notifies_owner(self, users, cleanup_created):
        b = users["b"]; a = users["a"]
        # B owns a company + a job
        c = requests.post(f"{BASE_URL}/api/companies",
                          json={"name": f"TEST W25 JobCo {uuid.uuid4().hex[:6]}",
                                "tagline": "t", "description": "d",
                                "vertical": "empresas", "country": "co"},
                          cookies=b["cookie"]).json()
        cleanup_created["companies"].append(c["id"])
        j = requests.post(f"{BASE_URL}/api/jobs",
                          json={"company_id": c["id"], "title": "TEST Dev",
                                "description": "job description with enough length", "modality": "remote",
                                "location": "remote"},
                          cookies=b["cookie"])
        assert j.status_code == 200, j.text
        job = j.json()
        cleanup_created["jobs"].append(job["id"])
        # A applies
        r = requests.post(f"{BASE_URL}/api/jobs/{job['id']}/apply",
                          json={"note": "hi"}, cookies=a["cookie"])
        assert r.status_code in (200, 201), r.text
        time.sleep(0.4)
        data = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()
        assert any(n["kind"] == "application" for n in data["items"]), \
            f"expected 'application' notification. Got: {[n['kind'] for n in data['items']]}"

    def test_rsvp_going_notifies_organizer(self, users, cleanup_created):
        b = users["b"]; a = users["a"]
        # B creates an event (personal, no company). Event is public + future.
        starts_at = "2099-06-01T10:00:00+00:00"
        ends_at = "2099-06-01T12:00:00+00:00"
        r = requests.post(f"{BASE_URL}/api/events",
                          json={"title": "TEST W25 Event", "description": "d",
                                "starts_at": starts_at, "ends_at": ends_at,
                                "modality": "online", "location": "https://zoom",
                                "is_public": True},
                          cookies=b["cookie"])
        assert r.status_code == 200, r.text
        ev = r.json()
        cleanup_created["events"].append(ev["id"])
        # A RSVPs going
        r = requests.post(f"{BASE_URL}/api/events/{ev['id']}/rsvp",
                          json={"status": "going"}, cookies=a["cookie"])
        assert r.status_code == 200, r.text
        time.sleep(0.4)
        data = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()
        assert any(n["kind"] == "rsvp" and n["subject_id"] == ev["id"] for n in data["items"]), \
            f"expected 'rsvp' kind. Got: {[n['kind'] for n in data['items']]}"


# ---------------------------------------------------------------------------
# 4. Notification CRUD + preferences
# ---------------------------------------------------------------------------
class TestNotificationCRUD:
    def test_mark_read_and_unread(self, users):
        b = users["b"]
        items = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]
        assert items, "expected some notifications from earlier tests"
        nid = items[0]["id"]
        r = requests.post(f"{BASE_URL}/api/notifications/{nid}/read", cookies=b["cookie"])
        assert r.status_code == 200
        n = next((x for x in requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]
                  if x["id"] == nid), None)
        assert n and n["is_read"] is True
        # flip back
        r = requests.post(f"{BASE_URL}/api/notifications/{nid}/read?unread=true", cookies=b["cookie"])
        assert r.status_code == 200
        n = next((x for x in requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]
                  if x["id"] == nid), None)
        assert n and n["is_read"] is False

    def test_mark_all_read(self, users):
        b = users["b"]
        r = requests.post(f"{BASE_URL}/api/notifications/mark-all-read", cookies=b["cookie"])
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["unread"] == 0

    def test_delete(self, users):
        b = users["b"]
        items = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]
        if not items:
            pytest.skip("no notifications to delete")
        nid = items[0]["id"]
        r = requests.delete(f"{BASE_URL}/api/notifications/{nid}", cookies=b["cookie"])
        assert r.status_code == 200
        remaining_ids = [x["id"] for x in requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]]
        assert nid not in remaining_ids

    def test_preferences_persist(self, users):
        a = users["a"]
        r = requests.patch(f"{BASE_URL}/api/notifications/preferences",
                           json={"disabled_kinds": ["reaction"],
                                 "channels": {"in_app": True, "email": False, "push": False, "realtime": True}},
                           cookies=a["cookie"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reaction" in data["disabled_kinds"]
        # Re-fetch
        got = requests.get(f"{BASE_URL}/api/notifications/preferences", cookies=a["cookie"]).json()
        assert "reaction" in got["disabled_kinds"]


# ---------------------------------------------------------------------------
# 5. Messaging
# ---------------------------------------------------------------------------
class TestMessaging:
    def test_dm_idempotent_create(self, users, cleanup_created):
        a = users["a"]; b = users["b"]
        payload = {"kind": "dm", "participants": [{"id": b["id"], "kind": "user", "name": "TEST Recip"}]}
        r1 = requests.post(f"{BASE_URL}/api/messages/conversations",
                           json=payload, cookies=a["cookie"])
        assert r1.status_code == 200, r1.text
        c1 = r1.json()
        cleanup_created["conversations"].append(c1["id"])
        r2 = requests.post(f"{BASE_URL}/api/messages/conversations",
                           json=payload, cookies=a["cookie"])
        assert r2.status_code == 200
        assert r2.json()["id"] == c1["id"], "DM must be idempotent by participant set"

    def test_send_message_and_notify(self, users, cleanup_created):
        a = users["a"]; b = users["b"]
        payload = {"kind": "dm", "participants": [{"id": b["id"], "kind": "user", "name": "TEST Recip"}]}
        conv = requests.post(f"{BASE_URL}/api/messages/conversations",
                             json=payload, cookies=a["cookie"]).json()
        if conv["id"] not in cleanup_created["conversations"]:
            cleanup_created["conversations"].append(conv["id"])
        r = requests.post(f"{BASE_URL}/api/messages/conversations/{conv['id']}/messages",
                          json={"body": "hola"}, cookies=a["cookie"])
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["body"] == "hola"

        # B's conversation list should show it with unread_count > 0
        convs = requests.get(f"{BASE_URL}/api/messages/conversations", cookies=b["cookie"]).json()["items"]
        found = next((c for c in convs if c["id"] == conv["id"]), None)
        assert found is not None
        assert found["unread_count"] >= 1
        assert found["last_message"] and found["last_message"]["body"] == "hola"

        # B fetches messages → marks as read
        msgs = requests.get(f"{BASE_URL}/api/messages/conversations/{conv['id']}/messages",
                            cookies=b["cookie"]).json()
        assert any(m["id"] == msg["id"] for m in msgs)
        convs2 = requests.get(f"{BASE_URL}/api/messages/conversations", cookies=b["cookie"]).json()["items"]
        found2 = next(c for c in convs2 if c["id"] == conv["id"])
        assert found2["unread_count"] == 0

        # B should have received a "message" notification
        time.sleep(0.3)
        notifs = requests.get(f"{BASE_URL}/api/notifications", cookies=b["cookie"]).json()["items"]
        assert any(n["kind"] == "message" and n["subject_id"] == conv["id"] for n in notifs)


# ---------------------------------------------------------------------------
# 6. Search
# ---------------------------------------------------------------------------
class TestSearch:
    def test_search_shape(self):
        r = requests.get(f"{BASE_URL}/api/search", params={"q": "legal"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["q"] == "legal"
        assert "total" in data
        assert "by_type" in data
        for k in ("people", "companies", "posts", "jobs", "events", "hashtags", "categories"):
            assert k in data["by_type"]
        # each result should have {type, id, title, url}
        for arr in data["by_type"].values():
            for r_ in arr:
                assert set(["type", "id", "title", "url"]).issubset(r_.keys())

    def test_search_case_insensitive(self, users, cleanup_created):
        # Create a company with distinctive name via user A
        a = users["a"]
        name = f"TESTUNIQUE Acme {uuid.uuid4().hex[:6]}"
        c = requests.post(f"{BASE_URL}/api/companies",
                          json={"name": name, "tagline": "x", "description": "d",
                                "vertical": "empresas", "country": "co"},
                          cookies=a["cookie"]).json()
        cleanup_created["companies"].append(c["id"])
        # search lowercase
        r = requests.get(f"{BASE_URL}/api/search",
                         params={"q": "testunique", "types": "companies"}).json()
        titles = [x["title"] for x in r["by_type"]["companies"]]
        assert any(name in t for t in titles), f"expected {name} in {titles}"

    def test_suggest_only_returns_light_types(self):
        r = requests.get(f"{BASE_URL}/api/search/suggest", params={"q": "a"})
        assert r.status_code == 200
        data = r.json()
        keys = set(data["by_type"].keys())
        assert keys == {"people", "companies", "hashtags"}


# ---------------------------------------------------------------------------
# 7. Admin platform endpoints
# ---------------------------------------------------------------------------
class TestAdminPlatform:
    ENDPOINTS = ["users", "companies", "posts", "jobs", "events", "reports", "activity", "documents"]

    def test_all_require_auth(self):
        for ep in self.ENDPOINTS:
            r = requests.get(f"{BASE_URL}/api/admin/{ep}")
            assert r.status_code in (401, 403), f"{ep} → {r.status_code}"

    def test_non_admin_forbidden(self, users):
        # Community cookie is NOT an admin JWT
        for ep in self.ENDPOINTS:
            r = requests.get(f"{BASE_URL}/api/admin/{ep}", cookies=users["a"]["cookie"])
            assert r.status_code in (401, 403), f"{ep} with community cookie → {r.status_code}"

    def test_admin_can_list(self, admin_headers):
        for ep in self.ENDPOINTS:
            r = requests.get(f"{BASE_URL}/api/admin/{ep}", headers=admin_headers)
            assert r.status_code == 200, f"{ep} → {r.status_code}: {r.text[:120]}"
            assert isinstance(r.json(), list)

    def test_update_user_role(self, admin_headers, users, mongo_db):
        uid = users["a"]["id"]
        original_role = mongo_db.users.find_one({"id": uid}).get("role")
        r = requests.patch(f"{BASE_URL}/api/admin/users/{uid}/role",
                           json={"role": "moderator"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert mongo_db.users.find_one({"id": uid})["role"] == "moderator"
        # restore
        mongo_db.users.update_one({"id": uid}, {"$set": {"role": original_role or "member"}})
