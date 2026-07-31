/**
 * MiEspacioConfigPage — Configuración › Mi Espacio.
 *
 * Sections:
 *   1. Panel picker for each widget (left / center / right / hidden)
 *   2. Move up / down / enable / collapse toggle for every widget already placed
 *   3. Reset workspace to defaults
 *
 * All state is driven by WorkspaceContext; autosave persists to Mongo.
 * Anonymous users hit this page → we redirect them to /join.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, RotateCcw, EyeOff, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { WORKSPACE_WIDGETS, getWidget, workspaceCategories } from '../services/workspaceRegistry';
import { WORKSPACE_PRESETS } from '../services/workspacePresets';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const PANELS = [
  { key: 'left', label: 'Panel izquierdo' },
  { key: 'center', label: 'Área central' },
  { key: 'right', label: 'Panel derecho' },
];

const MiEspacioConfigPage = () => {
  const navigate = useNavigate();
  const { user } = useCommunityAuth();
  const {
    workspace, isWidgetEnabled, isWidgetCollapsed,
    toggleWidget, toggleCollapse, moveWidget, reorderPanel, resetWorkspace,
    applyPreset,
  } = useWorkspace();

  if (user === null) {
    // not authed — send them to /join
    navigate('/join', { replace: true });
    return null;
  }

  const findPanelOf = (id) => {
    for (const p of ['left', 'center', 'right']) {
      if ((workspace.panels?.[p] || []).includes(id)) return p;
    }
    return null;
  };

  const move = (id, direction) => {
    const panel = findPanelOf(id);
    if (!panel) return;
    const arr = [...(workspace.panels[panel] || [])];
    const idx = arr.indexOf(id);
    if (idx < 0) return;
    const next = direction === 'up' ? idx - 1 : idx + 1;
    if (next < 0 || next >= arr.length) return;
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    reorderPanel(panel, arr);
  };

  const changePanel = (id, target) => {
    if (target === 'hidden') {
      // remove from all panels; the enabled flag stays true so re-adding it
      // is trivial. We just drop it out of any panel list.
      for (const p of ['left', 'center', 'right']) {
        const arr = (workspace.panels[p] || []).filter((w) => w !== id);
        if (arr.length !== (workspace.panels[p] || []).length) {
          reorderPanel(p, arr);
        }
      }
      return;
    }
    moveWidget(id, target);
  };

  const cats = workspaceCategories();

  return (
    <>
      <Header />
      <main style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}>
        <div className="pc-config-wrap">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, #1E1B4B 55%, #4C1D95 100%)`,
              borderRadius: 22, padding: '1.6rem 1.5rem', color: '#FFFFFF',
              position: 'relative', overflow: 'hidden', marginBottom: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.68rem', letterSpacing: '0.24em', fontWeight: 700, color: EMERALD }}>
              CONFIGURACIÓN · MI ESPACIO
            </div>
            <h1 style={{
              margin: '0.35rem 0 0.5rem',
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700,
              letterSpacing: '-0.02em', fontFamily: '"Space Grotesk", sans-serif',
            }}>Personaliza tu Workspace</h1>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', maxWidth: 640 }}>
              Elige qué widgets quieres ver, en qué panel y en qué orden. Todo se guarda
              automáticamente en tu cuenta y viaja contigo entre dispositivos.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link to="/" data-testid="config-back-to-workspace" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 0.85rem', borderRadius: 100,
                background: '#FFFFFF', color: NAVY, textDecoration: 'none',
                fontSize: '0.78rem', fontWeight: 700,
              }}>← Volver a Mi Espacio</Link>
              <button onClick={resetWorkspace} data-testid="config-reset"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.5rem 0.85rem', borderRadius: 100,
                  background: 'rgba(255,255,255,0.1)', color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                }}>
                <RotateCcw size={13} /> Restaurar por defecto
              </button>
            </div>
          </motion.div>

          {/* Presets — one click to apply an ecosystem-tuned layout */}
          <div data-testid="config-presets"
            style={{
              background: '#FFFFFF', borderRadius: 18,
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              padding: '1rem 1.1rem', marginBottom: '1.25rem',
            }}>
            <div style={{
              fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 800,
              color: 'rgba(11,31,58,0.55)', marginBottom: '0.5rem',
            }}>PRESETS · PUNTO CERO</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.6)', marginBottom: '0.85rem' }}>
              Aplica un preset como punto de partida y edítalo cuando quieras.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: '0.55rem',
            }}>
              {WORKSPACE_PRESETS.map(({ id, label, Icon, accent, description }) => (
                <button key={id}
                  onClick={() => applyPreset(id)}
                  data-testid={`config-preset-${id}`}
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    padding: '0.7rem 0.85rem', borderRadius: 14,
                    background: `${accent}0F`,
                    border: `1px solid ${accent}33`,
                    color: NAVY,
                    display: 'flex', gap: '0.65rem', alignItems: 'center',
                  }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${accent}22`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={accent} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>{label}</div>
                    <div style={{
                      fontSize: '0.66rem', color: 'rgba(11,31,58,0.6)',
                      lineHeight: 1.35, marginTop: 2,
                    }}>{description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Panel by panel */}
          <div className="pc-config-grid">
            {PANELS.map((p) => (
              <div key={p.key} data-testid={`config-panel-${p.key}`}
                style={{
                  background: '#FFFFFF', borderRadius: 18,
                  border: '1px solid rgba(11,31,58,0.06)',
                  boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
                  padding: '1rem',
                }}>
                <div style={{
                  fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 800,
                  color: 'rgba(11,31,58,0.55)', marginBottom: '0.8rem',
                }}>{p.label.toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(workspace.panels[p.key] || []).map((id) => {
                    const entry = getWidget(id);
                    if (!entry) return null;
                    return (
                      <div key={id} data-testid={`config-widget-${id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.55rem 0.6rem', borderRadius: 10,
                          background: 'rgba(11,31,58,0.03)',
                          border: '1px solid rgba(11,31,58,0.05)',
                        }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.title}
                          </div>
                          <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.description}
                          </div>
                        </div>
                        <IconBtn label="Subir" onClick={() => move(id, 'up')}><ArrowUp size={13} /></IconBtn>
                        <IconBtn label="Bajar" onClick={() => move(id, 'down')}><ArrowDown size={13} /></IconBtn>
                        <IconBtn label={isWidgetCollapsed(id) ? 'Expandir' : 'Colapsar'}
                          onClick={() => toggleCollapse(id)}>
                          {isWidgetCollapsed(id) ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                        </IconBtn>
                        <IconBtn label={isWidgetEnabled(id) ? 'Ocultar' : 'Mostrar'}
                          onClick={() => toggleWidget(id)}
                          active={!isWidgetEnabled(id)}>
                          {isWidgetEnabled(id) ? <Eye size={13} /> : <EyeOff size={13} />}
                        </IconBtn>
                        <select
                          value={p.key}
                          onChange={(e) => changePanel(id, e.target.value)}
                          data-testid={`config-widget-${id}-panel-select`}
                          style={{
                            fontSize: '0.72rem', padding: '0.3rem 0.5rem',
                            borderRadius: 8, border: '1px solid rgba(11,31,58,0.1)',
                            background: '#FFFFFF', color: NAVY,
                          }}>
                          <option value="left">Izq.</option>
                          <option value="center">Centro</option>
                          <option value="right">Der.</option>
                          <option value="hidden">Quitar</option>
                        </select>
                      </div>
                    );
                  })}
                  {(workspace.panels[p.key] || []).length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)', padding: '0.75rem 0.5rem' }}>
                      Este panel está vacío. Agrega widgets desde la sección "Catálogo".
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Widget catalog — add missing widgets to any panel */}
          <div style={{
            marginTop: '1.5rem', background: '#FFFFFF', borderRadius: 18,
            border: '1px solid rgba(11,31,58,0.06)',
            boxShadow: '0 4px 20px rgba(11,31,58,0.04)', padding: '1.25rem',
          }} data-testid="config-catalog">
            <div style={{
              fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 800,
              color: 'rgba(11,31,58,0.55)', marginBottom: '1rem',
            }}>CATÁLOGO DE WIDGETS</div>
            {Object.entries(cats).map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: '1.25rem' }}>
                <div style={{
                  fontSize: '0.7rem', letterSpacing: '0.14em', fontWeight: 700,
                  color: NAVY, marginBottom: '0.5rem', textTransform: 'uppercase',
                }}>{cat}</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '0.5rem',
                }}>
                  {list.map((w) => {
                    const placed = findPanelOf(w.id);
                    return (
                      <div key={w.id} data-testid={`catalog-widget-${w.id}`}
                        style={{
                          padding: '0.6rem 0.7rem', borderRadius: 12,
                          background: placed ? 'rgba(0,200,150,0.06)' : 'rgba(11,31,58,0.03)',
                          border: `1px solid ${placed ? 'rgba(0,200,150,0.22)' : 'rgba(11,31,58,0.06)'}`,
                        }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY }}>{w.title}</div>
                        <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)', margin: '0.15rem 0 0.5rem' }}>
                          {w.description}
                        </div>
                        <select
                          value={placed || 'hidden'}
                          onChange={(e) => changePanel(w.id, e.target.value)}
                          data-testid={`catalog-widget-${w.id}-place`}
                          style={{
                            fontSize: '0.72rem', padding: '0.3rem 0.5rem',
                            borderRadius: 8, border: '1px solid rgba(11,31,58,0.1)',
                            background: '#FFFFFF', color: NAVY, width: '100%',
                          }}>
                          <option value="hidden">— Sin colocar —</option>
                          <option value="left">Panel izquierdo</option>
                          <option value="center">Área central</option>
                          <option value="right">Panel derecho</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        .pc-config-wrap {
          max-width: 1360px;
          margin: 0 auto;
          padding: 1.25rem 1rem 4rem;
        }
        .pc-config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 1024px) {
          .pc-config-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .pc-config-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
};

const IconBtn = ({ children, onClick, label, active }) => (
  <button onClick={onClick} aria-label={label}
    style={{
      width: 28, height: 28, borderRadius: 8,
      background: active ? '#FEE2E2' : '#FFFFFF',
      border: `1px solid ${active ? '#FCA5A5' : 'rgba(11,31,58,0.1)'}`,
      color: active ? '#B91C1C' : NAVY, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{children}</button>
);

export default MiEspacioConfigPage;
