"""Community authentication routes. Prefix: /api/community/auth

Cookie-based session (httpOnly), with Authorization: Bearer fallback so the same
routes work in browser and API clients (e.g., curl, Postman, VS Code REST).

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS
BREAKS THE AUTH. The frontend derives its redirect from `window.location.origin`.
"""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Header
from pydantic import BaseModel, ConfigDict, Field

from services.community_auth import (
    registry,
    AuthProviderError,
    new_session_token,
    session_expiry,
    parse_expires_at,
    ProviderIdentity,
)

logger = logging.getLogger("punto-cero-api.community_auth_routes")

router = APIRouter(prefix="/api/community/auth", tags=["community-auth"])


COOKIE_NAME = "session_token"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SessionExchangeInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    provider: str = Field(default="google", min_length=2, max_length=40)
    session_id: str = Field(min_length=4, max_length=400)


class CommunityUserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "member"
    country: Optional[str] = None
    language: Optional[str] = None
    headline: Optional[str] = None
    providers: list[str] = []
    created_at: str


class ProvidersResponse(BaseModel):
    enabled: list[dict]
    session_ttl_days: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cookie_flags() -> dict:
    """Cross-site (frontend + backend on different subdomains) requires
    SameSite=None + Secure. Local dev override via COOKIE_SAMESITE env."""
    samesite = os.environ.get("COOKIE_SAMESITE", "none").lower()
    secure = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
    return {"httponly": True, "secure": secure, "samesite": samesite, "path": "/"}


def _set_session_cookie(response: Response, token: str) -> None:
    ttl_days = int(os.environ.get("COMMUNITY_SESSION_TTL_DAYS", "7"))
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=ttl_days * 24 * 60 * 60,
        **_cookie_flags(),
    )


def _clear_session_cookie(response: Response) -> None:
    flags = _cookie_flags()
    response.delete_cookie(key=COOKIE_NAME, path=flags["path"], samesite=flags["samesite"])


def _extract_token(cookie_val: Optional[str], auth_header: Optional[str]) -> Optional[str]:
    if cookie_val:
        return cookie_val
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip() or None
    return None


async def _upsert_user_from_identity(db, identity: ProviderIdentity) -> dict:
    """Idempotent: create by email, else merge provider link & refresh basic fields."""
    existing = await db.users.find_one({"email": identity.email}, {"_id": 0})
    now = _now_iso()
    link = {
        "provider": identity.provider,
        "provider_user_id": identity.provider_user_id,
        "linked_at": now,
    }
    if not existing:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        doc = {
            "id": user_id,
            "email": identity.email,
            "name": identity.name,
            "role": "member",
            "picture": identity.picture,
            "country": None,
            "language": None,
            "headline": None,
            "auth_providers": [link],
            "created_at": now,
            "last_login_at": now,
        }
        await db.users.insert_one(doc)
        return doc

    # merge
    providers = existing.get("auth_providers") or []
    if not any(p.get("provider") == identity.provider for p in providers):
        providers.append(link)
    update = {
        "name": existing.get("name") or identity.name,
        "picture": existing.get("picture") or identity.picture,
        "auth_providers": providers,
        "last_login_at": now,
    }
    # Preserve admin/investor roles; only default to member on brand-new records.
    await db.users.update_one({"id": existing["id"]}, {"$set": update})
    existing.update(update)
    return existing


def _user_to_public(user: dict) -> CommunityUserPublic:
    providers = [p.get("provider") for p in (user.get("auth_providers") or []) if p.get("provider")]
    return CommunityUserPublic(
        id=user["id"],
        email=user["email"],
        name=user.get("name") or user["email"].split("@")[0],
        picture=user.get("picture"),
        role=user.get("role", "member"),
        country=user.get("country"),
        language=user.get("language"),
        headline=user.get("headline"),
        providers=providers,
        created_at=user.get("created_at", _now_iso()),
    )


async def _get_current_user(request: Request, cookie_val: Optional[str], auth_header: Optional[str]) -> dict:
    token = _extract_token(cookie_val, auth_header)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    db = request.app.state.db
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión no encontrada")
    try:
        expires_at = parse_expires_at(session.get("expires_at"))
    except AuthProviderError:
        raise HTTPException(status_code=401, detail="Sesión corrupta")
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/providers", response_model=ProvidersResponse)
async def providers():
    return ProvidersResponse(
        enabled=registry.enabled_list(),
        session_ttl_days=int(os.environ.get("COMMUNITY_SESSION_TTL_DAYS", "7")),
    )


@router.post("/session", response_model=CommunityUserPublic)
async def create_session(
    payload: SessionExchangeInput,
    request: Request,
    response: Response,
):
    provider = registry.get(payload.provider)
    if provider is None:
        raise HTTPException(status_code=400, detail=f"Proveedor '{payload.provider}' no habilitado")
    try:
        identity = await provider.exchange_session(payload.session_id)
    except AuthProviderError as e:
        raise HTTPException(status_code=401, detail=str(e))

    db = request.app.state.db
    user = await _upsert_user_from_identity(db, identity)

    # Prefer provider-issued session token when available for continuity;
    # otherwise mint our own — the client only sees the httpOnly cookie.
    token = identity.session_token or new_session_token()
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": user["id"],
            "provider": identity.provider,
            "expires_at": session_expiry().isoformat(),
            "created_at": _now_iso(),
        }},
        upsert=True,
    )
    _set_session_cookie(response, token)
    return _user_to_public(user)


@router.get("/me", response_model=CommunityUserPublic)
async def me(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _get_current_user(request, session_token, authorization)
    return _user_to_public(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = _extract_token(session_token, authorization)
    if token:
        db = request.app.state.db
        await db.user_sessions.delete_one({"session_token": token})
    _clear_session_cookie(response)
    return {"ok": True, "message": "Sesión cerrada"}
