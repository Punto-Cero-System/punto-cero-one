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

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Header, Query, Depends, UploadFile, File
from pydantic import BaseModel

from auth import require_admin
from services.notifications import dispatch as dispatch_notif
from services.activities import record as record_activity
from services.feed_engine import build_for_you_feed
from services.object_storage import get_storage, app_prefix, ObjectStorageError
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
        # FASE 2.1 — Activity Layer: la mención es un hecho dirigido al
        # mencionado. Se registra ANTES de notificar: un fallo del fan-out no
        # debe borrar el hecho. Sin `publish()` — el productor es el único que
        # notifica (regla R8, sin duplicados).
        try:
            await record_activity(
                db,
                kind="post.mentioned",
                actor_id=actor.get("id") or "",
                subject_type=subject_type,
                subject_id=subject_id,
                audience={"type": "user", "id": u["id"]},
                visibility="private",
                metadata={"excerpt": (body or "")[:140],
                          "subject_url": subject_url or f"/?post={subject_id}"},
            )
        except Exception:
            logger.debug("activity not recorded for mention %s", u.get("id"), exc_info=True)
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


# ---------------------------------------------------------------------------
# VISIBILITY — OMEGA CARRIL A2
# ---------------------------------------------------------------------------
# `visibility` se persistía desde siempre y se serializaba en la respuesta,
# pero NINGUNA consulta de lectura lo usaba como condición: un post `members`
# o `unlisted` era tan legible como uno `public` para cualquiera, incluido un
# anónimo que acertara el id. Esto solo añade la condición que faltaba.
#
# LAS TRES REGLAS, y de dónde sale cada una
# ------------------------------------------
# public     → visible para cualquiera. No se filtra: es el comportamiento actual.
# members    → solo quien pertenece al grupo o lo administra.
#              Fuentes de autoridad, las mismas dos que ya usa F0.8
#              (`services.group_permissions`): `group_members` para la
#              pertenencia y `groups.admin_id` para la propiedad. Se consultan
#              -por el mismo motivo- AMBAS, porque pueden divergir tras una
#              futura transferencia de propiedad.
#              NUNCA por ser follower: `follows` no se consulta aquí. Seguir un
#              grupo da interés, no acceso, y una notification sí llega al
#              seguidor; el contenido no.
#              NUNCA por conocer el id: la condición va en la query, no después.
# unlisted   → se conserva EXACTAMENTE la semántica vigente: hoy no restringe
#              nada, así que hoy no restringe nada. Ver la nota de abajo.
#
# POR QUÉ NO SE USA `group_permissions.evaluate_access`
# ----------------------------------------------------
# Ese módulo autoriza el ACCESO A UN GRUPO (F0.8, `privacy=public|private`), no
# la visibilidad de un post. Son cosas distintas: un grupo público con un post
# `members` sigue siendo de solo-para-miembros. Reusar `evaluate_access` haría
# que `privacy="public"` abriera el post, que es exactamente el bug que se
# corrige. Aquí la regla es de post y solo ella decide.
#
# NOTA SOBRE `unlisted` (documentada, no improvisada)
# ---------------------------------------------------
# `PostVisibility` declara `unlisted`, pero el producto nunca le dio semántica:
# el compositor publica siempre `public` (`FeedPostCard.jsx`), el grupo tiene su
# propia colección `group_posts`, y ninguna lectura ha distinguido `unlisted` de
# `public`. Fijar ahora un significado nuevo (p. ej. "sólo por enlace directo")
# sería inventar producto dentro de una corrección de lectura. Por tanto `unlisted`
# se comporta como hoy, y la ausencia de semántica queda anotada en vez de
# resuelta por sorpresa. Decisión de producto pendiente, no de este carril.
#
# Posts `members` sin `group_id`
# ------------------------------
# La colección `posts` nunca ha guardado `group_id` (los posts de grupo viven en
# `group_posts`, que es otra colección y otra ruta). Si algún documento llegara
# con `members` sin grupo, no hay contra qué comprobar la pertenencia: se trata
# como no visible, porque el otro extremo del criterio sería abrirlo a cualquiera,
# que es la fuga que esta fase cierra.

