import asyncio
import pytest

from types import SimpleNamespace

from services.growth import aggregator


class FakeCollection:
    def __init__(self):
        self.store = {}

    async def update_one(self, query, update, upsert=False):
        # query: {'id': id}
        _id = query.get('id')
        if _id in self.store:
            # simulate modified_count
            self.store[_id].update(update.get('$set', {}))
            class R: modified_count = 1; upserted_id = None
            return R()
        else:
            if upsert:
                doc = {}
                doc.update(update.get('$setOnInsert', {}))
                doc.update(update.get('$set', {}))
                self.store[_id] = doc
                class R: modified_count = 0; upserted_id = _id
                return R()
            else:
                class R: modified_count = 0; upserted_id = None
                return R()


@pytest.mark.asyncio
async def test_run_once_basic(monkeypatch):
    # Prepare a fake source and an entry
    src = {"id": "s1", "name": "Src One", "url": "http://example.com/rss", "vertical": "news"}
    entry = {"link": "https://example.com/1", "title": "Hello World", "summary": "x"}

    # Monkeypatch active_sources to return our single source
    monkeypatch.setattr(aggregator, 'active_sources', lambda db: asyncio.sleep(0, result=[src]))

    # Monkeypatch fetch_all to return our entries
    async def fake_fetch_all(sources):
        return [(src, [entry])]
    monkeypatch.setattr('services.growth.providers.fetch_all', fake_fetch_all)

    # Fake db with growth_items
    fake_db = SimpleNamespace()
    fake_db.growth_items = FakeCollection()

    res = await aggregator.run_once(fake_db)
    assert res['sources'] == 1
    assert res['fetched'] == 1
    assert res['processed'] == 1
    assert res['ingested'] == 1
    assert 'per_source' in res and 's1' in res['per_source']
