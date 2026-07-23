"""FASE 3 — Pitch Deck: PDF download, event tracking, admin analytics, downloads counter."""
import io
import os
import time
import uuid

import pytest
import requests

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


# ---------- PDF DOWNLOAD ----------
class TestPitchDeckDownload:
    def test_download_returns_pdf(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/pitch-deck/download", timeout=30)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "").lower()
        assert r.content.startswith(b"%PDF")
        assert len(r.content) > 20 * 1024, f"PDF too small: {len(r.content)}"
        cd = r.headers.get("content-disposition", "")
        assert "Punto-Cero-System-Investor-Pitch-Deck-" in cd
        assert cd.strip().rstrip('"').endswith(".pdf")

    def test_download_no_auth_required(self, base_url):
        # Fresh session with no auth headers
        s = requests.Session()
        r = s.get(f"{base_url}/api/pitch-deck/download", timeout=30)
        assert r.status_code == 200

    @pytest.mark.skipif(not HAS_PYPDF, reason="pypdf not installed")
    def test_pdf_structure_and_metadata(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/pitch-deck/download", timeout=30)
        assert r.status_code == 200
        reader = pypdf.PdfReader(io.BytesIO(r.content))
        # 12 slides + closing page
        assert len(reader.pages) >= 13, f"Expected >=13 pages, got {len(reader.pages)}"
        md = reader.metadata or {}
        title = (md.title or "") if md else ""
        author = (md.author or "") if md else ""
        assert "Punto Cero" in title, f"Title missing 'Punto Cero': {title}"
        assert "Punto Cero" in author, f"Author missing 'Punto Cero': {author}"


# ---------- EVENT TRACKING ----------
class TestPitchDeckEvents:
    def test_create_event_success(self, api_client, base_url, mongo_db):
        session_id = f"TESTsess-{uuid.uuid4().hex[:12]}"
        payload = {
            "session_id": session_id,
            "slide_number": 3,
            "slide_title": "TEST Slide 3",
            "duration_ms": 1500,
            "completed": True,
            "user_agent": "TEST/pytest",
        }
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json=payload, timeout=15)
        assert r.status_code == 201
        data = r.json()
        assert data.get("ok") is True

        # Verify persistence
        doc = mongo_db.pitch_deck_events.find_one({"session_id": session_id})
        assert doc is not None
        assert doc["slide_number"] == 3
        assert doc["duration_ms"] == 1500
        assert "created_at" in doc

        # Inline cleanup
        mongo_db.pitch_deck_events.delete_many({"session_id": session_id})

    def test_event_slide_number_zero_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
            "session_id": "TESTvalidsession",
            "slide_number": 0,
            "duration_ms": 1000,
        }, timeout=10)
        assert r.status_code == 422

    def test_event_slide_number_too_high_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
            "session_id": "TESTvalidsession",
            "slide_number": 100,
            "duration_ms": 1000,
        }, timeout=10)
        assert r.status_code == 422

    def test_event_negative_duration_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
            "session_id": "TESTvalidsession",
            "slide_number": 1,
            "duration_ms": -1,
        }, timeout=10)
        assert r.status_code == 422

    def test_event_duration_too_large_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
            "session_id": "TESTvalidsession",
            "slide_number": 1,
            "duration_ms": 1800001,
        }, timeout=10)
        assert r.status_code == 422

    def test_event_session_id_too_short_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
            "session_id": "abc",  # <6
            "slide_number": 1,
            "duration_ms": 100,
        }, timeout=10)
        assert r.status_code == 422


# ---------- ADMIN ANALYTICS ----------
class TestPitchDeckAnalyticsAuth:
    def test_analytics_requires_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/admin/pitch-deck/analytics", timeout=10)
        assert r.status_code in (401, 403)

    def test_downloads_requires_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/admin/pitch-deck/downloads", timeout=10)
        assert r.status_code in (401, 403)


