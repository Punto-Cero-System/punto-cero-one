"""Reusable community auth for FastAPI routes.

Reads the httpOnly `session_token` cookie (or a `Authorization: Bearer` token
as fallback) directly from the Request object and resolves to the `users`
document. Two flavors:
    - current_user_or_none(request)   → for public-with-optional-auth reads
    - require_current_user(...)       → FastAPI Depends() that 401s
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, Request


def _extract_token(request: Request) -> Optional[str]:
    cookie_val = request.cookies.get("session_token")
    if cookie_val:
        return cookie_val
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip() or None
    return None


async def current_user_or_none(request: Request) -> Optional[dict]:
    token = _extract_token(request)
    if not token:
        return None
    db = request.app.state.db
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    try:
        exp = session.get("expires_at")
        expires = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return None
    except Exception:
        return None
    return await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})


async def require_current_user(request: Request) -> dict:
    user = await current_user_or_none(request)
    if not user:
        raise HTTPException(status_code=401, detail="Debes iniciar sesión")
    return user
