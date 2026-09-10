"""Company Media routes — logo, banner, cover, gallery.

Design
------
* Community-authenticated (company owner) can upload/replace/delete media.
* Files are stored via the Object Storage abstraction under
  `{app_prefix}/companies/{company_id}/{slot}/{doc_id}.{ext}`.
* Public read is intentionally NOT auth-gated: company profiles are public and
  the images must render for anonymous visitors. We stream through a
  dedicated `GET /api/companies/media/*` endpoint so the storage backend can
  live behind a private mount if needed.
* Every URL returned is a canonical `/api/companies/media/<path>` — safe to
  persist in Mongo and never breaks when the storage backend changes.

Endpoints
---------
PUT  /api/companies/{id}/media/{slot}     — slot ∈ logo | banner | cover
POST /api/companies/{id}/gallery          — append one gallery image
DELETE /api/companies/{id}/media/{slot}   — clear a single slot
DELETE /api/companies/{id}/gallery/{idx}  — remove one gallery item by index
GET  /api/companies/media/{path:path}     — public streaming download
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile

from services.community_deps import require_current_user
from services.object_storage import get_storage, app_prefix, ObjectStorageError


logger = logging.getLogger("punto-cero-api.company_media")

router = APIRouter(prefix="/api/companies", tags=["company-media"])


MediaSlot = Literal["logo", "banner", "cover"]
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml",
}
MAX_MEDIA_BYTES = int(os.environ.get("MAX_COMPANY_MEDIA_BYTES", str(10 * 1024 * 1024)))  # 10 MB
MAX_GALLERY_ITEMS = int(os.environ.get("MAX_COMPANY_GALLERY_ITEMS", "20"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ext(filename: str, content_type: str) -> str:
    if filename and "." in filename:
        candidate = filename.rsplit(".", 1)[-1].lower()
        if 0 < len(candidate) <= 8 and candidate.isalnum():
            return candidate
    return {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
        "image/gif": "gif", "image/svg+xml": "svg",
    }.get(content_type, "bin")


async def _owned_company(request: Request, company_id: str, user: dict) -> dict:
    db = request.app.state.db
    doc = await db.companies.find_one(
        {"id": company_id, "is_deleted": {"$ne": True}}, {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if doc["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos sobre esta empresa")
    return doc


async def _save_media(company_id: str, slot: str, file: UploadFile) -> str:
    """Uploads `file` under a slot-scoped path. Returns the public URL."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo sin nombre")
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Formato no permitido: {content_type or 'desconocido'}")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail=f"Archivo supera {MAX_MEDIA_BYTES} bytes")

    ext = _ext(file.filename, content_type)
    obj_id = uuid.uuid4().hex[:16]
    storage_path = f"{app_prefix()}/companies/{company_id}/{slot}/{obj_id}.{ext}"
    try:
        get_storage().put(storage_path, data, content_type)
    except ObjectStorageError as e:
        logger.exception("company media put failed")
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")
    return f"/api/companies/media/{storage_path}"


# ---------------------------------------------------------------------------
# Single-slot upload (logo, banner, cover)
# ---------------------------------------------------------------------------
@router.put("/{company_id}/media/{slot}")
async def upload_media_slot(
    company_id: str,
    slot: MediaSlot,
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_current_user),
):
    company = await _owned_company(request, company_id, user)
    url = await _save_media(company["id"], slot, file)
    field = f"{slot}_url"
    db = request.app.state.db
    try:
        await db.companies.update_one(
            {"id": company["id"]},
            {"$set": {field: url, "updated_at": _now_iso()}},
        )
    except Exception as e:
        try:
            path = url.replace('/api/companies/media/', '', 1)
            get_storage().delete(path)
        except Exception:
            logger.exception("cleanup of orphaned company media failed")
        raise HTTPException(status_code=502, detail="No se pudo actualizar la empresa") from e
    return {"ok": True, "slot": slot, "url": url}


@router.delete("/{company_id}/media/{slot}")
async def clear_media_slot(
    company_id: str,
    slot: MediaSlot,
    request: Request,
    user: dict = Depends(require_current_user),
):
    company = await _owned_company(request, company_id, user)
    field = f"{slot}_url"
    await request.app.state.db.companies.update_one(
        {"id": company["id"]},
        {"$set": {field: None, "updated_at": _now_iso()}},
    )
    return {"ok": True, "slot": slot}


# ---------------------------------------------------------------------------
# Gallery (append + remove-by-index)
# ---------------------------------------------------------------------------
@router.post("/{company_id}/gallery")
async def add_gallery_image(
    company_id: str,
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_current_user),
):
    company = await _owned_company(request, company_id, user)
    current = company.get("gallery") or []
    if len(current) >= MAX_GALLERY_ITEMS:
        raise HTTPException(status_code=400, detail=f"Galería llena (máx {MAX_GALLERY_ITEMS})")
    url = await _save_media(company["id"], "gallery", file)
    db = request.app.state.db
    try:
        await db.companies.update_one(
            {"id": company["id"]},
            {"$push": {"gallery": url}, "$set": {"updated_at": _now_iso()}},
        )
    except Exception as e:
        try:
            path = url.replace('/api/companies/media/', '', 1)
            get_storage().delete(path)
        except Exception:
            logger.exception("cleanup of orphaned gallery media failed")
        raise HTTPException(status_code=502, detail="No se pudo actualizar la empresa") from e
    return {"ok": True, "url": url, "count": len(current) + 1}


@router.delete("/{company_id}/gallery/{idx}")
async def remove_gallery_image(
    company_id: str,
    idx: int,
    request: Request,
    user: dict = Depends(require_current_user),
):
    company = await _owned_company(request, company_id, user)
    current = list(company.get("gallery") or [])
    if idx < 0 or idx >= len(current):
        raise HTTPException(status_code=404, detail="Índice fuera de rango")
    current.pop(idx)
    await request.app.state.db.companies.update_one(
        {"id": company["id"]},
        {"$set": {"gallery": current, "updated_at": _now_iso()}},
    )
    return {"ok": True, "count": len(current)}


# ---------------------------------------------------------------------------
# Public streaming download
# ---------------------------------------------------------------------------
@router.get("/media/{path:path}")
async def stream_media(path: str):
    """Public streaming — safe to hotlink from any page."""
    # Only serve paths under our company namespace to prevent using this route
    # as a generic filesystem browser.
    if not path.startswith(f"{app_prefix()}/companies/"):
        raise HTTPException(status_code=403, detail="Ruta no permitida")
    try:
        data, ct = get_storage().get(path)
    except ObjectStorageError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return Response(
        content=data,
        media_type=ct or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )
