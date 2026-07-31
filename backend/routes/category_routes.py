"""Categories API. Prefix: /api/categories

Read-only for community; admins can create/update/delete.  The taxonomy is
seeded on startup — see `seed_default_categories` in server.py.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import require_admin
from models_category import CategoryPublic, CategoryUpsert


router = APIRouter(prefix="/api/categories", tags=["categories"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=list[CategoryPublic])
async def list_categories(
    request: Request,
    group: Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
):
    db = request.app.state.db
    query: dict = {}
    if active_only:
        query["active"] = True
    if group:
        query["group"] = group
    cursor = db.categories.find(query, {"_id": 0}).sort("order", 1)
    return [CategoryPublic(**doc) async for doc in cursor]


@router.post("", response_model=CategoryPublic)
async def upsert_category(
    payload: CategoryUpsert,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    now = _now()
    existing = await db.categories.find_one({"key": payload.key}, {"_id": 0})
    doc = payload.model_dump()
    if existing:
        doc["created_at"] = existing.get("created_at", now)
        doc["updated_at"] = now
        await db.categories.update_one({"key": payload.key}, {"$set": doc})
    else:
        doc["created_at"] = now
        doc["updated_at"] = now
        await db.categories.insert_one(doc)
    return CategoryPublic(**doc)


@router.delete("/{key}")
async def delete_category(
    key: str,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    result = await db.categories.update_one({"key": key}, {"$set": {"active": False, "updated_at": _now()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return {"ok": True}
