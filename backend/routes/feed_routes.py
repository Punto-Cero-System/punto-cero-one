"""Community Feed API. Prefix: /api/feed

Everything a LinkedIn-style feed needs: create post, list feed (cursor
pagination), single post, comments, reactions (toggleable), shares (with
optional external destination), saves, view tracking, hashtags parsing,
trending window (7d rolling), moderation (admin hide/remove/report).

Auth model
----------
- Community cookie session (see routes/community_auth_routes.py) authorizes
  all user actions.
- Admins (JWT) additionally get moderation endpoints.
- Public reads of `visibility=public` posts do NOT require auth — anonymous
  visitors can still browse the feed.
"""
from __future__ import annotations

import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Header, Query, Depends
from pydantic import BaseModel

from auth import require_admin
from services.notifications import dispatch as dispatch_notif
from services.feed_engine import build_for_you_feed
from models_feed import (
    PostCreate, PostPublic, PostAuthorMini, PostListResponse,
    CommentCreate, CommentPublic, CommentListResponse,
    ReactionInput, ReactionKind, TrendingResponse, HashtagStat,
    PostModerationUpdate, ReportCreate,
    HASHTAG_REGEX, new_post_id, new_comment_id, new_reaction_id,
    new_save_id, new_share_id, new_view_id,
)


logger = logging.getLogger("punto-cero-api.feed")

router = APIRouter(prefix="/api/feed", tags=["feed"])


# ---------------------------------------------------------------------------
# Auth helpers (reuse community_auth cookie flow)
# ---------------------------------------------------------------------------
async def _current_user_or_none(
    request: Request,
    session_token: Optional[str],
    authorization: Optional[str],
) -> Optional[dict]:
    token = None
    if session_token:
        token = session_token
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(None, 1)[1].strip() or None
    if not token:
        return None
    db = request.app.state.db
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    try:
        exp = session.get("expires_at")
        expires = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return None
    except Exception:
        return None
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    return user


