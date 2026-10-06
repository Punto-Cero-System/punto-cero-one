"""Pydantic models shared across the API."""
from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import uuid


# ---------------------------
# Users (Admin foundation)
# ---------------------------
# FASE 4.3.1 - Catalogo extensible de roles.
#
# `role` es CAPACIDAD TECNICA, no acceso a workspace (decision FASE 3J, D2).
# El acceso a espacios proviene de `verticals` / organizaciones, nunca del rol.
# Activar esa separacion (D2, eliminar `_ROLE_TO_SPACES`) es un paso posterior;
# esta fase solo amplia el VOCABULARIO y no cambia ningun comportamiento.
#
# `admin` se conserva ADEMAS de `admin_system` de forma deliberada:
#   - viaja dentro del JWT (`create_access_token(id, email, role)`), asi que
#     renombrarlo invalidaria los tokens vivos (TTL 8 h);
#   - `auth.require_admin` compara `role != "admin"` de forma literal;
#   - el frontend compara `user.role === 'admin'` en 8 archivos.
# Por eso la transicion es por ALIAS (Opcion A de FASE 3J): se emite `admin`
# y se normaliza a `admin_system` al leer. La ventana de deuda es el TTL.
UserRole = Literal[
    "member",        # usuario base, sin espacios implicitos
    "admin",         # alias legacy de admin_system (FASE 3J, Opcion A)
    "investor",      # portal de inversion
    "org_admin",     # administracion de una organizacion
    "agent",         # operador-agente
    "admin_system",  # administracion de plataforma
]

# Alias de lectura: valor emitido -> valor canonico de la politica.
# NO lo consume todavia ningun modulo: se activa junto con D2.
ROLE_ALIASES = {
    "admin": "admin_system",
}


def normalize_role(role: Optional[str]) -> str:
    """Resuelve un rol emitido al rol canonico de la politica.

    Puro y tolerante: nunca lanza. Un rol desconocido se devuelve tal cual
    para que la validacion posterior decida (fail-closed aguas arriba).
    """
    key = str(role or "").strip().lower()
    return ROLE_ALIASES.get(key, key) or "member"


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: UserRole
    created_at: str
    must_change_password: bool = False


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    user: UserPublic


class AcceptInvitationInput(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class InvestorInvitationResponse(BaseModel):
    """Returned to admin when generating an invitation."""
    request_id: str
    user_id: str
    email: EmailStr
    name: str
    invitation_token: str
    invitation_url: str  # public URL the admin can share
    expires_at: str


# ---------------------------
# Investor Access Requests
# ---------------------------
InvestorRequestStatus = Literal["pending", "under_review", "approved", "rejected"]

VALID_STATUSES = ("pending", "under_review", "approved", "rejected")

# Contact / interest types for the Executive Summary CTA form.
ContactType = Literal[
    "investor",
    "strategic_partner",
    "technology_partner",
    "professional",
    "entrepreneur",
    "company",
    "other",
]


class InvestorRequestCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fullName: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(default="", max_length=160)
    role: Optional[str] = Field(default="", max_length=120)
    focus: Optional[str] = Field(default="", max_length=80)
    country: Optional[str] = Field(default="", max_length=80)
    message: Optional[str] = Field(default="", max_length=2000)
    contactType: Optional[ContactType] = None
    source: Optional[str] = Field(default="", max_length=60)  # e.g. "executive_summary"


class InvestorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fullName: str
    email: EmailStr
    company: str = ""
    role: str = ""
    focus: str = ""
    country: str = ""
    message: str = ""
    contactType: Optional[ContactType] = None
    source: str = ""
    status: InvestorRequestStatus = "pending"
    admin_notes: str = ""
    submitted_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    reviewed_by: Optional[str] = None  # admin user id


class InvestorRequestStatusUpdate(BaseModel):
    status: InvestorRequestStatus
    admin_notes: Optional[str] = Field(default=None, max_length=2000)


class InvestorRequestPublicResponse(BaseModel):
    """What we return to the public submitter (no sensitive fields)."""
    id: str
    status: InvestorRequestStatus
    submitted_at: str
    message: str = "Solicitud recibida"


class InvestorRequestStats(BaseModel):
    total: int
    pending: int
    under_review: int
    approved: int
    rejected: int


# ---------------------------
# Pitch Deck Analytics
# ---------------------------
class PitchDeckEventCreate(BaseModel):
    """One dwell measurement for a single slide within a session."""
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(min_length=6, max_length=64)
    slide_number: int = Field(ge=1, le=99)
    slide_title: Optional[str] = Field(default="", max_length=160)
    duration_ms: int = Field(ge=0, le=1000 * 60 * 30)  # cap 30 min per slide
    completed: bool = False  # did the user actually leave the slide
    user_agent: Optional[str] = Field(default="", max_length=400)


class PitchDeckSlideStat(BaseModel):
    slide_number: int
    slide_title: str
    views: int
    unique_sessions: int
    total_ms: int
    avg_ms: float


class PitchDeckAnalytics(BaseModel):
    total_events: int
    total_sessions: int
    slides: list[PitchDeckSlideStat]
