"""Wave 12 Fase 3 — Comunidades (Grupos profesionales básicos).

CRUD mínimo:
  POST   /api/groups                    → crear grupo (auth)
  GET    /api/groups                    → listar grupos (público)
  GET    /api/groups/{id}               → detalle
  POST   /api/groups/{id}/join          → unirse
  POST   /api/groups/{id}/leave         → salir
  GET    /api/groups/{id}/members       → miembros
  POST   /api/groups/{id}/posts         → publicar en el grupo
  GET    /api/groups/{id}/posts         → posts del grupo

Los posts del grupo reutilizan la colección `posts` con `group_id` +
`visibility="group"`. La categoría se guarda como `category` (una de las
10 iniciales).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services.community_deps import require_current_user


router = APIRouter(prefix="/api/groups", tags=["groups"])


CATEGORIES = [
    "marketing", "empleo", "empresas", "tecnologia", "legal",
    "salud", "educacion", "marketplace", "contabilidad", "emprendimiento",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=600)
    category: Literal[
        "marketing", "empleo", "empresas", "tecnologia", "legal",
        "salud", "educacion", "marketplace", "contabilidad", "emprendimiento",
    ]
    privacy: Literal["public", "private"] = "public"
    rules: Optional[str] = Field(default=None, max_length=2000)


class GroupPostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)


def _serialize_group(doc: dict, viewer_id: Optional[str] = None) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "description": doc.get("description"),
        "category": doc.get("category"),
        "privacy": doc.get("privacy", "public"),
        "rules": doc.get("rules"),
        "admin_id": doc.get("admin_id"),
        "members_count": doc.get("members_count", 0),
        "posts_count": doc.get("posts_count", 0),
        "created_at": doc.get("created_at"),
        "is_member": doc.get("_is_member", False) if viewer_id else False,
        "is_admin": (doc.get("admin_id") == viewer_id) if viewer_id else False,
    }


@router.get("/categories")
async def list_categories():
    return {"categories": [
        {"key": "marketing",      "label": "Marketing"},
        {"key": "empleo",         "label": "Empleo"},
        {"key": "empresas",       "label": "Empresas"},
        {"key": "tecnologia",     "label": "Tecnología"},
        {"key": "legal",          "label": "Legal"},
        {"key": "salud",          "label": "Salud"},
        {"key": "educacion",      "label": "Educación"},
        {"key": "marketplace",    "label": "Marketplace"},
        {"key": "contabilidad",   "label": "Contabilidad"},
        {"key": "emprendimiento", "label": "Emprendimiento"},
    ]}


@router.post("")
async def create_group(payload: GroupCreate, request: Request,
                       user: dict = Depends(require_current_user)):
    db = request.app.state.db
    now = _now()
    doc = {
        "id": f"grp_{uuid.uuid4().hex[:16]}",
        "name": payload.name.strip(),
        "description": (payload.description or "").strip() or None,
        "category": payload.category,
        "privacy": payload.privacy,
        "rules": (payload.rules or "").strip() or None,
        "admin_id": user["id"],
        "members_count": 1,
        "posts_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.groups.insert_one(doc)
    # Admin joins automatically
    await db.group_members.insert_one({
        "id": f"gm_{uuid.uuid4().hex[:16]}",
        "group_id": doc["id"], "user_id": user["id"],
        "role": "admin", "joined_at": now,
    })
    return _serialize_group(doc, viewer_id=user["id"])


async def _viewer_id(request: Request, session_token: Optional[str]) -> Optional[str]:
    if not session_token:
        return None
    s = await request.app.state.db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0, "user_id": 1})
    return s.get("user_id") if s else None


@router.get("")
async def list_groups(request: Request,
                      category: Optional[str] = Query(default=None),
                      limit: int = Query(default=50, ge=1, le=200),
                      session_token: Optional[str] = Cookie(default=None)):
    db = request.app.state.db
    viewer_id = await _viewer_id(request, session_token)
    q = {}
    if category:
        q["category"] = category
    cur = db.groups.find(q, {"_id": 0}).sort("members_count", -1).limit(limit)
    docs = [d async for d in cur]
    if viewer_id and docs:
        member_of = set()
        async for m in db.group_members.find(
            {"user_id": viewer_id, "group_id": {"$in": [d["id"] for d in docs]}},
            {"_id": 0, "group_id": 1},
        ):
            member_of.add(m["group_id"])
        for d in docs:
            d["_is_member"] = d["id"] in member_of
    return {"items": [_serialize_group(d, viewer_id) for d in docs], "total": len(docs)}


@router.get("/{group_id}")
async def get_group(group_id: str, request: Request,
                    session_token: Optional[str] = Cookie(default=None)):
    db = request.app.state.db
    doc = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    viewer_id = await _viewer_id(request, session_token)
    if viewer_id:
        m = await db.group_members.find_one({"group_id": group_id, "user_id": viewer_id}, {"_id": 0})
        doc["_is_member"] = bool(m)
    return _serialize_group(doc, viewer_id)


@router.post("/{group_id}/join")
async def join_group(group_id: str, request: Request,
                     user: dict = Depends(require_current_user)):
    db = request.app.state.db
    doc = await db.groups.find_one({"id": group_id}, {"_id": 0, "id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    existing = await db.group_members.find_one({"group_id": group_id, "user_id": user["id"]}, {"_id": 0})
    if existing:
        return {"ok": True, "joined": False, "already_member": True}
    await db.group_members.insert_one({
        "id": f"gm_{uuid.uuid4().hex[:16]}",
        "group_id": group_id, "user_id": user["id"],
        "role": "member", "joined_at": _now(),
    })
    await db.groups.update_one({"id": group_id}, {"$inc": {"members_count": 1}})
    return {"ok": True, "joined": True}


@router.post("/{group_id}/leave")
async def leave_group(group_id: str, request: Request,
                      user: dict = Depends(require_current_user)):
    db = request.app.state.db
    res = await db.group_members.delete_one({"group_id": group_id, "user_id": user["id"]})
    if res.deleted_count:
        await db.groups.update_one({"id": group_id}, {"$inc": {"members_count": -1}})
    return {"ok": True, "left": bool(res.deleted_count)}


@router.get("/{group_id}/members")
async def list_members(group_id: str, request: Request,
                       limit: int = Query(default=50, ge=1, le=200)):
    db = request.app.state.db
    cur = db.group_members.find({"group_id": group_id}, {"_id": 0}).sort("joined_at", 1).limit(limit)
    rows = [m async for m in cur]
    users_by_id = {}
    if rows:
        async for u in db.users.find(
            {"id": {"$in": [r["user_id"] for r in rows]}},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "headline": 1},
        ):
            users_by_id[u["id"]] = u
    items = []
    for r in rows:
        u = users_by_id.get(r["user_id"]) or {"id": r["user_id"], "name": "Miembro"}
        items.append({**u, "role": r.get("role", "member"), "joined_at": r.get("joined_at")})
    return {"items": items, "total": len(items)}


@router.post("/{group_id}/posts")
async def create_group_post(group_id: str, payload: GroupPostCreate,
                            request: Request,
                            user: dict = Depends(require_current_user)):
    db = request.app.state.db
    doc = await db.groups.find_one({"id": group_id}, {"_id": 0, "id": 1, "privacy": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    # Membership required to post
    is_member = await db.group_members.find_one({"group_id": group_id, "user_id": user["id"]}, {"_id": 0})
    if not is_member:
        raise HTTPException(status_code=403, detail="Únete al grupo para publicar")
    now = _now()
    post = {
        "id": f"gp_{uuid.uuid4().hex[:16]}",
        "group_id": group_id,
        "author_id": user["id"],
        "body": payload.body.strip(),
        "created_at": now,
    }
    await db.group_posts.insert_one(post)
    await db.groups.update_one({"id": group_id}, {"$inc": {"posts_count": 1}})
    return {
        "id": post["id"], "group_id": group_id,
        "author_id": user["id"], "body": post["body"],
        "created_at": now,
        "author": {"id": user["id"], "name": user.get("name"), "picture": user.get("picture")},
    }


@router.get("/{group_id}/posts")
async def list_group_posts(group_id: str, request: Request,
                           limit: int = Query(default=20, ge=1, le=50)):
    db = request.app.state.db
    cur = db.group_posts.find({"group_id": group_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
    rows = [p async for p in cur]
    users_by_id = {}
    if rows:
        async for u in db.users.find(
            {"id": {"$in": [r["author_id"] for r in rows]}},
            {"_id": 0, "id": 1, "name": 1, "picture": 1, "headline": 1},
        ):
            users_by_id[u["id"]] = u
    items = []
    for r in rows:
        u = users_by_id.get(r["author_id"]) or {"id": r["author_id"], "name": "Miembro"}
        items.append({
            "id": r["id"], "group_id": r.get("group_id"),
            "author_id": r["author_id"], "body": r["body"],
            "created_at": r["created_at"], "author": u,
        })
    return {"items": items, "total": len(items)}
