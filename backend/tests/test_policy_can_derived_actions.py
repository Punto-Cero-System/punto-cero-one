"""
D2.2-A — `_VALID_ACTIONS` se DERIVA de `WORKSPACE_REGISTRY` (no es copia).

QUE CAMBIA Y QUE NO
-------------------
Antes, `policy_can._VALID_ACTIONS` era un set literal con las mismas diez keys
del registro, escrito a mano en otro archivo. Dos copias del mismo dato, sin
ninguna comprobacion que las ligara: agregar un espacio al registro no lo
agregaba al gate, y `can()` denegaba en silencio un permiso que el resto del
sistema consideraba valido.

Aqui `_VALID_ACTIONS` se proyecta del registro con una sola regla:
`workspace.open.<space_key>`.

Lo que este archivo NO hace: cambiar comportamiento de autorizacion. La
derivacion produce exactamente las mismas diez acciones, y por eso el
comportamiento de `can()` es identico antes y despues.

Tests
-----
  A. Derivacion        : por cada fila del registro existe su accion.
  B. Sin copia manual  : el modulo no puede contener una lista independiente
                         de permisos. Se protege el CODIGO, no el resultado.
  C. Sincronizacion    : se muta el registro en memoria y se comprueba que la
                         derivacion recoge el cambio. Sin esto, A y B pasarian
                         igual con una lista manual que coincidiera hoy.
  D. Regresion         : `can()` sigue denegando lo que denegaba.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import policy_can as can  # noqa: E402
from services import workspace_registry as registry  # noqa: E402
from services.system_identity import generate_entity_id  # noqa: E402

PREFIX = "workspace.open."
POLICY_CAN_PATH = BACKEND / "services" / "policy_can.py"

# Copia defensiva del registro tal como esta al cargar el modulo. Permite
# restaurar y, sobre todo, COMPARAR al final: ninguna prueba debe dejar el
# registro modificado.
_ORIGINAL_REGISTRY = [dict(s) for s in registry.WORKSPACE_REGISTRY]


@pytest.fixture
def subject():
    """Sujeto canonico activo con todos los permisos del registro."""
    return can.build_subject(
        generate_entity_id(),
        sorted(can._VALID_ACTIONS),
        can.STATUS_ACTIVE,
    )


# ===========================================================================
# TEST A — DERIVACION
# ===========================================================================

class TestDerivacion:
    def test_cada_fila_produce_su_accion(self):
        faltan = [
            f"{s['space_key']}: falta {PREFIX}{s['space_key']}"
            for s in registry.WORKSPACE_REGISTRY
            if f"{PREFIX}{s['space_key']}" not in can._VALID_ACTIONS
        ]
        assert not faltan, (
            "El registro declara workspaces sin accion derivada:\n  "
            + "\n  ".join(faltan)
        )

    def test_valores_derivados_exactos(self):
        """El conjunto derivado es exactamente `workspace.open.<key>` por fila."""
        esperado = frozenset(
            f"{PREFIX}{s['space_key']}"
            for s in registry.WORKSPACE_REGISTRY
            if s.get("space_key")
        )
        assert can._VALID_ACTIONS == esperado

    def test_no_hay_acciones_sobrantes(self):
        """Ninguna accion sobrevive a la salida de su fila del registro."""
        del registry.WORKSPACE_REGISTRY[:]
        try:
            assert can._derive_valid_actions() == frozenset()
        finally:
            registry.WORKSPACE_REGISTRY.extend(_ORIGINAL_REGISTRY)

    def test_derivacion_usa_la_key_no_el_permission(self):
        """Derivar de `space_key` no puede propagar un `permission` malformado."""
        original = registry.WORKSPACE_REGISTRY[0]
        registry.WORKSPACE_REGISTRY[0] = {
            **original, "permission": "PERMISION_CORRUPTA",
        }
        try:
            derivado = can._derive_valid_actions()
            assert f"{PREFIX}{original['space_key']}" in derivado
            assert "PERMISION_CORRUPTA" not in derivado
        finally:
            registry.WORKSPACE_REGISTRY[0] = original

    def test_filas_sin_key_no_inventan_una_accion_global(self):
        """Una fila incompleta no debe producir `workspace.open.`."""
        registry.WORKSPACE_REGISTRY.append({"core_id": registry.CORE_OPERATIVO_UNICO})
        try:
            assert PREFIX not in can._derive_valid_actions()
        finally:
            registry.WORKSPACE_REGISTRY.pop()



# ===========================================================================
# TEST B — NO HAY COPIA MANUAL
#
# Se inspecciona el AST del modulo, no su texto: A y B juntos deben seguir
# valiendo aunque alguien escriba el codigo con otro formato.
# ===========================================================================

def _codigo_ejecutable(path: Path) -> str:
    """Tokens del modulo sin docstrings ni comentarios, via AST.

    Se recogen los Nombres usados y los literales de texto, descartando los
    nodos Constant que SON docstrings. Con eso se puede afirmar sobre el codigo
    real ("usa `WORKSPACE_REGISTRY`") sin depender del formato ni de que las
    palabras aparezcan en un comentario.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    docs = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                             ast.AsyncFunctionDef)):
            body = getattr(node, "body", None)
            if body and isinstance(body[0], ast.Expr) and \
                    isinstance(body[0].value, ast.Constant) and \
                    isinstance(body[0].value.value, str):
                docs.add(id(body[0].value))
    tokens = [n.id for n in ast.walk(tree) if isinstance(n, ast.Name)]
    tokens += [n.value for n in ast.walk(tree)
               if isinstance(n, ast.Constant) and isinstance(n.value, str)
               and id(n) not in docs]
    return " ".join(tokens)


