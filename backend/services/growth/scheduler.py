"""Scheduler — periodic background task that keeps `growth_items` fresh.

Fire-and-forget asyncio task attached to the FastAPI lifespan. On startup we
kick off one immediate run so the feed is never empty, then repeat every
GROWTH_INTERVAL_SECONDS (default 30 minutes).
"""
from __future__ import annotations

import asyncio
import logging
import os

from .aggregator import run_once


logger = logging.getLogger("punto-cero-api.growth.scheduler")

DEFAULT_INTERVAL = 60 * 30  # 30 minutes


class GrowthScheduler:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def start(self, app) -> None:
        if self._task and not self._task.done():
            return

        interval = int(os.environ.get("GROWTH_INTERVAL_SECONDS", DEFAULT_INTERVAL))

        async def loop():
            db = app.state.db
            # kick off an immediate run
            try:
                await run_once(db)
            except Exception as e:
                logger.warning("initial growth run failed: %s", e)
            while not self._stop.is_set():
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=interval)
                except asyncio.TimeoutError:
                    pass
                if self._stop.is_set():
                    break
                try:
                    await run_once(db)
                except Exception as e:
                    logger.warning("growth run failed: %s", e)

        self._task = asyncio.create_task(loop(), name="growth-scheduler")
        logger.info("growth scheduler started (interval=%ds)", interval)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except Exception:
                self._task.cancel()


scheduler = GrowthScheduler()
