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

const SlideShell = ({ background, image, imageOverlay, children, id }) => (
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
    {image && (
      <>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(1.1) contrast(1.05)',
          opacity: 0.55,
          zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: imageOverlay || 'linear-gradient(120deg, rgba(11,31,58,0.85) 0%, rgba(11,31,58,0.55) 55%, rgba(11,31,58,0.9) 100%)',
          zIndex: 1,
        }} />
      </>
    )}
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
  <SlideShell
    id="community"
    background="linear-gradient(140deg, #0B1F3A 0%, #1E1B4B 45%, #4C1D95 100%)"
    image="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1600&auto=format&fit=crop&q=80"
    imageOverlay="linear-gradient(105deg, rgba(11,31,58,0.78) 0%, rgba(30,27,75,0.55) 55%, rgba(76,29,149,0.4) 100%)"
  >
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
  <SlideShell
    id="vision"
    background="linear-gradient(160deg, #0A0F1C 0%, #0B1F3A 100%)"
    image="https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/8w3qxh3a_ChatGPT%20Image%2030%20jul%202026%2C%2010_03_46%20p.m..png"
    imageOverlay="linear-gradient(115deg, rgba(10,15,28,0.78) 0%, rgba(11,31,58,0.55) 45%, rgba(0,200,150,0.28) 100%)"
  >
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
  <SlideShell
    id="ecosystem"
    background="linear-gradient(135deg, #1E1B4B 0%, #0B1F3A 60%, #0A0F1C 100%)"
    image="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=80"
    imageOverlay="linear-gradient(105deg, rgba(11,31,58,0.9) 0%, rgba(30,27,75,0.75) 55%, rgba(59,130,246,0.4) 100%)"
  >
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
  <SlideShell
    id="legal"
    background="linear-gradient(135deg, #052E1F 0%, #0B1F3A 55%, #052E1F 100%)"
    image="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&auto=format&fit=crop&q=80"
    imageOverlay="linear-gradient(105deg, rgba(5,46,31,0.9) 0%, rgba(11,31,58,0.7) 55%, rgba(0,200,150,0.45) 100%)"
  >
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
      <div className="pc-slide-visual" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        {/* Big animated LIVE badge — no icon, just typography + pulse */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            padding: '1.4rem 2rem',
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(0,200,150,0.18), rgba(0,200,150,0.05))',
            border: '2px solid rgba(0,200,150,0.65)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 24px 60px rgba(0,200,150,0.28), inset 0 0 30px rgba(0,200,150,0.08)',
            textAlign: 'center', minWidth: 240,
          }}>
          <motion.div
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.35rem 0.85rem', borderRadius: 100,
              background: 'rgba(0,200,150,0.22)', border: '1px solid rgba(0,200,150,0.55)',
              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.28em', color: '#00E8AC',
              marginBottom: '0.85rem',
            }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E8AC',
                           boxShadow: '0 0 12px #00E8AC' }} />
            LIVE EN PRODUCCIÓN
          </motion.div>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.85rem', fontWeight: 700,
            color: '#FFFFFF', letterSpacing: '-0.015em', marginBottom: '0.3rem',
          }}>puntocerolegal.com</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', fontWeight: 500 }}>
            Primer vertical operativo del ecosistema
          </div>
        </motion.div>
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 5 — Latinoamérica INTERACTIVA (mapa de nombres con hover)
   ========================================================================= */