class TestSinCopiaManual:
    def test_el_modulo_importa_el_registro(self):
        """Sin este import la derivacion no puede existir."""
        codigo = _codigo_ejecutable(POLICY_CAN_PATH)
        assert "WORKSPACE_REGISTRY" in codigo, (
            "policy_can debe leer WORKSPACE_REGISTRY: sin el, _VALID_ACTIONS "
            "seria una lista independiente otra vez."
        )

    def test_no_hay_literal_con_las_space_keys_del_registro(self):
        """El AST no debe contener un set/tuple/lista con las keys del registro.

        Reintroducir la copia manual significa volver a escribir las keys. Este
        test falla si eso aparece, AUNQUE las keys coincidan con las del
        registro: por eso protege la FORMA del codigo y no solo el resultado.
        """
        tree = ast.parse(POLICY_CAN_PATH.read_text(encoding="utf-8"))
        keys = {s["space_key"] for s in registry.WORKSPACE_REGISTRY}
        for nodo in ast.walk(tree):
            if not isinstance(nodo, (ast.Set, ast.Tuple, ast.List)) or len(nodo.elts) < 2:
                continue
            if all(isinstance(e, ast.Constant) and isinstance(e.value, str)
                   for e in nodo.elts):
                valores = {e.value for e in nodo.elts}
                if valores and valores <= keys:
                    pytest.fail(
                        "policy_can contiene un literal con las space_keys del "
                        f"registro: {sorted(valores)}. Eso es la copia manual "
                        "que D2.2-A elimina; derivalas de WORKSPACE_REGISTRY."
                    )

    def test_valid_actions_es_inmutable(self):
        """`frozenset`: nadie puede mutar la lista en caliente desde otro modulo."""
        assert isinstance(can._VALID_ACTIONS, frozenset)

    def test_la_derivacion_es_la_unica_fuente(self):
        assert can._VALID_ACTIONS == can._derive_valid_actions()

    def test_la_derivacion_consulta_el_registro_en_vivo(self):
        """La funcion debe LEER el registro, no cerrar sobre una copia.

        Si `_derive_valid_actions` se hubiera construido sobre una constante
        propia, mutar el registro no cambiaria su salida y el Test C seria
        verde por casualidad.
        """
        codigo = _codigo_ejecutable(POLICY_CAN_PATH)
        cuerpo = codigo.split("_derive_valid_actions", 1)[-1]
        assert "WORKSPACE_REGISTRY" in cuerpo, (
            "_derive_valid_actions debe iterar WORKSPACE_REGISTRY"
        )

    def test_no_reintroducir_la_copia_tras_una_mutacion(self, subject):
        """Ultima linea: la derivacion sigue siendo derivacion.

        Si alguien "arreglara" una divergencia reescribiendo `_VALID_ACTIONS`
        a mano, esta comprobacion lo delata comparando contra el registro.
        """
        registry.WORKSPACE_REGISTRY.append({
            "space_key": "fantasma_y",
            "core_id": registry.CORE_OPERATIVO_UNICO,
            "status": "declared",
            "permission": f"{PREFIX}fantasma_y",
            "label": "F",
            "route": "/workspace/f",
            "entry_url": None,
        })
        try:
            # `_VALID_ACTIONS` es la foto de import: no cambia en caliente.
            assert f"{PREFIX}fantasma_y" not in can._VALID_ACTIONS
            # La derivacion SI lo ve. Esa diferencia es intencional y explica
            # por que un workspace nuevo exige reiniciar el proceso.
            assert f"{PREFIX}fantasma_y" in can._derive_valid_actions()
        finally:
            registry.WORKSPACE_REGISTRY.pop()
        assert can._VALID_ACTIONS == can._derive_valid_actions()


# ===========================================================================
# TEST C — SINCRONIZACION AUTOMATICA
#
# Sin esto, A y B pasarian igual con una lista manual que coincidiera hoy.
# La mutacion es la prueba de que la sincronizacion existe.
# ===========================================================================

