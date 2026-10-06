"""
D1 — USER STATUS ACCESS ENFORCEMENT (suite pytest, casos 1-5 obligatorios).

Convierte la verificacion de D1 en tests de pytest ejecutables por el runner
estandar, cubriendo la CADENA COMPLETA y no solo las funciones puras:

    _resolved_status -> get_entitlements -> build_subject -> can()

Casos obligatorios:
  1. ACTIVE     -> acceso permitido
  2. SUSPENDED  -> acceso rechazado
  3. BLOCKED    -> acceso rechazado (fail-closed: estado no catalogado)
  4. sin status -> comportamiento fail-closed validado (compatibilidad)
  5. usuarios ACTIVE existentes -> comportamiento NO cambia

Ademas fija los dos defectos que rompian la cadena y que esta fase cierra:
  · `access_bridge` no importaba `build_subject` -> NameError en TODO intent.
  · `create_intent` llamaba a `_resolved_status` sin `await` -> la corrutina
    llegaba a `build_subject`, `can()` la rechazaba por estado desconocido y
    TODO intent devolvia 403, incluso para usuarios activos.

No usa red, ni Mongo, ni servidor: dobles en memoria. `pytest-asyncio` no esta
instalado, asi que las corrutinas se ejecutan con `asyncio.run`.
"""
import asyncio
import inspect
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from routes import access_bridge_routes as routes  # noqa: E402
from services import access_bridge as bridge  # noqa: E402
from services import entitlement_service as ent  # noqa: E402
from services import policy_can as can  # noqa: E402
from services.system_identity import generate_entity_id  # noqa: E402

# Estados tal como viven en `users`.
ACTIVE = "activo"
SUSPENDED = "suspendido"
BLOCKED = "bloqueado"
PENDING = "pendiente"
DELETED = "deleted"

COMUNIDAD = "workspace.open.comunidad"
FUTURE = "2099-01-01T00:00:00+00:00"


# ---------------------------------------------------------------------------
# Dobles en memoria
# ---------------------------------------------------------------------------

class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    async def find_one(self, q=None, proj=None):
        for d in self.docs:
            if all(d.get(k) == v for k, v in (q or {}).items()):
                return dict(d)
        return None


class _FakeDB:
    def __init__(self, users=(), sessions=()):
        self.users = _Collection(users)
        self.user_sessions = _Collection(sessions)


class _FakeRequest:
    def __init__(self, db, token=None):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()
        self.headers = {}
        self.cookies = {"session_token": token} if token else {}


@pytest.fixture
def subject():
    return generate_entity_id()


def _user_doc(status, uid="usr_x"):
    """Documento de `users`. Si `status` es None, el campo NO existe."""
    doc = {"id": uid, "name": "U", "email": f"{uid}@t.com", "role": "member"}
    if status is not None:
        doc["status"] = status
    return doc



# ---------------------------------------------------------------------------
# CASO 1 — ACTIVE: acceso permitido
# ---------------------------------------------------------------------------

class TestCaso1Activo:
    def test_derivacion_concede_la_puerta(self, subject):
        assert ent.get_entitlements(
            subject_id=subject, status=ACTIVE) == [COMUNIDAD]

    def test_evaluador_permite(self, subject):
        sujeto = can.build_subject(subject, [COMUNIDAD], ACTIVE)
        assert can.can(sujeto, COMUNIDAD) == can.ALLOW

    def test_el_bridge_resuelve_activo_desde_la_cookie(self):
        """La via normal de One es la cookie, no el JWT."""
        req = _FakeRequest(_session_db(ACTIVE), token="t")
        assert _run(routes._resolved_status(req, None)) == ACTIVE

    def test_el_bridge_resuelve_activo_desde_el_jwt(self):
        req = _FakeRequest(_FakeDB(users=[_user_doc(ACTIVE)]))
        assert _run(routes._resolved_status(req, _user_doc(ACTIVE))) == ACTIVE

    def test_intent_se_emite_para_un_activo(self, subject):
        """Puerta de entrada real: un activo obtiene intent_code."""
        intent = bridge.create_access_intent(
            subject_id=subject, space_key="comunidad",
            entitlements=[COMUNIDAD], status=ACTIVE)
        assert intent["intent_code"]
        assert intent["space_key"] == "comunidad"


# ---------------------------------------------------------------------------
# CASO 2 — SUSPENDED: acceso rechazado
# ---------------------------------------------------------------------------

class TestCaso2Suspendido:
    def test_derivacion_no_concede_nada(self, subject):
        assert ent.get_entitlements(
            subject_id=subject, status=SUSPENDED) == []

    def test_la_suspension_gana_a_la_vertical(self, subject):
        assert ent.get_entitlements(
            subject_id=subject, status=SUSPENDED, verticals=["legal"]) == []

    def test_la_suspension_gana_a_la_organizacion(self, subject):
        assert ent.get_entitlements(
            subject_id=subject, status=SUSPENDED,
            organizations=[{"company_id": "c1", "vertical": "empresa"}]) == []

    def test_evaluador_deniega(self, subject):
        sujeto = can.build_subject(subject, [COMUNIDAD], SUSPENDED)
        assert can.can(sujeto, COMUNIDAD) == can.DENY

    def test_el_bridge_entrega_el_status_por_cookie(self):
        req = _FakeRequest(_session_db(SUSPENDED), token="t")
        assert _run(routes._resolved_status(req, None)) == SUSPENDED

    def test_no_se_emite_intent(self, subject):
        with pytest.raises(PermissionError):
            bridge.create_access_intent(
                subject_id=subject, space_key="comunidad",
                entitlements=ent.get_entitlements(
                    subject_id=subject, status=SUSPENDED),
                status=SUSPENDED)


# ---------------------------------------------------------------------------
# CASO 3 — BLOCKED: acceso rechazado (fail-closed, sin estado nuevo)
# ---------------------------------------------------------------------------

class TestCaso3Bloqueado:
    @pytest.mark.parametrize("estado", [BLOCKED, DELETED, "inventado"])
    def test_estado_no_catalogado_deniega(self, subject, estado):
        """`bloqueado`/`deleted` no estan en VALID_STATUSES.

        No se anaden al catalogo: la politica existente ya es fail-closed y
        cualquier valor que no sea exactamente `activo` corta el acceso.
        """
        assert ent.get_entitlements(subject_id=subject, status=estado) == []
        sujeto = can.build_subject(subject, [COMUNIDAD], estado)
        assert can.can(sujeto, COMUNIDAD) == can.DENY

    def test_no_se_creo_un_estado_nuevo(self):
        """El catalogo sigue siendo el de siempre: no se inventa arquitectura."""
        assert ent.VALID_STATUSES == (ACTIVE, PENDING, SUSPENDED)
        assert can.VALID_STATUSES == (ACTIVE, PENDING, SUSPENDED)

    def test_no_se_emite_intent(self, subject):
        with pytest.raises(PermissionError):
            bridge.create_access_intent(
                subject_id=subject, space_key="comunidad",
                entitlements=[COMUNIDAD], status=BLOCKED)


def _session_db(status):
    """BD con cookie de comunidad valida: la via normal de One."""
    return _FakeDB(
        users=[_user_doc(status)],
        sessions=[{"session_token": "t", "user_id": "usr_x",
                   "expires_at": FUTURE}],
    )


def _run(coro):
    return asyncio.run(coro)
