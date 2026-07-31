"""Realtime API — SSE stream + presence.

Endpoints
---------
GET  /api/realtime/stream               — long-lived SSE (auth required)
POST /api/realtime/heartbeat            — fallback presence ping
GET  /api/realtime/presence?ids=a,b,c   — bulk presence snapshot
GET  /api/realtime/stats                — admin/debug counters
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from services.community_deps import require_current_user, current_user_or_none
from services.realtime import get_broker


logger = logging.getLogger("punto-cero-api.realtime")

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


@router.get("/stream")
async def realtime_stream(request: Request, user: dict = Depends(require_current_user)):
    """Server-Sent Events stream — one connection per browser tab.

    The response headers below are critical:
      • text/event-stream — required for EventSource clients
      • X-Accel-Buffering: no — disables nginx / ingress response buffering
      • Cache-Control: no-cache — prevents intermediate caching
    """
    broker = get_broker()
    user_id = user["id"]

    async def event_gen():
        try:
            async for chunk in broker.subscribe(user_id):
                # Bail out early if the client disconnected — prevents zombie tasks.
                if await request.is_disconnected():
                    break
                yield chunk
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("realtime stream error user=%s: %s", user_id, e)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/heartbeat")
async def heartbeat(request: Request, user: dict = Depends(require_current_user)):
    await get_broker().touch(user["id"])
    return {"ok": True}


@router.get("/presence")
async def presence(
    request: Request,
    ids: str = Query(default="", description="Comma-separated user ids"),
    user: Optional[dict] = Depends(current_user_or_none),
):
    id_list = [i for i in (ids or "").split(",") if i.strip()]
    if not id_list:
        return {"presence": {}}
    return {"presence": get_broker().presence(id_list)}


@router.get("/stats")
async def stats(request: Request, user: dict = Depends(require_current_user)):
    # Public-ish — only authenticated users can inspect. Useful for QA UI badges.
    return get_broker().stats()
