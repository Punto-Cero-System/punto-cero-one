"""Wave 12 Fase 4 — Group notifications + Group cover uploads."""
from __future__ import annotations

import os
import uuid

import requests


if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _register(name: str = "User") -> requests.Session:
    s = requests.Session()
    email = f"pytest+p4+{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
    r = s.post(f"{BASE_URL}/api/community/auth/register",
               json={"email": email, "password": "TestPwd12345", "name": name})
    assert r.status_code == 200, r.text
    return s


def _tiny_png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
        b"\x0f\x00\x00\x01\x01\x00\x01\x9d~\x9f\x01\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _list_notifications(session: requests.Session) -> list[dict]:
    r = session.get(f"{BASE_URL}/api/notifications")
    assert r.status_code == 200, r.text
    body = r.json()
    return body.get("items") or body.get("notifications") or []


class TestGroupNotifications:
    def test_join_notifies_admin(self):
        admin = _register("Group Admin Notify")
        # baseline notifications count
        base_notifs = _list_notifications(admin)
        base_count = len(base_notifs)

        r = admin.post(f"{BASE_URL}/api/groups", json={
            "name": f"Notif Group {uuid.uuid4().hex[:6]}",
            "category": "tecnologia",
        })
        assert r.status_code == 200
        gid = r.json()["id"]

        joiner = _register("Group Joiner")
        rj = joiner.post(f"{BASE_URL}/api/groups/{gid}/join")
        assert rj.status_code == 200

        # Admin should now have +1 notification of kind=group_join
        notifs = _list_notifications(admin)
        assert len(notifs) >= base_count + 1
        joins = [n for n in notifs if n.get("kind") == "group_join"]
        assert joins, "admin never received group_join notification"
        assert any("se unió a" in (n.get("title") or "") for n in joins)

    def test_post_notifies_all_other_members(self):
        admin = _register("Group Admin Post")
        r = admin.post(f"{BASE_URL}/api/groups", json={
            "name": f"PostNotif Group {uuid.uuid4().hex[:6]}",
            "category": "marketing",
        })
        gid = r.json()["id"]

        m1 = _register("Member One")
        m2 = _register("Member Two")
        m1.post(f"{BASE_URL}/api/groups/{gid}/join")
        m2.post(f"{BASE_URL}/api/groups/{gid}/join")

        base1 = len([n for n in _list_notifications(m1) if n.get("kind") == "group_post"])
        base2 = len([n for n in _list_notifications(m2) if n.get("kind") == "group_post"])
        base_admin = len([n for n in _list_notifications(admin) if n.get("kind") == "group_post"])

        # m2 publishes → m1 and admin should be notified, m2 should NOT.
        m2.post(f"{BASE_URL}/api/groups/{gid}/posts", json={"body": "Hola grupo"})

        posts_m1 = [n for n in _list_notifications(m1) if n.get("kind") == "group_post"]
        posts_m2 = [n for n in _list_notifications(m2) if n.get("kind") == "group_post"]
        posts_admin = [n for n in _list_notifications(admin) if n.get("kind") == "group_post"]

        assert len(posts_m1) >= base1 + 1, "member one didn't get group_post"
        assert len(posts_admin) >= base_admin + 1, "admin didn't get group_post"
        assert len(posts_m2) == base2, "poster wrongly notified of their own post"


class TestGroupCover:
    def test_admin_uploads_and_deletes_cover(self):
        admin = _register("Cover Admin")
        r = admin.post(f"{BASE_URL}/api/groups", json={
            "name": f"Cover Group {uuid.uuid4().hex[:6]}",
            "category": "empresas",
        })
        assert r.status_code == 200
        gid = r.json()["id"]

        up = admin.put(f"{BASE_URL}/api/groups/{gid}/cover",
                       files={"file": ("cover.png", _tiny_png(), "image/png")})
        assert up.status_code == 200, up.text
        url = up.json()["url"]
        assert url.startswith("/api/community/users/media/")

        # Group detail exposes the cover_url
        detail = requests.get(f"{BASE_URL}/api/groups/{gid}").json()
        assert detail.get("cover_url") == url

        # Non-admin cannot upload
        stranger = _register("Cover Stranger")
        r2 = stranger.put(f"{BASE_URL}/api/groups/{gid}/cover",
                          files={"file": ("cover.png", _tiny_png(), "image/png")})
        assert r2.status_code == 403

        # Non-image rejected
        r3 = admin.put(f"{BASE_URL}/api/groups/{gid}/cover",
                       files={"file": ("hack.txt", b"nope", "text/plain")})
        assert r3.status_code == 415

        # Delete
        rd = admin.delete(f"{BASE_URL}/api/groups/{gid}/cover")
        assert rd.status_code == 200
        cleared = requests.get(f"{BASE_URL}/api/groups/{gid}").json()
        assert cleared.get("cover_url") in (None, "")

    def test_cover_upload_requires_auth(self):
        r = requests.put(f"{BASE_URL}/api/groups/anything/cover",
                         files={"file": ("cover.png", _tiny_png(), "image/png")})
        assert r.status_code in (401, 403)
