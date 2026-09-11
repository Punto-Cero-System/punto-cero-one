import pytest
from datetime import datetime, timezone

from services.community_auth import (
    new_session_token,
    session_expiry,
    parse_expires_at,
    ProviderIdentity,
    registry,
)


def test_new_session_token_format():
    t = new_session_token()
    assert isinstance(t, str)
    assert t.startswith("cs_")
    assert len(t) > 20


def test_session_expiry_future():
    e = session_expiry()
    assert isinstance(e, datetime)
    assert e.tzinfo is not None
    assert e > datetime.now(timezone.utc)


def test_parse_expires_at_handles_strings_and_naive_dt():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    s = now.isoformat()
    got = parse_expires_at(s)
    assert got.tzinfo is not None

    naive = datetime.now().replace(microsecond=0)
    got2 = parse_expires_at(naive.isoformat())
    assert got2.tzinfo is not None


def test_provider_identity_public_dict_strips_session_token():
    p = ProviderIdentity(provider='g', provider_user_id='1', email='a@b.com', name='n', picture=None, session_token='tok')
    d = p.as_public_dict()
    assert 'session_token' not in d


def test_registry_enabled_list_returns_list():
    lst = registry.enabled_list()
    assert isinstance(lst, list)
import re

from fastapi import Response

from routes import community_auth_routes as car
from services import community_auth as ca


def test_provider_identity_public_dict():
    pid = ca.ProviderIdentity(
        provider="google",
        provider_user_id="123",
        email="user@example.com",
        name="User",
        picture="https://example.com/p.png",
        session_token="tok_abc",
    )
    public = pid.as_public_dict()
    assert "session_token" not in public
    assert public["provider"] == "google"


def test_new_session_token_format_via_service():
    t = ca.new_session_token()
    assert isinstance(t, str)
    assert t.startswith("cs_")
    # basic length sanity
    assert len(t) > 20


def test_parse_expires_at_with_string_and_datetime():
    s = datetime.now(timezone.utc).isoformat()
    dt = ca.parse_expires_at(s)
    assert isinstance(dt, datetime)

    now = datetime.now(timezone.utc)
    dt2 = ca.parse_expires_at(now)
    assert isinstance(dt2, datetime)


def test_cookie_set_and_clear_headers():
    resp = Response()
    token = "cs_testtoken"
    # set cookie
    car._set_session_cookie(resp, token)
    sc_headers = [h for h in resp.raw_headers if h[0].decode().lower() == "set-cookie"]
    assert sc_headers, "set-cookie header missing after setting session cookie"
    sc_values = "\n".join([h[1].decode() for h in sc_headers])
    assert "session_token=" in sc_values
    assert "httponly" in sc_values.lower()

    # clear cookie
    resp2 = Response()
    car._clear_session_cookie(resp2)
    dc_headers = [h for h in resp2.raw_headers if h[0].decode().lower() == "set-cookie"]
    assert dc_headers, "set-cookie header missing after deleting cookie"
    dc_values = "\n".join([h[1].decode() for h in dc_headers])
    # deletion should set an expired cookie for the same name
    assert re.search(r"session_token=.*(expires=|expired)", dc_values, re.IGNORECASE) or "Max-Age=0" in dc_values
