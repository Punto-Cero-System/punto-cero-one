"""Investor requests: public submission + admin CRUD & filtering."""
import pytest
import requests


VALID_STATUSES = ("pending", "under_review", "approved", "rejected")


class TestPublicSubmit:
    def test_submit_success_returns_public_shape(self, base_url, api_client, mongo_db):
        payload = {
            "fullName": "TEST_Investor Alpha",
            "email": "TEST_alpha@example.com",
            "company": "Alpha Capital",
            "role": "Partner",
            "focus": "SaaS",
            "country": "Chile",
            "message": "Interested",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        data = r.json()
        # Only safe fields exposed
        assert set(data.keys()) == {"id", "status", "submitted_at", "message"}
        assert data["status"] == "pending"
        assert isinstance(data["id"], str) and len(data["id"]) > 0
        assert "submitted_at" in data

        # Verify persistence in DB
        doc = mongo_db.investor_requests.find_one({"id": data["id"]})
        assert doc is not None
        assert doc["email"] == payload["email"]
        assert doc["fullName"] == payload["fullName"]
        assert doc["status"] == "pending"
        assert doc.get("admin_notes", "") == ""

    def test_submit_no_auth_required(self, base_url):
        # Use a fresh session without any auth headers
        s = requests.Session()
        r = s.post(
            f"{base_url}/api/investor-requests",
            json={"fullName": "TEST_NoAuth User", "email": "TEST_noauth@example.com"},
            timeout=15,
        )
        assert r.status_code == 201, r.text

    def test_submit_missing_email_422(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/investor-requests",
            json={"fullName": "TEST_NoEmail"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_submit_invalid_email_422(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/investor-requests",
            json={"fullName": "TEST_BadEmail", "email": "not-an-email"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_submit_short_fullname_422(self, base_url, api_client):
        r = api_client.post(
            f"{base_url}/api/investor-requests",
            json={"fullName": "A", "email": "TEST_short@example.com"},
            timeout=10,
        )
        assert r.status_code == 422


class TestAdminListAndFilters:
    def test_list_requires_auth(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/admin/investor-requests", timeout=10)
        assert r.status_code == 401

    def test_list_ok_with_admin(self, base_url, api_client, admin_headers):
        # Seed a couple entries
        api_client.post(f"{base_url}/api/investor-requests", json={
            "fullName": "TEST_List One", "email": "TEST_list1@example.com", "country": "Mexico"
        }, timeout=10)
        api_client.post(f"{base_url}/api/investor-requests", json={
            "fullName": "TEST_List Two", "email": "TEST_list2@example.com", "country": "Brazil"
        }, timeout=10)

        r = api_client.get(f"{base_url}/api/admin/investor-requests?limit=50", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["items", "total", "limit", "skip"]).issubset(data.keys())
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        # Sort desc by submitted_at
        if len(data["items"]) >= 2:
            first, second = data["items"][0], data["items"][1]
            assert first["submitted_at"] >= second["submitted_at"]
        # _id should NOT leak
        for item in data["items"]:
            assert "_id" not in item

    def test_list_filter_status_pending(self, base_url, api_client, admin_headers):
        r = api_client.get(
            f"{base_url}/api/admin/investor-requests?status=pending&limit=200",
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        for item in data["items"]:
            assert item["status"] == "pending"

    def test_list_filter_invalid_status_400(self, base_url, api_client, admin_headers):
        r = api_client.get(
            f"{base_url}/api/admin/investor-requests?status=nope",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 400

    def test_list_search_case_insensitive(self, base_url, api_client, admin_headers):
        # Seed an entry with a unique searchable string
        unique = "TEST_UniqueSearchTag_XyZ_9821"
        r0 = api_client.post(f"{base_url}/api/investor-requests", json={
            "fullName": f"{unique} Name",
            "email": "TEST_searchunique@example.com",
            "company": "SearchCo",
            "country": "Peru",
        }, timeout=10)
        assert r0.status_code == 201

        # search lowercased should still hit
        r = api_client.get(
            f"{base_url}/api/admin/investor-requests?search={unique.lower()}",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert any(unique in item["fullName"] for item in data["items"])


class TestAdminStats:
    def test_stats_shape_and_sum(self, base_url, api_client, admin_headers):
        r = api_client.get(f"{base_url}/api/admin/investor-requests/stats", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        expected_keys = {"total", "pending", "under_review", "approved", "rejected"}
        assert expected_keys == set(data.keys()), f"Keys mismatch: {set(data.keys())}"
        for k in expected_keys:
            assert isinstance(data[k], int)
        assert data["pending"] + data["under_review"] + data["approved"] + data["rejected"] == data["total"]


class TestAdminGetById:
    def test_get_by_id_ok(self, base_url, api_client, admin_headers):
        r_create = api_client.post(f"{base_url}/api/investor-requests", json={
            "fullName": "TEST_Detail Target", "email": "TEST_detail@example.com"
        }, timeout=10)
        assert r_create.status_code == 201
        rid = r_create.json()["id"]

        r = api_client.get(f"{base_url}/api/admin/investor-requests/{rid}", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == rid
        assert data["email"] == "TEST_detail@example.com"
        assert data["status"] == "pending"

    def test_get_unknown_id_404(self, base_url, api_client, admin_headers):
        r = api_client.get(
            f"{base_url}/api/admin/investor-requests/nonexistent-id-xyz",
            headers=admin_headers, timeout=10,
        )
        assert r.status_code == 404


class TestAdminPatch:
    def _create(self, base_url, api_client, email):
        r = api_client.post(f"{base_url}/api/investor-requests", json={
            "fullName": "TEST_Patch Target", "email": email
        }, timeout=10)
        assert r.status_code == 201
        return r.json()["id"]

    @pytest.mark.parametrize("new_status", VALID_STATUSES)
    def test_patch_valid_statuses(self, base_url, api_client, admin_headers, new_status):
        rid = self._create(base_url, api_client, f"TEST_patch_{new_status}@example.com")
        r = api_client.patch(
            f"{base_url}/api/admin/investor-requests/{rid}",
            headers=admin_headers,
            json={"status": new_status, "admin_notes": f"note-{new_status}"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == new_status
        assert data["admin_notes"] == f"note-{new_status}"
        assert data.get("reviewed_by")
        assert data["updated_at"]

        # Verify persisted via GET
        g = api_client.get(f"{base_url}/api/admin/investor-requests/{rid}", headers=admin_headers, timeout=10)
        assert g.status_code == 200
        assert g.json()["status"] == new_status
        assert g.json()["admin_notes"] == f"note-{new_status}"

    def test_patch_invalid_status_422(self, base_url, api_client, admin_headers):
        rid = self._create(base_url, api_client, "TEST_patchinvalid@example.com")
        r = api_client.patch(
            f"{base_url}/api/admin/investor-requests/{rid}",
            headers=admin_headers,
            json={"status": "not_a_status"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_patch_unknown_id_404(self, base_url, api_client, admin_headers):
        r = api_client.patch(
            f"{base_url}/api/admin/investor-requests/nonexistent-id-xyz",
            headers=admin_headers,
            json={"status": "approved"},
            timeout=10,
        )
        assert r.status_code == 404


# NOTE: cleanup of TEST_ prefixed data is performed at session teardown in conftest.py
# to avoid cross-worker races when pytest-xdist runs classes of this module on
# separate workers.
