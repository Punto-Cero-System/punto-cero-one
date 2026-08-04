"""Community authentication routes. Prefix: /api/community/auth

Cookie-based session (httpOnly), with Authorization: Bearer fallback so the same
routes work in browser and API clients (e.g., curl, Postman, VS Code REST).

Also hosts native Email/Password registration & login coexisting with the
provider-based social flow.  Passwords are bcrypt-hashed and stored on the
same `users` document as the auth_providers[] list.  Password reset uses a
one-shot token stored in `password_reset_tokens` with a TTL index.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS
BREAKS THE AUTH. The frontend derives its redirect from `window.location.origin`.
"""
import os
import re
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Header
from pydantic import BaseModel, ConfigDict, Field, EmailStr

from auth import hash_password, verify_password
from services.community_auth import (
    registry,
    AuthProviderError,
    new_session_token,
    session_expiry,
    parse_expires_at,
    ProviderIdentity,
    OAuth2AuthorizationCodeProvider,
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
    email_verified: bool = False
    created_at: str


class ProvidersResponse(BaseModel):
    enabled: list[dict]
    coming_soon: list[dict] = []
    email_password: bool = True
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
            "email_verified": True,  # Social providers already verified this email.
            "email_verified_at": now,
            "created_at": now,
            "last_login_at": now,
        }
        await db.users.insert_one(doc)
        # Fire-and-forget welcome email (soft-fails if provider not configured).
        try:
            from services.email import send_welcome
            await send_welcome(identity.email, identity.name)
        except Exception:
            pass
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
        email_verified=bool(user.get("email_verified", False)),
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
    # Providers whose OAuth back-end is not wired yet — the frontend can list
    # them as "Próximamente" so users know they're coming without breaking auth.
    coming = [
        {"key": "apple", "label": "Apple"},
        {"key": "microsoft", "label": "Microsoft"},
        {"key": "linkedin", "label": "LinkedIn"},
        {"key": "facebook", "label": "Facebook"},
        {"key": "twitter", "label": "X"},
    ]
    return ProvidersResponse(
        enabled=registry.enabled_list(),
        coming_soon=coming,
        email_password=True,
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


# ---------------------------------------------------------------------------
# Region — user country self-service. Powers the Regional Discovery engine
# (60 / 25 / 15 country / LATAM / global weighting).
# ---------------------------------------------------------------------------
_ALLOWED_COUNTRIES = {
    "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO",
    "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY",
    "PE", "UY", "VE", "ES", "US",
}


class RegionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    country: str = Field(min_length=2, max_length=2)
    city: Optional[str] = Field(default=None, max_length=80)


@router.patch("/me/region")
async def patch_me_region(
    payload: RegionInput,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _get_current_user(request, session_token, authorization)
    code = payload.country.upper().strip()
    if code not in _ALLOWED_COUNTRIES:
        raise HTTPException(status_code=422, detail=f"País '{code}' no soportado")
    db = request.app.state.db
    update = {"country": code, "country_source": "manual", "updated_at": _now_iso()}
    if payload.city is not None:
        update["city"] = payload.city.strip() or None
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    user.update(update)
    return _user_to_public(user)


# ---------------------------------------------------------------------------
# Email / Password — coexists with the social provider flow above.
# ---------------------------------------------------------------------------
PASSWORD_MIN_LEN = 8
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class EmailRegisterInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=200)
    name: Optional[str] = Field(default=None, max_length=120)


class EmailLoginInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ForgotPasswordInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: EmailStr


class ResetPasswordInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str = Field(min_length=8, max_length=200)
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=200)


async def _issue_session_cookie(db, response: Response, user: dict, provider: str) -> None:
    token = new_session_token()
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token,
            "user_id": user["id"],
            "provider": provider,
            "expires_at": session_expiry().isoformat(),
            "created_at": _now_iso(),
        }},
        upsert=True,
    )
    _set_session_cookie(response, token)


def _touch_provider_link(user: dict, provider: str, provider_user_id: str) -> list[dict]:
    providers = user.get("auth_providers") or []
    if not any(p.get("provider") == provider for p in providers):
        providers.append({
            "provider": provider,
            "provider_user_id": provider_user_id,
            "linked_at": _now_iso(),
        })
    return providers


