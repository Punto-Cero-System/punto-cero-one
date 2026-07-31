"""Feed models — posts, comments, reactions, saves, shares, views, hashtags.

Kept intentionally lean: every model matches the on-the-wire JSON so we can
serialize/deserialize with one call. `id` always uses UUIDv4 hex prefixes for
easy grep-ability across logs (post_, cmt_, rct_, sav_, shr_, vw_, hsh_).
"""
from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
import uuid


ReactionKind = Literal["like", "insight", "celebrate", "support", "curious"]
PostVisibility = Literal["public", "members", "unlisted"]
PostStatus = Literal["published", "hidden", "removed"]


def _uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Posts
# ---------------------------------------------------------------------------
class PostCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    body: str = Field(min_length=1, max_length=5000)
    category_key: Optional[str] = Field(default=None, max_length=60)
    visibility: PostVisibility = "public"
    link_url: Optional[str] = Field(default=None, max_length=500)


class PostAuthorMini(BaseModel):
    id: str
    name: str
    picture: Optional[str] = None
    headline: Optional[str] = None


class PostPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    author: PostAuthorMini
    body: str
    hashtags: list[str] = []
    category_key: Optional[str] = None
    visibility: PostVisibility
    link_url: Optional[str] = None
    counts: dict = Field(default_factory=lambda: {
        "reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0,
    })
    reactions_by_kind: dict[str, int] = Field(default_factory=dict)
    my_reaction: Optional[ReactionKind] = None
    my_saved: bool = False
    status: PostStatus = "published"
    created_at: str
    updated_at: str


class PostListResponse(BaseModel):
    items: list[PostPublic]
    next_cursor: Optional[str] = None
    total: Optional[int] = None


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    body: str = Field(min_length=1, max_length=2000)


class CommentPublic(BaseModel):
    id: str
    post_id: str
    author: PostAuthorMini
    body: str
    created_at: str


class CommentListResponse(BaseModel):
    items: list[CommentPublic]
    total: int


# ---------------------------------------------------------------------------
# Reactions
# ---------------------------------------------------------------------------
class ReactionInput(BaseModel):
    kind: ReactionKind


# ---------------------------------------------------------------------------
# Hashtags / Trending
# ---------------------------------------------------------------------------
class HashtagStat(BaseModel):
    tag: str
    posts_7d: int
    posts_total: int


class TrendingResponse(BaseModel):
    hashtags: list[HashtagStat]
    generated_at: str = Field(default_factory=_now_iso)


# ---------------------------------------------------------------------------
# Moderation
# ---------------------------------------------------------------------------
class PostModerationUpdate(BaseModel):
    status: PostStatus


class ReportCreate(BaseModel):
    reason: str = Field(min_length=2, max_length=400)


# ---------------------------------------------------------------------------
# Helpers used by the routes
# ---------------------------------------------------------------------------
def new_post_id() -> str: return _uid("post")
def new_comment_id() -> str: return _uid("cmt")
def new_reaction_id() -> str: return _uid("rct")
def new_save_id() -> str: return _uid("sav")
def new_share_id() -> str: return _uid("shr")
def new_view_id() -> str: return _uid("vw")


HASHTAG_REGEX = r"(?<!\w)#([a-zA-Z0-9_ñáéíóúü]{2,40})"
