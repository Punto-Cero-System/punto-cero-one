"""Realtime service — Server-Sent Events broker + presence tracker.

Design goals
------------
1. **Portable**: pure in-process asyncio queues; no external deps.
2. **Multi-tenant / cross-vertical**: any future vertical (Legal, Health, ...)
   just consumes the same `/api/realtime/stream` endpoint.
3. **Fallback-safe**: publish() NEVER raises — if broker is unreachable, the
   REST write path (feed, chat, notifications) keeps working unchanged.
4. **Swappable**: `RealtimeBroker` is a thin abstraction. Tomorrow you can
   plug Redis pub/sub by implementing the same 4 methods (publish, subscribe,
   unsubscribe, presence_snapshot) without touching consumers.

Public API
----------
- broker.publish(user_id: str, event: dict)  → fire-and-forget
- broker.subscribe(user_id: str)             → yields SSE-formatted strings
- broker.presence(user_ids: list[str])       → { user_id: { status, last_seen } }
- broker.touch(user_id: str)                 → refresh last_seen

Event shape (client will read):
{
  "type": "notification" | "message" | "feed" | "presence" | "system.ping",
  "data": { ... payload ... },
  "ts":   "2026-07-05T12:34:56+00:00"
}
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional


logger = logging.getLogger("punto-cero-api.realtime")


PRESENCE_ONLINE = "ONLINE"
PRESENCE_AWAY = "AWAY"
PRESENCE_OFFLINE = "OFFLINE"

# Away after this many seconds without a heartbeat/subscription refresh.
AWAY_AFTER_SECONDS = int(os.environ.get("REALTIME_AWAY_AFTER_SECONDS", "60"))
# Offline after this many seconds — purge from `presence` after.
OFFLINE_AFTER_SECONDS = int(os.environ.get("REALTIME_OFFLINE_AFTER_SECONDS", "180"))
# Heartbeat / keep-alive comment every N seconds (prevents proxy timeouts).
KEEPALIVE_SECONDS = int(os.environ.get("REALTIME_KEEPALIVE_SECONDS", "20"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sse_format(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, "data": data, "ts": _now_iso()})
    return f"event: {event_type}\ndata: {payload}\n\n"


class RealtimeBroker:
    """In-process SSE broker. One user can have multiple concurrent tabs; each
    subscribe() returns its own queue so every tab sees every event."""

    def __init__(self) -> None:
        # user_id → set[asyncio.Queue]  (one queue per open tab)
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # user_id → {"last_seen": iso, "connections": int}
        self._presence: dict[str, dict] = {}
        self._lock = asyncio.Lock()

    # ---------------- Public API ----------------
    async def publish(self, user_id: Optional[str], event_type: str, data: dict) -> int:
        """Fan-out an event to every open tab of `user_id`. Returns delivered
        count. Never raises."""
        if not user_id:
            return 0
        try:
            queues = list(self._subs.get(user_id, ()))
            payload = _sse_format(event_type, data)
            for q in queues:
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    # Slow consumer: drop and continue. Client will resync on reconnect.
                    logger.warning("realtime: queue full for user %s — dropping event", user_id)
            return len(queues)
        except Exception as e:
            logger.warning("realtime.publish soft-fail: %s", e)
            return 0

    async def broadcast(self, user_ids: list[str], event_type: str, data: dict) -> int:
        total = 0
        for uid in user_ids or []:
            total += await self.publish(uid, event_type, data)
        return total

    async def subscribe(self, user_id: str) -> AsyncGenerator[str, None]:
        """Async generator yielding raw SSE lines. Manages presence lifecycle."""
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subs[user_id].add(q)
            self._presence[user_id] = {
                "last_seen": _now_iso(),
                "connections": len(self._subs[user_id]),
            }
        logger.info("realtime: subscribe user=%s tabs=%d", user_id, len(self._subs[user_id]))

        # Initial hello — client can use it to confirm the stream is live.
        yield _sse_format("system.hello", {"user_id": user_id, "presence": PRESENCE_ONLINE})

        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=KEEPALIVE_SECONDS)
                    # Refresh presence timestamp on activity.
                    self._presence[user_id]["last_seen"] = _now_iso()
                    yield msg
                except asyncio.TimeoutError:
                    # Send a comment keep-alive — invisible to EventSource,
                    # keeps intermediate proxies from closing idle connections.
                    self._presence[user_id]["last_seen"] = _now_iso()
                    yield f": keepalive {_now_iso()}\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            async with self._lock:
                self._subs[user_id].discard(q)
                remaining = len(self._subs[user_id])
                if remaining == 0:
                    self._subs.pop(user_id, None)
                    if user_id in self._presence:
                        self._presence[user_id]["connections"] = 0
                        self._presence[user_id]["last_seen"] = _now_iso()
                else:
                    self._presence[user_id]["connections"] = remaining
            logger.info("realtime: unsubscribe user=%s remaining_tabs=%d", user_id, remaining)

    async def touch(self, user_id: str) -> None:
        """Fallback presence heartbeat for clients that can't (or don't) hold SSE."""
        async with self._lock:
            entry = self._presence.get(user_id) or {"connections": 0}
            entry["last_seen"] = _now_iso()
            self._presence[user_id] = entry

    def presence(self, user_ids: list[str]) -> dict[str, dict]:
        """Snapshot presence for a list of user ids."""
        out: dict[str, dict] = {}
        now = datetime.now(timezone.utc)
        for uid in user_ids:
            entry = self._presence.get(uid)
            if not entry or not entry.get("last_seen"):
                out[uid] = {"status": PRESENCE_OFFLINE, "last_seen": None}
                continue
            try:
                last = datetime.fromisoformat(entry["last_seen"])
            except Exception:
                last = now
            delta = (now - last).total_seconds()
            conns = int(entry.get("connections") or 0)
            if conns > 0 and delta < AWAY_AFTER_SECONDS:
                status = PRESENCE_ONLINE
            elif delta < OFFLINE_AFTER_SECONDS:
                status = PRESENCE_AWAY
            else:
                status = PRESENCE_OFFLINE
            out[uid] = {"status": status, "last_seen": entry["last_seen"]}
        return out

    def stats(self) -> dict:
        return {
            "subscribers": {uid: len(qs) for uid, qs in self._subs.items()},
            "presence_tracked": len(self._presence),
        }


# Singleton — one broker per process.
_broker: Optional[RealtimeBroker] = None


def get_broker() -> RealtimeBroker:
    global _broker
    if _broker is None:
        _broker = RealtimeBroker()
    return _broker


# ---------- Convenience publishers (kept trivial on purpose) ----------
async def emit_notification(recipient_id: str, notification: dict) -> None:
    """Called by services.notifications.dispatch() after the DB write."""
    await get_broker().publish(recipient_id, "notification", notification)


async def emit_message(recipient_id: str, message: dict) -> None:
    """Called by messaging_routes.send_message() after DB write, once per recipient."""
    await get_broker().publish(recipient_id, "message", message)


async def emit_feed(recipient_id: str, feed_event: dict) -> None:
    """Called when a followed entity publishes new content (posts, jobs, events)."""
    await get_broker().publish(recipient_id, "feed", feed_event)
