"""
Activities reader — OMEGA C1.

Read-only query layer over the append-only `activities` log written by
`services.activities` (F0.9). This module is the **only** place that decides
what a viewer may read; the HTTP layer maps the result and nothing else.

ISOLATION
---------
* `services.activities`  → **writes** facts (append-only). Never called here.
* `services.activity_reader` (this file) → **queries** them.
* `routes/activities_routes.py` → HTTP only: no query, no permission rule.

The reader never writes. It only issues `find` / `find_one`: the log stays
append-only because there is no update, no delete and no upsert anywhere in
this module, and the tests assert the database double rejects any write.

PRIVACY
-------
`visibility` is the contract's closed vocabulary (`services.activities`), and it
is honoured here, not re-invented:

  public    → everyone, including anonymous readers.
  private   → only the actor. Nothing else unlocks it: a fact addressed to one
              person stays with that person.
  members   → the viewer must be a member (or the owner) of the audience
              group. Mere visibility of the group is NOT enough: seeing that a
              public group exists must not expose what happens inside it.
  followers → the viewer must have an active `follows` relation with the
              audience. `follows` stays the single source of truth; the reader
              does not re-derive follow rules.

An actor always sees their own facts, whatever the visibility.

WHY THE GROUP SET IS BUILT HERE AND NOT IN `group_permissions`
--------------------------------------------------------------
`group_permissions` remains the authority for *deciding access to one object*,
and routes keep using it. A paged query cannot call it per candidate without
leaving holes in the page, so the reader resolves the membership set up front
(the same two sources the authority consults: `group_members` and
`groups.admin_id`) and filters in the database. The rule lives once, here.
"""
from __future__ import annotations

import base64
import binascii
from typing import Any, Optional

# El lector NO importa `services.activities`: el log se escribe en un módulo y
# se lee en otro. El vocabulario (`public`/`members`/`followers`/`private`) se
# respeta tal cual lo escribe el contrato, sin acoplarse a su implementación.
# El test de F0.9 vigila exactamente que esta frontera no se mezcle.

DEFAULT_LIMIT = 20
MAX_LIMIT = 100

__all__ = [
    "DEFAULT_LIMIT", "MAX_LIMIT", "CursorError",
    "resolve_viewer", "visibility_query", "list_activities", "get_activity",
    "encode_cursor", "decode_cursor",
]


class CursorError(ValueError):
    """Cursor mal formado. La ruta lo traduce a 400."""


# --- viewer ---------------------------------------------------------------
async def resolve_viewer(db, session_token: Optional[str]) -> Optional[dict]:
    """Usuario detrás de la cookie de comunidad, o `None`.

    Misma fuente que usa el resto de la API (`user_sessions` + `users`); no se
    reimplementa autenticación, solo se resuelve el lector de la petición.
    """
    if not session_token:
        return None
    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0, "user_id": 1})
    if not session or not session.get("user_id"):
        return None
    return await db.users.find_one({"id": session["user_id"]}, {"_id": 0})


# --- visibilidad ----------------------------------------------------------
async def _member_group_ids(db, viewer_id: str) -> set:
    """Grupos en los que el lector es miembro o dueño."""
    ids = {
        m["group_id"]
        async for m in db.group_members.find(
            {"user_id": viewer_id}, {"_id": 0, "group_id": 1})
    }
    async for g in db.groups.find({"admin_id": viewer_id}, {"_id": 0, "id": 1}):
        ids.add(g["id"])
    return ids


async def _followed_refs(db, viewer_id: str) -> list:
    """(entity_type, entity_id) que el lector sigue, tal cual está en `follows`."""
    refs = []
    async for f in db.follows.find(
            {"user_id": viewer_id}, {"_id": 0, "entity_type": 1, "entity_id": 1}):
        if f.get("entity_type") and f.get("entity_id"):
            refs.append((f["entity_type"], f["entity_id"]))
    return refs


async def visibility_query(db, viewer: Optional[dict]) -> dict:
    """Cláusula Mongo con lo que este lector puede ver.

    El filtro se empuja a la base de datos: la paginación no se pagina sobre
    datos que luego se descartan.
    """
    viewer_id = (viewer or {}).get("id")
    branches: list = [{"visibility": "public"}]
    if not viewer_id:
        return {"$or": branches}

    branches.append({"actor_id": viewer_id})

    member_groups = await _member_group_ids(db, viewer_id)
    if member_groups:
        branches.append({"visibility": "members", "audience.type": "group",
                         "audience.id": {"$in": sorted(member_groups)}})

    refs = await _followed_refs(db, viewer_id)
    if refs:
        branches.append({
            "visibility": "followers",
            "$or": [{"audience.type": t, "audience.id": i} for t, i in refs],
        })
    return {"$or": branches}


# --- cursor ---------------------------------------------------------------
def _as_object_id(value: str) -> Any:
    """El `_id` real es un ObjectId; en dobles puede ser una cadena."""
    try:
        from bson import ObjectId
        if isinstance(value, str) and len(value) == 24:
            return ObjectId(value)
    except Exception:  # pragma: no cover - bson siempre está en producción
        pass
    return value


def encode_cursor(doc: dict) -> str:
    """Cursor estable sobre (created_at, _id) descendente."""
    raw = f"{doc.get('created_at', '')}|{doc.get('_id', '')}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str):
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        created, _, oid = base64.urlsafe_b64decode(padded).decode("utf-8").partition("|")
        if not created or not oid:
            raise CursorError("cursor incompleto")
        return created, _as_object_id(oid)
    except CursorError:
        raise
    except (ValueError, binascii.Error, UnicodeDecodeError) as exc:
        raise CursorError("cursor inválido") from exc


# --- queries --------------------------------------------------------------
def _public(doc: dict) -> dict:
    """Documento sin el `_id` técnico de Mongo."""
    out = dict(doc)
    out.pop("_id", None)
    return out


async def list_activities(
    db,
    *,
    viewer: Optional[dict] = None,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    limit: int = DEFAULT_LIMIT,
    cursor: Optional[str] = None,
) -> dict:
    """Actividades visibles para el lector, de más reciente a más antigua."""
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT
    limit = max(1, min(limit, MAX_LIMIT))

    query = await visibility_query(db, viewer)
    if subject_type:
        query["subject_type"] = subject_type
    if subject_id:
        query["subject_id"] = subject_id
    if cursor:
        created, oid = decode_cursor(cursor)
        query = {"$and": [query, {"$or": [
            {"created_at": {"$lt": created}},
            {"created_at": created, "_id": {"$lt": oid}},
        ]}]}

    cur = (db.activities.find(query, {"_id": 1})
           .sort([("created_at", -1), ("_id", -1)])
           .limit(limit + 1))
    docs = [d async for d in cur]

    has_more = len(docs) > limit
    items = [_public(d) for d in docs[:limit]]
    return {
        "items": items,
        "limit": limit,
        "has_more": has_more,
        # El cursor apunta al último elemento ENTREGADO: la página siguiente
        # empieza justo detrás de él, sin repeticiones ni huecos.
        "next_cursor": encode_cursor(docs[limit - 1]) if has_more and items else None,
    }


async def get_activity(db, activity_id: str, *,
                       viewer: Optional[dict] = None) -> Optional[dict]:
    """Una actividad, o `None` si no existe **o** no es visible.

    Una sola implementación del filtro para la lista y para el detalle: el
    detalle no puede abrir una puerta que la lista mantiene cerrada.
    """
    query = await visibility_query(db, viewer)
    query["id"] = activity_id
    doc = await db.activities.find_one(query)
    return _public(doc) if doc is not None else None