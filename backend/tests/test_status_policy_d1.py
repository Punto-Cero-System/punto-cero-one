"""
FASE 4.3.4 - D1 CERRADA: `status` del usuario llega al Access Bridge.

Cierra el hueco detectado en FASE 4.3.3: la regla D1 (One solo para usuarios
activos) estaba IMPLEMENTADA en `entitlement_service` pero el Bridge no le
pasaba `status`, asi que en produccion la suspension no surtia efecto.

Estos tests fijan tres cosas:
  1. La derivacion depende de `status` (activo / pendiente / suspendido).
  2. El Bridge PROPAGA el `status` real a `get_entitlements`.
  3. La suspension gana a `role` y a `vertical`: status > role > vertical.

No usa red ni servidor: `pytest-asyncio` no esta instalado, asi que las
pruebas de `_access_context` se ejecutan con `asyncio.run`.
"""
import asyncio
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import access_bridge_routes as bridge  # noqa: E402
from services.entitlement_service import (  # noqa: E402
    STATUS_ACTIVE,
    STATUS_PENDING,
    STATUS_SUSPENDED,
    get_entitlements,
)
from routes.access_bridge_routes import _spaces_from_entitlements  # noqa: E402
from services.system_identity import generate_entity_id  # noqa: E402

LEGAL = "workspace.open.legal"
COMUNIDAD = "workspace.open.comunidad"


@pytest.fixture
def subject():
    return generate_entity_id()


def spaces_of(entitlements):
    return _spaces_from_entitlements(entitlements)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Derivacion por estado
# ─────────────────────────────────────────────────────────────────────────────

