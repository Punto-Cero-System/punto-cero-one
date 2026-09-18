import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { profileService } from '../services/profileService';
import { useCommunityAuth } from './CommunityAuthContext';

/**
 * UIPreferencesContext — loads the authenticated user's ui_preferences and
 * applies them globally via CSS variables + a data-theme attribute on <html>.
 *
 * Design:
 *   • Variables set on :root so ANY component can read them without prop drilling.
 *   • The frontend does NOT force these variables on the existing screens —
 *     screens that opt-in reference `var(--pc-primary)` etc. This preserves the
 *     current visual identity for the base UX while giving users a knob to
 *     personalize accent colors + theme.
 *   • Preferences persist in the users document. This context is the single
 *     write-through cache — updating here immediately reflects in the DOM and
 *     schedules an autosave (debounced) to /api/community/users/me.
 */
const DEFAULTS = {
  theme: 'auto',
  primary_color: '#00C896',
  secondary_color: '#06B6D4',
  accent_color: '#D4AF37',
  button_color: '#0B1F3A',
  gradient: 'linear-gradient(135deg, #00C896 0%, #06B6D4 100%)',
  background_url: null,
};

const UIPreferencesContext = createContext(null);

const resolveTheme = (theme) => {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const applyToDocument = (prefs) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--pc-primary', prefs.primary_color || DEFAULTS.primary_color);
  root.style.setProperty('--pc-secondary', prefs.secondary_color || DEFAULTS.secondary_color);
  root.style.setProperty('--pc-accent', prefs.accent_color || DEFAULTS.accent_color);
  root.style.setProperty('--pc-button', prefs.button_color || DEFAULTS.button_color);
  root.style.setProperty('--pc-gradient', prefs.gradient || DEFAULTS.gradient);
  root.setAttribute('data-theme', resolveTheme(prefs.theme));
  if (prefs.background_url) {
    root.style.setProperty('--pc-background-url', `url("${prefs.background_url}")`);
  } else {
    root.style.removeProperty('--pc-background-url');
  }
};

export const UIPreferencesProvider = ({ children }) => {
  const { user } = useCommunityAuth();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [savingTick, setSavingTick] = useState(0);

  // Load once when the user resolves.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || typeof user !== 'object') {
        setPrefs(DEFAULTS);
        setReady(true);
        applyToDocument(DEFAULTS);
        return;
      }
      try {
        const p = await profileService.me();
        if (cancelled) return;
        const merged = { ...DEFAULTS, ...(p.ui_preferences || {}) };
        setPrefs(merged);
        applyToDocument(merged);
      } catch { /* ignore — fall back to defaults */ }
      finally { if (!cancelled) setReady(true); }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  // Debounced autosave whenever prefs change (only if authenticated).
  useEffect(() => {
    if (!ready || !user || typeof user !== 'object') return;
    const t = setTimeout(() => {
      profileService.patch({ ui_preferences: prefs }).catch(() => {});
      setSavingTick((n) => n + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [prefs, ready, user]);

  const update = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      applyToDocument(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULTS);
    applyToDocument(DEFAULTS);
  }, []);

  const value = useMemo(() => ({ prefs, ready, update, reset, savingTick, DEFAULTS }),
    [prefs, ready, update, reset, savingTick]);

  return (
    <UIPreferencesContext.Provider value={value}>
      {children}
    </UIPreferencesContext.Provider>
  );
};

export const useUIPreferences = () => {
  const ctx = useContext(UIPreferencesContext);
  if (!ctx) throw new Error('useUIPreferences must be used within UIPreferencesProvider');
  return ctx;
};
