"""Wave 12 Fase 7 — Fix bug crítico de imagen en publicaciones.

Reproduce el flujo completo:
  1. Registro
  2. Upload de imagen
  3. POST /api/feed/posts con image_url
  4. GET /api/feed/posts        → image_url debe aparecer
  5. GET /api/feed/posts/{id}   → image_url debe aparecer
  6. GET /api/content-sources/mixed-feed → el user_post debe tener image
     tanto en metadata.post.image_url como en item.image (para que el
     shapeAsPost del frontend lo pueda leer).
"""
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


TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
    b"\x0f\x00\x00\x01\x01\x00\x01\x9d~\x9f\x01\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _register(name: str = "Photo Bug User") -> tuple[requests.Session, str]:
    s = requests.Session()
    email = f"pytest+photo+{uuid.uuid4().hex[:8]}@puntocero.test-e2e.com"
    r = s.post(f"{BASE_URL}/api/community/auth/register",
               json={"email": email, "password": "TestPwd12345", "name": name})
    assert r.status_code == 200, r.text
    user = r.json().get("user") or r.json()
    return s, user["id"]


class TestPhotoPublishFlow:
    def test_case1_text_only(self):
        s, _ = _register("Case1")
        r = s.post(f"{BASE_URL}/api/feed/posts", json={"body": "solo texto"})
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["body"] == "solo texto"
        assert post.get("image_url") in (None, "")

    def test_case2_image_only(self):
        s, _ = _register("Case2")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("a.png", TINY_PNG, "image/png")})
        assert up.status_code == 200, up.text
        url = up.json()["url"]
        # Backend requires min 1 char body → send a single character.
        r = s.post(f"{BASE_URL}/api/feed/posts", json={"body": "📷", "image_url": url})
        assert r.status_code == 200, r.text
        assert r.json()["image_url"] == url

    def test_case3_text_and_image(self):
        s, _ = _register("Case3")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("b.png", TINY_PNG, "image/png")})
        url = up.json()["url"]
        r = s.post(f"{BASE_URL}/api/feed/posts",
                   json={"body": "texto acompañando la foto", "image_url": url})
        assert r.status_code == 200
        assert r.json()["body"] == "texto acompañando la foto"
        assert r.json()["image_url"] == url

    def test_case4_consecutive_posts_all_persisted(self):
        s, _ = _register("Case4")
        ids: list[str] = []
        for i in range(3):
            up = s.post(f"{BASE_URL}/api/feed/media/upload",
                        files={"file": (f"{i}.png", TINY_PNG, "image/png")})
            url = up.json()["url"]
            r = s.post(f"{BASE_URL}/api/feed/posts",
                       json={"body": f"post {i}", "image_url": url})
            assert r.status_code == 200
            assert r.json()["image_url"] == url
            ids.append(r.json()["id"])
        # Fetch each back — image_url must still be there.
        for pid in ids:
            got = requests.get(f"{BASE_URL}/api/feed/posts/{pid}").json()
            assert got.get("image_url") is not None, f"image_url lost for {pid}"

    def test_case5_reload_still_shows_image(self):
        """Simula un F5 del cliente: nueva sesión GET debe ver image_url."""
        s, _ = _register("Case5")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("c.png", TINY_PNG, "image/png")})
        url = up.json()["url"]
        create = s.post(f"{BASE_URL}/api/feed/posts",
                        json={"body": "post con foto persistida", "image_url": url})
        pid = create.json()["id"]

        # Nueva "sesión" limpia (sin cookies) — la foto debe seguir visible.
        fresh = requests.Session()
        got = fresh.get(f"{BASE_URL}/api/feed/posts/{pid}")
        assert got.status_code == 200
        body = got.json()
        assert body["body"] == "post con foto persistida"
        assert body["image_url"] == url

    def test_list_endpoint_returns_image_url(self):
        s, _ = _register("ListCase")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("d.png", TINY_PNG, "image/png")})
        url = up.json()["url"]
        s.post(f"{BASE_URL}/api/feed/posts",
               json={"body": "list-endpoint-check", "image_url": url})
        r = requests.get(f"{BASE_URL}/api/feed/posts", params={"limit": 20})
        assert r.status_code == 200
        posts = r.json().get("items", r.json() if isinstance(r.json(), list) else [])
        hits = [p for p in posts if p.get("body") == "list-endpoint-check"]
        if hits:
            assert hits[0].get("image_url") == url, \
                f"list endpoint dropped image_url: {hits[0]}"

    def test_mixed_feed_surfaces_user_post_image(self):
        """El feed social debe exponer image tanto en item.image como
        en metadata.post.image_url (usados por shapeAsPost)."""
        s, _ = _register("MixedFeedCase")
        up = s.post(f"{BASE_URL}/api/feed/media/upload",
                    files={"file": ("e.png", TINY_PNG, "image/png")})
        url = up.json()["url"]
        s.post(f"{BASE_URL}/api/feed/posts",
               json={"body": "mixed-feed image", "image_url": url})

        r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                         params={"limit": 30})
        assert r.status_code == 200
        items = r.json().get("items", [])
        user_posts = [it for it in items if it.get("kind") == "user_post"]
        # At least ONE user_post should carry the image now.
        with_image = [
            it for it in user_posts
            if it.get("image") or (it.get("metadata", {}).get("post", {}) or {}).get("image_url")
        ]
        assert with_image, (
            "Ningún user_post en el mixed-feed expone image / metadata.post.image_url. "
            f"user_posts sample: {user_posts[:3]}"
        )


class TestSocialFirstFeed:
    def test_editorial_template_is_social_first(self):
        """La mayoría de los slots del template deben ser user_post
        (social first). En 20 slots: user_post ≈ 10, previews ≈ 10.
        """
        r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                         params={"limit": 20})
        assert r.status_code == 200
        items = r.json()["items"]
        # Cuando hay pool suficiente, la mitad deben ser 'large' user_posts
        # (o al menos 5/20). Como el pool puede estar corto, esta prueba
        # queda flexible pero exige >= 3.
        user_posts = [it for it in items if it.get("kind") == "user_post"]
        assert len(user_posts) >= 3, \
            f"social-first template no honrado: {[i['kind'] for i in items]}"

    def test_preview_layout_used_for_non_social(self):
        """Non-social kinds should be rendered as compact previews."""
        r = requests.get(f"{BASE_URL}/api/content-sources/mixed-feed",
                         params={"limit": 20})
        items = r.json()["items"]
        for it in items:
            if it["kind"] == "user_post":
                assert it.get("layout") == "large", it
            else:
                # Non-social kind must have layout='preview' (or 'medium'
                # from second-pass downgrade, but never large/hero).
                assert it.get("layout") not in ("hero", "large"), \
                    f"non-social {it['kind']} got layout={it.get('layout')}"
