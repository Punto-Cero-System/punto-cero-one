import os
import asyncio
import tempfile
from pathlib import Path

import pytest

from services.object_storage import LocalObjectStorage, EmergentObjectStorage, get_storage, storage_status, ObjectStorageError


def test_local_object_storage_put_get(tmp_path):
    root = tmp_path / "uploads"
    storage = LocalObjectStorage(str(root))
    path = "test_namespace/users/u1/pic.png"
    data = b"hello"
    res = storage.put(path, data, "image/png")
    assert res["path"] == path
    assert res["size"] == len(data)
    got, ct = storage.get(path)
    assert got == data
    assert ct == "image/png"


def test_get_storage_selection_local(monkeypatch, tmp_path):
    # Force local backend
    monkeypatch.delenv("OBJECT_STORAGE_BACKEND", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    # Clear any existing singleton by reloading module-level state
    # get_storage will create a LocalObjectStorage by default
    s = get_storage()
    assert hasattr(s, "backend_name")
    assert s.backend_name == "local"


def test_storage_status_report(monkeypatch, tmp_path):
    # Ensure local root is writable and status reflects that
    monkeypatch.setenv("OBJECT_STORAGE_BACKEND", "local")
    monkeypatch.setenv("OBJECT_STORAGE_ROOT", str(tmp_path))
    # Clear singleton if present by deleting internal module attribute
    # (import/cleanup handled by test environment)
    status = storage_status()
    assert status.get("backend_name") == "local"
    assert status.get("local_root") is not None
    assert "local_writable" in status
    assert status["deployment_persistence_verified"] is False


class DummyUploadFile:
    def __init__(self, filename: str, content_type: str, data: bytes):
        self.filename = filename
        self.content_type = content_type
        self._data = data

    async def read(self):
        await asyncio.sleep(0)
        return self._data


def test_profile_save_media_failure(monkeypatch):
    # Import the route function and monkeypatch get_storage to raise
    from services import object_storage
    from routes import profile_media_routes
    class BadStorage:
        def put(self, *a, **k):
            raise ObjectStorageError("simulated failure")

    monkeypatch.setattr(profile_media_routes, "get_storage", lambda: BadStorage())

    f = DummyUploadFile("x.png", "image/png", b"data")
    # Call the async function and expect HTTPException (raised inside)
    with pytest.raises(Exception):
        asyncio.get_event_loop().run_until_complete(profile_media_routes._save_profile_media("u1", "picture", f))
