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

const asJsonOrThrow = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let detail = data?.detail || 'auth_failed';
    if (Array.isArray(detail)) {
      detail = detail
        .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
        .filter(Boolean)
        .join(' · ');
    } else if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
      detail = detail.msg;
    }
    const err = new Error(String(detail));
    err.status = res.status;
    throw err;
  }
  return data;
};

export const authService = {
  async listProviders() {
    const res = await authFetch('/api/community/auth/providers');
    if (!res.ok) throw new Error('providers_unavailable');
    return res.json();
  },

  async exchangeSession({ provider = 'google', sessionId }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/session', {
      method: 'POST',
      body: JSON.stringify({ provider, session_id: sessionId }),
    }));
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

  // Native email / password
  async registerEmail({ email, password, name }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }));
  },

  async loginEmail({ email, password }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }));
  },

  async forgotPassword({ email }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }));
  },

  async resetPassword({ token, password }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }));
  },

  // Email verification
  async sendEmailVerification({ email } = {}) {
    return asJsonOrThrow(await authFetch('/api/community/auth/verify/send', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    }));
  },

  async confirmEmailVerification({ token }) {
    return asJsonOrThrow(await authFetch('/api/community/auth/verify/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }));
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
  linkedin: {
    key: 'linkedin', label: 'LinkedIn', available: false,
    startLogin: () => {
      window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/community/auth/oauth/linkedin/start`;
    },
  },
  microsoft: {
    key: 'microsoft', label: 'Microsoft', available: false,
    startLogin: () => {
      window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/community/auth/oauth/microsoft/start`;
    },
  },
  apple: { key: 'apple', label: 'Apple', available: false },
  facebook: { key: 'facebook', label: 'Facebook', available: false },
  twitter: { key: 'twitter', label: 'X', available: false },
};
