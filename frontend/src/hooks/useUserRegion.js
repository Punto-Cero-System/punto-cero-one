/**
 * useUserRegion — expone el país efectivo del visitante y permite cambiarlo.
 *
 * Priority chain (mirror of the backend `_resolve_user_country`):
 *   1. authenticated user's stored `country`
 *   2. localStorage 'pcone_country' (client-side fallback)
 *   3. navigator.language mapped to a supported ISO code
 *
 * Consumers use `region.country` for read + `setRegion(code)` for write.
 * When authenticated, `setRegion` also persists to the backend via
 * `PATCH /api/community/auth/me/region` so all subsequent Discovery /
 * Trending / Search calls apply the country weighting on the server side.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'pcone_country';

export const LATAM_COUNTRIES = {
  AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CL: 'Chile', CO: 'Colombia',
  CR: 'Costa Rica', CU: 'Cuba', DO: 'República Dominicana', EC: 'Ecuador',
  SV: 'El Salvador', GT: 'Guatemala', HN: 'Honduras', MX: 'México',
  NI: 'Nicaragua', PA: 'Panamá', PY: 'Paraguay', PE: 'Perú', UY: 'Uruguay',
  VE: 'Venezuela', ES: 'España', US: 'Estados Unidos',
};

export const COUNTRY_FLAGS = {
  AR: '🇦🇷', BO: '🇧🇴', BR: '🇧🇷', CL: '🇨🇱', CO: '🇨🇴', CR: '🇨🇷', CU: '🇨🇺',
  DO: '🇩🇴', EC: '🇪🇨', SV: '🇸🇻', GT: '🇬🇹', HN: '🇭🇳', MX: '🇲🇽', NI: '🇳🇮',
  PA: '🇵🇦', PY: '🇵🇾', PE: '🇵🇪', UY: '🇺🇾', VE: '🇻🇪', ES: '🇪🇸', US: '🇺🇸',
};

const guessFromNavigator = () => {
  try {
    const langs = [
      navigator.language,
      ...(navigator.languages || []),
    ].filter(Boolean);
    for (const l of langs) {
      const parts = l.split('-');
      if (parts.length >= 2) {
        const code = parts[1].toUpperCase();
        if (LATAM_COUNTRIES[code]) return code;
      }
    }
  } catch { /* SSR / restricted contexts */ }
  return null;
};

export default function useUserRegion() {
  const { user, refresh } = useCommunityAuth();
  const [localCountry, setLocalCountry] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  useEffect(() => {
    if (!localCountry) {
      const guess = guessFromNavigator();
      if (guess) {
        setLocalCountry(guess);
        try { localStorage.setItem(STORAGE_KEY, guess); } catch { /* ignore */ }
      }
    }
  }, [localCountry]);

  const country = (user && user.country) || localCountry || null;

  const setRegion = useCallback(async (code) => {
    if (!code || typeof code !== 'string') return;
    const normalized = code.toUpperCase();
    setLocalCountry(normalized);
    try { localStorage.setItem(STORAGE_KEY, normalized); } catch { /* ignore */ }
    if (user?.id) {
      try {
        await fetch(`${BACKEND}/api/community/auth/me/region`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ country: normalized }),
        });
        await refresh();
      } catch { /* silent — localStorage fallback still works */ }
    }
  }, [user?.id, refresh]);

  return {
    country,
    label: country ? (LATAM_COUNTRIES[country] || country) : null,
    flag: country ? (COUNTRY_FLAGS[country] || '🌎') : '🌎',
    setRegion,
    supported: LATAM_COUNTRIES,
  };
}
