import asyncio
import pytest

from services.realtime import RealtimeBroker, get_broker


@pytest.mark.asyncio
async def test_subscribe_publish_and_cleanup():
    broker = RealtimeBroker()
    user_id = "user_test_1"

    # start subscriber generator
    agen = broker.subscribe(user_id)
    sub = agen.__aiter__()
    # first item is system.hello
    hello = await sub.__anext__()
    assert "system.hello" in hello

    # publish an event
    delivered = await broker.publish(user_id, "notification", {"n": 1})
    assert delivered == 1

    # receive the published event
    ev = await sub.__anext__()
    assert "notification" in ev

    # cancel the generator to simulate disconnect and ensure cleanup
    await agen.aclose()
    stats = broker.stats()
    assert stats["subscribers"].get(user_id, 0) == 0


def test_touch_and_presence():
    broker = RealtimeBroker()
    user_id = "user_presence_x"
    # no presence yet
    p = broker.presence([user_id])
    assert p[user_id]["status"] in ("OFFLINE", "AWAY", "ONLINE")
    # touch should update last_seen
    asyncio.get_event_loop().run_until_complete(broker.touch(user_id))
    p2 = broker.presence([user_id])
    assert p2[user_id]["last_seen"] is not None
