/**
 * accessBridgeClient.js — FASE 6: cliente fetch puro hacia /api/access/*.
 *
 * Solo lectura + preparación de intent. No toca AuthContext ni login.
 * Usa pcl_token si existe (mismo almacenamiento actual).
 */

const API = process.env.REACT_APP_BACKEND_URL || '';

function authHeaders() {
  try {
    const token = localStorage.getItem('pcl_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function fetchSpaces() {
  const res = await fetch(`${API}/api/access/spaces`);
  if (!res.ok) throw new Error(`spaces:${res.status}`);
  return res.json();
}

export async function fetchEntitlements() {
  const res = await fetch(`${API}/api/access/entitlements`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`entitlements:${res.status}`);
  return res.json();
}

export async function createIntent(spaceKey, context = {}) {
  const res = await fetch(`${API}/api/access/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ space_key: spaceKey, context }),
  });
  if (!res.ok) throw new Error(`intent:${res.status}`);
  return res.json();
}
