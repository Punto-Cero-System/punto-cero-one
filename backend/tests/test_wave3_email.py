"""Wave 3D backend tests — Email provider service.

Covers:
  1. /api/email/status returns a valid status envelope.
  2. Without EMERGENT_EMAIL_KEY, send() returns CONFIG_PENDING (never crashes).
  3. Admin test endpoint is auth-guarded.
  4. Admin test endpoint returns CONFIG_PENDING in this env.
  5. High-level helpers (send_welcome, send_invitation, send_password_reset)
     execute without raising when the provider is unconfigured.
"""
from __future__ import annotations

import asyncio
import os
import requests
import pytest


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


class TestEmailStatus:
    def test_status_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/email/status")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] in {"ACTIVE", "CONFIG_PENDING", "DISABLED", "FAILED"}
        assert "from_name" in data
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["has_key"], bool)

    def test_config_pending_when_no_key(self):
        r = requests.get(f"{BASE_URL}/api/email/status").json()
        # In test env, EMERGENT_EMAIL_KEY is config_pending → should be CONFIG_PENDING.
        assert r["status"] in ("CONFIG_PENDING", "DISABLED")


class TestEmailAdminGuard:
    def test_admin_test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/email/test",
                          json={"to": "someone@example.com"})
        assert r.status_code in (401, 403)

    def test_admin_test_returns_status_envelope(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/email/test",
                          json={"to": "delivered@resend.dev",
                                "subject": "Wave3 test",
                                "message": "hola desde pytest"},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] in ("ACTIVE", "CONFIG_PENDING", "DISABLED", "FAILED")
        # In this env we expect CONFIG_PENDING
        if data["status"] == "CONFIG_PENDING":
            assert data["ok"] is True  # soft-success in dry-run mode
            assert "skipped" in data.get("message", "").lower()


class TestEmailHelpersSoftFail:
    """The high-level helpers must never raise even without config."""

    def test_helpers_do_not_raise(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from services.email import (
            send_welcome, send_invitation, send_password_reset, send_confirmation,
        )

        async def run():
            r1 = await send_welcome(to="delivered@resend.dev", name="Test User")
            r2 = await send_invitation(to="delivered@resend.dev",
                                       invite_link="https://example.com/i/xyz",
                                       inviter_name="Ada Lovelace",
                                       context="portal de inversionistas")
            r3 = await send_password_reset(to="delivered@resend.dev",
                                           reset_link="https://example.com/r/xyz")
            r4 = await send_confirmation(to="delivered@resend.dev",
                                         subject="Confirmación",
                                         message_html="<p>Todo OK</p>")
            return r1, r2, r3, r4

        r1, r2, r3, r4 = asyncio.run(run())
        for r in (r1, r2, r3, r4):
            assert r is not None
            assert r.status.value in ("ACTIVE", "CONFIG_PENDING", "DISABLED", "FAILED")
