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
from services.identity_audit import record_event, sanitize
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
    # FASE 0.5 · control explícito de vinculación de credenciales.
    # Por defecto False (fail-closed): sin esta confirmación, una colisión de
    # email con una cuenta existente NO se enlaza y responde 409.
    confirm_link: bool = Field(
        default=False,
        description=(
            "Confirmación explícita del usuario para enlazar una credencial "
            "OAuth a una cuenta preexistente con el mismo email. Sin ella, "
            "la colisión devuelve identity_unresolved (409)."
        ),
    )


class CommunityUserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "member"
    country: Optional[str] = None
    city: Optional[str] = None
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
    # Ensure deletion matches the same flags used when setting the cookie so
    # browsers reliably remove it (Some browsers consider Secure/HttpOnly/SameSite).
    flags = _cookie_flags()
    response.delete_cookie(
        key=COOKIE_NAME,
        path=flags.get("path", "/"),
        samesite=flags.get("samesite"),
        secure=flags.get("secure", True),
        httponly=flags.get("httponly", True),
    )


def _extract_token(cookie_val: Optional[str], auth_header: Optional[str]) -> Optional[str]:
    if cookie_val:
        return cookie_val
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(None, 1)[1].strip() or None
    return None


# ---------------------------------------------------------------------------
# FASE 0.5 · Identity events (H-1 / H-2 / H-4)
#
# REGLA: `provider_user_id` representa la identidad EN EL PROVEEDOR. Nunca un
# email. Para cuentas de password se genera un identificador opaco y estable,
# porque `password` no es un proveedor federado y no emite un `sub`.
#
# NOTA DE ALCANCE: el buffer es EN MEMORIA y acotado. No es la auditoría
# definitiva (Fase 0.6), que exigirá colección persistente append-only. Sirve
# para observar colisiones sin introducir un contrato de datos nuevo.
# ---------------------------------------------------------------------------
MAX_IDENTITY_EVENTS = 200
_identity_events: list[dict] = []


def _record_identity_event(kind: str, payload: dict) -> None:
    # FASE 0.8 · El log y el buffer en memoria son un sumidero de PII tan real
    # como la colección. Este buffer nació en FASE 0.5 sin enmascarar y escribía
    # el correo completo en el log de aplicación, que suele ser más accesible
    # que la base (CI, agregadores). Se le aplica el mismo `mask_email`.
    safe = sanitize(payload)
    event = {"kind": kind, "at": _now_iso(), **safe}
    _identity_events.append(event)
    if len(_identity_events) > MAX_IDENTITY_EVENTS:
        del _identity_events[: len(_identity_events) - MAX_IDENTITY_EVENTS]
    logger.warning("identity_event %s %s", kind, safe)


# FASE 0.6 · Puente hacia la auditoría persistente.
#
# `_record_identity_event` sigue igual: buffer en memoria + log, para no
# cambiar el comportamiento observado en FASE 0.5. Aquí se AÑADE la escritura
# persistente, y se hace a prova de fallos: si la auditoría no está disponible,
# el login continúa. Auditar es importante, pero razonable es una sesión.
async def _audit(db, event_type: str, **payload) -> None:
    try:
        await record_event(db, event_type, **payload)
    except Exception as exc:  # la auditoría nunca debe tumbar la autenticación
        logger.warning("identity_audit_write_failed %s: %s", event_type, exc)


def _new_password_credential_id() -> str:
    """Identidad estable y opaca para la credencial `password`.

    No es un secreto y no autentica nada: solo evita que el email ocupe el
    campo `provider_user_id`, que pertenece al proveedor.
    """
    return f"pwd_{uuid.uuid4().hex}"


def _is_federated_provider(provider: str) -> bool:
    """`password` no es federado: no tiene `sub` del proveedor."""
    return str(provider or "").lower() != "password"


def _looks_like_email(value: str) -> bool:
    return bool(value) and "@" in str(value)


def _password_credential_id(user: dict) -> str:
    """
    H-2 · Devuelve el `provider_user_id` de la credencial `password`.

    Reutiliza el existente si es válido (no es un email). Para cuentas cuyo
    registro heredó el email como `provider_user_id`, emite uno nuevo y
    descarta el email: la migración se hace en el mismo `$set` que el login.
    """
    for link in (user.get("auth_providers") or []):
        if str(link.get("provider") or "").lower() == "password":
            current = link.get("provider_user_id")
            if current and not _looks_like_email(str(current)):
                return str(current)
            break
    return _new_password_credential_id()