const LATAM_COUNTRIES = [
  { code: 'MX', name: 'México',        row: 0, col: 0, tone: '#3B82F6' },
  { code: 'GT', name: 'Guatemala',     row: 0, col: 1, tone: '#8B5CF6' },
  { code: 'HN', name: 'Honduras',      row: 0, col: 2, tone: '#EC4899' },
  { code: 'SV', name: 'El Salvador',   row: 0, col: 3, tone: '#F59E0B' },
  { code: 'NI', name: 'Nicaragua',     row: 1, col: 0, tone: '#EC4899' },
  { code: 'CR', name: 'Costa Rica',    row: 1, col: 1, tone: '#00C896' },
  { code: 'PA', name: 'Panamá',        row: 1, col: 2, tone: '#3B82F6' },
  { code: 'DO', name: 'Rep. Dominicana', row: 1, col: 3, tone: '#8B5CF6' },
  { code: 'CU', name: 'Cuba',          row: 2, col: 0, tone: '#F59E0B' },
  { code: 'VE', name: 'Venezuela',     row: 2, col: 1, tone: '#00C896' },
  { code: 'CO', name: 'Colombia',      row: 2, col: 2, tone: '#D4AF37' },
  { code: 'EC', name: 'Ecuador',       row: 2, col: 3, tone: '#3B82F6' },
  { code: 'PE', name: 'Perú',          row: 3, col: 0, tone: '#EC4899' },
  { code: 'BO', name: 'Bolivia',       row: 3, col: 1, tone: '#F59E0B' },
  { code: 'BR', name: 'Brasil',        row: 3, col: 2, tone: '#00C896' },
  { code: 'PY', name: 'Paraguay',      row: 3, col: 3, tone: '#8B5CF6' },
  { code: 'CL', name: 'Chile',         row: 4, col: 0, tone: '#3B82F6' },
  { code: 'AR', name: 'Argentina',     row: 4, col: 1, tone: '#D4AF37' },
  { code: 'UY', name: 'Uruguay',       row: 4, col: 2, tone: '#EC4899' },
  { code: 'PR', name: 'Puerto Rico',   row: 4, col: 3, tone: '#00C896' },
];

