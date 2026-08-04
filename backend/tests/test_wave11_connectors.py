"""Wave 11 — LATAM Public Data Connector Framework tests."""
from __future__ import annotations

import asyncio
import os
import sys
import time

import pytest
import requests

# Make backend package importable for direct unit-level tests
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@puntocerosystem.com"
ADMIN_PASSWORD = "PuntoCero2026Admin"


# ---------- unit tests on the framework ----------
class TestConnectorBase:
    def test_bare_stub_missing_credentials(self):
        from services.growth.connectors import PublicDataConnector

        class Stub(PublicDataConnector):
            def normalize(self, e): return None
            async def _fetch(self): return []

        c = Stub(id="x", name="X", country="CO",
                 requires_credentials=True, env_keys=("X_MISSING_KEY_TEST",))
        assert c.is_configured() is False
        h = c.health()
        assert h["configured"] is False
        assert h["requires_credentials"] is True

        async def _run():
            import motor.motor_asyncio  # noqa
            # No DB needed since sync should short-circuit
            res = await c.sync(db=None)
            return res

        res = asyncio.get_event_loop().run_until_complete(_run())
        assert res["skipped"] == "missing_credentials"
        assert res["ingested"] == 0

    def test_ckan_normalize_and_validate(self):
        from services.growth.connectors.ckan import CKANConnector
        c = CKANConnector(id="co-x", name="Test", country="CO",
                          base_url="https://example.org")
        sample = {
            "id": "abc-1", "name": "abc-1", "title": "Dataset X",
            "notes": "Descripcion", "metadata_modified": "2025-01-01T00:00:00",
            "organization": {"title": "MinTIC"},
            "tags": [{"name": "salud"}, {"name": "educacion"}],
            "resources": [{}, {}],
        }
        item = c.normalize(sample)
        assert item is not None
        assert item["id"].startswith("ck_")
        assert item["country"] == "CO"
        assert item["kind"] == "public_dataset"
        assert item["vertical"] == "instituciones"
        assert item["title"] == "Dataset X"
        assert item["summary"] == "Descripcion"
        assert item["url"].startswith("https://example.org")
        assert isinstance(item["tags"], list)
        assert c.validate(item) is True

    def test_circuit_breaker(self):
        from services.growth.connectors.registry import get as get_registry
        conns = get_registry()
        # Pick an operational (configured) CKAN one
        op = next(c for c in conns if c.is_configured())

        class FakeCol:
            async def update_one(self, *a, **k): raise AssertionError("db write should be skipped")
            async def insert_one(self, *a, **k): return None

        class FakeDB:
            growth_items = FakeCol()
            source_syncs = FakeCol()

        op._fail_streak = 6
        op._last_sync_at = time.time()
        res = asyncio.get_event_loop().run_until_complete(op.sync(FakeDB()))
        assert res.get("skipped") == "circuit_breaker"
        # cleanup
        op._fail_streak = 0
        op._last_sync_at = None


# ---------- registry / countries ----------
class TestRegistry:
    def test_registry_size_and_countries(self):
        from services.growth.connectors.registry import get as get_registry
        conns = get_registry()
        assert len(conns) >= 40
        countries = {c.country for c in conns}
        expected = {"AR", "BO", "BR", "CL", "CO", "CR", "DO", "EC", "ES",
                    "GT", "HN", "MX", "PA", "PE", "PY", "SV", "UY"}
        assert expected.issubset(countries)

    def test_prepared_stubs_count_and_ids(self):
        from services.growth.connectors.registry import get as get_registry
        conns = get_registry()
        stubs = [c for c in conns if c.requires_credentials]
        assert len(stubs) >= 20
        ids = {c.id for c in stubs}
        expected_ids = {
            "br-openfinance", "co-secop", "co-rues", "co-spe",
            "mx-denue", "ar-saij", "cl-chilecompra",
            "pe-sunat", "pe-sunarp", "ec-sri", "ec-sercop",
            "pa-panamacompra", "uy-dgi", "cr-sicop", "do-dgii",
            "gt-guatecompras", "hn-honducompras", "bo-seprec",
            "py-dncp", "es-sepe",
            "global-mercadolibre", "global-shopify", "global-belvo",
            "global-prometeo",
        }
        missing = expected_ids - ids
        assert not missing, f"missing prepared stubs: {missing}"

    def test_all_stubs_skip_gracefully(self):
        from services.growth.connectors.registry import get as get_registry
        conns = [c for c in get_registry() if c.requires_credentials]

        async def _run(c):
            return await c.sync(db=None)

        loop = asyncio.get_event_loop()
        for c in conns:
            res = loop.run_until_complete(_run(c))
            assert res.get("skipped") == "missing_credentials", (c.id, res)


