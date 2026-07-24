import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, ExternalLink, Circle, Zap, Layers, Globe2, Users,
  Cpu, Sparkles, Building2, Scale, HeartPulse, Stethoscope, ShoppingBag, Calculator,
  Briefcase, Home, Shield, Plane, GraduationCap, UserCog, Utensils, Truck,
  Hammer, Sprout, MapPin, Clock, TrendingUp, Wind, Compass, ChevronDown,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

const SECTIONS = [
  { id: 'hero', label: 'Punto Cero' },
  { id: 'origin', label: 'Origen' },
  { id: 'problem', label: 'Problema' },
  { id: 'opportunity', label: 'Oportunidad' },
  { id: 'vision', label: 'Visión' },
  { id: 'core', label: 'Core Tecnológico' },
  { id: 'legal', label: 'Punto Cero Legal' },
  { id: 'ecosystem', label: 'Ecosistema' },
  { id: 'community', label: 'Comunidad' },
  { id: 'founders', label: 'Fundadores' },
  { id: 'stage', label: 'Etapa Actual' },
  { id: 'next', label: 'Próxima Etapa' },
  { id: 'future', label: 'Visión Largo Plazo' },
  { id: 'cta', label: 'Conversación' },
];

const ExecutiveSummaryPage = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ background: '#F7F5F0', color: NAVY, fontFamily: '"Space Grotesk", sans-serif' }} data-testid="executive-summary-page">
      {/* Progress bar */}
      <motion.div
        style={{
          position: 'fixed', top: 0, left: 0, height: '2px', background: `linear-gradient(90deg, ${EMERALD}, ${GOLD})`,
          zIndex: 100, width: progressWidth,
        }}
      />

      {/* Top nav */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.15rem 2rem', background: 'rgba(247,245,240,0.85)',
        backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(11,31,58,0.06)',
      }}>
        <Link to="/" data-testid="exec-back-home" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          color: NAVY, textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600,
        }} className="interactive">
          <ArrowLeft size={14} /> <span>Punto Cero <span style={{ color: EMERALD, fontWeight: 700 }}>System</span></span>
        </Link>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 0.9rem', background: `${GOLD}1F`,
          border: `1px solid ${GOLD}55`, borderRadius: '100px',
        }}>
          <Sparkles size={11} color={GOLD} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8a6d1e', letterSpacing: '0.25em' }}>
            EXECUTIVE SUMMARY
          </span>
        </div>
        <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" data-testid="exec-legal-external"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: NAVY, textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }} className="interactive">
          Punto Cero Legal <ExternalLink size={12} />
        </a>
      </div>

      {/* Side dot nav */}
      <nav style={{
        position: 'fixed', top: '50%', right: '1.5rem', transform: 'translateY(-50%)',
        zIndex: 80, display: 'flex', flexDirection: 'column', gap: '0.85rem',
      }} className="exec-dot-nav">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            data-testid={`dot-nav-${s.id}`}
            aria-label={s.label}
            className="interactive"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <span style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: activeSection === s.id ? NAVY : 'transparent',
              transition: 'color .3s', minWidth: '80px', textAlign: 'right',
            }}>
              {s.label}
            </span>
            <span style={{
              width: activeSection === s.id ? '18px' : '6px',
              height: '6px', borderRadius: '4px',
              background: activeSection === s.id ? EMERALD : 'rgba(11,31,58,0.25)',
              transition: 'all .3s',
            }} />
          </button>
        ))}
      </nav>

      <Hero />
      <Origin />
      <Problem />
      <Opportunity />
      <Vision />
      <TechnologyCore />
      <PuntoCeroLegal />
      <Ecosystem />
      <Community />
      <FoundingTeam />
      <CurrentStage />
      <NextStage />
      <LongTermVision />
      <FinalCTA />

      <ExecFooter />

      <style>{`
        @media (max-width: 900px) {
          .exec-dot-nav { display: none !important; }
        }
        .exec-section { padding: 5rem 1rem; position: relative; overflow-x: clip; }
        @media (min-width: 600px) { .exec-section { padding: 7rem 2rem; } }
        @media (min-width: 900px) {
          .exec-section { padding: 10rem 4rem; }
        }
        .exec-container { max-width: 1200px; margin: 0 auto; min-width: 0; }
        .exec-eyebrow {
          font-size: 0.7rem; letter-spacing: 0.3em; font-weight: 700;
          color: ${EMERALD}; display: inline-block; margin-bottom: 1.5rem;
        }
        .exec-title {
          font-size: clamp(2.2rem, 4.5vw, 4rem); font-weight: 300;
          letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 1.5rem;
        }
        .exec-title-bold { font-weight: 700; }
        .exec-lead { font-size: 1.15rem; line-height: 1.7; font-weight: 300; opacity: 0.85; max-width: 640px; }
      `}</style>
    </div>
  );
};

