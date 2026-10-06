"""
D1 — SYSTEM CORE HARDENING: el estado sobrevive a la proyección del Identity Core.

BRECHA REAL QUE CIERRA ESTE CARRIL
----------------------------------
`identity_core._public_user` proyecta el usuario para consumo público
(`GET /api/auth/system-context`) y solo emitía `{id, email, name, picture}`.
`status` se quedaba atrás.

Eso no era cosmético: `entitlement_service.entitlements_for_identity()` lee
JUSTO ese campo (`identity["user"]["status"]`) para aplicar el corte fail-closed.
Con el campo ausente, el estado llegaba como `None` -> normalizado a "activo" ->

    >>> resolve_identity(suspendido) -> entitlements_for_identity() ->
        ['workspace.open.comunidad']      # ACCESO CONCEDIDO

Es la misma clase de fallo que la brecha D1 original del Access Bridge: la
política fail-closed existía y era correcta, pero el dato se perdía en la
frontera y el corte nunca se activaba. Esta vez la frontera es la proyección.

Este test fija la CADENA COMPLETA por la vía pública del módulo, sobre el
código real:

    users.status -> resolve_identity -> _public_user -> get_entitlements

Y deja fijadas las dos propiedades que NO deben romperse alarlo:

  · ausencia de `status` (usuario preexistente) -> se asume activo, no se
    bloquea a nadie de golpe. Compatibilidad deliberada, no un agujero.
  · `password_hash` sigue sin proyectarse. `status` no abre la puerta a datos
    sensibles: describe la cuenta del propio solicitante.

Dobles en memoria. Sin Mongo, sin red, sin servidor.
"""
from __future__ import annotations

import ast
import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import entitlement_service as ent  # noqa: E402
from services import identity_core  # noqa: E402
from services import policy_can as can  # noqa: E402
from services.system_identity import generate_entity_id  # noqa: E402

COMUNIDAD = "workspace.open.comunidad"
LEGAL = "workspace.open.legal"


# ---------------------------------------------------------------------------
# Dobles en memoria: `resolve_identity` solo lee `companies` y el dict de usuario
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
    def __init__(self, docs=()):
        self.docs = list(docs)

    def find(self, *args, **kwargs):
        return _Cursor(self.docs)


class _DB:
    def __init__(self, companies=()):
        self.companies = _Companies(companies)


def _user(status="activo", **extra):
    """Documento de `users`. Si `status` es None, el campo NO existe."""
    doc = {"id": "usr_x", "email": "a@b.c", "name": "U", "role": "member"}
    if status is not None:
        doc["status"] = status
    doc.update(extra)
    return doc


def _resolve(user, companies=()):
    """Ejecuta el `resolve_identity` real contra una BD en memoria."""
    return asyncio.run(identity_core.resolve_identity(
        _DB(companies), jwt_user=user, community_user=None))


# ---------------------------------------------------------------------------
# 1. La proyección conserva el estado
# ---------------------------------------------------------------------------

class TestProyeccionConservaStatus:
    def test_el_status_llega_a_la_proyeccion(self):
        assert _resolve(_user("suspendido"))["user"]["status"] == "suspendido"

    def test_el_status_no_se_normaliza_al_viajar(self):
        """Viaja el dato CRUDO. Quien decide es la política, no la proyección."""
        assert _resolve(_user("bloqueado"))["user"]["status"] == "bloqueado"

    def test_usuario_sin_status_proyecta_none(self):
        """Ausente -> None, que la política resuelve como activo. Compatibilidad."""
        assert _resolve(_user(status=None))["user"]["status"] is None

    def test_sin_usuario_no_proyecta_nada(self):
        assert identity_core._public_user(None) == {}


# ---------------------------------------------------------------------------
# 2. LA BRECHA: la cadena publica ya no concede a un suspendido
# ---------------------------------------------------------------------------

class TestBypassCerrado:
    """El atajo público `entitlements_for_identity` respeta el estado real."""

    def test_suspendido_no_recibe_nada_por_el_atajo_publico(self):
        """ANTES: ['workspace.open.comunidad']. AHORA: []."""
        assert ent.entitlements_for_identity(_resolve(_user("suspendido"))) == []

    def test_pendiente_tampoco(self):
        assert ent.entitlements_for_identity(_resolve(_user("pendiente"))) == []

    def test_estado_desconocido_tampoco(self):
        """Fail-closed: `bloqueado` no está en el catálogo y no concede."""
        assert ent.entitlements_for_identity(_resolve(_user("bloqueado"))) == []

    def test_activo_sigue_recibiendo_one(self):
        """El corte no se pasó de la raya: el usuario legítimo no pierde nada."""
        assert ent.entitlements_for_identity(_resolve(_user("activo"))) == [COMUNIDAD]

    def test_la_vertical_tampoco_sobrevive_a_la_suspension(self):
        """Con vertical declarada y suspendido: ni vertical ni One."""
        ident = _resolve(_user("suspendido", headline="Abogada"))
        assert ent.entitlements_for_identity(ident) == []

    def test_la_vertical_sigue_funcionando_para_un_activo(self):
        ident = _resolve(_user("activo", headline="Abogada"))
        assert LEGAL in ent.entitlements_for_identity(ident)

    def test_la_organizacion_tampoco_sobrevive(self):
        ident = _resolve(_user("suspendido"), companies=[
            {"id": "c1", "name": "Acme", "owner_id": "usr_x"}])
        assert ent.entitlements_for_identity(ident) == []


