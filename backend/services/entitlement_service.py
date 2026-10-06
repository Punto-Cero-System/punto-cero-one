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

# FASE 4.3.2 - D2 ACTIVADO: `role` es CAPACIDAD TECNICA, no acceso.
#
# `_ROLE_TO_SPACES` queda ELIMINADO. Antes `admin` otorgaba `legal` e
# `investor` otorgaba `empresa` solo por su rol, lo que contradecía el diseño
# documentado de `policy_can.can()` ("el rol NO decide acceso").
#
# El workspace se concede UNICAMENTE por:
#   1. vertical declarada  -> _VERTICAL_TO_SPACE
#   2. organizacion        -> workspace.open.empresa
#   3. sujeto autenticado  -> workspace.open.comunidad (CONDICIONAL: solo si
#                             `status` es "activo", por D1)
#
# El parametro `role` SE CONSERVA en la firma para no romper a los llamadores
# (access_bridge_routes lo sigue pasando), pero ya no influye en el resultado.
# La deuda del alias `admin` -> `admin_system` (models.ROLE_ALIASES) queda
# anotada: hoy `role` es irrelevante para el acceso, y con D1 cerrado el
# estado del usuario es lo que decide.


# FASE 4.3.3 - D1 ACTIVADO: One es puerta universal SOLO para usuarios activos.
#
# Antes (y todavia en el Bridge) la regla era INCONDICIONAL:
#     if subject_id: _grant("comunidad")
# Ahora el acceso a ESPACIOS -incluido One- esta gobernado por `status`:
#
#     status activo      -> vertical + organizacion + comunidad (puerta)
#     status pendiente   -> []   (fail-closed)
#     status suspendido  -> []   (fail-closed)
#
# El corte es TOTAL: un usuario no activo no recibe NINGUN espacio, ni por
# vertical ni por organizacion. Es la unica forma de que la suspension tenga
# efecto sin esperar a que expire el JWT.
#
# ESTADO ACTUAL (cierre de D1): la regla YA se aplica en produccion por las
# DOS vias de entrada del Bridge, y por la cadena publica de este modulo.
#
#   · `access_bridge_routes._resolved_status` lee el estado del JWT y de la
#     cookie de comunidad, y lo pasa como `status=` en cada llamada.
#   · `entitlements_for_identity` (el atajo de este archivo) lo lee de
#     `identity["user"]["status"]`, y `identity_core._public_user` lo proyecta.
#
# El valor por defecto sigue siendo "activo" cuando el estado NO se informa en
# absoluto. Eso es deliberado y NO es un agujero: un documento de `users` sin
# campo `status` es un usuario preexistente, y tratarlo como bloqueado le
# quitaria el acceso de golpe. El corte real lo aplica el dato, no su ausencia.
STATUS_ACTIVE = "activo"
STATUS_PENDING = "pendiente"
STATUS_SUSPENDED = "suspendido"
VALID_STATUSES = (STATUS_ACTIVE, STATUS_PENDING, STATUS_SUSPENDED)


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def get_entitlements(
    subject_id: Optional[str] = None,
    *,
    verticals: Optional[List[str]] = None,
    organizations: Optional[List[Dict[str, Any]]] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    identity: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Deriva la lista de permisos workspace.open.* para un sujeto.

    Acepta tanto los campos sueltos como el dict `identity` completo de
    identity_core.resolve_identity (identity.identity.verticals).

    FASE 4.3.2 (D2): `role` se acepta por compatibilidad de firma pero NO
    otorga ningun workspace. El acceso depende unicamente de `verticals`,
    `organizations` y del hecho de existir `subject_id`.

    FASE 4.3.3 (D1): `status` gobierna TODO el acceso. `pendiente` y
    `suspendido` devuelven `[]` sin importar verticales u organizaciones.
    Si `status` no se informa se asume `activo` (compatibilidad: usuario
    preexistente sin el campo). Un estado desconocido NO concede nada
    (fail-closed).

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
        if not status:
            status = (identity.get("user") or {}).get("status")

    # D1: fail-closed. Sin `status` informado se asume activo, por lo que el
    # Bridge actual no cambia de comportamiento. Cualquier estado explicito
    # distinto de "activo" corta TODOS los espacios.
    effective_status = _norm(status) or STATUS_ACTIVE
    if effective_status != STATUS_ACTIVE:
        return []

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

    # D2: ya NO hay otorgamiento por rol. Se conserva el parametro en la firma
    # por compatibilidad con los llamadores, pero `role` no concede nada.
    del role

    # D1: One es la puerta universal, pero SOLO para usuarios activos. El corte
    # por status ya se aplico arriba (fail-closed), asi que llegar aqui implica
    # `effective_status == activo`.
    if subject_id:
        _grant("comunidad")

    return granted


def entitlements_for_identity(identity: Dict[str, Any]) -> List[str]:
    """Atajo: deriva entitlements desde el dict completo de resolve_identity.

    D1: propaga el estado que el Identity Core ya proyecta en
    `identity["user"]["status"]`. Antes ese campo no viajaba en la proyección y
    el atajo resolvía siempre "activo", con lo que un usuario suspendido
    recibía `workspace.open.comunidad` por esta vía. No se relee la base de
    datos: es la MISMA información que ya resolvió `resolve_identity`.
    """
    user_block = (identity or {}).get("user") or {}
    return get_entitlements(
        subject_id=user_block.get("id"),
        identity=identity,
        role=user_block.get("role"),
        status=user_block.get("status"),
    )


def spaces_for_entitlements(entitlements: List[str]) -> List[Dict[str, Any]]:
    """Resuelve los espacios del registry abiertos por estos entitlements."""
    allowed = set(entitlements or [])
    out = []
    for space in WORKSPACE_REGISTRY:
        if space.get("permission") in allowed and space.get("core_id") == CORE_OPERATIVO_UNICO:
            out.append(dict(space))
    return out
