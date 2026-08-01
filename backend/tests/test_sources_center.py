"""Sources Center — backend tests.

Cover the full admin flow: CRUD, sync, logs, toggle, delete, bulk import,
and RBAC (admins only).
"""
from __future__ import annotations

import os
import time
import uuid
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


def _admin_token() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@puntocerosystem.com",
        "password": "PuntoCero2026Admin",
    })
    r.raise_for_status()
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_admin_sources_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/sources")
    assert r.status_code in (401, 403)


def test_admin_sources_full_crud_and_sync():
    tok = _admin_token()
    tag = uuid.uuid4().hex[:6]

    # Create
    body = {
        "name": f"Test Feed {tag}", "kind": "rss",
        "url": "https://feeds.bbci.co.uk/mundo/rss.xml",
        "country": "LATAM", "language": "es", "vertical": "general",
        "frequency": "1h", "status": "active",
    }
    r = requests.post(f"{BASE_URL}/api/admin/sources", json=body, headers=_headers(tok))
    assert r.status_code == 200, r.text
    src = r.json()
    sid = src["id"]
    assert src["kind"] == "rss"
    assert src["country"] == "LATAM"

    # List — should include it
    r = requests.get(f"{BASE_URL}/api/admin/sources?search=Test Feed", headers=_headers(tok))
    assert r.status_code == 200
    ids = [it["id"] for it in r.json()["items"]]
    assert sid in ids

    # Read
    r = requests.get(f"{BASE_URL}/api/admin/sources/{sid}", headers=_headers(tok))
    assert r.status_code == 200
    assert r.json()["id"] == sid

    # Patch
    r = requests.patch(f"{BASE_URL}/api/admin/sources/{sid}",
                       json={"frequency": "6h", "vertical": "general", "description": "unit test"},
                       headers=_headers(tok))
    assert r.status_code == 200
    assert r.json()["frequency"] == "6h"
    assert r.json()["description"] == "unit test"

    # Sync now
    r = requests.post(f"{BASE_URL}/api/admin/sources/{sid}/sync", headers=_headers(tok))
    assert r.status_code == 200
    log = r.json()
    assert log["source_id"] == sid
    assert log["ok"] is True
    assert log["ingested"] + log["updated"] >= 1

    # Logs
    r = requests.get(f"{BASE_URL}/api/admin/sources/{sid}/logs", headers=_headers(tok))
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 1

    # Toggle
    r = requests.post(f"{BASE_URL}/api/admin/sources/{sid}/toggle", headers=_headers(tok))
    assert r.status_code == 200
    assert r.json()["status"] == "paused"

    # Test (dry-run) works even when paused
    r = requests.post(f"{BASE_URL}/api/admin/sources/{sid}/test", headers=_headers(tok))
    assert r.status_code == 200
    assert "ingested" in r.json()

    # Delete
    r = requests.delete(f"{BASE_URL}/api/admin/sources/{sid}", headers=_headers(tok))
    assert r.status_code == 200
    assert r.json().get("deleted") is True


def test_admin_sources_kinds_reports_all_handlers():
    tok = _admin_token()
    r = requests.get(f"{BASE_URL}/api/admin/sources/kinds", headers=_headers(tok))
    assert r.status_code == 200
    kinds = r.json()["kinds"]
    for k in ("rss", "github_org", "youtube_channel", "entity_seed",
              "jobs_feed", "events_feed", "api"):
        assert k in kinds


def test_admin_sources_bulk_import_json():
    tok = _admin_token()
    tag = uuid.uuid4().hex[:6]
    items = [
        {"name": f"Import A {tag}", "kind": "rss", "url": f"https://example.com/a-{tag}",
         "country": "CO", "vertical": "general", "frequency": "1h"},
        {"name": f"Import B {tag}", "kind": "rss", "url": f"https://example.com/b-{tag}",
         "country": "MX", "vertical": "general", "frequency": "1h"},
    ]
    r = requests.post(f"{BASE_URL}/api/admin/sources/import",
                       json={"items": items}, headers=_headers(tok))
    assert r.status_code == 200
    body = r.json()
    assert body["upserted"] == 2
    assert body["errors"] == []
    # And they are visible in the list
    r = requests.get(f"{BASE_URL}/api/admin/sources?search=Import", headers=_headers(tok))
    names = [it["name"] for it in r.json()["items"]]
    assert any(f"Import A {tag}" in n for n in names)


def test_admin_sources_export_json():
    tok = _admin_token()
    r = requests.get(f"{BASE_URL}/api/admin/sources/export?fmt=json", headers=_headers(tok))
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
    assert body["count"] == len(body["items"])


def test_admin_sources_rejects_unknown_kind():
    tok = _admin_token()
    r = requests.post(f"{BASE_URL}/api/admin/sources",
                       json={"name": "bad", "kind": "nope"},
                       headers=_headers(tok))
    # Pydantic literal_error → 422, but our explicit check would surface as 400.
    assert r.status_code in (400, 422)


def test_admin_sources_sync_updates_growth_items():
    """A successful RSS sync writes to growth_items. This ties the admin
    module to the Feed pipeline without any extra plumbing."""
    tok = _admin_token()
    tag = uuid.uuid4().hex[:6]
    r = requests.post(f"{BASE_URL}/api/admin/sources", json={
        "name": f"Growth Feed {tag}", "kind": "rss",
        "url": "https://feeds.bbci.co.uk/mundo/rss.xml",
        "country": "LATAM", "language": "es", "vertical": "general",
        "frequency": "manual", "status": "active",
    }, headers=_headers(tok))
    sid = r.json()["id"]

    before = requests.get(f"{BASE_URL}/api/growth/feed?limit=5").json()
    assert isinstance(before.get("items"), list)

    r = requests.post(f"{BASE_URL}/api/admin/sources/{sid}/sync", headers=_headers(tok))
    assert r.status_code == 200 and r.json()["ok"]

    after = requests.get(f"{BASE_URL}/api/growth/feed?limit=5").json()
    assert len(after["items"]) >= 1
    # Cleanup
    requests.delete(f"{BASE_URL}/api/admin/sources/{sid}", headers=_headers(tok))
