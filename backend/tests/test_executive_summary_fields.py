"""Executive Summary CTA form: contactType + source persistence + validation.

New backend contract added in this iteration (PHASE II):
- InvestorRequestCreate accepts Optional[Literal] contactType and Optional[str] source
- POST /api/investor-requests persists both fields
- GET /api/admin/investor-requests/{id} returns both fields
- Backward compatibility: submissions WITHOUT the two fields still succeed
"""
import pytest
import requests


VALID_CONTACT_TYPES = (
    "investor",
    "strategic_partner",
    "technology_partner",
    "professional",
    "entrepreneur",
    "company",
    "other",
)


class TestContactTypeAndSourcePersistence:
    """POST → GET (admin) → assert both fields round-trip through Mongo."""

    def test_submit_with_contact_type_and_source_persists(
        self, base_url, api_client, admin_headers, mongo_db
    ):
        payload = {
            "fullName": "TEST_QA Investor",
            "email": "TEST_qa_investor@example.com",
            "company": "QA Capital",
            "country": "Perú",
            "message": "Interested in strategic conversation.",
            "contactType": "investor",
            "source": "executive_summary",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        rid = r.json()["id"]

        # Verify in DB directly
        doc = mongo_db.investor_requests.find_one({"id": rid})
        assert doc is not None
        assert doc["contactType"] == "investor"
        assert doc["source"] == "executive_summary"
        assert doc["country"] == "Perú"

        # Verify through admin API (this is what the AdminDashboard drawer consumes)
        admin_get = requests.get(
            f"{base_url}/api/admin/investor-requests/{rid}",
            headers=admin_headers,
            timeout=15,
        )
        assert admin_get.status_code == 200, admin_get.text
        data = admin_get.json()
        assert data["contactType"] == "investor"
        assert data["source"] == "executive_summary"
        assert data["fullName"] == "TEST_QA Investor"

    @pytest.mark.parametrize("ct", VALID_CONTACT_TYPES)
    def test_all_valid_contact_types_accepted(self, base_url, api_client, ct):
        payload = {
            "fullName": f"TEST_CT_{ct}",
            "email": f"TEST_ct_{ct}@example.com",
            "contactType": ct,
            "source": "executive_summary",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 201, r.text

    def test_invalid_contact_type_rejected_422(self, base_url, api_client):
        payload = {
            "fullName": "TEST_Invalid CT",
            "email": "TEST_invalid_ct@example.com",
            "contactType": "vip",  # not in Literal
            "source": "executive_summary",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 422, r.text
        # Ensure it's specifically about contactType
        body = r.json()
        assert "contactType" in str(body).lower() or "literal" in str(body).lower()


class TestBackwardCompatibility:
    """Old-style clients (homepage / request-access form) must still work."""

    def test_submit_without_contact_type_and_source(self, base_url, api_client, mongo_db):
        payload = {
            "fullName": "TEST_Legacy Client",
            "email": "TEST_legacy@example.com",
            "company": "Legacy Corp",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        rid = r.json()["id"]

        doc = mongo_db.investor_requests.find_one({"id": rid})
        assert doc is not None
        # contactType stored as None; source stored as "" (default)
        assert doc.get("contactType") in (None, "")
        assert doc.get("source", "") == ""

    def test_submit_with_only_source_no_contact_type(self, base_url, api_client, mongo_db):
        payload = {
            "fullName": "TEST_Source Only",
            "email": "TEST_source_only@example.com",
            "source": "homepage",
        }
        r = api_client.post(f"{base_url}/api/investor-requests", json=payload, timeout=15)
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        doc = mongo_db.investor_requests.find_one({"id": rid})
        assert doc["source"] == "homepage"
        assert doc.get("contactType") in (None, "")


class TestAdminAuthStillEnforced:
    def test_admin_list_requires_auth(self, base_url):
        s = requests.Session()
        r = s.get(f"{base_url}/api/admin/investor-requests", timeout=15)
        assert r.status_code == 401
