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
regla que aplica `entitlement_service`, y es lo que mantiene funcionando al
Access Bridge, que aun no propaga el status al evaluador.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .system_identity import is_valid_entity_id
from .workspace_registry import get_space, CORE_OPERATIVO_UNICO

ALLOW = "allow"
DENY = "deny"

# Estados de usuario reconocidos. Solo STATUS_ACTIVE habilita el acceso.
STATUS_ACTIVE = "activo"
STATUS_PENDING = "pendiente"
STATUS_SUSPENDED = "suspendido"
VALID_STATUSES = (STATUS_ACTIVE, STATUS_PENDING, STATUS_SUSPENDED)

# Acciones conocidas = permisos del registry. Cualquier otra accion -> deny.
_VALID_ACTIONS = {f"workspace.open.{k}" for k in (
    "legal", "medical", "odontologia", "psicologia", "enfermeria",
    "finance", "accounting", "inmobiliaria", "empresa", "comunidad",
)}


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
