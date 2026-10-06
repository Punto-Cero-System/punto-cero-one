"""Workspace Registry — fuente única de espacios del Workspace Universal (FASE 1-2).

Regla arquitectónica congelada:
- Único Core operativo: punto-cero-legal (core_id fijo para TODOS los espacios).
- Medical, odontología, psicología, enfermería, finanzas, contabilidad,
  inmobiliaria son ÚNICAMENTE workspace_space. Nunca nuevos Cores.
- Solo lectura en memoria. Sin MongoDB, sin migraciones, sin persistencia.
- Compatible con identity_core.SPACE_CATALOG y frontend workspaceSpaces.js
  (no los reemplaza en esta fase, los espeja).

ESTE ES EL CATALOGO AUTORIDAD. Los demas catálogos de espacios son espejos y
no conceden permisos: `identity_core.SPACE_CATALOG` (backend) y
`frontend/src/config/workspaceSpaces.js` + `frontend/src/system/workspaceCatalog.js`.
Los cuatro estan congelados en `docs/architecture/workspace_registry.contract.json`
y sus invariantes en `backend/tests/test_workspace_registry_contract.py`.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

CORE_OPERATIVO_UNICO = "punto-cero-legal"

# status: declared | preview | live | deprecated
# entry_url (FASE 7.5): URL de lanzamiento de la vertical; no determina
# `location`, que se declara por separado (`internal`/`external`).
# UNICA fuente de dominios del ecosistema: el frontend no decide dominios.
#
# D2.2-B.3-A — Este diccionario es el UNICO vocabulario de lifecycle del
# sistema. `available`, `coming_soon`, `developing`, `future`, `production`,
# `beta`, `alpha` e `internal` NO son lifecycle: no viven aqui y no deben
# aparecer en ningun catalogo como si lo fueran.
LIFECYCLE_ACTIVE = "live"
LIFECYCLE_PREVIEW = "preview"
LIFECYCLE_DECLARED = "declared"
LIFECYCLE_DEPRECATED = "deprecated"

LIFECYCLE_STATUSES = (
    LIFECYCLE_ACTIVE,
    LIFECYCLE_PREVIEW,
    LIFECYCLE_DECLARED,
    LIFECYCLE_DEPRECATED,
)

# Derivacion de disponibilidad (D2.2-B.3-A, eje B).
#
# Traduce lifecycle -> disponibilidad. NO es un segundo vocabulario: no
# introduce valores nuevos, es una FUNCION del status.
#
# La frontera coincide exactamente con la clase que `policy_can.can()` ya usa
# en su paso 6 (`declared`/`deprecated` exigen `allow_non_live`), de modo que
# "disponible para el frontend" y "autorizado sin flag" dicen lo mismo. Esa
# coincidencia es intencional, y es lo que hace la derivacion segura.
LIFECYCLE_OPEN = (LIFECYCLE_ACTIVE, LIFECYCLE_PREVIEW)
LIFECYCLE_CLOSED = (LIFECYCLE_DECLARED, LIFECYCLE_DEPRECATED)
WORKSPACE_REGISTRY: List[Dict[str, Any]] = [
    {"space_key": "legal", "core_id": CORE_OPERATIVO_UNICO, "status": "live", "permission": "workspace.open.legal", "label": "Punto Cero Legal", "route": "/workspace/legal", "entry_url": "https://legal.puntocerosystem.com/one", "location": "internal"},
    {"space_key": "medical", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.medical", "label": "Punto Cero Medical", "route": "/workspace/medical", "entry_url": "https://medical.puntocerosystem.com/one", "location": "internal"},
    {"space_key": "odontologia", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.odontologia", "label": "Odontología", "route": "/workspace/odontologia", "entry_url": "https://odontologia.puntocerosystem.com/one", "location": "internal"},
    {"space_key": "psicologia", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.psicologia", "label": "Psicología", "route": "/workspace/psicologia", "entry_url": "https://psicologia.puntocerosystem.com/one", "location": "internal"},
    {"space_key": "enfermeria", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.enfermeria", "label": "Enfermería", "route": "/workspace/enfermeria", "entry_url": "https://enfermeria.puntocerosystem.com/one", "location": "internal"},
    {"space_key": "finance", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.finance", "label": "Finanzas", "route": "/workspace/finance", "entry_url": None, "location": "internal"},
    {"space_key": "accounting", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.accounting", "label": "Contabilidad", "route": "/workspace/accounting", "entry_url": None, "location": "internal"},
    {"space_key": "inmobiliaria", "core_id": CORE_OPERATIVO_UNICO, "status": "declared", "permission": "workspace.open.inmobiliaria", "label": "Inmobiliaria", "route": "/workspace/inmobiliaria", "entry_url": None, "location": "internal"},
    # Filas legacy para compatibilidad con identity_core / frontend actual.
    {"space_key": "empresa", "core_id": CORE_OPERATIVO_UNICO, "status": "preview", "permission": "workspace.open.empresa", "label": "Punto Cero Empresa", "route": "/workspace/empresa", "entry_url": None, "location": "internal"},
    {"space_key": "comunidad", "core_id": CORE_OPERATIVO_UNICO, "status": "live", "permission": "workspace.open.comunidad", "label": "Punto Cero One", "route": "/", "entry_url": None, "location": "external"},
]


def list_spaces(status: Optional[str] = None) -> List[Dict[str, Any]]:
    if status is None:
        return [dict(s) for s in WORKSPACE_REGISTRY]
    return [dict(s) for s in WORKSPACE_REGISTRY if s.get("status") == status]


def get_space(space_key: str) -> Optional[Dict[str, Any]]:
    for space in WORKSPACE_REGISTRY:
        if space.get("space_key") == space_key:
            return dict(space)
    return None


def permission_for(space_key: str) -> Optional[str]:
    space = get_space(space_key)
    return space.get("permission") if space else None


def validate_registry() -> None:
    """Garantiza que ningún espacio apunte a otro Core."""
    for space in WORKSPACE_REGISTRY:
        if space.get("core_id") != CORE_OPERATIVO_UNICO:
            raise ValueError(f"space {space.get('space_key')} apunta a core prohibido: {space.get('core_id')}")


# ---------------------------------------------------------------------------
# D2.2-B.3-A — Derivacion de disponibilidad y proyeccion canonica
# ---------------------------------------------------------------------------

def derive_availability(status: Optional[str]) -> str:
    """Traduce un lifecycle a disponibilidad. Fail-closed.

    `live`/`preview` -> `"open"`      (disponible y lanzable)
    `declared`/`deprecated` -> `"closed"`
    ausente o desconocido -> `"closed"`

    La ultima fila es la parte importante: un status ausente NO se asume
    activo. Es el mismo criterio que `policy_can.can()` aplica cuando no
    reconoce un estado, y el que `workspaceOrchestrator.js` incumplia con su
    fallback `status || 'live'`.

    No es un segundo vocabulario de lifecycle: no introduce estados nuevos,
    es una funcion del status. Los valores `available` / `coming_soon` del
    frontend son ESTA salida, no una declaracion paralela.
    """
    return "open" if _norm_status(status) in LIFECYCLE_OPEN else "closed"


def is_available(status: Optional[str]) -> bool:
    """`derive_availability(status) == "open"`. Fail-closed."""
    return derive_availability(status) == "open"


def to_frontend_projection() -> List[Dict[str, Any]]:
    """Proyeccion canonica del Registry para consumo del frontend.

    Transporta SOLO informacion que ya existe en `WORKSPACE_REGISTRY`, mas
    `availability`, que es DERIVADA por la funcion de arriba. No inventa
    campos y no duplica vocabulario.

    Deliberadamente NO incluye `launchMode` ni el antiguo flag de navegación
    `external`: LaunchMode se transporta en su contrato separado, y location
    se incluye como un campo explícito (`internal`/`external`).

    Esta funcion es una PROYECCION, no una fuente de verdad: `list_spaces()` y
    `get_space()` siguen leyendo `WORKSPACE_REGISTRY` directamente. Si alguien
    editara la proyeccion en lugar del registro, el contrato test lo detecta.
    """
    out: List[Dict[str, Any]] = []
    for space in WORKSPACE_REGISTRY:
        status = space.get("status")
        out.append({
            "space_key": space.get("space_key"),
            "status": status,
            "permission": space.get("permission"),
            "route": space.get("route"),
            "label": space.get("label"),
            "core_id": space.get("core_id"),
            "location": space.get("location"),
            # Derivado, no declarado. Ver `derive_availability`.
            "availability": derive_availability(status),
        })
    return out


def _norm_status(value: Any) -> str:
    return str(value or "").strip().lower()
