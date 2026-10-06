import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink, Sparkles, ChevronDown, Rocket, Layers, Cpu, Shield, Briefcase, TrendingUp, Users, DollarSign, Wallet, Activity, Building2, Scale, Compass, Info, Circle, Wrench, Store, AlertTriangle, Sparkle } from 'lucide-react';

const NAVY = '#0B1F3A';
const NAVY_DEEP = '#071527';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';
const IVORY = '#F7F5F0';
const MUTED = '#8A9BB5';

const PLACEHOLDER = 'Pendiente';

// ============================================================================
// LOCAL STORAGE HOOK
// ============================================================================
const useStoredState = (key, initial) => {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(`pcs_fin_${key}`);
      return v !== null ? JSON.parse(v) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(`pcs_fin_${key}`, JSON.stringify(state)); } catch { /* noop */ }
  }, [key, state]);
  return [state, setState];
};

// ============================================================================
// INVESTOR CENTER TOP NAV (shared across finance pages)
// ============================================================================
const CENTER_LINKS = [
  { to: '/executive-summary', label: 'Executive Summary' },
  { to: '/investor-pitch-deck', label: 'Pitch Deck' },
  { to: '/capital-strategy', label: 'Capital Strategy' },
];

const InvestorCenterNav = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 2rem', background: 'rgba(247,245,240,0.9)',
    backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(11,31,58,0.08)',
  }}>
    <Link to="/" data-testid="capital-back-home" style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      color: NAVY, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
    }} className="interactive">
      <ArrowLeft size={13} /> Punto Cero <span style={{ color: EMERALD, fontWeight: 700 }}>System</span>
    </Link>

    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} className="capital-topnav-links">
      {CENTER_LINKS.map((l) => {
        const active = window.location.pathname === l.to;
        return (
          <Link
            key={l.to}
            to={l.to}
            data-testid={`nav-${l.to.replace(/\//g, '')}`}
            className="interactive"
            style={{
              padding: '0.4rem 0.85rem',
              background: active ? `${GOLD}22` : 'transparent',
              border: `1px solid ${active ? GOLD + '77' : 'transparent'}`,
              borderRadius: '100px',
              color: active ? '#8a6d1e' : NAVY,
              textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600,
            }}
          >{l.label}</Link>
        );
      })}
    </nav>

    <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" data-testid="capital-legal-external"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: NAVY, textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }} className="interactive">
      Punto Cero Legal <ExternalLink size={12} />
    </a>
  </div>
);

// ============================================================================
// SIDE DOT NAV
// ============================================================================
const SECTIONS = [
  { id: 'hero', label: 'Capital Strategy' },
  { id: 'context', label: 'Contexto' },
  { id: 'flow', label: 'Flujo de capital' },
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'allocation', label: 'Uso del capital' },
  { id: 'projection', label: 'Proyección 36m' },
  { id: 'revenue', label: 'Revenue Model' },
  { id: 'opex', label: 'OpEx Model' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'financial-scenarios', label: 'Escenarios finan.' },
  { id: 'metrics', label: 'KPIs' },
  { id: 'feasibility', label: 'Feasibility' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'disclaimer', label: 'Disclaimer' },
];

// ============================================================================
// PRIMITIVES
// ============================================================================
const FadeIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-15%' }}
    transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
  >{children}</motion.div>
);

const Eyebrow = ({ children, color = EMERALD }) => (
  <div style={{ fontSize: '0.68rem', color, letterSpacing: '0.3em', fontWeight: 700, marginBottom: '1.25rem' }}>
    {children}
  </div>
);

const SectionTitle = ({ children, light = false, maxWidth = '780px' }) => (
  <h2 style={{
    fontFamily: '"Space Grotesk", sans-serif',
    fontSize: 'clamp(2rem, 4.2vw, 3.75rem)', fontWeight: 300,
    letterSpacing: '-0.03em', lineHeight: 1.05,
    color: light ? '#FFFFFF' : NAVY, marginBottom: '1.5rem', maxWidth,
  }}>{children}</h2>
);

const Lead = ({ children, light = false, maxWidth = '640px' }) => (
  <p style={{
    fontSize: '1.05rem', lineHeight: 1.7, fontWeight: 300,
    color: light ? 'rgba(255,255,255,0.75)' : NAVY,
    opacity: light ? 1 : 0.82, maxWidth,
  }}>{children}</p>
);

const PendingChip = ({ label = 'PENDIENTE DE VALIDACIÓN' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.22rem 0.65rem', background: 'rgba(212,175,55,0.14)',
    border: `1px solid ${GOLD}55`, borderRadius: '100px',
    fontSize: '0.6rem', color: '#8a6d1e', fontWeight: 700, letterSpacing: '0.15em',
  }}>
    <Circle size={6} fill={GOLD} stroke="none" /> {label}
  </span>
);

const DataTag = ({ type }) => {
  const map = {
    actual: { label: 'DATO REAL', color: EMERALD, bg: `${EMERALD}1F` },
    assumption: { label: 'SUPUESTO', color: GOLD, bg: `${GOLD}1F` },
    projection: { label: 'PROYECCIÓN', color: '#7CC4FF', bg: 'rgba(124,196,255,0.15)' },
    scenario: { label: 'ESCENARIO', color: '#B888FF', bg: 'rgba(184,136,255,0.15)' },
  };
  const m = map[type] || map.assumption;
  return (
    <span style={{
      padding: '0.18rem 0.55rem', background: m.bg, border: `1px solid ${m.color}44`,
      borderRadius: '100px', fontSize: '0.55rem', color: m.color, fontWeight: 700, letterSpacing: '0.18em',
    }}>{m.label}</span>
  );
};

// Editable currency/number input with "Pendiente" placeholder
const EditableAmount = ({ value, onChange, prefix = '$', suffix = '', width = '100%', testid }) => (
  <div style={{
    position: 'relative', display: 'inline-flex', alignItems: 'center',
    width, padding: '0.5rem 0.75rem',
    background: '#FFFFFF', border: `1px solid ${value ? EMERALD + '55' : 'rgba(11,31,58,0.15)'}`,
    borderRadius: '10px', gap: '0.25rem',
  }}>
    {prefix && <span style={{ color: MUTED, fontSize: '0.8rem', fontWeight: 600 }}>{prefix}</span>}
    <input
      data-testid={testid}
      type="text"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        onChange(v === '' ? null : v);
      }}
      placeholder={PLACEHOLDER}
      style={{
        flex: 1, minWidth: 0,
        background: 'transparent', border: 'none', outline: 'none',
        color: NAVY, fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit',
      }}
    />
    {suffix && <span style={{ color: MUTED, fontSize: '0.8rem', fontWeight: 600 }}>{suffix}</span>}
  </div>
);

const EditablePercent = ({ value, onChange, testid }) => (
  <EditableAmount value={value} onChange={onChange} prefix="" suffix="%" width="90px" testid={testid} />
);

// ============================================================================
// SCENARIO CONTEXT (shared)
// ============================================================================

// ============================================================================
// MAIN PAGE
// ============================================================================
const CapitalStrategyPage = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const [scenario, setScenario] = useStoredState('scenario', 'base');

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div style={{ background: IVORY, color: NAVY, fontFamily: '"Space Grotesk", sans-serif' }} data-testid="capital-strategy-page">
      <InvestorCenterNav />

      {/* Dot side nav */}
      <nav style={{
        position: 'fixed', top: '50%', right: '1.2rem', transform: 'translateY(-50%)',
        zIndex: 80, display: 'flex', flexDirection: 'column', gap: '0.6rem',
      }} className="capital-dot-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            data-testid={`capital-dot-${s.id}`}
            aria-label={s.label}
            className="interactive"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span style={{
              fontSize: '0.6rem', fontWeight: 600,
              color: activeSection === s.id ? NAVY : 'transparent',
              minWidth: '92px', textAlign: 'right', transition: 'color .3s',
            }}>{s.label}</span>
            <span style={{
              width: activeSection === s.id ? '18px' : '5px',
              height: '5px', borderRadius: '3px',
              background: activeSection === s.id ? EMERALD : 'rgba(11,31,58,0.25)',
              transition: 'all .3s',
            }} />
          </button>
        ))}
      </nav>

      <Hero />
      <Context />
      <CapitalFlow />
      <ThreeScenarios scenario={scenario} setScenario={setScenario} />
      <UseOfCapital />
      <Projection />
      <RevenueModel />
      <OpexModel />
      <CashFlowModel />
      <FinancialScenarios scenario={scenario} setScenario={setScenario} />
      <KpiSection />
      <Feasibility />
      <Milestones />
      <Readiness />
      <Disclaimer />

      <FooterBridge />

      <style>{`
        @media (max-width: 1100px) { .capital-dot-nav { display: none !important; } }
        @media (max-width: 900px) { .capital-topnav-links { display: none !important; } }
        .cap-section { padding: 5rem 1rem; position: relative; overflow-x: clip; }
        @media (min-width: 600px) { .cap-section { padding: 6rem 1.5rem; } }
        @media (min-width: 900px) { .cap-section { padding: 9rem 3rem; } }
        .cap-container { max-width: 1200px; margin: 0 auto; min-width: 0; }
      `}</style>
    </div>
  );
};

