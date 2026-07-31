/**
 * workspaceService — persistence for Mi Espacio.
 *
 *   getMine()               → { workspace, defaults }
 *   save(workspace)         → PUT full replacement
 *   patch(partial)          → PATCH partial update
 *   reset()                 → wipe + return defaults
 *
 * All calls are cookie-authenticated (community session).
 */
const API = process.env.REACT_APP_BACKEND_URL;

const asJson = (r) => (r.ok ? r.json() : Promise.reject(new Error(`workspace ${r.status}`)));

export const workspaceService = {
  getMine: () => fetch(`${API}/api/workspace/me`, { credentials: 'include' }).then(asJson),

  save: (workspace) => fetch(`${API}/api/workspace/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(workspace),
  }).then(asJson),

  patch: (partial) => fetch(`${API}/api/workspace/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(partial),
  }).then(asJson),

  reset: () => fetch(`${API}/api/workspace/me/reset`, {
    method: 'POST',
    credentials: 'include',
  }).then(asJson),
};
