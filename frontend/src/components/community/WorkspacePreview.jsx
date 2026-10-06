/**
 * WorkspacePreview — Mi Espacio, preserved as-is but demoted to the last
 * section of the Home.
 *
 * IMPORTANT: this component is a pure MOVE. It contains the exact same tree
 * that used to live in HomePage.jsx:
 *
 *     WorkspaceToolbar  (authed only)
 *     WorkspacePanel    (left  | center | right)
 *     MobileWorkspaceDrawer
 *
 * No widget was removed, no registry entry changed, no behaviour changed. The
 * only difference is its position on the page and the `hideIds` prop below,
 * which exists solely to stop the feed rendering twice on the Home.
 *
 * `hideIds={['feed']}` on the center panel is deliberate and safe:
 *   - The `feed` widget remains registered and configurable (Mi Espacio).
 *   - MobileWorkspaceDrawer only renders left/right panels, so it is
 *     completely unaffected.
 *   - In edit mode `hideIds` is ignored (see WorkspacePanel), so the user can
 *     still drag the feed back into the center panel.
 *   - Without it, Home would mount two <LiveFeed> instances: duplicated
 *     network calls, two IntersectionObserver sentinels and two independent
 *     optimistic prepends on composer submit.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Check } from 'lucide-react';
// PUNTO 7 · C3 — se retiró `import { Link } from 'react-router-dom'`: el único
// enlace de esta página pasó a ser un ancla (`<a href="#mi-espacio">`), así
// que el import quedaba sin uso y CRA lo trata como error en CI.

import CommunityLayout from './CommunityLayout';
import WorkspacePanel from './workspace/WorkspacePanel';
import MobileWorkspaceDrawer from './workspace/MobileWorkspaceDrawer';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { WORKSPACE_IDENTITIES as IDENTITIES } from '../../config/workspaceIdentity';

const NAVY = '#0B1F3A';

const WorkspacePreview = ({ editing, onToggleEdit, isAuthed }) => {
  const { ready, identity, identityDef, applyIdentity } = useWorkspace();
  const { Icon: IdentityIcon, copy, accent } = identityDef;

  return (
    <section
      id="mi-espacio"
      data-testid="workspace-preview"
      aria-labelledby="workspace-preview-title"
      data-identity={identity}
      // PUNTO 7 · C2 — ancla real de la sección. `WorkspacePreview` sólo
      // exponía un data-testid, así que ningún enlace externo podía apuntar
      // a Mi Espacio sin re-renderizar la Home entera.
      style={{ scrollMarginTop: '58px' }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1600,
          margin: '0 auto',
          padding: 'clamp(0.75rem, 2vw, 1.5rem) clamp(0.75rem, 2vw, 2rem) 0',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: '1rem', flexWrap: 'wrap', boxSizing: 'border-box',
        }}
      >
        <div>
          {/* Textos dinámicos según la identidad activa */}
          <div
            style={{
              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.22em',
              color: accent, marginBottom: '0.3rem',
            }}
          >
            {copy.eyebrow}
          </div>
          <h2
            id="workspace-preview-title"
            style={{ margin: 0, fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)', fontWeight: 800, color: NAVY }}
          >
            {copy.title}
          </h2>
          <p
            data-testid="workspace-preview-subtitle"
            style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(11,31,58,0.6)' }}
          >
            {copy.subtitle}
          </p>
        </div>

        {/* Identidad visual: selector de identidad (un solo Workspace, no dashboards) */}
        <div
          data-testid="workspace-identity-switcher"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
        >
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.68rem', fontWeight: 800, color: accent,
              marginRight: '0.15rem',
            }}
          >
            <IdentityIcon size={14} /> IDENTIDAD
          </span>
          {IDENTITIES.map((it) => {
            const active = it.key === identity;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => applyIdentity(it.key)}
                data-testid={`identity-${it.key}`}
                title={it.description}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '0.4rem 0.75rem', borderRadius: 100,
                  background: active ? `${it.accent}1A` : '#FFFFFF',
                  border: `1px solid ${active ? it.accent : 'rgba(11,31,58,0.1)'}`,
                  color: active ? it.accent : 'rgba(11,31,58,0.7)',
                  fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                <it.Icon size={12} /> {it.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Acceso directo a Mi Espacio (se conserva del diseño anterior)
          PUNTO 7 · C3 — este botón antes era <Link to="/mi-espacio">, pero
          `App.js` mapea "/mi-espacio" al MISMO HomePage que "/", así que el
          clic no llevaba a ninguna parte: re-renderizaba la página en la que
          ya estabas. Ahora es un ancla real a la sección de Mi Espacio
          (`#mi-espacio`, C2). El data-testid se conserva para no romper
          ninguna aserción existente. */}
      <div
        style={{
          width: '100%',
          maxWidth: 1600,
          margin: '0 auto',
          padding: '0.6rem clamp(0.75rem, 2vw, 2rem) 0',
          boxSizing: 'border-box',
        }}
      >
        <a
          href="#mi-espacio"
          data-testid="workspace-preview-link"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '0.5rem 1rem', borderRadius: 100,
            background: NAVY, color: '#FFFFFF',
            fontSize: '0.76rem', fontWeight: 800, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Ir a Mi Espacio
        </a>
      </div>

      <CommunityLayout
        left={
          <>
            {isAuthed && (
              <WorkspaceToolbar editing={editing} onToggle={onToggleEdit} />
            )}
            {ready && (
              <WorkspacePanel
                panel="left"
                editing={editing}
                testid="community-left-sidebar"
              />
            )}
          </>
        }
        center={
          <>
            <MobileWorkspaceDrawer
              editing={editing}
              onToggleEdit={onToggleEdit}
            />
            {ready && (
              <WorkspacePanel
                panel="center"
                editing={editing}
                gap="1rem"
                hideIds={['feed']}
              />
            )}
          </>
        }
        right={ready && (
          <WorkspacePanel
            panel="right"
            editing={editing}
            testid="community-right-widgets"
          />
        )}
      />
    </section>
  );
};

/**
 * Compact toolbar shown at the top of the left panel for authenticated
 * users. Single action: toggle edit-mode in place ("Configuración" and
 * the preset bar were removed per the Fase de Optimización directive —
 * users administer Mi Espacio directly by editing widgets in place).
 *
 * Moved verbatim from HomePage.jsx — same markup, same data-testids.
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

export default WorkspacePreview;
