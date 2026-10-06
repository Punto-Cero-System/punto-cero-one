"""Batched notification fan-out — OMEGA F0.9.1.

Replaces the sequential ``for member: await dispatch_notif(...)`` loop with
batched delivery. Pure optimisation of the existing flow:

* no new collections, no queue, no worker, no Redis
* ``services.notifications.dispatch`` is **untouched** — the other five
  emitters keep calling it exactly as before
* realtime stays a best-effort side effect; the DB write is still the source
  of truth

WHY BATCHING AND NOT DEFERRAL
------------------------------
Deferring the work to a fire-and-forget task was rejected on purpose. The
project has no queue and no worker (verified in F0.9: no redis/celery/rq/
dramatiq in ``requirements.txt``, and no ``BackgroundTasks``, ``create_task``
or ``to_thread`` anywhere in the backend). A deferred task in a multi-worker
deployment dies with the process and there is nothing to replay it from —
notifications would be lost silently.

Batching keeps delivery guaranteed and inside the same request, while
removing the O(N) round-trips that made it slow.
"""
from __future__ import annotations

import logging
from typing import Any, Iterable, Optional

from pymongo import InsertOne

from services import notifications as notif

logger = logging.getLogger("punto-cero-api.notification_fanout")

DEFAULT_BATCH_SIZE = 200

__all__ = ["DEFAULT_BATCH_SIZE", "plan_recipients", "build_doc",
           "dispatch_batch", "fanout_to_group_members"]


def plan_recipients(recipient_ids: Iterable[str],
                    exclude_user_id: Optional[str] = None):
    """Dedupe preserving order and drop the actor.

    ``group_members`` has no unique index (see F0.9), so duplicates in that
    collection would otherwise produce duplicate notifications for the same
    recipient within one fan-out cycle.
    """
    seen: set[str] = set()
    ordered: list[str] = []
    duplicates = 0
    for rid in recipient_ids or ():
        if not rid:
            continue
        if exclude_user_id and rid == exclude_user_id:
            continue
        if rid in seen:
            duplicates += 1
            continue
        seen.add(rid)
        ordered.append(rid)
    return ordered, duplicates


def build_doc(recipient_id: str, *, now: str, **payload: Any) -> dict:
    """Build a document with the exact shape `dispatch()` writes."""
    actor = payload.get("actor") or {}
    return {
        "id": notif._uid(),
        "recipient_id": recipient_id,
        "kind": payload["kind"],
        "title": payload["title"],
        "body": payload.get("body"),
        "actor_id": actor.get("id"),
        "actor_name": actor.get("name"),
        "actor_picture": actor.get("picture"),
        "subject_type": payload.get("subject_type"),
        "subject_id": payload.get("subject_id"),
        "subject_url": payload.get("subject_url"),
        "image_url": payload.get("image_url"),
        "vertical": payload.get("vertical"),
        "is_read": False,
        "created_at": now,
    }


async def _silenced(db, user_ids, kind) -> set:
    """Which of ``user_ids`` silenced ``kind`` — ONE query for the whole batch."""
    out: set = set()
    if not user_ids:
        return out
    cur = db.notification_preferences.find(
        {"user_id": {"$in": list(user_ids)}},
        {"_id": 0, "user_id": 1, "disabled_kinds": 1},
    )
    async for pref in cur:
        if kind in (pref.get("disabled_kinds") or []):
            out.add(pref.get("user_id"))
    return out


async def dispatch_batch(db, recipient_ids, *, kind, title,
                        actor=None, **payload) -> dict:
    """Batched equivalent of N sequential ``notifications.dispatch`` calls.

    Semantics are preserved 1:1 with ``dispatch()``:
      * the actor is never notified
      * a recipient who silenced ``kind`` is skipped
      * never raises — a failure here can never cancel the main request
      * realtime is a best-effort side effect; the DB write is the truth

    Only the cost changes: preferences are fetched in ONE query for the whole
    batch and documents go in with a single ``insert_many`` instead of two
    round-trips per recipient.
    """
    ids = [r for r in (recipient_ids or []) if r]
    actor_id = (actor or {}).get("id")
    if actor_id:
        ids = [r for r in ids if r != actor_id]
    if not ids:
        return {"sent": 0, "skipped_silenced": 0, "failed": 0}

    try:
        silenced = await _silenced(db, ids, kind)
        now = notif._now()
        docs, skipped = [], 0
        for rid in ids:
            if rid in silenced:
                skipped += 1
                continue
            docs.append(build_doc(rid, now=now, kind=kind, title=title,
                                  actor=actor, **payload))

        sent = 0
        if docs:
            await db.notifications.insert_many([InsertOne(d) for d in docs])
            sent = len(docs)

        # Realtime stays soft-fail and strictly after the DB write.
        try:
            from services.realtime import emit_notification
            for d in docs:
                try:
                    await emit_notification(
                        d["recipient_id"],
                        {k: v for k, v in d.items() if k != "_id"},
                    )
                except Exception:
                    pass
        except Exception:
            pass
        return {"sent": sent, "skipped_silenced": skipped, "failed": 0}
    except Exception:
        logger.exception("notification_fanout: batch failed; main action stands")
        return {"sent": 0, "skipped_silenced": 0, "failed": len(ids)}


async def fanout_to_group_members(db, group_id, *, exclude_user_id=None,
                                  batch_size=DEFAULT_BATCH_SIZE, **payload) -> dict:
    """Notify every member of a group, in batches, with no silent cap.

    Replaces the ``.limit(500)`` loop in ``groups_routes.create_group_post``,
    which silently dropped every member past the 500th (F0.9 finding B5).

    Duplicates are collapsed across the WHOLE cycle, not per batch, because
    ``group_members`` carries no unique index (F0.9).
    """
    query: dict = {"group_id": group_id}
    if exclude_user_id:
        query["user_id"] = {"$ne": exclude_user_id}

    seen: set = set()
    duplicates = 0
    totals = {"sent": 0, "skipped_silenced": 0, "failed": 0, "batches": 0}
    cur = db.group_members.find(query, {"_id": 0, "user_id": 1})
    while True:
        chunk = await cur.to_list(length=batch_size)
        if not chunk:
            break
        fresh = []
        for m in chunk:
            rid = m.get("user_id")
            if not rid or (exclude_user_id and rid == exclude_user_id):
                continue
            if rid in seen:
                duplicates += 1
                continue
            seen.add(rid)
            fresh.append(rid)
        totals["batches"] += 1
        result = await dispatch_batch(db, fresh, **payload)
        for key in ("sent", "skipped_silenced", "failed"):
            totals[key] += result[key]

    totals["recipients"] = len(seen)
    totals["duplicates"] = duplicates
    return totals