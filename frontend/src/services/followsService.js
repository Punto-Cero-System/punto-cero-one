/**
 * followsService — unified Social Graph client.
 *
 * Every entity type reachable via one API:
 *   follow('user', 'u_abc')
 *   follow('hashtag', 'legal')
 *   follow('country', 'CO')
 *
 * Companies keep working through the legacy /api/companies/{id}/follow too;
 * this service is a superset.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const asJson = (r) => (r.ok ? r.json() : Promise.reject(new Error(`follows ${r.status}`)));

export const followsService = {
  follow: (type, id) => fetch(`${API}/api/follows/${type}/${encodeURIComponent(id)}`,
    { method: 'POST', credentials: 'include' }).then(asJson),

  unfollow: (type, id) => fetch(`${API}/api/follows/${type}/${encodeURIComponent(id)}`,
    { method: 'DELETE', credentials: 'include' }).then(asJson),

  bulkStatus: (type, ids) => fetch(
    `${API}/api/follows/status?type=${type}&ids=${ids.map(encodeURIComponent).join(',')}`,
    { credentials: 'include' },
  ).then(asJson),

  me: () => fetch(`${API}/api/follows/me`, { credentials: 'include' }).then(asJson),

  count: (type, id) => fetch(
    `${API}/api/follows/${type}/${encodeURIComponent(id)}/count`,
  ).then(asJson),

  // Followers/Following lists — reuse existing `follows` collection.
  listFollowers: (userId, limit = 50) => fetch(
    `${API}/api/follows/user/${encodeURIComponent(userId)}/followers?limit=${limit}`,
    { credentials: 'include' },
  ).then(asJson),

  listFollowing: (userId, limit = 50) => fetch(
    `${API}/api/follows/user/${encodeURIComponent(userId)}/following?limit=${limit}`,
    { credentials: 'include' },
  ).then(asJson),
};
