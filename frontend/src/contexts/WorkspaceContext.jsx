/**
 * WorkspaceContext — Mi Espacio state, syncs with `/api/workspace/me`.
 *
 * Public API
 * ----------
 *   const {
 *     workspace,         // resolved workspace ({panels, widgets, theme})
 *     defaults,          // server-provided default template
 *     ready,             // boolean — true once initial load completes
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
import { useCommunityAuth } from './CommunityAuthContext';

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
          // Anonymous — pull just the defaults (a lightweight endpoint would be nice
          // but calling /api/workspace/me for anon returns 401, so we synthesise
          // the same template client-side. The list of default IDs must stay in sync
          // with the backend; the widget registry keeps them centralised anyway).
          const fallback = {
            layout_version: 1,
            panels: {
              left: ['profile-card', 'nuestra-historia', 'activity', 'groups', 'quick-links', 'weather-mini', 'calendar-mini', 'podcast-mini'],
              center: ['welcome-band', 'feed', 'inline-stats'],
              right: ['messages', 'trending-companies', 'rss-news', 'trending', 'trending-editorial', 'events', 'discover-entities', 'companies', 'investor-center', 'ai-tools', 'crypto-live', 'fx-live', 'weather-live', 'youtube-live', 'markets', 'ai-of-the-day', 'poll', 'launches', 'courses', 'marketplace', 'suggested-people', 'capital-cta'],
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

  const value = useMemo(() => ({
    workspace, defaults, ready,
    isWidgetEnabled, isWidgetCollapsed,
    toggleWidget, toggleCollapse, setWidgetPref,
    moveWidget, reorderPanel,
    resetWorkspace, save, applyPreset,
  }), [workspace, defaults, ready, isWidgetEnabled, isWidgetCollapsed,
       toggleWidget, toggleCollapse, setWidgetPref, moveWidget, reorderPanel, resetWorkspace, save, applyPreset]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
