/*
Simple local proxy for Anthropic Claude API.
- If ANTHROPIC_API_KEY is set, forwards requests to ANTHROPIC_API_URL (default https://api.anthropic.com/v1/complete)
  using header name from ANTHROPIC_API_KEY_HEADER (default: x-api-key).
- If no API key, returns a limited local responder that can perform code search over the workspace
  (very small heuristic) or canned fallback responses.

Usage:
  ANTHROPIC_API_KEY=sk_xxx node server.js
  (or) node server.js  # runs in local limited mode

Endpoint: POST /v1/complete  (body: JSON with `prompt`, optional `model`, `max_tokens`)

This is intentionally small and safe for local dev/personal use.
*/

import express from "express";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.CLAUDE_PROXY_PORT || 3100;
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/complete';
const API_KEY_HEADER = process.env.ANTHROPIC_API_KEY_HEADER || 'x-api-key';

function simpleCodeSearch(query) {
  // Very small heuristic: run ripgrep if available to find matches in /app
  try {
    const workspace = process.env.CLAUDE_PROXY_WORKSPACE || '/app';
    // restrict to common code file extensions
    const cmd = `rg --hidden --no-ignore -n --max-filesize 1M -S -g '!node_modules' -e ${JSON.stringify(query)} ${JSON.stringify(workspace)} | head -n 10`;
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (out && out.trim()) {
      return `Local code search results:\n\n${out.trim()}`;
    }
  } catch (e) {
    // ripgrep may not be available; fallback to simple filename scan
    try {
      const workspace = process.env.CLAUDE_PROXY_WORKSPACE || '/app';
      const files = [];
      function walk(dir) {
        for (const f of fs.readdirSync(dir)) {
          const p = path.join(dir, f);
          try {
            const st = fs.statSync(p);
            if (st.isDirectory()) {
              if (f === 'node_modules' || f === '.git') continue;
              walk(p);
            } else if (st.isFile()) {
              if (p.endsWith('.js') || p.endsWith('.py') || p.endsWith('.jsx') || p.endsWith('.ts') || p.endsWith('.go') || p.endsWith('.java')) {
                files.push(p);
              }
            }
          } catch (err) { /* ignore */ }
        }
      }
      walk(workspace);
      const hits = [];
      for (const f of files.slice(0, 200)) {
        try {
          const txt = fs.readFileSync(f, 'utf8');
          if (txt.toLowerCase().includes(query.toLowerCase())) {
            hits.push(`${f}: ${txt.split('\n').find(l => l.toLowerCase().includes(query.toLowerCase())).slice(0,200)}`);
            if (hits.length >= 10) break;
          }
        } catch (e) {}
      }
      if (hits.length) return `Local code search results:\n\n${hits.join('\n\n')}`;
    } catch (e2) {
      // ignore
    }
  }
  return null;
}

app.post('/v1/complete', async (req, res) => {
  const body = req.body || {};
  const prompt = body.prompt || body.input || '';

  if (API_KEY) {
    // Proxy to Anthropic
    try {
      const headers = { 'Content-Type': 'application/json' };
      headers[API_KEY_HEADER] = API_KEY;
      const r = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        timeout: 30000,
      });
      const text = await r.text();
      res.status(r.status).contentType('application/json').send(text);
      return;
    } catch (err) {
      console.error('proxy forward failed', err);
      // Fall through to local fallback
    }
  }

  // Local limited responder
  if (!prompt) {
    return res.json({ completion: "Local fallback: provide a `prompt` in the body" });
  }

  // If prompt looks like a search, try local code search
  const search = simpleCodeSearch(prompt.split('\n')[0].slice(0,120));
  if (search) {
    return res.json({ completion: `Local fallback (code-search):\n\n${search}` });
  }

  // Otherwise, return a tiny heuristic reply
  const canned = `Local fallback responder: I don't have an API key configured. Provide the Anthropic API key in ANTHROPIC_API_KEY to enable Claude. Meanwhile, here's a very small suggestion for your prompt:\n\n- Summarize the goal in one sentence.\n- Show a minimal code example (3-6 lines).\n- Ask for edge cases.\n`;
  return res.json({ completion: canned });
});

app.get('/health', (req, res) => res.json({ ok: true, mode: API_KEY ? 'remote' : 'local' }));

app.listen(PORT, () => {
  console.log(`claude-proxy-local listening on http://localhost:${PORT}  mode=${API_KEY ? 'remote' : 'local'}`);
});
