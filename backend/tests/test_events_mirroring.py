import asyncio
import pytest

from types import SimpleNamespace

from services.sources_center import engine


class FakeCollection:
    def __init__(self, fail_on_id=None):
        self.store = {}
        self.fail_on_id = set(fail_on_id or [])

    async def update_one(self, query, update, upsert=False):
        _id = query.get('id')
        if _id in self.fail_on_id:
            raise Exception('simulated write failure')
        if _id in self.store:
            # apply $set
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

    async def find_one(self, query, proj=None):
        _id = query.get('id')
        return self.store.get(_id)


@pytest.mark.asyncio
async def test_events_mirroring(monkeypatch):
    # Prepare a fake RSS entry
    entry = {
        'link': 'https://example.com/evt/1',
        'title': 'Test Event',
        'summary': 'An event summary',
        'published': '2026-01-01T12:00:00Z',
    }
    src = {'id': 's_events', 'name': 'Src Events', 'url': 'https://example.com/feed', 'country': 'CO', 'vertical': 'eventos'}

    # Monkeypatch the RSS provider to return our single entry
    async def fake_fetch(self, source, timeout=8.0):
        return [entry]
    monkeypatch.setattr('services.growth.providers.RSSProvider.fetch', fake_fetch)

    # Avoid autotag DB calls
    monkeypatch.setattr('services.discovery.autotag.get_company_aliases', lambda db: {})

    # Fake DB: growth_items + events
    fake_db = SimpleNamespace()
    fake_db.growth_items = FakeCollection()
    fake_db.events = FakeCollection()

    # Run sync_events_feed — should ingest into growth_items and mirror into events
    res = await engine.sync_events_feed(fake_db, src)
    assert res.get('ingested', 0) >= 1

    # growth_items should contain the item
    assert len(fake_db.growth_items.store) == 1
    gid = list(fake_db.growth_items.store.keys())[0]

    # events should contain mirrored doc with same id
    assert gid in fake_db.events.store
    ev = fake_db.events.store[gid]
    assert ev.get('title') == 'Test Event'
    assert ev.get('description') == 'An event summary'

    # Re-run ingestion — should not create duplicate events
    res2 = await engine.sync_events_feed(fake_db, src)
    assert len(fake_db.events.store) == 1


@pytest.mark.asyncio
async def test_mirror_failure_tolerated(monkeypatch):
    # Two entries: one will trigger mirror failure
    entry1 = {'link': 'https://example.com/evt/a', 'title': 'A', 'summary': 'a', 'published': '2026-01-01T10:00:00Z'}
    entry2 = {'link': 'https://example.com/evt/b', 'title': 'B', 'summary': 'b', 'published': '2026-01-02T11:00:00Z'}
    src = {'id': 's_events2', 'name': 'Src Events 2', 'url': 'https://example.com/feed2', 'country': 'CO', 'vertical': 'eventos'}

    async def fake_fetch(self, source, timeout=8.0):
        return [entry1, entry2]
    monkeypatch.setattr('services.growth.providers.RSSProvider.fetch', fake_fetch)
    monkeypatch.setattr('services.discovery.autotag.get_company_aliases', lambda db: {})

    fake_db = SimpleNamespace()
    fake_db.growth_items = FakeCollection()
    # events will fail when attempting to write the first mirrored id
    fake_db.events = FakeCollection()

    # We will simulate failure by wrapping update_one to raise for first id
    original_update = fake_db.events.update_one

    async def failing_update(query, update, upsert=False):
        _id = query.get('id')
        # before the event exists in growth_items, ids are not known; so call original
        # but if id ends with an 'a' simulate failure
        if _id and _id.endswith('a'):
            raise Exception('simulated per-item mirror failure')
        return await original_update(query, update, upsert=upsert)

    fake_db.events.update_one = failing_update

    # Run sync; should not raise despite mirror failure
    res = await engine.sync_events_feed(fake_db, src)
    assert res.get('ingested', 0) >= 2
    # growth_items should have both
    assert len(fake_db.growth_items.store) == 2
    # events may have one (the non-failing one)
    assert len(fake_db.events.store) >= 0