async def _require_current_user(
    request: Request,
    session_token: Optional[str],
    authorization: Optional[str],
) -> dict:
    user = await _current_user_or_none(request, session_token, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Debes iniciar sesión")
    return user


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_hashtags(body: str) -> list[str]:
    tags = re.findall(HASHTAG_REGEX, body or "")
    # normalize to lowercase, dedupe, cap 15
    seen = []
    for t in tags:
        low = t.lower()
        if low not in seen:
            seen.append(low)
        if len(seen) >= 15:
            break
    return seen


# Matches @user_<12 hex chars> — the canonical mention token emitted by the
# frontend composer. Kept intentionally strict: free-form @name is ambiguous
# and would cause false-positive notifications.
_MENTION_RE = re.compile(r"@(user_[a-f0-9]{12})")


def _extract_mentions(body: str) -> list[str]:
    if not body:
        return []
    seen: list[str] = []
    for m in _MENTION_RE.findall(body):
        if m not in seen:
            seen.append(m)
        if len(seen) >= 20:
            break
    return seen


async def _dispatch_mentions(db, *, body: str, actor: dict, subject_id: str,
                             subject_type: str = "post", subject_url: Optional[str] = None) -> None:
    """Notify every unique user_id referenced with @user_xxxxxxxxxxxx.
    Silently skips the actor themselves and non-existent users.
    """
    mentions = _extract_mentions(body)
    if not mentions:
        return
    async for u in db.users.find(
        {"id": {"$in": mentions}}, {"_id": 0, "id": 1, "name": 1}
    ):
        if u["id"] == actor.get("id"):
            continue
        try:
            await dispatch_notif(
                db, recipient_id=u["id"], kind="mention",
                title=f"{actor.get('name') or 'Alguien'} te mencionó",
                body=body[:140] if body else None,
                actor=actor,
                subject_type=subject_type, subject_id=subject_id,
                subject_url=subject_url or f"/?post={subject_id}",
                vertical="community",
            )
        except Exception:
            continue


def _author_mini(user: dict) -> PostAuthorMini:
    return PostAuthorMini(
        id=user["id"],
        name=user.get("name") or user.get("email", "Miembro"),
        picture=user.get("picture"),
        headline=user.get("headline"),
    )


async def _serialize_post(db, post: dict, viewer: Optional[dict]) -> PostPublic:
    author = await db.users.find_one({"id": post["author_id"]}, {"_id": 0, "password_hash": 0}) or {
        "id": post["author_id"], "name": "Miembro", "email": ""
    }
    counts = post.get("counts") or {}
    # reactions_by_kind is stored inline for speed
    reactions_by_kind = post.get("reactions_by_kind") or {}
    my_reaction = None
    my_saved = False
    if viewer:
        rct = await db.post_reactions.find_one(
            {"post_id": post["id"], "user_id": viewer["id"]},
            {"_id": 0, "kind": 1},
        )
        my_reaction = rct.get("kind") if rct else None
        sv = await db.post_saves.find_one({"post_id": post["id"], "user_id": viewer["id"]}, {"_id": 0})
        my_saved = bool(sv)
    return PostPublic(
        id=post["id"],
        author=_author_mini(author),
        body=post["body"],
        hashtags=post.get("hashtags") or [],
        category_key=post.get("category_key"),
        visibility=post.get("visibility", "public"),
        link_url=post.get("link_url"),
        counts={
            "reactions": int(counts.get("reactions", 0)),
            "comments": int(counts.get("comments", 0)),
            "shares": int(counts.get("shares", 0)),
            "saves": int(counts.get("saves", 0)),
            "views": int(counts.get("views", 0)),
        },
        reactions_by_kind=reactions_by_kind,
        my_reaction=my_reaction,
        my_saved=my_saved,
        status=post.get("status", "published"),
        created_at=post["created_at"],
        updated_at=post.get("updated_at", post["created_at"]),
    )


# ---------------------------------------------------------------------------
# FOR YOU FEED — personalized ranking
# ---------------------------------------------------------------------------
class ForYouReason(BaseModel):
    reasons: list[str] = []
    score: float = 0.0


class ForYouItem(PostPublic):
    for_you: ForYouReason = ForYouReason()


class ForYouResponse(BaseModel):
    items: list[ForYouItem]
    mode: str
    signals_summary: dict


@router.get("/for-you", response_model=ForYouResponse)
async def for_you_feed(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Personalized "Para Ti" feed — ranked by follow/category/interaction/recency/trending providers.

    For anonymous users this endpoint gracefully degrades to the chronological latest posts
    (same as /api/feed/posts) so the frontend can call it unconditionally.
    """
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    ranked, mode = await build_for_you_feed(db, viewer, limit=limit)
    items: list[ForYouItem] = []
    for it in ranked:
        base = await _serialize_post(db, it.post, viewer)
        items.append(ForYouItem(**base.model_dump(),
                                for_you=ForYouReason(reasons=it.reasons, score=it.score)))
    signals_summary = {}
    if viewer:
        # Give the client (and QA) a tiny summary of what powered the ranking.
        from services.feed_engine.engine import load_user_signals
        s = await load_user_signals(db, viewer)
        signals_summary = {
            "verticals": sorted(list(s.verticals)),
            "followed_companies": len(s.followed_company_ids),
            "interaction_authors": len(s.interaction_author_ids),
            "interaction_hashtags": sorted(list(s.interaction_hashtags))[:12],
        }
    return ForYouResponse(items=items, mode=mode.value, signals_summary=signals_summary)


# ---------------------------------------------------------------------------
# POSTS — create / list / get / update / delete
# ---------------------------------------------------------------------------
@router.post("/posts", response_model=PostPublic)
async def create_post(
    payload: PostCreate,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _require_current_user(request, session_token, authorization)
    db = request.app.state.db
    body = payload.body.strip()
    hashtags = _extract_hashtags(body)
    now = _now()
    doc = {
        "id": new_post_id(),
        "author_id": user["id"],
        "body": body,
        "hashtags": hashtags,
        "category_key": payload.category_key,
        "visibility": payload.visibility,
        "link_url": payload.link_url,
        "counts": {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0},
        "reactions_by_kind": {},
        "status": "published",
        "created_at": now,
        "updated_at": now,
    }
    await db.posts.insert_one(doc)
    # update hashtag counts (fire-and-forget: not critical)
    for tag in hashtags:
        await db.hashtags.update_one(
            {"tag": tag},
            {"$inc": {"posts_total": 1}, "$set": {"last_used": now}},
            upsert=True,
        )
    # Fan-out @mentions
    await _dispatch_mentions(
        db, body=body,
        actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
        subject_id=doc["id"], subject_type="post",
    )
    return await _serialize_post(db, doc, user)


@router.get("/posts", response_model=PostListResponse)
async def list_posts(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: Optional[str] = Query(default=None, description="ISO timestamp of the last item"),
    category_key: Optional[str] = Query(default=None),
    hashtag: Optional[str] = Query(default=None),
    author_id: Optional[str] = Query(default=None),
    saved_by_me: bool = Query(default=False),
    include_hidden: bool = Query(default=False),
):
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db

    query: dict = {}
    if not include_hidden or not (viewer and viewer.get("role") == "admin"):
        query["status"] = "published"
    if category_key:
        query["category_key"] = category_key
    if hashtag:
        query["hashtags"] = hashtag.lower().lstrip("#")
    if author_id:
        query["author_id"] = author_id
    if saved_by_me:
        if not viewer:
            raise HTTPException(status_code=401, detail="Debes iniciar sesión para ver tus guardados")
        saved_cursor = db.post_saves.find({"user_id": viewer["id"]}, {"_id": 0, "post_id": 1})
        saved_ids = [s["post_id"] async for s in saved_cursor]
        query["id"] = {"$in": saved_ids}
    if cursor:
        query["created_at"] = {"$lt": cursor}

    cursor_docs = db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit + 1)
    docs = [d async for d in cursor_docs]
    has_more = len(docs) > limit
    docs = docs[:limit]
    items = [await _serialize_post(db, d, viewer) for d in docs]
    next_cursor = docs[-1]["created_at"] if has_more and docs else None
    return PostListResponse(items=items, next_cursor=next_cursor)


@router.get("/posts/{post_id}", response_model=PostPublic)
async def get_post(
    post_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    doc = await db.posts.find_one({"id": post_id, "status": "published"}, {"_id": 0})
    if not doc:
        if viewer and viewer.get("role") == "admin":
            doc = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return await _serialize_post(db, doc, viewer)


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _require_current_user(request, session_token, authorization)
    db = request.app.state.db
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    if post["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No puedes borrar esta publicación")
    await db.posts.update_one({"id": post_id}, {"$set": {"status": "removed", "updated_at": _now()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# COMMENTS
# ---------------------------------------------------------------------------
@router.post("/posts/{post_id}/comments", response_model=CommentPublic)
async def add_comment(
    post_id: str,
    payload: CommentCreate,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _require_current_user(request, session_token, authorization)
    db = request.app.state.db
    post = await db.posts.find_one({"id": post_id, "status": "published"}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    doc = {
        "id": new_comment_id(),
        "post_id": post_id,
        "author_id": user["id"],
        "body": payload.body.strip(),
        "created_at": _now(),
    }
    await db.post_comments.insert_one(doc)
    await db.posts.update_one({"id": post_id}, {"$inc": {"counts.comments": 1}})
    # Notify author
    post_doc = await db.posts.find_one({"id": post_id}, {"_id": 0, "author_id": 1})
    if post_doc and post_doc.get("author_id") != user["id"]:
        await dispatch_notif(
            db, recipient_id=post_doc["author_id"], kind="comment",
            title=f"{user.get('name','Alguien')} comentó tu publicación",
            body=payload.body[:120],
            actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
            subject_type="post", subject_id=post_id, subject_url=f"/?post={post_id}",
        )
    # Fan-out @mentions inside the comment body
    await _dispatch_mentions(
        db, body=payload.body,
        actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
        subject_id=post_id, subject_type="post",
    )
    return CommentPublic(
        id=doc["id"], post_id=post_id, body=doc["body"],
        author=_author_mini(user), created_at=doc["created_at"],
    )


@router.get("/posts/{post_id}/comments", response_model=CommentListResponse)
async def list_comments(
    post_id: str,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
):
    db = request.app.state.db
    cursor = db.post_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).limit(limit)
    docs = [d async for d in cursor]
    items = []
    for d in docs:
        author = await db.users.find_one({"id": d["author_id"]}, {"_id": 0, "password_hash": 0}) or {
            "id": d["author_id"], "name": "Miembro", "email": ""
        }
        items.append(CommentPublic(
            id=d["id"], post_id=d["post_id"], body=d["body"],
            author=_author_mini(author), created_at=d["created_at"],
        ))
    return CommentListResponse(items=items, total=len(items))


# ---------------------------------------------------------------------------
# REACTIONS
# ---------------------------------------------------------------------------
@router.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    payload: ReactionInput,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Toggleable: sending the same kind again removes it; sending a different
    kind switches it (atomically updates counters and per-kind buckets)."""
    user = await _require_current_user(request, session_token, authorization)
    db = request.app.state.db
    post = await db.posts.find_one({"id": post_id, "status": "published"}, {"_id": 0, "reactions_by_kind": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")

    existing = await db.post_reactions.find_one({"post_id": post_id, "user_id": user["id"]}, {"_id": 0})
    now = _now()
    if existing:
        old_kind = existing.get("kind")
        if old_kind == payload.kind:
            # toggle off
            await db.post_reactions.delete_one({"post_id": post_id, "user_id": user["id"]})
            await db.posts.update_one(
                {"id": post_id},
                {"$inc": {"counts.reactions": -1, f"reactions_by_kind.{old_kind}": -1}},
            )
            return {"reacted": False}
        # switch kind
        await db.post_reactions.update_one(
            {"post_id": post_id, "user_id": user["id"]},
            {"$set": {"kind": payload.kind, "updated_at": now}},
        )
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {f"reactions_by_kind.{old_kind}": -1, f"reactions_by_kind.{payload.kind}": 1}},
        )
        return {"reacted": True, "kind": payload.kind}

    await db.post_reactions.insert_one({
        "id": new_reaction_id(),
        "post_id": post_id,
        "user_id": user["id"],
        "kind": payload.kind,
        "created_at": now,
        "updated_at": now,
    })
    await db.posts.update_one(
        {"id": post_id},
        {"$inc": {"counts.reactions": 1, f"reactions_by_kind.{payload.kind}": 1}},
    )
    # Notify the post's author (except on self-reactions)
    post_doc = await db.posts.find_one({"id": post_id}, {"_id": 0, "author_id": 1, "body": 1})
    if post_doc and post_doc.get("author_id") != user["id"]:
        await dispatch_notif(
            db, recipient_id=post_doc["author_id"], kind="reaction",
            title=f"{user.get('name','Alguien')} reaccionó con {payload.kind}",
            body=(post_doc.get("body") or "")[:120],
            actor={"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
            subject_type="post", subject_id=post_id, subject_url=f"/?post={post_id}",
        )
    return {"reacted": True, "kind": payload.kind}


# ---------------------------------------------------------------------------
# SAVE / SHARE / VIEW
# ---------------------------------------------------------------------------
@router.post("/posts/{post_id}/save")
async def save_post(
    post_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    user = await _require_current_user(request, session_token, authorization)
    db = request.app.state.db
    existing = await db.post_saves.find_one({"post_id": post_id, "user_id": user["id"]}, {"_id": 0})
    if existing:
        await db.post_saves.delete_one({"post_id": post_id, "user_id": user["id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"counts.saves": -1}})
        return {"saved": False}
    await db.post_saves.insert_one({
        "id": new_save_id(),
        "post_id": post_id,
        "user_id": user["id"],
        "created_at": _now(),
    })
    await db.posts.update_one({"id": post_id}, {"$inc": {"counts.saves": 1}})
    return {"saved": True}


class ShareInput(BaseModel):
    destination: Optional[str] = None  # e.g. "whatsapp", "twitter", "linkedin"


@router.post("/posts/{post_id}/share")
async def share_post(
    post_id: str,
    payload: ShareInput,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Records an intent to share. Anonymous OK — we still bump the counter."""
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    post = await db.posts.find_one({"id": post_id, "status": "published"}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    await db.post_shares.insert_one({
        "id": new_share_id(),
        "post_id": post_id,
        "user_id": viewer["id"] if viewer else None,
        "destination": payload.destination,
        "created_at": _now(),
    })
    await db.posts.update_one({"id": post_id}, {"$inc": {"counts.shares": 1}})
    # Notify the original author when a member (not anon) shares the post.
    if viewer:
        author_doc = await db.posts.find_one({"id": post_id}, {"_id": 0, "author_id": 1})
        if author_doc and author_doc.get("author_id") and author_doc["author_id"] != viewer["id"]:
            await dispatch_notif(
                db, recipient_id=author_doc["author_id"], kind="reaction",  # share is a lightweight positive signal
                title=f"{viewer.get('name','Alguien')} compartió tu publicación",
                actor={"id": viewer["id"], "name": viewer.get("name"), "picture": viewer.get("picture")},
                subject_type="post", subject_id=post_id, subject_url=f"/?post={post_id}",
                vertical="community",
            )
    return {"ok": True}


class ViewInput(BaseModel):
    session_id: str


@router.post("/posts/{post_id}/view")
async def register_view(
    post_id: str,
    payload: ViewInput,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Deduped view counter — one per (post_id, session_id).  Anonymous OK.
    Race-safe: relies on the unique index and swallows DuplicateKeyError."""
    from pymongo.errors import DuplicateKeyError
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    try:
        await db.post_views.insert_one({
            "id": new_view_id(),
            "post_id": post_id,
            "session_id": payload.session_id,
            "user_id": viewer["id"] if viewer else None,
            "created_at": _now(),
        })
    except DuplicateKeyError:
        return {"counted": False}
    await db.posts.update_one({"id": post_id}, {"$inc": {"counts.views": 1}})
    return {"counted": True}


# ---------------------------------------------------------------------------
# TRENDING
# ---------------------------------------------------------------------------
@router.get("/trending", response_model=TrendingResponse)
async def trending(request: Request, limit: int = Query(default=8, ge=1, le=30)):
    """Top hashtags in the last 7 days by post count.

    Uses an aggregation on the `posts` collection — cheap since we index
    `hashtags` and `created_at`.
    """
    db = request.app.state.db
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"status": "published", "created_at": {"$gte": since}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": "$hashtags", "posts_7d": {"$sum": 1}}},
        {"$sort": {"posts_7d": -1}},
        {"$limit": limit},
    ]
    items: list[HashtagStat] = []
    async for row in db.posts.aggregate(pipeline):
        tag = row["_id"]
        totals = await db.hashtags.find_one({"tag": tag}, {"_id": 0, "posts_total": 1})
        items.append(HashtagStat(
            tag=tag,
            posts_7d=int(row["posts_7d"]),
            posts_total=int((totals or {}).get("posts_total", row["posts_7d"])),
        ))
    return TrendingResponse(hashtags=items)


# ---------------------------------------------------------------------------
# MODERATION
# ---------------------------------------------------------------------------
@router.patch("/posts/{post_id}/moderation")
async def moderate_post(
    post_id: str,
    payload: PostModerationUpdate,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    result = await db.posts.update_one(
        {"id": post_id},
        {"$set": {"status": payload.status, "updated_at": _now(), "moderated_by": admin["id"]}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return {"ok": True, "status": payload.status}


@router.post("/posts/{post_id}/report")
async def report_post(
    post_id: str,
    payload: ReportCreate,
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    await db.post_reports.insert_one({
        "post_id": post_id,
        "reporter_id": viewer["id"] if viewer else None,
        "reason": payload.reason,
        "created_at": _now(),
        "resolved": False,
    })
    return {"ok": True}


@router.get("/reports")
async def list_reports(
    request: Request,
    admin: dict = Depends(require_admin),
    resolved: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
):
    db = request.app.state.db
    cursor = db.post_reports.find({"resolved": resolved}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return [r async for r in cursor]