class TestSincronizacionAutomatica:
    def test_agregar_workspace_lo_agrega_a_la_derivacion(self):
        """Mutacion 1 del encargo."""
        registry.WORKSPACE_REGISTRY.append({
            "space_key": "nuevo_x",
            "core_id": registry.CORE_OPERATIVO_UNICO,
            "status": "declared",
            "permission": f"{PREFIX}nuevo_x",
            "label": "Nuevo X",
            "route": "/workspace/nuevo_x",
            "entry_url": None,
        })
        try:
            assert f"{PREFIX}nuevo_x" in can._derive_valid_actions()
        finally:
            registry.WORKSPACE_REGISTRY.pop()
        assert f"{PREFIX}nuevo_x" not in can._derive_valid_actions()

    def test_eliminar_workspace_lo_quita_de_la_derivacion(self):
        """Mutacion 2 del encargo."""
        antes = can._derive_valid_actions()
        victima = registry.WORKSPACE_REGISTRY.pop(1)
        try:
            derivado = can._derive_valid_actions()
            assert f"{PREFIX}{victima['space_key']}" not in derivado
            assert derivado == antes - {f"{PREFIX}{victima['space_key']}"}
        finally:
            registry.WORKSPACE_REGISTRY.insert(1, victima)
        assert can._derive_valid_actions() == antes

    def test_renombrar_key_mueve_la_accion(self):
        """La accion sigue a la key; no hay texto copiado que se quede atras."""
        antes = can._derive_valid_actions()
        victima = registry.WORKSPACE_REGISTRY.pop(0)
        registry.WORKSPACE_REGISTRY.append({**victima, "space_key": "renombrado"})
        try:
            derivado = can._derive_valid_actions()
            assert f"{PREFIX}renombrado" in derivado
            assert f"{PREFIX}{victima['space_key']}" not in derivado
            assert len(derivado) == len(antes)
        finally:
            registry.WORKSPACE_REGISTRY.pop()
            registry.WORKSPACE_REGISTRY.insert(0, victima)
        assert can._derive_valid_actions() == antes


# ===========================================================================
# TEST D — REGRESION DE AUTORIZACION
# ===========================================================================

class TestRegresionCan:
    """El gate se comporta exactamente como antes de la derivacion."""

    def test_permiso_valido_permite(self, subject):
        for accion in sorted(can._VALID_ACTIONS):
            assert can.can(subject, accion, {"allow_non_live": True}) == can.ALLOW, accion

    def test_accion_no_registrada_deniega(self, subject):
        """Mutacion 3 del encargo: una accion sin workspace nunca permite."""
        for accion in (f"{PREFIX}nuevo_x", f"{PREFIX}inventado", "workspace.delete.legal"):
            assert can.can(subject, accion, {"allow_non_live": True}) == can.DENY, accion

    def test_una_accion_inventada_no_puede_ahadirse_al_gate(self, subject):
        """Mandar algo a `_VALID_ACTIONS` no basta: el paso 4 exige el espacio."""
        original = can._VALID_ACTIONS
        can._VALID_ACTIONS = original | {f"{PREFIX}fantasma"}
        try:
            sujeto = dict(subject, entitlements=list(original) + [f"{PREFIX}fantasma"])
            assert can.can(sujeto, f"{PREFIX}fantasma", {"allow_non_live": True}) == can.DENY
        finally:
            can._VALID_ACTIONS = original

    def test_sin_entitlement_deniega(self, subject):
        vacio = can.build_subject(subject["id"], [], can.STATUS_ACTIVE)
        assert can.can(vacio, f"{PREFIX}legal", {"allow_non_live": True}) == can.DENY

    def test_status_no_activo_deniega_todas_las_acciones(self):
        for estado in (can.STATUS_PENDING, can.STATUS_SUSPENDED):
            sujeto = can.build_subject(
                generate_entity_id(), sorted(can._VALID_ACTIONS), estado)
            for accion in sorted(can._VALID_ACTIONS):
                assert can.can(sujeto, accion, {"allow_non_live": True}) == can.DENY

    def test_no_live_requiere_flag(self):
        """`medical` sigue `declared`: sin flag deniega, con flag permite.

        Este test NO cambia el estado de `medical`: congela el comportamiento.
        """
        espacio = registry.get_space("medical")
        sujeto = can.build_subject(
            generate_entity_id(), [espacio["permission"]], can.STATUS_ACTIVE)
        assert can.can(sujeto, espacio["permission"], {}) == can.DENY
        assert can.can(sujeto, espacio["permission"], {"allow_non_live": True}) == can.ALLOW

    def test_el_registro_no_cambio(self):
        """Guardarrail: la suite completa deja el registro como estaba."""
        assert [s["space_key"] for s in registry.WORKSPACE_REGISTRY] == \
               [s["space_key"] for s in _ORIGINAL_REGISTRY]
        assert registry.WORKSPACE_REGISTRY == _ORIGINAL_REGISTRY
        assert can._VALID_ACTIONS == can._derive_valid_actions()
