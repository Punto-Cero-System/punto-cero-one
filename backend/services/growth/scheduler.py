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
from datetime import datetime, timezone


logger = logging.getLogger("punto-cero-api.growth.scheduler")

DEFAULT_INTERVAL = 60 * 30  # 30 minutes
DEFAULT_TIMEOUT = 60 * 5  # 5 minutes


async def _process_admin_sources(db):
    """Run any admin-managed source (Sources Center) whose `next_sync_at`
    is due. Kept resilient — a failing source never breaks the loop.
    """
    try:
        from services.sources_center.engine import due_sources, run_sync
    except Exception as e:
        logger.warning("sources_center import failed: %s", e)
        return
    try:
        due = await due_sources(db)
    except Exception as e:
        logger.warning("due_sources failed: %s", e)
        return
    for src in due:
        try:
            await run_sync(db, src)
        except Exception as e:
            logger.warning("run_sync failed src=%s err=%s", src.get("id"), e)


async def _process_connectors(db):
    """Wave 11 — Iterate the LATAM Public Data connector registry, running
    every connector whose TTL is due. Isolated from the RSS path so a
    connector crash never blocks admin sources or the growth aggregator.
    """
    try:
        from services.growth.connectors import run_all_due
        from services.growth.connectors.registry import get as get_registry
    except Exception as e:
        logger.warning("connectors import failed: %s", e)
        return
    try:
        connectors = get_registry()
        res = await run_all_due(db, connectors)
        logger.info("connectors tick ran=%d ingested=%d updated=%d",
                    res.get("ran", 0), res.get("ingested", 0), res.get("updated", 0))
    except Exception as e:
        logger.warning("connectors tick failed: %s", e)


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
            timeout = int(os.environ.get("GROWTH_RUN_TIMEOUT_SECONDS", DEFAULT_TIMEOUT))

            async def _record_run(started_at, result: dict | None, errors: list[str] | None):
                try:
                    finished_at = datetime.now(timezone.utc).isoformat()
                    doc = {
                        "started_at": started_at,
                        "finished_at": finished_at,
                        "result": result or {},
                        "errors": errors or [],
                    }
                    await db.growth_runs.insert_one(doc)
                    # Upsert a singleton status for quick inspection
                    status = {
                        "last_run_at": finished_at,
                        "last_success_at": finished_at if (errors is None or len(errors) == 0) else None,
                        "last_result": result or {},
                    }
                    await db.growth_status.update_one({"_id": "singleton"}, {"$set": status}, upsert=True)
                except Exception:
                    logger.exception("failed to record growth run to DB")

            # kick off an immediate run (surrounded by safe guards and recording)
            started = datetime.now(timezone.utc).isoformat()
            errors: list[str] = []
            result = None
            try:
                result = await asyncio.wait_for(run_once(db), timeout=timeout)
                try:
                    await _process_admin_sources(db)
                except Exception as e:
                    logger.warning("_process_admin_sources failed: %s", e)
                try:
                    await _process_connectors(db)
                except Exception as e:
                    logger.warning("_process_connectors failed: %s", e)
            except asyncio.TimeoutError:
                errors.append("growth run timed out")
                logger.warning("initial growth run timed out after %ds", timeout)
            except Exception as e:
                errors.append(str(e))
                logger.warning("initial growth run failed: %s", e)
            await _record_run(started, result, errors)

            while not self._stop.is_set():
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=interval)
                except asyncio.TimeoutError:
                    pass
                if self._stop.is_set():
                    break
                started = datetime.now(timezone.utc).isoformat()
                errors = []
                result = None
                try:
                    result = await asyncio.wait_for(run_once(db), timeout=timeout)
                    try:
                        await _process_admin_sources(db)
                    except Exception as e:
                        logger.warning("_process_admin_sources failed: %s", e)
                    try:
                        await _process_connectors(db)
                    except Exception as e:
                        logger.warning("_process_connectors failed: %s", e)
                except asyncio.TimeoutError:
                    errors.append("growth run timed out")
                    logger.warning("growth run timed out after %ds", timeout)
                except Exception as e:
                    errors.append(str(e))
                    logger.warning("growth run failed: %s", e)
                await _record_run(started, result, errors)

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