// ============================================================================
// 0 · HERO
// ============================================================================
const Hero = () => (
  <section id="hero" style={{
    minHeight: '92vh', background: `radial-gradient(ellipse at center, #0e2647 0%, ${NAVY} 60%, ${NAVY_DEEP} 100%)`,
    color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden', padding: '7rem 1.5rem 5rem',
  }}>
    {[1, 2, 3].map((i) => (
      <motion.div key={i}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 1.2], opacity: [0, 0.35, 0] }}
        transition={{ duration: 6, repeat: Infinity, delay: i * 1.7, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: `${350 + i * 220}px`, height: `${350 + i * 220}px`,
          borderRadius: '50%', border: `1px solid ${GOLD}33`,
          transform: 'translate(-50%, -50%)',
        }} />
    ))}
    <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity }}
      style={{ position: 'absolute', top: '50%', left: '50%', width: '16px', height: '16px', borderRadius: '50%', background: GOLD, transform: 'translate(-50%, -50%)', boxShadow: `0 0 40px ${GOLD}` }} />

    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}
      style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.4rem 1rem', background: 'rgba(212,175,55,0.1)',
        border: `1px solid ${GOLD}55`, borderRadius: '100px', marginBottom: '2.5rem',
      }}>
        <Sparkles size={11} color={GOLD} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: GOLD, letterSpacing: '0.3em' }}>
          FASE 4 · CAPITAL STRATEGY
        </span>
      </div>
      <h1 style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 200,
        letterSpacing: '-0.04em', lineHeight: 1.02, marginBottom: '1.5rem',
      }}>
        Capital, ejecución y{' '}
        <span style={{ fontWeight: 800, background: `linear-gradient(135deg, ${EMERALD}, ${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          validación de mercado
        </span>.
      </h1>
      <p style={{ fontSize: '1.1rem', lineHeight: 1.6, fontWeight: 300, color: 'rgba(255,255,255,0.75)', maxWidth: '720px', margin: '0 auto 2.5rem' }}>
        Una estrategia de capital diseñada para transformar una fundación tecnológica real en un producto validado y en el primer paso hacia un ecosistema latinoamericano.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}>
        <HeroStat label="Foundation" value="Existente" color={EMERALD} />
        <HeroStat label="First product" value="LIVE" color={GOLD} />
        <HeroStat label="Valores financieros" value="Pendientes" color={MUTED} />
      </div>
    </motion.div>

    <motion.div animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.5, repeat: Infinity }}
      style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)' }}>
      <ChevronDown size={22} />
    </motion.div>
  </section>
);

const HeroStat = ({ label, value, color }) => (
  <div style={{
    padding: '0.85rem 1.5rem', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px',
    minWidth: '180px',
  }}>
    <div style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '0.3rem' }}>
      {label.toUpperCase()}
    </div>
    <div style={{ fontSize: '1.15rem', fontWeight: 700, color }}>{value}</div>
  </div>
);

// ============================================================================
// 1 · CONTEXT
// ============================================================================
const Context = () => (
  <section id="context" className="cap-section" style={{ background: '#FFFFFF' }}>
    <div className="cap-container" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '5rem', alignItems: 'center' }} data-two-col>
      <FadeIn>
        <Eyebrow>01 · CONTEXTO ESTRATÉGICO</Eyebrow>
        <SectionTitle>El capital no financia una idea. Acelera una <b style={{ fontWeight: 700 }}>fundación existente</b>.</SectionTitle>
        <Lead>
          Punto Cero System es un ecosistema tecnológico con una base real ya en operación.
          Punto Cero Legal, el <b style={{ fontWeight: 700 }}>primer vertical comercial, está LIVE en producción</b>.
          El proyecto ha sido construido por un equipo fundador pequeño, con una inversión personal significativa de tiempo y recursos.
        </Lead>
        <div style={{ marginTop: '1.5rem', padding: '1.15rem 1.35rem', background: `${GOLD}0F`, border: `1px solid ${GOLD}33`, borderRadius: '14px', fontSize: '0.9rem', color: NAVY, lineHeight: 1.6 }}>
          <b style={{ fontWeight: 700, color: '#8a6d1e' }}>Compromiso:</b> no inventamos clientes, ingresos, KPIs, valuación ni resultados. Los campos financieros están abiertos y marcados como <b>PENDIENTE</b> hasta ser validados.
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            'Technology foundation',
            'First vertical LIVE',
            'Commercial traction',
            'Market validation',
            'Recurring revenue',
            'Ecosystem expansion',
          ].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div style={{
                padding: '0.85rem 1.15rem',
                background: i === 0 ? `${EMERALD}12` : (i === arr.length - 1 ? `${GOLD}12` : IVORY),
                border: `1px solid ${i === 0 ? EMERALD + '55' : i === arr.length - 1 ? GOLD + '55' : 'rgba(11,31,58,0.08)'}`,
                borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.9rem',
              }}>
                <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(11,31,58,0.4)', fontWeight: 700, minWidth: '22px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: NAVY }}>{step}</span>
                {i === 0 && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: EMERALD, fontWeight: 700, letterSpacing: '0.15em' }}>ACTUAL</span>}
              </div>
              {i < arr.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0.15rem 0' }}>
                  <ChevronDown size={12} color="rgba(11,31,58,0.3)" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </FadeIn>
    </div>
    <style>{`@media (max-width: 900px) { [data-two-col] { grid-template-columns: 1fr !important; } }`}</style>
  </section>
);

// ============================================================================
// 2 · CAPITAL FLOW
// ============================================================================
const CapitalFlow = () => {
  const steps = [
    'Fundación actual', 'Capital', 'Ejecución',
    'Completar Punto Cero Legal', 'Market launch',
    'Validación de clientes', 'Recurring revenue',
    'Crecimiento', 'Nuevas verticales', 'Expansión regional',
  ];
  return (
    <section id="flow" className="cap-section" style={{ background: NAVY, color: '#FFFFFF' }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow color={GOLD}>02 · FLUJO DEL CAPITAL</Eyebrow>
          <SectionTitle light>De <b style={{ fontWeight: 700, color: GOLD }}>fundación tecnológica</b> a ecosistema latinoamericano.</SectionTitle>
          <Lead light>El capital atraviesa 10 estados. Cada uno depende de ejecución medible.</Lead>
        </FadeIn>

        <div style={{
          marginTop: '4rem', display: 'flex', flexWrap: 'wrap',
          gap: '0.6rem', alignItems: 'center', justifyContent: 'center',
        }}>
          {steps.map((s, i) => (
            <FadeIn key={s} delay={i * 0.05}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  padding: '0.65rem 1rem',
                  background: i === 0 ? `${EMERALD}18` : i === steps.length - 1 ? `${GOLD}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i === 0 ? EMERALD + '55' : i === steps.length - 1 ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                }}>{s}</div>
                {i < steps.length - 1 && <ArrowRight size={13} color={GOLD} style={{ opacity: 0.5 }} />}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 3 · THREE CAPITAL SCENARIOS
// ============================================================================
const CAPITAL_SCENARIOS = [
  {
    key: 'minimum', name: 'Capital Mínimo', kicker: 'ESCENARIO 01',
    color: '#7CC4FF', badge: 'MÍNIMO',
    objective: 'Sostener Punto Cero Legal en producción e iniciar tracción comercial.',
    outcome: 'PUNTO CERO LEGAL CON PRIMERA TRACCIÓN COMERCIAL',
    uses: [
      'Operación en producción', 'Ingeniería de mantenimiento', 'Refinamiento UX/UI',
      'Infraestructura', 'Costos de IA / APIs', 'Seguridad',
      'Adquisición inicial', 'Marketing base', 'Operaciones',
    ],
    milestones: ['Operación sostenida', 'Primeros clientes de pago'],
  },
  {
    key: 'validation', name: 'Capital de Validación', kicker: 'ESCENARIO 02',
    color: EMERALD, badge: 'VALIDACIÓN',
    objective: 'Escalar la adquisición de clientes y validar el modelo comercial.',
    outcome: 'DE PRODUCTO LIVE A MODELO COMERCIAL VALIDADO',
    uses: [
      'Expansión de equipo técnico', 'Producto y features',
      'Infraestructura de escala', 'Adquisición de clientes', 'Ventas',
      'Marketing', 'Customer support', 'Operaciones', 'Validación comercial',
    ],
    milestones: [
      'Base de clientes creciente', 'Ingresos recurrentes iniciales',
      'Product-market fit signals', 'Feedback de clientes', 'Modelo comercial validado',
    ],
  },
  {
    key: 'acceleration', name: 'Capital de Aceleración', kicker: 'ESCENARIO 03',
    color: GOLD, badge: 'ACELERACIÓN',
    objective: 'Acelerar ejecución y comenzar la expansión del ecosistema.',
    outcome: 'DE PRODUCTO VALIDADO A ECOSISTEMA ESCALABLE',
    uses: [
      'Equipo de ingeniería', 'Equipo de producto', 'Equipo comercial',
      'Alianzas estratégicas', 'Infraestructura', 'Expansión regional',
      'Shared technology core', 'Desarrollo de verticales futuras',
    ],
    milestones: [
      'Equipo consolidado', 'Alianzas estratégicas', 'Expansión regional',
      'Nuevas verticales en preparación', 'Ecosistema en crecimiento',
    ],
  },
];

