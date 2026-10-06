"""
Internal consumer bridge for social activities — OMEGA FASE C2.

Splits the delivery of a social fact from the recording of it:

    BEFORE   action ─┬─> notification ─> realtime
                     └─> analytics

    AFTER    action ─> activity ─┬─> consumer 1 (notifications)
                                 ├─> consumer 2 (realtime)
                                 └─> consumer N (feed signals, future)

NO QUEUE, NO WORKER, NO EXTERNAL INFRASTRUCTURE
-----------------------------------------------
Consumers run in-process, in registration order, inside the same request. A
queue is deliberately not introduced: the project has no worker and a deferred
task would be lost with the process, which is exactly the silent loss that
F0.9.1 removed.

WHAT IS REGISTERED TODAY
------------------------
    observability   logs the fact          (always safe, no DB)
    notifications   writes the inbox       (single explicit recipient)
    realtime        emits one SSE `feed`   (single explicit recipient)
    analytics       one event + counters   (every fact, once)

ISOLATION CONTRACT
------------------
A consumer that raises is logged and skipped. The remaining consumers still
run, and `publish()` never raises — a broken consumer cannot cancel the user
action that produced the fact. `publish()` also reports a per-consumer state so
an isolated failure stays observable instead of silent:

    "ok"                  the consumer did its work
    "skipped: <reason>"   there was nothing to deliver (no recipient, ...)
    "error: <ExcType>"    it failed; every other consumer still ran

SINGLE-WRITE INVARIANT
----------------------
`publish()` only distributes a document that `activities.record()` already
persisted (it returns the stored doc, or ``None`` on failure). There is exactly
**one** place that writes an activity: `services/activities.py`. A consumer
that called `record()` again would duplicate every fact.

WHY A CONSUMER NEVER RE-DELIVERS A BROADCAST AUDIENCE
------------------------------------------------------
`routes/groups_routes.create_group_post` still fans out group members itself
through `notification_fanout.fanout_to_group_members` (F0.9.1, which already
dedupes a member who is also a follower). If this module fanned out group
audiences too, **every member would receive two notifications for one post**.

The fix is neither a dedupe index on `notifications` (a new index on a frozen
contract) nor a marker field on the notification document (a change to a frozen
model). It is structural: **this module only delivers to an audience with
exactly one named recipient** (`audience.type == "user"`). Broadcast audiences
stay with the producer that owns their fan-out, and are listed in
`PRODUCER_OWNED_AUDIENCES` so that omission is explicit and auditable rather
than an accident.

Layering: this module imports `notifications`, `realtime` and `analytics`, none
of which import it back. `db` is resolved through a provider (see `get_db`),
so registering consumers adds no new import edge and therefore no import cycle.
"""
from __future__ import annotations

import inspect
import logging
import sys
from typing import Any, Callable, Optional

from services import activities
from services import analytics as analytics_service
from services import notifications as notifications_service
from services import realtime as realtime_service

logger = logging.getLogger("punto-cero-api.activity_consumers")

#: name -> async fn(activity: dict) -> Any
CONSUMERS: dict[str, Callable] = {}

#: Audiences whose fan-out belongs to the producer route (see module docstring).
#: A consumer must never deliver these: `create_group_post` already notifies
#: every member through `fanout_to_group_members`, and doing it twice would
#: double every inbox entry.
PRODUCER_OWNED_AUDIENCES = frozenset({"group", "company", "followers", "public"})

#: activity kind -> notifications kind. Closed vocabulary, like ACTIVITY_KINDS:
#: an unmapped kind is a delivery gap that must be explicit, never a guess.
NOTIFICATION_KINDS: dict[str, str] = {
    "user.followed": "follower",
    "post.reacted": "reaction",
    "post.commented": "comment",
    "post.mentioned": "mention",
    "message.sent": "message",
    "group.joined": "group_join",
    "group.post_created": "group_post",
    "job.applied": "application",
    "event.rsvped": "rsvp",
}