const InteractiveLatamMap = () => {
  const [active, setActive] = React.useState(null);
  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }} data-testid="latam-map-interactive">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem',
      }}>
        {LATAM_COUNTRIES.map((c) => (
          <motion.button
            key={c.code}
            onMouseEnter={() => setActive(c)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(c)}
            onBlur={() => setActive(null)}
            whileHover={{ y: -2, scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            data-testid={`map-country-${c.code}`}
            style={{
              padding: '0.55rem 0.5rem', borderRadius: 12,
              background: active?.code === c.code
                ? `linear-gradient(135deg, ${c.tone}44, ${c.tone}18)`
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active?.code === c.code ? c.tone : 'rgba(255,255,255,0.10)'}`,
              boxShadow: active?.code === c.code ? `0 0 24px ${c.tone}55` : 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
            }}>
            <span style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '0.72rem', fontWeight: 800, color: active?.code === c.code ? c.tone : '#FFFFFF',
              letterSpacing: '0.06em',
            }}>{c.code}</span>
            <span style={{
              fontSize: '0.6rem', fontWeight: 500,
              color: active?.code === c.code ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
            }}>{c.name}</span>
          </motion.button>
        ))}
      </div>
      <div style={{
        marginTop: '0.9rem', textAlign: 'center', fontSize: '0.65rem',
        color: active ? active.tone : 'rgba(255,255,255,0.5)', letterSpacing: '0.2em',
        fontWeight: 700, transition: 'color 0.3s ease', minHeight: 18,
      }}>
        {active ? `${active.name.toUpperCase()} · MARKETPLACE PRÓXIMAMENTE` : 'PASA EL MOUSE PARA EXPLORAR CADA PAÍS'}
      </div>
    </div>
  );
};

const Slide5Latam = () => (
  <SlideShell
    id="latam"
    background="linear-gradient(135deg, #0B1F3A 0%, #1E3A8A 55%, #4C1D95 100%)"
    image="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&auto=format&fit=crop&q=80"
    imageOverlay="linear-gradient(115deg, rgba(11,31,58,0.9) 0%, rgba(30,58,138,0.72) 55%, rgba(212,175,55,0.4) 100%)"
  >
    <div style={{
      position: 'absolute', top: '5%', right: '10%', width: 340, height: 340,
      borderRadius: '50%', border: '1px solid rgba(212,175,55,0.35)',
    }} />
    <SlideGrid>
      <div>
        <Eyebrow color="#D4AF37">ALCANCE REGIONAL</Eyebrow>
        <Title>Diseñado para toda <span style={{ fontWeight: 700 }}>Latinoamérica</span>.</Title>
        <Lead>
          Un ecosistema tecnológico regional — cada país iluminado, cada mercado conectado
          por la misma infraestructura. Pronto ingreso al marketplace por país.
        </Lead>
        <CtaRow>
          <Link to="/capital" style={primaryBtnStyle}>Ver oportunidad regional <Globe size={14} /></Link>
        </CtaRow>
      </div>
      <div className="pc-slide-visual">
        <InteractiveLatamMap />
      </div>
    </SlideGrid>
  </SlideShell>
);

/* ============================================================================
   SLIDE 6 — CTA "Únete al ecosistema"
   ========================================================================= */
const Slide6Join = () => (
  <SlideShell
    id="join"
    background="linear-gradient(135deg, #0B1F3A 0%, #1E1B4B 40%, #0A0F1C 100%)"
    image="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&auto=format&fit=crop&q=80"
    imageOverlay="linear-gradient(115deg, rgba(11,31,58,0.85) 0%, rgba(30,27,75,0.7) 55%, rgba(0,200,150,0.35) 100%)"
  >
    {/* Ambient orbs */}
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute', top: '10%', right: '5%', width: 380, height: 380,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.24) 0%, transparent 65%)',
        filter: 'blur(30px)',
      }} />
    <motion.div
      animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      style={{
        position: 'absolute', bottom: '-100px', left: '-100px', width: 480, height: 480,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 65%)',
        filter: 'blur(28px)',
      }} />

    <SlideGrid>
      <div>
        <Eyebrow color="#00C896">TODO EMPIEZA AQUÍ</Eyebrow>
        <Title>Únete al <span style={{
          fontWeight: 700,
          background: 'linear-gradient(90deg, #00C896, #3B82F6, #8B5CF6, #EC4899)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>ecosistema</span>.</Title>
        <Lead>
          Crea tu cuenta gratis en 30 segundos. Publica, conecta, sigue empresas,
          aplica a vacantes y sé parte de la primera generación del ecosistema latinoamericano.
        </Lead>
        <CtaRow>
          <Link to="/join" style={primaryBtnStyle}>Crear mi cuenta <ArrowRight size={14} /></Link>
          <a href="#feed" style={ghostBtnStyle}>Explorar el feed <Users size={14} /></a>
        </CtaRow>
      </div>
      <div className="pc-slide-visual" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxWidth: 420, margin: '0 auto' }}>
        <BenefitPill color="#00C896" text="Publica, comenta y conecta con otros profesionales" />
        <BenefitPill color="#3B82F6" text="Sigue empresas y descubre oportunidades laborales" />
        <BenefitPill color="#8B5CF6" text="Feed personalizado 'Para Ti' basado en tus intereses" />
        <BenefitPill color="#EC4899" text="Mensajería directa y notificaciones en tiempo real" />
        <BenefitPill color="#D4AF37" text="Acceso temprano a los próximos verticales del ecosistema" />
      </div>
    </SlideGrid>
  </SlideShell>
);

const BenefitPill = ({ color, text }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }} transition={{ duration: 0.5 }}
    style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      padding: '0.75rem 1rem', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}55`,
      backdropFilter: 'blur(6px)',
    }}>
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: color,
      boxShadow: `0 0 10px ${color}`, flexShrink: 0,
    }} />
    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
      {text}
    </span>
  </motion.div>
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
  { key: 'join', node: <Slide6Join /> },
];

export { PRIMARY_SLIDES };