# ---------------------------------------------------------------------------
# 3. Compatibilidad: la ausencia NO bloquea (fijado a proposito)
# ---------------------------------------------------------------------------

class TestCompatibilidadAusencia:
    def test_usuario_preexistente_sigue_entrando(self):
        """Un documento sin `status` es un usuario anterior, no una suspensión.

        Bloquearlo de golpe sería peor que el riesgo que evita. Este test existe
        para que nadie "endurezca" este valor por defecto sin decidirlo.
        """
        assert ent.entitlements_for_identity(_resolve(_user(status=None))) == [COMUNIDAD]

    def test_activo_y_ausente_dan_el_mismo_resultado(self):
        assert (ent.entitlements_for_identity(_resolve(_user("activo")))
                == ent.entitlements_for_identity(_resolve(_user(status=None))))


# ---------------------------------------------------------------------------
# 4. La cadena sigue siendo utilizable para autorizar
# ---------------------------------------------------------------------------

class TestCadenaCompleta:
    def test_activo_pasa_el_gate(self):
        subject = can.build_subject(
            generate_entity_id(), [COMUNIDAD], "activo")
        assert can.can(subject, COMUNIDAD) == can.ALLOW

    def test_suspendido_para_en_el_paso_1_del_gate(self):
        subject = can.build_subject(
            generate_entity_id(), [COMUNIDAD], "suspendido")
        assert can.can(subject, COMUNIDAD) == can.DENY

    def test_la_derivacion_y_el_gate_coinciden(self):
        """La MISMA regla en los dos evaluadores: no pueden divergir."""
        for estado, esperado in (("activo", [COMUNIDAD]), ("suspendido", []),
                                ("pendiente", []), ("bloqueado", [])):
            ident = _resolve(_user(estado))
            derivado = ent.entitlements_for_identity(ident)
            assert derivado == esperado, estado
            subject = can.build_subject(
                generate_entity_id(), derivado, ident["user"]["status"])
            assert can.can(subject, COMUNIDAD) == (
                can.ALLOW if derivado else can.DENY), estado


# ---------------------------------------------------------------------------
# 5. No se abrio la puerta a datos sensibles
# ---------------------------------------------------------------------------

class TestNoSeExponeNadaSensitivo:
    def test_password_hash_no_se_proyecta(self):
        ident = _resolve(_user("activo", password_hash="HASH_SECRETO"))
        assert "password_hash" not in ident["user"]

    def test_la_proyeccion_no_copia_el_documento_entero(self):
        """Proyección por lista blanca, no un `dict(user)`."""
        ident = _resolve(_user("activo", secret="no-debe-salir"))
        assert set(ident["user"]) == {
            "id", "email", "name", "picture", "status"}

    def test_status_esta_presente_por_eso_esta_la_prueba(self):
        """Guardarraíl: si alguien quita el campo, esta línea falla primero."""
        assert "status" in _resolve(_user("activo"))["user"]


# ---------------------------------------------------------------------------
# 6. No se inventó arquitectura
# ---------------------------------------------------------------------------

class TestNoSeInventaArquitectura:
    def test_el_catalogo_de_estados_no_cambio(self):
        assert ent.VALID_STATUSES == ("activo", "pendiente", "suspendido")
        assert can.VALID_STATUSES == ("activo", "pendiente", "suspendido")

    def test_la_politica_sigue_viviendo_en_sus_dos_modulos(self):
        """D1 propaga el dato; NO reimplementa la regla en identity_core.

        Se inspecciona el AST, no el texto: los docstrings de este repo
        describen el problema que se resolvió y mencionan "workspace.open" sin
        que exista ninguna decisión de acceso aquí. Un filtro por líneas no
        sirve, porque los docstrings son multilínea y no empiezan por comillas
        en su primera línea.
        """
        tree = ast.parse(
            (BACKEND / "services" / "identity_core.py").read_text(encoding="utf-8"))
        # Se descartan los nodos Constant que SON docstrings, y se leen el resto.
        docs = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                                 ast.AsyncFunctionDef)):
                body = getattr(node, "body", None)
                if body and isinstance(body[0], ast.Expr) and \
                        isinstance(body[0].value, ast.Constant) and \
                        isinstance(body[0].value.value, str):
                    docs.add(id(body[0].value))
        textos = [n.value for n in ast.walk(tree)
                  if isinstance(n, ast.Constant)
                  and isinstance(n.value, str) and id(n) not in docs]
        codigo = " ".join(textos)
        for prohibido in ("VALID_STATUSES", "workspace.open", "get_entitlements"):
            assert prohibido not in codigo, prohibido

    def test_identity_core_sigue_siendo_solo_lectura(self):
        """Ni escrituras ni sesiones: el módulo no las tocaba antes ni ahora."""
        src = (BACKEND / "services" / "identity_core.py").read_text(encoding="utf-8")
        for prohibido in ("$set", "$unset", "insert_one", "update_one", "delete_one"):
            assert prohibido not in src, prohibido

    def test_no_se_creo_un_segundo_catalogo_de_espacios(self):
        assert not list((BACKEND / "services").glob("*status*core*"))
        assert (BACKEND / "services" / "policy_can.py").exists()
