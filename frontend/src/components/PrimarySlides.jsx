import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Sparkles, Globe, Layers, Rocket, Users } from 'lucide-react';
import AppIcon from './community/AppIcon';

/**
 * PrimarySlides — Punto Cero One's main slider content.
 * 6 handcrafted slides that reuse the messaging of the original landing
 * (Bloque 1 → "Sistema que evoluciona progresivamente") but with a modern,
 * feed-friendly composition: full-width, no black gutters, aligned padding,
 * distinct palettes per slide, subtle motion, generous whitespace.
 *
 * Exports:
 *  - `PRIMARY_SLIDES` — array ready to feed into <SlideCarousel slides={...} />
 */

const SlideShell = ({ background, children, id }) => (
  <div
    data-slide-id={id}
    style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background,
      position: 'relative',
      overflow: 'hidden',
      color: '#FFFFFF',
    }}
  >
    {children}
  </div>
);

const SlideGrid = ({ children }) => (
  <div className="pc-slide-grid" style={{
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    padding: 'clamp(1.75rem, 4vw, 3.5rem)',
    display: 'grid',
    gridTemplateColumns: '1.15fr 1fr',
    gap: 'clamp(1.5rem, 4vw, 3.5rem)',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  }}>
    {children}
    <style>{`
      @media (max-width: 900px) {
        .pc-slide-grid { grid-template-columns: 1fr !important; text-align: center; }
        .pc-slide-visual { order: -1; }
      }
    `}</style>
  </div>
);

const Eyebrow = ({ color = '#00C896', children }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.35rem 0.85rem', borderRadius: 100,
    background: `${color}14`, border: `1px solid ${color}55`,
    color, fontSize: '0.62rem', letterSpacing: '0.22em',
    fontWeight: 700, marginBottom: '1.15rem',
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: color,
      boxShadow: `0 0 8px ${color}`,
    }} />
    {children}
  </div>
);

const Title = ({ children, gradient }) => (
  <h2 style={{
    fontFamily: '"Space Grotesk", sans-serif',
    fontSize: 'clamp(1.85rem, 4.4vw, 3.15rem)',
    fontWeight: 300, lineHeight: 1.05,
    letterSpacing: '-0.03em', margin: 0, marginBottom: '1.15rem',
    color: '#FFFFFF',
    background: gradient || 'none',
    WebkitBackgroundClip: gradient ? 'text' : 'unset',
    WebkitTextFillColor: gradient ? 'transparent' : '#FFFFFF',
    backgroundClip: gradient ? 'text' : 'unset',
  }}>{children}</h2>
);

const Lead = ({ children }) => (
  <p style={{
    fontSize: 'clamp(0.95rem, 1.3vw, 1.05rem)',
    lineHeight: 1.65, color: 'rgba(255,255,255,0.72)',
    fontWeight: 300, margin: 0, marginBottom: '1.6rem',
    maxWidth: 520,
  }}>{children}</p>
);

const CtaRow = ({ children }) => (
  <div style={{ display: 'inline-flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
    {children}
  </div>
);

const primaryBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
  padding: '0.75rem 1.1rem', borderRadius: 100,
  background: '#FFFFFF', color: '#0B1F3A',
  fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.01em',
  textDecoration: 'none', cursor: 'pointer', border: 'none',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
};
const ghostBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
  padding: '0.75rem 1.1rem', borderRadius: 100,
  background: 'transparent', color: '#FFFFFF',
  fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.28)',
};

/* ============================================================================
   SLIDE 1 — Community hero
   ========================================================================= */
