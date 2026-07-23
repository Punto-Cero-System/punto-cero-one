"""Health & meta endpoint tests."""
import requests


def test_health_ok(base_url, api_client):
    r = api_client.get(f"{base_url}/api/health", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("db") == "connected"


def test_root(base_url, api_client):
    r = api_client.get(f"{base_url}/api/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert "Punto Cero" in data.get("service", "")
