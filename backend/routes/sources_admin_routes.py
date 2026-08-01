"""Sources Center — admin API.

All routes require `require_admin`. The frontend Admin dashboard is the
only surface that talks to these endpoints.

Endpoints
---------
    GET    /api/admin/sources               — paginated list with filters
    POST   /api/admin/sources               — create
    GET    /api/admin/sources/{id}          — read
    PATCH  /api/admin/sources/{id}          — partial update
    DELETE /api/admin/sources/{id}          — soft delete
    POST   /api/admin/sources/{id}/toggle   — flip status active⇄paused
    POST   /api/admin/sources/{id}/sync     — synchronous manual run
    POST   /api/admin/sources/{id}/test     — dry-run: only fetch + count
    GET    /api/admin/sources/{id}/logs     — sync history
    POST   /api/admin/sources/import        — bulk import (JSON/CSV)
    GET    /api/admin/sources/export        — export current list as JSON
"""
from __future__ import annotations

import csv
import io
import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import Response

from auth import require_admin
from models_source import (
    SourceCreate, SourceUpdate, SourcePublic,
    new_source_id, now_iso, FREQUENCY_SECONDS,
)
from services.sources_center.engine import HANDLERS, run_sync


logger = logging.getLogger("punto-cero-api.admin.sources")
router = APIRouter(prefix="/api/admin/sources", tags=["admin-sources"])


# ---------- helpers ----------