// ============================================================================
// SECTION 1 — HERO
// ============================================================================
const Hero = () => {
  return (
    <section id="hero" style={{
      minHeight: '100vh', background: `radial-gradient(ellipse at center, #0e2647 0%, ${NAVY} 60%, #071527 100%)`,
      color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: '6rem 2rem',
    }}>
      {/* Expanding orbits */}
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 1.2], opacity: [0, 0.4, 0] }}
          transition={{ duration: 6, repeat: Infinity, delay: i * 1.5, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: `${300 + i * 200}px`, height: `${300 + i * 200}px`,
            borderRadius: '50%', border: `1px solid ${EMERALD}33`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {/* Central point */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], boxShadow: [`0 0 20px ${EMERALD}`, `0 0 60px ${EMERALD}aa`, `0 0 20px ${EMERALD}`] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '18px', height: '18px', borderRadius: '50%',
          background: EMERALD, transform: 'translate(-50%, -50%)',
          zIndex: 1,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.4 }}
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '900px' }}
      >
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 1rem', background: 'rgba(212,175,55,0.1)',
          border: `1px solid ${GOLD}55`, borderRadius: '100px', marginBottom: '2.5rem',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: GOLD }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: GOLD, letterSpacing: '0.3em' }}>
            EXECUTIVE SUMMARY · 2026
          </span>
        </div>

        <h1 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 'clamp(3rem, 8vw, 6.5rem)', fontWeight: 200,
          letterSpacing: '-0.04em', lineHeight: 0.95, marginBottom: '1.5rem',
        }}>
          PUNTO CERO<br />
          <span style={{ fontWeight: 800, background: `linear-gradient(135deg, ${EMERALD}, ${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SYSTEM
          </span>
        </h1>

        <div style={{ fontSize: '0.75rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: '3rem' }}>
          WHERE&nbsp;&nbsp;EVERYTHING&nbsp;&nbsp;BEGINS
        </div>

        <p style={{ fontSize: 'clamp(1rem, 1.6vw, 1.35rem)', lineHeight: 1.6, fontWeight: 300, color: 'rgba(255,255,255,0.85)', maxWidth: '720px', margin: '0 auto 1.5rem' }}>
          Estamos construyendo <b style={{ fontWeight: 600 }}>infraestructura tecnológica compartida</b> para un ecosistema latinoamericano conectado.
        </p>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.7, fontWeight: 300, color: 'rgba(255,255,255,0.6)', maxWidth: '620px', margin: '0 auto 3rem', fontStyle: 'italic' }}>
          Esto no es una aplicación. Es una plataforma. Es una visión tecnológica de largo plazo diseñada para conectar profesionales, emprendedores, empresas, industrias y oportunidades a través de una base tecnológica compartida y escalable.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => document.getElementById('origin').scrollIntoView({ behavior: 'smooth' })}
            data-testid="hero-begin-journey"
            className="interactive"
            style={{
              padding: '1rem 1.75rem',
              background: `linear-gradient(135deg, ${GOLD}, #b8942d)`,
              color: NAVY, border: 'none', borderRadius: '100px',
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'inherit',
            }}
          >
            Comenzar el recorrido <ArrowRight size={16} />
          </button>
          <Link
            to="/investor-pitch-deck"
            data-testid="hero-view-pitch"
            className="interactive"
            style={{
              padding: '1rem 1.75rem', background: 'transparent',
              color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '100px', fontSize: '0.9rem', fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            Investor Pitch Deck <ArrowRight size={16} />
          </Link>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        style={{
          position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <ChevronDown size={24} />
      </motion.div>
    </section>
  );
};

// ============================================================================
// SECTION 2 — ORIGIN
// ============================================================================
const Origin = () => {
  return (
    <section id="origin" className="exec-section" style={{ background: '#F7F5F0' }}>
      <div className="exec-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
        <FadeIn>
          <div className="exec-eyebrow">01 · EL ORIGEN</div>
          <h2 className="exec-title">
            Donde <span className="exec-title-bold">todo comienza</span>.
          </h2>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.5rem 1rem', background: 'rgba(0,200,150,0.08)',
            border: `1px solid ${EMERALD}44`, borderRadius: '100px',
            marginBottom: '2rem', fontSize: '0.75rem', color: '#0a6b52', fontWeight: 600,
          }}>
            <MapPin size={12} /> Punto Fijo · Falcón · Península de Paraguaná
          </div>
          <p className="exec-lead" style={{ marginBottom: '1.5rem' }}>
            Punto Cero System nació en la tierra de la brisa. No como una estrategia comercial,
            sino como una filosofía: el instante en que la transformación comienza.
          </p>
          <p className="exec-lead" style={{ marginBottom: '1.5rem' }}>
            Punto Cero es el momento en que alguien decide <b style={{ fontWeight: 600 }}>volver a empezar</b> — construir una empresa,
            reinventar una profesión, perseguir una idea, superar una dificultad, crear un futuro nuevo.
          </p>
          <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.4rem', fontWeight: 300, fontStyle: 'italic', color: NAVY, lineHeight: 1.4, borderLeft: `2px solid ${GOLD}`, paddingLeft: '1.5rem', margin: '2rem 0' }}>
            Todos tenemos un Punto Cero.<br />
            Es el lugar donde el miedo se queda atrás y la construcción comienza.
          </p>
          <p style={{ fontSize: '0.95rem', color: NAVY, opacity: 0.7, fontWeight: 400 }}>
            Empezar desde cero no es una desventaja. Es el punto de partida desde el cual la transformación comienza.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div style={{ position: 'relative', aspectRatio: '1', maxWidth: '460px', margin: '0 auto' }}>
            {/* Radial timeline */}
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
              <defs>
                <radialGradient id="originGrad" cx="50%" cy="50%">
                  <stop offset="0%" stopColor={EMERALD} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={EMERALD} stopOpacity="0" />
                </radialGradient>
              </defs>
              {[60, 120, 180].map((r, i) => (
                <motion.circle
                  key={r}
                  cx="200" cy="200" r={r}
                  fill="none" stroke={NAVY} strokeOpacity="0.1" strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ scale: 0.5, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.3 + i * 0.2 }}
                />
              ))}
              <circle cx="200" cy="200" r="30" fill="url(#originGrad)" />
              <circle cx="200" cy="200" r="8" fill={EMERALD} />

              {[
                { a: 0, r: 120, label: 'Persona' },
                { a: 60, r: 120, label: 'Idea' },
                { a: 120, r: 120, label: 'Talento' },
                { a: 180, r: 120, label: 'Construcción' },
                { a: 240, r: 120, label: 'Futuro' },
                { a: 300, r: 120, label: 'Ecosistema' },
              ].map((p, i) => {
                const rad = (p.a * Math.PI) / 180;
                const x = 200 + p.r * Math.cos(rad);
                const y = 200 + p.r * Math.sin(rad);
                return (
                  <motion.g key={p.label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 + i * 0.1 }}>
                    <line x1="200" y1="200" x2={x} y2={y} stroke={NAVY} strokeOpacity="0.15" strokeWidth="1" />
                    <circle cx={x} cy={y} r="5" fill={GOLD} />
                    <text x={x} y={y - 12} textAnchor="middle" fontSize="10" fill={NAVY} fontWeight="600" opacity="0.75">{p.label}</text>
                  </motion.g>
                );
              })}
            </svg>
            <div style={{ position: 'absolute', bottom: '-1rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.7rem', color: NAVY, opacity: 0.5, letterSpacing: '0.2em', fontWeight: 600 }}>
              <Wind size={11} /> ORIGEN → EXPANSIÓN
            </div>
          </div>
        </FadeIn>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #origin .exec-container { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
      `}</style>
    </section>
  );
};

// ============================================================================
// SECTION 3 — PROBLEM
// ============================================================================
const Problem = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });

  return (
    <section id="problem" className="exec-section" style={{ background: NAVY, color: '#FFFFFF' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow" style={{ color: GOLD }}>02 · EL PROBLEMA</div>
          <h2 className="exec-title" style={{ color: '#FFFFFF', maxWidth: '900px' }}>
            Una América Latina <span className="exec-title-bold" style={{ color: GOLD }}>fragmentada</span>.
          </h2>
          <p className="exec-lead" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '4rem' }}>
            Millones de profesionales, pequeñas empresas y emprendedores tienen talento, conocimiento y capacidad de crecer.
            Pero operan con herramientas desconectadas, procesos manuales, tecnología cara y sistemas que no dialogan entre sí.
          </p>
        </FadeIn>

        <div ref={ref} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center',
        }} className="problem-grid">
          {/* Fragmentation → Connection viz */}
          <div style={{ position: 'relative', aspectRatio: '1' }}>
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
              {[
                { x: 80, y: 90, l: 'Abogado' },
                { x: 320, y: 100, l: 'Médico' },
                { x: 100, y: 300, l: 'Contador' },
                { x: 310, y: 310, l: 'Negocio' },
                { x: 200, y: 60, l: 'Emprendedor' },
                { x: 60, y: 200, l: 'Profesional' },
                { x: 340, y: 200, l: 'Empresa' },
                { x: 200, y: 340, l: 'Comunidad' },
              ].map((n, i) => (
                <motion.g
                  key={n.l}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <circle cx={n.x} cy={n.y} r="26" fill={NAVY} stroke={GOLD} strokeOpacity="0.35" strokeWidth="1" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="9" fill="#FFFFFF" fontWeight="600">{n.l}</text>
                </motion.g>
              ))}
              {/* Connection lines appear later */}
              {inView && [
                [1, 4], [4, 6], [6, 7], [7, 5], [5, 2], [2, 0], [0, 1], [3, 6], [3, 1], [5, 0],
              ].map(([a, b], i) => {
                const nodes = [
                  { x: 80, y: 90 }, { x: 320, y: 100 }, { x: 100, y: 300 }, { x: 310, y: 310 },
                  { x: 200, y: 60 }, { x: 60, y: 200 }, { x: 340, y: 200 }, { x: 200, y: 340 },
                ];
                return (
                  <motion.line
                    key={i}
                    x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
                    stroke={EMERALD} strokeOpacity="0.5" strokeWidth="1"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 2 + i * 0.1, duration: 0.8 }}
                  />
                );
              })}
              {/* Central emerald pulse */}
              <motion.circle
                cx="200" cy="200" r="12" fill={EMERALD}
                initial={{ scale: 0 }}
                animate={inView ? { scale: [0, 1.4, 1] } : {}}
                transition={{ delay: 3, duration: 1 }}
              />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '0.3em', fontWeight: 700, transform: 'translateY(-2rem)' }}>
              FRAGMENTACIÓN → CONEXIÓN
            </div>
          </div>

          <div>
            <FragRow icon={Scale} label="Un abogado" text="administra casos entre documentos, emails y apps sin comunicación." />
            <FragRow icon={Stethoscope} label="Un médico" text="opera con sistemas múltiples que no dialogan entre sí." />
            <FragRow icon={Calculator} label="Un contador" text="utiliza distintas plataformas para clientes y operaciones." />
            <FragRow icon={ShoppingBag} label="Un negocio" text="gestiona inventario, ventas, pagos y clientes con herramientas aisladas." />

            <div style={{
              marginTop: '2.5rem', padding: '1.5rem',
              background: 'rgba(212,175,55,0.06)', border: `1px solid ${GOLD}33`,
              borderRadius: '18px', fontSize: '0.95rem', lineHeight: 1.6,
              color: 'rgba(255,255,255,0.9)',
            }}>
              El problema no es la ausencia de software.<br />
              El problema es la ausencia de un <b style={{ color: GOLD }}>ecosistema tecnológico integrado</b>.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .problem-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
      `}</style>
    </section>
  );
};

const FragRow = ({ icon: Icon, label, text }) => (
  <FadeIn>
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,200,150,0.1)', border: `1px solid ${EMERALD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={EMERALD} />
      </div>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.15rem' }}>{label}</div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{text}</div>
      </div>
    </div>
  </FadeIn>
);