class TestStatusPolicy:
    """La regla D1: `status` gobierna TODOS los espacios."""

    def test_status_active(self, subject):
        """CASO 1 - member sin verticales, activo -> One como puerta."""
        spaces = spaces_of(get_entitlements(subject_id=subject, role="member",
                                            verticals=[], status=STATUS_ACTIVE))
        assert spaces == ["comunidad"]

    def test_status_active_profesional(self, subject):
        """CASO 2 - verticals + activo -> vertical + One."""
        entitlements = get_entitlements(subject_id=subject, role="member",
                                        verticals=["legal"], status=STATUS_ACTIVE)
        assert spaces_of(entitlements) == ["legal", "comunidad"]
        assert LEGAL in entitlements

    def test_status_pending(self, subject):
        """CASO 3 - pendiente -> sin espacios, NI por vertical."""
        entitlements = get_entitlements(subject_id=subject, role="member",
                                        verticals=["legal"], status=STATUS_PENDING)
        assert entitlements == []
        assert spaces_of(entitlements) == []

    def test_status_suspended(self, subject):
        """CASO 4 - suspendido -> sin espacios, aunque sea admin con vertical."""
        entitlements = get_entitlements(subject_id=subject, role="admin",
                                        verticals=["legal"], status=STATUS_SUSPENDED)
        assert entitlements == []
        assert spaces_of(entitlements) == []

    def test_estado_desconocido_es_fail_closed(self, subject):
        """Un estado no catalogado NO concede: fail-closed."""
        assert get_entitlements(subject_id=subject, verticals=["legal"],
                                status="inventado") == []

    def test_sin_status_se_asume_activo(self, subject):
        """Compatibilidad: usuario sin campo `status` se trata como activo.

        Es lo que preserva a los usuarios creados antes de 4.1.
        """
        assert spaces_of(get_entitlements(subject_id=subject, role="member",
                                          verticals=[])) == ["comunidad"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Precedencia: status > role > vertical
# ─────────────────────────────────────────────────────────────────────────────

class TestPrecedencia:

    def test_suspension_gana_a_role_y_vertical(self, subject):
        """admin + verticals=[legal] + suspendido = SIN espacios.

        Antes de D1 este mismo sujeto-era `legal` (por rol y por vertical).
        Ahora el corte lo produce `status`, por encima de ambos.
        """
        kwargs = dict(subject_id=subject, role="admin", verticals=["legal"])
        suspendido = spaces_of(get_entitlements(**kwargs, status=STATUS_SUSPENDED))
        activo = spaces_of(get_entitlements(**kwargs, status=STATUS_ACTIVE))
        assert suspendido == []                  # suspendido: nada
        assert activo == ["legal", "comunidad"]  # activo: acceso completo
        assert suspendido != activo             # la suspension cambia el resultado

    def test_status_activo_es_el_unico_que_concede(self, subject):
        for estado in (STATUS_PENDING, STATUS_SUSPENDED, "raro"):
            assert get_entitlements(subject_id=subject, role="admin_system",
                                    verticals=["legal"], status=estado) == []

    def test_organizacion_tampoco_sobrevive_a_la_suspension(self, subject):
        """El corte es total: ni vertical ni organizacion."""
        assert get_entitlements(subject_id=subject, role="member",
                                organizations=[{"vertical": "empresa", "company_id": "c1"}],
                                status=STATUS_SUSPENDED) == []


# ─────────────────────────────────────────────────────────────────────────────
# 3. El Bridge propaga `status` (cierre real de D1)
# ─────────────────────────────────────────────────────────────────────────────

class _FakeState:
    def __init__(self, db):
        self.db = db


class _FakeApp:
    def __init__(self, db):
        self.state = _FakeState(db)


class _FakeRequest:
    def __init__(self, db):
        self.app = _FakeApp(db)


def _run_access_context(jwt_user):
    """Ejecuta `_access_context` con las dependencias pesadas simuladas.

    Sustituye `current_user_or_none`, `resolve_identity` y
    `resolve_system_identity`. `get_entitlements` se envuelve para capturar
    el `status` que el Bridge realmente entrega y el resultado que devuelve.
    """
    entity = generate_entity_id()
    captured = {}

    async def fake_current_user_or_none(_request):
        return None

    async def fake_resolve_identity(_db, jwt_user=None, community_user=None):
        return {"identity": {"account_type": "personal", "verticals": ["legal"]},
                "organizations": []}

    async def fake_resolve_system_identity(_db, jwt_user=None, community_user=None):
        return {"entity_id": entity}

    real = bridge.entitlements.get_entitlements
    origs = (bridge.current_user_or_none, bridge.resolve_identity,
             bridge.resolve_system_identity)

    def spy(**kwargs):
        captured.update(kwargs)
        captured["result"] = real(**kwargs)
        return captured["result"]

    bridge.current_user_or_none = fake_current_user_or_none
    bridge.resolve_identity = fake_resolve_identity
    bridge.resolve_system_identity = fake_resolve_system_identity
    bridge.entitlements.get_entitlements = spy
    try:
        asyncio.run(bridge._access_context(_FakeRequest(object()), jwt_user))
    finally:
        (bridge.current_user_or_none, bridge.resolve_identity,
         bridge.resolve_system_identity) = origs
        bridge.entitlements.get_entitlements = real
    return captured


class TestBridgePropagaStatus:
    """El cierre de D1: el Bridge entrega el `status` real."""

    def test_bridge_propagates_status_activo(self):
        c = _run_access_context({"id": "u1", "email": "a@b.com",
                                  "role": "admin", "status": STATUS_ACTIVE})
        assert c["status"] == STATUS_ACTIVE

    def test_bridge_propagates_status_suspendido(self):
        c = _run_access_context({"id": "u1", "email": "a@b.com",
                                  "role": "admin", "status": STATUS_SUSPENDED})
        assert c["status"] == STATUS_SUSPENDED

    def test_bridge_propaga_none_si_el_usuario_no_tiene_status(self):
        """Compatibilidad: sin campo `status` viaja `None` (-> activo)."""
        c = _run_access_context({"id": "u1", "email": "a@b.com", "role": "admin"})
        assert c["status"] is None
        assert c["result"] == [LEGAL, COMUNIDAD]

    def test_bridge_sigue_pasando_role_verticals_y_subject(self):
        """D1 no removio ningun otro argumento."""
        c = _run_access_context({"id": "u1", "email": "a@b.com",
                                  "role": "admin", "status": STATUS_ACTIVE})
        assert c["role"] == "admin"
        assert c["verticals"] == ["legal"]
        assert c["subject_id"]

    def test_bridge_suspendido_devuelve_entitlements_vacios(self):
        """Efecto final en la respuesta del Bridge: sin permisos."""
        c = _run_access_context({"id": "u1", "email": "a@b.com", "role": "admin",
                                  "status": STATUS_SUSPENDED})
        assert c["result"] == []

    def test_bridge_activo_devuelve_entitlements_completos(self):
        c = _run_access_context({"id": "u1", "email": "a@b.com", "role": "admin",
                                  "status": STATUS_ACTIVE})
        assert c["result"] == [LEGAL, COMUNIDAD]

