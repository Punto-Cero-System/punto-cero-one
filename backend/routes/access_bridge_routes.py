"""Access Bridge routes — read-only + intent preparation (FASES 1-6).

- GET  /api/access/spaces       -> workspace_registry (public)
- GET  /api/access/entitlements -> entitlements derived from identity_core (auth required)
- POST /api/access/intent       -> access_bridge intent code (auth required)

No autentica, no emite JWT, no toca Core Legal.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import get_current_user
from services import access_bridge as bridge
from services import entitlement_service as entitlements
from services import workspace_registry as registry
from services.community_deps import current_user_or_none
from services.identity_core import IdentityConflictError, resolve_identity
from services.system_identity import (
    build_identity_contract,
    is_valid_entity_id,
    resolve_system_identity,
)


router = APIRouter(prefix="/api/access", tags=["access-bridge"])


_PERMISSION_PREFIX = "workspace.open."


async def _resolved_status(request: Request, jwt_user: dict | None) -> str | None:
    """El `status` real del usuario, sea cual sea la vía por la que entró.

    D1 — antes se leía solo de `jwt_user`. Un usuario que entra únicamente por la
    cookie de comunidad llega con `jwt_user=None`, así que su `status` se perdía,
    `get_entitlements` lo resolvía a "activo" y la suspensión no cortaba nada.
    La cookie es la vía normal de One, luego ese era el caso habitual.

    Se lee de las DOS fuentes, igual que ya se hacía con `role`. No introduce una
    regla nueva: solo entrega el dato que la política fail-closed ya existía para
    consumir. Si ninguna fuente trae `status`, se devuelve `None` y cada consumidor
    mantiene su compatibilidad ("ausente → activo"), que es lo que ya hacen
    `get_entitlements` y `policy_can`.
    """
    if jwt_user and jwt_user.get("status"):
        return jwt_user.get("status")
    community_user = await current_user_or_none(request)
    return (community_user or {}).get("status")


def _spaces_from_entitlements(entitlements: list[str]) -> list[str]:
    """
    Deriva vailable_spaces desde los entitlements ya resueltos.

    No inventa espacios: cada space_key sale de un permiso
    workspace.open.<space_key> y se contrasta contra el Workspace Registry,
    que es la unica fuente de espacios y permisos. Un permiso sin espacio
    registrado se descarta.
    """
    spaces: list[str] = []
    for permission in entitlements or []:
        value = str(permission or "").strip().lower()
        if not value.startswith(_PERMISSION_PREFIX):
            continue
        key = value[len(_PERMISSION_PREFIX):].strip()
        if not key or key in spaces:
            continue
        if registry.get_space(key):
            spaces.append(key)
    return spaces


class IntentRequest(BaseModel):
    space_key: str = Field(min_length=1, max_length=64)
    context: dict = Field(default_factory=dict)


async def _access_context(request: Request, jwt_user: dict) -> tuple[dict, list[str], str]:
    """Read the established identity sources; never create or persist identity.

    FASE 1.2: el sujeto del Access Bridge es el `entity_id` canonico resuelto
    por `system_identity` (NO `users.id`). Si no existe identidad valida se
    responde 403: nunca se degrada a email ni a un sujeto literal.
    """
    db = request.app.state.db
    community_user = await current_user_or_none(request)
    # D1: se resuelve UNA vez y se reutiliza en `get_entitlements` y en el intent.
    effective_status = await _resolved_status(request, jwt_user)
    try:
        identity = await resolve_identity(
            db,
            jwt_user=jwt_user,
            community_user=community_user,
        )
    except IdentityConflictError as exc:
        raise HTTPException(status_code=409, detail="identity_conflict") from exc

    canonical = await resolve_system_identity(
        db,
        jwt_user=jwt_user,
        community_user=community_user,
    )
    subject_id = canonical.get("entity_id")
    if not is_valid_entity_id(subject_id):
        # Fail-closed: sin identidad canonica no hay sujeto. No se inventa uno.
        raise HTTPException(status_code=403, detail="identity_unresolved")

    rights = entitlements.get_entitlements(
        subject_id=subject_id,
        verticals=(identity.get("identity") or {}).get("verticals"),
        organizations=identity.get("organizations"),
        role=(jwt_user or {}).get("role"),
        # D1: se propaga el `status` real del usuario, resuelto arriba desde
        # cualquier vía de entrada.
        #
        # `auth.get_current_user` y `community_deps.current_user_or_none` devuelven
        # el documento completo de `users` (sin `password_hash` ni `_id`), así que
        # `status` viaja sin tocar el JWT ni la emisión del token. La suspensión
        # surte efecto en la SIGUIENTE llamada al Bridge, sin esperar expiración.
        #
        # Compatibilidad: un usuario sin campo `status` llega como `None` y
        # `get_entitlements` lo resuelve a "activo", de modo que ningún usuario
        # preexistente pierde acceso.
        status=effective_status,
    )
    # FASE 3A: la identidad canonica viaja junto a los permisos.
    # available_spaces se deriva de los entitlements ya resueltos y nunca
    # se inventa: cada space_key sale de un permiso y existe en el
    # Workspace Registry.
    identity_contract = build_identity_contract(
        subject_id,
        available_spaces=_spaces_from_entitlements(rights),
    )
    return identity, rights, subject_id, identity_contract


@router.get("/spaces")
async def list_spaces():
    return {"spaces": registry.list_spaces()}


@router.get("/entitlements")
async def list_entitlements(
    request: Request, jwt_user: dict | None = Depends(get_current_user),
):
    identity, rights, subject_id, identity_contract = await _access_context(request, jwt_user)
    return {
        "subject_id": subject_id,
        "identity": identity_contract,
        "entitlements": rights,
    }


@router.post("/intent")
async def create_intent(
    payload: IntentRequest,
    request: Request,
    jwt_user: dict | None = Depends(get_current_user),
):
    identity, rights, subject_id, identity_contract = await _access_context(request, jwt_user)
    # D1: el mismo `status` viaja al sujeto canonico del intent. Sin esto,
    # `build_subject` normalizaba a "activo" y `can()` solo frenaba por el paso 5
    # (entitlements vacio). Con el status real, frena en el paso 1, que es donde
    # la politica lo coloca con prioridad absoluta.
    #
    # `await` es obligatorio: `_resolved_status` es una corrutina. Sin el, el
    # objeto corrutina llegaba a `build_subject`, se normalizaba a un string
    # ("<coroutine object ...>"), `can()` lo rechazaba por estado desconocido
    # (fail-closed) y TODO intent devolvia 403, tambien para usuarios activos.
    status = await _resolved_status(request, jwt_user)
    try:
        intent = bridge.create_access_intent(
            subject_id=subject_id,
            space_key=payload.space_key.strip().lower(),
            entitlements=rights,
            entry_host=payload.context.get("entry_host"),
            status=status,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="denied") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"intent": intent}
