import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Hammer } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import { getWorkspaceSnapshot } from '../services/workspaceBridge';
import {
  getSpace,
  SPACE_STATUS,
  COMING_SOON_LABEL,
} from '../config/workspaceSpaces';

/**
 * WorkspaceSpacePlaceholderPage — punto de entrada de los espacios del
 * Workspace Gateway.
 *
 * Dos comportamientos, decidedos por el `spaceKey` (no por un selector):
 *   · espacio OPERATIVO  → dashboard real alimentado por el Core Legal (:8001)
 *     a traves de `services/workspaceBridge.js`, usando el `pcl_token` que ya
 *     emite AuthContext. No hay fetch a :8000.
 *   · espacio PENDIENTE  → la pantalla de construcción original, sin fetch.
 *
 * Se usa desde App.js en: /workspace · /workspace/legal · /workspace/medical ·
 * /workspace/empresa · /firm-os · /medical · /agent
 *
 * No crea autenticacion, no duplica modulos del Core Legal y no decide el
 * destino del usuario: eso lo resuelve `systemEntryRules.resolveEntryPath`.
 */
const SpacePlaceholderView = ({ spaceKey }) => {
  const space = getSpace(spaceKey);
  const label = space ? space.label : spaceKey;
  const emoji = space ? space.emoji : '🧩';
  const isComingSoon = !!space && space.status === SPACE_STATUS.COMING_SOON;

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="workspace-space-placeholder"
      data-space={spaceKey}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%',
          maxWidth: '520px',
          position: 'relative',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <BrandMark size={48} variant="full" />
        </div>

        <div
          aria-hidden="true"
          style={{ fontSize: '2.6rem', lineHeight: 1, marginBottom: '0.9rem' }}
        >
          {emoji}
        </div>

        <h1
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.4rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
            marginBottom: '0.9rem',
            lineHeight: 1.15,
          }}
        >
          {label}
        </h1>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.5rem 1rem',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            marginBottom: '1.25rem',
          }}
        >
          <Hammer size={14} color="#D4AF37" />
          <span
            data-testid="workspace-space-placeholder-status"
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            {isComingSoon ? COMING_SOON_LABEL : 'MÓDULO EN CONSTRUCCIÓN'}
          </span>
        </div>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            margin: 0,
            marginBottom: '2rem',
          }}
        >
          {space?.description || 'Este espacio forma parte del ecosistema Punto Cero System.'}
          <br />
          El módulo interno se está construyendo. No hay datos, endpoints ni
          permisos activos todavía.
        </p>

        <Link
          to="/"
          data-testid="workspace-space-back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.65rem 1.4rem',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.85)',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={14} /> Volver al inicio
        </Link>
      </motion.div>
    </div>
  );
};

/**
 * Dashboard operativo — primera superficie real sobre el Core Legal.
 *
 * Consume UNA sola vez `getWorkspaceSnapshot()` (Promise.allSettled dentro), de
 * modo que un módulo sin permiso no vacía el resto. Cada sección muestra su
 * propio estado de error. No implementa lógica de negocio: solo presenta.
 */