# ---------- endpoint ----------
class TestConnectorsEndpoint:
    def test_matrix_shape(self):
        r = requests.get(f"{BASE_URL}/api/growth/connectors", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 40
        assert isinstance(d["connectors"], list)
        assert isinstance(d["by_country"], list)
        keys = {"id", "name", "country", "kind", "configured",
                "last_sync_status", "last_error", "last_ingested",
                "ttl_seconds", "next_run_in_seconds"}
        sample = d["connectors"][0]
        missing = keys - set(sample.keys())
        assert not missing, f"missing keys: {missing}"
        for bc in d["by_country"]:
            for k in ("operational", "pending", "requires_credentials", "error"):
                assert k in bc

    def test_at_least_three_ok(self):
        deadline = time.time() + 60
        oks = []
        while time.time() < deadline:
            r = requests.get(f"{BASE_URL}/api/growth/connectors", timeout=30)
            d = r.json()
            oks = [c for c in d["connectors"] if c["last_sync_status"] == "ok"]
            if len(oks) >= 3:
                break
            time.sleep(4)
        assert len(oks) >= 3, f"only {len(oks)} operational connectors"


# ---------- admin force sync ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:120]}")
    return r.json()["access_token"]


class TestAdminForceSync:
    def test_force_sync_unauthorised(self):
        r = requests.post(f"{BASE_URL}/api/growth/connectors/pa-datosabiertos/sync",
                          timeout=30)
        assert r.status_code in (401, 403)

    def test_force_sync_admin(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/growth/connectors/pa-datosabiertos/sync",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=60)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert "ok" in d and "ingested" in d and "updated" in d and "elapsed_ms" in d

    def test_force_sync_unknown_connector(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/growth/connectors/does-not-exist/sync",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=30)
        assert r.status_code == 404


# ---------- growth_items persistence ----------
class TestGrowthItemsPersisted:
    def test_public_dataset_count(self):
        # Give scheduler a moment to run
        deadline = time.time() + 90
        count = 0
        while time.time() < deadline:
            r = requests.get(f"{BASE_URL}/api/growth/connectors", timeout=30)
            d = r.json()
            count = sum(c["last_ingested"] for c in d["connectors"]
                        if c["kind"] == "public_dataset")
            oks = sum(1 for c in d["connectors"] if c["last_sync_status"] == "ok")
            if oks >= 3 and count >= 20:
                break
            time.sleep(6)
        # Verify direct DB count via a simple Mongo query
        import motor.motor_asyncio
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        cli = motor.motor_asyncio.AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]

        async def _count():
            n = await db.growth_items.count_documents({"kind": "public_dataset"})
            sample = await db.growth_items.find_one({"kind": "public_dataset"})
            return n, sample

        n, sample = asyncio.get_event_loop().run_until_complete(_count())
        assert n >= 100, f"only {n} public_dataset items"
        assert sample and sample.get("country") and sample.get("source_id")


# ---------- regression: existing discovery still works ----------
class TestDiscoveryRegression:
    def test_entity_related_co(self):
        r = requests.get(f"{BASE_URL}/api/discovery/entity/microsoft/related",
                         params={"country": "CO"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "news" in d or "similar" in d

    def test_trending_country_co(self):
        r = requests.get(f"{BASE_URL}/api/discovery/trending",
                         params={"scope": "country", "country": "CO"}, timeout=30)
        assert r.status_code == 200


# ---------- scheduler log ----------
class TestSchedulerLog:
    def test_connectors_tick_ran_in_logs(self):
        import glob, subprocess
        logs = glob.glob("/var/log/supervisor/backend.*.log")
        found = False
        for p in logs:
            try:
                with open(p, "r", errors="ignore") as f:
                    if "connectors tick ran=" in f.read():
                        found = True
                        break
            except Exception:
                continue
        assert found, "no 'connectors tick ran=' entry in backend logs"
