/**
 * WorkspaceContext — Mi Espacio state, syncs with `/api/workspace/me`.
 *
 * Public API
 * ----------
 *   const {
 *     workspace,         // resolved workspace ({panels, widgets, theme})
 *     defaults,          // server-provided default template
 *     ready,             // boolean — true once initial load completes
 *     identity,          // 'personal' | 'profesional' | 'empresa' | future
 *     identityDef,       // full identity def (label, accent, copy, Icon)
 *     applyIdentity,     // (key) => switch Mi Espacio to that recommended layout
 *     selectIdentity,    // (key) => change identity only (copy/accent, no layout)
 *     isWidgetEnabled,   // (id) => bool
 *     isWidgetCollapsed, // (id) => bool
 *     toggleWidget,      // (id) => optimistic enabled toggle
 *     toggleCollapse,    // (id) => optimistic collapsed toggle
 *     moveWidget,        // (id, toPanel, toIndex?) => moves across panels
 *     reorderPanel,      // (panel, ids[]) => explicit re-order
 *     resetWorkspace,    // () => wipe and load defaults
 *     save,              // () => manual full save (autosave already on)
 *   } = useWorkspace();
 *
 * Anonymous users get the default template without any network call.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { workspaceService } from '../services/workspaceService';
import { buildPayloadFromPreset, getPreset } from '../services/workspacePresets';
import { buildPayloadFromIdentity, getIdentity, resolveIdentity } from '../config/workspaceIdentity';
import { useCommunityAuth } from './CommunityAuthContext';

/**
 * Identity of Mi Espacio is a UI preference (which recommended layout the
 * user picked). It is namespaced and read once on mount. Widget *positions*
 * are NOT stored here — those go through `/api/workspace/me` exactly as before.
 * Trade-off (documented, not hidden): the identity choice is per-browser, it
 * does not follow the user to another device. Promoting it to the backend is a
 * one-field follow-up and was left out to avoid touching the API in this phase.
 */
const IDENTITY_STORAGE_KEY = 'pc.mi-espacio.identity';

const readStoredIdentity = () => {
  try {
    return window.localStorage.getItem(IDENTITY_STORAGE_KEY) || null;
  } catch {
    return null;   // private mode / storage disabled — fall back to default
  }
};

const storeIdentity = (key) => {
  try {
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, key);
  } catch { /* no-op: the workspace itself is still applied */ }
};