const ThreeScenarios = ({ scenario, setScenario }) => (
  <section id="scenarios" className="cap-section" style={{ background: IVORY }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow>03 · TRES ESCENARIOS DE CAPITAL</Eyebrow>
        <SectionTitle>El capital tiene tres formas posibles.</SectionTitle>
        <Lead>Cada escenario cambia el alcance, no la visión. Selecciona uno para explorar sus milestones y usos.</Lead>
      </FadeIn>

      {/* Scenario switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
        {CAPITAL_SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenario(s.key)}
            data-testid={`capital-scenario-tab-${s.key}`}
            className="interactive"
            style={{
              padding: '0.6rem 1.2rem',
              background: scenario === s.key ? s.color + '22' : '#FFFFFF',
              border: `1px solid ${scenario === s.key ? s.color + 'aa' : 'rgba(11,31,58,0.1)'}`,
              borderRadius: '100px',
              color: scenario === s.key ? s.color : NAVY, fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{s.name}</button>
        ))}
      </div>

      <div style={{
        marginTop: '2.5rem', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem',
      }} data-scenario-grid>
        {CAPITAL_SCENARIOS.map((s) => (
          <ScenarioCard key={s.key} scenario={s} active={scenario === s.key} onClick={() => setScenario(s.key)} />
        ))}
      </div>
    </div>
  </section>
);

const ScenarioCard = ({ scenario, active, onClick }) => (
  <motion.div
    whileHover={{ y: -6 }}
    onClick={onClick}
    data-testid={`capital-scenario-card-${scenario.key}`}
    className="interactive"
    style={{
      cursor: 'pointer',
      background: '#FFFFFF',
      border: `1px solid ${active ? scenario.color + 'aa' : 'rgba(11,31,58,0.08)'}`,
      borderRadius: '24px', padding: '2rem',
      boxShadow: active ? `0 30px 70px ${scenario.color}33` : '0 8px 24px rgba(11,31,58,0.04)',
      transition: 'box-shadow .3s',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: MUTED, fontWeight: 700 }}>{scenario.kicker}</div>
      <span style={{
        padding: '0.25rem 0.7rem', background: scenario.color + '18',
        border: `1px solid ${scenario.color}55`, borderRadius: '100px',
        fontSize: '0.6rem', color: scenario.color, fontWeight: 700, letterSpacing: '0.15em',
      }}>{scenario.badge}</span>
    </div>
    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.4rem', fontWeight: 600, color: NAVY, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
      {scenario.name}
    </div>
    <div style={{ fontSize: '0.9rem', color: NAVY, opacity: 0.75, lineHeight: 1.5, marginBottom: '1.5rem' }}>
      {scenario.objective}
    </div>

    <div style={{ fontSize: '0.6rem', color: MUTED, letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.6rem' }}>USOS POTENCIALES</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1.25rem' }}>
      {scenario.uses.slice(0, 6).map((u) => (
        <span key={u} style={{
          padding: '0.25rem 0.65rem', background: IVORY,
          border: '1px solid rgba(11,31,58,0.08)', borderRadius: '100px',
          fontSize: '0.7rem', color: NAVY, fontWeight: 500,
        }}>{u}</span>
      ))}
      {scenario.uses.length > 6 && (
        <span style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', color: MUTED }}>+ {scenario.uses.length - 6} más</span>
      )}
    </div>

    <div style={{ borderTop: '1px solid rgba(11,31,58,0.06)', paddingTop: '1rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.6rem', color: MUTED, letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.4rem' }}>OBJETIVO CLAVE</div>
      <div style={{ fontSize: '0.85rem', color: scenario.color, fontWeight: 700, letterSpacing: '0.05em' }}>{scenario.outcome}</div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.75rem', color: MUTED }}>Capital requerido:</span>
      <PendingChip label="POR DEFINIR" />
    </div>
  </motion.div>
);

// ============================================================================
// 4 · USE OF CAPITAL (interactive allocation)
// ============================================================================
const DEFAULT_ALLOCATION = [
  { key: 'engineering', label: 'Producto & Ingeniería', icon: Wrench },
  { key: 'infra', label: 'Infraestructura & Tecnología', icon: Layers },
  { key: 'ai', label: 'Inteligencia Artificial & APIs', icon: Cpu },
  { key: 'security', label: 'Seguridad', icon: Shield },
  { key: 'sales', label: 'Ventas & Marketing', icon: TrendingUp },
  { key: 'ops', label: 'Operaciones', icon: Activity },
  { key: 'legal', label: 'Legal & Corporativo', icon: Scale },
  { key: 'partners', label: 'Alianzas Estratégicas', icon: Compass },
];

const UseOfCapital = () => {
  const [totalCapital, setTotalCapital] = useStoredState('total_capital', '');
  // Only percentages are persisted (keyed by category), never the React components.
  const [pctMap, setPctMap] = useStoredState('allocation_pct', {});

  const rows = useMemo(
    () => DEFAULT_ALLOCATION.map((a) => ({ ...a, pct: pctMap[a.key] ?? '' })),
    [pctMap]
  );

  const totalPct = useMemo(
    () => rows.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0),
    [rows]
  );

  const updatePct = (key, v) => {
    setPctMap((prev) => ({ ...prev, [key]: v ?? '' }));
  };

  const amountFor = (pct) => {
    const t = parseFloat(totalCapital);
    const p = parseFloat(pct);
    if (!t || !p) return null;
    return (t * p) / 100;
  };

  const fmt = (v) => (v == null ? PLACEHOLDER : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

  const reset = () => {
    setTotalCapital('');
    setPctMap({});
  };

  return (
    <section id="allocation" className="cap-section" style={{ background: '#FFFFFF' }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow>04 · USO DEL CAPITAL</Eyebrow>
          <SectionTitle>Asignación editable por categoría.</SectionTitle>
          <Lead>Ajusta el capital total y los porcentajes. Los valores se recalculan en tiempo real.</Lead>
        </FadeIn>

        {/* Total capital + summary */}
        <FadeIn>
          <div style={{
            marginTop: '2.5rem', padding: '1.5rem 2rem',
            background: IVORY, border: '1px solid rgba(11,31,58,0.08)',
            borderRadius: '18px', display: 'flex', flexWrap: 'wrap',
            gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between',
          }} data-testid="allocation-summary">
            <div>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.25em', color: MUTED, fontWeight: 700, marginBottom: '0.4rem' }}>
                CAPITAL TOTAL REQUERIDO
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <EditableAmount value={totalCapital} onChange={setTotalCapital} prefix="$" width="220px" testid="allocation-total-input" />
                <DataTag type="scenario" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: MUTED, letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.3rem' }}>
                  ASIGNACIÓN TOTAL
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 700,
                  color: Math.abs(totalPct - 100) < 0.5 ? EMERALD : GOLD,
                  fontFamily: '"Space Grotesk", sans-serif',
                }} data-testid="allocation-total-pct">
                  {totalPct.toFixed(1)}%
                </div>
              </div>
              <button onClick={reset} data-testid="allocation-reset"
                className="interactive"
                style={{
                  padding: '0.55rem 1rem', background: '#FFFFFF',
                  border: '1px solid rgba(11,31,58,0.1)', borderRadius: '100px',
                  fontSize: '0.75rem', fontWeight: 600, color: NAVY, cursor: 'pointer', fontFamily: 'inherit',
                }}>Reiniciar</button>
            </div>
          </div>

          {Math.abs(totalPct - 100) >= 0.5 && totalPct > 0 && (
            <div data-testid="allocation-warning" style={{
              marginTop: '0.75rem', padding: '0.7rem 1rem',
              background: `${GOLD}12`, border: `1px solid ${GOLD}55`, borderRadius: '10px',
              fontSize: '0.8rem', color: '#8a6d1e', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <AlertTriangle size={13} /> La asignación total debe sumar 100% ({(100 - totalPct).toFixed(1)}% restante).
            </div>
          )}
        </FadeIn>

        <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
          {rows.map((a, i) => (
            <FadeIn key={a.key} delay={i * 0.04}>
              <div data-testid={`alloc-row-${a.key}`} style={{
                padding: '1.15rem 1.25rem', background: IVORY,
                border: '1px solid rgba(11,31,58,0.08)', borderRadius: '16px',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `${EMERALD}12`, border: `1px solid ${EMERALD}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <a.icon size={16} color={EMERALD} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: NAVY, marginBottom: '0.25rem' }}>{a.label}</div>
                  <div style={{ fontSize: '0.7rem', color: MUTED, fontFamily: 'monospace' }}>{fmt(amountFor(a.pct))}</div>
                </div>
                <EditablePercent value={a.pct} onChange={(v) => updatePct(a.key, v)} testid={`alloc-pct-${a.key}`} />
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 5 · 36-MONTH PROJECTION FRAMEWORK
// ============================================================================
const Projection = () => {
  const PHASES = [
    { key: 'p1', label: 'Meses 1-12', focus: 'Product completion · Market prep', color: '#7CC4FF' },
    { key: 'p2', label: 'Meses 13-24', focus: 'Market launch · Initial validation', color: EMERALD },
    { key: 'p3', label: 'Meses 25-36', focus: 'Scale · New verticals', color: GOLD },
  ];
  const rows = [
    { label: 'Revenue assumptions', desc: 'Ingresos estimados por período' },
    { label: 'Operating expenses', desc: 'Gastos operativos por período' },
    { label: 'Capital injections', desc: 'Aportes de capital planificados' },
    { label: 'Cash balance', desc: 'Saldo de caja al cierre' },
    { label: 'Net cash flow', desc: 'Flujo neto del período' },
    { label: 'Runway', desc: 'Meses restantes al ritmo actual' },
    { label: 'Break-even analysis', desc: 'Punto de equilibrio proyectado' },
  ];
  return (
    <section id="projection" className="cap-section" style={{ background: IVORY }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow>05 · PROYECCIÓN FINANCIERA A 36 MESES</Eyebrow>
          <SectionTitle>Marco de proyección por fases.</SectionTitle>
          <Lead>Modelo estructurado para reemplazar supuestos con datos reales a medida que se validen.</Lead>
        </FadeIn>

        <FadeIn>
          <div style={{ marginTop: '2.5rem', background: '#FFFFFF', borderRadius: '22px', border: '1px solid rgba(11,31,58,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(3, 1fr)', background: NAVY, color: '#FFFFFF' }} data-testid="projection-header">
              <div style={{ padding: '1rem 1.25rem', fontSize: '0.65rem', letterSpacing: '0.2em', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>MÉTRICA</div>
              {PHASES.map((p) => (
                <div key={p.key} style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.6rem', color: p.color, fontWeight: 700, letterSpacing: '0.2em', marginBottom: '0.25rem' }}>{p.label.toUpperCase()}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>{p.focus}</div>
                </div>
              ))}
            </div>

            {rows.map((r, ri) => (
              <div key={r.label} data-testid={`projection-row-${ri}`} style={{
                display: 'grid', gridTemplateColumns: '1.2fr repeat(3, 1fr)',
                borderTop: '1px solid rgba(11,31,58,0.06)', alignItems: 'center',
              }}>
                <div style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>{r.label}</div>
                  <div style={{ fontSize: '0.72rem', color: MUTED, marginTop: '0.15rem' }}>{r.desc}</div>
                </div>
                {PHASES.map((p) => (
                  <div key={p.key} style={{ padding: '1rem 1.25rem' }}>
                    <PendingChip label="POR VALIDAR" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

// ============================================================================
// 6 · REVENUE MODEL
// ============================================================================
const REVENUE_SOURCES = [
  { key: 'prof', label: 'Suscripciones profesionales', icon: Users, desc: 'Abogados, contadores, médicos' },
  { key: 'biz', label: 'Suscripciones empresariales', icon: Briefcase, desc: 'Pequeñas y medianas empresas' },
  { key: 'ent', label: 'Planes enterprise', icon: Building2, desc: 'Instituciones y grandes empresas' },
  { key: 'int', label: 'Integraciones', icon: Layers, desc: 'APIs y integraciones especializadas' },
  { key: 'srv', label: 'Servicios estratégicos', icon: Compass, desc: 'Implementación y consultoría' },
  { key: 'eco', label: 'Ecosistema futuro', icon: Sparkles, desc: 'Verticales adicionales, marketplace' },
];

const RevenueModel = () => {
  const [customers, setCustomers] = useStoredState('rev_customers', '');
  const [arpu, setArpu] = useStoredState('rev_arpu', '');
  const [growth, setGrowth] = useStoredState('rev_growth', '');

  const mrr = useMemo(() => {
    const c = parseFloat(customers);
    const a = parseFloat(arpu);
    if (!c || !a) return null;
    return c * a;
  }, [customers, arpu]);
  const arr = mrr != null ? mrr * 12 : null;

  const fmt$ = (v) => (v == null ? PLACEHOLDER : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);

  return (
    <section id="revenue" className="cap-section" style={{ background: '#FFFFFF' }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow>06 · REVENUE MODEL</Eyebrow>
          <SectionTitle>Fuentes de ingreso y supuestos editables.</SectionTitle>
          <Lead>Sin números inventados. Los supuestos se marcan como pendientes hasta que sean validados.</Lead>
        </FadeIn>

        {/* Assumption inputs */}
        <FadeIn>
          <div style={{
            marginTop: '2.5rem', padding: '1.75rem',
            background: IVORY, border: '1px solid rgba(11,31,58,0.08)',
            borderRadius: '18px', display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem',
          }}>
            <RevInput label="Clientes actuales" value={customers} onChange={setCustomers} prefix="" testid="rev-customers" />
            <RevInput label="ARPU mensual" value={arpu} onChange={setArpu} prefix="$" testid="rev-arpu" />
            <RevInput label="Crecimiento mensual" value={growth} onChange={setGrowth} prefix="" suffix="%" testid="rev-growth" />
          </div>
        </FadeIn>

        {/* Computed metrics */}
        <FadeIn>
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <ComputedTile label="MRR" value={fmt$(mrr)} color={EMERALD} testid="rev-mrr" tag="projection" />
            <ComputedTile label="ARR" value={fmt$(arr)} color={GOLD} testid="rev-arr" tag="projection" />
            <ComputedTile label="Customer Growth" value={growth ? `${growth}% / mes` : PLACEHOLDER} color="#7CC4FF" testid="rev-growth-computed" tag="assumption" />
          </div>
        </FadeIn>

        {/* Revenue sources */}
        <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {REVENUE_SOURCES.map((s) => (
            <FadeIn key={s.key}>
              <div data-testid={`rev-source-${s.key}`} style={{
                padding: '1.25rem', background: IVORY,
                border: '1px solid rgba(11,31,58,0.08)', borderRadius: '16px',
                display: 'flex', gap: '1rem', alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: `${EMERALD}12`, border: `1px solid ${EMERALD}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <s.icon size={15} color={EMERALD} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: NAVY }}>{s.label}</div>
                  <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: '0.2rem', marginBottom: '0.6rem' }}>{s.desc}</div>
                  <PendingChip />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

const RevInput = ({ label, value, onChange, prefix, suffix, testid }) => (
  <div>
    <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', color: MUTED, fontWeight: 700, marginBottom: '0.4rem' }}>
      {label.toUpperCase()}
    </div>
    <EditableAmount value={value} onChange={onChange} prefix={prefix ?? ''} suffix={suffix ?? ''} testid={testid} />
  </div>
);

const ComputedTile = ({ label, value, color, testid, tag }) => (
  <div data-testid={testid} style={{
    padding: '1.25rem 1.5rem', background: '#FFFFFF',
    border: `1px solid ${color}33`, borderRadius: '18px',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: MUTED, fontWeight: 700 }}>{label.toUpperCase()}</div>
      <DataTag type={tag} />
    </div>
    <div style={{ fontSize: '1.55rem', fontWeight: 700, color, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.02em' }}>
      {value}
    </div>
  </div>
);

// ============================================================================
// 7 · OPEX MODEL
// ============================================================================
const OPEX_CATEGORIES = [
  { key: 'eng', label: 'Ingeniería', icon: Wrench },
  { key: 'prod', label: 'Desarrollo de producto', icon: Layers },
  { key: 'infra', label: 'Infraestructura', icon: Cpu },
  { key: 'ai', label: 'IA & APIs', icon: Sparkles },
  { key: 'sec', label: 'Seguridad', icon: Shield },
  { key: 'des', label: 'Diseño', icon: Sparkle },
  { key: 'sal', label: 'Ventas', icon: TrendingUp },
  { key: 'mkt', label: 'Marketing', icon: Rocket },
  { key: 'leg', label: 'Legal', icon: Scale },
  { key: 'adm', label: 'Administración', icon: Briefcase },
  { key: 'ops', label: 'Operaciones', icon: Activity },
];

const OpexModel = () => {
  const [amounts, setAmounts] = useStoredState('opex_amounts', {});
  const set = (k, v) => setAmounts((prev) => ({ ...prev, [k]: v ?? '' }));

  const monthly = useMemo(
    () => OPEX_CATEGORIES.reduce((s, c) => s + (parseFloat(amounts[c.key]) || 0), 0),
    [amounts]
  );
  const annual = monthly * 12;
  const total36 = monthly * 36;

  const fmt$ = (v) => (v ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : PLACEHOLDER);

  return (
    <section id="opex" className="cap-section" style={{ background: IVORY }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow>07 · OPERATING EXPENSE MODEL</Eyebrow>
          <SectionTitle>Estructura de gastos editable.</SectionTitle>
          <Lead>Introduce estimaciones mensuales por categoría. El sistema calcula burn rate y proyecciones automáticamente.</Lead>
        </FadeIn>

        <FadeIn>
          <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
            {OPEX_CATEGORIES.map((c) => (
              <div key={c.key} data-testid={`opex-row-${c.key}`} style={{
                padding: '0.95rem 1.1rem', background: '#FFFFFF',
                border: '1px solid rgba(11,31,58,0.06)', borderRadius: '14px',
                display: 'flex', alignItems: 'center', gap: '0.9rem',
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${GOLD}14`, border: `1px solid ${GOLD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.icon size={13} color="#8a6d1e" />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', fontWeight: 600, color: NAVY }}>{c.label}</div>
                <EditableAmount value={amounts[c.key]} onChange={(v) => set(c.key, v)} prefix="$" width="120px" testid={`opex-input-${c.key}`} />
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn>
          <div style={{
            marginTop: '2rem', display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem',
          }}>
            <ComputedTile label="OpEx mensual" value={fmt$(monthly)} color={EMERALD} testid="opex-monthly" tag="assumption" />
            <ComputedTile label="OpEx anual" value={fmt$(annual)} color={GOLD} testid="opex-annual" tag="projection" />
            <ComputedTile label="OpEx 36 meses" value={fmt$(total36)} color="#B888FF" testid="opex-36m" tag="projection" />
            <ComputedTile label="Burn rate" value={fmt$(monthly) + (monthly ? ' / mes' : '')} color="#ff8080" testid="opex-burn" tag="assumption" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

// ============================================================================
// 8 · CASH FLOW MODEL
// ============================================================================
const CashFlowModel = () => {
  const [opening, setOpening] = useStoredState('cf_opening', '');
  const [capital, setCapital] = useStoredState('cf_capital', '');
  const [revenue, setRevenue] = useStoredState('cf_revenue', '');
  const [expenses, setExpenses] = useStoredState('cf_expenses', '');

  const net = useMemo(() => {
    const r = parseFloat(revenue) || 0;
    const e = parseFloat(expenses) || 0;
    if (!revenue && !expenses) return null;
    return r - e;
  }, [revenue, expenses]);

  const ending = useMemo(() => {
    const o = parseFloat(opening);
    const c = parseFloat(capital) || 0;
    const r = parseFloat(revenue) || 0;
    const e = parseFloat(expenses) || 0;
    if (!opening) return null;
    return o + c + r - e;
  }, [opening, capital, revenue, expenses]);

  const runway = useMemo(() => {
    const e = parseFloat(ending);
    const b = parseFloat(expenses);
    if (!e || !b || b === 0) return null;
    return Math.max(0, Math.round(e / b));
  }, [ending, expenses]);

  const fmt$ = (v) => (v == null || isNaN(v) ? PLACEHOLDER : (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }));

  return (
    <section id="cashflow" className="cap-section" style={{ background: NAVY, color: '#FFFFFF' }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow color={GOLD}>08 · CASH FLOW</Eyebrow>
          <SectionTitle light>Flujo de caja mensual — simulador base.</SectionTitle>
          <Lead light>Introduce los inputs por mes. El modelo calcula flujo neto, saldo final, burn rate y runway.</Lead>
        </FadeIn>

        <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }} data-two-col>
          <FadeIn>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <CashRow label="Opening cash balance" value={opening} onChange={setOpening} icon={Wallet} tag="actual" testid="cf-opening" />
              <CashPlus />
              <CashRow label="Capital raised" value={capital} onChange={setCapital} icon={DollarSign} tag="scenario" testid="cf-capital" />
              <CashPlus />
              <CashRow label="Operating revenue" value={revenue} onChange={setRevenue} icon={TrendingUp} tag="projection" testid="cf-revenue" />
              <CashMinus />
              <CashRow label="Operating expenses" value={expenses} onChange={setExpenses} icon={Activity} tag="assumption" testid="cf-expenses" />

              <div style={{ marginTop: '0.5rem', padding: '1.15rem 1.25rem', background: 'rgba(0,200,150,0.08)', border: `1px solid ${EMERALD}55`, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} data-testid="cf-net">
                <div>
                  <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: EMERALD, fontWeight: 700 }}>NET CASH FLOW</div>
                  <div style={{ fontSize: '1.4rem', fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: net != null && net < 0 ? '#ff8080' : '#FFFFFF' }}>{fmt$(net)}</div>
                </div>
                <DataTag type="projection" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div style={{
              padding: '2rem', background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${GOLD}44`, borderRadius: '24px',
              display: 'flex', flexDirection: 'column', gap: '1.5rem',
            }}>
              <CashBigTile label="Ending cash balance" value={fmt$(ending)} color={GOLD} testid="cf-ending" />
              <CashBigTile label="Runway (meses)" value={runway == null ? PLACEHOLDER : `${runway} meses`} color={EMERALD} testid="cf-runway" />
              <CashBigTile label="Burn rate mensual" value={fmt$(expenses ? parseFloat(expenses) : null)} color="#ff8080" testid="cf-burn" />

              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontStyle: 'italic' }}>
                Cada campo se acompaña de una etiqueta que indica si el valor es actual, supuesto, proyectado o escenario.
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn>
          <SimulationEngine
            opening={opening}
            capital={capital}
            revenue={revenue}
            expenses={expenses}
          />
        </FadeIn>
      </div>
      <style>{`@media (max-width: 900px) { [data-two-col] { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
};

const CashRow = ({ label, value, onChange, icon: Icon, tag, testid }) => (
  <div style={{
    padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
    display: 'flex', alignItems: 'center', gap: '1rem',
  }}>
    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={14} color={GOLD} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '0.35rem' }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ maxWidth: '200px' }}>
          <EditableAmount value={value} onChange={onChange} prefix="$" width="200px" testid={testid} />
        </div>
        <DataTag type={tag} />
      </div>
    </div>
  </div>
);

const CashPlus = () => (
  <div style={{ display: 'flex', justifyContent: 'center', color: EMERALD, fontSize: '1.2rem', fontWeight: 700 }}>+</div>
);
const CashMinus = () => (
  <div style={{ display: 'flex', justifyContent: 'center', color: '#ff8080', fontSize: '1.2rem', fontWeight: 700 }}>−</div>
);

const CashBigTile = ({ label, value, color, testid }) => (
  <div data-testid={testid}>
    <div style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: '0.4rem' }}>{label.toUpperCase()}</div>
    <div style={{ fontSize: '1.85rem', fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
  </div>
);

// ============================================================================
// SIMULATION ENGINE — 36-month projection with scenario multipliers
// ============================================================================
const SCENARIO_MULT = {
  conservative: { revenueMult: 0.6, opexMult: 1.1, growth: 0.03, label: 'Conservador', color: '#7CC4FF' },
  base:         { revenueMult: 1.0, opexMult: 1.0, growth: 0.06, label: 'Base',        color: EMERALD  },
  accelerated:  { revenueMult: 1.5, opexMult: 1.15, growth: 0.10, label: 'Acelerado',  color: GOLD     },
};

const runProjection = ({ opening, capital, revenue, expenses, scenarioKey }) => {
  const s = SCENARIO_MULT[scenarioKey] || SCENARIO_MULT.base;
  const openingN = parseFloat(opening) || 0;
  const capitalN = parseFloat(capital) || 0;
  const revenue0 = (parseFloat(revenue) || 0) * s.revenueMult;
  const opex0 = (parseFloat(expenses) || 0) * s.opexMult;

  const months = [];
  let balance = openingN;
  // Capital injection: 60% at month 0, 30% at month 3, 10% at month 6 (typical staged tranche)
  const tranches = { 0: capitalN * 0.6, 3: capitalN * 0.3, 6: capitalN * 0.1 };
  let totalRev = 0, totalOpex = 0, breakEvenMonth = null, minBalance = openingN, runwayMonth = null;

  for (let m = 0; m < 36; m++) {
    const growthFactor = Math.pow(1 + s.growth, m);
    const monthRev = revenue0 * growthFactor;
    // Opex grows slower (2% per month) to simulate discipline
    const monthOpex = opex0 * Math.pow(1.02, m);
    const injection = tranches[m] || 0;
    const net = monthRev - monthOpex;
    balance = balance + injection + net;

    totalRev += monthRev;
    totalOpex += monthOpex;
    if (breakEvenMonth === null && monthRev >= monthOpex && m > 0) breakEvenMonth = m + 1;
    if (balance < minBalance) minBalance = balance;
    if (runwayMonth === null && balance <= 0) runwayMonth = m + 1;

    months.push({
      m: m + 1,
      revenue: Math.round(monthRev),
      opex: Math.round(monthOpex),
      net: Math.round(net),
      injection: Math.round(injection),
      balance: Math.round(balance),
    });
  }

  return {
    scenarioKey,
    scenarioLabel: s.label,
    scenarioColor: s.color,
    months,
    ending: Math.round(balance),
    minBalance: Math.round(minBalance),
    totalRevenue: Math.round(totalRev),
    totalOpex: Math.round(totalOpex),
    breakEvenMonth,
    runwayMonth, // month where balance goes ≤ 0 (null if never)
    monthsRunway: runwayMonth ? runwayMonth : (balance > 0 ? 36 : 0),
  };
};

const SimulationEngine = ({ opening, capital, revenue, expenses }) => {
  const [scenarioKey, setScenarioKey] = useStoredState('sim_scenario', 'base');
  const [result, setResult] = useStoredState('sim_result', null);
  const [running, setRunning] = useState(false);

  const canRun = opening !== '' || capital !== '' || revenue !== '' || expenses !== '';

  const run = () => {
    setRunning(true);
    // Small delay to make the "execution" feel like a proper simulation
    setTimeout(() => {
      const r = runProjection({ opening, capital, revenue, expenses, scenarioKey });
      setResult(r);
      setRunning(false);
    }, 500);
  };

  const clear = () => setResult(null);

  const fmt$ = (v) => (v == null || isNaN(v) ? '—' : (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }));

  return (
    <div data-testid="simulation-engine" style={{
      marginTop: '3rem', padding: '2rem 2.25rem',
      background: `linear-gradient(135deg, rgba(212,175,55,0.08), rgba(0,200,150,0.05))`,
      border: `1px solid ${GOLD}44`, borderRadius: '24px', color: '#FFFFFF',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: GOLD, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.6rem' }}>
            PROYECCIÓN 36 MESES · MOTOR DE SIMULACIÓN
          </div>
          <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.55rem', fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
            Ejecuta el modelo con tus supuestos.
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', maxWidth: '500px' }}>
            El motor aplica multiplicadores de escenario, crecimiento compuesto y tranches de capital para proyectar los próximos 36 meses.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(SCENARIO_MULT).map(([k, s]) => (
            <button
              key={k}
              onClick={() => setScenarioKey(k)}
              data-testid={`sim-scenario-${k}`}
              className="interactive"
              style={{
                padding: '0.5rem 1rem',
                background: scenarioKey === k ? s.color + '22' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${scenarioKey === k ? s.color : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '100px',
                color: scenarioKey === k ? s.color : '#FFFFFF',
                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          onClick={run}
          disabled={!canRun || running}
          data-testid="sim-run"
          className="interactive"
          style={{
            padding: '0.9rem 1.75rem',
            background: !canRun || running ? 'rgba(212,175,55,0.35)' : `linear-gradient(135deg, ${GOLD}, #b8942d)`,
            color: NAVY, border: 'none', borderRadius: '100px',
            fontSize: '0.9rem', fontWeight: 700, cursor: !canRun || running ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}
        >
          <Rocket size={15} /> {running ? 'Ejecutando…' : 'Ejecutar proyección 36m'}
        </button>
        {result && (
          <button onClick={clear} data-testid="sim-clear" className="interactive" style={{
            padding: '0.9rem 1.25rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '100px', color: '#FFFFFF', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Limpiar resultado</button>
        )}
        {!canRun && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', paddingLeft: '0.5rem' }}>
            <Info size={12} /> Introduce al menos un valor de cash flow para ejecutar.
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            data-testid="sim-result"
            style={{ marginTop: '2rem' }}
          >
            {/* Result KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <SimKpi label="Escenario" value={result.scenarioLabel} color={result.scenarioColor} testid="sim-kpi-scenario" />
              <SimKpi label="Balance final (m36)" value={fmt$(result.ending)} color={result.ending >= 0 ? EMERALD : '#ff8080'} testid="sim-kpi-ending" />
              <SimKpi label="Break-even" value={result.breakEvenMonth ? `Mes ${result.breakEvenMonth}` : 'No alcanzado'} color={result.breakEvenMonth ? GOLD : '#ff8080'} testid="sim-kpi-be" />
              <SimKpi label="Runway (meses)" value={result.runwayMonth ? `${result.runwayMonth} meses` : '36+ meses'} color={result.runwayMonth ? '#ff8080' : EMERALD} testid="sim-kpi-runway" />
              <SimKpi label="Revenue 36m" value={fmt$(result.totalRevenue)} color="#7CC4FF" testid="sim-kpi-rev" />
              <SimKpi label="OpEx 36m" value={fmt$(result.totalOpex)} color="#B888FF" testid="sim-kpi-opex" />
            </div>

            {/* Chart */}
            <BalanceChart months={result.months} color={result.scenarioColor} />

            {/* Monthly table */}
            <details style={{ marginTop: '1.5rem' }} data-testid="sim-monthly-table">
              <summary style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', padding: '0.75rem 0', letterSpacing: '0.05em', fontWeight: 600 }}>
                Ver tabla mensual (36 meses) ▾
              </summary>
              <div style={{ overflowX: 'auto', marginTop: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: '#FFFFFF' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {['Mes', 'Revenue', 'OpEx', 'Injection', 'Net', 'Balance'].map((h) => (
                        <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.months.map((r) => (
                      <tr key={r.m} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{String(r.m).padStart(2, '0')}</td>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', color: '#7CC4FF' }}>{fmt$(r.revenue)}</td>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', color: '#B888FF' }}>{fmt$(r.opex)}</td>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', color: GOLD }}>{r.injection ? fmt$(r.injection) : '—'}</td>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', color: r.net >= 0 ? EMERALD : '#ff8080' }}>{fmt$(r.net)}</td>
                        <td style={{ padding: '0.5rem 0.85rem', textAlign: 'right', color: r.balance >= 0 ? '#FFFFFF' : '#ff8080', fontWeight: 700 }}>{fmt$(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <div style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', maxWidth: '720px' }}>
              Resultado calculado con multiplicadores del escenario <b>{result.scenarioLabel}</b> (revenue × {SCENARIO_MULT[result.scenarioKey].revenueMult},
              opex × {SCENARIO_MULT[result.scenarioKey].opexMult}, growth {(SCENARIO_MULT[result.scenarioKey].growth * 100).toFixed(0)}%/mes).
              Capital distribuido en tranches (60% m1, 30% m4, 10% m7). Los valores son proyecciones basadas en supuestos — no constituyen garantía de resultados.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SimKpi = ({ label, value, color, testid }) => (
  <div data-testid={testid} style={{
    padding: '1rem 1.15rem', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
  }}>
    <div style={{ fontSize: '0.58rem', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: '0.35rem' }}>
      {label.toUpperCase()}
    </div>
    <div style={{ fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color, letterSpacing: '-0.01em' }}>
      {value}
    </div>
  </div>
);

// SVG line chart of ending balance across 36 months
const BalanceChart = ({ months, color }) => {
  const W = 800, H = 220, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 30;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const values = months.map((m) => m.balance);
  const maxV = Math.max(...values, 0);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const x = (i) => PAD_L + (i / (months.length - 1)) * innerW;
  const y = (v) => PAD_T + (1 - (v - minV) / range) * innerH;
  const zeroY = y(0);

  const points = months.map((m, i) => `${x(i)},${y(m.balance)}`).join(' ');
  const areaPath = `M ${x(0)},${zeroY} L ${points.split(' ').join(' L ')} L ${x(months.length - 1)},${zeroY} Z`;

  return (
    <div data-testid="sim-chart" style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '1rem', overflow: 'hidden',
    }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
        BALANCE MENSUAL PROYECTADO
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Horizontal gridlines every 25% */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD_L} x2={W - PAD_R} y1={PAD_T + f * innerH} y2={PAD_T + f * innerH} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        ))}
        {/* Zero line */}
        <line x1={PAD_L} x2={W - PAD_R} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 4" />
        <text x={PAD_L - 6} y={zeroY + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.45)">0</text>
        <text x={PAD_L - 6} y={PAD_T + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.45)">MAX</text>
        {/* Area */}
        <path d={areaPath} fill="url(#areaGrad)" />
        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        {/* Dots at m1, m12, m24, m36 */}
        {[0, 11, 23, 35].map((i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(months[i].balance)} r="3.5" fill={color} />
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)">M{months[i].m}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ============================================================================
// 9 · FINANCIAL SCENARIOS (Conservative / Base / Accelerated)
// ============================================================================
const FIN_SCENARIOS = {
  conservative: {
    label: 'Conservador',
    subtitle: 'Adquisición más lenta · runway más ajustado',
    color: '#7CC4FF',
    traits: [
      'Adquisición de clientes más lenta',
      'Crecimiento de ingresos más lento',
      'Período de validación más largo',
      'Mayor presión sobre el flujo de caja',
    ],
  },
  base: {
    label: 'Caso Base',
    subtitle: 'Ejecución razonable · crecimiento controlado',
    color: EMERALD,
    traits: [
      'Adquisición de clientes razonable',
      'Crecimiento de ingresos controlado',
      'Validación gradual del producto',
      'Gastos operativos bajo control',
    ],
  },
  accelerated: {
    label: 'Acelerado',
    subtitle: 'Capital ampliado · ejecución acelerada',
    color: GOLD,
    traits: [
      'Mayor acceso a capital',
      'Contratación más rápida',
      'Ejecución de producto más rápida',
      'Expansión comercial más rápida',
      'Desarrollo temprano de verticales futuras',
    ],
  },
};

const FinancialScenarios = ({ scenario, setScenario }) => {
  const s = FIN_SCENARIOS[scenario] || FIN_SCENARIOS.base;

  return (
    <section id="financial-scenarios" className="cap-section" style={{ background: '#FFFFFF' }}>
      <div className="cap-container">
        <FadeIn>
          <Eyebrow>09 · TRES ESCENARIOS FINANCIEROS</Eyebrow>
          <SectionTitle>Compara los caminos posibles.</SectionTitle>
          <Lead>Ninguno de los escenarios está garantizado. Son marcos de análisis para entender rangos de resultado.</Lead>
        </FadeIn>

        {/* Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
          {Object.entries(FIN_SCENARIOS).map(([k, sc]) => (
            <button
              key={k}
              onClick={() => setScenario(k)}
              data-testid={`fin-scenario-${k}`}
              className="interactive"
              style={{
                padding: '0.7rem 1.4rem',
                background: scenario === k ? sc.color + '22' : IVORY,
                border: `1px solid ${scenario === k ? sc.color + 'aa' : 'rgba(11,31,58,0.08)'}`,
                borderRadius: '100px',
                color: scenario === k ? sc.color : NAVY, fontSize: '0.85rem',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{sc.label}</button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={scenario}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            data-testid="fin-scenario-content"
            style={{
              marginTop: '2rem', padding: '2.5rem',
              background: IVORY, border: `1px solid ${s.color}55`,
              borderRadius: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ fontSize: '0.65rem', color: s.color, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.6rem' }}>
                  ESCENARIO ACTIVO
                </div>
                <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '2rem', fontWeight: 700, color: NAVY, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.9rem', color: NAVY, opacity: 0.7 }}>{s.subtitle}</div>
              </div>
              <div style={{ flex: 2, minWidth: '260px' }}>
                <div style={{ fontSize: '0.62rem', color: MUTED, letterSpacing: '0.22em', fontWeight: 700, marginBottom: '1rem' }}>CARACTERÍSTICAS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {s.traits.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.9rem', color: NAVY }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '2rem', padding: '1rem 1.25rem',
              background: '#FFFFFF', border: `1px solid ${s.color}33`,
              borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.8rem', color: NAVY, opacity: 0.75,
            }}>
              <Info size={13} color={s.color} />
              Los valores financieros específicos por escenario están pendientes de validación y se instancian en el modelo Cash Flow.
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

// ============================================================================
// 10 · KEY FINANCIAL METRICS
// ============================================================================
const KPIS = [
  { key: 'mrr', label: 'MRR', desc: 'Monthly Recurring Revenue' },
  { key: 'arr', label: 'ARR', desc: 'Annual Recurring Revenue' },
  { key: 'cust', label: 'Customer Growth', desc: 'Crecimiento neto de clientes' },
  { key: 'arpu', label: 'ARPU', desc: 'Ingreso promedio por cliente' },
  { key: 'cac', label: 'CAC', desc: 'Costo de adquisición de cliente' },
  { key: 'ltv', label: 'LTV', desc: 'Valor de vida del cliente' },
  { key: 'churn', label: 'Churn', desc: 'Tasa de cancelación' },
  { key: 'gross', label: 'Gross Margin', desc: 'Margen bruto' },
  { key: 'burn', label: 'Burn Rate', desc: 'Consumo mensual de capital' },
  { key: 'runway', label: 'Runway', desc: 'Meses hasta agotar capital' },
  { key: 'be', label: 'Break-even Point', desc: 'Punto de equilibrio proyectado' },
];

const KpiSection = () => (
  <section id="metrics" className="cap-section" style={{ background: IVORY }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow>10 · KEY FINANCIAL METRICS</Eyebrow>
        <SectionTitle>El sistema está preparado para trackear.</SectionTitle>
        <Lead>Los indicadores se marcarán con datos reales cuando estén disponibles. Hoy, todos están explícitamente en <b>PENDIENTE</b>.</Lead>
      </FadeIn>

      <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {KPIS.map((k, i) => (
          <FadeIn key={k.key} delay={i * 0.03}>
            <div data-testid={`kpi-${k.key}`} style={{
              padding: '1.15rem 1.25rem', background: '#FFFFFF',
              border: '1px solid rgba(11,31,58,0.06)', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '110px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', color: MUTED, fontWeight: 700 }}>KPI</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: NAVY, marginTop: '0.1rem' }}>{k.label}</div>
                </div>
                <PendingChip label="PENDIENTE" />
              </div>
              <div style={{ fontSize: '0.72rem', color: MUTED }}>{k.desc}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

// ============================================================================
// 11 · FEASIBILITY (5 dimensions)
// ============================================================================
const FEASIBILITY_DIMENSIONS = [
  {
    key: 'technical', label: 'Técnica', icon: Cpu, color: EMERALD,
    question: '¿Puede la fundación tecnológica existente completarse y escalarse?',
    evidence: 'Punto Cero Legal LIVE en producción. Core tecnológico reusable validado por el primer vertical comercial.',
    status: 'LIVE',
  },
  {
    key: 'commercial', label: 'Comercial', icon: Store, color: GOLD,
    question: '¿Puede Punto Cero Legal resolver un problema real por el que un mercado esté dispuesto a pagar?',
    evidence: 'Hipótesis a validar con clientes reales. Sin invención de tracción ni ingresos.',
    status: 'HYPOTHESIS',
  },
  {
    key: 'financial', label: 'Financiera', icon: DollarSign, color: '#7CC4FF',
    question: '¿Puede el capital requerido sostener product completion, market launch, validación inicial y operating runway?',
    evidence: 'Modelo de escenarios (conservador · base · acelerado) preparado; supuestos pendientes de validación.',
    status: 'HYPOTHESIS',
  },
  {
    key: 'operational', label: 'Operativa', icon: Users, color: '#B888FF',
    question: '¿Puede el equipo fundador actual ejecutar el plan? ¿Qué capacidades adicionales se requieren?',
    evidence: 'Equipo fundador pequeño con inversión personal significativa. Áreas por reforzar: Ingeniería, Producto, Ventas, Marketing, Operaciones.',
    status: 'IN_PROGRESS',
  },
  {
    key: 'expansion', label: 'De expansión', icon: Sparkles, color: '#ff8080',
    question: '¿Puede el shared technology core sostener verticales futuras?',
    evidence: 'Tesis estratégica: BUILD ONCE · REUSE · ADAPT · EXPAND. Continúa siendo validada por la ejecución.',
    status: 'THESIS',
  },
];

const STATUS_LABEL = {
  LIVE: { label: 'LIVE en producción', color: EMERALD },
  IN_PROGRESS: { label: 'En preparación', color: EMERALD },
  HYPOTHESIS: { label: 'Hipótesis · por validar', color: GOLD },
  THESIS: { label: 'Tesis estratégica', color: '#B888FF' },
};

const Feasibility = () => (
  <section id="feasibility" className="cap-section" style={{ background: '#FFFFFF' }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow>11 · FEASIBILITY STUDY</Eyebrow>
        <SectionTitle>Análisis de factibilidad en 5 dimensiones.</SectionTitle>
        <Lead>La factibilidad no se declara. Se construye a través de ejecución medible. Distinguimos entre lo que ya existe, lo que es hipótesis, y lo que es tesis estratégica.</Lead>
      </FadeIn>

      <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        {FEASIBILITY_DIMENSIONS.map((d, i) => (
          <FadeIn key={d.key} delay={i * 0.05}>
            <div data-testid={`feasibility-${d.key}`} style={{
              padding: '1.75rem', background: IVORY,
              border: '1px solid rgba(11,31,58,0.08)', borderRadius: '20px',
              display: 'flex', flexDirection: 'column', gap: '0.9rem', height: '100%',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: d.color + '18', border: `1px solid ${d.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <d.icon size={16} color={d.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: MUTED, fontWeight: 700 }}>FACTIBILIDAD</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: NAVY }}>{d.label}</div>
                  </div>
                </div>
                <span style={{
                  padding: '0.22rem 0.65rem',
                  background: STATUS_LABEL[d.status].color + '18',
                  border: `1px solid ${STATUS_LABEL[d.status].color}55`,
                  borderRadius: '100px', fontSize: '0.6rem',
                  color: STATUS_LABEL[d.status].color, fontWeight: 700, letterSpacing: '0.1em',
                }}>{STATUS_LABEL[d.status].label}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: NAVY, lineHeight: 1.5, fontStyle: 'italic', opacity: 0.85 }}>
                {d.question}
              </div>
              <div style={{ fontSize: '0.8rem', color: NAVY, opacity: 0.65, lineHeight: 1.55, borderTop: '1px solid rgba(11,31,58,0.06)', paddingTop: '0.85rem' }}>
                <b style={{ color: NAVY, opacity: 0.85 }}>Evidencia actual:</b> {d.evidence}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

// ============================================================================
// 12 · MILESTONES (8-stage capital deployment)
// ============================================================================
const MILESTONES = [
  { n: 1, label: 'Technology Foundation', desc: 'Base tecnológica validada en producción' },
  { n: 2, label: 'Punto Cero Legal LIVE', desc: 'Primer vertical comercial en producción' },
  { n: 3, label: 'Commercial Traction', desc: 'Escalar adquisición de clientes', current: true },
  { n: 4, label: 'First Paying Customers', desc: 'Primeros clientes de pago recurrentes' },
  { n: 5, label: 'Commercial Validation', desc: 'Modelo comercial validado' },
  { n: 6, label: 'Recurring Revenue', desc: 'Ingresos recurrentes estables' },
  { n: 7, label: 'Expansion', desc: 'Ampliación de equipo, mercado y features' },
  { n: 8, label: 'New Vertical', desc: 'Nueva vertical del ecosistema' },
];

const Milestones = () => (
  <section id="milestones" className="cap-section" style={{ background: NAVY, color: '#FFFFFF' }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow color={GOLD}>12 · MILESTONE-BASED CAPITAL DEPLOYMENT</Eyebrow>
        <SectionTitle light>Capital conectado a progreso medible.</SectionTitle>
        <Lead light>
          El capital se despliega en fases, ligado a milestones. La ejecución exitosa puede reducir el riesgo y mejorar la posición estratégica —
          no promete aumento de valuación ni retorno de inversión.
        </Lead>
      </FadeIn>

      <div style={{ marginTop: '4rem', position: 'relative' }}>
        {/* Vertical spine */}
        <div style={{ position: 'absolute', left: '30px', top: '0', bottom: '0', width: '2px', background: `linear-gradient(180deg, ${EMERALD}, ${GOLD})`, opacity: 0.5 }} className="milestone-spine" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {MILESTONES.map((m, i) => (
            <FadeIn key={m.n} delay={i * 0.05}>
              <div data-testid={`milestone-${m.n}`} style={{
                display: 'flex', gap: '1.75rem', alignItems: 'flex-start',
                paddingLeft: '0.5rem',
              }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: m.current ? EMERALD : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${m.current ? EMERALD : GOLD + '55'}`,
                  color: m.current ? NAVY : GOLD,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.02em',
                  flexShrink: 0, zIndex: 2, position: 'relative',
                  boxShadow: m.current ? `0 0 30px ${EMERALD}66` : 'none',
                }}>
                  {String(m.n).padStart(2, '0')}
                </div>
                <div style={{
                  flex: 1, padding: '1.15rem 1.5rem',
                  background: m.current ? `${EMERALD}12` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${m.current ? EMERALD + '55' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {m.label}
                    </div>
                    {m.current && <span style={{ padding: '0.22rem 0.7rem', background: EMERALD, borderRadius: '100px', fontSize: '0.6rem', color: NAVY, fontWeight: 700, letterSpacing: '0.15em' }}>ETAPA ACTUAL</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.35rem' }}>{m.desc}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      <FadeIn>
        <div style={{
          marginTop: '4rem', padding: '1.75rem 2rem',
          background: `${GOLD}0F`, border: `1px solid ${GOLD}44`, borderRadius: '18px',
          display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'center',
        }}>
          {['Capital', 'Milestones', 'Validación', 'Creación de valor'].map((c, i, arr) => (
            <React.Fragment key={c}>
              <div style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 700, letterSpacing: '0.05em' }}>{c}</div>
              {i < arr.length - 1 && <ArrowRight size={14} color={GOLD} />}
            </React.Fragment>
          ))}
        </div>
      </FadeIn>
    </div>
    <style>{`@media (max-width: 500px) { .milestone-spine { left: 20px !important; } }`}</style>
  </section>
);

// ============================================================================
// 13 · READINESS SUMMARY
// ============================================================================
const READINESS = [
  { label: 'Etapa actual', value: 'Ecosistema con primer vertical LIVE en producción', color: EMERALD },
  { label: 'Producto real', value: 'Punto Cero Legal · LIVE en producción', color: GOLD },
  { label: 'Activo estratégico', value: 'Shared technology core validado en producción', color: '#7CC4FF' },
  { label: 'Oportunidad', value: 'Múltiples verticales · visión LatAm 18 países', color: '#B888FF' },
  { label: 'Propósito del capital', value: 'Crecimiento comercial y expansión del ecosistema', color: EMERALD },
  { label: 'Próximo milestone', value: 'Escalar adquisición de clientes y validar tesis comercial', color: GOLD },
  { label: 'Visión largo plazo', value: 'Ecosistema tecnológico latinoamericano conectado', color: '#7CC4FF' },
];

const Readiness = () => (
  <section id="readiness" className="cap-section" style={{ background: IVORY }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow>13 · INVESTMENT READINESS SUMMARY</Eyebrow>
        <SectionTitle>Dónde estamos, hacia dónde vamos.</SectionTitle>
        <Lead>Un resumen honesto — sin adornos, sin invenciones, sin promesas.</Lead>
      </FadeIn>

      <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {READINESS.map((r, i) => (
          <FadeIn key={i} delay={i * 0.04}>
            <div data-testid={`readiness-${i}`} style={{
              padding: '1.5rem 1.75rem', background: '#FFFFFF',
              border: `1px solid ${r.color}33`, borderRadius: '18px',
              display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '110px',
            }}>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: r.color, fontWeight: 700 }}>{r.label.toUpperCase()}</div>
              <div style={{ fontSize: '0.95rem', color: NAVY, fontWeight: 500, lineHeight: 1.4 }}>{r.value}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

// ============================================================================
// 14 · DISCLAIMER
// ============================================================================
const Disclaimer = () => (
  <section id="disclaimer" className="cap-section" style={{ background: NAVY_DEEP, color: 'rgba(255,255,255,0.75)' }}>
    <div className="cap-container">
      <FadeIn>
        <Eyebrow color={GOLD}>14 · DISCLAIMER</Eyebrow>
        <div style={{ maxWidth: '820px' }}>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Las proyecciones financieras presentadas se basan en supuestos y escenarios, y no constituyen garantías de resultados futuros.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1rem' }}>
            Los resultados reales pueden diferir de manera material debido a factores de ejecución, condiciones de mercado, adopción de clientes,
            competencia, condiciones de financiamiento, factores regulatorios y otras variables no previstas.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
            Nada de lo presentado debe interpretarse como una garantía de utilidades, retorno de inversión, incrementos de valuación o
            resultados de salida específicos.
          </p>
        </div>

        <div style={{
          marginTop: '2.5rem', padding: '1.25rem 1.5rem',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem',
          fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)',
        }}>
          <AlertTriangle size={15} color={GOLD} />
          Este material es informativo y no constituye asesoría financiera ni oferta de valores.
        </div>
      </FadeIn>
    </div>
  </section>
);

// ============================================================================
// FOOTER BRIDGE
// ============================================================================
const FooterBridge = () => (
  <footer style={{ background: '#050e1c', color: 'rgba(255,255,255,0.55)', padding: '3rem 2rem', textAlign: 'center' }}>
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ fontSize: '0.9rem', color: '#FFFFFF', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
        PUNTO CERO <span style={{ color: EMERALD }}>SYSTEM</span>
      </div>
      <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '2rem', color: 'rgba(255,255,255,0.45)' }}>
        Investor Center · Capital Strategy
      </div>
      <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.78rem' }}>
        <Link to="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Home</Link>
        <Link to="/executive-summary" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Executive Summary</Link>
        <Link to="/investor-pitch-deck" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Pitch Deck</Link>
        <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Punto Cero Legal</a>
        <Link to="/request-access" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Request access</Link>
      </div>
    </div>
  </footer>
);

export default CapitalStrategyPage;
