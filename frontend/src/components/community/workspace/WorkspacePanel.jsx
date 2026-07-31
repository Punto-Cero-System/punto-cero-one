/**
 * WorkspacePanel — renders a panel (left | center | right) driven by
 * WorkspaceContext. Iterates over the ordered widget IDs, resolves each
 * one against the Widget Registry, and renders the component wrapped in
 * the workspace shell (which shows edit-mode chrome only when `editing`
 * is true).
 */
import React from 'react';
import { getWidget } from '../../../services/workspaceRegistry';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import Shell from './WorkspaceWidgetShell';

const WorkspacePanel = ({ panel = 'left', editing = false, gap = '0.85rem', testid }) => {
  const { workspace, isWidgetEnabled, isWidgetCollapsed, toggleWidget, toggleCollapse } = useWorkspace();
  const ids = workspace?.panels?.[panel] || [];

  return (
    <div data-testid={testid || `workspace-panel-${panel}`}
      style={{ display: 'flex', flexDirection: 'column', gap }}>
      {ids.map((id) => {
        const entry = getWidget(id);
        if (!entry) return null;
        const enabled = isWidgetEnabled(id);
        if (!enabled && !editing) return null;
        const collapsed = isWidgetCollapsed(id);
        const { Component } = entry;
        return (
          <Shell
            key={id}
            id={id}
            title={entry.title}
            editing={editing}
            collapsed={collapsed}
            onToggleEnabled={() => toggleWidget(id)}
            onToggleCollapse={() => toggleCollapse(id)}
          >
            <div style={{ opacity: enabled ? 1 : 0.35 }}>
              <Component />
            </div>
          </Shell>
        );
      })}
    </div>
  );
};

export default WorkspacePanel;
