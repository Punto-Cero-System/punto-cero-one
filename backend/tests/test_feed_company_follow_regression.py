"""Wave 5 regression: ensure company_follows stored as id OR slug are
resolved by load_user_signals() so owner boosts apply.

Tests:
  - follow stored as company id
  - follow stored as company slug
  - both representations present -> owner deduped
"""
from __future__ import annotations

import uuid
import time
import asyncio

from services.feed_engine.engine import load_user_signals


def _now_iso():
    return "2026-01-01T00:00:00+00:00"


def _mk_user(mongo_db, tag: str) -> dict:
    uid = f"user_w5_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    mongo_db.users.insert_one({"id": uid, "email": f"TEST_{uid}@example.com", "created_at": _now_iso()})
    return {"id": uid}


def _mk_company(mongo_db, owner_id: str, slug: str | None = None) -> dict:
    cid = f"co_{uuid.uuid4().hex[:8]}"
    sl = slug or f"cmp-{uuid.uuid4().hex[:6]}"
    mongo_db.companies.insert_one({
        "id": cid,
        "slug": sl,
        "owner_id": owner_id,
        "vertical": "tech",
        "created_at": _now_iso(),
    })
    return {"id": cid, "slug": sl}


def test_follow_by_id_resolves_owner(mongo_db):
    owner = _mk_user(mongo_db, "owner1")
    viewer = _mk_user(mongo_db, "viewer1")
    co = _mk_company(mongo_db, owner["id"], slug="w5co-idtest")

    # company_follows historically stored company_id == numeric id
    mongo_db.company_follows.insert_one({"user_id": viewer["id"], "company_id": co["id"], "created_at": _now_iso()})

    signals = asyncio.run(load_user_signals(mongo_db, {"id": viewer["id"]}))

    assert co["id"] in signals.followed_company_ids
    assert owner["id"] in signals.followed_company_owner_ids

    # cleanup
    mongo_db.company_follows.delete_many({"user_id": viewer["id"]})
    mongo_db.companies.delete_many({"id": co["id"]})
    mongo_db.users.delete_many({"id": {"$in": [owner["id"], viewer["id"]]}})


def test_follow_by_slug_resolves_owner(mongo_db):
    owner = _mk_user(mongo_db, "owner2")
    viewer = _mk_user(mongo_db, "viewer2")
    co = _mk_company(mongo_db, owner["id"], slug="w5co-slugtest")

    # legacy deployments sometimes wrote the company slug into company_follows.company_id
    mongo_db.company_follows.insert_one({"user_id": viewer["id"], "company_id": co["slug"], "created_at": _now_iso()})

    signals = asyncio.run(load_user_signals(mongo_db, {"id": viewer["id"]}))

    # followed_company_ids will contain the raw stored token (slug), but
    # load_user_signals must still resolve the owner_id for boosting.
    assert co["slug"] in signals.followed_company_ids
    assert owner["id"] in signals.followed_company_owner_ids

    # cleanup
    mongo_db.company_follows.delete_many({"user_id": viewer["id"]})
    mongo_db.companies.delete_many({"id": co["id"]})
    mongo_db.users.delete_many({"id": {"$in": [owner["id"], viewer["id"]]}})


def test_both_representations_dedup_owner(mongo_db):
    owner = _mk_user(mongo_db, "owner3")
    viewer = _mk_user(mongo_db, "viewer3")
    co = _mk_company(mongo_db, owner["id"], slug="w5co-bothtest")

    # Insert both representations for the same user
    mongo_db.company_follows.insert_many([
        {"user_id": viewer["id"], "company_id": co["id"], "created_at": _now_iso()},
        {"user_id": viewer["id"], "company_id": co["slug"], "created_at": _now_iso()},
    ])

    signals = asyncio.run(load_user_signals(mongo_db, {"id": viewer["id"]}))

    # The returned owner set should contain the owner only once (set semantics)
    assert owner["id"] in signals.followed_company_owner_ids
    assert len(signals.followed_company_owner_ids) == 1

    # cleanup
    mongo_db.company_follows.delete_many({"user_id": viewer["id"]})
    mongo_db.companies.delete_many({"id": co["id"]})
    mongo_db.users.delete_many({"id": {"$in": [owner["id"], viewer["id"]]}})
