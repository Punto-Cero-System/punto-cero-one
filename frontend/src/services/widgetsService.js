/**
 * Widgets service — external live data (crypto, weather, fx, rss, youtube).
 * Every call returns a WidgetResponse-shaped object:
 *   { status: 'ACTIVE'|'MOCK'|'CONFIG_PENDING'|'ERROR', source, data, updated_at, error }
 */
const API = process.env.REACT_APP_BACKEND_URL;

const j = (path) => fetch(`${API}${path}`, { credentials: 'include' })
  .then((r) => r.ok ? r.json() : Promise.reject(new Error(`widget ${path} ${r.status}`)));

export const widgetsService = {
  crypto: (params = {}) => j(`/api/widgets/crypto?${new URLSearchParams(params)}`),
  weather: (city) => j(`/api/widgets/weather${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  fx: (params = {}) => j(`/api/widgets/fx?${new URLSearchParams(params)}`),
  rss: (params = {}) => j(`/api/widgets/rss?${new URLSearchParams(params)}`),
  youtube: (params = {}) => j(`/api/widgets/youtube?${new URLSearchParams(params)}`),
  all: () => j('/api/widgets/all'),
};