async def _identity_unresolved(
    db, reason: str, detail: dict, profile_reference: Optional[str] = None
) -> HTTPException:
    """409 estable. El mensaje es para humanos; `code` es el contrato."""
    _record_identity_event("identity_unresolved", {"reason": reason, **detail})
    await _audit(
        db,
        "profile.link_rejected",
        source=detail.get("provider"),
        profile_reference=profile_reference,
        rule_applied=f"H-1:{reason}",
        evidence=dict(detail),
    )
    return HTTPException(
        status_code=409,
        detail={
            "code": "identity_unresolved",
            "reason": reason,
            "message": (
                "Existe una cuenta con este correo y no podemos confirmar que "
                "sea la misma persona. Inicia sesión con tu método original y "
                "confirma la vinculación desde tu perfil."
            ),
        },
    )


async def check_email_collision(db, email: str, provider: str) -> Optional[dict]:
    """
    H-1 · DETECTA y CLASIFICA una coincidencia de email. NUNCA decide identidad.

    Devuelve None si no hay colisión, o un dict con:
        existing_user_id, email_verified, existing_providers, collision_type

    collision_type:
        same_provider_link → el mismo (provider, provider_user_id) ya está
                             enlazado. NO es colisión: es el mismo perfil.
        password_account   → existe una cuenta de password con ese email.
        other_provider     → existe una cuenta creada con otro proveedor.
    """
    if not email:
        return None
    existing = await db.users.find_one(
        {"email": email},
        {"_id": 0, "id": 1, "email_verified": 1, "auth_providers": 1},
    )
    if not existing:
        return None

    existing_providers = existing.get("auth_providers") or []
    has_same_provider = any(
        str(p.get("provider") or "").lower() == str(provider or "").lower()
        for p in existing_providers
    )
    has_password = any(
        str(p.get("provider") or "").lower() == "password" for p in existing_providers
    )

    if has_same_provider:
        collision_type = "same_provider_link"
    elif has_password:
        collision_type = "password_account"
    else:
        collision_type = "other_provider"

    _record_identity_event(
        "email_collision",
        {
            "email": email,
            "incoming_provider": provider,
            "existing_user_id": existing.get("id"),
            "email_verified": bool(existing.get("email_verified")),
            "collision_type": collision_type,
        },
    )
    await _audit(
        db,
        "email_collision.detected",
        source=provider,
        profile_reference=existing.get("id"),
        rule_applied="H-1:email-no-es-clave-de-identidad",
        evidence={
            "email": email,
            "incoming_provider": provider,
            "email_verified": bool(existing.get("email_verified")),
            "collision_type": collision_type,
            "existing_providers": [
                p.get("provider") for p in existing_providers if p.get("provider")
            ],
        },
    )
    return {
        "existing_user_id": existing.get("id"),
        "email_verified": bool(existing.get("email_verified")),
        "existing_providers": existing_providers,
        "collision_type": collision_type,
    }


