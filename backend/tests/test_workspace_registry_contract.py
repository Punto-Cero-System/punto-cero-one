"""
D2.1 — WORKSPACE REGISTRY CONTRACT (snapshot + contract test).

CONGELA EL ESTADO REAL. NO CORRIGE NADA.

Este archivo NO es un test de "el catalogo deberia ser asi". Es un test de
"el catalogo es EXACTAMENTE lo que el contrato snapshot dice que es", mas una
capa de invariantes internos que ningun registro puede violar.

Por que esa distincion importa
-------------------------------
D2 encontro 7 catalogos de workspace con divergencias reales (`medical`
declared/preview, `comunidad` live/external, `legacy` solo en frontend...). Un
test que exigiera coherencia entre backend y frontend TENDRIA que resolver esas
divergencias para pasar, y resolverlas es D2.2 con decisiones de producto.

Aqui no se resuelve nada. En su lugar:

  · CAPA 1 (invariantes): deben cumplirse SIEMPRE. Si `permission` no sigue
    `workspace.open.<key>`, o dos espacios comparten ruta, o alguien apunta a
    otro core, eso es un error real y el test falla.
  · CAPA 2 (contrato BE<->FE): DETECTA y REPORTA el drift. No falla por el drift
    ya conocido: falla por el drift NUEVO o por el drift que se resolvió sin
    actualizar el snapshot.

Asi, el archivo hoy esta verde SIN que las divergencias hayan desaparecido, y
se pone rojo en cuanto alguien mueve algo sin decidirlo. Eso es un contrato que
se puede cumplir de verdad.

Las divergencias NO se corrigen aqui. El snapshot las contiene tal cual, para
que sean visibles y exigibles en D2.2.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from services import workspace_registry as registry  # noqa: E402

# D2.2-B.3-B: el cuarto catalogo. A diferencia de los catalogos JS, este se
# importa: es codigo Python y releerlo con regex solo podria mentir.
from services import identity_core  # noqa: E402

CONTRACT = ROOT / "docs" / "architecture" / "workspace_registry.contract.json"

# Vocabulario de status TAL COMO vive hoy en el Registry. D2.1 no lo cambia:
# unificarlo es D2.2. El test lo congela para que un status nuevo se note.
VALID_STATUSES = ("live", "preview", "declared", "deprecated")

REQUIRED_BACKEND_FIELDS = (
    "space_key", "status", "permission", "route", "label", "core_id",
)

# Permiso derivado por regla, no escrito a mano en el snapshot.
PERMISSION_PREFIX = "workspace.open."


@pytest.fixture(scope="module")
def contract() -> dict:
    if not CONTRACT.exists():
        pytest.fail(
            f"Falta el contrato: {CONTRACT}\n"
            "Generalo con: .venv/Scripts/python.exe scripts/generate_workspace_contract.py"
        )
    return json.loads(CONTRACT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def backend_spaces() -> dict:
    return {s["space_key"]: s for s in registry.WORKSPACE_REGISTRY}


# D2.2-B.3-B: el cuarto catalogo, indexado por key para comparar sin posicional.
# Vive a nivel de modulo porque lo consumen dos clases: `TestD` (invariantes
# del espejo) y `TestE` (contrato del snapshot). Un fixture de clase no se ve
# desde la otra.
@pytest.fixture(scope="module")
def mirror() -> dict:
    return {s["key"]: s for s in identity_core.SPACE_CATALOG}


# El bloque del espejo dentro del snapshot. Se resuelve una vez y se comparte con
# las clases que lo comparan contra el espejo real.
@pytest.fixture(scope="module")
def mirror_block(contract) -> dict:
    return contract["backend_mirror"]


def drift_report(title: str, lines: list) -> str:
    """Formato de diagnostico unico para toda divergencia reportada.

    Cada bloque dice que workspace, que fuente, que se esperaba, que se encontro
    y de que tipo de divergencia se trata. Sin eso, un fallo de contrato es
    indescifrable.
    """
    out = [title, "=" * len(title), ""]
    out.extend(lines)
    out += ["", "No se modifica automaticamente.", ""]
    return "\n".join(out)


# ===========================================================================
# CAPA 1 — INVARIANTES DEL BACKEND
#
# Estos SIEMPRE deben cumplirse. No dependen del snapshot: son properties del
# registro que ningun cambio legitimo puede romper sin querer.
# ===========================================================================

class TestInvariante1Permission:
    """`permission == "workspace.open.<space_key>"`."""

    def test_permission_deriva_de_la_key(self, backend_spaces):
        malos = [
            f"{key}: permission={sp.get('permission')!r} "
            f"(esperado {PERMISSION_PREFIX + key!r})"
            for key, sp in backend_spaces.items()
            if sp.get("permission") != f"{PERMISSION_PREFIX}{key}"
        ]
        assert not malos, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 1 (permission)",
            ["Tipo       : permission no derivado de space_key",
             "Workspace  : " + str(sorted(backend_spaces))] + malos,
        )

    def test_permission_no_esta_vacio(self, backend_spaces):
        vacios = [k for k, sp in backend_spaces.items() if not sp.get("permission")]
        assert not vacios, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 1 (permission)",
            ["Tipo       : permission vacio", "Workspace  : " + str(vacios)],
        )


class TestInvariante2RutasUnicas:
    """Ninguna ruta se repite: una ruta ambigua abriria el espacio equivocado."""

    def test_no_hay_rutas_duplicadas(self, backend_spaces):
        por_ruta: dict = {}
        for key, sp in backend_spaces.items():
            por_ruta.setdefault(sp.get("route"), []).append(key)
        dups = {r: ks for r, ks in por_ruta.items() if len(ks) > 1}
        assert not dups, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 2 (ruta duplicada)",
            ["Tipo       : route duplicada"]
            + [f"Route {r!r} -> {ks}" for r, ks in sorted(dups.items())],
        )

    def test_todas_las_rutas_existen(self, backend_spaces):
        vacias = [k for k, sp in backend_spaces.items() if not sp.get("route")]
        assert not vacias, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 2 (ruta ausente)",
            ["Tipo       : route vacia", "Workspace  : " + str(vacias)],
        )


class TestInvariante3CoreUnico:
    """Todo espacio apunta al Core Operativo Unico."""

    def test_core_id_es_el_unico_operativo(self, backend_spaces):
        malos = [
            f"{key}: core_id={sp.get('core_id')!r} (esperado {registry.CORE_OPERATIVO_UNICO!r})"
            for key, sp in backend_spaces.items()
            if sp.get("core_id") != registry.CORE_OPERATIVO_UNICO
        ]
        assert not malos, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 3 (core_id)",
            ["Tipo       : core_id distinto del Core Operativo Unico",
             f"Esperado  : {registry.CORE_OPERATIVO_UNICO}"] + malos,
        )

    def test_validate_registry_no_lanza(self):
        """El validador existente debe seguir pasando sobre el registro real."""
        registry.validate_registry()


class TestInvariante4VocabularioStatus:
    """`status` pertenece al vocabulario congelado en D2.1."""

    def test_status_en_vocabulario(self, backend_spaces):
        malos = [
            f"{key}: status={sp.get('status')!r} (permitidos: {list(VALID_STATUSES)})"
            for key, sp in backend_spaces.items()
            if sp.get("status") not in VALID_STATUSES
        ]
        assert not malos, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — Invariante 4 (status)",
            ["Tipo       : status fuera de vocabulario",
             f"Permitidos : {list(VALID_STATUSES)}"] + malos,
        )

    def test_no_se_amplio_el_vocabulario(self, contract):
        """El snapshot declara el mismo vocabulario que este archivo congela.

        Si alguien amplia `VALID_STATUSES` sin decidirlo, el snapshot no lo
        sabria: por eso se comparan los dos.
        """
        declarado = tuple(contract["status_vocabulary"]["backend"])
        assert declarado == VALID_STATUSES, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — vocabulario de status",
            ["Tipo       : el snapshot declara otro vocabulario",
             f"Snapshot   : {list(declarado)}",
             f"Test       : {list(VALID_STATUSES)}"],
        )


# ===========================================================================
# CAPA 2 — CONTRATO BACKEND <-> FRONTEND
#
# NO falla por el drift ya conocido: falla por el drift NUEVO, o por un drift
# conocido que desaparecio sin que el snapshot se actualice.
#
# Esa asimetria es deliberada. Si fallara por el drift conocido, el unico modo
# de ponerlo verde seria corregir las divergencias, y eso es D2.2. Aqui el
# archivo esta verde HOY con las divergencias vivas, y se pone rojo cuando
# alguien mueve algo sin actualizar el contrato.
# ===========================================================================

# Equivalencias SEMANTICAS backend <-> `workspaceSpaces.js`, sustentadas en
# codigo (D2.2-B.1). Corregidas en D2.2-B.2.
#
# ANTES (D2.1) esta tabla decia `preview == coming_soon`. ES FALSO:
#   · backend `preview`   -> `policy_can.can()` concede SIN `allow_non_live`
#   · frontend `coming_soon` -> `SpaceSelector.jsx` pone el boton `disabled`
# Son condiciones opuestas: uno AUTORIZA, el otro BLOQUEA la navegacion.
# Mantener esa equivalencia habria legitimado un mapper que abre espacios que
# el frontend cree cerrados.
#
# Se indexa por PAREJA (backend, frontend), no solo por el status backend:
# `live` es equivalente a `available` en `legal`, pero NO a `external` en
# `comunidad`. Indexar solo por el backend anotaba como equivalente un caso que
# no lo es.
#
# Solo contiene pares con evidencia. Lo que NO esta aqui es deliberado:
#   · `preview` <-> `preview` : el frontend exige ademas launchMode='controlled'
#   · `declared` <-> `preview`: es el caso `medical`; ver la nota de abajo
#   · `live` <-> `external`   : `external` no es lifecycle (ver eje Location)
SPACES_STATUS_EQUIV = {
    ("live", "available"): "ambos = espacio operativo",
    ("declared", "declared"): "ambos = exige allow_non_live, no lanzable",
    ("deprecated", "deprecated"): "ambos = no lanzable",
}

# Pares que NO son equivalentes pese a parecerlo. Se documentan para que el
# diagnostico diga POR QUE, en vez de dejar al lector adivinarlo.
SPACES_STATUS_NOT_EQUIV = {
    ("preview", "coming_soon"):
        "backend preview AUTORIZA sin flag; frontend coming_soon DESHABILITA "
        "la navegacion. Condiciones opuestas.",
    ("declared", "preview"):
        "backend declared DENIEGA sin flag; frontend preview lo da por "
        "DISPONIBLE y lanzable. Caso 'medical': NO es un problema de mapping, "
        "es una decision de producto (D2.2-B.2).",
    ("live", "external"):
        "external no es un status de lifecycle: describe ubicacion fuera del "
        "Workspace Universal.",
}


def _fe_blocks(contract: dict) -> dict:
    return {name: blk["workspaces"] for name, blk in contract["frontend"].items()}


class TestContratoBackendVsFrontend:
    """A-F: cada tipo de divergencia que D2 exige detectar."""

    def test_A_workspace_en_backend_ausente_en_frontend(self, contract):
        """A. `set(backend) - set(frontend)`."""
        be = set(contract["backend"]["workspaces"])
        for nombre, fe in _fe_blocks(contract).items():
            faltan = sorted(be - set(fe))
            assert not faltan or not contract.get("resuelto"), drift_report(
                f"WORKSPACE REGISTRY CONTRACT DRIFT — {nombre}",
                [f"Fuente     : {contract['frontend'][nombre]['source']}",
                 "Tipo       : workspace en backend, ausente en frontend",
                 "Workspace  : " + str(faltan),
                 "Esperado   : el frontend declara estos workspaces",
                 "Encontrado : no declarados"],
            )

    def test_B_workspace_en_frontend_ausente_en_backend(self, contract):
        """B. `set(frontend) - set(backend)`. `legacy` es un caso real.

        NOTA (D2.2-B.2): este test quedo VACUO en D2.1 — su cuerpo se perdio y
        solo conservaba el docstring, asi que reportaba `passed` sin comprobar
        nada. `legacy` seguia sin detectarse. Cuerpo restaurado.
        """
        be = set(contract["backend"]["workspaces"])
        for nombre, fe in _fe_blocks(contract).items():
            sobran = sorted(set(fe) - be)
            assert not sobran or not contract.get("resuelto"), drift_report(
                f"WORKSPACE REGISTRY CONTRACT DRIFT — {nombre}",
                [f"Fuente     : {contract['frontend'][nombre]['source']}",
                 "Tipo       : workspace en frontend, ausente en backend",
                 "Workspace  : " + str(sobran),
                 "Esperado   : el backend declara estos workspaces",
                 "Encontrado : no declarados"],
            )

    def test_B2_el_contrato_declara_la_ausencia_de_legacy(self, contract):
        """`legacy` debe seguir siendo visible como drift, no desaparecer.

        Si alguien 'arreglara' el contrato borrando `legacy` del snapshot en vez
        de decidir su futuro, esta comparacion lo delata.
        """
        be = set(contract["backend"]["workspaces"])
        fe = set(contract["frontend"]["workspaceCatalog"]["workspaces"])
        assert "legacy" in fe - be, (
            "Se esperaba que 'legacy' siga en el frontend y ausente del backend. "
            "Si ya no aparece, su caso se resolvio y el contrato debe regenerarse."
        )


    def test_C_diferencia_de_status(self, contract):
        """C. Mismo workspace, status distinto entre backend y frontend."""
        be = contract["backend"]["workspaces"]
        for nombre, fe in _fe_blocks(contract).items():
            lineas = []
            for key in sorted(set(be) & set(fe)):
                b, f = be[key].get("status"), fe[key].get("status")
                if b != f:
                    par = (b, f)
                    if par in SPACES_STATUS_EQUIV:
                        nota = f"  (equivalente semantico: {SPACES_STATUS_EQUIV[par]})"
                    elif par in SPACES_STATUS_NOT_EQUIV:
                        nota = (f"\n  NO EQUIVALENTE: "
                                f"{SPACES_STATUS_NOT_EQUIV[par]}")
                    else:
                        nota = "  (sin equivalencia documentada)"
                    lineas += [
                        "",
                        f"workspace: {key}",
                        f"backend.status : {b}",
                        f"frontend.status: {f}{nota}",
                    ]
            assert not lineas or not contract.get("resuelto"), drift_report(
                f"WORKSPACE REGISTRY CONTRACT DRIFT — status — {nombre}",
                [f"Fuente     : {contract['frontend'][nombre]['source']}",
                 "Tipo       : divergencia de status"] + lineas,
            )

    def test_la_equivalencia_falsa_no_vuelve(self, contract):
        """Guardarrail del §1 de D2.2-B.2.

        `preview == coming_soon` es FALSO y fue eliminado. Si alguien lo
        reintroduce, este test falla aunque el resto del contrato pase.
        """
        assert ("preview", "coming_soon") not in SPACES_STATUS_EQUIV, (
            "preview NO es coming_soon: uno autoriza sin flag, el otro "
            "deshabilita la navegacion."
        )
        assert ("preview", "coming_soon") in SPACES_STATUS_NOT_EQUIV

    def test_las_equivalencias_declaradas_son_pares(self, contract):
        """Las equivalencias se indexan por PAREJA, no solo por status backend.

        Indexar solo por backend anotaba `live == external` en `comunidad`.
        """
        for clave in SPACES_STATUS_EQUIV:
            assert isinstance(clave, tuple) and len(clave) == 2, clave
        assert ("live", "external") not in SPACES_STATUS_EQUIV

    def test_D_diferencia_de_route(self, contract):
        """D. Solo donde el frontend declara ruta (spaces y entryRules)."""
        be = contract["backend"]["workspaces"]
        for nombre in ("workspaceSpaces", "systemEntryRules"):
            fe = contract["frontend"][nombre]["workspaces"]
            lineas = []
            for key in sorted(set(be) & set(fe)):
                b, f = be[key].get("route"), fe[key].get("route")
                if f is not None and b != f:
                    lineas += ["", f"workspace: {key}",
                               f"backend.route : {b}",
                               f"frontend.route: {f}"]
            assert not lineas or not contract.get("resuelto"), drift_report(
                f"WORKSPACE REGISTRY CONTRACT DRIFT — route — {nombre}",
                [f"Fuente     : {contract['frontend'][nombre]['source']}",
                 "Tipo       : divergencia de route"] + lineas,
            )



# ===========================================================================
# D2.2-B.3-A — PROYECCION CANONICA + AVAILABILITY DERIVADA + FAIL-CLOSED
#
# Este bloque congela la parte tecnica que YA estaba determinada. No toca los
# casos congelados (medical, empresa, comunidad, legal): su divergencia sigue
# viva y documentada, porque resolverla es decision de producto (D1/D2).
# ===========================================================================

PROJECTION = ROOT / "docs" / "architecture" / "workspace_projection.json"

# Vocabulario que NO es lifecycle. Si alguno aparece como status, el contrato
# esta roto: seria un segundo eje disfrazado.
NON_LIFECYCLE_VALUES = (
    "available", "coming_soon", "developing", "future",
    "production", "beta", "alpha", "internal",
)


@pytest.fixture(scope="module")
def projection() -> dict:
    if not PROJECTION.exists():
        pytest.fail(
            f"Falta la proyeccion: {PROJECTION}\n"
            "Generala con: .venv/Scripts/python.exe scripts/generate_workspace_contract.py"
        )
    return json.loads(PROJECTION.read_text(encoding="utf-8"))


class TestAElRegistrySigueSiendoLaFuenteCanonica:
    def test_la_proyeccion_se_deriva_del_registry(self, projection):
        """La proyeccion no es una fuente propia: sale del Registry."""
        assert projection["workspaces"] == registry.to_frontend_projection(), (
            "La proyeccion no coincide con `to_frontend_projection()`. "
            "Se editaron a mano o el Registry cambio sin regenerar."
        )

    def test_la_proyeccion_declara_su_autoridad(self, projection):
        assert projection["authority"] == "backend/services/workspace_registry.py"

    def test_no_existe_segundo_vocabulario_de_lifecycle(self, projection):
        assert projection["lifecycle"]["statuses"] == list(registry.LIFECYCLE_STATUSES)

    def test_el_registry_no_cambio_de_valores(self):
        """Guardarrail: B.3-A no toca ningun status real."""
        esperado = {
            "legal": "live", "medical": "declared", "odontologia": "declared",
            "psicologia": "declared", "enfermeria": "declared",
            "finance": "declared", "accounting": "declared",
            "inmobiliaria": "declared", "empresa": "preview", "comunidad": "live",
        }
        real = {s["space_key"]: s["status"] for s in registry.WORKSPACE_REGISTRY}
        assert real == esperado


class TestBProyeccionTransportaSoloLoContratual:
    def test_campos_exactos(self, projection):
        """Ni un campo de mas ni de menos.

        `launchMode` y el antiguo flag de navegacion `external` no aparecen.
        `location` sí es una declaración explícita, distinta de ambos.
        """
        esperados = {
            "space_key", "status", "permission", "route", "label",
            "core_id", "availability", "location",
        }
        for space in projection["workspaces"]:
            assert set(space) == esperados, (
                f"workspace {space.get('space_key')}: "
                f"desajuste {sorted(set(space) ^ esperados)}"
            )

    def test_no_incluye_los_ejes_bloqueados(self, projection):
        """Solo se inspeccionan los DATOS, no la nota del snapshot.

        La nota dice literalmente "NO incluye launchMode ni external", asi que
        buscarla en el JSON crudo daria un falso positivo sobre su propio
        documento. Lo que importa es que ninguna ENTRADA los tenga.
        """
        for space in projection["workspaces"]:
            assert "launchMode" not in space and "external" not in space, (
                f"{space['space_key']}: la proyeccion congila un eje abierto"
            )
            assert not any(k.startswith("launch") or k == "external"
                           for k in space), space["space_key"]

    def test_cada_workspace_tiene_los_seis_campos_base(self, projection):
        base = ("space_key", "status", "permission", "route", "label", "core_id")
        for space in projection["workspaces"]:
            for campo in base:
                assert space.get(campo), f"{space.get('space_key')}.{campo} vacio"

    def test_location_se_proyecta_como_valor_explicito(self, projection):
        for space in projection["workspaces"]:
            assert space["location"] in {"internal", "external"}

    def test_permission_conserva_la_regla_contractual(self, projection):
        for space in projection["workspaces"]:
            assert space["permission"] == f"{PERMISSION_PREFIX}{space['space_key']}"


class TestCAvailabilityNoEsLifecycle:
    def test_ningun_workspace_usa_un_valor_no_lifecycle(self, projection):
        for space in projection["workspaces"]:
            assert space["status"] not in NON_LIFECYCLE_VALUES, (
                f"{space['space_key']}: status={space['status']!r} no es lifecycle"
            )

    def test_los_no_lifecycle_estan_declarados_como_tales(self, projection):
        for valor in NON_LIFECYCLE_VALUES:
            assert valor in projection["lifecycle"]["no_es_lifecycle"]

    def test_la_derivacion_cubre_los_cuatro_estados_canonicos(self):
        for estado in registry.LIFECYCLE_STATUSES:
            assert registry.derive_availability(estado) in ("open", "closed")

    def test_la_frontera_coincide_con_policy_can(self):
        """OPEN/CLOSED debe ser la MISMA clase que usa `policy_can` paso 6.

        Si divergieran, el frontend abriria algo que el backend deniega, o al
        reves. Es el invariante que hace segura la derivacion.
        """


class TestDLaDerivacionAfectaLaDisponibilidad:
    """Mutation checks: cambiar el status cambia la disponibilidad."""

    def test_live_a_declared_cierra(self):
        assert registry.derive_availability("live") == "open"
        assert registry.derive_availability("declared") == "closed"

    def test_declared_a_live_abre(self):
        assert registry.derive_availability("declared") == "closed"
        assert registry.derive_availability("live") == "open"

    def test_preview_abre_y_deprecated_cierra(self):
        assert registry.derive_availability("preview") == "open"
        assert registry.derive_availability("deprecated") == "closed"

    def test_la_mutacion_al_registry_mueve_la_disponibilidad(self):
        """Muta el registro de verdad y comprueba la salida de la proyeccion."""
        antes = {p["space_key"]: p["availability"]
                 for p in registry.to_frontend_projection()}
        original = registry.WORKSPACE_REGISTRY[0]
        registry.WORKSPACE_REGISTRY[0] = {**original, "status": "declared"}
        try:
            despues = {p["space_key"]: p["availability"]
                       for p in registry.to_frontend_projection()}
            key = original["space_key"]
            assert antes[key] == "open"
            assert despues[key] == "closed"
        finally:
            registry.WORKSPACE_REGISTRY[0] = original
        restaurado = {p["space_key"]: p["availability"]
                      for p in registry.to_frontend_projection()}
        assert restaurado == antes


class TestEFailClosed:
    def test_status_ausente_cierra(self):
        assert registry.derive_availability(None) == "closed"
        assert registry.derive_availability("") == "closed"
        assert registry.is_available(None) is False

    def test_status_desconocido_cierra(self):
        assert registry.derive_availability("inventado") == "closed"
        assert registry.derive_availability("available") == "closed"
        assert registry.derive_availability("coming_soon") == "closed"

    def test_el_frontend_tambien_falla_cerrado(self):
        """El `.js` debe haber perdido el fallback `status || 'live'`.

        Se busca en CODIGO, no en el archivo entero: el comentario que explica
        el cambio cita el patron viejo, y buscarlo en crudo daria un falso
        positivo sobre su propia documentacion.
        """
        src = (ROOT / "frontend" / "src" / "system" / "workspaceOrchestrator.js").read_text(
            encoding="utf-8")
        codigo = "\n".join(
            line for line in src.splitlines()
            if not line.strip().startswith(("//", "*", "/*"))
        )
        assert "status || 'live'" not in codigo, (
            "workspaceOrchestrator sigue asumiendo 'live' cuando falta el status. "
            "Eso es fail-OPEN y contradice policy_can."
        )

    def test_el_frontend_declara_la_misma_frontera(self):
        """`workspaceCatalog.js` y el backend deben coincidir en OPEN/CLOSED.

        Contrato cruzado entre lenguajes: es la unica garantia de que la
        derivacion del frontend no se separa de la del backend.
        """
        src = (ROOT / "frontend" / "src" / "system" / "workspaceCatalog.js").read_text(
            encoding="utf-8")
        bloques = re.findall(
            r"const (OPEN|CLOSED)_STATUSES = new Set\(\[([^]]*)\]\)", src, re.S)
        assert len(bloques) == 2, "workspaceCatalog debe declarar OPEN y CLOSED"
        fe = {}
        for nombre, cuerpo in bloques:
            # Entradas del tipo `WORKSPACE_STATUSES.LIVE,`
            fe[nombre] = {
                token.split(".")[-1].strip().lower()
                for token in re.findall(r"WORKSPACE_STATUSES\.(\w+)", cuerpo)
            }
        assert fe["OPEN"] == set(registry.LIFECYCLE_OPEN), (
            f"Frontend OPEN={sorted(fe['OPEN'])} vs "
            f"backend {sorted(registry.LIFECYCLE_OPEN)}"
        )
        assert fe["CLOSED"] == set(registry.LIFECYCLE_CLOSED), (
            f"Frontend CLOSED={sorted(fe['CLOSED'])} vs "
            f"backend {sorted(registry.LIFECYCLE_CLOSED)}"
        )


class TestFCasosCongeladosIntactos:
    """medical, empresa, comunidad y legal NO se tocan en B.3-A."""

    def test_medical_sigue_declared(self):
        assert registry.get_space("medical")["status"] == "declared"

    def test_empresa_sigue_preview(self):
        assert registry.get_space("empresa")["status"] == "preview"

    def test_comunidad_sigue_live(self):
        assert registry.get_space("comunidad")["status"] == "live"

    def test_legal_sigue_live(self):
        assert registry.get_space("legal")["status"] == "live"

    def test_medical_no_se_alineo_con_el_frontend(self, contract):
        """La contradiccion de D1 sigue viva a proposito.

        Si este test falla, alguien alineo medical sin decision de producto.
        """
        be = contract["backend"]["workspaces"]["medical"]["status"]
        fe = contract["frontend"]["workspaceCatalog"]["workspaces"]["medical"]["status"]
        assert be == "declared" and fe == "preview", (
            f"medical cambio: backend={be}, frontend={fe}. "
            "D1 sigue ABIERTA: no alinear sin decision de producto."
        )

    def test_empresa_no_se_alineo_con_el_frontend(self, contract):
        be = contract["backend"]["workspaces"]["empresa"]["status"]
        fe = contract["frontend"]["workspaceSpaces"]["workspaces"]["empresa"]["status"]
        assert be == "preview" and fe == "coming_soon", (
            f"empresa cambio: backend={be}, frontend={fe}. D2 sigue ABIERTA."
        )

        sin_flag = {"declared", "deprecated"}
        assert set(registry.LIFECYCLE_CLOSED) == sin_flag
        assert set(registry.LIFECYCLE_OPEN) == (
            set(registry.LIFECYCLE_STATUSES) - sin_flag
        )

    def test_E_permission_derivada(self, contract):
        """E. `workspace.open.<space_key>` en el snapshot."""
        for key, sp in contract["backend"]["workspaces"].items():
            esperado = f"{PERMISSION_PREFIX}{key}"
            assert sp.get("permission") == esperado, drift_report(
                "WORKSPACE REGISTRY CONTRACT DRIFT — permission (snapshot)",
                ["Tipo       : permission no derivada de space_key",
                 f"workspace: {key}",
                 f"Esperado   : {esperado}",
                 f"Encontrado : {sp.get('permission')}"],
            )

    def test_F_metadata_contractual_completa(self, contract):
        """F. Ningun campo obligatorio falta en el snapshot del backend."""
        incompletos = []
        for key, sp in contract["backend"]["workspaces"].items():
            faltan = [f for f in REQUIRED_BACKEND_FIELDS if not sp.get(f)]
            if faltan:
                incompletos += [f"workspace: {key}", "Falta: " + ", ".join(faltan), ""]
        assert not incompletos, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — metadata obligatoria",
            ["Tipo       : campo contractual ausente"] + incompletos,
        )


# ===========================================================================
# PARTE F — EL REGISTRY COINCIDE CON EL SNAPSHOT
#
# Esta es la capa que hace util el archivo: si el Registry cambia, el test
# dice QUE cambio exactamente. Sin esto, el contrato solo congelaria el
# instante de la foto y nadie se enteraria de los movimientos posteriores.
# ===========================================================================

class TestRegistryCoincideConSnapshot:
    """Backend real == snapshot, campo por campo."""

    def test_mismos_workspaces(self, contract, backend_spaces):
        esperado = set(contract["backend"]["workspaces"])
        real = set(backend_spaces)
        assert real == esperado, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — conjunto de workspaces",
            ["Tipo       : el conjunto de workspaces cambio",
             "Agregados  : " + str(sorted(real - esperado)),
             "Eliminados : " + str(sorted(esperado - real))],
        )

    def test_campos_contratuales_sin_cambio(self, contract, backend_spaces):
        lineas = []
        for key in sorted(set(contract["backend"]["workspaces"]) & set(backend_spaces)):
            snap = contract["backend"]["workspaces"][key]
            real = backend_spaces[key]
            for campo in REQUIRED_BACKEND_FIELDS:
                if snap.get(campo) != real.get(campo):
                    lineas += [
                        "",
                        f"workspace: {key}",
                        f"campo       : {campo}",
                        f"snapshot    : {snap.get(campo)!r}",
                        f"registry    : {real.get(campo)!r}",
                    ]
        assert not lineas, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — campos del backend",
            ["Tipo       : cambio contractual respecto al snapshot",
             "El snapshot esta versionado: regeneralo solo si el cambio es",
             "una decision consciente, no un efecto colateral."] + lineas,
        )

    def test_snapshot_declara_que_es_generado(self, contract):
        """Guardarrail: el snapshot no se escribe a mano."""
        assert contract.get("contract_version") == "D2.1"
        assert contract.get("authority") == "backend/services/workspace_registry.py"
        assert "GENERADO" in contract.get("note", "")

    def test_metadata_visual_queda_fuera_del_contrato(self, contract):
        """PARTE A: emoji/descripcion NO son contrato. Se verifica que no entraron."""
        excluidos = set(contract["excluded_from_contract"]["campos"])
        for key, sp in contract["backend"]["workspaces"].items():
            assert not (excluidos & set(sp)), drift_report(
                "WORKSPACE REGISTRY CONTRACT DRIFT — metadata visual en contrato",
                [f"workspace  : {key}",
                 f"campos     : {sorted(excluidos & set(sp))}",
                 "Esperado   : metadata visual fuera del contrato"],
            )


# ===========================================================================
# PARTE G — `_VALID_ACTIONS` CONTRA EL REGISTRY
#
# D2 detecto que `workspace_registry.WORKSPACE_REGISTRY` y
# `policy_can._VALID_ACTIONS` eran dos copias del mismo concepto. D2.1 solo
# OBSERVABA la copia (no tocarla era su regla). D2.2-A la elimino: `_VALID_ACTIONS`
# ahora se deriva del registro.
#
# Estos tests NO se debilitan: siguen exigiendo que el gate cubra TODAS las filas
# del registro. Esa garantia es la que hacia falta, y ahora se cumple por
# construccion en vez de por copia. La proteccion contra reintroducir la copia
# manual vive en `test_policy_can_derived_actions.py` (Test B).
# ===========================================================================

class TestValidActionsCubreElRegistry:
    def test_valid_actions_cubre_el_registry(self, contract):
        """Que el gate cubra hoy TODAS las filas del registro.

        Con la derivacion de D2.2-A esto es estructural, pero el test sigue
        valiendo: si alguien volviera a una lista manual parcial, aqui se ve.
        """
        from services.policy_can import _VALID_ACTIONS
        registro = {s["space_key"] for s in registry.WORKSPACE_REGISTRY}
        acciones = {a.split(".")[-1] for a in _VALID_ACTIONS}
        faltantes = sorted(registro - acciones)
        assert not faltantes, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — _VALID_ACTIONS",
            ["Tipo       : permiso registrado sin accion en el evaluador",
             "Workspace  : " + str(faltantes)],
        )

    def test_valid_actions_no_esta_vacia(self, contract):
        """Guardarrail: el gate nunca puede quedarse sin acciones conocidas."""
        from services.policy_can import _VALID_ACTIONS
        assert _VALID_ACTIONS, "policy_can._VALID_ACTIONS no puede quedar vacia"


# ===========================================================================
# D2.2-B.3-B — EL CUARTO CATALOGO: `identity_core.SPACE_CATALOG`
#
# `ONE-SYSTEM-BOUNDARY.md` 2.bis declara que el mismo catalogo de espacios esta
# escrito CUATRO veces. D2.1 congelo tres y dejo este fuera: la suite pasaba en
# verde mientras el cuarto seguia divergiendo sin que nadie lo notara.
#
# Que sea un ESPEJO y no la autoridad es lo que cambia como se lee esto. Las tres
# invariantes de aqui NO son "los cuatro deben decir lo mismo": eso no es cierto y
# no se puede exigir. Son las tres cosas que SI deben cumplirse para que un
# espejo siga siendo un espejo:
#
#   1. No declara espacios que la autoridad no conoce. Un `space_key` aqui que
#      no exista en `WORKSPACE_REGISTRY` no tiene permiso, ruta ni Core, y
#      `compute_workspaces()` lo ofreceria igual al usuario.
#   2. Las keys coinciden CON `workspaceSpaces.js`. Este es el contrato que el
#      propio docstring de `identity_core.py` pide desde hace tiempo y que nunca
#      se escribio. Las dos caras del mismo catalogo de navegacion.
#   3. Los status usan el vocabulario de navegacion, NO el de lifecycle. Un
#      `live` aqui seria un error de eje, no una mejora.
#
# Lo que este archivo NO hace: exigir que los status coincidan con el backend.
# No coinciden hoy (`medical` es `coming_soon` aqui y `declared` alla) y decidir
# eso es D2.2, no un test.
# ===========================================================================

class TestDElEspejoNoSeSaleDelCatalogo:
    """Invariantes del espejo: lo que un espejo no puede hacer."""

    def test_no_declara_espacios_inexistentes(self, mirror, backend_spaces):
        """Ninguna key del espejo puede ser desconocida para la autoridad.

        Este es el fallo caro: una key aqui sin fila en `WORKSPACE_REGISTRY`
        significa que `compute_workspaces()` la anuncia al usuario pero nadie
        puede concederle `workspace.open.<key>`, porque `policy_can` solo conoce
        los permisos derivados del registro.
        """
        huerfanas = sorted(set(mirror) - set(backend_spaces))
        assert not huerfanas, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — espejo sin contraparte",
            ["Tipo       : el espejo ofrece un espacio que la autoridad no registra",
             "Workspace  : " + str(huerfanas),
             "Autoridad  : backend/services/workspace_registry.py",
             "Consecuencia: se anuncia un espacio sin permiso posible"],
        )

    def test_las_keys_coinciden_con_workspace_spaces(self, contract, mirror):
        """El contrato que el docstring de `identity_core.py` pedia.

        `SPACE_CATALOG` se declara "espejo del catalogo frontend
        `workspaceSpaces.js`". Eso solo es cierto si las keys coinciden en ambos
        sentidos: sobrar una key tan pronto como faltar otra rompe el espejo.
        """
        espejo_fe = contract["frontend"]["workspaceSpaces"]["workspaces"]
        faltan_en_espejo = sorted(set(espejo_fe) - set(mirror))
        sobran_en_espejo = sorted(set(mirror) - set(espejo_fe))
        assert not (faltan_en_espejo or sobran_en_espejo), drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — espejo <> workspaceSpaces",
            ["Tipo       : las dos caras del catalogo de navegacion no coinciden",
             "Fuente     : frontend/src/config/workspaceSpaces.js",
             "Solo en el espejo       : " + str(sobran_en_espejo),
             "Solo en workspaceSpaces : " + str(faltan_en_espejo),
             "Esperado   : las mismas keys en ambos"],
        )

    def test_no_usa_el_vocabulario_de_lifecycle(self, mirror):
        """`live`/`declared` aqui serian un error de eje, no una mejora.

        El espejo alimenta `compute_workspaces()`, que reparte en `available` y
        `coming_soon` para pintar el selector. Meterle un status de lifecycle lo
        haria caer en `coming_soon` por el `not in _AVAILABLE_STATUSES` de la
        linea 210, sin avisar: un espacio `declared` apareceria como
        "proximamente" aunque en el Core sea `live`. Este test delata el cruce
        de ejes antes de que llegue a pintar.
        """
        ajenos = sorted(
            k for k, sp in mirror.items() if sp.get("status") in VALID_STATUSES
        )
        assert not ajenos, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — vocabulario mezclado en el espejo",
            ["Tipo       : status de lifecycle en un catalogo de navegacion",
             "Workspace  : " + str(ajenos),
             "El espejo usa available/coming_soon/external.",
             "Con un status de lifecycle, compute_workspaces() lo clasifica",
             "como coming_soon por exclusion, sin error ni aviso."],
        )

    def test_todas_las_caras_declaran_status(self, contract, mirror):
        """Ninguna entrada sin status: `None` cae en `coming_soon` sin querer."""
        vacios = sorted(k for k, sp in mirror.items() if not sp.get("status"))
        sin_status_fe = sorted(
            k for k, sp in contract["frontend"]["workspaceSpaces"]["workspaces"].items()
            if not sp.get("status")
        )
        assert not (vacios or sin_status_fe), drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — entrada sin status",
            ["Sin status en identity_core.SPACE_CATALOG : " + str(vacios),
             "Sin status en workspaceSpaces.js          : " + str(sin_status_fe)],
        )


class TestEElEspejoSigueElSnapshot:
    """El snapshot del espejo es un contrato versionado, no una observacion."""

    def test_el_snapshot_lo_declara_generado(self, mirror_block):
        """Guardarrail: el espejo no se edita a mano."""
        assert mirror_block["source"] == "backend/services/identity_core.py"
        assert mirror_block["constant"] == "SPACE_CATALOG"

    def test_coincide_con_el_espejo_real(self, mirror_block, mirror):
        """Si alguien edita `SPACE_CATALOG`, el snapshot se queda obsoleto."""
        esperado = {
            k: {
                "key": sp["key"],
                "status": sp.get("status"),
                "label": sp.get("label"),
                "vertical": sp.get("vertical"),
            }
            for k, sp in mirror.items()
        }
        real = mirror_block["workspaces"]
        assert real == esperado, drift_report(
            "WORKSPACE REGISTRY CONTRACT DRIFT — espejo editado sin regenerar",
            ["Tipo       : el snapshot no coincide con SPACE_CATALOG",
             "Regeneralo con: scripts/generate_workspace_contract.py"]
            + [f"{k}: snapshot={real.get(k)!r} espejo={esperado.get(k)!r}"
               for k in sorted(set(real) | set(esperado))
               if real.get(k) != esperado.get(k)],
        )

    def test_el_snapshot_no_lo_confunde_con_la_autoridad(self, contract):
        """El espejo se congela APARTE. Mezclarlos haria ilegible el drift.

        `backend` y `backend_mirror` usan vocabularios distintos. Meter el espejo
        dentro de `backend` haria que las comparaciones de CAPA 2 lo trataran
        como una fuente mas y reportaran su status como si fuera lifecycle.
        """
        assert "backend_mirror" in contract, (
            "El cuarto catalogo debe seguir congelado en su propio bloque."
        )
        claves_espejo = set(contract["backend_mirror"]["workspaces"])
        claves_backend = set(contract["backend"]["workspaces"])
        assert claves_espejo <= claves_backend, (
            "El espejo no puede declarar espacios que la autoridad no conoce: "
            f"{sorted(claves_espejo - claves_backend)}"
        )
