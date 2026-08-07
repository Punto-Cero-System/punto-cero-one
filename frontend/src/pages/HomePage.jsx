import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Check } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';

import CommunityLayout from '../components/community/CommunityLayout';
import WorkspacePanel from '../components/community/workspace/WorkspacePanel';
import MobileWorkspaceDrawer from '../components/community/workspace/MobileWorkspaceDrawer';
import WorkspaceDndProvider from '../components/community/workspace/WorkspaceDndProvider';
import SlideCarousel from '../components/SlideCarousel';
import { PRIMARY_SLIDES } from '../components/PrimarySlides';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * HomePage — evolved into "Mi Espacio", the personal workspace.
 *
 * - Anonymous users: the workspace runs on the default template (same look as
 *   the previous LinkedIn-style home). The slider sits on top.
 * - Authenticated users: the same layout, but every widget is toggle-able,
 *   reorderable and persisted per-account (WorkspaceContext + /api/workspace).
 *
 * The visual identity stays intact — this page reuses the exact widgets
 * previously composed inside LeftSidebar / RightWidgets / LiveFeed, but each
 * one is now addressable by ID inside the Widget Registry.
 */
const HomePage = () => {
  const { user } = useCommunityAuth();
  const { ready } = useWorkspace();
  const isAuthed = !!user && typeof user === 'object';
  const [editing, setEditing] = useState(false);

  return (
    <>
      <CustomCursor />
      <Header />
      <main id="top" style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}>
        <WorkspaceDndProvider editing={editing}>
        <CommunityLayout
          top={
            <SlideCarousel
              id="pc-slider-primary"
              slides={PRIMARY_SLIDES}
              autoplayMs={12000}
              height="clamp(520px, 74vh, 720px)"
              label="Slider principal · visión Punto Cero One"
            />
          }
          left={
            <>
              {isAuthed && (
                <WorkspaceToolbar
                  editing={editing}
                  onToggle={() => setEditing((v) => !v)}
                />
              )}
              {ready && <WorkspacePanel panel="left" editing={editing} testid="community-left-sidebar" />}
            </>
          }
          center={
            <>
              <MobileWorkspaceDrawer editing={editing} onToggleEdit={() => setEditing((v) => !v)} />
              {ready && <WorkspacePanel panel="center" editing={editing} gap="1rem" />}
            </>
          }
          right={ready && <WorkspacePanel panel="right" editing={editing} testid="community-right-widgets" />}
        />
        </WorkspaceDndProvider>
      </main>
      <Footer />
    </>
  );
};

/**
 * Compact toolbar shown at the top of the left panel for authenticated
 * users. Single action: toggle edit-mode in place ("Configuración" and
 * the preset bar were removed per the Fase de Optimización directive —
 * users administer Mi Espacio directly by editing widgets in place).
 */
const WorkspaceToolbar = ({ editing, onToggle }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    data-testid="workspace-toolbar"
    style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.55rem 0.6rem', borderRadius: 14,
      background: '#FFFFFF',
      border: '1px solid rgba(11,31,58,0.06)',
      boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
    }}>
    <div style={{
      fontSize: '0.6rem', letterSpacing: '0.2em', fontWeight: 800,
      color: 'rgba(11,31,58,0.55)', flex: 1,
    }}>MI ESPACIO</div>
    <button onClick={onToggle}
      data-testid="workspace-toggle-edit"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '0.35rem 0.6rem', borderRadius: 100,
        background: editing ? 'rgba(0,200,150,0.12)' : 'rgba(11,31,58,0.04)',
        border: `1px solid ${editing ? 'rgba(0,200,150,0.3)' : 'rgba(11,31,58,0.08)'}`,
        color: editing ? '#00A277' : '#0B1F3A',
        fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
      }}>
      {editing ? <Check size={12} /> : <LayoutGrid size={12} />}
      {editing ? 'Listo' : 'Editar'}
    </button>
  </motion.div>
);

export default HomePage;
