import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi import HTTPException

import routes.profile_media_routes as pmr


class DummyUpload:
    def __init__(self, filename, content_type, data: bytes):
        self.filename = filename
        self.content_type = content_type
        self._data = data

    async def read(self):
        return self._data


def make_req_with_db(db):
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=db)))


def test_profile_upload_cleanup_on_db_failure(monkeypatch):
    # Mock storage
    storage = SimpleNamespace(put=MagicMock(return_value={"path": "p"}), delete=MagicMock())
    monkeypatch.setattr(pmr, 'get_storage', lambda: storage)

    # Mock DB: update_one raises
    class BadDB:
        async def update_one(self, *a, **k):
            raise Exception("db failure")

    db = SimpleNamespace(users=BadDB())
    req = make_req_with_db(db)
    user = {"id": "user_abc"}

    file = DummyUpload("pic.jpg", "image/jpeg", b"x" * 10)

    with pytest.raises(HTTPException):
        # call endpoint function directly
        import asyncio
        asyncio.get_event_loop().run_until_complete(pmr.upload_profile_slot('picture', req, file, user))

    assert storage.delete.called
    # Ensure delete path contains expected user/slot prefix
    arg = storage.delete.call_args[0][0]
    assert f"users/{user['id']}/picture/" in arg


def test_profile_upload_success_does_not_delete(monkeypatch):
    storage = SimpleNamespace(put=MagicMock(return_value={"path": "p"}), delete=MagicMock())
    monkeypatch.setattr(pmr, 'get_storage', lambda: storage)

    class GoodUsers:
        async def update_one(self, *a, **k):
            return None

    db = SimpleNamespace(users=GoodUsers())
    req = make_req_with_db(db)
    user = {"id": "user_xyz"}

    file = DummyUpload("pic.jpg", "image/jpeg", b"x" * 10)

    import asyncio
    res = asyncio.get_event_loop().run_until_complete(pmr.upload_profile_slot('cover', req, file, user))
    assert res["ok"] is True
    assert not storage.delete.called


def test_profile_upload_rejects_large_file():
    big = DummyUpload("big.jpg", "image/jpeg", b"x" * (pmr.MAX_MEDIA_BYTES + 10))
    db = SimpleNamespace(users=SimpleNamespace(update_one=lambda *a, **k: None))
    req = make_req_with_db(db)
    user = {"id": "u1"}

    import asyncio
    with pytest.raises(HTTPException):
        asyncio.get_event_loop().run_until_complete(pmr._save_profile_media(user['id'], 'picture', big))
