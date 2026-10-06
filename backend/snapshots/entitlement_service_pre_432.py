"""Entitlement Foundation — derechos de acceso derivados, solo lectura (FASE 3).

Deriva entitlements `workspace.open.<space_key>` desde la identidad ya
resuelta por identity_core, SIN persistencia, SIN MongoDB, SIN JWT nuevo.

    subject_id -> entitlements -> workspace access
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .workspace_registry import WORKSPACE_REGISTRY, CORE_OPERATIVO_UNICO

# Mapeo vertical -> space_key (verticales identity_core -> registry).
_VERTICAL_TO_SPACE = {
    "legal": "legal",
    "medical": "medical",
    "empresa": "empresa",
    "comunidad": "comunidad",
}

# Roles legacy que otorgan entitlement inicial (compatibilidad, no decisión final).
# La decisión final siempre pasa por can(); esto solo alimenta la derivación.
_ROLE_TO_SPACES = {
    "admin": ["legal"],
    "investor": ["empresa"],
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def get_entitlements(
    subject_id: Optional[str] = None,
    *,
    verticals: Optional[List[str]] = None,
    organizations: Optional[List[Dict[str, Any]]] = None,
    role: Optional[str] = None,
    identity: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Deriva la lista de permisos workspace.open.* para un sujeto.

    Acepta tanto los campos sueltos como el dict `identity` completo de
    identity_core.resolve_identity (identity.identity.verticals, role en user).
    Puro y determinista: mismo input -> mismo output. Sin I/O.
    """
    verticals = list(verticals or [])
    organizations = list(organizations or [])
    if identity:
        id_block = identity.get("identity") or {}
        if not verticals:
            verticals = list(id_block.get("verticals") or [])
        if not organizations:
            organizations = list(identity.get("organizations") or [])
        if not role:
            user_block = identity.get("user") or {}
            role = user_block.get("role")

    granted: List[str] = []
    seen = set()

    def _grant(space_key: str) -> None:
        perm = f"workspace.open.{space_key}"
        if perm not in seen:
            seen.add(perm)
            granted.append(perm)

    for vertical in verticals:
        space_key = _VERTICAL_TO_SPACE.get(_norm(vertical))
        if space_key:
            _grant(space_key)

    # Organización tipo empresa otorga acceso al espacio empresa.
    for org in organizations:
        vertical = _norm((org or {}).get("vertical"))
        if vertical == "empresa" or (org or {}).get("company_id"):
            _grant("empresa")
            break

    # Fallback legacy por rol (compatibilidad con router actual).
    for space_key in _ROLE_TO_SPACES.get(_norm(role), []):
        _grant(space_key)

    # Todo sujeto autenticado conserva acceso a comunidad (puerta comercial).
    if subject_id:
        _grant("comunidad")

    return granted


def entitlements_for_identity(identity: Dict[str, Any]) -> List[str]:
    """Atajo: deriva entitlements desde el dict completo de resolve_identity."""
    user_block = (identity or {}).get("user") or {}
    return get_entitlements(
        subject_id=user_block.get("id"),
        identity=identity,
        role=user_block.get("role"),
    )


def spaces_for_entitlements(entitlements: List[str]) -> List[Dict[str, Any]]:
    """Resuelve los espacios del registry abiertos por estos entitlements."""
    allowed = set(entitlements or [])
    out = []
    for space in WORKSPACE_REGISTRY:
        if space.get("permission") in allowed and space.get("core_id") == CORE_OPERATIVO_UNICO:
            out.append(dict(space))
    return out
