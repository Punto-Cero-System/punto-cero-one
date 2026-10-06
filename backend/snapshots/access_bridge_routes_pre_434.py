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
    try:
        intent = bridge.create_access_intent(
            subject_id=subject_id,
            space_key=payload.space_key.strip().lower(),
            entitlements=rights,
            entry_host=payload.context.get("entry_host"),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="denied") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"intent": intent}
