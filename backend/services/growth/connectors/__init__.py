"""Public data connector framework — Wave 11.

Every LATAM open-data source we integrate implements the same six-method
interface so the Scheduler / Sources Center can drive them all the same way.

Implementations live next to this file (e.g. `ckan.py`). The `registry`
module aggregates them and is the entry-point the Scheduler consumes.

Design decisions
----------------
* No new collections. Each connector emits `growth_items` documents (same
  schema every other Wave uses) with a proper `kind` and `country` tag.
* No new schedulers. The existing GrowthScheduler calls `run_all_due()`
  from this module on each tick.
* No new admin UI. Connectors surface through /api/growth/connectors
  and the existing Sources Center once seeded into `db.sources`.
* Credentials never live in code — every connector declares `env_keys` and
  is marked `configured=False` if any of them is missing.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("punto-cero-api.connectors")


class PublicDataConnector:
    """Base class for every country / API connector.

    Subclasses MUST override at least `_fetch()` and `normalize()`. All other
    methods have sane defaults so a subclass can be as small as ~20 lines.
    """

    #: Unique id, e.g. "co-datosabiertos"
    id: str = ""
    #: Human-readable name
    name: str = ""
    #: ISO 3166-1 alpha-2 country code, or "GLOBAL"
    country: str = "GLOBAL"
    #: Kind of item produced (`news`, `tender`, `indicator`, `registry`, `job`)
    kind: str = "news"
    #: Vertical bucket (`empresas`, `empleos`, `eventos`, `legal`, ...)
    vertical: str = "empresas"
    #: Default TTL between syncs, in seconds
    ttl_seconds: int = 3600
    #: If True the connector is skipped when any env_key is missing
    requires_credentials: bool = False
    #: Env variables the connector reads
    env_keys: tuple[str, ...] = ()

    def __init__(self, **overrides):
        for k, v in overrides.items():
            setattr(self, k, v)
        self._last_sync_at: Optional[float] = None
        self._last_sync_status: str = "pending"
        self._last_error: Optional[str] = None
        self._last_ingested: int = 0
        self._last_elapsed_ms: int = 0
        # Simple circuit breaker.
        self._fail_streak: int = 0

    # -----------------------------------------------------------------
    # PUBLIC INTERFACE — six required methods
    # -----------------------------------------------------------------
    def health(self) -> dict:
        """Static snapshot of the connector state — no I/O."""
        return {
            "id": self.id, "name": self.name, "country": self.country,
            "kind": self.kind, "vertical": self.vertical,
            "configured": self.is_configured(),
            "requires_credentials": self.requires_credentials,
            "env_keys": list(self.env_keys),
            "last_sync_at": self._last_sync_at,
            "last_sync_status": self._last_sync_status,
            "last_error": self._last_error,
            "last_ingested": self._last_ingested,
            "last_elapsed_ms": self._last_elapsed_ms,
            "next_run_in_seconds": self.next_run_in_seconds(),
            "ttl_seconds": self.ttl_seconds,
            "fail_streak": self._fail_streak,
        }

    async def sync(self, db) -> dict:
        """Run one full sync cycle: fetch → normalize → validate → upsert."""
        if not self.is_configured():
            return {"ok": False, "skipped": "missing_credentials",
                    "ingested": 0, "updated": 0}
        # Circuit breaker: skip while cooling down after 5 consecutive failures.
        if self._fail_streak >= 5:
            cool = min(3600, 60 * (2 ** min(self._fail_streak, 6)))
            if self._last_sync_at and time.time() - self._last_sync_at < cool:
                return {"ok": False, "skipped": "circuit_breaker",
                        "ingested": 0, "updated": 0}

        started = time.time()
        ingested = updated = 0
        errors: list[str] = []
        try:
            entries = await self._fetch()
            for e in entries[:60]:
                try:
                    item = self.normalize(e)
                except Exception as ne:  # per-entry safety net
                    errors.append(f"normalize: {ne}")
                    continue
                if not item or not self.validate(item):
                    continue
                res = await db.growth_items.update_one(
                    {"id": item["id"]},
                    {"$setOnInsert": {"first_seen_at": item["ingested_at"]},
                     "$set": item},
                    upsert=True,
                )
                if res.upserted_id:
                    ingested += 1
                elif res.modified_count:
                    updated += 1
            self._fail_streak = 0
            self._last_sync_status = "ok"
            self._last_error = None
        except Exception as e:
            self._fail_streak += 1
            self._last_sync_status = "error"
            self._last_error = str(e)[:220]
            errors.append(str(e))
            logger.warning("connector %s sync failed (#%d): %s",
                           self.id, self._fail_streak, e)
        elapsed_ms = int((time.time() - started) * 1000)
        self._last_sync_at = time.time()
        self._last_ingested = ingested
        self._last_elapsed_ms = elapsed_ms
        # Persist a lightweight receipt in `db.source_syncs` so the
        # existing Sources Center dashboard picks it up automatically.
        try:
            await db.source_syncs.insert_one({
                "id": f"conn_{self.id}_{int(started)}",
                "source_id": self.id, "kind": self.kind,
                "ingested": ingested, "updated": updated,
                "ok": self._last_sync_status == "ok",
                "elapsed_ms": elapsed_ms, "errors": errors[:5],
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:  # pragma: no cover
            pass
        return {"ok": self._last_sync_status == "ok",
                "ingested": ingested, "updated": updated,
                "elapsed_ms": elapsed_ms, "errors": errors[:5]}

    def normalize(self, entry: dict) -> Optional[dict]:  # pragma: no cover
        raise NotImplementedError

    def validate(self, item: dict) -> bool:
        return bool(item.get("id") and item.get("title"))

    def cache_key(self, entry: dict) -> str:
        return f"{self.id}::{entry.get('id') or entry.get('url') or entry.get('name')}"

    def schedule(self) -> int:
        """Return the desired TTL between syncs (seconds)."""
        return self.ttl_seconds

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------
    def is_configured(self) -> bool:
        if not self.requires_credentials:
            return True
        return all(os.environ.get(k) for k in self.env_keys)

    def next_run_in_seconds(self) -> Optional[int]:
        if not self._last_sync_at:
            return 0
        delta = self.ttl_seconds - (time.time() - self._last_sync_at)
        return max(0, int(delta))

    async def _fetch(self) -> list[dict]:  # pragma: no cover
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Orchestrator — called from the GrowthScheduler on each tick.
# ---------------------------------------------------------------------------
async def run_all_due(db, connectors: list[PublicDataConnector]) -> dict:
    """Sequentially run every connector that has hit its TTL. Sequential
    (not parallel) is intentional — keeps outbound bandwidth modest and
    respects each site's rate limits.
    """
    total_ing = total_upd = 0
    ran = 0
    for c in connectors:
        if c.next_run_in_seconds() and c.next_run_in_seconds() > 0:
            continue
        try:
            res = await asyncio.wait_for(c.sync(db), timeout=45)
        except asyncio.TimeoutError:
            c._last_sync_status = "timeout"
            c._last_error = "sync exceeded 45s"
            c._fail_streak += 1
            continue
        ran += 1
        total_ing += res.get("ingested", 0)
        total_upd += res.get("updated", 0)
    return {"ran": ran, "ingested": total_ing, "updated": total_upd,
            "connectors_total": len(connectors)}