def _to_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc.get("name"),
        "kind": doc.get("kind"),
        "category": doc.get("category"),
        "country": doc.get("country"),
        "language": doc.get("language"),
        "vertical": doc.get("vertical"),
        "description": doc.get("description"),
        "url": doc.get("url"),
        "frequency": doc.get("frequency") or "1h",
        "status": doc.get("status") or "active",
        "config": doc.get("config") or {},
        "owner_id": doc.get("owner_id"),
        "imported_count": doc.get("imported_count") or 0,
        "last_sync_at": doc.get("last_sync_at"),
        "last_sync_status": doc.get("last_sync_status"),
        "last_sync_error": doc.get("last_sync_error"),
        "next_sync_at": doc.get("next_sync_at"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


async def _find(db, source_id: str) -> dict:
    doc = await db.sources.find_one({"id": source_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "source not found")
    return doc


# ---------- CRUD ----------

@router.get("")
async def list_sources(
    request: Request,
    admin: dict = Depends(require_admin),
    kind: Optional[str] = None,
    country: Optional[str] = None,
    language: Optional[str] = None,
    vertical: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    owner: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    db = request.app.state.db
    query: dict[str, Any] = {"is_deleted": {"$ne": True}}
    if kind:     query["kind"] = kind
    if country:  query["country"] = country.upper()
    if language: query["language"] = language
    if vertical: query["vertical"] = vertical
    if status:   query["status"] = status
    if owner:    query["owner_id"] = owner
    if search:
        import re as _re
        q = {"$regex": _re.escape(search), "$options": "i"}
        query["$or"] = [
            {"name": q}, {"description": q}, {"url": q},
            {"category": q}, {"vertical": q},
        ]
    total = await db.sources.count_documents(query)
    cursor = db.sources.find(query, {"_id": 0}).sort("updated_at", -1).skip(offset).limit(limit)
    items = [_to_public(d) async for d in cursor]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("")
async def create_source(payload: SourceCreate, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    if payload.kind not in HANDLERS:
        raise HTTPException(400, f"unsupported kind: {payload.kind}")
    now = now_iso()
    doc = {
        "id": new_source_id(),
        **payload.model_dump(exclude_none=True),
        "owner_id": admin.get("id"),
        "is_deleted": False,
        "imported_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.sources.insert_one(doc)
    return _to_public(doc)


@router.get("/export")
async def export_sources(request: Request, admin: dict = Depends(require_admin),
                        fmt: str = Query(default="json", pattern="^(json|csv)$")):
    db = request.app.state.db
    docs = [_to_public(d) async for d in db.sources.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0}
    )]
    if fmt == "json":
        return {"items": docs, "count": len(docs), "exported_at": now_iso()}
    # CSV
    buf = io.StringIO()
    fields = ["id", "name", "kind", "category", "country", "language",
              "vertical", "url", "frequency", "status", "imported_count",
              "last_sync_at", "last_sync_status", "created_at"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for d in docs:
        writer.writerow(d)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sources.csv"'},
    )


@router.get("/kinds")
async def list_kinds(admin: dict = Depends(require_admin)):
    return {"kinds": list(HANDLERS.keys()), "frequencies": list(FREQUENCY_SECONDS.keys())}


@router.get("/{source_id}")
async def get_source(source_id: str, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    return _to_public(await _find(db, source_id))


@router.patch("/{source_id}")
async def update_source(source_id: str, payload: SourceUpdate, request: Request,
                        admin: dict = Depends(require_admin)):
    db = request.app.state.db
    doc = await _find(db, source_id)
    patch = payload.model_dump(exclude_none=True)
    if patch.get("kind") and patch["kind"] not in HANDLERS:
        raise HTTPException(400, f"unsupported kind: {patch['kind']}")
    patch["updated_at"] = now_iso()
    await db.sources.update_one({"id": source_id}, {"$set": patch})
    return _to_public({**doc, **patch})


@router.delete("/{source_id}")
async def delete_source(source_id: str, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    await _find(db, source_id)
    await db.sources.update_one(
        {"id": source_id},
        {"$set": {"is_deleted": True, "status": "paused", "updated_at": now_iso()}},
    )
    return {"deleted": True, "id": source_id}


@router.post("/{source_id}/toggle")
async def toggle_source(source_id: str, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    doc = await _find(db, source_id)
    new_status = "paused" if doc.get("status") == "active" else "active"
    await db.sources.update_one({"id": source_id}, {"$set": {
        "status": new_status, "updated_at": now_iso(),
    }})
    return {"id": source_id, "status": new_status}


@router.post("/{source_id}/sync")
async def sync_now(source_id: str, request: Request, admin: dict = Depends(require_admin)):
    db = request.app.state.db
    src = await _find(db, source_id)
    log = await run_sync(db, src)
    return log


@router.post("/{source_id}/test")
async def test_source(source_id: str, request: Request, admin: dict = Depends(require_admin)):
    """Dry-run: hit the source but DO NOT write anything to the DB. Useful
    before persisting a new connector."""
    db = request.app.state.db
    src = await _find(db, source_id)
    handler = HANDLERS.get(src.get("kind"))
    if not handler:
        raise HTTPException(400, "unsupported kind")
    # Wrap the DB with a passthrough that swallows writes → we still measure
    # what would have been fetched.
    class _NullCol:
        async def update_one(self, *a, **k):
            class _R: upserted_id = "x"; modified_count = 0
            return _R()
        async def insert_one(self, *a, **k):
            class _R: inserted_id = "x"
            return _R()
    class _NullDB:
        def __getattr__(self, name): return _NullCol()
    try:
        return await handler(_NullDB(), src)
    except Exception as e:
        return {"ingested": 0, "updated": 0, "errors": [str(e)]}


@router.get("/{source_id}/logs")
async def source_logs(source_id: str, request: Request, admin: dict = Depends(require_admin),
                      limit: int = Query(default=25, ge=1, le=200)):
    db = request.app.state.db
    await _find(db, source_id)  # ensure exists
    cursor = db.source_syncs.find({"source_id": source_id}, {"_id": 0}).sort("started_at", -1).limit(limit)
    return {"items": [d async for d in cursor]}


# ---------- Bulk import ----------

async def _import_records(db, records: list[dict], admin_id: str) -> dict:
    upserted = 0
    updated = 0
    errors: list[str] = []
    for i, r in enumerate(records):
        try:
            data = SourceCreate(**r)
        except Exception as e:
            errors.append(f"row {i}: {e}")
            continue
        now = now_iso()
        # Idempotency: same (kind, url) → update; otherwise create.
        key = {"kind": data.kind, "url": data.url, "is_deleted": {"$ne": True}} if data.url \
              else {"kind": data.kind, "name": data.name, "is_deleted": {"$ne": True}}
        existing = await db.sources.find_one(key, {"_id": 0, "id": 1})
        if existing:
            await db.sources.update_one(
                {"id": existing["id"]},
                {"$set": {**data.model_dump(exclude_none=True), "updated_at": now}},
            )
            updated += 1
        else:
            doc = {
                "id": new_source_id(),
                **data.model_dump(exclude_none=True),
                "owner_id": admin_id,
                "is_deleted": False, "imported_count": 0,
                "created_at": now, "updated_at": now,
            }
            await db.sources.insert_one(doc)
            upserted += 1
    return {"upserted": upserted, "updated": updated, "errors": errors,
            "total": len(records)}


@router.post("/import")
async def bulk_import(request: Request, admin: dict = Depends(require_admin)):
    """Two modes:
        • JSON body `{"items": [...]}`
        • Multipart file upload (`.json` or `.csv`)
    """
    db = request.app.state.db
    records: list[dict] = []
    ctype = (request.headers.get("content-type") or "").lower()

    if ctype.startswith("application/json"):
        try:
            payload = await request.json()
        except Exception:
            payload = None
        if isinstance(payload, dict) and isinstance(payload.get("items"), list):
            records = payload["items"]
        elif isinstance(payload, list):
            records = payload
    elif ctype.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None:
            raise HTTPException(400, "missing 'file' part")
        raw = await upload.read()
        name = (upload.filename or "").lower()
        if name.endswith(".json"):
            try:
                loaded = json.loads(raw.decode("utf-8"))
            except Exception as e:
                raise HTTPException(400, f"invalid json: {e}")
            if isinstance(loaded, dict):
                records = loaded.get("items", [loaded]) if loaded.get("items") else [loaded]
            elif isinstance(loaded, list):
                records = loaded
        elif name.endswith(".csv"):
            reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
            for row in reader:
                if row.get("config"):
                    try: row["config"] = json.loads(row["config"])
                    except Exception: row["config"] = {}
                records.append(row)
        else:
            raise HTTPException(400, "unsupported file format — use .json or .csv")
    else:
        raise HTTPException(400, "unsupported content-type")

    if not records:
        raise HTTPException(400, "empty payload")
    return await _import_records(db, records, admin.get("id") or "admin")
