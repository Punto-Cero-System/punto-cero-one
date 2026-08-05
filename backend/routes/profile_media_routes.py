"""Profile Media routes — profile picture + cover for community members.

Design mirrors `company_media_routes`:
- Community-authenticated user manages their OWN media only.
- Files stored via `services.object_storage` under
  `{app_prefix}/users/{user_id}/{slot}/{doc_id}.{ext}` where slot ∈ picture | cover.
- Public read is not auth-gated (profile visits from anon users need to see it).
- Every URL returned is a canonical `/api/community/users/media/<path>` — safe to
  persist in Mongo and remains stable when the backend swaps LocalObjectStorage
  for EmergentObjectStorage.

Endpoints
---------
PUT     /api/community/users/me/media/{slot}   — slot ∈ picture | cover
DELETE  /api/community/users/me/media/{slot}
GET     /api/community/users/media/{path:path} — public streaming
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


logger = logging.getLogger("punto-cero-api.profile_media")

router = APIRouter(prefix="/api/community/users", tags=["profile-media"])


ProfileSlot = Literal["picture", "cover"]
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/gif",
}
MAX_MEDIA_BYTES = int(os.environ.get("MAX_PROFILE_MEDIA_BYTES", str(8 * 1024 * 1024)))  # 8 MB


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ext(filename: str, content_type: str) -> str:
    if filename and "." in filename:
        candidate = filename.rsplit(".", 1)[-1].lower()
        if 0 < len(candidate) <= 8 and candidate.isalnum():
            return candidate
    return {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
    }.get(content_type, "bin")


async def _save_profile_media(user_id: str, slot: str, file: UploadFile) -> str:
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
    storage_path = f"{app_prefix()}/users/{user_id}/{slot}/{obj_id}.{ext}"
    try:
        get_storage().put(storage_path, data, content_type)
    except ObjectStorageError as e:
        logger.exception("profile media put failed")
        raise HTTPException(status_code=502, detail=f"Fallo del almacenamiento: {e}")
    return f"/api/community/users/media/{storage_path}"


@router.put("/me/media/{slot}")
async def upload_profile_slot(
    slot: ProfileSlot,
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(require_current_user),
):
    url = await _save_profile_media(user["id"], slot, file)
    # Map slot → stored field name on the user document.
    field = "picture" if slot == "picture" else "cover_url"
    await request.app.state.db.users.update_one(
        {"id": user["id"]},
        {"$set": {field: url, "updated_at": _now_iso()}},
    )
    return {"ok": True, "slot": slot, "url": url}


@router.delete("/me/media/{slot}")
async def clear_profile_slot(
    slot: ProfileSlot,
    request: Request,
    user: dict = Depends(require_current_user),
):
    field = "picture" if slot == "picture" else "cover_url"
    await request.app.state.db.users.update_one(
        {"id": user["id"]},
        {"$set": {field: None, "updated_at": _now_iso()}},
    )
    return {"ok": True, "slot": slot}


@router.get("/media/{path:path}")
async def stream_profile_media(path: str):
    """Public streaming — safe to hotlink.

    Serves images stored under the app namespace, whether they belong to
    user profiles (`users/`), feed post attachments (`posts/`) or group
    covers (`groups/`). All three are surfaced through this endpoint so
    they share a single canonical URL scheme.
    """
    prefix = app_prefix()
    allowed_subpaths = (
        f"{prefix}/users/",
        f"{prefix}/posts/",
        f"{prefix}/groups/",
    )
    if not path.startswith(allowed_subpaths):
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
