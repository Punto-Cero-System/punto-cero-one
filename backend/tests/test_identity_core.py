"""Identity Core V1 tests — GET /api/auth/system-context (FASE 13.1).

Patrón del repo: tests de integración contra servidor vivo, seeding pymongo
con prefijo TEST_ y limpieza en teardown (ver tests/test_community_auth.py).
Cubre los 5 casos obligatorios + verticales/organización + login existente.
"""
import contextlib
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

from auth import hash_password  # misma rutina bcrypt que usa /api/auth/login


_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO_DIR = os.path.dirname(_BACKEND_DIR)


def _read_env_file(path, key):
    """Lee una única clave de un .env sin dependencias extra."""
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _load_base_url():
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if not val:
        # Mismo fallback que conftest, pero apuntando a frontend/.env del repo.
        val = _read_env_file(os.path.join(_REPO_DIR, "frontend", ".env"), "REACT_APP_BACKEND_URL")
    return (val or "http://localhost:8000").rstrip("/")


def _load_mongo_settings():
    """MONGO_URL/DB_NAME deben coincidir con el backend en ejecución.

    El servidor local usa backend/.env (MONGO_URL + DB_NAME=punto_cero_local);
    si el test sembrara en otra base, el login JWT devolvería 401.
    """
    mongo_url = os.environ.get("MONGO_URL") or _read_env_file(os.path.join(_BACKEND_DIR, ".env"), "MONGO_URL")
    db_name = os.environ.get("DB_NAME") or _read_env_file(os.path.join(_BACKEND_DIR, ".env"), "DB_NAME")
    return (mongo_url or "mongodb://localhost:27017", db_name or "test_database")


BASE_URL = _load_base_url()
MONGO_URL, DB_NAME = _load_mongo_settings()


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def server_up():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    if r.status_code != 200:
        pytest.skip(f"Backend no disponible ({r.status_code})")
    return True


