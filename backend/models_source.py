"""Sources Center — data model.

Fuente (Source) is the canonical description of any content-generating
producer that alimenta el ecosistema Punto Cero One. Kinds supported:

    rss              → RSS/Atom feed (news, blogs, podcasts)
    github_org       → GitHub organization → surface repos + activity
    youtube_channel  → YouTube channel RSS
    entity_seed      → Curated public entity (company/org/university)
    jobs_feed        → Public job board RSS/JSON
    events_feed      → Public events RSS/iCal/JSON
    api              → Arbitrary JSON API (configurable endpoint + headers)

Same model for all: only `kind` + `config` differ. This keeps the CRUD /
sync UI universal.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field

SourceKind = Literal[
    "rss", "github_org", "youtube_channel", "entity_seed",
    "jobs_feed", "events_feed", "api",
]

SourceStatus = Literal["active", "paused", "error"]

SyncFrequency = Literal["realtime", "5m", "15m", "30m", "1h", "6h", "24h", "manual"]

FREQUENCY_SECONDS: dict[str, int] = {
    "realtime": 60,
    "5m": 5 * 60,
    "15m": 15 * 60,
    "30m": 30 * 60,
    "1h": 60 * 60,
    "6h": 6 * 60 * 60,
    "24h": 24 * 60 * 60,
    "manual": 0,
}


class SourceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=2, max_length=140)
    kind: SourceKind
    category: Optional[str] = Field(default=None, max_length=80)
    country: Optional[str] = Field(default=None, max_length=8)   # ISO or LATAM/GLOBAL
    language: Optional[str] = Field(default=None, max_length=8)  # BCP-47
    vertical: Optional[str] = Field(default=None, max_length=60)
    description: Optional[str] = Field(default=None, max_length=1000)
    url: Optional[str] = Field(default=None, max_length=500)
    api_key: Optional[str] = Field(default=None, max_length=300)
    frequency: SyncFrequency = "1h"
    config: dict[str, Any] = Field(default_factory=dict)
    status: SourceStatus = "active"


class SourceUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = Field(default=None, min_length=2, max_length=140)
    kind: Optional[SourceKind] = None
    category: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    vertical: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    frequency: Optional[SyncFrequency] = None
    config: Optional[dict[str, Any]] = None
    status: Optional[SourceStatus] = None


class SourcePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    kind: SourceKind
    category: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    vertical: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    frequency: SyncFrequency = "1h"
    status: SourceStatus = "active"
    config: dict[str, Any] = Field(default_factory=dict)
    owner_id: Optional[str] = None
    imported_count: int = 0
    last_sync_at: Optional[str] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    next_sync_at: Optional[str] = None
    created_at: str
    updated_at: str


def new_source_id() -> str:
    import uuid
    return f"src_{uuid.uuid4().hex[:12]}"


def new_sync_id() -> str:
    import uuid
    return f"sync_{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
