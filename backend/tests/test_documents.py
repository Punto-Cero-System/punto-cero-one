"""Tests for /api/documents/* — Task 3 Object Storage repository.

Covers: admin upload, list scoped by role, download, soft-delete, permission
matrix (investor cannot upload/delete, unauthenticated blocked).
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

INVESTOR_EMAIL = "test_investor_docs@example.com"
INVESTOR_PASSWORD = "InvestorPass2026"


@pytest.fixture(scope="module")
def investor_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": INVESTOR_EMAIL, "password": INVESTOR_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Investor login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def investor_headers(investor_token):
    return {"Authorization": f"Bearer {investor_token}"}


@pytest.fixture(scope="module")
def uploaded_doc(admin_headers):
    """Uploads a fresh investor-vertical doc used by download/list tests."""
    content = b"TEST_DOC_CONTENT_" + os.urandom(8)
    files = {"file": ("TEST_upload.txt", content, "text/plain")}
    data = {"category": "pitch_deck", "vertical": "investor"}
    # Remove JSON Content-Type header so multipart is used.
    hdr = {"Authorization": admin_headers["Authorization"]}
    r = requests.post(f"{BASE_URL}/api/documents/upload", headers=hdr, files=files, data=data, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"].startswith("doc_")
    assert body["category"] == "pitch_deck"
    assert body["vertical"] == "investor"
    assert body["size_bytes"] == len(content)
    body["_content"] = content
    yield body
    # Cleanup
    try:
        requests.delete(f"{BASE_URL}/api/documents/{body['id']}", headers=hdr, timeout=15)
    except Exception:
        pass


class TestDocumentsAuth:
    def test_upload_requires_auth(self):
        files = {"file": ("x.txt", b"x", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/documents/upload", files=files,
                          data={"category": "other", "vertical": "investor"}, timeout=10)
        assert r.status_code in (401, 403)

    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/documents", timeout=10)
        assert r.status_code in (401, 403)

    def test_investor_cannot_upload(self, investor_headers):
        files = {"file": ("x.txt", b"x", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/documents/upload", headers=investor_headers, files=files,
                          data={"category": "other", "vertical": "investor"}, timeout=10)
        assert r.status_code == 403


class TestDocumentsCRUD:
    def test_admin_upload_returns_public_doc(self, uploaded_doc):
        assert uploaded_doc["original_filename"] == "TEST_upload.txt"
        assert uploaded_doc["content_type"] == "text/plain"

    def test_admin_list_includes_upload(self, admin_headers, uploaded_doc):
        r = requests.get(f"{BASE_URL}/api/documents", headers={"Authorization": admin_headers["Authorization"]}, timeout=15)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()["items"]]
        assert uploaded_doc["id"] in ids
        assert r.json()["total"] == len(r.json()["items"])

    def test_investor_list_only_investor_vertical(self, admin_headers, investor_headers, uploaded_doc):
        # Upload a legal doc as admin — investor should not see it
        files = {"file": ("TEST_legal.txt", b"legal-body", "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/documents/upload",
            headers={"Authorization": admin_headers["Authorization"]},
            files=files,
            data={"category": "legal", "vertical": "legal"},
            timeout=30,
        )
        assert r.status_code == 200
        legal_id = r.json()["id"]
        try:
            r = requests.get(f"{BASE_URL}/api/documents", headers=investor_headers, timeout=15)
            assert r.status_code == 200
            items = r.json()["items"]
            assert all(d["vertical"] == "investor" for d in items)
            assert legal_id not in [d["id"] for d in items]
            assert uploaded_doc["id"] in [d["id"] for d in items]
        finally:
            requests.delete(f"{BASE_URL}/api/documents/{legal_id}",
                            headers={"Authorization": admin_headers["Authorization"]}, timeout=15)

    def test_download_returns_original_bytes(self, admin_headers, uploaded_doc):
        r = requests.get(
            f"{BASE_URL}/api/documents/{uploaded_doc['id']}/download",
            headers={"Authorization": admin_headers["Authorization"]},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.content == uploaded_doc["_content"]
        assert "attachment" in r.headers.get("Content-Disposition", "").lower()
        assert "TEST_upload.txt" in r.headers.get("Content-Disposition", "")
        assert r.headers.get("Content-Type", "").startswith("text/plain")

    def test_investor_can_download_investor_doc(self, investor_headers, uploaded_doc):
        r = requests.get(
            f"{BASE_URL}/api/documents/{uploaded_doc['id']}/download",
            headers=investor_headers,
            timeout=15,
        )
        assert r.status_code == 200
        assert r.content == uploaded_doc["_content"]

    def test_investor_cannot_delete(self, investor_headers, uploaded_doc):
        r = requests.delete(f"{BASE_URL}/api/documents/{uploaded_doc['id']}", headers=investor_headers, timeout=10)
        assert r.status_code == 403

    def test_admin_soft_delete_removes_from_list(self, admin_headers):
        # Upload a doc explicitly for delete
        files = {"file": ("TEST_del.txt", b"delete-me", "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/documents/upload",
            headers={"Authorization": admin_headers["Authorization"]},
            files=files,
            data={"category": "other", "vertical": "investor"},
            timeout=30,
        )
        assert r.status_code == 200
        doc_id = r.json()["id"]

        r = requests.delete(
            f"{BASE_URL}/api/documents/{doc_id}",
            headers={"Authorization": admin_headers["Authorization"]},
            timeout=15,
        )
        assert r.status_code == 200

        # Should be excluded from list now
        r = requests.get(f"{BASE_URL}/api/documents",
                         headers={"Authorization": admin_headers["Authorization"]}, timeout=15)
        assert r.status_code == 200
        assert doc_id not in [d["id"] for d in r.json()["items"]]

        # Download of deleted doc → 404
        r = requests.get(f"{BASE_URL}/api/documents/{doc_id}/download",
                         headers={"Authorization": admin_headers["Authorization"]}, timeout=15)
        assert r.status_code == 404