// ============================================================================
// SECTION 4 — OPPORTUNITY
// ============================================================================
const Opportunity = () => {
  const countries = [
    'México', 'Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panamá',
    'Colombia', 'Venezuela', 'Ecuador', 'Perú', 'Bolivia', 'Chile', 'Argentina',
    'Uruguay', 'Paraguay', 'Rep. Dominicana', 'Puerto Rico',
  ];
  return (
    <section id="opportunity" className="exec-section" style={{ background: '#F7F5F0' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow">03 · LA OPORTUNIDAD</div>
          <h2 className="exec-title">
            18 países. Una <span className="exec-title-bold">base tecnológica</span>.
          </h2>
          <p className="exec-lead" style={{ marginBottom: '3rem' }}>
            Latinoamérica no es un solo mercado. Es una red de países con distintas monedas, culturas, regulaciones e industrias.
            Pero los profesionales y empresas de toda la región enfrentan retos operativos y tecnológicos similares.
          </p>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }} className="opp-grid">
          <FadeIn>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <StrategyRow n="01" title="Una base tecnológica compartida" />
              <StrategyRow n="02" title="Adaptación local" />
              <StrategyRow n="03" title="Múltiples mercados" />
              <StrategyRow n="04" title="Múltiples industrias" />
              <StrategyRow n="05" title="Un ecosistema conectado" highlight />
            </div>

            <div style={{
              marginTop: '2rem', padding: '1.25rem 1.5rem',
              background: 'rgba(11,31,58,0.04)', border: '1px solid rgba(11,31,58,0.08)',
              borderRadius: '16px', fontSize: '0.9rem', lineHeight: 1.6, color: NAVY,
            }}>
              La visión de largo plazo está diseñada para expandirse a través de <b>18 países latinoamericanos</b>.
              Punto Cero System no opera actualmente en los 18 países — la oportunidad de expansión es la visión estratégica.
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div style={{
              position: 'relative', padding: '2.5rem',
              background: `linear-gradient(180deg, #FFFFFF, #F7F5F0)`,
              border: '1px solid rgba(11,31,58,0.06)', borderRadius: '30px',
              boxShadow: '0 30px 80px rgba(11,31,58,0.08)',
            }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: EMERALD, fontWeight: 700, marginBottom: '1rem' }}>
                OPORTUNIDAD REGIONAL
              </div>
              <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '5rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: NAVY, marginBottom: '1.5rem' }}>
                18
              </div>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', fontWeight: 700, color: NAVY, marginBottom: '2rem' }}>
                PAÍSES LATINOAMERICANOS · VISIÓN LARGO PLAZO
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {countries.map((c) => (
                  <span key={c} style={{
                    padding: '0.3rem 0.7rem', background: 'rgba(0,200,150,0.08)',
                    border: `1px solid ${EMERALD}33`, borderRadius: '100px',
                    fontSize: '0.72rem', color: '#0a6b52', fontWeight: 600,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .opp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const StrategyRow = ({ n, title, highlight }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '1.25rem',
    padding: '1rem 1.25rem',
    background: highlight ? `${EMERALD}12` : 'transparent',
    border: `1px solid ${highlight ? EMERALD + '44' : 'rgba(11,31,58,0.08)'}`,
    borderRadius: '14px',
  }}>
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: highlight ? EMERALD : 'rgba(11,31,58,0.4)', letterSpacing: '0.2em', minWidth: '22px' }}>{n}</span>
    <span style={{ fontSize: '0.95rem', fontWeight: highlight ? 700 : 500, color: NAVY }}>{title}</span>
  </div>
);

// ============================================================================
// SECTION 5 — VISION
// ============================================================================
const Vision = () => {
  const layers = [
    { label: 'PUNTO CERO SYSTEM', sub: 'Visión de plataforma' },
    { label: 'SHARED TECHNOLOGY CORE', sub: 'Base tecnológica reusable' },
    { label: 'MÚLTIPLES VERTICALES ESPECIALIZADAS', sub: 'Legal · Medical · Commerce · +' },
    { label: 'PROFESIONALES · EMPRENDEDORES · EMPRESAS', sub: 'Usuarios finales' },
    { label: 'COMUNIDADES · OPORTUNIDADES CONECTADAS', sub: 'Ecosistema' },
  ];
  return (
    <section id="vision" className="exec-section" style={{ background: `radial-gradient(ellipse at top, #0e2647 0%, ${NAVY} 100%)`, color: '#FFFFFF', overflow: 'hidden' }}>
      <div className="exec-container" style={{ textAlign: 'center' }}>
        <FadeIn>
          <div className="exec-eyebrow" style={{ color: GOLD }}>04 · LA VISIÓN</div>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 200,
            letterSpacing: '-0.04em', lineHeight: 1.05, color: '#FFFFFF',
            marginBottom: '1rem',
          }}>
            Esto no es una <span style={{ fontWeight: 800, color: GOLD }}>aplicación</span>.
          </h2>
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 300,
            letterSpacing: '-0.03em', lineHeight: 1.1, color: 'rgba(255,255,255,0.9)',
            marginBottom: '3rem',
          }}>
            Es una <span style={{ fontWeight: 800, background: `linear-gradient(135deg, ${EMERALD}, ${GOLD})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>plataforma</span>.
          </h3>
          <p className="exec-lead" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: '720px', margin: '0 auto 5rem' }}>
            Punto Cero System construye infraestructura tecnológica compartida para múltiples verticales profesionales e industriales.
            No aplicaciones aisladas — una base reusable capaz de sostener múltiples plataformas especializadas.
          </p>
        </FadeIn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '780px', margin: '0 auto', position: 'relative' }}>
          {layers.map((l, i) => (
            <FadeIn key={l.label} delay={i * 0.1}>
              <VisionLayer index={i} label={l.label} sub={l.sub} isLast={i === layers.length - 1} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

const VisionLayer = ({ index, label, sub, isLast }) => (
  <div style={{ position: 'relative' }}>
    <div style={{
      padding: '1.5rem 2rem',
      background: `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
      border: `1px solid rgba(${index === 1 ? '212,175,55' : '0,200,150'}, ${0.2 + index * 0.05})`,
      borderRadius: '100px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.15rem)', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', letterSpacing: '0.1em' }}>{sub}</div>
    </div>
    {!isLast && (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
        <ChevronDown size={16} color={GOLD} opacity={0.7} />
      </div>
    )}
  </div>
);

// ============================================================================
// SECTION 6 — TECHNOLOGY CORE
// ============================================================================
const TechnologyCore = () => {
  const capabilities = [
    { icon: Cpu, label: 'Inteligencia Artificial' },
    { icon: Users, label: 'CRM' },
    { icon: Zap, label: 'Automatización' },
    { icon: Layers, label: 'Gestión Documental' },
    { icon: TrendingUp, label: 'Dashboards & Reportes' },
    { icon: UserCog, label: 'Usuarios · Roles · Permisos' },
    { icon: Shield, label: 'Seguridad' },
    { icon: Compass, label: 'APIs · Data Architecture' },
    { icon: Sparkles, label: 'Infraestructura Escalable' },
  ];
  return (
    <section id="core" className="exec-section" style={{ background: '#FFFFFF' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow">05 · SHARED TECHNOLOGY CORE</div>
          <h2 className="exec-title">
            Construir una vez. <span className="exec-title-bold">Reusar. Adaptar. Expandir.</span>
          </h2>
          <p className="exec-lead" style={{ marginBottom: '4rem' }}>
            La tecnología creada para una vertical se convierte en fundamento para las próximas.
            El core tecnológico compartido es uno de los activos estratégicos de Punto Cero System.
          </p>
        </FadeIn>

        {/* Architecture flow */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'flex-start' }} className="core-grid">
          <FadeIn>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {capabilities.map((c) => (
                <div key={c.label} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.9rem 1.2rem',
                  background: '#F7F5F0', border: '1px solid rgba(11,31,58,0.06)',
                  borderRadius: '14px',
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${EMERALD}12`, border: `1px solid ${EMERALD}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <c.icon size={15} color={EMERALD} />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: NAVY }}>{c.label}</span>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <ArchitectureDiagram />
          </FadeIn>
        </div>

        <FadeIn>
          <div style={{
            marginTop: '4rem', padding: '2rem',
            background: NAVY, borderRadius: '24px', color: '#FFFFFF',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem',
          }} className="core-clarity-grid">
            <ClarityCol label="TECNOLOGÍA ACTUAL" value="Core validado en producción" color={EMERALD} />
            <ClarityCol label="PRODUCTO ACTUAL" value="Punto Cero Legal" color={GOLD} />
            <ClarityCol label="VERTICALES FUTURAS" value="Visión de expansión" color="rgba(255,255,255,0.7)" />
          </div>
        </FadeIn>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .core-grid { grid-template-columns: 1fr !important; }
          .core-clarity-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const ClarityCol = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 700, color, opacity: 0.9, marginBottom: '0.75rem' }}>{label}</div>
    <div style={{ fontSize: '1.15rem', fontWeight: 300, color: '#FFFFFF' }}>{value}</div>
  </div>
);

const ArchitectureDiagram = () => (
  <div style={{ position: 'relative', padding: '2rem 1rem' }}>
    <ArchNode label="SHARED CORE" sub="Reusable technology" color={EMERALD} big />
    <ArchArrow />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
      <ArchNode label="Legal" tag="LIVE" color={GOLD} />
      <ArchNode label="Medical" tag="Futuro" color="rgba(11,31,58,0.4)" />
      <ArchNode label="Commerce" tag="Futuro" color="rgba(11,31,58,0.4)" />
    </div>
    <ArchArrow />
    <ArchNode label="Verticales Especializadas" sub="Legal · Medical · Commerce · Accounting · +" color={NAVY} />
  </div>
);

const ArchNode = ({ label, sub, tag, color, big }) => (
  <div style={{
    padding: big ? '1.25rem 1.5rem' : '0.75rem 0.9rem',
    background: '#FFFFFF', border: `1px solid ${color}55`,
    borderRadius: big ? '20px' : '100px',
    boxShadow: '0 8px 24px rgba(11,31,58,0.05)',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: big ? '0.95rem' : '0.8rem', fontWeight: 700, color, letterSpacing: '0.05em' }}>{label}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.5)', marginTop: '0.2rem' }}>{sub}</div>}
    {tag && <div style={{ fontSize: '0.6rem', color, marginTop: '0.15rem', letterSpacing: '0.15em', fontWeight: 700 }}>{tag}</div>}
  </div>
);
const ArchArrow = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
    <ChevronDown size={16} color={GOLD} />
  </div>
);