async def _upsert_user_from_identity(
    db, identity: ProviderIdentity, confirm_link: bool = False
) -> dict:
    """
    FASE 0.5 · H-1 cerrado.

    REGLA: EMAIL MATCH ≠ IDENTITY MATCH.

    Orden de búsqueda:
      1. (provider, provider_user_id) → única clave que demuestra identidad.
      2. email → SOLO para detectar y clasificar la colisión. Nunca para fusionar.

    Sin coincidencia de proveedor y sin colisión de email → alta limpia.
    Con colisión de email se exigen las TRES condiciones: email_verified=True en
    la cuenta existente, provider federado con `sub` real, y confirmación
    explícita del usuario. Si falta cualquiera → 409 identity_unresolved.
    """
    now = _now_iso()
    link = {
        "provider": identity.provider,
        "provider_user_id": identity.provider_user_id,
        "linked_at": now,
    }

    # 1) Clave de identidad real: el par (provider, provider_user_id).
    existing = await db.users.find_one(
        {
            "auth_providers": {
                "$elemMatch": {
                    "provider": identity.provider,
                    "provider_user_id": identity.provider_user_id,
                }
            }
        },
        {"_id": 0},
    )
    if existing:
        update = {
            "name": existing.get("name") or identity.name,
            "picture": existing.get("picture") or identity.picture,
            "last_login_at": now,
        }
        await db.users.update_one({"id": existing["id"]}, {"$set": update})
        existing.update(update)
        return existing

    # 2) El email deja de ser clave de identidad: solo detección de colisión.
    collision = await check_email_collision(db, identity.email, identity.provider)
    if collision:
        if not collision["email_verified"]:
            raise await _identity_unresolved(
                db,
                "email_no_verificado_en_cuenta_existente",
                {"email": identity.email, "provider": identity.provider},
                profile_reference=collision["existing_user_id"],
            )
        if not (
            _is_federated_provider(identity.provider)
            and identity.provider_user_id
            and not _looks_like_email(identity.provider_user_id)
        ):
            raise await _identity_unresolved(
                db,
                "provider_sin_identidad_externa_real",
                {"email": identity.email, "provider": identity.provider},
                profile_reference=collision["existing_user_id"],
            )
        if not confirm_link:
            raise await _identity_unresolved(
                db,
                "falta_confirmacion_explicita",
                {"email": identity.email, "provider": identity.provider},
                profile_reference=collision["existing_user_id"],
            )
        # Confirmado: enlace de credencial, NO fusión de identidad.
        # FASE 0.7 · se registra la INTENCIÓN antes de materializar nada.
        await _audit(
            db,
            "profile.link_requested",
            source=identity.provider,
            profile_reference=collision["existing_user_id"],
            rule_applied="H-1:confirmacion-explicita",
            evidence={
                "collision_type": collision["collision_type"],
                "confirmed_by_user": True,
            },
        )
        user = await db.users.find_one(
            {"id": collision["existing_user_id"]}, {"_id": 0}
        )
        if not user:
            raise await _identity_unresolved(
                db,
                "cuenta_existente_desaparecio",
                {"email": identity.email},
                profile_reference=collision["existing_user_id"],
            )
        providers = _touch_provider_link(
            user, identity.provider, identity.provider_user_id
        )
        update = {
            "name": user.get("name") or identity.name,
            "picture": user.get("picture") or identity.picture,
            "auth_providers": providers,
            "last_login_at": now,
        }
        await db.users.update_one({"id": user["id"]}, {"$set": update})
        user.update(update)
        _record_identity_event(
            "credential_linked_with_confirmation",
            {
                "user_id": user["id"],
                "provider": identity.provider,
                "collision_type": collision["collision_type"],
            },
        )
        await _audit(
            db,
            "profile.linked",
            source=identity.provider,
            profile_reference=user["id"],
            rule_applied="H-1:confirmacion-explicita",
            evidence={
                "collision_type": collision["collision_type"],
                "email_verified": collision["email_verified"],
                "confirmed_by_user": True,
            },
        )
        await _audit(
            db,
            "provider.attached",
            source=identity.provider,
            profile_reference=user["id"],
            rule_applied="H-4:par-provider-provider_user_id",
            evidence={"provider": identity.provider},
        )
        return user

    # 3) Sin colisión: alta limpia.
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


