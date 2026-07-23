"""Pitch Deck routes: public event tracking + PDF download + admin analytics."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from auth import require_admin
from models import (
    PitchDeckEventCreate,
    PitchDeckAnalytics,
    PitchDeckSlideStat,
)
from services.pdf_service import build_pitch_deck_pdf, build_filename

public_router = APIRouter(prefix="/api/pitch-deck", tags=["pitch-deck"])
admin_router = APIRouter(prefix="/api/admin/pitch-deck", tags=["admin"])


# --------------- PUBLIC ---------------
@public_router.post("/events", status_code=201)
async def track_event(payload: PitchDeckEventCreate, request: Request):
    """Record a dwell measurement. Very small footprint, no auth required."""
    db = request.app.state.db
    ua = payload.user_agent or (request.headers.get("user-agent", "")[:400])
    doc = {
        **payload.model_dump(),
        "user_agent": ua,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pitch_deck_events.insert_one(doc)
    return {"ok": True}


@public_router.get("/download")
async def download_pdf(request: Request):
    """Generate the deck PDF on-the-fly and stream it back. Public download."""
    db = request.app.state.db
    # Track a download event (non-blocking; best-effort)
    try:
        await db.pitch_deck_downloads.insert_one({
            "created_at": datetime.now(timezone.utc).isoformat(),
            "user_agent": request.headers.get("user-agent", "")[:400],
            "ip": (request.headers.get("x-forwarded-for", "") or (request.client.host if request.client else "")).split(",")[0].strip(),
        })
    except Exception:
        pass

    pdf_bytes = build_pitch_deck_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{build_filename()}"',
            "Cache-Control": "no-cache",
        },
    )


# --------------- ADMIN ---------------
@admin_router.get("/analytics", response_model=PitchDeckAnalytics)
async def analytics(request: Request, _: dict = Depends(require_admin)):
    db = request.app.state.db

    # Per-slide aggregation
    pipeline = [
        {
            "$group": {
                "_id": "$slide_number",
                "slide_title": {"$last": "$slide_title"},
                "views": {"$sum": 1},
                "unique_sessions": {"$addToSet": "$session_id"},
                "total_ms": {"$sum": "$duration_ms"},
                "avg_ms": {"$avg": "$duration_ms"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    slides: list[PitchDeckSlideStat] = []
    async for row in db.pitch_deck_events.aggregate(pipeline):
        slides.append(PitchDeckSlideStat(
            slide_number=row["_id"],
            slide_title=row.get("slide_title") or "",
            views=row["views"],
            unique_sessions=len(row.get("unique_sessions") or []),
            total_ms=int(row.get("total_ms") or 0),
            avg_ms=float(row.get("avg_ms") or 0.0),
        ))

    total_events = await db.pitch_deck_events.count_documents({})
    # distinct sessions
    session_ids = await db.pitch_deck_events.distinct("session_id")
    total_sessions = len(session_ids)

    return PitchDeckAnalytics(
        total_events=total_events,
        total_sessions=total_sessions,
        slides=slides,
    )


@admin_router.get("/downloads")
async def downloads(request: Request, _: dict = Depends(require_admin)):
    db = request.app.state.db
    total = await db.pitch_deck_downloads.count_documents({})
    return {"total_downloads": total}
