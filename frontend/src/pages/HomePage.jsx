import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';

import CommunityFeedSection from '../components/community/CommunityFeedSection';
import DiscoverySection from '../components/community/DiscoverySection';
import WorkspacePreview from '../components/community/WorkspacePreview';
import WorkspaceDndProvider from '../components/community/workspace/WorkspaceDndProvider';
import SlideCarousel from '../components/SlideCarousel';
import { PRIMARY_SLIDES } from '../components/PrimarySlides';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

/**
 * HomePage — the entry point of Punto Cero One.
 *
 * FASE OMEGA · ETAPA 3 · PUNTO 2 — the Home stops being a launcher/dashboard
 * and becomes a community. The page is now composed as four explicit layers:
 *
 *     HomePage
 *       ├── PrimarySlides          (identity of the ecosystem)
 *       ├── CommunityFeedSection   (the living community — centre of activity)
 *       ├── DiscoverySection       (Noticias, Videos, Empleos, Empresas,
 *       │                           Eventos, IA)
 *       └── WorkspacePreview       (Mi Espacio, with all its widgets)
 *
 * That is the product journey the phase asked for:
 *     Usuario → Comunidad → Contenido → Interacción → Workspace
 *
 * GUARANTEES PRESERVED
 *   · FeedWidget stays registered in workspaceRegistry.jsx and still renders
 *     through WorkspacePanel (Mi Espacio, personal / professional / company
 *     workspaces) and MobileWorkspaceDrawer. Nothing was removed — the feed
 *     was PROMOTED, it now simply also has a primary slot on the Home.
 *   · No route was changed or created. Every link points to a pre-existing
 *     path.
 *   · Point 3 (Mi Espacio) is NOT part of this change: WorkspacePreview is a
 *     pure move of the previous three-column tree, its behaviour is unchanged.
 *
 * The sliders, the widget registry, the drag-and-drop provider and the mobile
 * drawer are all reused as-is.
 */
const HomePage = () => {
  const { user } = useCommunityAuth();
  const [editing, setEditing] = useState(false);

  const isAuthed = !!user && typeof user === 'object';

  return (
    <>
      <CustomCursor />
      <Header />
      <main id="top" style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}>
        <WorkspaceDndProvider editing={editing}>
          {/* 1 · Identity of the ecosystem */}
          <div className="pc-community-top">
            <SlideCarousel
              id="pc-slider-primary"
              slides={PRIMARY_SLIDES}
              autoplayMs={12000}
              height="clamp(520px, 74vh, 720px)"
              label="Slider principal · visión Punto Cero One"
            />
          </div>

          <div style={{
            width: '100%', maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1rem 0', boxSizing: 'border-box',
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.8rem',
              padding: '1rem 1.1rem', borderRadius: 18,
              background: 'linear-gradient(120deg, rgba(11,31,58,0.04), rgba(0,200,150,0.08))',
              border: '1px solid rgba(11,31,58,0.08)',
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.22em', color: 'rgba(11,31,58,0.5)' }}>
                PUNTO CERO SYSTEM
              </div>
              <div style={{ fontSize: 'clamp(1.1rem, 2vw, 1.6rem)', fontWeight: 800, color: '#0B1F3A', lineHeight: 1.3 }}>
                Punto Cero One es la puerta de entrada al ecosistema: comunidad, soluciones verticales y acceso a los espacios del sistema.
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <a href="/capital" style={{ textDecoration: 'none', background: '#0B1F3A', color: '#FFFFFF', borderRadius: 999, padding: '0.7rem 1rem', fontWeight: 700, fontSize: '0.8rem' }}>Explorar soluciones</a>
                <a href="https://www.puntocerolegal.com" style={{ textDecoration: 'none', background: '#FFFFFF', color: '#0B1F3A', border: '1px solid rgba(11,31,58,0.12)', borderRadius: 999, padding: '0.7rem 1rem', fontWeight: 700, fontSize: '0.8rem' }}>Conocer Punto Cero Legal</a>
              </div>
            </div>
          </div>

          {/* 2 · The community — centre of activity */}
          <CommunityFeedSection />

          {/* 3 · Discovery of the ecosystem modules */}
          <DiscoverySection />

          {/* 4 · Mi Espacio (unchanged behaviour, demoted position) */}
          <WorkspacePreview
            editing={editing}
            onToggleEdit={() => setEditing((v) => !v)}
            isAuthed={isAuthed}
          />
        </WorkspaceDndProvider>
      </main>
      <Footer />
    </>
  );
};

export default HomePage;
