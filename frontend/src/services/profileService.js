/**
 * profileService — client for /api/community/users/* (self profile + media).
 * All requests carry the httpOnly session cookie.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const asJson = async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    let detail = d?.detail || 'profile_failed';
    if (Array.isArray(detail)) {
      detail = detail.map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e))).join(' · ');
    }
    const err = new Error(String(detail));
    err.status = r.status;
    throw err;
  }
  return d;
};

export const profileService = {
  me: () => fetch(`${API}/api/community/users/me`, { credentials: 'include' }).then(asJson),

  patch: (patch) => fetch(`${API}/api/community/users/me`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(asJson),

  uploadMedia: (slot, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API}/api/community/users/me/media/${slot}`, {
      method: 'PUT', credentials: 'include', body: fd,
    }).then(asJson);
  },

  deleteMedia: (slot) => fetch(`${API}/api/community/users/me/media/${slot}`, {
    method: 'DELETE', credentials: 'include',
  }).then(asJson),

  publicProfile: (userId) => fetch(`${API}/api/community/users/${userId}`, { credentials: 'include' }).then(asJson),
};
