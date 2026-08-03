/**
 * Business platform services — Companies, Jobs, Events, Profile.
 * Same contract shape as feedService: cookies always included, thin fetch wrappers.
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
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
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

const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, String(v));
  });
  return qs.toString();
};

export const companyService = {
  list: (params) => fj(`/api/companies?${buildQuery(params)}`).then(throwOnError),
  get: (idOrSlug) => fj(`/api/companies/${idOrSlug}`).then(throwOnError),
  create: (body) => fj('/api/companies', { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
  update: (id, body) => fj(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(throwOnError),
  remove: (id) => fj(`/api/companies/${id}`, { method: 'DELETE' }).then(throwOnError),
  follow: (id) => fj(`/api/companies/${id}/follow`, { method: 'POST' }).then(throwOnError),
};

export const jobService = {
  list: (params) => fj(`/api/jobs?${buildQuery(params)}`).then(throwOnError),
  get: (id) => fj(`/api/jobs/${id}`).then(throwOnError),
  create: (body) => fj('/api/jobs', { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
  update: (id, body) => fj(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(throwOnError),
  remove: (id) => fj(`/api/jobs/${id}`, { method: 'DELETE' }).then(throwOnError),
  save: (id) => fj(`/api/jobs/${id}/save`, { method: 'POST' }).then(throwOnError),
  apply: (id, body) => fj(`/api/jobs/${id}/apply`, { method: 'POST', body: JSON.stringify(body || {}) }).then(throwOnError),
  applications: (id) => fj(`/api/jobs/${id}/applications`).then(throwOnError),
  updateApplicationStatus: (applicationId, status) =>
    fj(`/api/applications/${applicationId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }).then(throwOnError),
  myApplications: () => fj('/api/me/applications').then(throwOnError),
};

export const eventService = {
  list: (params) => fj(`/api/events?${buildQuery(params)}`).then(throwOnError),
  get: (id) => fj(`/api/events/${id}`).then(throwOnError),
  create: (body) => fj('/api/events', { method: 'POST', body: JSON.stringify(body) }).then(throwOnError),
  update: (id, body) => fj(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(throwOnError),
  remove: (id) => fj(`/api/events/${id}`, { method: 'DELETE' }).then(throwOnError),
  rsvp: (id, status) => fj(`/api/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }).then(throwOnError),
  attendees: (id) => fj(`/api/events/${id}/attendees`).then(throwOnError),
};

export const profileService = {
  me: () => fj('/api/community/users/me').then(throwOnError),
  updateMe: (body) => fj('/api/community/users/me', { method: 'PATCH', body: JSON.stringify(body) }).then(throwOnError),
  publicProfile: (userId) => fj(`/api/community/users/${userId}`).then(throwOnError),
};

export const discoveryService = {
  related: (slug) => fj(`/api/discovery/entity/${encodeURIComponent(slug)}/related`).then(throwOnError),
  suggested: (limit = 10) => fj(`/api/discovery/suggested?limit=${limit}`).then(throwOnError),
  trending: (limit = 8, hours = 48) =>
    fj(`/api/discovery/trending?limit=${limit}&hours=${hours}`).then(throwOnError),
};