const WorkspaceDashboardView = ({ spaceKey, space }) => {
  const { user, systemContext } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWorkspaceSnapshot().then((s) => {
      if (active) { setSnapshot(s); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const kpis = snapshot?.kpis?.data || {};
  const clients = snapshot?.clients?.data || [];
  const cases = snapshot?.cases?.data || [];
  const appointments = snapshot?.appointments?.data || [];
  const darwin = snapshot?.darwin?.data || {};
  const failed = Object.values(snapshot || {}).filter((s) => s.error).length;

  const card = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '14px',
    padding: '1.1rem 1.2rem',
  };
  const h2 = {
    fontFamily: '"Space Grotesk", sans-serif',
    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.55)', margin: '0 0 0.9rem',
  };
  const listItem = {
    display: 'flex', justifyContent: 'space-between', gap: '0.8rem',
    padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.07)',
    fontSize: '0.84rem',
  };

  return (
    <div
      style={{
        minHeight: '100vh', padding: '2.2rem 1.4rem',
        background: 'radial-gradient(ellipse at top, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
        color: '#FFFFFF',
      }}
      data-testid="workspace-dashboard"
      data-space={spaceKey}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.8rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.7rem', fontWeight: 700, margin: 0 }}>
              {space?.label || 'Workspace'}
            </h1>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
              {user?.name || user?.email || 'Sesión Punto Cero System'}
              {' · '}
              {systemContext?.workspace_id || spaceKey}
            </p>
          </div>
          <Link
            to="/"
            data-testid="workspace-space-back"
            style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', padding: '0.55rem 1.1rem', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.16)' }}
          >
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
        </header>

        {loading && (
          <p data-testid="workspace-dashboard-loading" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
            Conectando con el Core Legal…
          </p>
        )}

        {snapshot && (
          <>
            {failed > 0 && (
              <p data-testid="workspace-dashboard-partial" style={{ fontSize: '0.8rem', color: '#D4AF37', margin: '0 0 1rem' }}>
                {failed} módulo(s) sin acceso para tu rol. El resto sigue operativo.
              </p>
            )}
            <section style={{ ...card, marginBottom: '1rem' }}>
              <h2 style={h2}>INDICADORES · CORE LEGAL</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.7rem' }}>
                {[
                  ['Casos', kpis.totalCases],
                  ['Activos', kpis.activeCases],
                  ['Clientes', clients.length],
                  ['Citas', appointments.length],
                  ['Facturado', kpis.totalRevenue],
                  ['Sin leer', kpis.unreadMessages],
                ].map(([label, value]) => (
                  <div key={label} data-testid={`workspace-kpi-${label}`}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{Number(value || 0).toLocaleString('es-ES')}</div>
                    <div style={{ fontSize: '0.66rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <section style={card} data-testid="workspace-section-clients">
                <h2 style={h2}>CLIENTES</h2>
                {snapshot.clients.error && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{snapshot.clients.error}</p>}
                {!snapshot.clients.error && clients.length === 0 && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>Sin clientes registrados.</p>}
                {clients.slice(0, 5).map((c) => (
                  <div key={c.id} style={listItem}>
                    <span>{c.name || 'Sin nombre'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{c.cases} caso(s)</span>
                  </div>
                ))}
              </section>

              <section style={card} data-testid="workspace-section-cases">
                <h2 style={h2}>CASOS ACTIVOS</h2>
                {snapshot.cases.error && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{snapshot.cases.error}</p>}
                {!snapshot.cases.error && cases.length === 0 && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>Sin casos abiertos.</p>}
                {cases.slice(0, 5).map((c) => (
                  <div key={c.id} style={listItem}>
                    <span>{c.caseNumber || c.title}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{c.status}</span>
                  </div>
                ))}
              </section>

            {/* SECCIONES */}

              <section style={card} data-testid="workspace-section-appointments">
                <h2 style={h2}>PRÓXIMAS CITAS</h2>
                {snapshot.appointments.error && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{snapshot.appointments.error}</p>}
                {!snapshot.appointments.error && appointments.length === 0 && <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>Agenda vacía.</p>}
                {appointments.slice(0, 5).map((a) => (
                  <div key={a.id} style={listItem}>
                    <span>{a.title || a.clientName || 'Cita'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{a.date}</span>
                  </div>
                ))}
              </section>

              <section style={card} data-testid="workspace-section-darwin">
                <h2 style={h2}>DARWIN IA</h2>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: darwin.operational ? '#00C896' : '#D4AF37' }}>
                  {String(darwin.status || '—').toUpperCase()}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem' }}>
                  {darwin.activities || 0} acción(es) registrada(s)
                </div>
                {darwin.lastAction && (
                  <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.2rem' }}>
                    Última: {darwin.lastAction} · {darwin.lastExecutedAt}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Espacios ya conectados al Core Legal OS. El resto conserva el placeholder
// original. El destino del usuario lo decide `systemEntryRules`, no esta pagina.
const OPERATIONAL_SPACES = new Set(['legal']);

const WorkspaceSpacePlaceholderPage = ({ spaceKey }) => {
  const space = getSpace(spaceKey);
  return OPERATIONAL_SPACES.has(spaceKey)
    ? <WorkspaceDashboardView spaceKey={spaceKey} space={space} />
    : <SpacePlaceholderView spaceKey={spaceKey} />;
};

export default WorkspaceSpacePlaceholderPage;
