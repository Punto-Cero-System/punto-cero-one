"""
FASE 4.5 (adaptacion del nucleo) - `policy_can.can()` aplica la misma politica
que `entitlement_service.get_entitlements()`.

Cierra los defectos documentados en la certificacion:
  - D1: `can()` validaba solo la *existencia* de `subject.id`, no que fuera un
    `entity_id` canonico. "anonymous" o un email pasaban el gate.
  - D5: `can()` no conocia `status`. Un usuario suspendido conservaba el
    permiso si un consumidor lo invocaba fuera del Access Bridge.

Invariante: `can()` y `get_entitlements()` deben coincidir. Todo permiso que la
derivacion concede tiene que ser evaluable por el gate, y nada mas.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.entitlement_service import (  # noqa: E402
    STATUS_ACTIVE as ENT_ACTIVE,
    STATUS_PENDING as ENT_PENDING,
    STATUS_SUSPENDED as ENT_SUSPENDED,
    get_entitlements,
)
from services.policy_can import (  # noqa: E402
    ALLOW,
    DENY,
    STATUS_ACTIVE,
    STATUS_PENDING,
    STATUS_SUSPENDED,
    VALID_STATUSES,
    can,
    filter_allowed_spaces,
)
from services.workspace_registry import get_space  # noqa: E402
from services.system_identity import generate_entity_id, is_valid_entity_id  # noqa: E402

LEGAL = "workspace.open.legal"
COMUNIDAD = "workspace.open.comunidad"
MEDICAL = "workspace.open.medical"
EMPRESA = "workspace.open.empresa"
AGENTE = "workspace.open.agente"


@pytest.fixture
def subject():
    """entity_id canonico generado por la propia funcion del sistema."""
    return generate_entity_id()


def auth(subject_id, entitlements=(), status=None, **extra):
    payload = {"id": subject_id, "entitlements": list(entitlements)}
    if status is not None:
        payload["status"] = status
    payload.update(extra)
    return payload


# ─────────────────────────────────────────────────────────────────────────────
# 1. status con prioridad absoluta
# ─────────────────────────────────────────────────────────────────────────────

class TestStatusGate:
    def test_activo_permite(self, subject):
        assert can(auth(subject, [LEGAL], STATUS_ACTIVE), LEGAL) == ALLOW

    @pytest.mark.parametrize("status", [STATUS_PENDING, STATUS_SUSPENDED])
    def test_estado_no_activo_bloquea(self, subject, status):
        assert can(auth(subject, [LEGAL], status), LEGAL) == DENY

    @pytest.mark.parametrize("status", [STATUS_PENDING, STATUS_SUSPENDED])
    def test_estado_no_activo_bloquea_todas_las_acciones(self, subject, status):
        for permission in (LEGAL, COMUNIDAD, MEDICAL, EMPRESA):
            assert can(auth(subject, [permission], status), permission) == DENY

    def test_status_desconocido_es_fail_closed(self, subject):
        assert can(auth(subject, [LEGAL], "inventado"), LEGAL) == DENY

    def test_sin_status_se_asuma_activo(self, subject):
        """Compatibilidad: el Access Bridge aun no propaga status."""
        assert can(auth(subject, [LEGAL]), LEGAL) == ALLOW

    def test_status_normalizado(self, subject):
        assert can(auth(subject, [LEGAL], "  ACTIVO "), LEGAL) == ALLOW

    def test_catalogos_de_estado_coinciden(self):
        """El gate y la derivacion comparten vocabulario de estados."""
        assert set(VALID_STATUSES) == {ENT_ACTIVE, ENT_PENDING, ENT_SUSPENDED}


# ─────────────────────────────────────────────────────────────────────────────
# 2. entity_id valido antes de autorizar
# ─────────────────────────────────────────────────────────────────────────────

class TestEntityIdGate:
    @pytest.mark.parametrize(
        "sujeto",
        ["sin-id", "anonymous", "a@b.com", "cualquier-cosa", "pc_usr_XXXX",
         "", None, 12345, "PC_USR_01M3JJJ9M2XQGJQB9Z7CS7QM4F"],
    )
    def test_rechaza_entity_id_no_canonicos(self, sujeto):
        """Cierra D1: antes, cualquier string no vacio pasaba el gate."""
        assert can({"id": sujeto, "entitlements": [LEGAL]}, LEGAL) == DENY

    def test_rechaza_sujeto_ausente(self):
        assert can(None, LEGAL) == DENY
        assert can({}, LEGAL) == DENY

    def test_acepta_entity_id_generada(self):
        assert can(auth(generate_entity_id(), [LEGAL]), LEGAL) == ALLOW

    def test_subject_dict_invalido_no_revienta(self):
        assert can("no-soy-un-dict", LEGAL) == DENY

    def test_entity_id_del_fixture_es_valida(self, subject):
        assert is_valid_entity_id(subject)


# ─────────────────────────────────────────────────────────────────────────────
# 3. role jamas concede workspace
# ─────────────────────────────────────────────────────────────────────────────

class TestRoleNoConcede:
    ROLES = ["admin", "admin_system", "member", "investor", "agent", "org_admin"]

    @pytest.mark.parametrize("role", ROLES)
    def test_rol_sin_entitlement_no_abre_nada(self, subject, role):
        for permission in (LEGAL, COMUNIDAD, MEDICAL, EMPRESA):
            assert can(auth(subject, [], STATUS_ACTIVE, role=role), permission) == DENY

    @pytest.mark.parametrize("role", ROLES)
    def test_rol_es_informativo_y_no_altera_el_resultado(self, subject, role):
        sin_rol = can(auth(subject, [LEGAL], STATUS_ACTIVE), LEGAL)
        con_rol = can(auth(subject, [LEGAL], STATUS_ACTIVE, role=role), LEGAL)
        assert sin_rol == con_rol

    def test_admin_abre_legal_solo_con_entitlement(self, subject):
        assert can(auth(subject, [LEGAL], STATUS_ACTIVE, role="admin"), LEGAL) == ALLOW
        assert can(auth(subject, [], STATUS_ACTIVE, role="admin"), LEGAL) == DENY


# ─────────────────────────────────────────────────────────────────────────────
# 4. deprecated / declared conservan la semantica de 3J
# ─────────────────────────────────────────────────────────────────────────────

class TestEspaciosNoLive:
    def test_declared_exige_flag(self, subject):
        assert get_space("medical")["status"] == "declared"
        assert can(auth(subject, [MEDICAL], STATUS_ACTIVE), MEDICAL) == DENY
        permitido = can(auth(subject, [MEDICAL], STATUS_ACTIVE), MEDICAL, {"allow_non_live": True})
        assert permitido == ALLOW

    def test_live_no_exige_flag(self, subject):
        assert can(auth(subject, [LEGAL], STATUS_ACTIVE), LEGAL) == ALLOW

    def test_preview_conserva_comportamiento_pre_existente(self, subject):
        """`preview` sigue abriendo SIN flag: semantica intacta, no corregida.

        Se congela a proposito. Corregirlo cambiaria el acceso a `empresa` y no
        forma parte de esta fase.
        """
        assert get_space("empresa")["status"] == "preview"
        assert can(auth(subject, [EMPRESA], STATUS_ACTIVE), EMPRESA) == ALLOW

    def test_agente_requiere_flag_como_declared(self, subject):
        if get_space("agente") is None:
            pytest.skip("agente no esta en el registry")
        assert can(auth(subject, [AGENTE], STATUS_ACTIVE), AGENTE) == DENY


# ─────────────────────────────────────────────────────────────────────────────
# 5. Invariante: can() y get_entitlements() coinciden
# ─────────────────────────────────────────────────────────────────────────────

class TestCoherenciaConEntitlements:
    @pytest.mark.parametrize("status", [STATUS_ACTIVE, STATUS_PENDING, STATUS_SUSPENDED])
    def test_todo_permiso_derivado_pasa_el_gate(self, subject, status):
        """Si la derivacion concede, el gate lo acepta.

        Se evalua con `allow_non_live=True`, que es el contexto que usa el
        Access Bridge al pedir un intent: los espacios `declared` (medical)
        exigen ese flag por diseno, asi que sin el la derivacion y el gate
        discreparían legítimamente.
        """
        for role in ("admin", "member", "investor", "agent", "org_admin"):
            for vertical in ([], ["legal"], ["medical"]):
                for permission in get_entitlements(
                    subject_id=subject, verticals=vertical, role=role, status=status
                ):
                    decision = can(
                        auth(subject, [permission], status), permission, {"allow_non_live": True}
                    )
                    assert decision == ALLOW, permission + " derivado pero denegado"

    @pytest.mark.parametrize("status", [STATUS_PENDING, STATUS_SUSPENDED])
    def test_no_activo_no_deriva_ni_el_gate_permite(self, subject, status):
        derived = get_entitlements(subject_id=subject, verticals=["legal"], status=status)
        assert derived == []
        assert can(auth(subject, [LEGAL], status), LEGAL) == DENY

    def test_el_gate_solo_acepta_lo_que_el_sujeto_afirma(self, subject):
        """Contrato real del gate: acepta lo que el sujeto LLEVA, no lo que la
        derivacion produjo.

        `can()` no verifica que el entitlement sea autentico: verifica que este
        en la lista del sujeto. Quien produce esa lista es la derivacion
        (`entitlement_service`). El gate no inventa permisos, pero tampoco los
        valida contra la derivacion: si se le entrega `workspace.open.medical`,
        lo acepta (con su flag `declared`). Esa division de responsabilidades es
        intencional y es la que hace el gate utilizable desde cualquier capa.
        """
        # El sujeto carga EXACTAMENTE lo que la derivacion le produjo.
        derived = set(get_entitlements(
            subject_id=subject, verticals=["legal"], role="admin", status=STATUS_ACTIVE
        ))
        sujeto = auth(subject, sorted(derived), STATUS_ACTIVE)
        # Derivado y affirmations en el sujeto -> allow.
        for permission in derived:
            assert can(sujeto, permission) == ALLOW, permission
        # No derivado y ausente del sujeto -> deny, con y sin flag.
        for permission in (MEDICAL, EMPRESA, AGENTE):
            if permission not in derived:
                assert can(sujeto, permission) == DENY, permission
                assert can(sujeto, permission, {"allow_non_live": True}) == DENY

    def test_entitlement_ausente_denuega_aunque_este_derivado_otro(self, subject):
        """El gate evalua la lista del sujeto, no la derivacion global."""
        derived = get_entitlements(
            subject_id=subject, verticals=["legal"], role="admin", status=STATUS_ACTIVE
        )
        assert COMUNIDAD in derived
        solo_legal = auth(subject, [LEGAL], STATUS_ACTIVE)
        assert can(solo_legal, LEGAL) == ALLOW
        assert can(solo_legal, COMUNIDAD) == DENY

    def test_el_gate_nunca_amplia_la_lista_del_sujeto(self, subject):
        """Sin entitlement no hay autorizacion, aunque el espacio sea valido."""
        vacio = auth(subject, [], STATUS_ACTIVE)
        for permission in (LEGAL, COMUNIDAD, MEDICAL, EMPRESA, AGENTE):
            assert can(vacio, permission) == DENY
            assert can(vacio, permission, {"allow_non_live": True}) == DENY

    def test_excepcion_preview_documentada(self, subject):
        """`empresa` (preview) pasa el gate sin estar derivada. D2 abierto."""
        derived = get_entitlements(
            subject_id=subject, verticals=["legal"], role="admin", status=STATUS_ACTIVE
        )
        decision = can(auth(subject, [EMPRESA], STATUS_ACTIVE), EMPRESA)
        assert EMPRESA not in derived          # la derivacion no lo produjo
        assert decision == ALLOW               # pero el gate no lo bloquea


# ─────────────────────────────────────────────────────────────────────────────
# 6. filter_allowed_spaces hereda la politica
# ─────────────────────────────────────────────────────────────────────────────

class TestFilterAllowedSpaces:
    def test_filtra_por_entitlement(self, subject):
        spaces = [
            {"space_key": "legal", "permission": LEGAL},
            {"space_key": "medical", "permission": MEDICAL},
        ]
        out = filter_allowed_spaces(auth(subject, [LEGAL], STATUS_ACTIVE), spaces)
        assert [s["space_key"] for s in out] == ["legal"]

    def test_suspendido_no_filtra_ninguno(self, subject):
        spaces = [{"space_key": "legal", "permission": LEGAL}]
        assert filter_allowed_spaces(auth(subject, [LEGAL], STATUS_SUSPENDED), spaces) == []

    def test_entity_id_invalido_no_filtra_ninguno(self):
        spaces = [{"space_key": "legal", "permission": LEGAL}]
        assert filter_allowed_spaces(auth("sin-id", [LEGAL], STATUS_ACTIVE), spaces) == []
