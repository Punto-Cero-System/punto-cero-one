/**
 * WorkspacePresetBar — one-click presets for Mi Espacio.
 *
 * Shows a horizontal, scrollable strip of the Punto Cero ecosystem
 * presets. Clicking one repopulates every panel with the widgets that
 * matter most for that role. Selection is persisted via autosave.
 * The user remains free to tweak the layout afterwards.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { WORKSPACE_PRESETS } from '../../../services/workspacePresets';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

const NAVY = '#0B1F3A';

const WorkspacePresetBar = () => {
  const { applyPreset } = useWorkspace();

  return (
    <div data-testid="workspace-preset-bar"
      style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        padding: '0.7rem 0.75rem',
      }}>
      <div style={{
        fontSize: '0.58rem', letterSpacing: '0.22em', fontWeight: 800,
        color: 'rgba(11,31,58,0.55)', marginBottom: '0.5rem',
      }}>PRESETS · PUNTO CERO</div>
      <div style={{
        display: 'flex', gap: '0.4rem',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        paddingBottom: '0.2rem',
      }}>
        {WORKSPACE_PRESETS.map(({ id, label, Icon, accent, description }) => (
          <motion.button
            key={id}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => applyPreset(id)}
            data-testid={`workspace-preset-${id}`}
            title={description}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 0.7rem', borderRadius: 100,
              background: `${accent}12`,
              border: `1px solid ${accent}44`,
              color: NAVY, cursor: 'pointer',
              fontSize: '0.7rem', fontWeight: 700,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
            <Icon size={13} color={accent} />
            {label}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default WorkspacePresetBar;
