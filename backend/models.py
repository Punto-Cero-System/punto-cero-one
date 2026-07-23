"""Pydantic models shared across the API."""
from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import uuid


# ---------------------------
# Users (Admin foundation)
# ---------------------------
UserRole = Literal["admin", "investor"]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: UserRole
    created_at: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    user: UserPublic


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
