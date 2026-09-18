/**
 * Core Services front-end clients — Notifications, Messaging, Search, Admin.
 * Every future vertical consumes these same functions.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const fj = (path, opts = {}) =>
  fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });

const throwOnError = async (res) => {
  if (res.ok) return res.json();
  let detail = 'request_failed';
  try { detail = (await res.json())?.detail || detail; } catch { /* noop */ }
  const err = new Error(detail); err.status = res.status; throw err;
};

const qs = (o = {}) => {
  const q = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, String(v)); });
  return q.toString();
};

export const notificationService = {
  list: (params) => fj(`/api/notifications?${qs(params)}`).then(throwOnError),
  markRead: (id, unread = false) => fj(`/api/notifications/${id}/read?unread=${unread}`, { method: 'POST' }).then(throwOnError),
  markAllRead: () => fj('/api/notifications/mark-all-read', { method: 'POST' }).then(throwOnError),
  remove: (id) => fj(`/api/notifications/${id}`, { method: 'DELETE' }).then(throwOnError),
  preferences: () => fj('/api/notifications/preferences').then(throwOnError),
  updatePreferences: (body) => fj('/api/notifications/preferences', { method: 'PATCH', body: JSON.stringify(body) }).then(throwOnError),
};

export const messagingService = {
  listConversations: () => fj('/api/messages/conversations').then(throwOnError),
  createOrGet: (body) => fj('/api/messages/conversations', { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
  listMessages: (convId, before) => fj(`/api/messages/conversations/${convId}/messages?${qs({ before })}`).then(throwOnError),
  send: (convId, body) => fj(`/api/messages/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
};

export const searchService = {
  search: (q, opts = {}) => fj(`/api/search?${qs({ q, ...opts })}`).then(throwOnError),
  suggest: (q, limit = 8) => fj(`/api/search/suggest?${qs({ q, limit })}`).then(throwOnError),
};

const authHeaders = () => {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('pcl_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export const adminPlatformService = {
  users: (params) => fj(`/api/admin/users?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  companies: (params) => fj(`/api/admin/companies?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  posts: (params) => fj(`/api/admin/posts?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  jobs: (params) => fj(`/api/admin/jobs?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  events: (params) => fj(`/api/admin/events?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  reports: (params) => fj(`/api/admin/reports?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  activity: (params) => fj(`/api/admin/activity?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  updateUserRole: (id, role) => fj(`/api/admin/users/${id}/role`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ role }) }).then(throwOnError),
  summary: () => fj('/api/analytics/summary', { headers: authHeaders() }).then(throwOnError),
};

export const adminSourcesService = {
  list: (params) => fj(`/api/admin/sources?${qs(params)}`, { headers: authHeaders() }).then(throwOnError),
  kinds: () => fj('/api/admin/sources/kinds', { headers: authHeaders() }).then(throwOnError),
  get: (id) => fj(`/api/admin/sources/${id}`, { headers: authHeaders() }).then(throwOnError),
  create: (body) => fj('/api/admin/sources', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(throwOnError),
  update: (id, body) => fj(`/api/admin/sources/${id}`, {
    method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(throwOnError),
  remove: (id) => fj(`/api/admin/sources/${id}`, { method: 'DELETE', headers: authHeaders() }).then(throwOnError),
  toggle: (id) => fj(`/api/admin/sources/${id}/toggle`, { method: 'POST', headers: authHeaders() }).then(throwOnError),
  sync: (id) => fj(`/api/admin/sources/${id}/sync`, { method: 'POST', headers: authHeaders() }).then(throwOnError),
  test: (id) => fj(`/api/admin/sources/${id}/test`, { method: 'POST', headers: authHeaders() }).then(throwOnError),
  logs: (id, limit = 25) => fj(`/api/admin/sources/${id}/logs?limit=${limit}`, { headers: authHeaders() }).then(throwOnError),
  bulkImport: (items) => fj('/api/admin/sources/import', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  }).then(throwOnError),
  importFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fj('/api/admin/sources/import', { method: 'POST', headers: authHeaders(), body: fd }).then(throwOnError);
  },
  exportJson: () => fj('/api/admin/sources/export?fmt=json', { headers: authHeaders() }).then(throwOnError),
};
