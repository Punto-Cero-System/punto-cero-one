"""
Social activity writer — OMEGA F0.9.3.

Canonical writer for `activities`: an **append-only log of social facts**
("what happened and to whom it concerns"), per `SOCIAL_GRAPH_CONTRACT.md` §2.3.

This module is **write-only**. It is not called by any route yet, no consumer
reads it, and nothing else in the backend imports it. That is deliberate: the
contract must be proven before producers and consumers depend on it.

WHY THIS EXISTS
---------------
The codebase has four uncoordinated channels for the same social fact:
`notifications` (per recipient), `analytics_events` (a count), `pc:*` (client
only, ephemeral) and the relation collections. Four of nine domains notify but
never measure — including the Feed, the most important surface. This writer is
the single place where a fact is recorded once; consumers derive from it later.

DESIGN DECISIONS (from ACTIVITIES_LAYER_DESIGN_F0_9_2.md)
---------------------------------------------------------
* **`created_at` is an ISO-8601 string**, matching `posts`, `notifications` and
  `analytics_events`. **`expires_at` is a BSON Date** so a TTL index can be
  created without a migration. A string `created_at` cannot carry a TTL.
* **TTL is the default, not an option.** ~5 actions/user/day means millions of
  rows per year. `expires_at` is always written.
* **Dedupe does NOT live here.** Two people facts (joining *and* following a
  group) are distinct and must both be recorded. `activity_key` therefore is
  NOT a domain uniqueness constraint — it identifies the record so a delivery
  layer can dedupe later (contract §3). Supply `idempotency_key` to opt into
  write-once behaviour; leave it out to allow legitimate repeats (e.g. two
  comments by the same user on one post).
* **Never raises.** A failed activity write must not cancel the user action
  that produced it, so every failure is logged and swallowed.

Layering: this module imports nothing from `notifications`, `analytics` or any
route — activity is a layer of its own, and a layer never writes in another.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo import ReturnDocument

logger = logging.getLogger("punto-cero-api.activities")

#: Bumped only when the persisted shape changes incompatibly.
CONTRACT_VERSION = 1

#: ~5 actions/user/day → millions of rows/year. Ranking only needs recent
#: history; feed_engine already looks back 30/90 days.
DEFAULT_RETENTION_DAYS = 180

# --- Closed vocabularies (contract §2.2) ----------------------------------
# Extending these IS the versioning step. Free strings are a bug, not a
# feature: an unknown kind silently stops being deliverable.
ACTIVITY_KINDS = frozenset({
    "post.created", "post.commented", "post.mentioned", "post.reacted",
    "post.shared", "post.saved",
    "group.joined", "group.left", "group.post_created",
    "user.followed", "user.unfollowed",
    "job.applied",
    "event.rsvped",
    "message.sent",
    "user.profile_updated",
})

SUBJECT_TYPES = frozenset({
    "user", "post", "comment", "group", "group_post",
    "company", "job", "event", "conversation",
})

AUDIENCE_TYPES = frozenset({
    "user", "group", "company", "followers", "public",
})

VISIBILITIES = frozenset({"public", "members", "followers", "private"})

#: Audience types that describe a broadcast rather than a single subject.
BROADCAST_AUDIENCES = frozenset({"public", "followers"})

__all__ = [
    "CONTRACT_VERSION", "DEFAULT_RETENTION_DAYS",
    "ACTIVITY_KINDS", "SUBJECT_TYPES", "AUDIENCE_TYPES", "VISIBILITIES",
    "ActivityValidationError", "validate_activity", "build_activity", "record",
]


class ActivityValidationError(ValueError):
    """Raised by the pure builders when a fact is malformed.

    Never escapes ``record()`` — that is a development error surfaced in tests
    and logs, never an HTTP 500 for the user.
    """


def _now() -> str:
    """ISO-8601 UTC, identical to `services.notifications._now()`.

    Duplicated on purpose: activity must not import from the notification
    layer, and both must stay byte-identical in format.
    """
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return f"act_{uuid.uuid4().hex[:12]}"


def _require(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ActivityValidationError(f"{field} es obligatorio y debe ser texto no vacío")
    return value.strip()


def validate_activity(
    *,
    kind: str,
    actor_id: str,
    subject_type: str,
    subject_id: str,
    audience: dict,
    visibility: str,
    metadata: Optional[dict] = None,
) -> None:
    """Raise `ActivityValidationError` if the fact is malformed.

    Pure and DB-free so the contract can be unit-tested exhaustively without
    a database.
    """
    kind = _require(kind, "kind")
    if kind not in ACTIVITY_KINDS:
        raise ActivityValidationError(
            f"kind desconocido: {kind!r}. Añádelo a ACTIVITY_KINDS (vocabulario cerrado).")

    _require(actor_id, "actor_id")

    subject_type = _require(subject_type, "subject_type")
    if subject_type not in SUBJECT_TYPES:
        raise ActivityValidationError(
            f"subject_type desconocido: {subject_type!r}. "
            f"Válidos: {sorted(SUBJECT_TYPES)}")

    _require(subject_id, "subject_id")

    if not isinstance(audience, dict):
        raise ActivityValidationError("audience debe ser un dict {type, id}")
    atype = audience.get("type")
    if atype not in AUDIENCE_TYPES:
        raise ActivityValidationError(
            f"audience.type desconocido: {atype!r}. "
            f"Válidos: {sorted(AUDIENCE_TYPES)}")
    # A broadcast ("public"/"followers") has no single subject to point at.
    if atype not in BROADCAST_AUDIENCES and not audience.get("id"):
        raise ActivityValidationError(
            f"audience.id es obligatorio para audience.type={atype!r}")

    if visibility not in VISIBILITIES:
        raise ActivityValidationError(
            f"visibility desconocido: {visibility!r}. Válidos: {sorted(VISIBILITIES)}")

    if metadata is not None and not isinstance(metadata, dict):
        raise ActivityValidationError("metadata debe ser dict o None")

    # A fact addressed to everyone cannot be private, and a single-recipient
    # one that claims to be public would leak on a mis-scoped read.
    if atype == "public" and visibility != "public":
        raise ActivityValidationError(
            "audience.type='public' exige visibility='public'")
    if atype == "user" and visibility == "public":
        raise ActivityValidationError(
            "audience.type='user' no puede ser visibility='public' "
            "(filtraría hacia otros lectores)")


def build_activity(
    *,
    kind: str,
    actor_id: str,
    subject_type: str,
    subject_id: str,
    audience: dict,
    visibility: str,
    metadata: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
    now: Optional[str] = None,
) -> dict:
    """Validate and build the document. Pure — no DB access.

    ``idempotency_key`` (optional) becomes ``activity_key`` verbatim, so a
    retried request writes once. Without it the key is unique per record and
    repeated actions are recorded as the distinct facts they are.
    """
    validate_activity(
        kind=kind, actor_id=actor_id, subject_type=subject_type,
        subject_id=subject_id, audience=audience, visibility=visibility,
        metadata=metadata,
    )

    if not isinstance(retention_days, int) or retention_days <= 0:
        raise ActivityValidationError("retention_days debe ser un entero > 0")

    created = now or _now()
    # TTL needs a BSON Date; created_at stays a string for consistency.
    expires = datetime.now(timezone.utc) + timedelta(days=retention_days)

    return {
        "id": _uid(),
        "activity_key": idempotency_key or _uid(),
        "actor_id": actor_id.strip(),
        "kind": kind.strip(),
        "subject_type": subject_type.strip(),
        "subject_id": subject_id.strip(),
        "audience": {"type": audience["type"], "id": audience.get("id")},
        "visibility": visibility,
        "metadata": dict(metadata or {}),
        "created_at": created,
        "expires_at": expires,
    }


async def record(
    db,
    *,
    kind: str,
    actor_id: str,
    subject_type: str,
    subject_id: str,
    audience: dict,
    visibility: str,
    metadata: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> Optional[dict]:
    """Record one immutable social fact. **Never raises.**

    Returns the stored document, or ``None`` if the fact was rejected or the
    write failed — the caller (a route, later) must not care which, because
    the user action that produced the fact has already been committed.

    With ``idempotency_key`` the write is an upsert on that key, so a retry
    cannot create a second row. Without it, every call is a new fact.
    """
    try:
        doc = build_activity(
            kind=kind, actor_id=actor_id, subject_type=subject_type,
            subject_id=subject_id, audience=audience, visibility=visibility,
            metadata=metadata, idempotency_key=idempotency_key,
            retention_days=retention_days,
        )

        if idempotency_key:
            # ReturnDocument.AFTER is required: with $setOnInsert and the
            # default BEFORE, a fresh upsert returns None.
            stored = await db.activities.find_one_and_update(
                {"activity_key": idempotency_key},
                {"$setOnInsert": doc},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            if stored is not None:
                stored.pop("_id", None)
            return stored

        await db.activities.insert_one(doc)
        return doc

    except ActivityValidationError as exc:
        logger.warning("actividad rechazada (%s): %s", kind, exc)
        return None
    except Exception:
        # Analytics-equivalent: telemetry must never take down the main path.
        logger.exception("no se pudo registrar la actividad kind=%s", kind)
        return None