// ============================================================================
// SECTION 7 — PUNTO CERO LEGAL
// ============================================================================
const PuntoCeroLegal = () => {
  const capabilities = [
    'Inteligencia Artificial', 'CRM y gestión de clientes', 'Gestión documental',
    'Automatización', 'Dashboards', 'Usuarios · Roles', 'Seguridad', 'Reportes',
    'Arquitectura escalable',
  ];
  return (
    <section id="legal" className="exec-section" style={{
      background: `linear-gradient(180deg, ${NAVY} 0%, #071527 100%)`, color: '#FFFFFF',
    }}>
      <div className="exec-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }} className="legal-grid">
          <FadeIn>
            <div className="exec-eyebrow" style={{ color: GOLD }}>06 · EL PRIMER PRODUCTO REAL</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 1rem', background: `${EMERALD}1F`,
              border: `1px solid ${EMERALD}55`, borderRadius: '100px', marginBottom: '2rem',
            }}>
              <Scale size={12} color={EMERALD} />
              <span style={{ fontSize: '0.7rem', color: EMERALD, fontWeight: 700, letterSpacing: '0.25em' }}>
                PUNTO CERO LEGAL
              </span>
            </div>
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 300,
              letterSpacing: '-0.03em', lineHeight: 1.05, color: '#FFFFFF', marginBottom: '1.5rem',
            }}>
              <span style={{ fontWeight: 800, color: GOLD }}>LIVE en producción</span>.
            </h2>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.7, fontWeight: 300, color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem' }}>
              Punto Cero Legal no es una idea, ni un producto en construcción. Es la <b style={{ fontWeight: 600, color: '#FFFFFF' }}>primera vertical comercial LIVE</b> del ecosistema Punto Cero System.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', marginBottom: '2.5rem' }}>
              Representa la validación en producción del core tecnológico compartido y la primera prueba comercial de la arquitectura reusable.
            </p>

            {/* Status indicator */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                <span>ESTADO OPERATIVO</span>
                <span style={{ color: GOLD, fontWeight: 700 }}>LIVE</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                  style={{ height: '100%', background: `linear-gradient(90deg, ${EMERALD}, ${GOLD})` }}
                />
              </div>
            </div>

            <a
              href="https://puntocerolegal.com" target="_blank" rel="noreferrer"
              data-testid="exec-explore-legal"
              className="interactive"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
                padding: '1.05rem 1.9rem',
                background: `linear-gradient(135deg, ${GOLD}, #b8942d)`,
                color: NAVY, textDecoration: 'none', borderRadius: '100px',
                fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.02em',
                boxShadow: `0 20px 60px ${GOLD}33`,
              }}
            >
              Explorar Punto Cero Legal <ExternalLink size={15} />
            </a>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div style={{
              padding: '2rem', background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', color: EMERALD, fontWeight: 700, marginBottom: '1rem' }}>
                CAPACIDADES EN PRODUCCIÓN
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '2rem' }}>
                {capabilities.map((c) => (
                  <span key={c} style={{
                    padding: '0.4rem 0.85rem', background: 'rgba(0,200,150,0.08)',
                    border: `1px solid ${EMERALD}33`, borderRadius: '100px',
                    fontSize: '0.75rem', color: EMERALD, fontWeight: 600,
                  }}>{c}</span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <PositionCol label="POSICIÓN" value="Primer producto real" />
                <PositionCol label="ROL" value="Primera vertical comercial" />
                <PositionCol label="EVIDENCIA" value="Validación del core compartido" />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .legal-grid { grid-template-columns: 1fr !important; gap: 3rem !important; }
        }
      `}</style>
    </section>
  );
};

const PositionCol = ({ label, value }) => (
  <div>
    <div style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '0.35rem' }}>{label}</div>
    <div style={{ fontSize: '0.82rem', color: '#FFFFFF', fontWeight: 500, lineHeight: 1.4 }}>{value}</div>
  </div>
);

// ============================================================================
// SECTION 8 — ECOSYSTEM
// ============================================================================
const VERTICALS = [
  { icon: Scale, name: 'Legal', status: 'available' },
  { icon: Stethoscope, name: 'Medical', status: 'future' },
  { icon: HeartPulse, name: 'Dental', status: 'future' },
  { icon: ShoppingBag, name: 'Commerce', status: 'future' },
  { icon: Calculator, name: 'Accounting', status: 'future' },
  { icon: Briefcase, name: 'Business', status: 'future' },
  { icon: Home, name: 'Real Estate', status: 'future' },
  { icon: Shield, name: 'Insurance', status: 'future' },
  { icon: Plane, name: 'Travel', status: 'future' },
  { icon: GraduationCap, name: 'Education', status: 'future' },
  { icon: UserCog, name: 'HR', status: 'future' },
  { icon: Utensils, name: 'Hospitality', status: 'future' },
  { icon: Truck, name: 'Logistics', status: 'future' },
  { icon: Hammer, name: 'Construction', status: 'future' },
  { icon: Sprout, name: 'Agro', status: 'future' },
];

const STATUS_MAP = {
  available: { label: 'LIVE', color: EMERALD, ring: `${EMERALD}55`, bg: `${EMERALD}18` },
  developing: { label: 'En preparación', color: GOLD, ring: `${GOLD}55`, bg: `${GOLD}18` },
  future: { label: 'Visión futura', color: 'rgba(11,31,58,0.4)', ring: 'rgba(11,31,58,0.15)', bg: 'rgba(11,31,58,0.03)' },
};

const Ecosystem = () => {
  return (
    <section id="ecosystem" className="exec-section" style={{ background: '#F7F5F0' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow">07 · EL ECOSISTEMA</div>
          <h2 className="exec-title">
            Un ecosistema <span className="exec-title-bold">vivo</span>, no un catálogo.
          </h2>
          <p className="exec-lead" style={{ marginBottom: '3rem' }}>
            El ecosistema de largo plazo puede eventualmente incluir múltiples verticales especializadas.
            Punto Cero Legal está LIVE en producción como primer vertical comercial. El resto representa la visión de expansión.
          </p>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_MAP).map(([k, m]) => (
              <div key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: m.color, opacity: k === 'future' ? 0.5 : 1 }} />
                <span style={{ fontSize: '0.75rem', color: NAVY, opacity: 0.7, fontWeight: 600 }}>{m.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Orbital ecosystem */}
        <div style={{ position: 'relative', minHeight: '620px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="ecosystem-orbit">
          {/* Orbit rings */}
          <div style={{ position: 'absolute', width: '520px', height: '520px', borderRadius: '50%', border: `1px dashed rgba(11,31,58,0.12)` }} />
          <div style={{ position: 'absolute', width: '360px', height: '360px', borderRadius: '50%', border: `1px dashed rgba(11,31,58,0.12)` }} />
          <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', border: `1px dashed rgba(212,175,55,0.25)` }} />

          {/* Central core */}
          <div style={{
            position: 'absolute', width: '150px', height: '150px', borderRadius: '50%',
            background: NAVY, color: '#FFFFFF', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', boxShadow: `0 30px 80px ${NAVY}55`,
            zIndex: 2,
          }}>
            <span style={{ fontSize: '0.6rem', color: GOLD, letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.35rem' }}>SHARED</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em' }}>CORE</span>
          </div>

          {/* Verticals distributed on orbit */}
          {VERTICALS.map((v, i) => {
            const angle = (360 / VERTICALS.length) * i - 90;
            const rad = (angle * Math.PI) / 180;
            const r = i % 2 === 0 ? 260 : 180;
            const x = r * Math.cos(rad);
            const y = r * Math.sin(rad);
            const meta = STATUS_MAP[v.status];
            return (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.03 * i }}
                style={{
                  position: 'absolute',
                  transform: `translate(${x}px, ${y}px)`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                }}
                data-testid={`vertical-${v.name.toLowerCase().replace(' ', '-')}`}
              >
                <div style={{
                  width: '58px', height: '58px', borderRadius: '50%',
                  background: '#FFFFFF', border: `2px solid ${meta.ring}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 10px 24px rgba(11,31,58,0.08)`,
                  opacity: v.status === 'future' ? 0.55 : 1,
                }}>
                  <v.icon size={20} color={meta.color} />
                </div>
                <span style={{ fontSize: '0.7rem', color: NAVY, fontWeight: 700, opacity: v.status === 'future' ? 0.55 : 1, textAlign: 'center' }}>
                  {v.name}
                </span>
                <span style={{ fontSize: '0.55rem', color: meta.color, letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>
                  {meta.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ecosystem-orbit {
            min-height: unset !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 1.5rem !important;
          }
          .ecosystem-orbit > div:first-child,
          .ecosystem-orbit > div:nth-child(2),
          .ecosystem-orbit > div:nth-child(3) { display: none !important; }
          .ecosystem-orbit > div:nth-child(4) {
            position: static !important;
            transform: none !important;
            grid-column: 1 / -1;
            margin: 0 auto 1rem;
          }
          .ecosystem-orbit > div { position: static !important; transform: none !important; }
        }
      `}</style>
    </section>
  );
};

