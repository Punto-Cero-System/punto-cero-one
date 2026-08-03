/**
 * Feed service — thin fetch wrappers around /api/feed/*.
 * All requests use `credentials: 'include'` so the community httpOnly cookie is
 * automatically attached; unauthenticated callers still get public posts.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const _regionHeader = () => {
  try {
    const c = localStorage.getItem('pcone_country');
    return c ? { 'X-Region-Country': c } : {};
  } catch { return {}; }
};

const fj = (path, opts = {}) =>
  fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ..._regionHeader(),
      ...(opts.headers || {}),
    },
  });

const throwOnError = async (res) => {
  if (res.ok) return res.json();
  let detail = 'request_failed';
  try { detail = (await res.json())?.detail || detail; } catch { /* noop */ }
  const err = new Error(detail);
  err.status = res.status;
  throw err;
};

export const feedService = {
  listPosts: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return fj(`/api/feed/posts?${qs.toString()}`).then(throwOnError);
  },
  createPost: (body) =>
    fj('/api/feed/posts', { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
  getPost: (id) => fj(`/api/feed/posts/${id}`).then(throwOnError),
  deletePost: (id) => fj(`/api/feed/posts/${id}`, { method: 'DELETE' }).then(throwOnError),

  listComments: (postId) => fj(`/api/feed/posts/${postId}/comments`).then(throwOnError),
  addComment: (postId, body) =>
    fj(`/api/feed/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }).then(throwOnError),

  react: (postId, kind) =>
    fj(`/api/feed/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ kind }) }).then(throwOnError),
  toggleSave: (postId) =>
    fj(`/api/feed/posts/${postId}/save`, { method: 'POST' }).then(throwOnError),
  share: (postId, destination) =>
    fj(`/api/feed/posts/${postId}/share`, { method: 'POST', body: JSON.stringify({ destination }) }).then(throwOnError),
  view: (postId, sessionId) =>
    fj(`/api/feed/posts/${postId}/view`, { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }).then(throwOnError),

  trending: () => fj('/api/feed/trending').then(throwOnError),
  forYou: (limit = 20) => fj(`/api/feed/for-you?limit=${limit}`).then(throwOnError),
  report: (postId, reason) =>
    fj(`/api/feed/posts/${postId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }).then(throwOnError),
};

export const categoryService = {
  list: (group) => {
    const qs = new URLSearchParams();
    if (group) qs.set('group', group);
    return fj(`/api/categories?${qs.toString()}`).then(throwOnError);
  },
};

export const growthService = {
  feed: ({ limit = 20, country, vertical } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (country) qs.set('country', country);
    if (vertical) qs.set('vertical', vertical);
    return fj(`/api/growth/feed?${qs.toString()}`).then(throwOnError);
  },
};

/** Ephemeral session id for anonymous view dedupe. */
export const getViewSessionId = () => {
  const KEY = 'pc_view_session';
  let s = sessionStorage.getItem(KEY);
  if (!s) {
    s = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, s);
  }
  return s;
};
