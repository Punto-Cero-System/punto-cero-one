"""Business entity models — the core of the multi-tenant platform.

Companies, Jobs, Events, Follows, Applications, RSVPs.  Everything here is
designed to be re-used by every future vertical (Legal, Salud, Contabilidad,
Turismo, Seguros…) — do NOT split into per-vertical modules.  The `vertical`
attribute on a Company keeps the tenant boundary explicit.

Naming
------
IDs use short human-friendly prefixes:
    co_  companies      job_  jobs
    ev_  events         app_  applications
    rsv_ rsvps          fol_  follows
    tm_  team members
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


# ---------------------------------------------------------------------------
# Shared enums
# ---------------------------------------------------------------------------
# `CompanyOrigin` answers WHERE the company came from.
# `VerificationStatus` answers WHETHER its identity was actually checked.
#
# These are deliberately two different axes. Before this split, the curated
# directory wrote `verification: "verified"`, which made a public reference
# entry indistinguishable from a legally validated company. `origin` carries
# the provenance; `verification` is reserved for a real identity check.
CompanyOrigin = Literal["directory", "member"]
VerificationStatus = Literal["unverified", "pending", "verified", "flagged"]
JobModality = Literal["remote", "hybrid", "onsite", "unspecified"]
JobEmployment = Literal["full_time", "part_time", "contract", "internship", "freelance"]
ApplicationStatus = Literal["submitted", "reviewing", "interview", "offer", "hired", "rejected", "withdrawn"]
EventModality = Literal["online", "in_person", "hybrid"]
RsvpStatus = Literal["going", "interested", "cancelled"]

# ── Verification traceability ───────────────────────────────────────────────
# Every field of this mechanism is FLAT on the document on purpose. Nesting it
# under `verification` would change that field's shape from a string to an
# object, breaking the `$in` filter that feeds Discovery
# (content_sources_routes), the equality filter of the admin panel
# (admin_platform_routes) and the check in search_routes — plus every company
# document already stored in Mongo. Nothing here changes those.
#
# `VerificationSource` is a Literal with a single value because exactly one
# process exists today: a human admin reviewing by hand. Opening it to free
# text would let anyone write "official_registry" over a guess, which is the
# opposite of what this is for. Extending it is a one-line change when a real
# external source lands.
VerificationSource = Literal["manual_review"]


class VerificationEvent(BaseModel):
    """One immutable entry of a company's verification trail.

    Append-only: entries are added, never rewritten. A transition away from
    `verified` does not delete what happened — it records the new state beside
    the old one, so history survives un-verification and un-flagging.
    """
    model_config = ConfigDict(extra="ignore")
    status: VerificationStatus
    by: Optional[str] = None
    by_name: Optional[str] = None
    at: str
    source: Optional[VerificationSource] = None


# Hard ceiling so a document can never grow without bound if an admin toggles
# the state repeatedly. Keeps the newest entries; the most recent are the ones
# a reader needs.
VERIFICATION_HISTORY_CAP = 20


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(text: str) -> str:
    """Slugifies a company name for pretty URLs (`/empresas/{slug}`)."""
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[-\s]+", "-", text)
    return text[:80] or f"co-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# COMPANIES
# ---------------------------------------------------------------------------
class SocialLinks(BaseModel):
    model_config = ConfigDict(extra="ignore")
    website: Optional[str] = None
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    facebook: Optional[str] = None
    github: Optional[str] = None
    tiktok: Optional[str] = None
    rss: Optional[str] = None


class CompanyServiceItem(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=400)
    icon: Optional[str] = None


class TeamMember(BaseModel):
    user_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=100)
    picture: Optional[str] = None


class CompanyCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=2, max_length=120)
    tagline: Optional[str] = Field(default=None, max_length=180)
    description: Optional[str] = Field(default=None, max_length=4000)
    vertical: str = Field(default="empresas", max_length=60)  # category key
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=80)
    website: Optional[str] = Field(default=None, max_length=300)
    social: SocialLinks = Field(default_factory=SocialLinks)
    services: list[CompanyServiceItem] = Field(default_factory=list)
    team: list[TeamMember] = Field(default_factory=list)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    cover_url: Optional[str] = None
    gallery: list[str] = Field(default_factory=list)


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    tagline: Optional[str] = Field(default=None, max_length=180)
    description: Optional[str] = Field(default=None, max_length=4000)
    vertical: Optional[str] = Field(default=None, max_length=60)
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=80)
    website: Optional[str] = Field(default=None, max_length=300)
    social: Optional[SocialLinks] = None
    services: Optional[list[CompanyServiceItem]] = None
    team: Optional[list[TeamMember]] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    cover_url: Optional[str] = None
    gallery: Optional[list[str]] = None


class CompanyPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    slug: str
    name: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    vertical: str
    country: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    social: SocialLinks = Field(default_factory=SocialLinks)
    services: list[CompanyServiceItem] = []
    team: list[TeamMember] = []
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    cover_url: Optional[str] = None
    gallery: list[str] = []
    # Provenance. Defaults to "member" so a company created before this field
    # existed keeps behaving as a member-created record.
    origin: CompanyOrigin = "member"
    # Identity check. "verified" is reserved for a real, documented check
    # against an official source — it is NOT implied by being in the directory.
    verification: VerificationStatus = "unverified"
    # ── Verification traceability ────────────────────────────────────────────
    # `verification` alone answers "what state is this in?" but not "on whose
    # authority?". These flat fields keep that answer. They are deliberately
    # NOT nested inside `verification`: that field is a plain string queried
    # with `$in`/equality by Discovery, the admin filter and search, and nesting
    # it would break every one of those plus all existing documents.
    #
    # All Optional with a null default ON PURPOSE: a company verified before
    # this existed has no record of who did it, and inventing one ("system",
    # a backdated timestamp) would fabricate an audit trail. Null means
    # "no human check on record", which is the honest value.
    verified_by: Optional[str] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[str] = None
    verification_source: Optional[VerificationSource] = None
    # Append-only trail of every state change, newest last, capped in the
    # route so a single document can never grow without bound.
    verification_history: list[VerificationEvent] = Field(default_factory=list)
    followers_count: int = 0
    posts_count: int = 0
    jobs_count: int = 0
    events_count: int = 0
    owner_id: str
    my_following: bool = False
    my_role: Optional[str] = None
    created_at: str
    updated_at: str


class CompanyListResponse(BaseModel):
    items: list[CompanyPublic]
    total: int
    next_cursor: Optional[str] = None


def new_company_id() -> str: return _uid("co")


def make_slug(name: str, suffix: Optional[str] = None) -> str:
    s = _slug(name)
    return f"{s}-{suffix}" if suffix else s


# ---------------------------------------------------------------------------
# JOBS
# ---------------------------------------------------------------------------
class JobCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=8000)
    modality: JobModality = "remote"
    employment: JobEmployment = "full_time"
    location: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=60)
    salary_range: Optional[str] = Field(default=None, max_length=80)
    tags: list[str] = Field(default_factory=list)
    is_active: bool = True


class JobUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    description: Optional[str] = None
    modality: Optional[JobModality] = None
    employment: Optional[JobEmployment] = None
    location: Optional[str] = None
    country: Optional[str] = None
    salary_range: Optional[str] = None
    tags: Optional[list[str]] = None
    is_active: Optional[bool] = None


class JobPublic(BaseModel):
    id: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    company_slug: Optional[str] = None
    title: str
    description: str
    modality: JobModality = "unspecified"
    employment: JobEmployment = "full_time"
    location: Optional[str] = None
    country: Optional[str] = None
    salary_range: Optional[str] = None
    tags: list[str] = []
    is_active: bool
    applications_count: int = 0
    my_applied: bool = False
    my_saved: bool = False
    created_at: str
    updated_at: str


class JobListResponse(BaseModel):
    items: list[JobPublic]
    total: int
    next_cursor: Optional[str] = None


def new_job_id() -> str: return _uid("job")


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cover_letter: Optional[str] = Field(default=None, max_length=4000)
    cv_document_id: Optional[str] = None   # reference to `documents` collection
    contact_email: Optional[str] = Field(default=None, max_length=200)


class ApplicationPublic(BaseModel):
    id: str
    job_id: str
    job_title: Optional[str] = None
    company_id: str
    company_name: Optional[str] = None
    applicant_id: str
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
    applicant_picture: Optional[str] = None
    cover_letter: Optional[str] = None
    cv_document_id: Optional[str] = None
    status: ApplicationStatus = "submitted"
    created_at: str
    updated_at: str


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


def new_application_id() -> str: return _uid("app")


# ---------------------------------------------------------------------------
# EVENTS
# ---------------------------------------------------------------------------
class EventCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: Optional[str] = None   # None = personal event by a member
    title: str = Field(min_length=2, max_length=180)
    description: Optional[str] = Field(default=None, max_length=8000)
    modality: EventModality = "online"
    starts_at: str    # ISO
    ends_at: Optional[str] = None
    timezone: Optional[str] = Field(default="America/Bogota", max_length=50)
    location: Optional[str] = Field(default=None, max_length=200)   # physical address
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=80)
    stream_url: Optional[str] = Field(default=None, max_length=500)
    cover_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    is_public: bool = True


class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: Optional[str] = None
    description: Optional[str] = None
    modality: Optional[EventModality] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    timezone: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    stream_url: Optional[str] = None
    cover_url: Optional[str] = None
    tags: Optional[list[str]] = None
    is_public: Optional[bool] = None


class EventPublic(BaseModel):
    id: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    organizer_id: str
    title: str
    description: Optional[str] = None
    modality: EventModality
    starts_at: str
    ends_at: Optional[str] = None
    timezone: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    stream_url: Optional[str] = None
    cover_url: Optional[str] = None
    tags: list[str] = []
    is_public: bool
    attendees_count: int = 0
    interested_count: int = 0
    my_rsvp: Optional[RsvpStatus] = None
    created_at: str
    updated_at: str


class EventListResponse(BaseModel):
    items: list[EventPublic]
    total: int
    next_cursor: Optional[str] = None


class RsvpInput(BaseModel):
    status: RsvpStatus = "going"


def new_event_id() -> str: return _uid("ev")
def new_rsvp_id() -> str: return _uid("rsv")
def new_follow_id() -> str: return _uid("fol")