// ============================================================================
// SECTION 9 — COMMUNITY
// ============================================================================
const Community = () => {
  const items = ['Webinars', 'Formación', 'Eventos', 'Networking', 'Colaboración profesional', 'Emprendimiento', 'Educación tecnológica'];
  return (
    <section id="community" className="exec-section" style={{ background: '#FFFFFF' }}>
      <div className="exec-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }} data-community>
        <FadeIn>
          <div className="exec-eyebrow">08 · COMUNIDAD Y ECOSISTEMA HUMANO</div>
          <h2 className="exec-title">
            Tecnología, <span className="exec-title-bold">personas</span>, conocimiento, oportunidades.
          </h2>
          <p className="exec-lead" style={{ marginBottom: '1.5rem' }}>
            Punto Cero System no es solo software. El ecosistema de largo plazo está pensado para conectar
            profesionales, emprendedores, empresas, desarrolladores, instituciones, aliados estratégicos y comunidades.
          </p>
          <p style={{ fontSize: '0.9rem', color: NAVY, opacity: 0.6, marginBottom: '2rem' }}>
            La visión incluye una futura Punto Cero Community con iniciativas potenciales:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '2rem' }}>
            {items.map((i) => (
              <span key={i} style={{
                padding: '0.4rem 0.9rem', background: '#F7F5F0',
                border: '1px solid rgba(11,31,58,0.08)', borderRadius: '100px',
                fontSize: '0.75rem', color: NAVY, fontWeight: 600,
              }}>{i}</span>
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: NAVY, opacity: 0.55, fontStyle: 'italic' }}>
            Estas iniciativas forman parte de la visión — no se presentan como productos operativos.
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <HumanCard eyebrow="PROFESIONALES" text="Abogados · Médicos · Contadores" gold />
            <HumanCard eyebrow="EMPRENDEDORES" text="Ideas en construcción" />
            <HumanCard eyebrow="EMPRESAS" text="Operación integrada" />
            <HumanCard eyebrow="COMUNIDADES" text="Redes de conocimiento" gold />
          </div>
        </FadeIn>
      </div>

      <style>{`
        @media (max-width: 900px) {
          [data-community] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const HumanCard = ({ eyebrow, text, gold }) => (
  <div style={{
    padding: '1.75rem', background: gold ? `${GOLD}0F` : '#F7F5F0',
    border: `1px solid ${gold ? GOLD + '33' : 'rgba(11,31,58,0.08)'}`,
    borderRadius: '20px', minHeight: '160px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  }}>
    <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 700, color: gold ? '#8a6d1e' : EMERALD }}>{eyebrow}</div>
    <div style={{ fontSize: '0.95rem', color: NAVY, fontWeight: 500, lineHeight: 1.4 }}>{text}</div>
  </div>
);

// ============================================================================
// SECTION 9 — THE FOUNDING TEAM · Las personas detrás de la visión
// ============================================================================
const FOUNDERS_EXEC = [
  {
    key: 'darwin',
    photo: 'https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/it8kuli6_ChatGPT_Image_3_mar_2026__10_24_41-removebg-preview.png',
    title: 'Abogado.',
    name: 'Darwin José Gómez Gómez',
    role: 'FOUNDER · CHAIRMAN · CTO',
    roleEs: 'Presidente Fundador y Director de Tecnología',
    tagline: 'VISIÓN · GOBERNANZA · TECNOLOGÍA',
    responsibilities: [
      'Visión fundacional', 'Gobernanza estratégica', 'Dirección tecnológica',
      'Arquitectura de plataforma', 'Desarrollo del core', 'Liderazgo técnico', 'Innovación e infraestructura',
    ],
    accent: EMERALD,
  },
  {
    key: 'jonathan',
    photo: 'https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/tyanc7gv_ChatGPT%20Image%2024%20jul%202026%2C%2009_32_02%20a.m..png',
    title: 'Economista.',
    name: 'Jonathan Alejandro Cetina Guerrero',
    role: 'CO-FOUNDER · CEO',
    roleEs: 'Director Ejecutivo Global',
    tagline: 'RELACIONES ECONÓMICAS INTERNACIONALES · LIDERAZGO EJECUTIVO · EXPANSIÓN GLOBAL',
    responsibilities: [
      'Liderazgo ejecutivo global', 'Estrategia de negocio', 'Perspectiva económica internacional',
      'Desarrollo del ecosistema', 'Estrategia comercial', 'Relaciones estratégicas',
      'Expansión internacional', 'Relaciones con inversionistas',
    ],
    accent: GOLD,
  },
];

const ExecFounderPortrait = ({ founder, delay = 0 }) => (
  <FadeIn delay={delay}>
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '280px',
      aspectRatio: '1 / 1',
      margin: '0 auto',
    }} data-testid={`exec-founder-portrait-${founder.key}`}>
      {/* Rotating dashed ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: '-12px', borderRadius: '50%',
          border: `1px dashed ${founder.accent}55`, pointerEvents: 'none',
        }}
      />
      {/* Solid thin ring */}
      <div style={{
        position: 'absolute', inset: '-4px', borderRadius: '50%',
        border: `1px solid ${founder.accent}44`, pointerEvents: 'none',
      }} />
      {/* Orbiting node */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: '-12px', borderRadius: '50%', pointerEvents: 'none' }}
      >
        <div style={{
          position: 'absolute', top: '-5px', left: '50%',
          transform: 'translateX(-50%)', width: '9px', height: '9px',
          borderRadius: '50%', background: founder.accent,
          boxShadow: `0 0 14px ${founder.accent}dd`,
        }} />
      </motion.div>
      {/* Glow */}
      <div style={{
        position: 'absolute', inset: '-30px', borderRadius: '50%',
        background: `radial-gradient(circle, ${founder.accent}25 0%, transparent 65%)`,
        filter: 'blur(18px)', pointerEvents: 'none',
      }} />
      {/* Portrait */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
        background: `linear-gradient(160deg, ${NAVY} 0%, #071527 100%)`,
        boxShadow: `0 20px 60px rgba(11,31,58,0.4), 0 0 0 1px ${founder.accent}44`,
      }}>
        <img src={founder.photo} alt={founder.name} loading="lazy" style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, transparent 60%, rgba(11,31,58,0.55) 100%)`,
        }} />
      </div>
      {/* Role chip */}
      <div style={{
        position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)',
        padding: '0.4rem 0.95rem', background: '#FFFFFF',
        border: `1px solid ${founder.accent}55`, borderRadius: '100px',
        boxShadow: '0 8px 22px rgba(11,31,58,0.15)',
        fontSize: '0.6rem', fontWeight: 700, color: NAVY, letterSpacing: '0.18em',
        whiteSpace: 'nowrap',
      }}>{founder.role}</div>
    </div>
  </FadeIn>
);

const FoundingTeam = () => (
  <section id="founders" className="exec-section" style={{ background: '#F7F5F0', position: 'relative' }}>
    {/* Decorative background orbits */}
    <div style={{
      position: 'absolute', top: '15%', right: '-180px',
      width: '440px', height: '440px', borderRadius: '50%',
      border: `1px solid ${EMERALD}18`, pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute', bottom: '10%', left: '-220px',
      width: '520px', height: '520px', borderRadius: '50%',
      border: `1px solid ${GOLD}18`, pointerEvents: 'none',
    }} />

    <div className="exec-container" style={{ position: 'relative' }}>
      <FadeIn>
        <div className="exec-eyebrow">09 · EL EQUIPO FUNDADOR</div>
        <h2 className="exec-title">
          The team behind the <span className="exec-title-bold">vision</span>.
        </h2>
        <p className="exec-lead" style={{ marginBottom: '4rem' }}>
          Punto Cero System está siendo construido por un equipo fundador enfocado que ha invertido tiempo, recursos y dedicación personal significativos para crear la base tecnológica y el primer vertical comercial LIVE del ecosistema.
        </p>
      </FadeIn>

      {/* Composition · Portrait · Origin · Portrait */}
      <div className="exec-founders-composition" style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        gap: '2.5rem', alignItems: 'center', marginBottom: '5rem',
        position: 'relative',
      }}>
        <ExecFounderPortrait founder={FOUNDERS_EXEC[0]} delay={0.1} />

        <div style={{ position: 'relative' }}>
          {/* Connectors */}
          <div className="exec-founders-connector" style={{
            position: 'absolute', top: '50%', right: '100%', width: '110px', height: '2px',
            background: `linear-gradient(90deg, transparent, ${EMERALD}, ${EMERALD})`,
            transform: 'translateY(-50%)', pointerEvents: 'none',
          }} />
          <div className="exec-founders-connector" style={{
            position: 'absolute', top: '50%', left: '100%', width: '110px', height: '2px',
            background: `linear-gradient(-90deg, transparent, ${GOLD}, ${GOLD})`,
            transform: 'translateY(-50%)', pointerEvents: 'none',
          }} />

          <FadeIn delay={0.3}>
            <div style={{
              position: 'relative', width: '150px', height: '150px', margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', width: '100%', height: '100%',
                    borderRadius: '50%', border: `1px solid ${EMERALD}55`,
                  }}
                />
              ))}
              <div style={{
                width: '92px', height: '92px', borderRadius: '50%',
                background: `radial-gradient(circle at 30% 30%, ${EMERALD}, ${NAVY})`,
                boxShadow: `0 0 32px ${EMERALD}55, inset 0 0 16px rgba(0,0,0,0.3)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', color: '#FFFFFF',
              }}>
                <div style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: GOLD,
                }}>0</div>
                <div style={{
                  fontSize: '0.5rem', letterSpacing: '0.28em',
                  fontWeight: 700, marginTop: '0.2rem', color: '#FFFFFF',
                }}>PUNTO CERO</div>
              </div>
            </div>
            <div style={{
              marginTop: '1.35rem', textAlign: 'center', fontSize: '0.6rem',
              letterSpacing: '0.28em', color: 'rgba(11,31,58,0.5)', fontWeight: 700,
            }}>THE ORIGIN POINT</div>
          </FadeIn>
        </div>

        <ExecFounderPortrait founder={FOUNDERS_EXEC[1]} delay={0.2} />
      </div>

      {/* Founder details */}
      <div className="exec-founders-details" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem',
      }}>
        {FOUNDERS_EXEC.map((f, i) => (
          <FadeIn key={f.key} delay={0.35 + i * 0.15}>
            <div style={{
              padding: '1.85rem 1.65rem 2rem',
              background: '#FFFFFF', borderRadius: '24px',
              border: `1px solid rgba(11,31,58,0.05)`,
              boxShadow: '0 16px 44px rgba(11,31,58,0.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: `linear-gradient(90deg, transparent, ${f.accent}, transparent)`,
              }} />
              <div style={{
                fontSize: '0.65rem', color: f.accent, fontWeight: 700,
                letterSpacing: '0.22em', marginBottom: '0.6rem',
              }}>{f.title}</div>
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.15,
                color: NAVY, letterSpacing: '-0.02em', marginBottom: '0.5rem',
              }}>{f.name}</h3>
              <div style={{
                fontSize: '0.78rem', color: NAVY, fontWeight: 600, marginBottom: '0.3rem',
              }}>{f.roleEs}</div>
              <div style={{
                fontSize: '0.62rem', color: 'rgba(11,31,58,0.55)', fontWeight: 700,
                letterSpacing: '0.14em', marginBottom: '1.35rem',
              }}>{f.tagline}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {f.responsibilities.map((r) => (
                  <span key={r} style={{
                    padding: '0.3rem 0.7rem', background: `${f.accent}14`,
                    border: `1px solid ${f.accent}33`, borderRadius: '100px',
                    fontSize: '0.66rem', color: NAVY, fontWeight: 600,
                  }}>{r}</span>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Institutional message */}
      <FadeIn delay={0.5}>
        <div style={{
          marginTop: '4rem', padding: '2.75rem 2.5rem',
          background: NAVY, color: '#FFFFFF', borderRadius: '28px',
          display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2.5rem',
          alignItems: 'center', position: 'relative', overflow: 'hidden',
        }} className="exec-founders-message">
          <div style={{
            position: 'absolute', top: '-100px', right: '-100px',
            width: '340px', height: '340px', borderRadius: '50%',
            border: `1px solid ${GOLD}25`, pointerEvents: 'none',
          }} />
          <div>
            <div style={{
              fontSize: '0.68rem', color: GOLD, fontWeight: 700,
              letterSpacing: '0.25em', marginBottom: '1.25rem',
            }}>MENSAJE INSTITUCIONAL</div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 300, lineHeight: 1.3,
              letterSpacing: '-0.02em', marginBottom: '1rem',
            }}>
              La <b style={{ color: GOLD, fontWeight: 700 }}>base fue construida</b> por los fundadores.
            </div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 300, lineHeight: 1.3,
              letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.85)',
            }}>
              La próxima etapa se construirá con un <b style={{ color: EMERALD, fontWeight: 700 }}>ecosistema más amplio</b> de personas, talento, aliados y capital.
            </div>
          </div>

          <div style={{
            padding: '1.35rem 1.5rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px',
          }}>
            <div style={{
              fontSize: '0.62rem', color: EMERALD, fontWeight: 700,
              letterSpacing: '0.25em', marginBottom: '0.85rem',
            }}>CAPACIDADES A INCORPORAR</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {[
                'Software developers', 'Product professionals', 'UX/UI designers',
                'Talento comercial', 'International business', 'Especialistas de industria',
                'Aliados estratégicos', 'Inversionistas',
              ].map((c) => (
                <span key={c} style={{
                  padding: '0.3rem 0.7rem', background: 'rgba(0,200,150,0.08)',
                  border: `1px solid ${EMERALD}33`, borderRadius: '100px',
                  fontSize: '0.66rem', color: '#FFFFFF', fontWeight: 600,
                }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>
    </div>

    <style>{`
      @media (max-width: 900px) {
        .exec-founders-composition { grid-template-columns: 1fr !important; gap: 2rem !important; }
        .exec-founders-connector { display: none !important; }
        .exec-founders-details { grid-template-columns: 1fr !important; }
        .exec-founders-message { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
      }
    `}</style>
  </section>
);

// ============================================================================
// SECTION 10 — CURRENT STAGE (transparency)
// ============================================================================
const CurrentStage = () => {
  return (
    <section id="stage" className="exec-section" style={{ background: NAVY, color: '#FFFFFF' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow" style={{ color: GOLD }}>10 · ETAPA ACTUAL · TRANSPARENCIA</div>
          <h2 className="exec-title" style={{ color: '#FFFFFF' }}>
            Una realidad <span className="exec-title-bold" style={{ color: GOLD }}>construida</span> con recursos limitados.
          </h2>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', marginTop: '4rem' }} className="stage-grid">
          <FadeIn>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.7, fontWeight: 300, color: 'rgba(255,255,255,0.85)', marginBottom: '2rem' }}>
              Punto Cero System es un ecosistema tecnológico con su <b style={{ fontWeight: 600, color: '#FFFFFF' }}>primer vertical LIVE en producción</b>,
              construido por un equipo fundador pequeño, con una inversión personal significativa en tiempo, dinero, trabajo y sacrificio.
            </p>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.65)', marginBottom: '2rem' }}>
              Punto Cero Legal está LIVE en producción como primera vertical comercial.
              La limitación actual no es la ausencia de producto — es la <b style={{ color: GOLD }}>capacidad de ejecución comercial</b> y los recursos disponibles para escalar.
            </p>

            <div style={{
              padding: '1.5rem', background: 'rgba(212,175,55,0.06)',
              border: `1px solid ${GOLD}33`, borderRadius: '18px',
              fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)',
            }}>
              <b style={{ color: GOLD, fontWeight: 700 }}>Compromiso institucional:</b> no inventamos clientes, ingresos, usuarios, KPIs, alianzas ni performance financiero.
              La fortaleza de la historia es el progreso alcanzado con recursos limitados.
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <RealityRow number="01" label="Una base tecnológica real ya está operando en producción" />
              <RealityRow number="02" label="El primer producto real está LIVE — Punto Cero Legal" gold />
              <RealityRow number="03" label="El próximo reto es escalar comercialmente y expandir el ecosistema" />
            </div>
          </FadeIn>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .stage-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const RealityRow = ({ number, label, gold }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '1.25rem',
    padding: '1.5rem 1.75rem',
    background: gold ? `${GOLD}0F` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${gold ? GOLD + '55' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '18px',
  }}>
    <div style={{
      width: '42px', height: '42px', borderRadius: '50%',
      background: gold ? GOLD : 'rgba(0,200,150,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: gold ? NAVY : EMERALD, fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.05em',
      flexShrink: 0,
    }}>{number}</div>
    <div style={{ fontSize: '1rem', fontWeight: 500, color: '#FFFFFF' }}>{label}</div>
  </div>
);

// ============================================================================
// SECTION 11 — NEXT STAGE
// ============================================================================
const NextStage = () => {
  const flow = [
    'Fundamento tecnológico', 'Product completion', 'Preparación de mercado',
    'Validación comercial', 'Expansión del ecosistema',
  ];
  const enable = [
    'Finalización de Punto Cero Legal',
    'Desarrollo técnico', 'Refinamiento del producto',
    'Infraestructura', 'Seguridad', 'Preparación de mercado',
    'Validación comercial', 'Expansión del equipo', 'Desarrollo de nuevas verticales',
  ];
  return (
    <section id="next" className="exec-section" style={{ background: '#F7F5F0' }}>
      <div className="exec-container">
        <FadeIn>
          <div className="exec-eyebrow">11 · PRÓXIMA ETAPA</div>
          <h2 className="exec-title">
            De fundamento tecnológico a <span className="exec-title-bold">plataforma escalable</span>.
          </h2>
          <p className="exec-lead" style={{ marginBottom: '3rem' }}>
            El objetivo es aumentar la capacidad de ejecución y transformar una base tecnológica existente
            en un producto listo para mercado y una plataforma escalable de largo plazo.
          </p>
        </FadeIn>

        {/* Horizontal flow */}
        <FadeIn>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.5rem', flexWrap: 'wrap', marginBottom: '4rem',
          }}>
            {flow.map((f, i) => (
              <React.Fragment key={f}>
                <div style={{
                  flex: 1, minWidth: '160px',
                  padding: '1.1rem 1rem', background: '#FFFFFF',
                  border: `1px solid ${i === flow.length - 1 ? EMERALD + '55' : 'rgba(11,31,58,0.08)'}`,
                  borderRadius: '18px', textAlign: 'center',
                  boxShadow: '0 6px 20px rgba(11,31,58,0.04)',
                }}>
                  <div style={{ fontSize: '0.65rem', color: EMERALD, letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.4rem' }}>
                    ETAPA {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{f}</div>
                </div>
                {i < flow.length - 1 && <ArrowRight size={16} color={GOLD} style={{ flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>
        </FadeIn>

        <FadeIn>
          <div style={{
            padding: '2.5rem', background: '#FFFFFF',
            border: '1px solid rgba(11,31,58,0.08)', borderRadius: '24px',
          }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', color: EMERALD, fontWeight: 700, marginBottom: '1.25rem' }}>
              CAPITAL Y SOPORTE ESTRATÉGICO PODRÍAN HABILITAR
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }} className="enable-grid">
              {enable.map((e) => (
                <div key={e} style={{
                  padding: '0.85rem 1rem',
                  background: '#F7F5F0', borderRadius: '12px',
                  fontSize: '0.85rem', color: NAVY, fontWeight: 500,
                  borderLeft: `2px solid ${EMERALD}`,
                }}>{e}</div>
              ))}
            </div>

            <div style={{
              marginTop: '2rem', paddingTop: '1.5rem',
              borderTop: '1px solid rgba(11,31,58,0.08)',
              fontSize: '0.8rem', color: NAVY, opacity: 0.6, fontStyle: 'italic',
            }}>
              No se prometen retornos, ganancias garantizadas ni resultados financieros específicos.
              El propósito es conversaciones estratégicas serias.
            </div>
          </div>
        </FadeIn>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .enable-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

// ============================================================================
// SECTION 12 — LONG-TERM VISION
// ============================================================================
const LongTermVision = () => {
  const chain = [
    'Punto Cero System', 'Shared Technology Core', 'Punto Cero Legal',
    'Validación de mercado', 'Nuevas verticales', 'Oportunidad 18 países',
    'Profesionales · Empresas · Emprendedores', 'Comunidad',
    'Ecosistema tecnológico latinoamericano',
  ];
  return (
    <section id="future" className="exec-section" style={{
      background: `linear-gradient(180deg, #071527 0%, ${NAVY} 100%)`, color: '#FFFFFF',
    }}>
      <div className="exec-container" style={{ textAlign: 'center' }}>
        <FadeIn>
          <div className="exec-eyebrow" style={{ color: GOLD }}>12 · VISIÓN LARGO PLAZO</div>
          <h2 className="exec-title" style={{ color: '#FFFFFF', maxWidth: '900px', margin: '0 auto 1.5rem' }}>
            No estamos construyendo aplicaciones aisladas. Estamos construyendo una <span className="exec-title-bold" style={{ color: GOLD }}>infraestructura</span>.
          </h2>
          <p className="exec-lead" style={{ color: 'rgba(255,255,255,0.7)', margin: '0 auto 4rem', maxWidth: '760px' }}>
            La evolución del ecosistema se construirá progresivamente. Punto Cero Legal es donde el viaje comienza.
          </p>
        </FadeIn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '740px', margin: '0 auto' }}>
          {chain.map((c, i) => (
            <FadeIn key={c} delay={i * 0.08}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  padding: '1.1rem 1.5rem',
                  background: i === chain.length - 1
                    ? `linear-gradient(135deg, ${EMERALD}22, ${GOLD}22)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === chain.length - 1 ? EMERALD + '55' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '14px',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                  <span style={{ fontSize: '0.7rem', color: GOLD, fontWeight: 700, letterSpacing: '0.15em', minWidth: '30px' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#FFFFFF', textAlign: 'left', flex: 1 }}>
                    {c}
                  </span>
                  <Circle size={8} fill={i === chain.length - 1 ? EMERALD : 'rgba(255,255,255,0.15)'} stroke="none" />
                </div>
                {i < chain.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '0.2rem 0' }}>
                    <ChevronDown size={12} color="rgba(212,175,55,0.5)" />
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// SECTION 13 — FINAL CTA (form)
// ============================================================================
const CONTACT_TYPES = [
  { key: 'investor', label: 'Inversionista' },
  { key: 'strategic_partner', label: 'Aliado estratégico' },
  { key: 'technology_partner', label: 'Aliado tecnológico' },
  { key: 'professional', label: 'Profesional' },
  { key: 'entrepreneur', label: 'Emprendedor' },
  { key: 'company', label: 'Empresa' },
  { key: 'other', label: 'Otro' },
];

const FinalCTA = () => {
  const [form, setForm] = useState({
    fullName: '', email: '', company: '', country: '', contactType: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        contactType: form.contactType || undefined,
        source: 'executive_summary',
      };
      const res = await fetch(`${API}/api/investor-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(' ')
          : (detail || 'No se pudo enviar la solicitud.');
        throw new Error(msg);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section id="cta" className="exec-section" style={{ background: '#F7F5F0' }}>
      <div className="exec-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '5rem', alignItems: 'flex-start' }} className="cta-grid">
          <FadeIn>
            <div className="exec-eyebrow">13 · CONVERSACIÓN ESTRATÉGICA</div>
            <h2 className="exec-title">
              Comienza una <span className="exec-title-bold">conversación estratégica</span>.
            </h2>
            <p className="exec-lead" style={{ marginBottom: '2.5rem' }}>
              No estamos pidiendo invertir en una idea vacía. Buscamos soporte estratégico para acelerar una base tecnológica existente
              hacia la finalización del producto, la validación de mercado y la expansión de largo plazo del ecosistema.
            </p>

            <div style={{
              padding: '1.5rem', background: '#FFFFFF',
              border: '1px solid rgba(11,31,58,0.08)', borderRadius: '18px',
              marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: '0.65rem', color: EMERALD, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.75rem' }}>
                MENSAJE FINAL
              </div>
              <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.15rem', lineHeight: 1.5, color: NAVY, fontWeight: 500 }}>
                No estamos construyendo una sola aplicación.<br />
                <span style={{ fontWeight: 700 }}>Estamos construyendo la infraestructura tecnológica para un ecosistema latinoamericano conectado.</span><br /><br />
                <span style={{ color: GOLD, fontWeight: 700 }}>Punto Cero Legal es donde el viaje comienza.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to="/investor-pitch-deck" data-testid="cta-open-pitch" className="interactive" style={pillLinkStyle}>
                Investor Pitch Deck <ArrowRight size={14} />
              </Link>
              <Link to="/capital-strategy" data-testid="cta-open-capital" className="interactive" style={pillLinkStyle}>
                Capital Strategy <ArrowRight size={14} />
              </Link>
              <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" data-testid="cta-open-legal" className="interactive" style={pillLinkStyle}>
                Punto Cero Legal <ExternalLink size={13} />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            {submitted ? (
              <SubmittedCard />
            ) : (
              <form onSubmit={submit} data-testid="exec-cta-form" style={{
                padding: '2.5rem', background: '#FFFFFF',
                border: '1px solid rgba(11,31,58,0.08)', borderRadius: '24px',
                boxShadow: '0 30px 80px rgba(11,31,58,0.06)',
              }}>
                <div style={{ fontSize: '0.65rem', color: EMERALD, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '1.5rem' }}>
                  SOLICITA UNA CONVERSACIÓN ESTRATÉGICA
                </div>

                <ExecField label="Nombre completo" required value={form.fullName} onChange={set('fullName')} testid="cta-fullName" />
                <ExecField label="Email" type="email" required value={form.email} onChange={set('email')} testid="cta-email" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <ExecField label="Empresa u organización" value={form.company} onChange={set('company')} testid="cta-company" />
                  <ExecField label="País" value={form.country} onChange={set('country')} testid="cta-country" />
                </div>

                <div style={{ marginBottom: '1.15rem' }}>
                  <label style={fieldLabelStyle}>TIPO DE CONTACTO</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {CONTACT_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm({ ...form, contactType: t.key })}
                        data-testid={`contact-type-${t.key}`}
                        className="interactive"
                        style={{
                          padding: '0.45rem 0.9rem',
                          background: form.contactType === t.key ? `${EMERALD}18` : '#F7F5F0',
                          border: `1px solid ${form.contactType === t.key ? EMERALD + '77' : 'rgba(11,31,58,0.08)'}`,
                          borderRadius: '100px',
                          color: form.contactType === t.key ? '#0a6b52' : NAVY,
                          fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >{t.label}</button>
                    ))}
                  </div>
                </div>

                <ExecField label="Mensaje" textarea rows={4} value={form.message} onChange={set('message')} testid="cta-message" />

                {error && (
                  <div data-testid="cta-error" style={{
                    padding: '0.75rem 1rem', background: 'rgba(255,90,90,0.08)',
                    border: '1px solid rgba(255,90,90,0.3)', borderRadius: '10px',
                    color: '#c04a4a', fontSize: '0.85rem', marginBottom: '1rem',
                  }}>{error}</div>
                )}

                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={submitting ? {} : { scale: 1.02 }}
                  whileTap={submitting ? {} : { scale: 0.98 }}
                  data-testid="cta-submit"
                  className="interactive"
                  style={{
                    width: '100%', padding: '1.1rem 1.75rem',
                    background: submitting ? '#C4A93C88' : `linear-gradient(135deg, ${GOLD}, #b8942d)`,
                    color: NAVY, border: 'none', borderRadius: '100px',
                    fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em',
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {submitting ? 'Enviando…' : (<>Iniciar conversación estratégica <ArrowRight size={15} /></>)}
                </motion.button>

                <div style={{ marginTop: '1.15rem', fontSize: '0.72rem', color: NAVY, opacity: 0.5, textAlign: 'center' }}>
                  No prometemos retornos. No garantizamos beneficios. Solo generamos conversaciones estratégicas serias.
                </div>
              </form>
            )}
          </FadeIn>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cta-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
};

const pillLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.65rem 1.1rem', background: 'transparent',
  border: '1px solid rgba(11,31,58,0.15)', borderRadius: '100px',
  color: NAVY, textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600,
};

const fieldLabelStyle = {
  display: 'block', fontSize: '0.65rem',
  color: 'rgba(11,31,58,0.55)', letterSpacing: '0.2em',
  fontWeight: 700, marginBottom: '0.5rem',
};

const ExecField = ({ label, type = 'text', textarea, rows, value, onChange, required, testid }) => (
  <div style={{ marginBottom: '1.15rem' }}>
    <label style={fieldLabelStyle}>{label.toUpperCase()}{required && <span style={{ color: GOLD }}> *</span>}</label>
    {textarea ? (
      <textarea
        data-testid={testid} value={value} onChange={onChange} rows={rows}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    ) : (
      <input
        data-testid={testid} type={type} value={value} onChange={onChange} required={required}
        style={inputStyle}
      />
    )}
  </div>
);
const inputStyle = {
  width: '100%', padding: '0.85rem 1rem',
  background: '#F7F5F0', border: '1px solid rgba(11,31,58,0.1)',
  borderRadius: '12px', color: NAVY, fontSize: '0.9rem',
  fontFamily: 'inherit', outline: 'none',
};

const SubmittedCard = () => (
  <div data-testid="cta-submitted" style={{
    padding: '3rem 2.5rem', background: '#FFFFFF',
    border: `1px solid ${EMERALD}55`, borderRadius: '24px',
    textAlign: 'center', boxShadow: '0 30px 80px rgba(0,200,150,0.15)',
  }}>
    <div style={{
      width: '68px', height: '68px', borderRadius: '50%',
      background: `${EMERALD}18`, border: `2px solid ${EMERALD}66`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '1.5rem',
    }}>
      <Sparkles size={26} color={EMERALD} />
    </div>
    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.5rem', fontWeight: 300, color: NAVY, marginBottom: '0.75rem' }}>
      Solicitud recibida.
    </h3>
    <p style={{ fontSize: '0.95rem', color: NAVY, opacity: 0.7, lineHeight: 1.6, marginBottom: '1.5rem' }}>
      Hemos recibido tu solicitud. El equipo de Punto Cero System revisará el mensaje y te contactará en los próximos días.
    </p>
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      <Link to="/" style={pillLinkStyle}>Volver al home</Link>
      <Link to="/investor-pitch-deck" style={pillLinkStyle}>Ver Pitch Deck</Link>
    </div>
  </div>
);

// ============================================================================
// FOOTER
// ============================================================================
const ExecFooter = () => (
  <footer style={{ background: '#071527', color: 'rgba(255,255,255,0.6)', padding: '3rem 2rem', textAlign: 'center' }}>
    <div style={{ maxWidth: '900px', margin: '0 auto', fontSize: '0.8rem' }}>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#FFFFFF', fontWeight: 700, letterSpacing: '0.05em' }}>
        PUNTO CERO <span style={{ color: EMERALD }}>SYSTEM</span>
      </div>
      <div style={{ marginBottom: '2rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>
        Where everything begins · Executive Summary
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
        <Link to="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Punto Cero System</Link>
        <Link to="/investor-pitch-deck" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Investor Pitch Deck</Link>
        <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Punto Cero Legal</a>
      </div>
    </div>
  </footer>
);

// ============================================================================
// SHARED animation utility
// ============================================================================
const FadeIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-15%' }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export default ExecutiveSummaryPage;