def _seed_user(db, *, verticals=None, headline=None, with_password=None, with_session=False, role="member"):
    """Generador de usuario TEST_: next() lo siembra, close() lo limpia.

    `db` (pymongo) se recibe por parámetro para no chocar con el nombre del
    fixture `db` a nivel de módulo.
    IMPORTANTE: para usuarios que harán login JWT pasar role="admin" (o
    "investor"): el contrato preexistente UserPublic/UserRole solo acepta
    esos roles y /api/auth/login respondería 500 con "member".
    """
    ts = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_icore_{ts}_{suffix}"
    email = f"test_icore_{ts}_{suffix}@example.com"
    doc = {
        "id": user_id,
        "email": email,
        "name": f"Identity Core Test {suffix}",
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if verticals is not None:
        doc["verticals"] = verticals
    if headline:
        doc["headline"] = headline
    if with_password:
        doc["password_hash"] = hash_password(with_password)
    db.users.insert_one(doc)

    session_token = None
    if with_session:
        session_token = f"TEST_icore_sess_{uuid.uuid4().hex}"
        db.user_sessions.insert_one(
            {
                "user_id": user_id,
                "session_token": session_token,
                "provider": "google",
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    data = {"user_id": user_id, "email": email, "password": with_password, "session_token": session_token}
    yield data
    db.user_sessions.delete_many({"user_id": user_id})
    db.companies.delete_many({"owner_id": user_id})
    db.companies.delete_many({"team.user_id": user_id})
    db.login_attempts.delete_many({"identifier": {"$regex": email}})
    db.users.delete_one({"id": user_id})


def _jwt_login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@contextlib.contextmanager
def _seed(db, **kwargs):
    gen = _seed_user(db, **kwargs)
    data = next(gen)
    try:
        yield data
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


def _ctx_request(token=None, cookies=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(
        f"{BASE_URL}/api/auth/system-context",
        headers=headers,
        cookies=cookies or {},
        timeout=15,
    )


def test_system_context_requires_authentication(server_up):
    r = requests.get(f"{BASE_URL}/api/auth/system-context", timeout=15)
    assert r.status_code == 401, r.text


def test_jwt_only_context(server_up, db):
    with _seed(db, verticals=["legal"], with_password="Secret#2026", role="admin") as u:
        token = _jwt_login(u["email"], u["password"])
        r = _ctx_request(token=token)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["sources"] == ["jwt"]
        assert body["session"]["unified"] is False
        assert body["identity"]["account_type"] == "profesional"
        assert body["identity"]["primary_vertical"] == "legal"
        assert body["identity"]["verticals_source"] == "verticals"
        assert body["workspaces"]["recommended"] == "legal"
        assert body["workspaces"]["recommended_reason"] == "verticals"
        assert body["organizations"] == []
        assert body["user"]["id"] == u["user_id"]
        assert "password_hash" not in body["user"]


def test_community_only_context(server_up, db):
    with _seed(db, headline="Médico clínico", with_session=True) as u:
        r = _ctx_request(cookies={"session_token": u["session_token"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["sources"] == ["community"]
        assert body["session"]["unified"] is False
        assert body["identity"]["account_type"] == "profesional"
        assert body["identity"]["primary_vertical"] == "medical"
        assert body["identity"]["verticals_source"] == "profile"


def test_unified_when_same_user(server_up, db):
    with _seed(db, verticals=["legal"], with_password="Secret#2026", with_session=True, role="admin") as u:
        token = _jwt_login(u["email"], u["password"])
        r = _ctx_request(token=token, cookies={"session_token": u["session_token"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["sources"] == ["jwt", "community"]
        assert body["session"]["unified"] is True


def test_conflict_when_different_users(server_up, db):
    with _seed(db, verticals=["legal"], with_password="Secret#2026", role="admin") as jwt_u:
        with _seed(db, with_session=True) as comm_u:
            token = _jwt_login(jwt_u["email"], jwt_u["password"])
            r = _ctx_request(token=token, cookies={"session_token": comm_u["session_token"]})
            assert r.status_code == 409, r.text
            detail = r.json()["detail"]
            assert detail["code"] == "identity_conflict"
            assert detail["jwt_user_id"] == jwt_u["user_id"]
            assert detail["community_user_id"] == comm_u["user_id"]


def test_organizations_owner_recommendation(server_up, db):
    with _seed(db, with_password="Secret#2026", role="admin") as u:
        company_id = f"TEST_icore_co_{u['user_id']}"
        db.companies.insert_one({
            "id": company_id,
            "name": "Estudio Test S.A.",
            "vertical": "legal",
            "owner_id": u["user_id"],
            "team": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            token = _jwt_login(u["email"], u["password"])
            r = _ctx_request(token=token)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["identity"]["account_type"] == "empresa"
            assert body["organizations"][0]["company_id"] == company_id
            assert body["organizations"][0]["relation"] == "owner"
            assert body["workspaces"]["recommended"] == "empresa"
            assert body["workspaces"]["recommended_reason"] == "organizations"
        finally:
            db.companies.delete_one({"id": company_id})


def test_team_member_relation(server_up, db):
    with _seed(db, with_password="Secret#2026") as owner:
        with _seed(db, verticals=["legal"], with_password="Secret#2026", role="admin") as member:
            company_id = f"TEST_icore_co_{owner['user_id']}"
            db.companies.insert_one({
                "id": company_id,
                "name": "Estudio Test Dos",
                "vertical": "legal",
                "owner_id": owner["user_id"],
                "team": [{"user_id": member["user_id"], "role": "abogado"}],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            try:
                token = _jwt_login(member["email"], member["password"])
                r = _ctx_request(token=token)
                assert r.status_code == 200, r.text
                body = r.json()
                # F13.1.1: la vertical propia gana sobre la membresía; la
                # relación con la firma queda intacta en organizations[].
                assert body["identity"]["account_type"] == "profesional"
                assert body["workspaces"]["recommended"] == "legal"
                assert body["workspaces"]["recommended_reason"] == "verticals"
                assert body["organizations"][0]["relation"] == "member"
                assert body["organizations"][0]["role"] == "abogado"
            finally:
                db.companies.delete_one({"id": company_id})


def test_professional_with_firm_membership_recommends_legal(server_up, db):
    """F13.1.1 — profesional dueño de firma: naturaleza profesional gana.

    Un abogado con vertical legal activa debe ser "profesional" con espacio
    recomendado "legal" (reason=verticals), aunque sea owner de una firma;
    organizations[] conserva la relación sin perderse.
    """
    with _seed(db, verticals=["legal"], with_password="Secret#2026", role="admin") as u:
        company_id = f"TEST_icore_co_{u['user_id']}"
        db.companies.insert_one({
            "id": company_id,
            "name": "Firma Legal del Test",
            "vertical": "legal",
            "owner_id": u["user_id"],
            "team": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            token = _jwt_login(u["email"], u["password"])
            r = _ctx_request(token=token)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["identity"]["account_type"] == "profesional"
            assert body["workspaces"]["recommended"] == "legal"
            assert body["workspaces"]["recommended_reason"] == "verticals"
            assert body["organizations"][0]["relation"] == "owner"
        finally:
            db.companies.delete_one({"id": company_id})


def test_existing_login_and_me_unchanged(server_up, db):
    with _seed(db, verticals=["legal"], with_password="Secret#2026", role="admin") as u:
        token = _jwt_login(u["email"], u["password"])
        me = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert me.status_code == 200, me.text
        assert me.json()["email"] == u["email"]
        anon = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert anon.status_code == 401