const Slide1Community = () => (
  <SlideShell id="community" background="linear-gradient(140deg, #0B1F3A 0%, #1E1B4B 45%, #4C1D95 100%)">
    {/* Decorative orbits */}
    <div style={{
      position: 'absolute', top: '-160px', right: '-160px', width: 520, height: 520,
      borderRadius: '50%', border: '1px solid rgba(139,92,246,0.25)',
    }} />
    <div style={{
      position: 'absolute', bottom: '-200px', left: '-200px', width: 620, height: 620,
      borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.15) 0%, transparent 65%)',
      filter: 'blur(20px)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#00C896">TODO EMPIEZA AQUÍ</Eyebrow>
        <Title>Una <span style={{ fontWeight: 700 }}>comunidad</span>. Un ecosistema.<br />
          <span style={{
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            fontWeight: 700,
          }}>Todo empieza aquí.</span>
        </Title>
        <Lead>
          Punto Cero One conecta profesionales, emprendedores y empresas en 18 países latinoamericanos —
          contenido, oportunidades, IA y capital, en un solo lugar.
        </Lead>
        <CtaRow>
          <Link to="/join" style={primaryBtnStyle}>Unirse a la comunidad <ArrowRight size={14} /></Link>
          <a href="#feed" style={ghostBtnStyle}>Explorar el feed</a>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        {/* Orbital network graphic */}
        <div style={{ position: 'relative', width: 260, height: 260 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ rotate: 360 }}
              transition={{ duration: 40 + i * 10, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', inset: `${i * 24}px`,
                borderRadius: '50%', border: `1px dashed rgba(255,255,255,${0.14 - i * 0.03})`,
              }}
            />
          ))}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #8B5CF6, #0B1F3A)',
              boxShadow: '0 0 60px rgba(139,92,246,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.2rem',
              fontWeight: 700, color: '#FFFFFF',
            }}>0</div>
          </div>
          {[45, 135, 225, 315].map((deg, i) => (
            <div key={deg} style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(-125px)`,
              width: 12, height: 12, borderRadius: '50%',
              background: ['#3B82F6', '#8B5CF6', '#EC4899', '#00C896'][i],
              boxShadow: `0 0 20px ${['#3B82F6', '#8B5CF6', '#EC4899', '#00C896'][i]}`,
            }} />
          ))}
        </div>
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 2 — De un punto a un ecosistema
   ========================================================================= */
const Slide2Vision = () => (
  <SlideShell id="vision" background="linear-gradient(160deg, #0A0F1C 0%, #0B1F3A 100%)">
    <div style={{
      position: 'absolute', top: '20%', right: '10%', width: 320, height: 320,
      borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.18) 0%, transparent 65%)',
      filter: 'blur(30px)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#00C896">FILOSOFÍA</Eyebrow>
        <Title>De un <span style={{ fontWeight: 700 }}>punto</span> a un <span style={{ color: '#00C896', fontWeight: 700 }}>ecosistema</span>.</Title>
        <Lead>
          No construimos una aplicación aislada. Construimos la infraestructura tecnológica
          que permitirá a miles de profesionales, emprendedores y empresas latinoamericanas crecer juntas.
        </Lead>
        <CtaRow>
          <Link to="/capital" style={primaryBtnStyle}>Ver la visión completa <ArrowRight size={14} /></Link>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {/* Point-to-network illustration */}
        <svg viewBox="0 0 300 240" style={{ width: '100%', maxWidth: 320, height: 'auto' }}>
          {/* connecting arcs */}
          <path d="M 40 120 C 100 40, 200 40, 260 120" stroke="rgba(0,200,150,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
          <path d="M 40 120 C 100 200, 200 200, 260 120" stroke="rgba(139,92,246,0.35)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
          {/* nodes */}
          <circle cx="40" cy="120" r="10" fill="#00C896" />
          <circle cx="260" cy="120" r="10" fill="#8B5CF6" />
          <circle cx="150" cy="60" r="7" fill="#3B82F6" />
          <circle cx="150" cy="180" r="7" fill="#EC4899" />
          <circle cx="95" cy="90" r="5" fill="rgba(255,255,255,0.5)" />
          <circle cx="205" cy="90" r="5" fill="rgba(255,255,255,0.5)" />
          <circle cx="95" cy="150" r="5" fill="rgba(255,255,255,0.5)" />
          <circle cx="205" cy="150" r="5" fill="rgba(255,255,255,0.5)" />
          {/* labels */}
          <text x="40" y="150" fill="#FFFFFF" fontSize="9" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700">CERO</text>
          <text x="260" y="150" fill="#FFFFFF" fontSize="9" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700">ECOSISTEMA</text>
        </svg>
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 3 — Un core, muchas verticales
   ========================================================================= */
const VERTICALS = [
  { name: 'Legal', icon: 'legal' }, { name: 'Salud', icon: 'health' },
  { name: 'IA', icon: 'ai' }, { name: 'Empleos', icon: 'jobs' },
  { name: 'Empresas', icon: 'companies' }, { name: 'Eventos', icon: 'events' },
  { name: 'Aprende', icon: 'learn' }, { name: 'Marketplace', icon: 'marketplace' },
  { name: 'Contabilidad', icon: 'accounting' }, { name: 'Videos', icon: 'video' },
  { name: 'Podcasts', icon: 'podcast' }, { name: 'Viajes', icon: 'travel' },
];

const Slide3Ecosystem = () => (
  <SlideShell id="ecosystem" background="linear-gradient(135deg, #1E1B4B 0%, #0B1F3A 60%, #0A0F1C 100%)">
    <div style={{
      position: 'absolute', top: '-100px', left: '-100px', width: 480, height: 480,
      borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 65%)',
      filter: 'blur(28px)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#3B82F6">ARQUITECTURA</Eyebrow>
        <Title>Un <span style={{ fontWeight: 700 }}>core</span> tecnológico compartido.<br />
          <span style={{
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            fontWeight: 700,
          }}>Muchas verticales.</span>
        </Title>
        <Lead>
          Autenticación, IA, CRM, seguridad, analítica, pagos — todo construido una vez y
          reutilizado por cada vertical de la plataforma.
        </Lead>
        <CtaRow>
          <a href="#feed" style={primaryBtnStyle}>Explorar verticales <Layers size={14} /></a>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.65rem',
        maxWidth: 400,
        margin: '0 auto',
      }}>
        {VERTICALS.map((v) => (
          <div key={v.name} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
            padding: '0.85rem 0.5rem', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(6px)',
          }}>
            <AppIcon name={v.icon} size={26} variant="color" />
            <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.82)', fontWeight: 600 }}>{v.name}</span>
          </div>
        ))}
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 4 — Punto Cero Legal LIVE
   ========================================================================= */
const Slide4Legal = () => (
  <SlideShell id="legal" background="linear-gradient(135deg, #052E1F 0%, #0B1F3A 55%, #052E1F 100%)">
    <div style={{
      position: 'absolute', bottom: '10%', right: '5%', width: 380, height: 380,
      borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.24) 0%, transparent 65%)',
      filter: 'blur(30px)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#00C896">PRIMER VERTICAL COMERCIAL · LIVE</Eyebrow>
        <Title><span style={{ fontWeight: 700 }}>Punto Cero Legal</span><br />
          <span style={{ color: '#00C896', fontWeight: 700 }}>ya está en producción.</span>
        </Title>
        <Lead>
          No es un concepto. No es un prototipo. Es el primer producto real del ecosistema,
          operativo hoy y evolucionando continuamente.
        </Lead>
        <CtaRow>
          <a href="https://puntocerolegal.com" target="_blank" rel="noopener noreferrer" style={primaryBtnStyle}>
            Visitar Punto Cero Legal <ExternalLink size={14} />
          </a>
          <Link to="/capital" style={ghostBtnStyle}>Ver Investor Center</Link>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: '-14px', borderRadius: '50%',
              border: '1px dashed rgba(0,200,150,0.5)',
            }}
          />
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #00C896 0%, #052E1F 70%)',
            boxShadow: '0 0 60px rgba(0,200,150,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.6rem',
            fontWeight: 700, color: '#FFFFFF',
          }}>
            <AppIcon name="legal" size={64} variant="mono-light" />
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.85rem', borderRadius: 100,
          background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.4)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C896', boxShadow: '0 0 8px #00C896' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', color: '#00C896' }}>LIVE EN PRODUCCIÓN</span>
        </div>
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 5 — Latinoamérica 18 países
   ========================================================================= */
const COUNTRIES_TOP = ['México', 'Colombia', 'Perú', 'Chile', 'Argentina', 'Brasil'];
const COUNTRIES_MORE = ['Ecuador', 'Venezuela', 'Uruguay', 'Paraguay', 'Bolivia', 'Panamá', 'Costa Rica', 'Rep. Dominicana', 'Guatemala', 'Honduras', 'Nicaragua', 'El Salvador'];

const Slide5Latam = () => (
  <SlideShell id="latam" background="linear-gradient(135deg, #0B1F3A 0%, #1E3A8A 55%, #4C1D95 100%)">
    <div style={{
      position: 'absolute', top: '5%', right: '10%', width: 340, height: 340,
      borderRadius: '50%', border: '1px solid rgba(212,175,55,0.35)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#D4AF37">ALCANCE REGIONAL</Eyebrow>
        <Title>Diseñado para <span style={{ fontWeight: 700 }}>18 países</span> de Latinoamérica.</Title>
        <Lead>
          Una infraestructura tecnológica que se adapta a diferentes culturas, monedas,
          regulaciones y realidades profesionales — con un solo ecosistema conectado.
        </Lead>
        <CtaRow>
          <Link to="/capital" style={primaryBtnStyle}>Ver oportunidad regional <Globe size={14} /></Link>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', maxWidth: 420, margin: '0 auto',
        }}>
          {COUNTRIES_TOP.map((c) => (
            <span key={c} style={{
              padding: '0.4rem 0.8rem', borderRadius: 100,
              background: 'rgba(212,175,55,0.14)', border: '1px solid rgba(212,175,55,0.45)',
              color: '#F3E7A2', fontSize: '0.78rem', fontWeight: 700,
            }}>{c}</span>
          ))}
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'center', maxWidth: 420, margin: '0 auto',
          opacity: 0.75,
        }}>
          {COUNTRIES_MORE.map((c) => (
            <span key={c} style={{
              padding: '0.28rem 0.6rem', borderRadius: 100,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.72)', fontSize: '0.7rem', fontWeight: 600,
            }}>{c}</span>
          ))}
        </div>
        <div style={{
          marginTop: '0.75rem', textAlign: 'center', fontSize: '0.66rem',
          color: 'rgba(255,255,255,0.55)', letterSpacing: '0.24em', fontWeight: 700,
        }}>
          + 400M DE PERSONAS · UNA MISMA INFRAESTRUCTURA
        </div>
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 6 — Un sistema que evoluciona progresivamente
   ========================================================================= */
const PHASES = [
  { n: '01', label: 'Base tecnológica', tone: '#3B82F6', status: 'Operativa' },
  { n: '02', label: 'Primer vertical LIVE · Legal', tone: '#00C896', status: 'En producción' },
  { n: '03', label: 'Tracción comercial', tone: '#D4AF37', status: 'En curso' },
  { n: '04', label: 'Ingresos recurrentes', tone: '#F59E0B', status: 'Próxima etapa' },
  { n: '05', label: 'Nueva vertical + expansión', tone: '#EC4899', status: 'Roadmap' },
];

const Slide6Evolution = () => (
  <SlideShell id="evolution" background="linear-gradient(135deg, #0B1F3A 0%, #1E1B4B 40%, #0A0F1C 100%)">
    <div style={{
      position: 'absolute', top: '-120px', right: '-120px', width: 440, height: 440,
      borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.13) 0%, transparent 65%)',
      filter: 'blur(24px)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#EC4899">EVOLUCIÓN</Eyebrow>
        <Title>Un sistema que <span style={{ fontWeight: 700 }}>evoluciona</span> progresivamente.</Title>
        <Lead>
          No lanzamos todo simultáneamente. Cada etapa refuerza a la siguiente —
          producto real, tracción real, luego expansión ordenada del ecosistema.
        </Lead>
        <CtaRow>
          <Link to="/capital" style={primaryBtnStyle}>Ver roadmap completo <Rocket size={14} /></Link>
          <Link to="/join" style={ghostBtnStyle}>Unirse a la comunidad <Users size={14} /></Link>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxWidth: 420, margin: '0 auto' }}>
        {PHASES.map((p) => (
          <div key={p.n} style={{
            display: 'flex', alignItems: 'center', gap: '0.85rem',
            padding: '0.7rem 0.95rem', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${p.tone}44`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `${p.tone}22`, border: `1px solid ${p.tone}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: p.tone, fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
            }}>{p.n}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>{p.label}</div>
              <div style={{ fontSize: '0.68rem', color: p.tone, letterSpacing: '0.14em', fontWeight: 700 }}>
                {p.status.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   EXPORT
   ========================================================================= */
const PRIMARY_SLIDES = [
  { key: 'community', node: <Slide1Community /> },
  { key: 'vision', node: <Slide2Vision /> },
  { key: 'ecosystem', node: <Slide3Ecosystem /> },
  { key: 'legal', node: <Slide4Legal /> },
  { key: 'latam', node: <Slide5Latam /> },
  { key: 'evolution', node: <Slide6Evolution /> },
];

export { PRIMARY_SLIDES };