#: activity kind -> human title. Only reachable for single-recipient audiences.
NOTIFICATION_TITLES: dict[str, str] = {
    "user.followed": "Alguien te siguió",
    "post.reacted": "Alguien reaccionó a tu publicación",
    "post.commented": "Alguien comentó tu publicación",
    "post.mentioned": "Alguien te mencionó",
    "message.sent": "Tienes un mensaje nuevo",
    "group.joined": "Alguien se unió a un grupo tuyo",
    "group.post_created": "Alguien publicó en un grupo tuyo",
    "job.applied": "Alguien postuló a una oferta",
    "event.rsvped": "Alguien asistirá a un evento",
}

__all__ = [
    "CONSUMERS", "PRODUCER_OWNED_AUDIENCES", "NOTIFICATION_KINDS",
    "NOTIFICATION_TITLES", "register", "unregister", "publish", "get_db",
    "set_db_provider", "reset_db_provider", "observability", "notifications",
    "realtime", "analytics",
]


def register(name: str, fn: Callable) -> None:
    """Register an internal consumer. Idempotent per name."""
    CONSUMERS[name] = fn


def unregister(name: str) -> None:
    CONSUMERS.pop(name, None)


# ---------------------------------------------------------------------------
# db resolution
# ---------------------------------------------------------------------------
# `publish()` receives only the activity, and the producer route is not allowed
# to change. The running app already exposes its handle as `server.db`; reading
# it out of `sys.modules` (instead of importing it) adds **no** import edge from
# this module to `server`, so no cycle can be introduced here.
_db_provider: Optional[Callable[[], Any]] = None


def set_db_provider(provider: Callable[[], Any]) -> None:
    """Install an explicit `db` resolver (tests, alternative runtimes)."""
    global _db_provider
    _db_provider = provider


def reset_db_provider() -> None:
    """Restore the default resolver."""
    global _db_provider
    _db_provider = None


def get_db() -> Any:
    """Return the live database handle, or ``None`` when unavailable.

    Never raises and never imports anything: a missing handle degrades the
    DB-backed consumers to a logged skip instead of breaking the request.
    """
    if _db_provider is not None:
        try:
            return _db_provider()
        except Exception:
            logger.exception("no se pudo resolver la base de datos")
            return None
    module = sys.modules.get("server")
    return getattr(module, "db", None) if module is not None else None


# ---------------------------------------------------------------------------
# consumer helpers
# ---------------------------------------------------------------------------
def _skipped(reason: str) -> dict:
    return {"status": "skipped", "detail": reason}


def _done(**info: Any) -> dict:
    return {"status": "ok", **info}


def _recipient(activity: dict) -> Optional[str]:
    """The single named recipient, or ``None`` if this is not one.

    ``audience.type == "user"`` is the only audience with exactly one owner.
    Everything else is either a broadcast or a group the producer fans out.
    """
    audience = activity.get("audience")
    if not isinstance(audience, dict):
        return None
    atype = audience.get("type")
    if atype == "user":
        recipient = audience.get("id")
        return recipient if isinstance(recipient, str) and recipient.strip() else None
    if atype in PRODUCER_OWNED_AUDIENCES:
        return None
    return None


def _consumer_payload(activity: dict) -> dict:
    """A JSON-safe projection of the fact for realtime/analytics payloads.

    `expires_at` is deliberately dropped: it is a BSON `datetime` and would
    break `json.dumps` inside the SSE formatter.
    """
    return {
        "activity_id": activity.get("id"),
        "kind": activity.get("kind"),
        "actor_id": activity.get("actor_id"),
        "subject_type": activity.get("subject_type"),
        "subject_id": activity.get("subject_id"),
        "audience": activity.get("audience"),
        "visibility": activity.get("visibility"),
        "created_at": activity.get("created_at"),
    }


# ---------------------------------------------------------------------------
# consumers
# ---------------------------------------------------------------------------
async def observability(activity: dict) -> None:
    """Log the fact. Cheap, side-effect free, always safe."""
    logger.info(
        "activity %s/%s actor=%s subject=%s/%s audience=%s",
        activity.get("kind"), activity.get("id"),
        activity.get("actor_id"),
        activity.get("subject_type"), activity.get("subject_id"),
        (activity.get("audience") or {}).get("type"),
    )


