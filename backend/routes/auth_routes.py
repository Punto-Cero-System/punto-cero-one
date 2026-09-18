"""Authentication routes. Prefix: /api/auth"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import (
    verify_password,
    create_access_token,
    get_current_user,
    bearer_scheme,
    decode_token,
)
from models import LoginInput, LoginResponse, UserPublic
from services.community_deps import current_user_or_none
from services.identity_core import IdentityConflictError, resolve_identity

router = APIRouter(prefix="/api/auth", tags=["auth"])


BRUTE_FORCE_MAX_ATTEMPTS = 5
BRUTE_FORCE_WINDOW_MIN = 15


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_lockout(db, identifier: str) -> None:
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if not doc:
        return
    if doc.get("count", 0) < BRUTE_FORCE_MAX_ATTEMPTS:
        return
    last_ts = doc.get("last_attempt")
    if not last_ts:
        return
    try:
        last_dt = datetime.fromisoformat(last_ts)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return
    elapsed_min = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60
    if elapsed_min < BRUTE_FORCE_WINDOW_MIN:
        remaining = int(BRUTE_FORCE_WINDOW_MIN - elapsed_min)
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Intenta de nuevo en {remaining} minutos.",
        )
    # reset window
    await db.login_attempts.delete_one({"identifier": identifier})


async def _record_failed(db, identifier: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"last_attempt": now}},
        upsert=True,
    )


async def _clear_failed(db, identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginInput, request: Request):
    db = request.app.state.db
    email = payload.email.lower().strip()
    ip = _client_ip(request)
    identifier = f"{ip}:{email}"

    await _check_lockout(db, identifier)

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await _record_failed(db, identifier)
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    await _clear_failed(db, identifier)

    token = create_access_token(user["id"], user["email"], user["role"])
    user_public = UserPublic(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"],
    )
    return LoginResponse(
        access_token=token,
        expires_in_hours=int(os.environ.get("JWT_ACCESS_TTL_HOURS", "8")),
        user=user_public,
    )


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"],
    )


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    # Stateless JWT — client discards token. Endpoint exists for consistency.
    return {"ok": True, "message": "Sesión cerrada"}


async def _optional_jwt_user(request: Request) -> Optional[dict]:
    """Sesión A (JWT) opcional: None si no hay token o es inválido.

    Reutiliza `bearer_scheme` / `decode_token` de auth.py SIN modificarlos:
    no reemplaza `get_current_user`, solo añade resolución tolerante para el
    contexto dual (JWT o comunidad, o ambos).
    """
    creds = await bearer_scheme(request)
    token = creds.credentials if creds and creds.scheme.lower() == "bearer" else None
    if not token:
        return None
    try:
        payload = decode_token(token)
    except HTTPException:
        return None
    if payload.get("type") != "access":
        return None
    db = request.app.state.db
    return await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})


@router.get("/system-context")
async def system_context(request: Request):
    """Identity Core V1 (F13.1) — contexto unificado de SOLO LECTURA.

    Resuelve identidad desde las sesiones existentes (JWT y/o comunidad),
    calcula account_type/verticales/organizaciones/espacios y no persiste
    nada. No reemplaza /api/auth/me ni /api/community/auth/me.
    """
    db = request.app.state.db
    jwt_user = await _optional_jwt_user(request)
    community_user = await current_user_or_none(request)
    if not jwt_user and not community_user:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        return await resolve_identity(db, jwt_user=jwt_user, community_user=community_user)
    except IdentityConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "identity_conflict",
                "message": "Las sesiones JWT y comunidad pertenecen a usuarios distintos.",
                "jwt_user_id": exc.jwt_user_id,
                "community_user_id": exc.community_user_id,
            },
        )