@router.post("/register", response_model=CommunityUserPublic)
async def register_email(
    payload: EmailRegisterInput,
    request: Request,
    response: Response,
):
    email = str(payload.email).lower().strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Email inválido")

    db = request.app.state.db
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    now = _now_iso()

    if existing:
        # If the account already has a password, deny to force a login attempt.
        if existing.get("password_hash"):
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con este email. Inicia sesión.")
        # Otherwise, link password to a social-only account.
        providers = _touch_provider_link(existing, "password", email)
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {
                "password_hash": hash_password(payload.password),
                "auth_providers": providers,
                "last_login_at": now,
                "name": existing.get("name") or (payload.name or email.split("@")[0]),
            }},
        )
        user = await db.users.find_one({"id": existing["id"]}, {"_id": 0, "password_hash": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "id": user_id,
            "email": email,
            "name": (payload.name or "").strip() or email.split("@")[0],
            "role": "member",
            "picture": None,
            "country": None,
            "language": None,
            "headline": None,
            "password_hash": hash_password(payload.password),
            "email_verified": False,
            "auth_providers": [{
                "provider": "password",
                "provider_user_id": email,
                "linked_at": now,
            }],
            "created_at": now,
            "last_login_at": now,
        }
        await db.users.insert_one(user_doc)
        # Fire-and-forget welcome + verification email
        try:
            from services.email import send_welcome
            await send_welcome(email, user_doc["name"])
        except Exception:
            pass
        try:
            await _issue_verification_email(db, request, user_doc)
        except Exception as e:
            logger.warning("register_email: verification email failed: %s", e)
        user = {k: v for k, v in user_doc.items() if k != "password_hash"}

    await _issue_session_cookie(db, response, user, "password")
    return _user_to_public(user)


@router.post("/login", response_model=CommunityUserPublic)
async def login_email(
    payload: EmailLoginInput,
    request: Request,
    response: Response,
):
    email = str(payload.email).lower().strip()
    db = request.app.state.db

    # Brute-force lockout: 5 failures per (ip, email) → 15 min
    ip = (request.client.host if request.client else "?") or "?"
    identifier = f"{ip}:{email}"
    now = datetime.now(timezone.utc)
    lock = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if lock and lock.get("locked_until"):
        try:
            until = datetime.fromisoformat(lock["locked_until"])
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            if until > now:
                raise HTTPException(status_code=429, detail="Demasiados intentos. Intenta en unos minutos.")
        except HTTPException:
            raise
        except Exception:
            pass

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        # Register failed attempt
        attempts = (lock.get("count", 0) if lock else 0) + 1
        upd = {"identifier": identifier, "count": attempts, "last_attempt": now.isoformat()}
        if attempts >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
            upd["count"] = 0
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    # success — clear counter + touch provider link if missing
    await db.login_attempts.delete_one({"identifier": identifier})
    providers = _touch_provider_link(user, "password", email)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login_at": _now_iso(), "auth_providers": providers}},
    )
    user["auth_providers"] = providers
    user.pop("password_hash", None)
    await _issue_session_cookie(db, response, user, "password")
    return _user_to_public(user)


@router.post("/password/forgot")
async def forgot_password(payload: ForgotPasswordInput, request: Request):
    """Generate a one-shot reset token, email it if provider is configured.
    Always returns 200 with a generic message to avoid email enumeration.
    """
    email = str(payload.email).lower().strip()
    db = request.app.state.db
    user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1})
    generic = {"ok": True, "message": "Si el email existe, enviamos un enlace de recuperación."}
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    ttl_min = int(os.environ.get("PASSWORD_RESET_TTL_MINUTES", "60"))
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": email,
        "created_at": now.isoformat(),
        "expires_at": now + timedelta(minutes=ttl_min),
        "used": False,
    })
    # Build reset link — public app URL comes from env; frontend derives its own.
    app_url = (os.environ.get("PUBLIC_APP_URL", "") or "").rstrip("/")
    if not app_url:
        # Fall back to the request origin (works cross-host)
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        app_url = origin.rstrip("/")
    reset_link = f"{app_url}/reset-password?token={token}" if app_url else f"/reset-password?token={token}"
    try:
        from services.email import send_password_reset
        await send_password_reset(email, reset_link)
    except Exception as e:
        logger.warning("forgot_password: email send failed: %s", e)
    return generic


