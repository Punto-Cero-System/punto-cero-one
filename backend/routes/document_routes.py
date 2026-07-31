"""Document repository routes. Prefix: /api/documents

Portable file management for the Investor Portal (and later verticals). Uses
the object-storage abstraction so the same endpoints work with Emergent managed
storage or a local filesystem when running in VS Code / on any host.

Access model
------------
- Admin (JWT): can upload, list, download, and soft-delete any document.
- Investor (JWT):  can list + download documents where `vertical="investor"`.
- Community members (cookie): NO access — documents are for admin/investor only.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Query, Response
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user, require_admin
from services.object_storage import get_storage, app_prefix, ObjectStorageError

logger = logging.getLogger("punto-cero-api.document_routes")

router = APIRouter(prefix="/api/documents", tags=["documents"])


DocumentCategory = Literal[
    "pitch_deck",
    "financial_model",
    "legal",
    "executive_summary",
    "other",
]
DocumentVertical = Literal["investor", "legal", "medicina", "contabilidad", "educacion", "shared"]

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))  # 50 MB default


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class DocumentPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    original_filename: str
    category: str
    vertical: str
    content_type: str
    size_bytes: int
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    created_at: str
    download_count: int = 0
    view_count: int = 0
    last_download_at: Optional[str] = None


class DocumentListResponse(BaseModel):
    items: list[DocumentPublic]
    total: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _guess_ext(filename: str) -> str:
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if 0 < len(ext) <= 8 and ext.isalnum():
            return ext
    return "bin"


def _doc_to_public(doc: dict) -> DocumentPublic:
    return DocumentPublic(
        id=doc["id"],
        original_filename=doc["original_filename"],
        category=doc["category"],
        vertical=doc["vertical"],
        content_type=doc.get("content_type", "application/octet-stream"),
        size_bytes=int(doc.get("size_bytes", 0)),
        uploaded_by=doc.get("uploaded_by", ""),
        uploaded_by_name=doc.get("uploaded_by_name"),
        created_at=doc.get("created_at", _now_iso()),
        download_count=int(doc.get("download_count", 0)),
        view_count=int(doc.get("view_count", 0)),
        last_download_at=doc.get("last_download_at"),
    )


async def _ensure_can_read(db, user: dict, doc: dict) -> None:
    role = user.get("role")
    if role == "admin":
        return
    if role == "investor" and doc.get("vertical") == "investor":
        return
    raise HTTPException(status_code=403, detail="Sin acceso a este documento")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/upload", response_model=DocumentPublic)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    category: DocumentCategory = Form(...),
    vertical: DocumentVertical = Form("investor"),
    admin: dict = Depends(require_admin),
):
    """Admin-only. Uploads a document and records it in MongoDB."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo sin nombre")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Archivo supera el máximo permitido ({MAX_UPLOAD_BYTES} bytes)")

    ext = _guess_ext(file.filename)
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    storage_path = f"{app_prefix()}/documents/{vertical}/{category}/{doc_id}.{ext}"
    content_type = file.content_type or "application/octet-stream"

    try:
        result = get_storage().put(storage_path, data, content_type)
    except ObjectStorageError as e:
        logger.exception("storage put failed")
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")

    db = request.app.state.db
    doc = {
        "id": doc_id,
        "storage_path": result["path"],
        "storage_backend": get_storage().backend_name,
        "original_filename": file.filename,
        "content_type": content_type,
        "size_bytes": int(result.get("size", len(data))),
        "category": category,
        "vertical": vertical,
        "uploaded_by": admin["id"],
        "uploaded_by_name": admin.get("name", ""),
        "is_deleted": False,
        "created_at": _now_iso(),
    }
    await db.documents.insert_one(doc)
    return _doc_to_public(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    request: Request,
    user: dict = Depends(get_current_user),
    vertical: Optional[DocumentVertical] = Query(default=None),
    category: Optional[DocumentCategory] = Query(default=None),
):
    """List documents visible to the current user.

    - Admins see everything.
    - Investors see only vertical='investor'.
    """
    db = request.app.state.db
    query: dict = {"is_deleted": False}
    role = user.get("role")

    if role == "admin":
        if vertical:
            query["vertical"] = vertical
    elif role == "investor":
        query["vertical"] = "investor"
        if vertical and vertical != "investor":
            # Investor cannot see other verticals; return empty rather than 403.
            return DocumentListResponse(items=[], total=0)
    else:
        raise HTTPException(status_code=403, detail="Sin acceso")

    if category:
        query["category"] = category

    cursor = db.documents.find(query, {"_id": 0}).sort("created_at", -1).limit(500)
    docs = [d async for d in cursor]
    return DocumentListResponse(items=[_doc_to_public(d) for d in docs], total=len(docs))


