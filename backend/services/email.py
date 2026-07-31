"""Email service — provider-agnostic transactional email.

Design
------
Provider abstraction so tomorrow the platform can swap Emergent-managed Resend
for a self-hosted SendGrid / Mailgun / SES setup without touching callers.

Statuses (surfaced on `EmailProvider.status`):
    ACTIVE          — provider ready + EMAIL_ENABLED=true → sends live emails
    CONFIG_PENDING  — provider ready but EMAIL_ENABLED=false, or no key present
                      → logs the send and returns success without hitting network
    DISABLED        — EMAIL_ENABLED=false explicitly by ops
    FAILED          — a real send attempt failed at least once recently

The service is fire-and-forget from the caller's perspective. If a send fails,
the request path is never blocked and the notification / DB writes stay
consistent. Errors are logged.

Env
---
    EMAIL_ENABLED           — "true"|"false" master switch (default "true")
    EMERGENT_EMAIL_KEY      — key provisioned by the Emergent platform
    EMAIL_FROM_NAME         — brand display name shown in the "From:" header
    EMAIL_REPLY_TO          — optional default reply-to
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx


logger = logging.getLogger("punto-cero-api.email")

# Emergent proxy base URL is a deliberate constant — deploying elsewhere means
# swapping the provider class, not editing a URL string.
EMERGENT_EMAIL_BASE_URL = "https://integrations.emergentagent.com"


class EmailStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CONFIG_PENDING = "CONFIG_PENDING"
    DISABLED = "DISABLED"
    FAILED = "FAILED"


class SendResult:
    def __init__(self, ok: bool, status: EmailStatus,
                 message: str = "", provider_id: Optional[str] = None) -> None:
        self.ok = ok
        self.status = status
        self.message = message
        self.provider_id = provider_id

    def as_dict(self) -> dict:
        return {"ok": self.ok, "status": self.status.value,
                "message": self.message, "provider_id": self.provider_id}


class EmailProvider:
    """Emergent-managed Resend via the integrations proxy."""

    def __init__(self) -> None:
        raw_enabled = (os.environ.get("EMAIL_ENABLED", "true") or "").strip().lower()
        self.enabled = raw_enabled in ("1", "true", "yes", "on")
        self.api_key = (os.environ.get("EMERGENT_EMAIL_KEY", "") or "").strip()
        if self.api_key.lower() == "config_pending":
            self.api_key = ""
        self.from_name = (os.environ.get("EMAIL_FROM_NAME", "Punto Cero System") or "Punto Cero System").strip()
        self.reply_to = (os.environ.get("EMAIL_REPLY_TO", "") or "").strip() or None

    @property
    def status(self) -> EmailStatus:
        if not self.enabled:
            return EmailStatus.DISABLED
        if not self.api_key:
            return EmailStatus.CONFIG_PENDING
        return EmailStatus.ACTIVE

    async def send(self, *, to: str, subject: str, html: str,
                   reply_to: Optional[str] = None) -> SendResult:
        current = self.status
        if current != EmailStatus.ACTIVE:
            logger.info("[email:%s] Skipping send to=%s subject=%s", current.value, to, subject)
            return SendResult(
                ok=(current in (EmailStatus.CONFIG_PENDING, EmailStatus.DISABLED)),
                status=current, message=f"email skipped ({current.value})",
            )
        payload = {
            "to": [to],
            "subject": subject,
            "html": html,
            "from_name": self.from_name,
        }
        rt = reply_to or self.reply_to
        if rt:
            payload["contact_email"] = rt
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{EMERGENT_EMAIL_BASE_URL}/api/v1/email/send",
                    headers={"X-Email-Key": self.api_key},
                    json=payload,
                )
            if resp.status_code >= 400:
                logger.warning("email provider %s: %s", resp.status_code, resp.text[:400])
                return SendResult(ok=False, status=EmailStatus.FAILED,
                                  message=f"HTTP {resp.status_code}")
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            return SendResult(ok=True, status=EmailStatus.ACTIVE,
                              provider_id=body.get("id"), message="sent")
        except Exception as e:
            logger.exception("email provider network failure")
            return SendResult(ok=False, status=EmailStatus.FAILED, message=str(e))


# Singleton
_provider: Optional[EmailProvider] = None


def get_provider() -> EmailProvider:
    global _provider
    if _provider is None:
        _provider = EmailProvider()
    return _provider


def reset_provider() -> None:
    """Test-only hook to re-read env after monkeypatch."""
    global _provider
    _provider = None


# ---------------------------------------------------------------------------
# High-level helpers — each maps to a business use case.
# All soft-fail: caller doesn't need to try/except.
# ---------------------------------------------------------------------------
def _now(): return datetime.now(timezone.utc).isoformat()


def _wrap(title: str, body_html: str, cta_label: Optional[str] = None, cta_url: Optional[str] = None) -> str:
    """Minimal inline-CSS email shell — safe across mail clients."""
    cta = ""
    if cta_label and cta_url:
        cta = f'''
        <tr><td style="padding: 16px 0;">
          <a href="{cta_url}" style="background:#0B1F3A;color:#FFFFFF;padding:12px 24px;
             text-decoration:none;border-radius:8px;font-weight:600;font-family:Arial,sans-serif;
             display:inline-block;">{cta_label}</a>
        </td></tr>'''
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F6FA;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F6FA;">
  <tr><td align="center" style="padding:32px 16px;">
    <table cellpadding="0" cellspacing="0" width="560" style="background:#FFFFFF;border-radius:12px;
           box-shadow:0 6px 28px rgba(11,31,58,0.08);max-width:560px;width:100%;">
      <tr><td style="padding:32px 40px 8px;">
        <div style="font-size:12px;letter-spacing:0.22em;color:#6B7280;font-weight:700;">PUNTO CERO SYSTEM</div>
      </td></tr>
      <tr><td style="padding:8px 40px 4px;">
        <h1 style="margin:0;font-size:22px;line-height:1.35;color:#0B1F3A;">{title}</h1>
      </td></tr>
      <tr><td style="padding:12px 40px 24px;color:#374151;font-size:15px;line-height:1.55;">
        {body_html}
        {cta}
      </td></tr>
      <tr><td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;color:#9CA3AF;font-size:12px;">
        Estás recibiendo este correo porque tienes una cuenta activa en Punto Cero System.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


async def send_welcome(to: str, name: Optional[str] = None) -> SendResult:
    body = f"<p>Hola {name or 'y bienvenida/o al ecosistema'} 👋</p><p>Ya puedes descubrir empresas, oportunidades laborales, eventos e integraciones de todas las verticales del ecosistema Punto Cero.</p>"
    return await get_provider().send(
        to=to,
        subject="Bienvenido al ecosistema Punto Cero",
        html=_wrap("Bienvenido al ecosistema Punto Cero", body,
                   cta_label="Explorar la plataforma",
                   cta_url=os.environ.get("PUBLIC_APP_URL", "https://puntocerosystem.com")),
    )


async def send_invitation(to: str, invite_link: str, inviter_name: Optional[str] = None,
                          context: Optional[str] = None) -> SendResult:
    who = f"{inviter_name} te invitó" if inviter_name else "Recibiste una invitación"
    ctx = f" a <b>{context}</b>" if context else ""
    body = f"<p>{who}{ctx} en Punto Cero.</p><p>El enlace es de un solo uso y expira pronto — úsalo apenas puedas.</p>"
    return await get_provider().send(
        to=to,
        subject="Tienes una invitación en Punto Cero",
        html=_wrap("Tienes una invitación", body,
                   cta_label="Aceptar invitación", cta_url=invite_link),
    )


async def send_password_reset(to: str, reset_link: str) -> SendResult:
    body = "<p>Recibimos una solicitud para restablecer tu contraseña.</p><p>El enlace es de un solo uso y expira en 60 minutos. Si no fuiste tú, ignora este correo.</p>"
    return await get_provider().send(
        to=to,
        subject="Restablece tu contraseña · Punto Cero",
        html=_wrap("Restablece tu contraseña", body,
                   cta_label="Crear nueva contraseña", cta_url=reset_link),
    )


async def send_confirmation(to: str, subject: str, message_html: str,
                            cta_label: Optional[str] = None, cta_url: Optional[str] = None) -> SendResult:
    """Generic transactional confirmation (e.g. RSVP accepted, application submitted)."""
    return await get_provider().send(
        to=to, subject=subject,
        html=_wrap(subject, message_html, cta_label, cta_url),
    )