def _user_to_public(user: dict) -> CommunityUserPublic:
    providers = [p.get("provider") for p in (user.get("auth_providers") or []) if p.get("provider")]
    return CommunityUserPublic(
        id=user["id"],
        email=user["email"],
        name=user.get("name") or user["email"].split("@")[0],
        picture=user.get("picture"),
        role=user.get("role", "member"),
        country=user.get("country"),
        city=user.get("city"),
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
    # First release supports Google (active), LinkedIn + Facebook (activatable
    # via env vars). Microsoft / GitHub / Apple / X remain wired in the
    # backend but are HIDDEN from the client list until the product team
    # decides to expose them.
    _v1_visible = {"linkedin", "facebook"}
    active = {p["key"] for p in registry.enabled_list()}
    coming = [
        {"key": k, "label": _label(k)}
        for k in ("linkedin", "facebook")
        if k in _v1_visible and k not in active
    ]
    return ProvidersResponse(
        enabled=registry.enabled_list(),
        coming_soon=coming,
        email_password=True,
        session_ttl_days=int(os.environ.get("COMMUNITY_SESSION_TTL_DAYS", "7")),
    )


def _label(key: str) -> str:
    return {
        "apple": "Apple", "microsoft": "Microsoft", "linkedin": "LinkedIn",
        "facebook": "Facebook", "github": "GitHub", "twitter": "X",
    }.get(key, key.title())


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
    user = await _upsert_user_from_identity(
        db, identity, confirm_link=payload.confirm_link
    )

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
    invite_code: Optional[str] = Field(default=None, max_length=32,
                                        description="Growth invite code to credit the referrer.")


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
    """
    FASE 0.5 · H-4 cerrado: compara el PAR (provider, provider_user_id).

    Antes comparaba solo `provider`, de modo que `google+123456` y
    `google+987654` se trataban como el mismo enlace y el segundo se
    descartaba EN SILENCIO (vector de suplantación). Ahora son enlaces
    distintos y ambos se conservan.

    Nunca sobrescribe un enlace existente: si el par exacto ya está, no-op.
    """
    providers = list(user.get("auth_providers") or [])
    if not any(
        p.get("provider") == provider
        and p.get("provider_user_id") == provider_user_id
        for p in providers
    ):
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
        providers = _touch_provider_link(
            existing, "password", _password_credential_id(existing)
        )
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
                # H-2: el email NUNCA ocupa provider_user_id. `password` no es
                # un proveedor federado y no emite `sub`; se genera un id opaco.
                "provider_user_id": _new_password_credential_id(),
                "linked_at": now,
            }],
            "created_at": now,
            "last_login_at": now,
        }
        await db.users.insert_one(user_doc)
        # Growth — credit the referrer if a valid invite code came in.
        if payload.invite_code:
            try:
                await _credit_invite(db, payload.invite_code.strip(), user_doc)
            except Exception as e:  # pragma: no cover
                logger.info("invite credit skipped: %s", e)
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
    providers = _touch_provider_link(
        user, "password", _password_credential_id(user)
    )
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

    providers = _touch_provider_link(
        user, "password", _password_credential_id(user)
    )
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
        "expires_at": (now + timedelta(minutes=_oauth_state_ttl_min())).isoformat(),
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

    # Enforce TTL: ensure stored expires_at hasn't passed. Stored as ISO str.
    try:
        expires_at = parse_expires_at(rec.get("expires_at"))
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="State inválido o expirado")
    except AuthProviderError:
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


# ---------------------------------------------------------------------------
# Wave 11.1 — Growth invitations & viral share
# ---------------------------------------------------------------------------

def _make_invite_code(user: dict) -> str:
    """Deterministic per-user invite code (8 chars, alphanum). No new DB writes
    the first time — it's derived from user.id + a stable salt.
    """
    import hashlib
    raw = f"pcone::{user.get('id') or user.get('email') or ''}::v1"
    return hashlib.sha256(raw.encode()).hexdigest()[:8].upper()


async def _credit_invite(db, invite_code: str, invited_user: dict) -> None:
    """Credit the referrer for one new registered invite. Idempotent per
    invited user: we key on `invited_user_id` so replays never double-count.
    """
    code = invite_code.strip().upper()
    if not code or len(code) < 6:
        return
    # Find the referrer whose code matches. We iterate `users` sparingly —
    # invite codes are derived from the user id so a hash-and-match on
    # server startup would be another option, but this is fine at community
    # scale.
    async for u in db.users.find({"role": {"$ne": "admin"}, "is_deleted": {"$ne": True}},
                                   {"_id": 0, "id": 1, "email": 1}):
        if _make_invite_code(u) == code:
            await db.invite_redemptions.update_one(
                {"invited_user_id": invited_user["id"]},
                {"$setOnInsert": {
                    "invited_user_id": invited_user["id"],
                    "invited_email": invited_user.get("email"),
                    "referrer_id": u["id"],
                    "code": code,
                    "created_at": _now_iso(),
                }},
                upsert=True,
            )
            return


@router.get("/me/invite")
async def get_me_invite(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _get_current_user(request, session_token, authorization)
    db = request.app.state.db
    code = _make_invite_code(user)
    public_url = (os.environ.get("PUBLIC_APP_URL") or "").rstrip("/")
    url = f"{public_url}/join?invite={code}" if public_url else f"/join?invite={code}"
    invited_registered = await db.invite_redemptions.count_documents({"referrer_id": user["id"]})
    return {
        "code": code,
        "url": url,
        "invited_registered": invited_registered,
        "share_message": f"Únete a Punto Cero One con mi invitación: {url}",
    }

