import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import routes.follows_routes as follows_mod


@pytest.mark.asyncio
async def test_follow_company_inserts_and_increments(monkeypatch):
    # Setup mocks
    mock_db = SimpleNamespace()
    # Mock update_one for follows to report an upsert happened
    mock_follows_res = SimpleNamespace(upserted_id='newid')
    mock_db.follows = SimpleNamespace(update_one=AsyncMock(return_value=mock_follows_res),
                                      count_documents=AsyncMock(return_value=1))
    # Mock company_follows update_one to report upsert
    mock_company_res = SimpleNamespace(upserted_id='cnew')
    mock_db.company_follows = SimpleNamespace(update_one=AsyncMock(return_value=mock_company_res))
    mock_db.companies = SimpleNamespace(update_one=AsyncMock())

    # Silence notifications
    monkeypatch.setattr(follows_mod, 'dispatch_notif', AsyncMock())

    req = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=mock_db)))
    user = {'id': 'user_123', 'name': 'Tester', 'picture': None}

    resp = await follows_mod.follow('company', 'comp123', req, user)

    assert resp['my_following'] is True
    # company counter increment was called because upsert happened
    assert mock_db.companies.update_one.await_count == 1


@pytest.mark.asyncio
async def test_follow_company_idempotent_no_increment(monkeypatch):
    # Setup mocks where follows.update_one matched existing (no upsert)
    mock_db = SimpleNamespace()
    mock_follows_res = SimpleNamespace(upserted_id=None)
    mock_db.follows = SimpleNamespace(update_one=AsyncMock(return_value=mock_follows_res),
                                      count_documents=AsyncMock(return_value=1))
    # company_follows returns no upsert
    mock_company_res = SimpleNamespace(upserted_id=None)
    mock_db.company_follows = SimpleNamespace(update_one=AsyncMock(return_value=mock_company_res))
    mock_db.companies = SimpleNamespace(update_one=AsyncMock())

    monkeypatch.setattr(follows_mod, 'dispatch_notif', AsyncMock())

    req = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=mock_db)))
    user = {'id': 'user_123', 'name': 'Tester', 'picture': None}

    resp = await follows_mod.follow('company', 'comp123', req, user)

    assert resp['my_following'] is True
    # company counter increment should not have been called
    assert mock_db.companies.update_one.await_count == 0


@pytest.mark.asyncio
async def test_unfollow_company_decrements_when_deleted(monkeypatch):
    mock_db = SimpleNamespace()
    # delete_one returns object with deleted_count
    del_res = SimpleNamespace(deleted_count=1)
    mock_db.follows = SimpleNamespace(delete_one=AsyncMock(return_value=del_res),
                                      count_documents=AsyncMock(return_value=0))
    mock_db.company_follows = SimpleNamespace(delete_one=AsyncMock())
    mock_db.companies = SimpleNamespace(update_one=AsyncMock())

    req = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=mock_db)))
    user = {'id': 'user_123'}

    resp = await follows_mod.unfollow('company', 'comp123', req, user)

    assert resp['my_following'] is False
    assert mock_db.companies.update_one.await_count == 1
