import os
import pytest

from services import object_storage


def test_flag_disabled_no_failure(monkeypatch):
    # flag off -> no enforcement
    monkeypatch.delenv("DISALLOW_LOCAL_STORAGE_IN_PRODUCTION", raising=False)
    # simulate local unverified status
    monkeypatch.setattr(object_storage, "storage_status", lambda: {"backend_name": "local", "deployment_persistence_verified": False})
    # Should not raise when disallow_local is False
    object_storage.enforce_production_storage(False)


def test_flag_enabled_persistent_allowed(monkeypatch):
    monkeypatch.setenv("DISALLOW_LOCAL_STORAGE_IN_PRODUCTION", "1")
    # simulate local but persistence verified
    monkeypatch.setattr(object_storage, "storage_status", lambda: {"backend_name": "local", "deployment_persistence_verified": True})
    # Should not raise because persistence is verified
    object_storage.enforce_production_storage(True)


def test_flag_enabled_local_fails(monkeypatch):
    monkeypatch.setenv("DISALLOW_LOCAL_STORAGE_IN_PRODUCTION", "1")
    # simulate local and not verified
    monkeypatch.setattr(object_storage, "storage_status", lambda: {"backend_name": "local", "deployment_persistence_verified": False})
    with pytest.raises(RuntimeError) as exc:
        object_storage.enforce_production_storage(True)
    assert "DISALLOW_LOCAL_STORAGE_IN_PRODUCTION" in str(exc.value) or "local" in str(exc.value)
