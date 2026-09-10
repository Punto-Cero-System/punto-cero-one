claude-proxy-local
===================

Small local proxy to integrate Anthropic Claude into VS Code or other tools.

Features:
- If `ANTHROPIC_API_KEY` is set, forwards requests to the Anthropic API (configure `ANTHROPIC_API_URL` and `ANTHROPIC_API_KEY_HEADER` if needed).
- If no API key, provides a small local fallback: simple code-search over the workspace (uses `rg` if installed) or canned replies.

Quick start (Linux):

Install dependencies and run:

```bash
cd /app/claude_proxy
npm install
# With your Anthropic key (remote mode):
export ANTHROPIC_API_KEY="sk_..."
npm start

# Or local-limited mode (no key):
npm start
```

Endpoints:
- `POST /v1/complete` with JSON `{ "prompt": "...", "model": "claude-2-" }` — proxies or local fallback.
- `GET /health` — returns `{ok: true, mode: 'remote'|'local'}`.

VS Code usage (two options):
1) Use the REST Client extension (humao.rest-client). Create a file `claude_local.http` and send requests to `http://localhost:3000/v1/complete`.
2) Use any extension that supports custom LLM endpoints and point it to `http://localhost:3000`.

Notes:
- This is intentionally small and not production-grade. It is a developer convenience to allow a Claude-backed experience when you have a key, and a limited local fallback when you do not.
- The proxy is idempotent and non-destructive: it only mirrors requests and never writes to your repo.
