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

    @abstractmethod
    def delete(self, path: str) -> None: ...

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

    def delete(self, path: str) -> None:
        target = self._resolve(path)
        try:
            if target.exists():
                target.unlink()
            ct_file = target.parent / f".{target.name}.ct"
            if ct_file.exists():
                ct_file.unlink()
        except OSError as e:
            raise ObjectStorageError(f"No se pudo borrar el archivo: {e}") from e


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

    def delete(self, path: str) -> None:
        key = self._init()
        try:
            resp = requests.delete(
                f"{self.STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=30,
            )
            # Treat 2xx as success; treat 404 as success for idempotence.
            if resp.status_code >= 200 and resp.status_code < 300:
                return
            if resp.status_code == 404:
                return
            raise ObjectStorageError(f"delete falló: {resp.status_code} {resp.text[:200]}")
        except requests.RequestException as e:
            raise ObjectStorageError(f"delete falló: {e}") from e


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


def storage_status() -> dict:
    """Return a small diagnostic dict about the configured storage backend.

    This is intended for non-fatal, code-level verification in tests and
    startup checks. It performs a best-effort writable check when the
    configured backend is local. It does NOT expose any secrets.
    """
    preferred = os.environ.get("OBJECT_STORAGE_BACKEND", "").lower()
    emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
    status: dict = {"preferred": preferred or None, "emergent_key_set": bool(emergent_key)}
    try:
        backend = get_storage()
        status["backend_name"] = getattr(backend, "backend_name", None)
    except Exception as e:
        status["backend_name"] = None
        status["init_error"] = str(e)
        return status

    if getattr(backend, "backend_name", "") == "local":
        # Try a non-destructive writable check in the local root.
        try:
            root = getattr(backend, "root", None)
            status["local_root"] = str(root) if root is not None else None
            ok = False
            if root is not None:
                root.mkdir(parents=True, exist_ok=True)
                test_path = root / ".punto_cero_storage_check"
                try:
                    test_path.write_text("ok")
                    if test_path.exists():
                        ok = True
                finally:
                    try:
                        test_path.unlink()
                    except Exception:
                        pass
            status["local_writable"] = bool(ok)
            # We cannot reliably determine mount persistence from within the
            # process; mark persistence as NOT_VERIFIED.
            status["deployment_persistence_verified"] = False
        except Exception as e:
            status["local_writable"] = False
            status["local_check_error"] = str(e)

    return status


def enforce_production_storage(disallow_local: bool) -> None:
    """Enforce that local storage is not used in production when opt-in flag set.

    If `disallow_local` is True and the configured backend resolves to local
    and deployment persistence is not verified, raise a RuntimeError with a
    clear configuration message. This function is safe to call at startup
    for a fast-fail check and uses `storage_status()` for evaluation.
    """
    if not disallow_local:
        return
    status = storage_status()
    backend = status.get("backend_name")
    # If we couldn't determine backend_name due to init error, fail safe.
    if backend is None:
        raise RuntimeError(
            "DISALLOW_LOCAL_STORAGE_IN_PRODUCTION enabled but storage backend could not be initialized."
        )
    if backend == "local":
        # If the deployment persistence has not been explicitly verified,
        # refuse to start to avoid accidental ephemeral storage in prod.
        if not status.get("deployment_persistence_verified", False):
            raise RuntimeError(
                "DISALLOW_LOCAL_STORAGE_IN_PRODUCTION is enabled and the configured storage backend is local. "
                "Deployment persistence is NOT VERIFIED. Set up a persistent object store or disable the flag."
            )