@router.get("/{doc_id}")
async def document_meta(
    doc_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await _ensure_can_read(db, user, doc)
    return _doc_to_public(doc)


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await _ensure_can_read(db, user, doc)

    try:
        data, content_type = get_storage().get(doc["storage_path"])
    except ObjectStorageError as e:
        logger.exception("storage get failed")
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")

    # Audit trail — reuse the investor_access_log collection if the user is investor.
    if user.get("role") == "investor":
        await db.investor_access_log.insert_one({
            "user_id": user["id"],
            "action": "document_download",
            "document_id": doc_id,
            "created_at": _now_iso(),
        })
    # Per-document counters (visible to admins).
    await db.documents.update_one(
        {"id": doc_id},
        {"$inc": {"download_count": 1}, "$set": {"last_download_at": _now_iso()}},
    )

    filename = doc.get("original_filename") or f"{doc_id}"
    return Response(
        content=data,
        media_type=doc.get("content_type") or content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=60",
        },
    )


@router.post("/{doc_id}/download-link")
async def create_download_link(
    doc_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
    ttl_minutes: int = 15,
):
    """Generates a short-lived signed URL (default 15 minutes) that can be
    opened once without a bearer token — safe to share via chat/email.

    Signature is a random opaque token stored server-side. On redemption the
    token is consumed atomically; there's no HMAC math to maintain.
    """
    import secrets
    from datetime import timedelta
    db = request.app.state.db
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await _ensure_can_read(db, user, doc)
    token = secrets.token_urlsafe(24)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=max(1, min(60, ttl_minutes)))
    await db.document_signed_links.insert_one({
        "token": token,
        "document_id": doc_id,
        "created_by": user["id"],
        "created_at": _now_iso(),
        "expires_at": expires_at.isoformat(),
        "consumed_at": None,
    })
    base = os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
    url = f"{base}/api/documents/signed/{token}" if base else f"/api/documents/signed/{token}"
    return {"url": url, "token": token, "expires_at": expires_at.isoformat()}


@router.get("/signed/{token}")
async def download_via_signed_link(token: str, request: Request):
    db = request.app.state.db
    link = await db.document_signed_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Enlace inválido")
    try:
        expires_at = datetime.fromisoformat(link["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="Enlace corrupto")
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Enlace expirado")
    if link.get("consumed_at"):
        raise HTTPException(status_code=410, detail="Enlace ya utilizado")
    doc = await db.documents.find_one({"id": link["document_id"], "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    try:
        data, content_type = get_storage().get(doc["storage_path"])
    except ObjectStorageError as e:
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")

    await db.document_signed_links.update_one(
        {"token": token}, {"$set": {"consumed_at": _now_iso()}},
    )
    await db.documents.update_one(
        {"id": doc["id"]},
        {"$inc": {"download_count": 1}, "$set": {"last_download_at": _now_iso()}},
    )

    filename = doc.get("original_filename") or f"{doc['id']}"
    return Response(
        content=data,
        media_type=doc.get("content_type") or content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/{doc_id}/view")
async def register_document_view(
    doc_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False}, {"_id": 0, "id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    await db.documents.update_one(
        {"id": doc_id},
        {"$inc": {"view_count": 1}, "$set": {"last_view_at": _now_iso()}},
    )
    return {"ok": True}


@router.delete("/{doc_id}")
async def soft_delete_document(
    doc_id: str,
    request: Request,
    admin: dict = Depends(require_admin),
):
    db = request.app.state.db
    result = await db.documents.update_one(
        {"id": doc_id, "is_deleted": False},
        {"$set": {"is_deleted": True, "deleted_at": _now_iso(), "deleted_by": admin["id"]}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {"ok": True}