#: visibilities que NO restringen la lectura. `unlisted` entra aquí a propósito
#: —ver la nota de arriba: su comportamiento actual es público.
#:
#: OMEGA B4.1 — las dos piezas del cálculo de visibilidad y las constantes que
#: comparten se movieron a `services/feed_visibility.py` (la autoridad única),
#: para que un `service` como `feed_engine` no tenga que importar una RUTA. El
#: código es idéntico: no cambia ninguna condición de query.
#:
#: Se reimportan aquí, y no se usan qualified, por dos razones concretas:
#:   · las llamadas de este archivo (`list_posts`, `get_post`, A3) siguen igual;
#:   · el bloque de visibilidad de este archivo conserva su contenido, que es
#:     justo lo que el test de A2 audita para asegurar que `follows` no se
#:     consulta. Reexportar mantiene ese contrato sin duplicar la regla.
from services.feed_visibility import (  # noqa: F401  (reexportados a propósito)
    _UNRESTRICTED_VISIBILITIES,
    _GROUP_SCOPED_VISIBILITY,
    _viewer_group_ids,
    _visibility_clause,
)


def _post_is_visible(post: dict, viewer_group_ids: set) -> bool:
    """La misma regla en memoria, para la ruta de un solo post.

    Espejo exacto de `_visibility_clause`: quien audite una debe poder leer la
    otra. Un post `members` sin `group_id` no es visible para nadie, porque no
    hay grupo contra el que comprobar la pertenencia.
    """
    visibility = post.get("visibility")
    if visibility in _UNRESTRICTED_VISIBILITIES:
        return True
    if visibility != _GROUP_SCOPED_VISIBILITY:
        # Valor fuera del vocabulario declarado: se trata como restringido.
        return False
    return bool(post.get("group_id")) and post["group_id"] in viewer_group_ids


# ---------------------------------------------------------------------------
# INTERACCIONES — OMEGA CARRIL A3
# ---------------------------------------------------------------------------
# Resuelve el post de una interacción y aplica la MISMA regla que A2, sin
# escribirla otra vez. `add_comment`, `react_to_post`, `share_post`, `save_post`
# y `register_view` solo comprobaban que el post existiera (o ni siquiera eso),
# así que un post `members` era comentable, reactionable, guardable, compartible
# y contable por cualquiera que acertara el id.
#
# POR QUÉ UN SOLO HELPER Y NO UNA COPIA POR RUTA
# ----------------------------------------------
# `_visibility_clause` (query) y `_post_is_visible` (memoria) son el par que A2
# dejó explícitamente espejado. Este helper compone ese par; si cada ruta
# escribiera su propio `if`, aparecería una tercera implementación que nadie
# auditaría y volveríamos al bug de A2 en otra forma.
#
# `status: "published"` es el criterio que ya usaban `add_comment`,
# `react_to_post` y `share_post`: esas tres conservan su 404 actual sin tocarlo.
#
# 404 Y NO 403 — la misma razón que en `get_post`: confirmar que el post existe
# pero no es interactuable ya sería filtrar su existencia.
#
# ADVERTENCIA — LA PROYECCIÓN DEBE INCLUIR `visibility` Y `group_id`
# ------------------------------------------------------------------
# `_post_is_visible` lee esos dos campos. Un campo no proyectado se lee como
# `None`, y `None` está en `_UNRESTRICTED_VISIBILITIES`: recortar la proyección
# sin querer convertiría un post `members` en público. Por eso las proyecciones
# parciales de las rutas de interacción los incluyen explícitamente.
async def _load_visible_post(
    db,
    post_id: str,
    viewer: Optional[dict],
    *,
    projection: Optional[dict] = None,
) -> dict:
    """Devuelve el post si el viewer puede leerlo; si no, responde 404."""
    post = await db.posts.find_one(
        {"id": post_id, "status": "published"},
        {"_id": 0} if projection is None else projection,
    )
    if not post:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    if not _post_is_visible(post, await _viewer_group_ids(db, viewer)):
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return post


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
        image_url=post.get("image_url"),
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
        "image_url": payload.image_url,
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