@router.post("/password/reset", response_model=CommunityUserPublic)
async def reset_password(
    payload: ResetPasswordInput,
    request: Request,
    response: Response,
):
    db = request.app.state.db
    rec = await db.password_reset_tokens.find_one({"token": payload.token}, {"_id": 0})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Enlace inválido o ya utilizado")
    expires = rec.get("expires_at")
    if isinstance(expires, str):
        try:
            expires = datetime.fromisoformat(expires)
        except Exception:
            expires = None
    if not expires or (expires.tzinfo is None and expires < datetime.utcnow()) or \
       (expires.tzinfo is not None and expires < datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="El enlace expiró. Solicita uno nuevo.")

    user = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")

    providers = _touch_provider_link(user, "password", user["email"])
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hash_password(payload.password),
            "auth_providers": providers,
            "last_login_at": _now_iso(),
        }},
    )
    # Mark the token as used AND drop any other outstanding tokens for this user.
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    await db.password_reset_tokens.delete_many({"user_id": user["id"], "token": {"$ne": payload.token}})
    # Clear brute-force counters
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{re.escape(user['email'])}$"}})
    user["auth_providers"] = providers
    user.pop("password_hash", None)
    await _issue_session_cookie(db, response, user, "password")
    return _user_to_public(user)



# ---------------------------------------------------------------------------
# Email verification — one-shot tokens stored in `email_verifications`.
# TTL index on `expires_at` cleans expired rows automatically.
# ---------------------------------------------------------------------------
VERIFICATION_TTL_HOURS = int(os.environ.get("EMAIL_VERIFY_TTL_HOURS", "24"))
VERIFICATION_RESEND_COOLDOWN_S = int(os.environ.get("EMAIL_VERIFY_RESEND_COOLDOWN_S", "60"))


class VerifyResendInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: Optional[EmailStr] = None  # optional; falls back to authed user


class VerifyConfirmInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    token: str = Field(min_length=8, max_length=200)


def _build_verify_link(request: Request, token: str) -> str:
    app_url = (os.environ.get("PUBLIC_APP_URL", "") or "").rstrip("/")
    if not app_url:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        app_url = origin.rstrip("/")
    return f"{app_url}/verify-email?token={token}" if app_url else f"/verify-email?token={token}"


async def _issue_verification_email(db, request: Request, user: dict) -> str:
    """Create a fresh verification token and email the link.
    Existing outstanding tokens for the same user are dropped so only the
    latest link is valid — this prevents token accumulation on resend spam.
    """
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    await db.email_verifications.delete_many({"user_id": user["id"], "used": False})
    await db.email_verifications.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": user["email"],
        "created_at": now.isoformat(),
        "expires_at": now + timedelta(hours=VERIFICATION_TTL_HOURS),
        "used": False,
    })
    link = _build_verify_link(request, token)
    try:
        from services.email import send_email_verification
        await send_email_verification(user["email"], link, user.get("name"))
    except Exception as e:
        logger.warning("verification email send failed: %s", e)
    return link