async def notifications(activity: dict) -> dict:
    """Write the inbox entry for a fact addressed to one named user.

    Reuses `notifications.dispatch()` unchanged, so the actor is still never
    notified of their own action and a silenced kind is still honoured.
    Broadcast audiences are skipped by design: the producer route already
    delivered them, and delivering again is the double-notification bug.
    """
    kind = activity.get("kind")
    recipient = _recipient(activity)
    if not recipient:
        return _skipped("no single-recipient audience")

    nkind = NOTIFICATION_KINDS.get(kind)
    if not nkind:
        return _skipped(f"kind sin notificación asociada: {kind}")

    db = get_db()
    if db is None:
        return _skipped("sin base de datos")

    # `dispatch` returns None when the actor is the recipient or the kind is
    # silenced — both are correct outcomes, not failures.
    notification_id = await notifications_service.dispatch(
        db,
        recipient_id=recipient,
        kind=nkind,
        title=NOTIFICATION_TITLES.get(kind, "Actividad nueva"),
        body=(activity.get("metadata") or {}).get("excerpt"),
        actor={"id": activity.get("actor_id")},
        subject_type=activity.get("subject_type"),
        subject_id=activity.get("subject_id"),
        subject_url=(activity.get("metadata") or {}).get("subject_url"),
    )
    if notification_id is None:
        return _skipped("auto-notificación o tipo silenciado")
    return _done(notification_id=notification_id, recipient_id=recipient)


async def realtime(activity: dict) -> dict:
    """Emit one SSE `feed` event to the fact's single named recipient.

    The `feed` event type already exists in the broker and is already bound by
    the frontend, so this wires an existing contract instead of adding one.
    `emit_feed` fans out to that user's open tabs.
    """
    recipient = _recipient(activity)
    if not recipient:
        return _skipped("no single-recipient audience")
    if recipient == activity.get("actor_id"):
        return _skipped("el actor ya tiene el estado en su propia vista")

    await realtime_service.emit_feed(recipient, _consumer_payload(activity))
    return _done(recipient_id=recipient, event="feed")


async def analytics(activity: dict) -> dict:
    """Record one analytics event per fact, using the activity kind verbatim.

    `record_event` writes a row plus its per-day/per-vertical/per-country
    counters. Kinds are the closed `ACTIVITY_KINDS` vocabulary, which uses the
    same dotted style as the existing event names (`post.reacted`, ...), so no
    translation table is needed and no name can drift.
    """
    db = get_db()
    if db is None:
        return _skipped("sin base de datos")
    kind = activity.get("kind")
    if not kind:
        return _skipped("activity sin kind")

    await analytics_service.record_event(
        db,
        kind,
        actor_id=activity.get("actor_id"),
        subject_type=activity.get("subject_type"),
        subject_id=activity.get("subject_id"),
        payload={
            "activity_id": activity.get("id"),
            "audience": activity.get("audience"),
            "visibility": activity.get("visibility"),
            "metadata": dict(activity.get("metadata") or {}),
        },
    )
    return _done(event=kind)


register("observability", observability)
register("notifications", notifications)
register("realtime", realtime)
register("analytics", analytics)


def _state_of(result: Any) -> str:
    """Map a consumer's return value to its published state string."""
    if isinstance(result, dict) and "status" in result:
        detail = result.get("detail")
        return f"{result['status']}: {detail}" if detail else str(result["status"])
    return "ok"


async def publish(activity: Optional[dict]) -> dict:
    """Distribute one recorded activity to every registered consumer.

    Returns a per-consumer report. Never raises.
    """
    if not activity or not isinstance(activity, dict):
        return {"published": 0, "consumers": {}}

    report: dict[str, str] = {}
    published = 0
    for name, fn in list(CONSUMERS.items()):
        try:
            result = fn(activity)
            if inspect.isawaitable(result):
                result = await result
            state = _state_of(result)
            report[name] = state
            if state == "ok":
                published += 1
        except Exception as exc:
            # Isolation: one broken consumer must not stop the others, and
            # must never propagate to the caller (the HTTP request).
            logger.exception("consumidor de actividad falló: %s", name)
            report[name] = f"error: {type(exc).__name__}"
    return {"published": published, "consumers": report}
