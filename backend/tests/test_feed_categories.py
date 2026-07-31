"""Backend tests for Wave 1 GO LIVE: feed, categories, document counters+signed links.

Covers /api/feed/*, /api/categories/*, and the new /api/documents/{id}/download-link
+ /api/documents/signed/{token} + /api/documents/{id}/view counters.
"""
import os
import time
import uuid
import io
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break


# --------------------------------------------------------------------------- #
# Fixtures                                                                    #
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def community_session(mongo_db):
    """Create a temporary community user + session_token."""
    uid = f"TESTFEEDUSR_{uuid.uuid4().hex[:8]}"
    token = f"TESTFEEDSESS_{uuid.uuid4().hex[:12]}"
    mongo_db.users.insert_one({
        "id": uid,
        "email": f"testfeed+{uid}@example.com",
        "name": "Feed Tester",
        "role": "member",
        "picture": "https://via.placeholder.com/64",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": token,
        "provider": "google",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"user_id": uid, "token": token}
    # cleanup
    mongo_db.user_sessions.delete_many({"session_token": token})
    mongo_db.users.delete_many({"id": uid})
    mongo_db.posts.delete_many({"author_id": uid})
    mongo_db.post_comments.delete_many({"author_id": uid})
    mongo_db.post_reactions.delete_many({"user_id": uid})
    mongo_db.post_saves.delete_many({"user_id": uid})


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# FEED — auth requirements                                                    #
# --------------------------------------------------------------------------- #
class TestFeedAuthAndCreate:
    def test_create_post_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/feed/posts", json={"body": "hola"})
        assert r.status_code == 401

    def test_list_posts_public_200(self):
        r = requests.get(f"{BASE_URL}/api/feed/posts?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data

    def test_create_post_hashtags(self, community_session):
        r = requests.post(
            f"{BASE_URL}/api/feed/posts",
            json={"body": "Hola #Test #IA"},
            headers=_bearer(community_session["token"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"].startswith("post_")
        assert sorted(data["hashtags"]) == ["ia", "test"]
        assert data["author"]["id"] == community_session["user_id"]


# --------------------------------------------------------------------------- #
# FEED — reactions toggle                                                     #
# --------------------------------------------------------------------------- #
class TestFeedReactions:
    @pytest.fixture(scope="class")
    def post_id(self, community_session):
        r = requests.post(
            f"{BASE_URL}/api/feed/posts",
            json={"body": "Post para reacciones"},
            headers=_bearer(community_session["token"]),
        )
        assert r.status_code == 200
        return r.json()["id"]

    def test_react_unauth_401(self, post_id):
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react", json={"kind": "like"})
        assert r.status_code == 401

    def test_react_like_then_toggle_then_switch(self, community_session, post_id):
        h = _bearer(community_session["token"])
        # add like
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react", json={"kind": "like"}, headers=h)
        assert r.status_code == 200 and r.json()["reacted"] is True
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}", headers=h).json()
        assert p["counts"]["reactions"] == 1
        assert p["reactions_by_kind"].get("like") == 1
        # toggle off
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react", json={"kind": "like"}, headers=h)
        assert r.json()["reacted"] is False
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}", headers=h).json()
        assert p["counts"]["reactions"] == 0
        # add insight
        requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react", json={"kind": "like"}, headers=h)
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/react", json={"kind": "insight"}, headers=h)
        assert r.json().get("kind") == "insight"
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}", headers=h).json()
        assert p["reactions_by_kind"].get("insight", 0) == 1
        assert p["reactions_by_kind"].get("like", 0) == 0


# --------------------------------------------------------------------------- #
# FEED — comments, save, view, share, delete                                  #
# --------------------------------------------------------------------------- #
class TestFeedInteractions:
    @pytest.fixture(scope="class")
    def post_id(self, community_session):
        r = requests.post(
            f"{BASE_URL}/api/feed/posts",
            json={"body": "Post interactions"},
            headers=_bearer(community_session["token"]),
        )
        return r.json()["id"]

    def test_comment_flow(self, community_session, post_id):
        h = _bearer(community_session["token"])
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/comments",
                          json={"body": "Excelente"}, headers=h)
        assert r.status_code == 200
        assert r.json()["body"] == "Excelente"
        r = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}/comments")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(c["body"] == "Excelente" for c in items)
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}").json()
        assert p["counts"]["comments"] >= 1

    def test_comment_unauth_401(self, post_id):
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/comments", json={"body": "x"})
        assert r.status_code == 401

    def test_save_toggle(self, community_session, post_id):
        h = _bearer(community_session["token"])
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/save", headers=h)
        assert r.json()["saved"] is True
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}", headers=h).json()
        assert p["my_saved"] is True and p["counts"]["saves"] == 1
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/save", headers=h)
        assert r.json()["saved"] is False

    def test_save_unauth_401(self, post_id):
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/save")
        assert r.status_code == 401

    def test_view_dedup(self, post_id):
        sid = f"sess_{uuid.uuid4().hex[:8]}"
        r1 = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/view", json={"session_id": sid})
        assert r1.status_code == 200 and r1.json()["counted"] is True
        r2 = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/view", json={"session_id": sid})
        assert r2.json()["counted"] is False

    def test_share(self, post_id):
        r = requests.post(f"{BASE_URL}/api/feed/posts/{post_id}/share",
                          json={"destination": "whatsapp"})
        assert r.status_code == 200
        p = requests.get(f"{BASE_URL}/api/feed/posts/{post_id}").json()
        assert p["counts"]["shares"] >= 1

    def test_delete_by_author(self, community_session, post_id):
        h = _bearer(community_session["token"])
        r = requests.delete(f"{BASE_URL}/api/feed/posts/{post_id}", headers=h)
        assert r.status_code == 200
        # public list should not contain it
        r = requests.get(f"{BASE_URL}/api/feed/posts?limit=50")
        assert not any(p["id"] == post_id for p in r.json()["items"])


