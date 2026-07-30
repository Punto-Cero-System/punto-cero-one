"""Community auth — provider-agnostic social login layer.

Architecture:
    ProviderIdentity      → normalized identity returned by any provider.
    BaseAuthProvider      → abstract interface (exchange_session).
    EmergentAuthProvider  → default Google-social provider using Emergent's
                            managed OAuth relay (no client secret needed).
    (Future)              → GoogleOAuthProvider (self-hosted), MicrosoftOAuthProvider,
                            LinkedInOAuthProvider, AppleOAuthProvider.

The provider registry is env-driven so this module runs identically inside or
outside the Emergent environment (VS Code / local / any host).  Absent env
values simply mean "provider disabled" — never a crash.
"""
from __future__ import annotations

import os
import uuid
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger("punto-cero-api.community_auth")


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------
@dataclass
class ProviderIdentity:
    """Normalized identity returned by any OAuth provider."""
    provider: str
    provider_user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: Optional[str] = None  # provided by Emergent; otherwise we generate one

    def as_public_dict(self) -> dict:
        d = asdict(self)
        d.pop("session_token", None)
        return d


class AuthProviderError(Exception):
    """Raised when a provider cannot complete an identity exchange."""


# ---------------------------------------------------------------------------
# Base provider interface
# ---------------------------------------------------------------------------
class BaseAuthProvider(ABC):
    key: str = ""
    label: str = ""

    def is_enabled(self) -> bool:  # pragma: no cover - trivial
        return True

    @abstractmethod
    async def exchange_session(self, session_id: str) -> ProviderIdentity:
        """Convert a provider-issued session_id/code into a normalized identity."""


# ---------------------------------------------------------------------------
# Emergent-managed provider (default, no secret needed)
# ---------------------------------------------------------------------------
class EmergentAuthProvider(BaseAuthProvider):
    """Wraps Emergent's managed Google-OAuth relay.

    Flow (front-end):
        1. Redirect to `{EMERGENT_AUTH_URL}/?redirect=<origin>/dashboard-like-path`
        2. Provider returns to `<origin>/#session_id=...`
        3. Front-end sends session_id to `/api/community/auth/session`
        4. This provider exchanges session_id → identity via the Emergent API.
    """
    key = "google"
    label = "Google"

    def __init__(self) -> None:
        # Configurable so the same code works outside Emergent.
        self.auth_url = os.environ.get(
            "EMERGENT_AUTH_URL", "https://auth.emergentagent.com"
        )
        self.session_url = os.environ.get(
            "EMERGENT_AUTH_SESSION_URL",
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        )
        self.timeout_sec = int(os.environ.get("EMERGENT_AUTH_TIMEOUT_SEC", "15"))

    def is_enabled(self) -> bool:
        return bool(self.session_url)

    async def exchange_session(self, session_id: str) -> ProviderIdentity:
        if not session_id or len(session_id) < 4:
            raise AuthProviderError("session_id inválido")
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
                resp = await client.get(
                    self.session_url,
                    headers={"X-Session-ID": session_id},
                )
        except httpx.HTTPError as e:
            logger.warning("Emergent auth network error: %s", e)
            raise AuthProviderError("No se pudo contactar el proveedor de autenticación") from e

        if resp.status_code != 200:
            logger.info("Emergent auth non-200: %s %s", resp.status_code, resp.text[:200])
            raise AuthProviderError("Sesión inválida o expirada")

        data = resp.json()
        provider_user_id = data.get("id") or data.get("user_id") or ""
        email = (data.get("email") or "").lower().strip()
        name = data.get("name") or (email.split("@")[0] if email else "Nuevo miembro")
        if not email:
            raise AuthProviderError("El proveedor no devolvió un email válido")

        return ProviderIdentity(
            provider=self.key,
            provider_user_id=str(provider_user_id) or f"emergent_{uuid.uuid4().hex[:12]}",
            email=email,
            name=name,
            picture=data.get("picture") or None,
            session_token=data.get("session_token") or None,
        )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
class ProviderRegistry:
    """Simple in-memory registry — swappable via env or DI later."""

    def __init__(self) -> None:
        self._providers: dict[str, BaseAuthProvider] = {}

    def register(self, provider: BaseAuthProvider) -> None:
        if provider.is_enabled():
            self._providers[provider.key] = provider
            logger.info("Auth provider enabled: %s", provider.key)

    def get(self, key: str) -> Optional[BaseAuthProvider]:
        return self._providers.get(key)

    def enabled_list(self) -> list[dict]:
        return [{"key": p.key, "label": p.label} for p in self._providers.values()]


registry = ProviderRegistry()
registry.register(EmergentAuthProvider())


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------
SESSION_TTL_DAYS = int(os.environ.get("COMMUNITY_SESSION_TTL_DAYS", "7"))


def new_session_token() -> str:
    return f"cs_{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}"


def session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)


def parse_expires_at(raw) -> datetime:
    """MongoDB may hand us a str or a naive datetime — normalize to aware UTC."""
    if isinstance(raw, str):
        dt = datetime.fromisoformat(raw)
    elif isinstance(raw, datetime):
        dt = raw
    else:
        raise AuthProviderError("expires_at inválido")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