@router.post("/verify/send")
async def send_verification(
    payload: VerifyResendInput,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Send (or re-send) the verification email.

    Two modes:
      1. Authed user + no payload → verify their own email.
      2. Anonymous + payload.email → allows resend from the /join UX right
         after registration. Always returns 200 generic — avoids enumeration.
    """
    db = request.app.state.db
    user = None
    token_str = _extract_token(session_token, authorization)
    if token_str:
        sess = await db.user_sessions.find_one({"session_token": token_str}, {"_id": 0})
        if sess:
            user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
    if user is None and payload.email:
        user = await db.users.find_one({"email": str(payload.email).lower().strip()}, {"_id": 0})

    generic = {"ok": True, "message": "Si la cuenta existe y aún no está verificada, enviamos un nuevo enlace."}
    if not user:
        return generic
    if user.get("email_verified"):
        return {"ok": True, "message": "Este correo ya está verificado."}

    # cooldown per user to avoid spam
    last = await db.email_verifications.find_one(
        {"user_id": user["id"]}, sort=[("created_at", -1)])
    if last:
        try:
            created = datetime.fromisoformat(last["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - created).total_seconds()
            if elapsed < VERIFICATION_RESEND_COOLDOWN_S:
                raise HTTPException(
                    status_code=429,
                    detail=f"Espera {int(VERIFICATION_RESEND_COOLDOWN_S - elapsed)}s antes de solicitar otro correo.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    await _issue_verification_email(db, request, user)
    return generic


@router.post("/verify/confirm")
async def confirm_verification(
    payload: VerifyConfirmInput,
    request: Request,
    response: Response,
):
    db = request.app.state.db
    rec = await db.email_verifications.find_one({"token": payload.token}, {"_id": 0})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Enlace inválido o ya utilizado")
    expires = rec.get("expires_at")
    if isinstance(expires, str):
        try:
            expires = datetime.fromisoformat(expires)
        except Exception:
            expires = None
    now = datetime.now(timezone.utc)
    if not expires:
        raise HTTPException(status_code=400, detail="Enlace inválido")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=400, detail="El enlace expiró. Solicita uno nuevo.")

    user = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")

    # Atomically mark token used + flip flag on user.
    await db.email_verifications.update_one({"token": payload.token}, {"$set": {"used": True}})
    await db.email_verifications.delete_many({"user_id": user["id"], "token": {"$ne": payload.token}})
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True, "email_verified_at": _now_iso()}},
    )
    # Auto-establish a session so the verify link → home flow is 1-click.
    user["email_verified"] = True
    user.pop("password_hash", None)
    await _issue_session_cookie(db, response, user, user.get("auth_providers", [{}])[0].get("provider", "password"))
    return _user_to_public(user)


# ---------------------------------------------------------------------------
# OAuth 2.0 Authorization Code — LinkedIn + Microsoft.
# Uses the shared OAuth2AuthorizationCodeProvider abstraction from
# services.community_auth so new providers become 1-class additions.
# ---------------------------------------------------------------------------
from fastapi.responses import RedirectResponse


def _oauth_state_ttl_min() -> int:
    return int(os.environ.get("OAUTH_STATE_TTL_MINUTES", "10"))


def _oauth_redirect_uri(request: Request, provider_key: str) -> str:
    """Compute the callback URL that must EXACTLY match what's whitelisted
    in the provider's app config. Uses PUBLIC_APP_URL if set, else Origin.
    """
    base = (os.environ.get("PUBLIC_APP_URL", "") or "").rstrip("/")
    if not base:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        base = origin.rstrip("/")
    return f"{base}/api/community/auth/oauth/{provider_key}/callback"


@router.get("/oauth/{provider_key}/start")
async def oauth_start(provider_key: str, request: Request):
    """Kicks off the Authorization Code flow: creates a signed state cookie
    and redirects the browser to the provider's authorize URL.
    """
    provider = registry.get(provider_key)
    if not provider or not isinstance(provider, OAuth2AuthorizationCodeProvider):
        raise HTTPException(status_code=404, detail="Proveedor no disponible")
    if not provider.is_enabled():
        raise HTTPException(status_code=503,
                            detail=f"{provider.label} aún no está configurado. Contacta al administrador.")

    db = request.app.state.db
    state = secrets.token_urlsafe(24)
    redirect_uri = _oauth_redirect_uri(request, provider_key)
    now = datetime.now(timezone.utc)
    await db.oauth_states.insert_one({
        "state": state,
        "provider": provider_key,
        "redirect_uri": redirect_uri,
        "created_at": now.isoformat(),
        "expires_at": now + timedelta(minutes=_oauth_state_ttl_min()),
    })
    return RedirectResponse(provider.authorize_endpoint(redirect_uri, state))


@router.get("/oauth/{provider_key}/callback")
async def oauth_callback(
    provider_key: str,
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Provider redirects here after user consent. We validate state, exchange
    code for an access token, fetch userinfo, upsert the user, mint session,
    and redirect to the SPA landing.
    """
    if error:
        return RedirectResponse(f"/join?oauth_error={error}", status_code=302)
    provider = registry.get(provider_key)
    if not provider or not isinstance(provider, OAuth2AuthorizationCodeProvider):
        raise HTTPException(status_code=404, detail="Proveedor no disponible")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Faltan code/state")

    db = request.app.state.db
    rec = await db.oauth_states.find_one_and_delete(
        {"state": state, "provider": provider_key})
    if not rec:
        raise HTTPException(status_code=400, detail="State inválido o expirado")

    try:
        identity = await provider.exchange_session(f"{code}|{rec['redirect_uri']}")
    except AuthProviderError as e:
        return RedirectResponse(f"/join?oauth_error={e}", status_code=302)

    if not identity.email:
        return RedirectResponse("/join?oauth_error=email_missing", status_code=302)

    user = await _upsert_user_from_identity(db, identity)
    token = new_session_token()
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {
            "session_token": token, "user_id": user["id"],
            "provider": identity.provider,
            "expires_at": session_expiry().isoformat(),
            "created_at": _now_iso(),
        }},
        upsert=True,
    )
    resp = RedirectResponse("/", status_code=302)
    _set_session_cookie(resp, token)
    return resp

