"""Notifications core service — shared across all Punto Cero verticals.

Every mutation-like event in the platform funnels through `dispatch()`.
Consumers (One, Legal, Health, Accounting…) read `/api/notifications/*`.

Schema
------
notifications:
  id, recipient_id, kind, title, body?, actor_id?, actor_name?, actor_picture?,
  subject_type, subject_id, subject_url?, image_url?,
  vertical, is_read, read_at?, created_at

notification_preferences (per-user):
  user_id, disabled_kinds:[], channels:{in_app,email,push,realtime}
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field


NotificationKind = Literal[
    "reaction",       # someone reacted to your post
    "comment",        # someone commented on your post / conversation
    "follower",       # someone followed you or your company
    "company_new",    # a new company was published (broadcast to admins/followers)
    "job_new",        # a new job matched your interests
    "event_new",      # a new event matched your interests
    "request",        # a new request awaits (investor, application, invite)
    "message",        # new chat message
    "mention",        # @mention in a post or comment
    "admin",          # system / admin notice
    "application",    # someone applied to your job
    "rsvp",           # someone RSVP'd to your event
]


class NotificationPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    recipient_id: str
    kind: NotificationKind
    title: str
    body: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_picture: Optional[str] = None
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    subject_url: Optional[str] = None
    image_url: Optional[str] = None
    vertical: Optional[str] = None
    is_read: bool = False
    read_at: Optional[str] = None
    created_at: str


class NotificationListResponse(BaseModel):
    items: list[NotificationPublic]
    unread: int
    next_cursor: Optional[str] = None


class NotificationPreferences(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    disabled_kinds: list[NotificationKind] = []
    channels: dict = Field(default_factory=lambda: {"in_app": True, "email": False, "push": False, "realtime": True})


def _uid(): return f"ntf_{uuid.uuid4().hex[:12]}"


def _now(): return datetime.now(timezone.utc).isoformat()


async def dispatch(
    db,
    *,
    recipient_id: str,
    kind: NotificationKind,
    title: str,
    body: Optional[str] = None,
    actor: Optional[dict] = None,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    subject_url: Optional[str] = None,
    image_url: Optional[str] = None,
    vertical: Optional[str] = None,
) -> Optional[str]:
    """Fire-and-forget: writes the notification if the recipient hasn't
    silenced this kind. Never raises — analytics and notifications must never
    take down the main request path.
    """
    if not recipient_id or (actor and actor.get("id") == recipient_id):
        return None  # don't notify actor of their own action
    try:
        prefs = await db.notification_preferences.find_one({"user_id": recipient_id}, {"_id": 0})
        if prefs and kind in (prefs.get("disabled_kinds") or []):
            return None
        doc = {
            "id": _uid(),
            "recipient_id": recipient_id,
            "kind": kind,
            "title": title,
            "body": body,
            "actor_id": (actor or {}).get("id"),
            "actor_name": (actor or {}).get("name"),
            "actor_picture": (actor or {}).get("picture"),
            "subject_type": subject_type,
            "subject_id": subject_id,
            "subject_url": subject_url,
            "image_url": image_url,
            "vertical": vertical,
            "is_read": False,
            "created_at": _now(),
        }
        await db.notifications.insert_one(doc)
        return doc["id"]
    except Exception:
        return None