const DEFAULT_WORKSPACE = {
  layout_version: 1,
  panels: { left: [], center: [], right: [] },
  widgets: {},
  theme: 'auto',
};

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE);
  const [defaults, setDefaults] = useState(DEFAULT_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState(() => resolveIdentity({ choice: readStoredIdentity() }));
  const saveTimer = useRef(null);
  const skipNextSave = useRef(true); // skip save on initial hydration

  /* ---------- Load once we know the auth state ---------- */
  useEffect(() => {
    if (user === undefined) return; // still resolving
    let cancelled = false;
    (async () => {
      try {
        if (isAuthed) {
          const { workspace: ws, defaults: dfs } = await workspaceService.getMine();
          if (!cancelled) {
            skipNextSave.current = true;
            setDefaults(dfs || DEFAULT_WORKSPACE);
            // If the user hasn't saved anything yet the API returns the defaults verbatim.
            setWorkspace(ws || dfs || DEFAULT_WORKSPACE);
          }
        } else {
          // Anonymous — minimalist Home per user directive: solo Feed +
          // 1 noticia + 1 empleo + 1 evento + 1 recomendación. Todo el
          // resto se descubre navegando a cada módulo especializado.
          const fallback = {
            layout_version: 1,
            panels: {
              left: ['profile-card', 'activity', 'quick-links'],
              center: ['welcome-band', 'feed', 'inline-stats'],
              right: ['rss-news', 'events', 'suggested-people'],
            },
            widgets: {},
            theme: 'auto',
          };
          if (!cancelled) {
            skipNextSave.current = true;
            setDefaults(fallback);
            setWorkspace(fallback);
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthed, user]);

  /* ---------- Autosave (debounced) — only for authed users ---------- */
  useEffect(() => {
    if (!ready || !isAuthed) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      workspaceService.save(workspace).catch(() => { /* soft-fail: keep local state */ });
    }, 500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [workspace, ready, isAuthed]);

  /* ---------- Helpers ---------- */
  const isWidgetEnabled = useCallback((id) => {
    const p = workspace.widgets?.[id];
    if (!p) return true;
    return p.enabled !== false;
  }, [workspace]);

  const isWidgetCollapsed = useCallback((id) => !!workspace.widgets?.[id]?.collapsed, [workspace]);

  const setWidgetPref = useCallback((id, patch) => {
    setWorkspace((ws) => {
      const current = ws.widgets?.[id] || { enabled: true, collapsed: false, size: 'md' };
      return { ...ws, widgets: { ...ws.widgets, [id]: { ...current, ...patch } } };
    });
  }, []);

  const toggleWidget = useCallback((id) => {
    setWorkspace((ws) => {
      const current = ws.widgets?.[id] || { enabled: true, collapsed: false, size: 'md' };
      return { ...ws, widgets: { ...ws.widgets, [id]: { ...current, enabled: !current.enabled } } };
    });
  }, []);

  const toggleCollapse = useCallback((id) => {
    setWorkspace((ws) => {
      const current = ws.widgets?.[id] || { enabled: true, collapsed: false, size: 'md' };
      return { ...ws, widgets: { ...ws.widgets, [id]: { ...current, collapsed: !current.collapsed } } };
    });
  }, []);

  const moveWidget = useCallback((id, toPanel, toIndex = null) => {
    setWorkspace((ws) => {
      const panels = { left: [...(ws.panels.left || [])], center: [...(ws.panels.center || [])], right: [...(ws.panels.right || [])] };
      for (const key of Object.keys(panels)) {
        panels[key] = panels[key].filter((w) => w !== id);
      }
      const arr = panels[toPanel];
      if (toIndex === null || toIndex < 0 || toIndex > arr.length) arr.push(id);
      else arr.splice(toIndex, 0, id);
      panels[toPanel] = arr;
      return { ...ws, panels };
    });
  }, []);

  const reorderPanel = useCallback((panel, ids) => {
    setWorkspace((ws) => ({ ...ws, panels: { ...ws.panels, [panel]: ids } }));
  }, []);

  const resetWorkspace = useCallback(async () => {
    if (!isAuthed) {
      setWorkspace(defaults);
      return;
    }
    const { workspace: fresh } = await workspaceService.reset();
    skipNextSave.current = true;
    setWorkspace(fresh);
  }, [isAuthed, defaults]);

  const save = useCallback(async () => {
    if (!isAuthed) return null;
    return workspaceService.save(workspace);
  }, [isAuthed, workspace]);

  const applyPreset = useCallback((presetId) => {
    const preset = getPreset(presetId);
    if (!preset) return null;
    const payload = buildPayloadFromPreset(preset, workspace.widgets);
    setWorkspace(payload);
    return preset;
  }, [workspace.widgets]);

  /**
   * applyIdentity — switches Mi Espacio to the recommended layout of an
   * identity (personal | profesional | empresa | future ones).
   *
   * It reuses the SAME state path as applyPreset: setWorkspace + the existing
   * debounced autosave. It only changes the initial order and the recommended
   * widgets; per-widget preferences (enabled/collapsed/size) are preserved.
   * It NEVER registers, removes or hides a widget in workspaceRegistry.
   */
  const applyIdentity = useCallback((key) => {
    const resolved = resolveIdentity({ choice: key });
    const payload = buildPayloadFromIdentity(resolved, workspace.widgets);
    setIdentity(resolved);
    storeIdentity(resolved);
    setWorkspace(payload);
    return getIdentity(resolved);
  }, [workspace.widgets]);

  /** Cambiar identidad sin reescribir el layout actual (solo textos y acento). */
  const selectIdentity = useCallback((key) => {
    const resolved = resolveIdentity({ choice: key });
    setIdentity(resolved);
    storeIdentity(resolved);
    return getIdentity(resolved);
  }, []);

  const identityDef = getIdentity(identity);

  const value = useMemo(() => ({
    workspace, defaults, ready,
    identity, identityDef, applyIdentity, selectIdentity,
    isWidgetEnabled, isWidgetCollapsed,
    toggleWidget, toggleCollapse, setWidgetPref,
    moveWidget, reorderPanel,
    resetWorkspace, save, applyPreset,
  }), [workspace, defaults, ready, identity, identityDef, applyIdentity, selectIdentity,
       isWidgetEnabled, isWidgetCollapsed,
       toggleWidget, toggleCollapse, setWidgetPref, moveWidget, reorderPanel, resetWorkspace, save, applyPreset]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
