"""
Línea base de caracterización — resolución de contexto de Punto Cero One.

Preparación paralela para la futura integración Core → One: congela el
comportamiento REAL de las funciones de resolución de contexto que los
flujos actuales utilizan, para poder compararlo después con System Core.

ALCANCE (solo funciones realmente llamadas por los flujos activos):
  · identidad de la cuenta autenticada  -> identity_core.resolve_identity
  · tenant                              -> NO EXISTE en One (se congela la ausencia)
  · workspace                           -> compute_workspaces + _spaces_from_entitlements
  · vertical / specialty                -> extract_verticals (campo `verticals` y
                                           heurística de perfil con `specialties`)
  · permisos y acceso operativo         -> entitlement_service + policy_can
  · contexto de sesión                  -> bloques jwt/community y su no mutación

REGLA DE ORO: estos tests describen lo que el código HOY HACE, no lo que
debería hacer. Donde el comportamiento actual es potencialmente inseguro
(inferencias por texto libre, `session.sources` que declara ambas sesiones
aunque solo exista una) se congela como HALLAZGO, explícitamente marcado
como NO recomendado. Si la política cambia deliberadamente, estos tests
deben FALLAR primero: ese fallo es la señal del cambio consciente.

Aislamiento: dobles en memoria. Sin Mongo, sin red, sin servidores, sin
datos productivos, sin flags, sin contacto con System Core ni Shadow.
Solo se añade este archivo; ningún código de producción se modifica.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from routes.access_bridge_routes import _spaces_from_entitlements  # noqa: E402
from services import entitlement_service as ent  # noqa: E402
from services import policy_can  # noqa: E402
from services import workspace_registry as registry  # noqa: E402
from services.identity_core import (  # noqa: E402
    IdentityConflictError,
    compute_account_type,
    compute_workspaces,
    extract_verticals,
    resolve_identity,
)
from services.system_identity import generate_entity_id  # noqa: E402

COMUNIDAD = "workspace.open.comunidad"
LEGAL = "workspace.open.legal"


# ---------------------------------------------------------------------------
# Dobles en memoria: `resolve_identity` solo lee `companies` y los dicts
# de usuario que el endpoint ya resolvió (patrón de test_d1_status_core_projection)
# ---------------------------------------------------------------------------

class _Cursor:
    def __init__(self, docs=()):
        self._docs = list(docs)

    def __aiter__(self):
        self._it = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class _Companies:
    """Filtra como la query real: owner_id == uid o team[].user_id == uid."""

    def __init__(self, docs=()):
        self.docs = list(docs)

    def find(self, query=None, projection=None):
        user_id = None
        for clause in (query or {}).get("$or", []):
            if "owner_id" in clause:
                user_id = clause["owner_id"]
                break
            if "team.user_id" in clause:
                user_id = clause["team.user_id"]
                break
        out = []
        for doc in self.docs:
            if user_id is None:
                out.append(doc)
            elif doc.get("owner_id") == user_id:
                out.append(doc)
            elif any(m.get("user_id") == user_id for m in doc.get("team") or []):
                out.append(doc)
        return _Cursor(out)


class _DB:
    def __init__(self, companies=()):
        self.companies = _Companies(companies)


def _jwt_user(**extra):
    doc = {
        "id": "usr_jwt",
        "email": "jwt@b.c",
        "name": "JWT User",
        "role": "member",
        "status": "activo",
    }
    doc.update(extra)
    return doc


def _community_user(**extra):
    doc = {
        "id": "usr_com",
        "email": "com@b.c",
        "name": "Community User",
        "role": "member",
        "status": "activo",
    }
    doc.update(extra)
    return doc


def _resolve(jwt_user=None, community_user=None, companies=()):
    return asyncio.run(resolve_identity(
        _DB(companies), jwt_user=jwt_user, community_user=community_user))


def _walk_keys(obj):
    """Todas las claves (dict/list) del árbol de resultado, para vigilar tenant."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield key
            yield from _walk_keys(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk_keys(item)


# ---------------------------------------------------------------------------
# 1. Resolución de identidad en un flujo autenticado válido
# ---------------------------------------------------------------------------

class TestIdentidadEnFlujoAutenticado:
    def test_solo_jwt_proyecta_y_calcula_contexto(self):
        """Caso 1 (JWT presente): identidad resuelta con la sesión A."""
        ident = _resolve(jwt_user=_jwt_user())
        assert set(ident) == {
            "user", "session", "identity", "organizations", "workspaces"}
        assert ident["user"]["id"] == "usr_jwt"
        assert ident["user"]["email"] == "jwt@b.c"
        assert ident["identity"]["account_type"] == "personal"
        assert ident["organizations"] == []

    def test_ambas_sesiones_mismo_usuario_no_conflicta(self):
        """Caso 3: mismo `users.id` en JWT y comunidad → sin excepción."""
        ident = _resolve(
            jwt_user=_jwt_user(),
            community_user=_community_user(id="usr_jwt"),
        )
        assert ident["user"]["id"] == "usr_jwt"

    def test_conflicto_dos_usuarios_lanza_identity_conflict_error(self):
        """Caso 4: sesiones con `users.id` distintos → IdentityConflictError
        (el endpoint lo traduce a HTTP 409; aquí se congela el núcleo)."""
        with pytest.raises(IdentityConflictError) as excinfo:
            _resolve(jwt_user=_jwt_user(), community_user=_community_user())
        assert excinfo.value.jwt_user_id == "usr_jwt"
        assert excinfo.value.community_user_id == "usr_com"

    def test_en_conflicto_gana_el_bloque_jwt_sobre_comunidad(self):
        """Precedencia existente (NO modificada): con mismo id, los campos
        del bloque JWT son los que se proyectan; comunidad no se fusiona."""
        ident = _resolve(
            jwt_user=_jwt_user(name="Nombre JWT"),
            community_user=_community_user(id="usr_jwt", name="Nombre Comunidad"),
        )
        assert ident["user"]["name"] == "Nombre JWT"

    def test_proyeccion_de_usuario_es_lista_blanca(self):
        """Nada fuera de {id,email,name,picture,status} sale al contexto."""
        ident = _resolve(jwt_user=_jwt_user(password_hash="HASH", secret="x"))
        assert set(ident["user"]) == {"id", "email", "name", "picture", "status"}


# ---------------------------------------------------------------------------
# 2. Tenant: ausencia congelada (One no implementa dimensión tenant)
# ---------------------------------------------------------------------------

class TestAusenciaDeTenant:
    """HALLAZGO DE LÍNEA BASE: no existe resolutor de tenant en One.

    `SYSTEM-CORE-MAP.md` documenta que Tenant Core aún no existe en el
    ecosistema y que no hay `tenant_id` en el código de One. Se congela aquí
    la AUSENCIA para que la comparación futura con System Core sea explícita:
    One resuelve contexto SIN dimensión tenant. No se inventa una.
    """

    def test_contexto_no_contiene_ninguna_clave_tenant(self):
        ident = _resolve(
            jwt_user=_jwt_user(),
            community_user=_community_user(id="usr_jwt"),
        )
        assert not any("tenant" in str(k).lower() for k in _walk_keys(ident))

    def test_contrato_de_identity_es_cerrado(self):
        """Si mañana apareciera un campo tenant/extra, este test avisa."""
        ident = _resolve(jwt_user=_jwt_user())
        assert set(ident["identity"]) == {
            "account_type", "verticals", "verticals_source",
            "primary_vertical", "profile_ref",
        }


# ---------------------------------------------------------------------------
# 3. Workspace en un caso inequívoco
# ---------------------------------------------------------------------------

class TestWorkspaceInequivo:
    def test_vertical_declarada_decide_el_workspace(self):
        ws = compute_workspaces(["legal"], "profesional", [])
        assert ws["recommended"] == "legal"
        assert ws["recommended_reason"] == "verticals"

    def test_espacio_derivado_existe_en_el_registry(self):
        """_spaces_from_entitlements no inventa: sale del registry."""
        spaces = _spaces_from_entitlements([LEGAL, COMUNIDAD])
        assert spaces == ["legal", "comunidad"]
        for key in spaces:
            assert registry.get_space(key) is not None

    def test_catalogo_divide_available_y_coming_soon(self):
        """Espejo del catálogo: legal+comunidad disponibles; medical+empresa
        no. La clasificación sale de SPACE_CATALOG, no de la autorización."""
        ws = compute_workspaces(["legal"], "profesional", [])
        assert [s["key"] for s in ws["available"]] == ["legal", "comunidad"]
        assert [s["key"] for s in ws["coming_soon"]] == ["medical", "empresa"]


# ---------------------------------------------------------------------------
# 4. Selección de vertical con información válida
# ---------------------------------------------------------------------------

class TestVerticalValida:
    def test_campo_verticals_directo(self):
        verticals, source = extract_verticals({"verticals": ["Legal"]})
        assert verticals == ["legal"]
        assert source == "verticals"

    def test_specialty_del_perfil_como_fuente_de_vertical(self):
        """Prioridad 2: `specialties` (especialidad) alimenta la heurística
        de perfil cuando no hay campo `verticals` declarado."""
        verticals, source = extract_verticals(
            {"specialties": ["Derecho societario"]})
        assert verticals == ["legal"]
        assert source == "profile"

    def test_primary_vertical_es_la_primera_de_la_lista(self):
        ident = _resolve(jwt_user=_jwt_user(verticals=["legal", "medical"]))
        assert ident["identity"]["primary_vertical"] == "legal"
        assert ident["identity"]["verticals"] == ["legal", "medical"]

    def test_vertical_profesional_marca_account_type(self):
        assert compute_account_type([], ["legal"]) == "profesional"
        assert compute_account_type([], ["medical"]) == "profesional"


# ---------------------------------------------------------------------------
# 5. Contexto ausente o incompleto
# ---------------------------------------------------------------------------

class TestContextoAusenteOIncompleto:
    """Caso 5 de negocio: SIN identidad la librería NO decide autorización.

    El 401 lo emite el endpoint (`auth_routes.system_context` y las
    dependencias de sesión); `resolve_identity` devuelve contexto vacío sin
    lanzar. Esa separación es la que se congela aquí.
    """

    def test_sin_sesiones_devuelve_contexto_vacio_sin_lanzar(self):
        ident = _resolve()
        assert ident["user"] == {}
        assert ident["identity"]["verticals"] == []
        assert ident["identity"]["primary_vertical"] is None
        assert ident["workspaces"]["recommended"] == "comunidad"
        assert ident["workspaces"]["recommended_reason"] == "default_personal"

    def test_extract_verticals_sin_datos(self):
        assert extract_verticals({}) == ([], None)

    def test_usuario_incompleto_sin_verticales_ni_perfil(self):
        ident = _resolve(jwt_user={"id": "usr_x"})
        assert ident["identity"]["verticals"] == []
        assert ident["identity"]["verticals_source"] is None
        assert ident["identity"]["account_type"] == "personal"

    def test_vertical_desconocida_no_produce_workspace(self):
        """Texto que no matchea ninguna regla → sin vertical, sin inventar."""
        assert extract_verticals({"verticals": ["astronauta"]}) == ([], None)


# ---------------------------------------------------------------------------
# 6. Workspace ambiguo: regla de desempate implementada y verificable
# ---------------------------------------------------------------------------

class TestReglaDeDesempateWorkspace:
    def test_varias_verticales_se_ordenan_por_prioridad_de_catalogo(self):
        """AMBIGÜEDAD: el orden de salida sigue `_VERTICAL_RULES`
        (legal > medical > empresa > comunidad), NO el orden de entrada."""
        verticals, _ = extract_verticals({"verticals": ["empresa", "salud"]})
        assert verticals == ["medical", "empresa"]

    def test_recomendacion_toma_la_primera_de_la_lista_ordenada(self):
        verticals, _ = extract_verticals({"verticals": ["empresa", "salud"]})
        ws = compute_workspaces(verticals, "profesional", [])
        assert ws["recommended"] == "medical"

    def test_vertical_propia_gana_sobre_organizacion(self):
        """Prioridad F13.1.1: verticales → organización → default."""
        orgs = [{"company_id": "co_1", "vertical": "empresa"}]
        ws = compute_workspaces(["legal"], "profesional", orgs)
        assert ws["recommended"] == "legal"
        assert ws["recommended_reason"] == "verticals"

    def test_organizacion_gana_sobre_el_default_personal(self):
        orgs = [{"company_id": "co_1", "vertical": "empresa"}]
        ws = compute_workspaces([], "empresa", orgs)
        assert ws["recommended"] == "empresa"
        assert ws["recommended_reason"] == "organizations"

    def test_sin_nada_el_default_es_comunidad(self):
        ws = compute_workspaces([], "personal", [])
        assert ws["recommended"] == "comunidad"
        assert ws["recommended_reason"] == "default_personal"


# ---------------------------------------------------------------------------
# 7. Separación entre contexto y autorización
# ---------------------------------------------------------------------------

class TestContextoNoEsAutorizacion:
    def test_el_contexto_no_incluye_permisos_ni_entitlements(self):
        """`resolve_identity` produce contexto; no decide acceso."""
        ident = _resolve(jwt_user=_jwt_user(verticals=["legal"]))
        keys = {str(k).lower() for k in _walk_keys(ident)}
        assert not any("entitlement" in k or "permission" in k for k in keys)

    def test_rol_no_concede_espacio(self):
        """D2 congelado: `role` es capacidad técnica, no acceso."""
        assert ent.get_entitlements(
            subject_id=generate_entity_id(), role="admin") == [COMUNIDAD]

    def test_can_exige_entitlement_aunque_el_rol_sea_admin(self):
        subject = {
            "id": generate_entity_id(),
            "entitlements": [],
            "status": "activo",
            "role": "admin",
        }
        assert policy_can.can(subject, LEGAL) == policy_can.DENY

    def test_can_deniega_si_el_status_no_esta_activo(self):
        """D1: la autorización mira `status`; la resolución de contexto no."""
        subject = {
            "id": generate_entity_id(),
            "entitlements": [LEGAL, COMUNIDAD],
            "status": "suspendido",
        }
        assert policy_can.can(subject, LEGAL) == policy_can.DENY

    def test_resolucion_y_autorizacion_se_deciden_por_separado(self):
        """Usuario suspendido: el CONTEXTO se resuelve igual (no es una
        decisión de acceso), los PERMISOS quedan vacíos (fail-closed)."""
        ident = _resolve(jwt_user=_jwt_user(status="suspendido"))
        assert ident["user"]["status"] == "suspendido"
        assert ident["identity"]["account_type"] == "personal"
        assert ent.entitlements_for_identity(ident) == []


# ---------------------------------------------------------------------------
# 8. Las funciones de resolución no mutan la sesión
# ---------------------------------------------------------------------------

class TestSesionesNoMutadas:
    def test_bloque_jwt_intacto_tras_resolver(self):
        jwt_user = _jwt_user(verticals=["legal"])
        antes = copy.deepcopy(jwt_user)
        _resolve(jwt_user=jwt_user)
        assert jwt_user == antes

    def test_bloque_comunidad_intacto_tras_resolver(self):
        community = _community_user()
        antes = copy.deepcopy(community)
        _resolve(community_user=community)
        assert community == antes

    def test_ambas_sesiones_intactas_en_caso_unificado(self):
        jwt_user = _jwt_user()
        community = _community_user(id="usr_jwt")
        antes_j, antes_c = copy.deepcopy(jwt_user), copy.deepcopy(community)
        _resolve(jwt_user=jwt_user, community_user=community)
        assert jwt_user == antes_j
        assert community == antes_c

    def test_el_conflicto_tampoco_muta_las_sesiones(self):
        jwt_user = _jwt_user()
        community = _community_user()
        antes_j, antes_c = copy.deepcopy(jwt_user), copy.deepcopy(community)
        with pytest.raises(IdentityConflictError):
            _resolve(jwt_user=jwt_user, community_user=community)
        assert jwt_user == antes_j
        assert community == antes_c

    def test_las_empresas_leidas_no_se_mutan(self):
        company = {"id": "co_1", "name": "Firma", "vertical": "legal",
                   "owner_id": "usr_x", "team": []}
        antes = copy.deepcopy(company)
        _resolve(jwt_user=_jwt_user(id="usr_x"), companies=[company])
        assert company == antes

    def test_get_entitlements_no_muta_sus_entradas(self):
        verticals = ["legal"]
        orgs = [{"company_id": "co_1", "vertical": "empresa"}]
        antes_v, antes_o = copy.deepcopy(verticals), copy.deepcopy(orgs)
        ent.get_entitlements(
            subject_id=generate_entity_id(), verticals=verticals,
            organizations=orgs, status="activo")
        assert verticals == antes_v
        assert orgs == antes_o


# ---------------------------------------------------------------------------
# Hallazgos congelados — comportamiento actual que NO se recomienda
# ---------------------------------------------------------------------------

class TestHallazgosCongelados:
    """NO son reglas aprobadas. Congelan riesgos actuales para que una
    modificación posterior los haga fallar de forma visible."""

    @pytest.mark.parametrize("solo", ["jwt", "comunidad"])
    def test_sources_declara_ambas_sesiones_aunque_solo_haya_una(self, solo):
        """HALLAZGO: `session.sources` añade "jwt" y "community" de forma
        incondicional en `resolve_identity`, aunque solo exista UNA sesión.
        El resultado sugiere doble sesión cuando no la hay. Se congela tal
        cual; NO es comportamiento recomendado."""
        if solo == "jwt":
            ident = _resolve(jwt_user=_jwt_user())
        else:
            ident = _resolve(community_user=_community_user())
        assert ident["session"]["sources"] == ["jwt", "community"]

    def test_heuristica_de_texto_libre_infiere_vertical_por_subcadena(self):
        """HALLAZGO: `extract_verticals` hace matching por subcadena sobre
        specialties/skills/interests/headline/bio/... Un texto cualquiera que
        contenga "one" (p. ej. "someone") se interpreta como vertical
        `comunidad`. Inferencia potencialmente peligrosa si la misma
        heurística se extendiera a verticales profesionales. Congelada, NO
        recomendada."""
        verticals, source = extract_verticals({"bio": "Someone curious"})
        assert verticals == ["comunidad"]
        assert source == "profile"

    def test_un_vertical_desconocido_cae_en_la_heuristica_de_perfil(self):
        """Limitación registrada: el resultado depende del ORDEN de
        `_VERTICAL_RULES` y de substrings, no solo de un campo declarado."""
        verticals, source = extract_verticals(
            {"verticals": ["astronauta"], "specialties": ["Derecho"]})
        assert verticals == ["legal"]
        assert source == "profile"
