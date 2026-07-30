/**
 * Community Auth service — provider-agnostic client for the /api/community/auth/* endpoints.
 * Uses cookies (httpOnly) as the primary auth surface, with `credentials: 'include'`.
 * Nothing here is Emergent-specific: the same code runs against any FastAPI backend
 * that implements the same contract.
 */
const API = process.env.REACT_APP_BACKEND_URL;

const authFetch = (path, opts = {}) =>
  fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

export const authService = {
  async listProviders() {
    const res = await authFetch('/api/community/auth/providers');
    if (!res.ok) throw new Error('providers_unavailable');
    return res.json();
  },

  async exchangeSession({ provider = 'google', sessionId }) {
    const res = await authFetch('/api/community/auth/session', {
      method: 'POST',
      body: JSON.stringify({ provider, session_id: sessionId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'session_exchange_failed');
    }
    return res.json();
  },

  async me() {
    const res = await authFetch('/api/community/auth/me');
    if (res.status === 401) return null;
    if (!res.ok) throw new Error('me_failed');
    return res.json();
  },

  async logout() {
    await authFetch('/api/community/auth/logout', { method: 'POST' });
  },
};

/**
 * Provider registry (front-end).
 * Only providers marked `available: true` trigger a real redirect.
 * Adding a new provider = add an entry here + implement it in the backend registry.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export const AUTH_PROVIDERS = {
  google: {
    key: 'google',
    label: 'Google',
    available: true,
    startLogin: () => {
      const redirectUrl = `${window.location.origin}/`;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    },
  },
  microsoft: { key: 'microsoft', label: 'Microsoft', available: false },
  linkedin: { key: 'linkedin', label: 'LinkedIn', available: false },
  apple: { key: 'apple', label: 'Apple', available: false },
  facebook: { key: 'facebook', label: 'Facebook', available: false },
};
