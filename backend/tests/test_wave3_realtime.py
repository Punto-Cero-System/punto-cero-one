"""Wave 3A backend tests — Realtime SSE broker + presence.

Covers:
  1. `/api/realtime/stream` requires auth.
  2. `/api/realtime/stream` returns text/event-stream headers with initial hello.
  3. `/api/realtime/presence` returns ONLINE for a user actively subscribed, and
     OFFLINE for an unknown user.
  4. `/api/realtime/heartbeat` refreshes last_seen for the caller.
  5. Publishing a notification via feed reaction reaches the subscribed peer's
     SSE stream as a `notification` event (end-to-end fan-out).
  6. Publishing a chat message reaches the peer's SSE stream as a `message`
     event.
"""
from __future__ import annotations

import json
import os
import threading
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


def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_test_w3a_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}"
    token = f"test_session_w3a_{tag}_{uuid.uuid4().hex}"
    now = "2026-01-01T00:00:00+00:00"
    mongo_db.users.insert_one({
        "id": uid,
        "email": f"TEST_{tag}_{uid}@example.com",
        "name": f"TEST {tag.title()} W3A",
        "role": "member",
        "picture": "https://via.placeholder.com/64",
        "auth_providers": [{"provider": "google", "provider_user_id": f"g_{uid}", "linked_at": now}],
        "created_at": now,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token, "provider": "google",
        "expires_at": "2099-01-01T00:00:00+00:00", "created_at": now,
    })
    return {"id": uid, "token": token, "cookie": {"session_token": token}}


@pytest.fixture(scope="module")
def users(mongo_db):
    a = _mk_user(mongo_db, "actor")
    b = _mk_user(mongo_db, "recip")
    yield {"a": a, "b": b}
    for u in (a, b):
        mongo_db.users.delete_many({"id": u["id"]})
        mongo_db.user_sessions.delete_many({"user_id": u["id"]})
        mongo_db.notifications.delete_many({"recipient_id": u["id"]})
        mongo_db.post_reactions.delete_many({"user_id": u["id"]})


@pytest.fixture(scope="module")
def cleanup(mongo_db):
    tracker = {"posts": [], "conversations": []}
    yield tracker
    if tracker["posts"]:
        mongo_db.posts.delete_many({"id": {"$in": tracker["posts"]}})
        mongo_db.post_reactions.delete_many({"post_id": {"$in": tracker["posts"]}})
    if tracker["conversations"]:
        mongo_db.conversations.delete_many({"id": {"$in": tracker["conversations"]}})
        mongo_db.chat_messages.delete_many({"conversation_id": {"$in": tracker["conversations"]}})


