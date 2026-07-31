"""Dynamic category system.

Every content vertical (posts, jobs, events, videos, companies, ...) can attach
a `category_key` from this collection.  Adding a new category is a pure data
change — no frontend code deploy required.  The frontend fetches the taxonomy
at boot and renders filter chips / selectors dynamically.

Seeded on first startup with a canonical set covering the user's roadmap:
Legal, IA, Capital, Empresas, Comunidad, Eventos, Empleos, Marketplace,
Noticias, Videos, País. Admins can add more via POST /api/categories.
"""
from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field


CategoryGroup = Literal[
    "vertical",   # main content vertical
    "geographic", # country, city
    "surface",    # content surface (news, video, jobs, ...)
    "custom",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CategoryPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    label: str
    group: CategoryGroup = "vertical"
    icon: Optional[str] = None       # AppIcon name (frontend)
    color: Optional[str] = None
    order: int = 100
    active: bool = True
    parent_key: Optional[str] = None
    created_at: str
    updated_at: str


class CategoryUpsert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9_\-]+$")
    label: str = Field(min_length=1, max_length=80)
    group: CategoryGroup = "vertical"
    icon: Optional[str] = Field(default=None, max_length=40)
    color: Optional[str] = Field(default=None, max_length=20)
    order: int = 100
    active: bool = True
    parent_key: Optional[str] = Field(default=None, max_length=60)


DEFAULT_CATEGORIES: list[dict] = [
    # verticals
    {"key": "legal",       "label": "Legal",       "icon": "companies",  "color": "#00C896", "order": 10},
    {"key": "ia",          "label": "IA",          "icon": "ai",         "color": "#7C3AED", "order": 20},
    {"key": "capital",     "label": "Capital",     "icon": "investor",   "color": "#D4AF37", "order": 30},
    {"key": "empresas",    "label": "Empresas",    "icon": "companies",  "color": "#3B82F6", "order": 40},
    {"key": "comunidad",   "label": "Comunidad",   "icon": "community",  "color": "#EC4899", "order": 50},
    {"key": "eventos",     "label": "Eventos",     "icon": "events",     "color": "#F59E0B", "order": 60},
    {"key": "empleos",     "label": "Empleos",     "icon": "jobs",       "color": "#22D3EE", "order": 70},
    {"key": "marketplace", "label": "Marketplace", "icon": "marketplace","color": "#84CC16", "order": 80},
    {"key": "noticias",    "label": "Noticias",    "icon": "news",       "color": "#0EA5E9", "order": 90},
    {"key": "videos",      "label": "Videos",      "icon": "video",      "color": "#EF4444", "order": 100},
    {"key": "medicina",    "label": "Medicina",    "icon": "companies",  "color": "#10B981", "order": 110},
    {"key": "contabilidad","label": "Contabilidad","icon": "companies",  "color": "#8B5CF6", "order": 120},
    {"key": "educacion",   "label": "Educación",   "icon": "community",  "color": "#F472B6", "order": 130},
    # geographic  (top LatAm markets — user can add more)
    {"key": "co", "label": "Colombia", "group": "geographic", "order": 200},
    {"key": "mx", "label": "México",   "group": "geographic", "order": 210},
    {"key": "ar", "label": "Argentina","group": "geographic", "order": 220},
    {"key": "cl", "label": "Chile",    "group": "geographic", "order": 230},
    {"key": "pe", "label": "Perú",     "group": "geographic", "order": 240},
    {"key": "br", "label": "Brasil",   "group": "geographic", "order": 250},
]
