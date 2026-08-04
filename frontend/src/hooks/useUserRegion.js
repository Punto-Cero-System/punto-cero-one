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
const CITY_STORAGE_KEY = 'pcone_city';

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

const guessFromTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const TZ_TO_COUNTRY = {
      'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Mexico_City': 'MX',
      'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR',
      'America/Santiago': 'CL', 'America/Caracas': 'VE',
      'America/Guayaquil': 'EC', 'America/La_Paz': 'BO',
      'America/Asuncion': 'PY', 'America/Montevideo': 'UY',
      'America/Sao_Paulo': 'BR', 'America/Recife': 'BR',
      'America/Panama': 'PA', 'America/Costa_Rica': 'CR',
      'America/Managua': 'NI', 'America/El_Salvador': 'SV',
      'America/Guatemala': 'GT', 'America/Tegucigalpa': 'HN',
      'America/Havana': 'CU', 'America/Santo_Domingo': 'DO',
      'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES',
      'America/New_York': 'US', 'America/Los_Angeles': 'US',
      'America/Chicago': 'US', 'America/Denver': 'US',
    };
    return TZ_TO_COUNTRY[tz] || null;
  } catch { return null; }
};

const detectFromBackend = async () => {
  try {
    const r = await fetch(`${BACKEND}/api/community/region/detect`, {
      credentials: 'include',
    });
    if (!r.ok) return null;
    const data = await r.json();
    return { country: data.country, city: data.city, method: data.method };
  } catch { return null; }
};

export default function useUserRegion() {
  const { user, refresh } = useCommunityAuth();
  const [localCountry, setLocalCountry] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });
  const [localCity, setLocalCity] = useState(() => {
    try { return localStorage.getItem(CITY_STORAGE_KEY) || null; } catch { return null; }
  });
  const [detectedMethod, setDetectedMethod] = useState(null);

  // Auto-detect on first mount when nothing is stored yet. Chain:
  //   IP lookup (backend, ipapi.co) → navigator.language → Intl timezone → CO.
  useEffect(() => {
    if (localCountry) return;
    if (user && user.country) return;
    let cancelled = false;
    (async () => {
      const back = await detectFromBackend();
      if (cancelled) return;
      let code = back?.country || null;
      let city = back?.city || null;
      let method = back?.method || null;
      if (!code) {
        code = guessFromNavigator();
        method = code ? 'language' : null;
      }
      if (!code) {
        code = guessFromTimezone();
        method = code ? 'timezone' : null;
      }
      if (!code) {
        code = 'CO';
        method = 'default';
      }
      setLocalCountry(code);
      setLocalCity(city);
      setDetectedMethod(method);
      try {
        localStorage.setItem(STORAGE_KEY, code);
        if (city) localStorage.setItem(CITY_STORAGE_KEY, city);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [localCountry, user]);

  const country = (user && user.country) || localCountry || null;
  const city = (user && user.city) || localCity || null;

  const setRegion = useCallback(async (code) => {
    if (!code || typeof code !== 'string') return;
    const normalized = code.toUpperCase();
    setLocalCountry(normalized);
    setDetectedMethod('manual');
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
    city,
    method: user?.country_source || detectedMethod,
    setRegion,
    supported: LATAM_COUNTRIES,
  };
}