# --------------------------------------------------------------------------- #
# FEED — pagination + filters                                                 #
# --------------------------------------------------------------------------- #
class TestFeedListing:
    def test_pagination_and_category_filter(self, community_session):
        h = _bearer(community_session["token"])
        ids = []
        for i in range(3):
            r = requests.post(
                f"{BASE_URL}/api/feed/posts",
                json={"body": f"Paginación item {i}", "category_key": "ia"},
                headers=h,
            )
            ids.append(r.json()["id"])
            time.sleep(0.05)
        # filter by category
        r = requests.get(f"{BASE_URL}/api/feed/posts?category_key=ia&limit=50")
        found = [p["id"] for p in r.json()["items"]]
        assert all(i in found for i in ids)
        # pagination
        r = requests.get(f"{BASE_URL}/api/feed/posts?limit=2")
        data = r.json()
        assert len(data["items"]) == 2
        if data.get("next_cursor"):
            r2 = requests.get(f"{BASE_URL}/api/feed/posts?limit=2&cursor={data['next_cursor']}")
            assert r2.status_code == 200
            first_ids = {p["id"] for p in data["items"]}
            second_ids = {p["id"] for p in r2.json()["items"]}
            assert first_ids.isdisjoint(second_ids)

    def test_trending(self, community_session):
        h = _bearer(community_session["token"])
        tag = f"testtrend{uuid.uuid4().hex[:4]}"
        for _ in range(3):
            requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": f"Trend #{tag}"}, headers=h)
        r = requests.get(f"{BASE_URL}/api/feed/trending?limit=30")
        assert r.status_code == 200
        tags = {h["tag"]: h for h in r.json()["hashtags"]}
        assert tag.lower() in tags
        assert tags[tag.lower()]["posts_7d"] >= 3


# --------------------------------------------------------------------------- #
# FEED — moderation                                                           #
# --------------------------------------------------------------------------- #
class TestFeedModeration:
    def test_admin_can_hide_and_member_cannot(self, community_session, admin_headers):
        h = _bearer(community_session["token"])
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "Moderation target"}, headers=h)
        pid = r.json()["id"]
        # member forbidden
        r = requests.patch(f"{BASE_URL}/api/feed/posts/{pid}/moderation",
                           json={"status": "hidden"}, headers=h)
        assert r.status_code in (401, 403)
        # admin ok
        r = requests.patch(f"{BASE_URL}/api/feed/posts/{pid}/moderation",
                           json={"status": "hidden"}, headers=admin_headers)
        assert r.status_code == 200

    def test_report_anonymous_and_admin_lists(self, community_session, admin_headers):
        h = _bearer(community_session["token"])
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "Reportable"}, headers=h)
        pid = r.json()["id"]
        r = requests.post(f"{BASE_URL}/api/feed/posts/{pid}/report",
                          json={"reason": "spam prueba"})
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/feed/reports", headers=admin_headers)
        assert r.status_code == 200
        assert any(rep.get("post_id") == pid for rep in r.json())


