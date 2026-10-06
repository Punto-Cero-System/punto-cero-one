"""
Activities read API — OMEGA C1.

HTTP shell only. Every query, every visibility decision and every pagination
rule lives in `services.activity_reader`; this file translates that result into
status codes and nothing more. In particular it does not read `activities`
directly and does not repeat any permission rule.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Query, Request

from services import activity_reader
from services.activity_reader import CursorError

logger = logging.getLogger("punto-cero-api.activities-api")

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("")
async def list_activities(
    request: Request,
    limit: int = Query(default=activity_reader.DEFAULT_LIMIT,
                       ge=1, le=activity_reader.MAX_LIMIT),
    cursor: Optional[str] = Query(default=None),
    subject_type: Optional[str] = Query(default=None),
    subject_id: Optional[str] = Query(default=None),
    session_token: Optional[str] = Cookie(default=None),
):
    """Actividades visibles para quien pregunta, de más reciente a más antigua.

    Sin sesión se devuelven solo las públicas: el filtro de privacidad lo
    resuelve el servicio, no esta ruta.
    """
    db = request.app.state.db
    viewer = await activity_reader.resolve_viewer(db, session_token)
    try:
        return await activity_reader.list_activities(
            db, viewer=viewer, limit=limit, cursor=cursor,
            subject_type=subject_type, subject_id=subject_id)
    except CursorError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{activity_id}")
async def get_activity(
    activity_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
):
    """Una actividad concreta, o 404.

    El mismo 404 se devuelve cuando la actividad existe pero no es visible:
    confirmar la existencia de lo que no se puede leer ya sería filtrar.
    """
    db = request.app.state.db
    viewer = await activity_reader.resolve_viewer(db, session_token)
    activity = await activity_reader.get_activity(db, activity_id, viewer=viewer)
    if activity is None:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return activity