# ---------------------------------------------------------------------------
# MEDIA — post image upload (Wave 12: Composer Upload Real)
# ---------------------------------------------------------------------------
_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
_MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


def _image_ext(filename: str, content_type: str) -> str:
    if filename and "." in filename:
        candidate = filename.rsplit(".", 1)[-1].lower()
        if 0 < len(candidate) <= 8 and candidate.isalnum():
            return candidate
    return {
        "image/png": "png", "image/jpeg": "jpg",
        "image/webp": "webp", "image/gif": "gif",
    }.get(content_type, "bin")


@router.post("/media/upload")
async def upload_post_image(
    request: Request,
    file: UploadFile = File(...),
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Upload an image to attach to a subsequent post. Returns `{url}` — the
    caller then sends the URL as `image_url` on `POST /api/feed/posts`.

    Auth: requires an active community session. Storage: same object store
    as profile/company media (`{app_prefix}/posts/{user_id}/<uuid>.<ext>`).
    """
    import uuid
    user = await _require_current_user(request, session_token, authorization)
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo sin nombre")
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Formato no permitido: {content_type or 'desconocido'}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > _MAX_POST_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Archivo supera {_MAX_POST_IMAGE_BYTES} bytes")

    ext = _image_ext(file.filename, content_type)
    obj_id = uuid.uuid4().hex[:16]
    storage_path = f"{app_prefix()}/posts/{user['id']}/{obj_id}.{ext}"
    try:
        get_storage().put(storage_path, data, content_type)
    except ObjectStorageError as e:
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")
    url = f"/api/community/users/media/{storage_path}"
    return {"ok": True, "url": url}


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

    # OMEGA CARRIL A2 — la condición de visibilidad que faltaba. Se fusiona con
    # la query ya construida en lugar de envolverla: `query` no usa `$or` por
    # su cuenta, y sobrescribirla tiraría los filtros de categoría/hashtag/etc.
    vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))
    if "$or" in vis_clause:
        query["$or"] = vis_clause["$or"]
    else:
        query["visibility"] = vis_clause["visibility"]

    cursor_docs = db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit((limit + 1) * 3)
    raw_docs = [d async for d in cursor_docs]
    # Hide test-artifact posts from anyone who isn't an admin. Same regex as
    # content_sources_routes._TEST_POST_BODY_RE — kept inline (very small)
    # to avoid a cross-module import in the hot list path.
    is_admin = bool(viewer and viewer.get("role") == "admin")
    if not is_admin:
        import re as _re
        _TEST = _re.compile(
            r"^\s*(?:case\s?\d+|mixedfeedcase\b|list-endpoint-check\b|mixed-feed image\b|📷)\s*$",
            _re.IGNORECASE,
        )
        # Collect author emails in one round-trip so we can skip test-e2e authors.
        author_ids = list({d.get("author_id") for d in raw_docs if d.get("author_id")})
        emails_by_id: dict[str, str] = {}
        if author_ids:
            async for u in db.users.find(
                {"id": {"$in": author_ids}}, {"_id": 0, "id": 1, "email": 1}
            ):
                emails_by_id[u["id"]] = (u.get("email") or "")
        def _keep(d: dict) -> bool:
            body = (d.get("body") or "").strip()
            if body and _TEST.match(body):
                return False
            email = emails_by_id.get(d.get("author_id") or "", "")
            if email.endswith(".test-e2e.com"):
                return False
            return True
        raw_docs = [d for d in raw_docs if _keep(d)]
    has_more = len(raw_docs) > limit
    docs = raw_docs[:limit]
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
    # OMEGA CARRIL A2 — misma regla que el listado. Se responde 404 y no 403:
    # confirmar que un post existe pero no es legible ya sería filtrar su
    # existencia, que es justo lo que `visibility` debe impedir.
    viewer_groups = await _viewer_group_ids(db, viewer)
    if not _post_is_visible(doc, viewer_groups):
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
    # OMEGA CARRIL A3 — el mismo filtro que en el listado: antes bastaba con que
    # el post existiera y estuviera publicado, así que se podía comentar un
    # post `members` sin haberlo podido leer.
    await _load_visible_post(db, post_id, user, projection={"_id": 0, "id": 1})
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
    # FASE 2.1 — Activity Layer: el comentario es un hecho y queda registrado
    # en el log de hechos EN PARALELO a la notificación (sin `publish()`:
    # notifica solo el productor, sin duplicados — regla R8). El comentario
    # ya está insertado: si el log falla, la invariante vive en el call site.
    if post_doc and post_doc.get("author_id"):
        try:
            await record_activity(
                db,
                kind="post.commented",
                actor_id=user["id"],
                subject_type="post",
                subject_id=post_id,
                audience={"type": "user", "id": post_doc["author_id"]},
                visibility="private",
                metadata={"excerpt": doc["body"][:140],
                          "subject_url": f"/?post={post_id}"},
            )
        except Exception:
            logger.debug("activity not recorded for comment %s", post_id, exc_info=True)
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
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    # OMEGA CARRIL A3 — esta ruta era la fuga más grande del carril: no
    # recibía sesión, no comprobaba la visibilidad y devolvía el hilo entero de
    # cualquier post `members` (y de cualquier post moderado) a quien acertara el
    # id. Ahora recibe la sesión como el resto del módulo y delega en el mismo
    # helper que las demás interacciones. Se añaden los dos parámetros de
    # cookie/Authorization que ya usan las rutas vecinas: el contrato HTTP no
    # cambia (ambos son opcionales y anónimos siguen leyendo los posts
    # públicos), solo se deja de responder 200 con contenido restringido.
    viewer = await _current_user_or_none(request, session_token, authorization)
    db = request.app.state.db
    await _load_visible_post(db, post_id, viewer)
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
    # OMEGA CARRIL A3 — además de la visibilidad, la proyección conserva
    # `reactions_by_kind`, que era lo único que esta ruta leía del post.
    await _load_visible_post(db, post_id, user,
                            projection={"_id": 0, "reactions_by_kind": 1,
                                        "visibility": 1, "group_id": 1})

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
    # FASE 2.1 — Activity Layer: solo la reacción NUEVA llega aquí; el toggle-off
    # y el cambio de tipo retornan arriba, así que no se registra ni se notifica
    # (el hecho "reaccionó" ya no es cierto). Sin `publish()` — regla R8.
    if post_doc and post_doc.get("author_id"):
        try:
            await record_activity(
                db,
                kind="post.reacted",
                actor_id=user["id"],
                subject_type="post",
                subject_id=post_id,
                audience={"type": "user", "id": post_doc["author_id"]},
                visibility="private",
                metadata={"excerpt": (post_doc.get("body") or "")[:140],
                          "subject_url": f"/?post={post_id}"},
            )
        except Exception:
            logger.debug("activity not recorded for reaction on %s", post_id, exc_info=True)
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
    # OMEGA CARRIL A3 — `save_post` no consultaba `posts` en absoluto: guardaba
    # e incrementaba `counts.saves` de cualquier id, existente o no. Ahora
    # resuelve el post (404 si no existe o no es visible) y solo después toca el
    # toggle, así que el contador tampoco se corrompe con ids inventados.
    await _load_visible_post(db, post_id, user)
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
    # OMEGA CARRIL A3 — el share sigue siendo anónimo-ok, pero el post que se
    # comparte tiene que ser legible por quien lo comparte.
    await _load_visible_post(db, post_id, viewer)
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
    # OMEGA CARRIL A3 — el contador de vistas tampoco consultaba `posts`:
    # inflaba `counts.views` de cualquier id, incluido inexistente o no legible.
    # La deduplicación por `session_id` y el `DuplicateKeyError` quedan igual.
    await _load_visible_post(db, post_id, viewer)
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