class SSEReader:
    """Threaded reader that collects SSE events for a bounded time window.

    Uses requests streaming; parses `event:` + `data:` lines. Keeps a list of
    parsed events. `wait_for(pred, timeout)` returns the matched event or None.
    """
    def __init__(self, url: str, cookies: dict):
        self.url = url
        self.cookies = cookies
        self.events: list[dict] = []
        self._stop = False
        self._resp = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._ready = threading.Event()

    def start(self):
        self._thread.start()
        self._ready.wait(timeout=5.0)

    def stop(self):
        self._stop = True
        try:
            if self._resp:
                self._resp.close()
        except Exception:
            pass
        self._thread.join(timeout=3.0)

    def _run(self):
        try:
            self._resp = requests.get(self.url, cookies=self.cookies, stream=True, timeout=(5, 30))
            self._ready.set()
            current_event = None
            for raw in self._resp.iter_lines(decode_unicode=True):
                if self._stop:
                    break
                if raw is None:
                    continue
                if raw.startswith(":"):
                    continue  # keep-alive comment
                if raw.startswith("event:"):
                    current_event = raw.split(":", 1)[1].strip()
                elif raw.startswith("data:"):
                    payload = raw.split(":", 1)[1].strip()
                    try:
                        parsed = json.loads(payload)
                    except Exception:
                        parsed = {"raw": payload}
                    self.events.append({"event": current_event or parsed.get("type"), "data": parsed})
                    current_event = None
        except Exception:
            self._ready.set()

    def wait_for(self, pred, timeout: float = 5.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            for e in self.events:
                if pred(e):
                    return e
            time.sleep(0.1)
        return None


# ---------------------------------------------------------------------------
# 1. Auth guard + presence
# ---------------------------------------------------------------------------
class TestRealtimeAuth:
    def test_stream_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/realtime/stream", timeout=5, stream=True)
        assert r.status_code == 401
        r.close()

    def test_heartbeat_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/realtime/heartbeat")
        assert r.status_code == 401

    def test_presence_unknown_user_is_offline(self):
        r = requests.get(f"{BASE_URL}/api/realtime/presence", params={"ids": "does-not-exist-xxx"})
        assert r.status_code == 200
        data = r.json()
        assert data["presence"]["does-not-exist-xxx"]["status"] == "OFFLINE"


# ---------------------------------------------------------------------------
# 2. SSE stream + presence lifecycle
# ---------------------------------------------------------------------------
class TestSSEStream:
    def test_stream_yields_hello_and_marks_online(self, users):
        b = users["b"]
        reader = SSEReader(f"{BASE_URL}/api/realtime/stream", b["cookie"])
        reader.start()
        try:
            hello = reader.wait_for(lambda e: e.get("event") == "system.hello", timeout=5.0)
            assert hello is not None, f"expected system.hello, got: {reader.events[:5]}"
            assert hello["data"]["data"]["user_id"] == b["id"]
            # Presence check: b should be ONLINE
            time.sleep(0.3)
            r = requests.get(f"{BASE_URL}/api/realtime/presence", params={"ids": b["id"]})
            assert r.status_code == 200
            assert r.json()["presence"][b["id"]]["status"] == "ONLINE"
        finally:
            reader.stop()

    def test_heartbeat_updates_last_seen(self, users):
        a = users["a"]
        r = requests.post(f"{BASE_URL}/api/realtime/heartbeat", cookies=a["cookie"])
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/realtime/presence", params={"ids": a["id"]})
        assert r.status_code == 200
        # Without an open SSE stream, presence is AWAY (or ONLINE briefly).
        assert r.json()["presence"][a["id"]]["status"] in ("ONLINE", "AWAY")
        assert r.json()["presence"][a["id"]]["last_seen"] is not None


# ---------------------------------------------------------------------------
# 3. End-to-end: reaction → recipient's SSE stream receives `notification`
# ---------------------------------------------------------------------------
class TestRealtimeFanout:
    def test_reaction_pushes_notification_over_sse(self, users, cleanup):
        a = users["a"]; b = users["b"]
        # B creates a post
        r = requests.post(f"{BASE_URL}/api/feed/posts",
                          json={"body": "TEST realtime post", "category_key": "comunidad"},
                          cookies=b["cookie"])
        assert r.status_code == 200
        post = r.json()
        cleanup["posts"].append(post["id"])

        # B opens SSE stream
        reader = SSEReader(f"{BASE_URL}/api/realtime/stream", b["cookie"])
        reader.start()
        try:
            reader.wait_for(lambda e: e.get("event") == "system.hello", timeout=5.0)
            # A reacts → notification is published
            r = requests.post(f"{BASE_URL}/api/feed/posts/{post['id']}/react",
                              json={"kind": "like"}, cookies=a["cookie"])
            assert r.status_code == 200
            evt = reader.wait_for(
                lambda e: e.get("event") == "notification"
                          and e["data"]["data"].get("kind") == "reaction",
                timeout=5.0,
            )
            assert evt is not None, f"expected 'notification' SSE event, got: {[x['event'] for x in reader.events]}"
            assert evt["data"]["data"]["actor_id"] == a["id"]
            assert evt["data"]["data"]["subject_id"] == post["id"]
        finally:
            reader.stop()

    def test_chat_message_pushes_over_sse(self, users, cleanup):
        a = users["a"]; b = users["b"]
        payload = {"kind": "dm", "participants": [{"id": b["id"], "kind": "user", "name": "TEST Recip"}]}
        conv = requests.post(f"{BASE_URL}/api/messages/conversations",
                             json=payload, cookies=a["cookie"]).json()
        cleanup["conversations"].append(conv["id"])

        reader = SSEReader(f"{BASE_URL}/api/realtime/stream", b["cookie"])
        reader.start()
        try:
            reader.wait_for(lambda e: e.get("event") == "system.hello", timeout=5.0)
            r = requests.post(f"{BASE_URL}/api/messages/conversations/{conv['id']}/messages",
                              json={"body": "hola realtime"}, cookies=a["cookie"])
            assert r.status_code == 200
            evt = reader.wait_for(
                lambda e: e.get("event") == "message"
                          and e["data"]["data"].get("conversation_id") == conv["id"],
                timeout=5.0,
            )
            assert evt is not None
            assert evt["data"]["data"]["message"]["body"] == "hola realtime"
        finally:
            reader.stop()
