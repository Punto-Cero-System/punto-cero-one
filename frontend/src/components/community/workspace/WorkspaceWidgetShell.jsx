/**
 * WorkspaceWidgetShell — shared chrome around every widget rendered inside
 * Mi Espacio. Adds a compact header (title, drag handle, collapse toggle,
 * remove) that appears ONLY in "edit mode" (when the user opens the
 * Widget Manager). In normal viewing mode the child renders naked and the
 * existing visual identity of the widget is preserved 1:1.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

const NAVY = '#0B1F3A';

const Shell = ({ id, title, editing, collapsed, onToggleEnabled, onToggleCollapse, children }) => {
  if (!editing) {
    if (collapsed) return null;
    return <>{children}</>;
  }
  return (
    <motion.div
      layout
      data-testid={`workspace-widget-${id}`}
      style={{
        position: 'relative',
        borderRadius: 18,
        outline: '1px dashed rgba(124,58,237,0.35)',
        outlineOffset: 4,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.35rem 0.55rem',
        borderRadius: 10,
        marginBottom: 6,
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.15)',
        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em',
        color: '#5B21B6',
      }}>
        <span style={{ flex: 1, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <IconBtn label="Colapsar" onClick={onToggleCollapse} testid={`workspace-widget-${id}-collapse`}>
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </IconBtn>
        <IconBtn label="Ocultar" onClick={onToggleEnabled} testid={`workspace-widget-${id}-hide`}>
          <EyeOff size={12} />
        </IconBtn>
      </div>
      {!collapsed && children}
    </motion.div>
  );
};

const IconBtn = ({ children, onClick, label, testid }) => (
  <button
    onClick={onClick}
    aria-label={label}
    data-testid={testid}
    style={{
      width: 22, height: 22, borderRadius: 6,
      background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.1)',
      color: NAVY, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    {children}
  </button>
);

export default Shell;
