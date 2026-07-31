"""Email admin/status routes.

GET  /api/email/status           — public health-ish endpoint (safe to expose)
POST /api/admin/email/test       — admin sends a test email
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr

from auth import require_admin
from services.email import get_provider, EmailStatus


router = APIRouter(tags=["email"])


@router.get("/api/email/status")
async def email_status():
    prov = get_provider()
    return {
        "status": prov.status.value,
        "from_name": prov.from_name,
        "enabled": prov.enabled,
        "has_key": bool(prov.api_key),
    }


class EmailTestRequest(BaseModel):
    to: EmailStr
    subject: str = "Prueba de envío · Punto Cero"
    message: str = "Este es un correo de prueba desde el panel de administración."


@router.post("/api/admin/email/test")
async def admin_test_email(payload: EmailTestRequest, admin: dict = Depends(require_admin)):
    prov = get_provider()
    result = await prov.send(
        to=payload.to, subject=payload.subject,
        html=f"<p>{payload.message}</p>",
    )
    return result.as_dict()
