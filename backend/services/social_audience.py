"""
Social audience resolver — OMEGA FASE A / F0.9.6.

Resolves *who a social fact concerns* by unioning the relationships a viewer
can have with a group:

    group_members            → membership (participa)
    follows(entity_type=…)   → interest (sigue, sin pertenecer)

WHY THIS EXISTS
---------------
When groups become followable, a user who is **both a member and a follower**
would be notified twice for the same post if the fan-out walked the two
collections separately. The fix is not a dedupe index on `notifications`; it
is resolving the audience **once**, as a union, before anything is delivered.

That is why the module exists separately from `notification_fanout`: audience
resolution (who should hear about this) is a different question from delivery
(how do we write their inbox without N round-trips).

PRIVACY IS ENFORCED HERE, NOT BY THE CALLER
--------------------------------------------
For a **private** group only members may be reached. A follower who never
managed to join has no standing to learn what is posted inside, so they are
dropped from the audience. For a **public** group, followers are included.

STATUS: PREPARED BUT NOT WIRED
------------------------------
`entity_type="group"` is **not yet valid** in `follows` (that is F1 and is
explicitly out of this phase), so the `follows` query returns nothing today and
the audience is members-only. Nothing is wrong: the resolver is built and
tested now so that enabling group follows cannot reintroduce the double
notification. This module does **not** modify `follows_routes.VALID_TYPES`.

Layering: reads relations only. Creates no model, writes no collection.
"""
from __future__ import annotations

from typing import Optional

from services.group_permissions import group_privacy, PUBLIC

__all__ = ["resolve_group_audience"]


async def _members(db, group_id: str, exclude_user_id: Optional[str]):
    seen: set[str] = set()
    ordered: list[str] = []
    async for m in db.group_members.find(
        {"group_id": group_id}, {"_id": 0, "user_id": 1}
    ):
        uid = m.get("user_id")
        if not uid or uid == exclude_user_id or uid in seen:
            continue
        seen.add(uid)
        ordered.append(uid)
    return ordered


async def _group_followers(db, group_id: str, exclude_user_id: Optional[str]):
    """Followers of the group.

    Returns empty until `entity_type="group"` is admitted by `follows`
    (F1). The projection is intentionally narrow: only `user_id` is read.
    """
    seen: set[str] = set()
    ordered: list[str] = []
    async for f in db.follows.find(
        {"entity_type": "group", "entity_id": group_id},
        {"_id": 0, "user_id": 1},
    ):
        uid = f.get("user_id")
        if not uid or uid == exclude_user_id or uid in seen:
            continue
        seen.add(uid)
        ordered.append(uid)
    return ordered


async def resolve_group_audience(
    db,
    group_id: str,
    *,
    exclude_user_id: Optional[str] = None,
    group: Optional[dict] = None,
) -> dict:
    """Who should be told about a fact that happened inside `group_id`.

    Returns::

        {"user_ids": [...], "members": int, "followers": int,
         "followers_excluded": int, "duplicates_merged": int,
         "actor_excluded": bool, "privacy": str}

    Guarantees:
      * every user appears **once** (membership and interest are unioned)
      * the actor never receives their own notification
      * a private group never reaches non-members, however they are connected
    """
    if group is None:
        group = await db.groups.find_one({"id": group_id}, {"_id": 0}) or {}
    privacy = group_privacy(group)

    members = await _members(db, group_id, exclude_user_id)
    followers = await _group_followers(db, group_id, exclude_user_id)

    # Union, membership first so the ordering is stable across calls.
    user_ids = list(members)
    seen = set(members)
    duplicates = 0
    followers_excluded = 0
    for uid in followers:
        if uid in seen:
            # The member+follower case this module exists to prevent.
            duplicates += 1
            continue
        # A follower who is not a member has no access to a private group.
        if privacy != PUBLIC:
            followers_excluded += 1
            continue
        seen.add(uid)
        user_ids.append(uid)

    return {
        "user_ids": user_ids,
        "members": len(members),
        "followers": len(followers),
        "duplicates_merged": duplicates,
        "followers_excluded": followers_excluded,
        "actor_excluded": exclude_user_id is not None,
        "privacy": privacy,
    }
