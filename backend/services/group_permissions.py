"""Group permissions — centralized read-authorization for professional groups.

OMEGA F0.8. Implements the access rules defined in `GROUP_PRIVACY_FIX_PLAN.md`:

    privacy="public"  → visible to everyone, including anonymous visitors
    privacy="private" → members, group admins and platform admins only
    legacy (no field) → treated as public

`evaluate_access` returns one of:

    "public" → no restriction applies
    "member" → private, and the viewer is a member
    "admin"  → private, and the viewer administers the group or the platform
    "denied" → private, and the viewer has no relationship with the group

WHY A SEPARATE MODULE
---------------------
`groups_routes.py` had four read endpoints with no privacy filter at all:
`privacy` was persisted and echoed in the API payload, but never used as a
condition. Keeping the rule here means it cannot drift between endpoints.

TWO SOURCES OF TRUTH FOR "ADMIN"
--------------------------------
`groups.admin_id` (single owner) and `group_members.role == "admin"` both mark
an administrator, and they can diverge after a future ownership transfer.
Both are consulted on purpose.

This module authorizes READS only. It never writes, and it deliberately does
not handle memberships, invitations or moderation.
"""
from __future__ import annotations

from typing import Optional

PUBLIC = "public"
MEMBER = "member"
ADMIN = "admin"
DENIED = "denied"

__all__ = ["PUBLIC", "MEMBER", "ADMIN", "DENIED", "group_privacy",
           "evaluate_access", "load_visible_group", "visible_filter"]


def group_privacy(group: Optional[dict]) -> str:
    """Normalise `privacy`. Groups predating the field are public.

    A missing field and an explicit ``null`` both mean "public": the flag was
    introduced after the first groups existed, and every group created before
    it was, by definition, publicly readable.
    """
    return "private" if (group or {}).get("privacy") == "private" else PUBLIC


def _is_platform_admin(user: Optional[dict]) -> bool:
    return bool(user) and user.get("role") == "admin"


async def _membership(db, group_id: str, user_id: Optional[str]) -> Optional[dict]:
    if not user_id:
        return None
    return await db.group_members.find_one(
        {"group_id": group_id, "user_id": user_id}, {"_id": 0, "role": 1}
    )


def _access_from(group: dict, membership: Optional[dict], user: Optional[dict]) -> str:
    if group_privacy(group) == PUBLIC:
        return PUBLIC
    if not user:
        return DENIED
    if _is_platform_admin(user):
        return ADMIN
    if group.get("admin_id") and group["admin_id"] == user.get("id"):
        return ADMIN
    if membership is None:
        return DENIED
    return ADMIN if membership.get("role") == "admin" else MEMBER


async def evaluate_access(db, group: dict, user: Optional[dict]) -> str:
    """Access level of `user` over an already-loaded `group`."""
    membership = await _membership(db, group["id"], (user or {}).get("id"))
    return _access_from(group, membership, user)


async def load_visible_group(db, group_id: str, user: Optional[dict]):
    """Load a group and evaluate the caller's access in one membership query.

    Returns ``(group, info)`` where ``info`` carries ``access`` and
    ``is_member``. ``group`` is ``None`` when it does not exist — the caller
    answers 404, never 403, so existence is not confirmed to a stranger.
    """
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if group is None:
        return None, None

    membership = await _membership(db, group_id, (user or {}).get("id"))
    access = _access_from(group, membership, user)
    return group, {"access": access, "is_member": membership is not None}


async def visible_filter(db, viewer_id: Optional[str]):
    """Filter for ``GET /api/groups``, plus the viewer's member group ids.

    Returns ``(query, member_ids)``. Anonymous callers see public groups only.
    Authenticated callers additionally see the private groups they own or
    belong to. ``member_ids`` is returned so the caller can mark ``is_member``
    without a second round-trip.
    """
    public_clause = {"privacy": {"$in": ["public", None]}}

    if not viewer_id:
        return public_clause, set()

    member_ids = {
        m["group_id"]
        async for m in db.group_members.find(
            {"user_id": viewer_id}, {"_id": 0, "group_id": 1}
        )
    }
    query = {
        "$or": [
            public_clause,
            {"admin_id": viewer_id},
            {"id": {"$in": sorted(member_ids)}},
        ]
    }
    return query, member_ids