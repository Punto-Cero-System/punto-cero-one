"""
FASE 3G - Tests de caracterizacion de la politica de acceso.

CONGELAN el comportamiento ACTUAL de `entitlement_service` y del Identity
Contract ANTES de cualquier cambio de politica para Registro Universal.

REGLA DE ORO: estos tests NO describen lo que la politica DEBERIA ser.
Describen lo que hoy HACE, incluidas las decisiones que se intends cambiar
en la Fase 4 (p. ej. `role` otorga espacios, `comunidad` es incondicional).

Cuando la politica cambie deliberadamente, estos tests deben FALLAR primero.
Ese fallo es la senal de que el cambio es consciente. No se "arreglan"
ajustando expectativas sin registrar la decision.

Verificado empiricamente contra el codigo real. Sin cambios de logica, sin
JWT, sin datos reales, sin migraciones.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.access_bridge_routes import _spaces_from_entitlements  # noqa: E402
from services import workspace_registry as registry  # noqa: E402
from services.entitlement_service import get_entitlements  # noqa: E402
from services.policy_can import can  # noqa: E402
from services.system_identity import (  # noqa: E402
    build_identity_contract,
    generate_entity_id,
    is_valid_entity_id,
)

LEGAL = "workspace.open.legal"
EMPRESA = "workspace.open.empresa"
COMUNIDAD = "workspace.open.comunidad"
MEDICAL = "workspace.open.medical"


@pytest.fixture
def subject():
    """entity_id valido, generado por la propia funcion del sistema."""
    return generate_entity_id()


def spaces_of(entitlements):
    """Puente derivacion -> Identity Contract, igual que el endpoint real."""
    return _spaces_from_entitlements(entitlements)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Entitlement actual por roles
# ─────────────────────────────────────────────────────────────────────────────

class TestEntitlementPorRol:
    """COMPORTAMIENTO ACTUAL: `role` OTORGA espacios via _ROLE_TO_SPACES.

    Es uno de los tres problemas que la Fase 3F detecto. Se congela tal cual
    para que el cambio de politica en Fase 4 sea visible como fallo.
    """

    def test_admin_otorga_legal_y_comunidad(self, subject):
        assert get_entitlements(subject_id=subject, role="admin") == [LEGAL, COMUNIDAD]

    def test_investor_otorga_empresa_y_comunidad(self, subject):
        assert get_entitlements(subject_id=subject, role="investor") == [EMPRESA, COMUNIDAD]

    def test_admin_y_admin_vertical_legal_no_duplica(self, subject):
        """`_grant` deduplica: legal por rol y por vertical cuentan una vez."""
        entitlements = get_entitlements(subject_id=subject, role="admin", verticals=["legal"])
        assert entitlements == [LEGAL, COMUNIDAD]
        assert entitlements.count(LEGAL) == 1

    def test_rol_desconocido_no_otorga_espacio_alguno(self, subject):
        """Un rol fuera del mapa no otorga nada... salvo comunidad."""
        assert get_entitlements(subject_id=subject, role="moderator") == [COMUNIDAD]

    def test_rol_none_no_otorga_espacio_alguno(self, subject):
        assert get_entitlements(subject_id=subject, role=None) == [COMUNIDAD]

    def test_rol_es_case_insensitive(self, subject):
        assert get_entitlements(subject_id=subject, role="ADMIN") == [LEGAL, COMUNIDAD]
        assert get_entitlements(subject_id=subject, role="Investor") == [EMPRESA, COMUNIDAD]

    def test_rol_con_espacios_al_rededor_se_normaliza(self, subject):
        assert get_entitlements(subject_id=subject, role="  admin  ") == [LEGAL, COMUNIDAD]

    def test_admin_mas_vertical_medical_agrega_medical(self, subject):
        """El rol aporta legal; la vertical aporta medical. Se acumulan."""
        entitlements = get_entitlements(subject_id=subject, role="admin", verticals=["medical"])


# ─────────────────────────────────────────────────────────────────────────────
# 2. Regla comunidad
# ─────────────────────────────────────────────────────────────────────────────

class TestReglaComunidad:
    """COMPORTAMIENTO ACTUAL: `comunidad` se otorga a TODO sujeto con id.

    Consecuencia de la Fase 3E: `available_spaces` nunca puede tener un solo
    elemento cuando hay rol, asi que el redirect automatico no ocurre.
    """

    @pytest.mark.parametrize("role", ["admin", "investor", "member", "moderator", None, ""])
    def test_comunidad_presente_para_cualquier_rol(self, subject, role):
        assert COMUNIDAD in get_entitlements(subject_id=subject, role=role)

    @pytest.mark.parametrize(
        "verticals",
        [[], ["legal"], ["medical"], ["empresa"], ["comunidad"], ["desconocida"]],
    )
    def test_comunidad_presente_para_cualquier_vertical(self, subject, verticals):
        assert COMUNIDAD in get_entitlements(subject_id=subject, verticals=verticals)

    @pytest.mark.parametrize(
        "organizations",
        [[], [{"vertical": "empresa"}], [{"company_id": "c1"}]],
    )
    def test_comunidad_presente_para_cualquier_organizacion(self, subject, organizations):
        assert COMUNIDAD in get_entitlements(subject_id=subject, organizations=organizations)

    def test_comunidad_ausente_sin_subject_id(self):
        """SIN subject_id NO hay comunidad, y no hay ningun otro espacio.

        RIESGO DOCUMENTADO: la unica barrera al acceso es `can()`, que exige
        `subject.id`. Sin sujeto, `get_entitlements` igual devuelve permisos,
        pero `can()` los deniega todos. No se corrige: se congela.
        """
        assert COMUNIDAD not in get_entitlements(subject_id=None, verticals=["legal"])

    def test_subject_id_vacio_tampoco_otorga_comunidad(self):
        assert COMUNIDAD not in get_entitlements(subject_id="", role="admin")

    def test_comunidad_es_ultimo_en_el_orden(self, subject):
        """Orden estable: verticales, organizaciones, rol, y comunidad al final."""
        entitlements = get_entitlements(
            subject_id=subject, role="admin", verticals=["medical"],
            organizations=[{"company_id": "c1"}],
        )
        assert entitlements == [MEDICAL, EMPRESA, LEGAL, COMUNIDAD]


# ─────────────────────────────────────────────────────────────────────────────
# 3. Identity Contract
# ─────────────────────────────────────────────────────────────────────────────

class TestIdentityContract:
    """COMPORTAMIENTO ACTUAL del contrato que consume el Login Bridge."""

    def test_contrato_expone_los_cuatro_bloques(self, subject):
        contract = build_identity_contract(subject, available_spaces=["legal", "comunidad"])
        assert set(contract) == {"entity_id", "system", "identity_type", "available_spaces"}

    def test_system_es_punto_cero_system_por_defecto(self, subject):
        assert build_identity_contract(subject)["system"] == "punto_cero_system"

    def test_system_por_defecto_no_lo_elige_el_consumidor(self, subject):
        """Sin `system` explicito, sale del Registry (`get_owner_token`)."""
        assert build_identity_contract(subject)["system"] == "punto_cero_system"

    def test_system_invalido_es_rechazado(self, subject):
        with pytest.raises(ValueError) as exc:
            build_identity_contract(subject, system="sistema_inventado")
        assert "source_no_permitido" in str(exc.value)

    def test_identity_type_por_defecto_es_personal(self, subject):
        assert build_identity_contract(subject)["identity_type"] == "personal"

    def test_identity_type_se_puede_explicitar(self, subject):
        contract = build_identity_contract(subject, identity_type="profesional")
        assert contract["identity_type"] == "profesional"

    def test_available_spaces_se_normaliza_a_minusculas(self, subject):
        contract = build_identity_contract(subject, available_spaces=["LEGAL", " Comunidad "])
        assert contract["available_spaces"] == ["legal", "comunidad"]

    def test_available_spaces_deduplica_conservando_orden(self, subject):
        contract = build_identity_contract(subject, available_spaces=["legal", "legal", "comunidad"])
        assert contract["available_spaces"] == ["legal", "comunidad"]

    def test_available_spaces_vacio_es_lista_vacia(self, subject):
        assert build_identity_contract(subject, available_spaces=[])["available_spaces"] == []

    def test_available_spaces_descarta_vacios_y_none(self, subject):
        contract = build_identity_contract(subject, available_spaces=["legal", "", None, "  "])
        assert contract["available_spaces"] == ["legal"]

    def test_contrato_no_valida_spaces_contra_el_registry(self, subject):
        """DECISION DE DISENO: identidad NO valida espacios.

        El docstring lo dice: decidir que espacios se abren es competencia de
        la politica. Un space inexistente puede colarse en el contrato si la
        politica lo entrega; el filtro ocurre en `_spaces_from_entitlements`.
        """
        contract = build_identity_contract(subject, available_spaces=["espacio_inexistente"])
        assert contract["available_spaces"] == ["espacio_inexistente"]


# ─────────────────────────────────────────────────────────────────────────────
# 4. Matriz actual (tabla de referencia)
# ─────────────────────────────────────────────────────────────────────────────

MATRIZ_DE_REFERENCIA = [
    # (nombre, kwargs parciales, entitlements esperados, spaces esperados)
    ("admin sin verticales",
     {"role": "admin"},
     [LEGAL, COMUNIDAD], ["legal", "comunidad"]),
    ("investor sin verticales",
     {"role": "investor"},
     [EMPRESA, COMUNIDAD], ["empresa", "comunidad"]),
    ("admin + vertical legal",
     {"role": "admin", "verticals": ["legal"]},
     [LEGAL, COMUNIDAD], ["legal", "comunidad"]),
    ("investor + vertical medical",
     {"role": "investor", "verticals": ["medical"]},
     [MEDICAL, EMPRESA, COMUNIDAD], ["medical", "empresa", "comunidad"]),
    ("admin + org vertical empresa",
     {"role": "admin", "organizations": [{"vertical": "empresa", "company_id": "c1"}]},
     [EMPRESA, LEGAL, COMUNIDAD], ["empresa", "legal", "comunidad"]),
    ("admin + org solo company_id",
     {"role": "admin", "organizations": [{"company_id": "c9"}]},
     [EMPRESA, LEGAL, COMUNIDAD], ["empresa", "legal", "comunidad"]),
    ("sin rol ni verticales",
     {},
     [COMUNIDAD], ["comunidad"]),
    ("sin rol + vertical comunidad",
     {"verticals": ["comunidad"]},
     [COMUNIDAD], ["comunidad"]),
    ("sin rol + vertical desconocida",
     {"verticals": ["astrologia"]},
     [COMUNIDAD], ["comunidad"]),
    ("sin subject_id (fail-closed)",
     {"subject_id": None, "role": "admin", "verticals": ["legal"]},
     [LEGAL], ["legal"]),
    ("subject_id vacio",
     {"subject_id": "", "role": "admin"},
     [LEGAL], ["legal"]),
]


class TestMatrizDeReferencia:
    """Tabla completa. Si falla una fila, la politica cambio."""

    @pytest.mark.parametrize(
        "nombre,partial,entitlements_esperados,spaces_esperados",
        MATRIZ_DE_REFERENCIA,
        ids=[c[0] for c in MATRIZ_DE_REFERENCIA],
    )
    def test_matriz(self, subject, nombre, partial, entitlements_esperados, spaces_esperados):
        kwargs = {"subject_id": subject, **partial}
        entitlements = get_entitlements(**kwargs)
        assert entitlements == entitlements_esperados, f"entitlements de '{nombre}' cambiaron"
        assert spaces_of(entitlements) == spaces_esperados, f"spaces de '{nombre}' cambiaron"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Casos negativos
# ─────────────────────────────────────────────────────────────────────────────

class TestSujetoInexistente:
    """Fail-closed: sin sujeto, `can()` deniega todo."""

    @pytest.mark.parametrize("subject_value", [None, ""])
    def test_can_deniega_sin_sujeto(self, subject_value):
        assert can({"id": subject_value, "entitlements": [LEGAL]}, LEGAL) == "deny"

    def test_can_deniega_sin_subject_dict(self):
        assert can(None, LEGAL) == "deny"
        assert can({}, LEGAL) == "deny"

    def test_can_deniega_aunque_lleve_el_permiso(self):
        assert can({"id": "", "entitlements": [LEGAL, COMUNIDAD]}, LEGAL) == "deny"

    @pytest.mark.parametrize("sujeto", ["sin-id", "anonymous", "cualquier-cosa", "a@b.com", "x"])
    def test_hallazgo_can_no_valida_el_formato_del_sujeto(self, sujeto):
        """FALLO DE SEGURIDAD — CORREGIDO EN FASE 4.5. Antes se congelaba.

        Este test documentaba un defecto REAL: `can()` solo comprobaba la
        TRUTHINESS de `subject.id`, asi que cualquier string no vaco
        -incluido un email o la palabra "anonymous"- pasaba el gate y obtenia
        `allow` si llevaba el permiso en su lista.

        FASE 4.5 cierra el defecto: `can()` ahora exige `is_valid_entity_id()`.
        El test se INVIERTE para congelar la garantia, no el fallo. Si alguien
        revierte `policy_can.py` a la validacion por truthiness, este test
        vuelve a fallar, que es exactamente lo que debe hacer.
        """
        assert can({"id": sujeto, "entitlements": [LEGAL]}, LEGAL) == "deny"
        # Y la validacion canonica coincide con la del gate:
        assert is_valid_entity_id(sujeto) is False


class TestEntityIdInvalido:
    """`is_valid_entity_id` y el rechazo del contrato."""

    @pytest.mark.parametrize(
        "valor",
        ["pc_usr_XXXX", "", None, "anonymous", "a@b.com", 12345,
         "PC_USR_01M3JJJ9M2XQGJQB9Z7CS7QM4F"],
    )
    def test_rechaza_entity_id_invalidos(self, valor):
        assert is_valid_entity_id(valor) is False

    def test_rechaza_prefijo_mayusculas(self, subject):
        assert is_valid_entity_id(subject.upper()) is False

    def test_rechaza_longitud_correcta_con_alfabeto_malo(self, subject):
        assert is_valid_entity_id(subject[:-1] + "!") is False

    def test_rechaza_timestamp_absurdo(self):
        """El bloque temporal debe ser un epoch-ms plausible."""
        assert is_valid_entity_id("pc_usr_0000000000" + "0" * 16) is False

    @pytest.mark.parametrize("valor", ["no-valido", "", None])
    def test_contrato_rechaza_entity_id_invalida(self, valor):
        with pytest.raises(ValueError) as exc:
            build_identity_contract(valor)
        assert str(exc.value) == "entity_id_invalido"

    def test_acepta_entity_id_generada(self):
        assert is_valid_entity_id(generate_entity_id()) is True


class TestEspacioInexistente:
    """Un permiso sin espacio registrado nunca produce un space_key."""

    def test_permiso_de_espacio_inexistente_se_descarta(self):
        assert _spaces_from_entitlements(["workspace.open.noexiste"]) == []

    def test_permiso_sin_prefijo_se_descarta(self):
        assert _spaces_from_entitlements(["otro.permiso", "workspace", "x"]) == []

    def test_espacio_inexistente_se_mezcla_con_validos(self):
        spaces = _spaces_from_entitlements([LEGAL, "workspace.open.inventado", COMUNIDAD])
        assert spaces == ["legal", "comunidad"]

    def test_can_deniega_espacio_no_registrado(self):
        assert can({"id": "x", "entitlements": ["workspace.open.inventado"]},
                   "workspace.open.inventado") == "deny"


class TestPermisoDesconocido:
    """`can()` es fail-closed con acciones no conocidas."""

    @pytest.mark.parametrize(
        "accion",
        ["", "workspace.bogus.legal", "otro.permiso", "workspace.open", "legal",
         "workspace.delete.legal", "workspace.open.legal.extra"],
    )
    def test_can_deniega_permisos_desconocidos(self, accion):
        assert can({"id": "pc_usr_X", "entitlements": [accion]}, accion) == "deny"

    def test_permiso_no_otorgado_es_denegado(self):
        assert can({"id": "pc_usr_X", "entitlements": [COMUNIDAD]}, LEGAL) == "deny"

    def test_espacio_declared_exige_flag_allow_non_live(self, subject):
        """Los espacios `declared` no abren sin `allow_non_live`.

        FASE 4.5: el sujeto usa un `entity_id` canonico. Antes se usaba el
        literal "pc_usr_X", que `can()` hoy rechaza por no ser un entity_id
        valido: el test pasaba, pero por el motivo equivocado.
        """
        payload = {"id": subject, "entitlements": [MEDICAL]}
        assert can(payload, MEDICAL) == "deny"
        assert can(payload, MEDICAL, {"allow_non_live": True}) == "allow"

    def test_espacio_live_abre_sin_flag(self, subject):
        payload = {"id": subject, "entitlements": [LEGAL]}
        assert can(payload, LEGAL) == "allow"

    def test_espacio_preview_abre_sin_flag(self, subject):
        """RIESGO DOCUMENTADO: `preview` NO esta en la lista de can().

        can() solo exige flag para `declared` y `deprecated`. `empresa` esta en
        `preview`, asi que abre sin revision. El comentario de
        workspace_registry dice que `preview` es "puede mostrarse sin abrir".
        No se corrige aqui: se congela (FASE 4.5 lo preserva).
        """
        assert registry.get_space("empresa")["status"] == "preview"
        payload = {"id": subject, "entitlements": [EMPRESA]}
        assert can(payload, EMPRESA) == "allow"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Invariantes de politica (red de seguridad transversal)
# ─────────────────────────────────────────────────────────────────────────────

class TestInvariantes:
    """Propiedades que deben seguir valiendo tras CUALQUIER cambio de politica.

    A diferencia del resto, estas tests no congelan un valor: congelan una
    garantia estructural. Sobreviven a la Fase 4 (si la politica se cambia
    bien). Si alguna falla, el cambio rompio una garantia, no solo un valor.
    """

    def test_todo_espacio_derivado_existe_en_el_registry(self, subject):
        for role in ["admin", "investor", None, "desconocido"]:
            for verticals in [[], ["legal"], ["medical"], ["empresa"]]:
                for space in spaces_of(
                    get_entitlements(subject_id=subject, role=role, verticals=verticals)
                ):
                    assert registry.get_space(space) is not None, (
                        f"space '{space}' no existe en el registry"
                    )

    def test_ningun_espacio_apunta_a_otro_core(self, subject):
        for space in spaces_of(get_entitlements(subject_id=subject, role="admin")):
            assert registry.get_space(space)["core_id"] == registry.CORE_OPERATIVO_UNICO

    def test_todo_permiso_emitido_pasa_el_gate_de_can(self, subject):
        """Todo entitlement derivado debe ser evaluable por can() con exito."""
        for role in ["admin", "investor"]:
            for permission in get_entitlements(subject_id=subject, role=role):
                assert can({"id": subject, "entitlements": [permission]}, permission) == "allow"

    def test_derivacion_es_determinista(self, subject):
        primero = get_entitlements(subject_id=subject, role="admin", verticals=["legal"])
        segundo = get_entitlements(subject_id=subject, role="admin", verticals=["legal"])
        assert primero == segundo

    def test_derivacion_no_depende_del_orden_de_verticales(self, subject):
        a = get_entitlements(subject_id=subject, verticals=["legal", "legal", "medical"])
        b = get_entitlements(subject_id=subject, verticals=["medical", "legal"])
        assert set(a) == set(b)

    def test_verticales_mayusculas_se_normalizan(self, subject):
        assert get_entitlements(subject_id=subject, verticals=["LEGAL"]) == [LEGAL, COMUNIDAD]

    def test_el_registry_declara_un_unico_core_operativo(self):
        registry.validate_registry()  # lanza si un espacio apunta a otro core

    def test_todo_espacio_derivado_pasa_el_registro_publico(self, subject):
        """Lo que el Bridge ofrece debe existir tambien en `GET /api/access/spaces`."""
        publicados = {s["space_key"] for s in registry.list_spaces()}
        for space in spaces_of(get_entitlements(subject_id=subject, role="admin")):
            assert space in publicados

