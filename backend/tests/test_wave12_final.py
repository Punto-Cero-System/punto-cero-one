"""Wave 12 Fase 3 — Composer Upload Real + Groups CRUD + Production readiness."""
from __future__ import annotations

import os
import uuid

import pytest
import requests


if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip().strip('"')

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _register(name="Wave12 P3") -> requests.Session:
    s = requests.Session()
    email = f"pytest+wave12p3+{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
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


class TestComposerUploadReal:
    def test_upload_endpoint_returns_url(self):
        s = _register("Composer Uploader")
        r = s.post(f"{BASE_URL}/api/feed/media/upload",
                   files={"file": ("photo.png", _tiny_png(), "image/png")})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["url"].startswith("/api/community/users/media/"), data

    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/feed/media/upload",
                          files={"file": ("photo.png", _tiny_png(), "image/png")})
        assert r.status_code in (401, 403), r.text

    def test_upload_rejects_non_image(self):
        s = _register("Composer Uploader NonImg")
        r = s.post(f"{BASE_URL}/api/feed/media/upload",
                   files={"file": ("hack.txt", b"nope", "text/plain")})
        assert r.status_code == 415, r.text

    def test_post_with_image_flow(self):
        s = _register("Composer With Image")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("photo.png", _tiny_png(), "image/png")})
        assert up.status_code == 200
        image_url = up.json()["url"]

        create = s.post(f"{BASE_URL}/api/feed/posts", json={
            "body": "Mi primera foto en Punto Cero One",
            "image_url": image_url,
        })
        assert create.status_code == 200, create.text
        post = create.json()
        assert post["image_url"] == image_url

        # Fetch it and confirm image_url is included in the serialized shape.
        fetched = requests.get(f"{BASE_URL}/api/feed/posts/{post['id']}")
        assert fetched.status_code == 200
        assert fetched.json().get("image_url") == image_url


class TestGroupsCRUD:
    def test_categories_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/groups/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        keys = {c["key"] for c in cats}
        assert {"marketing", "empleo", "empresas", "tecnologia", "legal",
                "salud", "educacion", "marketplace", "contabilidad",
                "emprendimiento"}.issubset(keys), keys

    def test_full_group_lifecycle(self):
        # Admin creates a group
        admin = _register("Group Admin")
        r = admin.post(f"{BASE_URL}/api/groups", json={
            "name": f"Test Group {uuid.uuid4().hex[:6]}",
            "description": "Grupo de prueba",
            "category": "tecnologia",
            "privacy": "public",
        })
        assert r.status_code == 200, r.text
        group = r.json()
        assert group["members_count"] == 1
        assert group["is_admin"] is True
        gid = group["id"]

        # Second user joins
        member = _register("Group Member")
        rj = member.post(f"{BASE_URL}/api/groups/{gid}/join")
        assert rj.status_code == 200
        assert rj.json()["joined"] is True

        # Idempotent second join
        rj2 = member.post(f"{BASE_URL}/api/groups/{gid}/join")
        assert rj2.json().get("already_member") is True

        # Group now has 2 members
        detail = requests.get(f"{BASE_URL}/api/groups/{gid}").json()
        assert detail["members_count"] == 2

        # Member posts
        rp = member.post(f"{BASE_URL}/api/groups/{gid}/posts", json={"body": "¡Hola grupo!"})
        assert rp.status_code == 200
        assert rp.json()["body"] == "¡Hola grupo!"

        # Public listing shows the post
        rl = requests.get(f"{BASE_URL}/api/groups/{gid}/posts").json()
        assert rl["total"] >= 1

        # Non-member cannot post
        stranger = _register("Group Stranger")
        rns = stranger.post(f"{BASE_URL}/api/groups/{gid}/posts", json={"body": "no debería pasar"})
        assert rns.status_code == 403

        # Leave
        rl2 = member.post(f"{BASE_URL}/api/groups/{gid}/leave")
        assert rl2.status_code == 200
        assert rl2.json()["left"] is True

    def test_list_groups_filtered_by_category(self):
        # Make sure filter param is accepted (even if empty list)
        r = requests.get(f"{BASE_URL}/api/groups", params={"category": "legal"})
        assert r.status_code == 200
        assert "items" in r.json()


class TestProductionReadiness:
    """Smoke checks — every critical endpoint responds without 5xx."""

    @pytest.mark.parametrize("path", [
        "/api/health",
        "/api/community/auth/providers",
        "/api/community/stats",
        "/api/feed/posts?limit=3",
        "/api/feed/trending",
        "/api/content-sources/types",
        "/api/content-sources/mixed-feed?limit=6",
        "/api/content-sources/ai-tools",
        "/api/growth/feed?limit=6",
        "/api/growth/connectors",
        "/api/groups/categories",
        "/api/groups",
        "/api/seo/sitemap.xml",
        "/api/search?q=test",
    ])
    def test_endpoint_reachable(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code < 500, f"{path} returned {r.status_code}: {r.text[:200]}"
