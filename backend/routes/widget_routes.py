"""Widgets API — thin HTTP wrapper around services.integrations.*

Everything here is safe to call unauthenticated: content is public, cached in
Mongo, and always returns a WidgetResponse (even in mock/error states).

GET /api/widgets/crypto[?ids=bitcoin,ethereum&vs=usd]
GET /api/widgets/weather[?city=Bogota,CO]
GET /api/widgets/fx[?base=USD&targets=COP,MXN,ARS]
GET /api/widgets/rss[?url=...|feed_key=noticias]
GET /api/widgets/youtube[?channel_id=... | playlist_id=...]
GET /api/widgets/all         — bundle of the default 4 (crypto, weather, fx, rss)
"""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Query, Request

from services.integrations import (
    WidgetResponse,
    fetch_crypto, fetch_weather, fetch_fx, fetch_rss, fetch_youtube,
)


router = APIRouter(prefix="/api/widgets", tags=["widgets"])


@router.get("/crypto", response_model=WidgetResponse)
async def widget_crypto(request: Request,
                        ids: str = Query(default="bitcoin,ethereum"),
                        vs: str = Query(default="usd")):
    return await fetch_crypto(request.app.state.db, ids=ids, vs=vs)


@router.get("/weather", response_model=WidgetResponse)
async def widget_weather(request: Request, city: str = Query(default="Bogota,CO")):
    return await fetch_weather(request.app.state.db, city=city)


@router.get("/fx", response_model=WidgetResponse)
async def widget_fx(request: Request,
                    base: str = Query(default="USD"),
                    targets: str = Query(default="COP,MXN,ARS,CLP")):
    return await fetch_fx(request.app.state.db, base=base, targets=targets)


@router.get("/rss", response_model=WidgetResponse)
async def widget_rss(request: Request,
                     url: Optional[str] = Query(default=None),
                     feed_key: Optional[str] = Query(default=None),
                     limit: int = Query(default=6, ge=1, le=20)):
    return await fetch_rss(request.app.state.db, url=url, feed_key=feed_key, limit=limit)


@router.get("/youtube", response_model=WidgetResponse)
async def widget_youtube(request: Request,
                         channel_id: Optional[str] = Query(default=None),
                         playlist_id: Optional[str] = Query(default=None),
                         max_results: int = Query(default=5, ge=1, le=15)):
    return await fetch_youtube(request.app.state.db, channel_id=channel_id,
                               playlist_id=playlist_id, max_results=max_results)


@router.get("/all")
async def widget_bundle(request: Request):
    """Sidebar bundle — 4 widgets in one round trip, fired in parallel.
    Any single-provider failure is contained; the response still returns 200.
    """
    db = request.app.state.db
    crypto, weather, fx, rss, youtube = await asyncio.gather(
        fetch_crypto(db),
        fetch_weather(db),
        fetch_fx(db),
        fetch_rss(db, feed_key="noticias"),
        fetch_youtube(db),
    )
    return {
        "crypto": crypto.model_dump(),
        "weather": weather.model_dump(),
        "fx": fx.model_dump(),
        "rss": rss.model_dump(),
        "youtube": youtube.model_dump(),
    }
