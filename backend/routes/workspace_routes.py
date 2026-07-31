"""Mi Espacio — per-user workspace persistence.

Stores each user's personal workspace configuration (which widgets are
enabled, in which panel, in what order, collapsed state) in MongoDB.

Design
------
Collection: `user_workspaces`
Shape:
    {
        id, user_id, layout_version,
        panels: { left: [wid], center: [wid], right: [wid] },
        widgets: { [wid]: { enabled: bool, collapsed: bool, size: 'sm|md|lg' } },
        theme: 'auto|light|dark',
        updated_at
    }

The frontend owns the widget catalog (Widget Registry). The backend simply
persists the user's preferences — this keeps the system decoupled and
lets us add new widgets without a schema migration.

Endpoints
---------
GET   /api/workspace/me            → returns current user workspace (or default template)
PUT   /api/workspace/me            → full replace (client sends the whole doc)
PATCH /api/workspace/me            → partial update (toggle a widget, reorder a panel, etc.)
POST  /api/workspace/me/reset      → wipe user's workspace so defaults kick in
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from services.community_deps import require_current_user


logger = logging.getLogger("punto-cero-api.workspace")

router = APIRouter(prefix="/api/workspace", tags=["workspace"])

LAYOUT_VERSION = 1
VALID_PANELS = {"left", "center", "right"}
VALID_SIZES = {"sm", "md", "lg"}


# ---------- Pydantic ----------

class WidgetPref(BaseModel):
    enabled: bool = True
    collapsed: bool = False
    size: str = "md"


class WorkspaceDoc(BaseModel):
    layout_version: int = LAYOUT_VERSION
    panels: Dict[str, List[str]] = Field(
        default_factory=lambda: {"left": [], "center": [], "right": []}
    )
    widgets: Dict[str, WidgetPref] = Field(default_factory=dict)
    theme: str = "auto"


# ---------- Defaults ----------

def default_workspace() -> Dict[str, Any]:
    """Default Mi Espacio layout — mirrors the current HomePage widget order.

    Widget IDs must match the frontend registry (see workspaceRegistry.js).
    """
    return {
        "layout_version": LAYOUT_VERSION,
        "panels": {
            "left": [
                "profile-card",
                "nuestra-historia",
                "activity",
                "groups",
                "quick-links",
                "weather-mini",
                "calendar-mini",
                "podcast-mini",
            ],
            "center": [
                "welcome-band",
                "feed",
                "inline-stats",
            ],
            "right": [
                "rss-news",
                "trending",
                "trending-editorial",
                "events",
                "companies",
                "investor-center",
                "ai-tools",
                "crypto-live",
                "fx-live",
                "weather-live",
                "youtube-live",
                "markets",
                "ai-of-the-day",
                "poll",
                "launches",
                "courses",
                "marketplace",
                "suggested-people",
                "capital-cta",
            ],
        },
        "widgets": {},  # empty = every listed widget uses defaults (enabled=true)
        "theme": "auto",
    }


# ---------- Helpers ----------

def _normalize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure returned document has the expected shape, filling gaps from defaults."""
    d = default_workspace()
    if not doc:
        return d
    panels = doc.get("panels") or {}
    d["panels"] = {
        "left": panels.get("left") or d["panels"]["left"],
        "center": panels.get("center") or d["panels"]["center"],
        "right": panels.get("right") or d["panels"]["right"],
    }
    d["widgets"] = doc.get("widgets") or {}
    d["theme"] = doc.get("theme") or "auto"
    d["layout_version"] = doc.get("layout_version") or LAYOUT_VERSION
    return d


def _validate_incoming(body: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce, dedupe and sanity-check the payload."""
    panels_in = body.get("panels") or {}
    panels_out: Dict[str, List[str]] = {}
    for key in ("left", "center", "right"):
        raw = panels_in.get(key, [])
        if not isinstance(raw, list):
            raise HTTPException(400, f"panels.{key} must be a list of widget ids")
        seen = set()
        clean: List[str] = []
        for w in raw:
            if not isinstance(w, str) or not w.strip():
                continue
            wid = w.strip()
            if wid in seen:
                continue
            seen.add(wid)
            clean.append(wid)
        panels_out[key] = clean

    widgets_in = body.get("widgets") or {}
    widgets_out: Dict[str, Dict[str, Any]] = {}
    if not isinstance(widgets_in, dict):
        raise HTTPException(400, "widgets must be an object")
    for wid, pref in widgets_in.items():
        if not isinstance(pref, dict):
            continue
        widgets_out[wid] = {
            "enabled": bool(pref.get("enabled", True)),
            "collapsed": bool(pref.get("collapsed", False)),
            "size": pref.get("size") if pref.get("size") in VALID_SIZES else "md",
        }

    theme = body.get("theme") or "auto"
    if theme not in {"auto", "light", "dark"}:
        theme = "auto"

    return {
        "layout_version": LAYOUT_VERSION,
        "panels": panels_out,
        "widgets": widgets_out,
        "theme": theme,
    }


async def _load(db, user_id: str) -> Dict[str, Any]:
    doc = await db.user_workspaces.find_one({"user_id": user_id}, {"_id": 0})
    return _normalize(doc)


async def _save(db, user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    to_store = {**payload, "user_id": user_id, "updated_at": now}
    await db.user_workspaces.update_one(
        {"user_id": user_id}, {"$set": to_store}, upsert=True
    )
    return _normalize(to_store)


# ---------- Endpoints ----------

@router.get("/me")
async def get_my_workspace(request: Request, user=Depends(require_current_user)):
    db = request.app.state.db
    ws = await _load(db, user["id"])
    return {"workspace": ws, "defaults": default_workspace()}


@router.put("/me")
async def put_my_workspace(body: Dict[str, Any], request: Request, user=Depends(require_current_user)):
    db = request.app.state.db
    clean = _validate_incoming(body)
    ws = await _save(db, user["id"], clean)
    return {"workspace": ws}


@router.patch("/me")
async def patch_my_workspace(body: Dict[str, Any], request: Request, user=Depends(require_current_user)):
    """Partial update — merges `panels` / `widgets` / `theme` into current doc."""
    db = request.app.state.db
    current = await _load(db, user["id"])

    if "panels" in body and isinstance(body["panels"], dict):
        for key in ("left", "center", "right"):
            if key in body["panels"]:
                current["panels"][key] = body["panels"][key]

    if "widgets" in body and isinstance(body["widgets"], dict):
        current["widgets"] = {**current.get("widgets", {}), **body["widgets"]}

    if "theme" in body:
        current["theme"] = body["theme"]

    clean = _validate_incoming(current)
    ws = await _save(db, user["id"], clean)
    return {"workspace": ws}


@router.post("/me/reset")
async def reset_my_workspace(request: Request, user=Depends(require_current_user)):
    db = request.app.state.db
    await db.user_workspaces.delete_one({"user_id": user["id"]})
    return {"workspace": default_workspace(), "reset": True}
