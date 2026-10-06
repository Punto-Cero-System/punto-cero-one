"""Policy can(subject, action, context) — el rol NO decide acceso (FASE 4).

    can(subject, "workspace.open.medical", context) -> allow / deny

El acceso depende de identidad + entitlement + workspace + organización +
contexto. Función pura, sin I/O, sin Mongo, sin JWT.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .workspace_registry import get_space, CORE_OPERATIVO_UNICO

ALLOW = "allow"
DENY = "deny"

# Acciones conocidas = permisos del registry. Cualquier otra acción -> deny.
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


def can(
    subject: Optional[Dict[str, Any]] = None,
    action: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> str:
    """Evalúa si `subject` puede ejecutar `action` en `context`.

    subject: {id, entitlements:[...], role, ...} (el rol es informativo).
    action:  "workspace.open.<space_key>".
    context: {space_status, organization, ...} opcional.
    Retorna "allow" | "deny". Nunca lanza por input desconocido.
    """
    context = context or {}
    action_norm = str(action or "").strip().lower()
    if not subject or not subject.get("id"):
        return DENY
    if action_norm not in _VALID_ACTIONS:
        return DENY

    space_key = action_norm.split(".")[-1]
    space = get_space(space_key)
    if not space:
        return DENY
    # Regla arquitectónica: solo el Core único puede abrir espacios.
    if space.get("core_id") != CORE_OPERATIVO_UNICO:
        return DENY

    entitlements = _norm_list((subject or {}).get("entitlements"))
    if action_norm not in entitlements:
        return DENY

    # Espacios no-live requieren flag explícito de preview en contexto.
    # (Puerta comercial puede mostrarlos como "próximamente" sin abrirlos.)
    status = space.get("status")
    if status in ("declared", "deprecated") and not context.get("allow_non_live"):
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
