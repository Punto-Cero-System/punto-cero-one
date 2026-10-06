"""Policy can(subject, action, context) - el rol NO decide acceso.

can(subject, "workspace.open.medical", context) -> "allow" / "deny"

FASE 4.5 (adaptacion del nucleo): `can()` aplica EXACTAMENTE la misma politica
que `entitlement_service.get_entitlements()`. Antes el evaluador solo comprobaba
que `subject.id` fuera truthy, de modo que un string arbitrario ("anonymous",
un email) pasaba el gate si llevaba el permiso en su lista. Un consumidor futuro
que invocara `can()` sin replicar la validacion del Access Bridge abria
espacios con un sujeto no canonico.

Orden de decision (fail-closed, prioridad absoluta):

    1. status        -> solo "activo" sigue evaluando. "pendiente" y
                         "suspendido" cortan TODOS los espacios (D1).
    2. entity_id     -> debe superar `is_valid_entity_id`. No basta con que
                         el id exista: debe ser un `pc_usr_<ULID>` canonico.
    3. accion        -> debe ser un permiso conocido del registry.
    4. espacio       -> debe existir y apuntar al Core operativo unico.
    5. entitlement   -> el permiso debe estar en la lista del sujeto.
    6. estado del espacio -> "declared"/"deprecated" exigen `allow_non_live`.

`role` NO se lee. Puede convivir en `subject` para capacidad administrativa,
pero jamas concede ni deniega un workspace: el acceso depende del entitlement,
que a su vez lo derivan las verticales, la organizacion y el status.

Compatibilidad: si `subject` no trae `status`, se asume "activo". Es la misma
regla que aplica `entitlement_service`, y cubre a los usuarios preexistentes
sin campo `status` en `users`: un documento al que nunca se le fijo el estado
no es una suspension, y bloquearlo de golpe seria peor que el riesgo que evita.

Con D1 cerrado, los caminos que POIDEN autorizar (el Access Bridge y
`access_bridge.create_access_intent`) propagan el estado real al sujeto, asi
que este valor por defecto solo aplica cuando nadie informo el estado.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .system_identity import is_valid_entity_id
from .workspace_registry import WORKSPACE_REGISTRY, get_space, CORE_OPERATIVO_UNICO

ALLOW = "allow"
DENY = "deny"

# Estados de usuario reconocidos. Solo STATUS_ACTIVE habilita el acceso.
STATUS_ACTIVE = "activo"
STATUS_PENDING = "pendiente"
STATUS_SUSPENDED = "suspendido"
VALID_STATUSES = (STATUS_ACTIVE, STATUS_PENDING, STATUS_SUSPENDED)

# ---------------------------------------------------------------------------
# D2.2-A — Acciones conocidas = permisos DERIVADOS del Workspace Registry.
#
# ANTES: `_VALID_ACTIONS` era una lista escrita a mano con las mismas diez keys
# que el registro. Dos copias del mismo dato en dos archivos, sin ninguna
# comprobacion que las ligara. Agregar un espacio al registro no lo agregaba
# aqui, y `can()` denegaba en silencio un permiso que el resto del sistema
# consideraba valido.
#
# AHORA: se deriva. El registro es la UNICA fuente; esta lista es su proyeccion.
#
#     WORKSPACE_REGISTRY
#            |
#            |  workspace.open.<space_key>
#            v
#     _VALID_ACTIONS
#
# Se deriva de `space_key` y NO del campo `permission` de cada fila, por dos
# razones:
#   1. Es lo que la regla contractual declara (`permission ==
#      "workspace.open.<space_key>"`), asi que derivar de la key no puede
#      desincronizarse de ella: el invariante 1 del contract test lo vigila.
#   2. Si una fila trajera un `permission` malformado, derivar de el
#      propagaria el error al gate. Derivando de la key, `_VALID_ACTIONS` es
#      siempre correcta y el paso 4 de `can()` sigue resolviendo el espacio
#      real desde la accion.
#
# El conjunto se materializa una vez al importar el modulo. Es intencional: es
# una constante de contrato, no un valor que cambie en caliente. Un workspace
# que se anada al registro exige reimportar el proceso, que es lo que ocurre
# hoy con cualquier despliegue. `set()` es inmutable por contrato aqui.
#
# No es una segunda fuente de verdad: nadie puede EDITAR esta lista, porque
# editarla exige editar el registro.
#
# La derivacion vive en `_derive_valid_actions()` y NO esta escrita aqui en forma
# de comprehension literal: es la pieza que los tests de D2.2-A reejercitan
# contra una mutacion controlada del registro para probar que la sincronizacion
# es real y no una coincidencia de los diez datos actuales.
# ---------------------------------------------------------------------------


def _derive_valid_actions() -> frozenset:
    """Proyecta `WORKSPACE_REGISTRY` al conjunto de acciones conocidas.

    Regla unica: `workspace.open.<space_key>` por cada fila registrada.

    Las filas sin `space_key` se ignoran en vez de producir `workspace.open.`:
    una fila incompleta no debe inventar una accion global.
    """
    return frozenset(
        f"workspace.open.{space['space_key']}"
        for space in WORKSPACE_REGISTRY
        if space.get("space_key")
    )


_VALID_ACTIONS: frozenset = _derive_valid_actions()


def _norm_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value.strip().lower()]
    return [str(v or "").strip().lower() for v in value]


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def can(
    subject: Optional[Dict[str, Any]] = None,
    action: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> str:
    """Evalua si `subject` puede ejecutar `action` en `context`.

    subject: {id, entitlements, status, role, ...}
        `id` debe ser un `entity_id` canonico (pc_usr_<ULID>).
        `status` gobierna la habilitacion; si falta se asume "activo".
        `role` es informativo y NO participa en la decision.
    action:  "workspace.open.<space_key>".
    context: {allow_non_live, ...} opcional.
    Retorna "allow" | "deny". Nunca lanza por input desconocido.
    """
    context = context or {}
    subject = subject if isinstance(subject, dict) else {}
    action_norm = _norm(action)

    # 1. status con prioridad absoluta (D1).
    status = _norm(subject.get("status")) or STATUS_ACTIVE
    if status not in VALID_STATUSES:
        # Estado desconocido: fail-closed, igual que entitlement_service.
        return DENY
    if status != STATUS_ACTIVE:
        return DENY

    # 2. Sujeto canonico. No basta la existencia del id: debe ser un entity_id.
    if not is_valid_entity_id(subject.get("id")):
        return DENY

    # 3. Accion conocida.
    if action_norm not in _VALID_ACTIONS:
        return DENY

    # 4. Espacio existente y del Core operativo unico.
    space_key = action_norm.split(".")[-1]
    space = get_space(space_key)
    if not space:
        return DENY
    if space.get("core_id") != CORE_OPERATIVO_UNICO:
        return DENY

    # 5. Entitlement explicito. `role` jamas participa.
    entitlements = _norm_list(subject.get("entitlements"))
    if action_norm not in entitlements:
        return DENY

    # 6. Espacios no-live requieren flag explicito de preview en contexto.
    # Semantica de "deprecated" sin cambios (FASE 3J).
    status_space = space.get("status")
    if status_space in ("declared", "deprecated") and not context.get("allow_non_live"):
        return DENY

    return ALLOW


def filter_allowed_spaces(
    subject: Optional[Dict[str, Any]] = None,
    spaces: Optional[List[Dict[str, Any]]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    out = []
    for space in spaces or []:
        if can(subject, space.get("permission", ""), context) == ALLOW:
            out.append(dict(space))
    return out

# ---------------------------------------------------------------------------
# Sujeto canonico de autorizacion (FASE 4.6)
# ---------------------------------------------------------------------------
# UNICO modelo de sujeto. Todo consumidor de `can()` debe construirlo aqui en
# lugar de armar el dict a mano: asi el gate y el Access Bridge comparten
# exactamente la misma forma y no pueden divergir por campos olvidados.
#
# Campos:
#   id           -> entity_id canonico (`pc_usr_<ULID>`). Obligatorio.
#   entitlements -> permisos `workspace.open.*` ya derivados.
#   status       -> estado del usuario. Ausente se normaliza a "activo", igual
#                   que `entitlement_service`, para no romper consumidores que
#                   aun no propagan el estado.
#   role         -> SOLO informativo. Se conserva si viene, jamas se usa para
#                   conceder ni denegar.
#
# No inventa permisos: `entitlements` se copia tal cual llega. Quien produce
# esa lista es `entitlement_service`; este modulo solo construye y verifica.

CANONICAL_SUBJECT_KEYS = ("id", "entitlements", "status", "role")


def build_subject(
    subject_id: Any = None,
    entitlements: Optional[List[str]] = None,
    status: Any = None,
    role: Any = None,
) -> Dict[str, Any]:
    """Construye el sujeto canonico que consume `can()`.

    No lanza y no valida: `can()` es quien decide. Aqui solo se normaliza la
    forma para que todos los consumidores coincidan.
    """
    subject: Dict[str, Any] = {
        "id": subject_id,
        "entitlements": list(entitlements or []),
        "status": _norm(status) or STATUS_ACTIVE,
    }
    if role is not None:
        subject["role"] = role
    return subject