class TestPitchDeckAnalyticsAggregation:
    """Insert controlled events and verify aggregation is correct."""

    def test_analytics_aggregation_correctness(self, api_client, base_url, admin_headers, mongo_db):
        # Clean any pre-existing TEST_AGG events
        mongo_db.pitch_deck_events.delete_many({"session_id": {"$regex": "^TEST_AGG"}})

        # 3 events on slide 1 for SAME session — durations 1000, 2000, 3000
        s1 = "TEST_AGG_session_one"
        for d in (1000, 2000, 3000):
            r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
                "session_id": s1,
                "slide_number": 91,  # use high unique numbers to avoid collision
                "slide_title": "TEST_AGG Slide 91",
                "duration_ms": d,
            }, timeout=10)
            assert r.status_code == 201

        # 2 events on slide 2 for 2 different sessions — 500, 700
        for sid, d in (("TEST_AGG_session_two", 500), ("TEST_AGG_session_three", 700)):
            r = api_client.post(f"{base_url}/api/pitch-deck/events", json={
                "session_id": sid,
                "slide_number": 92,
                "slide_title": "TEST_AGG Slide 92",
                "duration_ms": d,
            }, timeout=10)
            assert r.status_code == 201

        # Small wait to ensure all writes visible to aggregation
        time.sleep(0.3)

        # Fetch analytics
        r = api_client.get(f"{base_url}/api/admin/pitch-deck/analytics", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "total_events" in data
        assert "total_sessions" in data
        assert "slides" in data

        by_num = {s["slide_number"]: s for s in data["slides"]}
        assert 91 in by_num, "Slide 91 missing"
        assert 92 in by_num, "Slide 92 missing"

        s91 = by_num[91]
        assert s91["views"] == 3, f"slide 91 views: {s91['views']}"
        assert s91["unique_sessions"] == 1
        assert s91["total_ms"] == 6000
        assert abs(s91["avg_ms"] - 2000) < 0.01

        s92 = by_num[92]
        assert s92["views"] == 2
        assert s92["unique_sessions"] == 2
        assert s92["total_ms"] == 1200
        assert abs(s92["avg_ms"] - 600) < 0.01

        # slides sorted ascending
        slide_nums = [s["slide_number"] for s in data["slides"]]
        assert slide_nums == sorted(slide_nums)

        # Cleanup
        mongo_db.pitch_deck_events.delete_many({"session_id": {"$regex": "^TEST_AGG"}})


class TestPitchDeckDownloadsCounter:
    def test_download_increments_counter(self, api_client, base_url, admin_headers):
        # Read baseline
        r0 = api_client.get(f"{base_url}/api/admin/pitch-deck/downloads", headers=admin_headers, timeout=10)
        assert r0.status_code == 200
        base = r0.json()["total_downloads"]

        # Trigger a download
        rdl = api_client.get(f"{base_url}/api/pitch-deck/download", timeout=30)
        assert rdl.status_code == 200

        # Wait a moment for Mongo write
        time.sleep(0.5)

        r1 = api_client.get(f"{base_url}/api/admin/pitch-deck/downloads", headers=admin_headers, timeout=10)
        assert r1.status_code == 200
        new = r1.json()["total_downloads"]
        assert new >= base + 1, f"Downloads counter did not increment: {base} -> {new}"


# ---------- INDEXES ----------
class TestPitchDeckIndexes:
    def test_indexes_present(self, mongo_db):
        idx = mongo_db.pitch_deck_events.index_information()
        # Extract single-field indexes
        fields = set()
        for _, info in idx.items():
            for k, _ in info.get("key", []):
                fields.add(k)
        assert "session_id" in fields, f"index on session_id missing. Indexes: {idx}"
        assert "slide_number" in fields, f"index on slide_number missing. Indexes: {idx}"
        assert "created_at" in fields, f"index on created_at missing. Indexes: {idx}"


# ---------- CLEANUP ----------
# NOTE: Under pytest-xdist LoadScope, workers finish at different times.
# A session/module-scope autouse cleanup on one worker can wipe data still being
# used by another worker's active test. So each test that inserts data cleans
# itself up inline instead of relying on a global cleanup hook.
