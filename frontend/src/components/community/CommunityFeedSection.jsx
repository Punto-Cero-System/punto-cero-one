/**
 * CommunityFeedSection — the community feed promoted to the visual centre of
 * the Home.
 *
 * WHY THIS EXISTS
 * Until now the feed was only a toggleable widget buried inside the center
 * WorkspacePanel, which made the Home read as a personal dashboard rather
 * than a living community. This section is the new primary axis of the page:
 *
 *     HomePage
 *       ├── PrimarySlides          (identity)
 *       ├── CommunityFeedSection   (activity)   <-- this component
 *       ├── DiscoverySection       (modules)
 *       └── WorkspacePreview       (personalisation)
 *
 * DESIGN INTENT (requirement: must not look like an isolated widget)
 * We deliberately render <FeedWidget> WITHOUT the <WorkspaceWidgetShell>
 * chrome (no "Feed" title bar, no collapse / enable toggles). The shell is
 * what makes a block look like a configurable dashboard card. Dropping it here
 * is what makes the feed read as the page's main content.
 *
 * NOTHING IS REMOVED: FeedWidget stays registered in workspaceRegistry.jsx and
 * keeps rendering through WorkspacePanel for Mi Espacio, the personal /
 * professional / company workspaces and MobileWorkspaceDrawer. This section is
 * purely additive — the same <FeedWidget> component is reused, not forked.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import FeedWidget from './workspace/FeedWidget';
import GettingStartedChecklist from './GettingStartedChecklist';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

const CommunityFeedSection = () => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';
  return (
    <section
      id="feed"
      data-testid="community-feed-section"
      aria-labelledby="community-feed-title"
      style={{
        width: '100%',
        maxWidth: 860,
        margin: '0 auto',
        padding: 'clamp(1.5rem, 4vw, 2.75rem) clamp(0.75rem, 2vw, 2rem)',
        boxSizing: 'border-box',
        // PUNTO 7 · C1 — esta sección es el destino real de los enlaces
        // `href="#feed"` que YA existían en el producto (PrimarySlides
        // "Explorar el feed", LeftSidebar y QuickLinksWidget). Antes no había
        // ningún `id="feed"` en el código, así que esos 4 enlaces eran
        // inertes: el CTA principal del hero no llevaba a ninguna parte.
        // `scrollMarginTop` compensa el header fijo de 58px para que el
        // ancla no quede escondida debajo de él.
        scrollMarginTop: '58px',
      }}
    >
      {/* Section header — establishes "this is the main content", not a card. */}
      <header style={{ marginBottom: '1.15rem' }}>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.22em',
            color: '#00A277', marginBottom: '0.55rem',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7, height: 7, borderRadius: '50%', background: '#00C896',
              boxShadow: '0 0 0 3px rgba(0,200,150,0.18)',
            }}
          />
          <Radio size={12} /> COMUNIDAD EN VIVO
        </div>

        <h2
          id="community-feed-title"
          style={{
            margin: '0 0 0.4rem',
            fontSize: 'clamp(1.5rem, 3.4vw, 2.15rem)',
            lineHeight: 1.15, fontWeight: 800, color: NAVY,
            letterSpacing: '-0.02em',
          }}
        >
          La actividad de tu comunidad profesional
        </h2>

        <p
          style={{
            margin: '0 0 0.85rem', maxWidth: 560,
            fontSize: '0.9rem', lineHeight: 1.55,
            color: 'rgba(11,31,58,0.62)',
          }}
        >
          Publica, sigue a tus pares y reacciona a lo que está pasando en el
          ecosistema. Es la actividad real de Punto Cero One, no un resumen.
        </p>

        <Link
          to="/comunidad"
          data-testid="community-feed-see-all"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '0.78rem', fontWeight: 800, color: '#00A277',
            textDecoration: 'none',
          }}
        >
          Ver toda la comunidad →
        </Link>
      </header>

      {/* The feed itself. No Shell wrapper on purpose — see design intent. */}
      {isAuthed && <GettingStartedChecklist />}
      <div
        data-testid="community-feed-host"
        style={{
          borderRadius: 20,
          boxShadow: '0 18px 50px rgba(11,31,58,0.08)',
        }}
      >
        <FeedWidget />
      </div>
    </section>
  );
};

export default CommunityFeedSection;
