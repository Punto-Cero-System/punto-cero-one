/**
 * MobileWorkspaceDrawer — surfaces the left / right workspace panels on
 * viewports where they are hidden by CSS. Two buttons trigger the drawer:
 *
 *   • Menú   → shows the left panel (profile, activity, quick links…)
 *   • Widgets → shows the right panel (news, tendencias, cripto…)
 *
 * The drawer is a full-height slide-in that never duplicates the
 * component tree — it renders <WorkspacePanel> for the requested side.
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, LayoutGrid, Menu, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import WorkspacePanel from './WorkspacePanel';
import { useCommunityAuth } from '../../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

const MobileWorkspaceDrawer = ({ editing, onToggleEdit }) => {
  const [side, setSide] = useState(null);   // null | 'left' | 'right'
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  return (
    <>
      {/* Compact quick-actions bar visible only on ≤ 1200px */}
      <div className="pc-workspace-mobile-actions" data-testid="workspace-mobile-actions">
        <button data-testid="workspace-mobile-open-left"
          onClick={() => setSide('left')} className="pc-mwa-btn">
          <Menu size={16} /> Menú
        </button>
        <button data-testid="workspace-mobile-open-right"
          onClick={() => setSide('right')} className="pc-mwa-btn">
          <LayoutGrid size={16} /> Widgets
        </button>
        {isAuthed && (
          <>
            <button data-testid="workspace-mobile-toggle-edit"
              onClick={onToggleEdit}
              className={`pc-mwa-btn${editing ? ' pc-mwa-btn--active' : ''}`}>
              <Settings size={16} /> {editing ? 'Salir edición' : 'Editar'}
            </button>
            <Link to="/mi-espacio/configuracion" data-testid="workspace-mobile-config-link"
              className="pc-mwa-btn">
              <Settings size={16} /> Config
            </Link>
          </>
        )}
      </div>

      <AnimatePresence>
        {side && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSide(null)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                zIndex: 200,
              }}
            />
            <motion.aside
              key="drawer"
              data-testid={`workspace-mobile-drawer-${side}`}
              initial={{ x: side === 'left' ? -320 : 320 }}
              animate={{ x: 0 }}
              exit={{ x: side === 'left' ? -320 : 320 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                position: 'fixed', top: 0, bottom: 0,
                [side]: 0,
                width: 'min(92vw, 340px)',
                background: '#F4F6FB',
                zIndex: 201, overflowY: 'auto',
                boxShadow: '0 0 40px rgba(0,0,0,0.35)',
              }}>
              <div style={{
                position: 'sticky', top: 0, zIndex: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 0.9rem',
                background: '#FFFFFF',
                borderBottom: '1px solid rgba(11,31,58,0.06)',
              }}>
                <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', fontWeight: 800, color: NAVY }}>
                  {side === 'left' ? 'MENÚ · MI ESPACIO' : 'WIDGETS · PANEL DERECHO'}
                </div>
                <button onClick={() => setSide(null)}
                  data-testid="workspace-mobile-drawer-close"
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(11,31,58,0.05)',
                    border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '1rem 0.9rem 4rem' }}>
                <WorkspacePanel panel={side} editing={editing} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .pc-workspace-mobile-actions {
          display: none;
          gap: 0.4rem;
          margin-bottom: 0.85rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 0.15rem;
        }
        .pc-mwa-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.5rem 0.85rem; border-radius: 100px;
          background: #FFFFFF; border: 1px solid rgba(11,31,58,0.08);
          color: ${NAVY}; font-size: 0.75rem; font-weight: 700; cursor: pointer;
          white-space: nowrap; text-decoration: none;
          box-shadow: 0 4px 12px rgba(11,31,58,0.04);
        }
        .pc-mwa-btn--active {
          background: rgba(124,58,237,0.1);
          color: #5B21B6; border-color: rgba(124,58,237,0.25);
        }
        @media (max-width: 1200px) {
          .pc-workspace-mobile-actions { display: flex; }
        }
      `}</style>
    </>
  );
};

export default MobileWorkspaceDrawer;
