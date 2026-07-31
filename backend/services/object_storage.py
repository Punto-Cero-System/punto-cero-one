"""Object storage — provider-agnostic abstraction with two backends.

Backends
--------
LocalObjectStorage  → writes files under `OBJECT_STORAGE_ROOT` on the local
                      filesystem. Zero external dependencies; runs in VS Code
                      local dev, on CI, or in any host.
EmergentObjectStorage → calls the managed storage service at
                      https://integrations.emergentagent.com/objstore/api/v1.
                      Used automatically when `EMERGENT_LLM_KEY` is present
                      AND `OBJECT_STORAGE_BACKEND` != "local".

Contract
--------
Both backends implement the same 3 async-safe methods:
    put(path, data, content_type) -> {path, size}
    get(path)                     -> (bytes, content_type)
    exists(path)                  -> bool

The MongoDB `documents` collection is the single source of truth about which
files exist — the storage backends never list/rename/delete files themselves.
This keeps the code portable and testable outside of Emergent.
"""
from __future__ import annotations

import os
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple

import requests

logger = logging.getLogger("punto-cero-api.object_storage")


class ObjectStorageError(Exception):
    """Raised for any storage-level failure."""


class BaseObjectStorage(ABC):
    backend_name: str = ""

    @abstractmethod
    def put(self, path: str, data: bytes, content_type: str) -> dict: ...

    @abstractmethod
    def get(self, path: str) -> Tuple[bytes, str]: ...

    def exists(self, path: str) -> bool:  # optional override
        try:
            self.get(path)
            return True
        except ObjectStorageError:
            return False


# ---------------------------------------------------------------------------
# Local filesystem backend
# ---------------------------------------------------------------------------
class LocalObjectStorage(BaseObjectStorage):
    backend_name = "local"

    def __init__(self, root: str) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, path: str) -> Path:
        # Reject absolute or traversal paths — must be relative.
        safe = path.replace("..", "").lstrip("/")
        return (self.root / safe).resolve()

    def put(self, path: str, data: bytes, content_type: str) -> dict:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            target.write_bytes(data)
            # Store content-type sidecar so downloads can serve the correct MIME.
            (target.parent / f".{target.name}.ct").write_text(content_type)
        except OSError as e:
            raise ObjectStorageError(f"No se pudo escribir el archivo: {e}") from e
        return {"path": path, "size": len(data)}

    def get(self, path: str) -> Tuple[bytes, str]:
        target = self._resolve(path)
        if not target.exists() or not target.is_file():
            raise ObjectStorageError(f"Archivo no encontrado: {path}")
        try:
            data = target.read_bytes()
            ct_file = target.parent / f".{target.name}.ct"
            ct = ct_file.read_text().strip() if ct_file.exists() else "application/octet-stream"
        except OSError as e:
            raise ObjectStorageError(f"No se pudo leer el archivo: {e}") from e
        return data, ct


# ---------------------------------------------------------------------------
# Emergent managed backend (optional, opt-in via EMERGENT_LLM_KEY)
# ---------------------------------------------------------------------------
class EmergentObjectStorage(BaseObjectStorage):
    backend_name = "emergent"
    STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

    def __init__(self, emergent_key: str) -> None:
        self._key = emergent_key
        self._storage_key: Optional[str] = None

    def _init(self) -> str:
        if self._storage_key:
            return self._storage_key
        try:
            resp = requests.post(
                f"{self.STORAGE_URL}/init",
                json={"emergent_key": self._key},
                timeout=30,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise ObjectStorageError(f"init de storage falló: {e}") from e
        self._storage_key = resp.json().get("storage_key")
        if not self._storage_key:
            raise ObjectStorageError("respuesta de init sin storage_key")
        return self._storage_key

    def put(self, path: str, data: bytes, content_type: str) -> dict:
        key = self._init()
        try:
            resp = requests.put(
                f"{self.STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise ObjectStorageError(f"put falló: {e}") from e
        body = resp.json() or {}
        return {"path": body.get("path", path), "size": body.get("size", len(data))}

    def get(self, path: str) -> Tuple[bytes, str]:
        key = self._init()
        try:
            resp = requests.get(
                f"{self.STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=60,
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise ObjectStorageError(f"get falló: {e}") from e
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
_singleton: Optional[BaseObjectStorage] = None


def get_storage() -> BaseObjectStorage:
    """Returns a process-wide storage backend based on env config.

    Selection order:
        OBJECT_STORAGE_BACKEND=local      → LocalObjectStorage (default outside Emergent)
        OBJECT_STORAGE_BACKEND=emergent   → EmergentObjectStorage (requires EMERGENT_LLM_KEY)
        (unset)                           → emergent if EMERGENT_LLM_KEY, else local
    """
    global _singleton
    if _singleton is not None:
        return _singleton

    preferred = os.environ.get("OBJECT_STORAGE_BACKEND", "").lower()
    emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")

    if preferred == "emergent" or (preferred == "" and emergent_key):
        if not emergent_key:
            raise ObjectStorageError(
                "OBJECT_STORAGE_BACKEND=emergent pero EMERGENT_LLM_KEY no está configurado"
            )
        _singleton = EmergentObjectStorage(emergent_key)
    else:
        root = os.environ.get("OBJECT_STORAGE_ROOT", "/app/data/uploads")
        _singleton = LocalObjectStorage(root)

    logger.info("Object storage backend: %s", _singleton.backend_name)
    return _singleton


def app_prefix() -> str:
    """Namespaced prefix for all objects. Keeps the shared bucket collision-free."""
    return os.environ.get("OBJECT_STORAGE_APP", "punto-cero-system")
