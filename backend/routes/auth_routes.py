"""Authentication routes. Prefix: /api/auth"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

from auth import (
    verify_password,
    create_access_token,
    get_current_user,
)
from models import LoginInput, LoginResponse, UserPublic

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