# --------------------------------------------------------------------------- #
# CATEGORIES                                                                  #
# --------------------------------------------------------------------------- #
class TestCategories:
    def test_public_list_contains_seeds(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        keys = {c["key"] for c in r.json()}
        verticals = {"legal", "ia", "capital", "empresas", "comunidad", "eventos",
                     "empleos", "marketplace", "noticias", "videos",
                     "medicina", "contabilidad", "educacion"}
        geo = {"co", "mx", "ar", "cl", "pe", "br"}
        assert verticals.issubset(keys), f"missing: {verticals - keys}"
        assert geo.issubset(keys), f"missing geo: {geo - keys}"

    def test_admin_upsert_and_soft_delete(self, admin_headers, mongo_db):
        # upsert
        r = requests.post(f"{BASE_URL}/api/categories",
                          json={"key": "fintechtest", "label": "FintechTest"},
                          headers=admin_headers)
        assert r.status_code == 200
        # idempotent
        r = requests.post(f"{BASE_URL}/api/categories",
                          json={"key": "fintechtest", "label": "FintechTest Updated"},
                          headers=admin_headers)
        assert r.status_code == 200
        cats = requests.get(f"{BASE_URL}/api/categories").json()
        matches = [c for c in cats if c["key"] == "fintechtest"]
        assert len(matches) == 1 and matches[0]["label"] == "FintechTest Updated"
        # delete → inactive
        r = requests.delete(f"{BASE_URL}/api/categories/fintechtest", headers=admin_headers)
        assert r.status_code == 200
        cats_active = requests.get(f"{BASE_URL}/api/categories?active_only=true").json()
        assert not any(c["key"] == "fintechtest" for c in cats_active)
        cats_all = requests.get(f"{BASE_URL}/api/categories?active_only=false").json()
        assert any(c["key"] == "fintechtest" for c in cats_all)
        # cleanup
        mongo_db.categories.delete_many({"key": "fintechtest"})

    def test_upsert_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/categories",
                          json={"key": "unauthcat", "label": "x"})
        assert r.status_code in (401, 403)


# --------------------------------------------------------------------------- #
# DOCUMENTS — counters + signed links                                         #
# --------------------------------------------------------------------------- #
class TestDocumentsCountersAndSignedLinks:
    @pytest.fixture(scope="class")
    def uploaded_doc(self, admin_headers, mongo_db):
        # multipart upload
        files = {"file": ("counter_test.txt", b"hello counters", "text/plain")}
        data = {"category": "other", "vertical": "shared"}
        auth_only = {"Authorization": admin_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/documents/upload",
                          files=files, data=data, headers=auth_only)
        assert r.status_code == 200, r.text
        doc = r.json()
        yield doc
        mongo_db.documents.delete_many({"id": doc["id"]})
        mongo_db.document_signed_links.delete_many({"document_id": doc["id"]})

    def test_download_increments_counter(self, admin_headers, uploaded_doc):
        did = uploaded_doc["id"]
        r = requests.get(f"{BASE_URL}/api/documents/{did}/download", headers=admin_headers)
        assert r.status_code == 200
        meta = requests.get(f"{BASE_URL}/api/documents/{did}", headers=admin_headers).json()
        assert meta.get("download_count", 0) >= 1

    def test_view_increments_counter(self, admin_headers, uploaded_doc):
        did = uploaded_doc["id"]
        r = requests.post(f"{BASE_URL}/api/documents/{did}/view", headers=admin_headers)
        assert r.status_code == 200
        meta = requests.get(f"{BASE_URL}/api/documents/{did}", headers=admin_headers).json()
        assert meta.get("view_count", 0) >= 1

    def test_signed_link_one_shot(self, admin_headers, uploaded_doc):
        did = uploaded_doc["id"]
        r = requests.post(f"{BASE_URL}/api/documents/{did}/download-link",
                          headers=admin_headers)
        assert r.status_code == 200
        payload = r.json()
        assert "token" in payload and "url" in payload and "expires_at" in payload
        token = payload["token"]
        # 1st redemption ok
        r1 = requests.get(f"{BASE_URL}/api/documents/signed/{token}", allow_redirects=False)
        assert r1.status_code == 200
        # 2nd redemption gone
        r2 = requests.get(f"{BASE_URL}/api/documents/signed/{token}")
        assert r2.status_code == 410

    def test_signed_link_expired(self, admin_headers, uploaded_doc, mongo_db):
        did = uploaded_doc["id"]
        r = requests.post(f"{BASE_URL}/api/documents/{did}/download-link",
                          headers=admin_headers)
        token = r.json()["token"]
        # manually expire
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        mongo_db.document_signed_links.update_one(
            {"token": token}, {"$set": {"expires_at": past}}
        )
        r = requests.get(f"{BASE_URL}/api/documents/signed/{token}")
        assert r.status_code == 410
