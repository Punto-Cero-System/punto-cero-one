import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Target, Flag, Users, Sparkles, Rocket, Heart, Shield, Zap } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FoundersSection from '../components/FoundersSection';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

/**
 * NuestraHistoriaPage — full institutional page for the ecosystem story.
 * Reuses FoundersSection (Darwin + Jonathan) but wraps it with Historia,
 * Visión, Misión, Cronología, Valores and Roadmap so it feels like the
 * canonical "About us" of Punto Cero One.
 */
const NuestraHistoriaPage = () => {
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true, amount: 0.25 });

  return (
    <>
      <Header />
      <main data-testid="nuestra-historia-page" style={{ paddingTop: '58px', background: '#FFFFFF', color: NAVY, minHeight: '100vh' }}>
        {/* Hero */}
        <section ref={heroRef} style={{
          position: 'relative',
          padding: '6rem 2rem 5rem',
          background: `linear-gradient(160deg, ${NAVY} 0%, #071527 55%, ${NAVY} 100%)`,
          color: '#FFFFFF', overflow: 'hidden',
        }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }}
            style={{
              position: 'absolute', top: '-200px', right: '-200px', width: 640, height: 640,
              borderRadius: '50%', border: `1px solid ${EMERALD}25`, pointerEvents: 'none',
            }} />
          <motion.div
            animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', top: '20%', right: '5%', width: 220, height: 220,
              borderRadius: '50%', border: `1px dashed ${GOLD}44`, pointerEvents: 'none',
            }} />

          <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
            <Link to="/" data-testid="back-to-home" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.8rem',
              marginBottom: '2rem', letterSpacing: '0.08em', fontWeight: 500,
            }}>
              <ArrowLeft size={14} /> Volver al ecosistema
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.4rem 1rem', borderRadius: 100,
                background: `${EMERALD}18`, border: `1px solid ${EMERALD}55`,
                marginBottom: '1.5rem', color: EMERALD,
                fontSize: '0.68rem', letterSpacing: '0.28em', fontWeight: 700,
              }}>
                <Sparkles size={12} /> NUESTRA HISTORIA
              </div>
              <h1 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 'clamp(2.5rem, 6vw, 4.6rem)', fontWeight: 300,
                lineHeight: 1.02, letterSpacing: '-0.035em', margin: 0, marginBottom: '1.75rem',
                maxWidth: 980,
              }}>
                De un <span style={{ fontWeight: 700, color: GOLD }}>punto</span> a un{' '}
                <span style={{ fontWeight: 700,
                  background: `linear-gradient(90deg, ${EMERALD}, #3B82F6, #8B5CF6)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>ecosistema</span>.
              </h1>
              <p style={{
                fontSize: 'clamp(1.05rem, 1.6vw, 1.25rem)', lineHeight: 1.65,
                color: 'rgba(255,255,255,0.72)', fontWeight: 300, maxWidth: 720, margin: 0,
              }}>
                Punto Cero One es la infraestructura tecnológica que reúne a profesionales,
                emprendedores, empresas y verticales bajo un solo ecosistema latinoamericano.
                Esta es la historia de cómo empezó, hacia dónde va y las personas que lo construyen.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Historia · Visión · Misión */}
        <section style={{ padding: '6rem 2rem', background: '#F7F8FC' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <PillarCard icon={Compass} accent={EMERALD} eyebrow="HISTORIA" title="Cómo nació Punto Cero"
              body="Antes de un equipo grande o capital significativo, hubo la decisión de empezar. Con recursos propios, los fundadores construyeron la base tecnológica que hoy sostiene el ecosistema. Punto Cero Legal fue el primer vertical LIVE — la prueba de que la visión no era teoría."
              testid="pillar-historia"
            />
            <PillarCard icon={Target} accent="#3B82F6" eyebrow="VISIÓN" title="La visión para Latinoamérica"
              body="Imaginamos una Latinoamérica donde profesionales y empresas ya no dependan de plataformas construidas para otras regiones. Un ecosistema propio, con IA aplicada, capital regional y verticales especializadas — construido desde y para nuestro contexto."
              testid="pillar-vision"
            />
            <PillarCard icon={Flag} accent={GOLD} eyebrow="MISIÓN" title="El propósito del ecosistema"
              body="Democratizar el acceso a tecnología, oportunidades y conocimiento profesional en toda LatAm. Cada vertical (Legal, Salud, Contabilidad, Viajes, IA…) comparte un core técnico único: menos costo, más velocidad, más colaboración."
              testid="pillar-mision"
            />
          </div>
        </section>

        {/* Fundadores (reused component) */}
        <FoundersSection />

        {/* Cronología */}
        <section style={{ padding: '6rem 2rem', background: '#FFFFFF' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <SectionHeader eyebrow="CRONOLOGÍA" title="Los hitos del ecosistema"
              subtitle="No lanzamos todo simultáneamente — cada etapa consolida la siguiente." />
            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
              <div style={{
                position: 'absolute', left: '0.5rem', top: 0, bottom: 0, width: 2,
                background: `linear-gradient(180deg, ${EMERALD}, ${GOLD}, transparent)`,
              }} />
              {TIMELINE.map((t, i) => (
                <TimelineItem key={t.year} item={t} idx={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Valores */}
        <section style={{ padding: '6rem 2rem', background: NAVY, color: '#FFFFFF' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            <SectionHeader dark eyebrow="VALORES" title="Cómo construimos"
              subtitle="No son consignas de marketing — son las reglas de operación diaria del equipo." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {VALORES.map((v) => (
                <ValueCard key={v.label} {...v} />
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section style={{ padding: '6rem 2rem', background: '#F7F8FC' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            <SectionHeader eyebrow="ROADMAP" title="Hacia dónde vamos"
              subtitle="La ruta pública del ecosistema — decisiones y fases visibles." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {ROADMAP.map((r) => (
                <RoadmapCard key={r.phase} {...r} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

/* ============================================================================
   Data
   ========================================================================== */
const TIMELINE = [
  { year: '2023', title: 'El punto cero', body: 'Nace la idea: un ecosistema tecnológico latinoamericano propio, no una app aislada.' },
  { year: '2024', title: 'Base tecnológica', body: 'Se construye el core técnico — auth, identidad, storage, feed, notificaciones — con arquitectura multi-tenant desde el día uno.' },
  { year: '2025', title: 'Punto Cero Legal · LIVE', body: 'El primer vertical entra en producción. Demuestra que la arquitectura funciona con carga real.' },
  { year: '2026', title: 'Ecosystem Live', body: 'Wave 3: real-time, integraciones externas, media, emails y "Para Ti". Empieza la expansión regional visible.' },
  { year: '2027', title: 'Nuevas verticales', body: 'Salud, Contabilidad, Viajes y más — todas encima del mismo core, con recomendaciones cruzadas.' },
];
const VALORES = [
  { icon: Zap,      label: 'Ejecución', body: 'Preferimos publicar hoy y evolucionar mañana antes que planificar por seis meses.' },
  { icon: Shield,   label: 'Confianza', body: 'Datos privados, autenticación seria, integraciones auditables. Sin atajos.' },
  { icon: Heart,    label: 'Latam-first', body: 'Cada decisión pasa el filtro: ¿esto funciona para un profesional en Bogotá, Lima o Caracas?' },
  { icon: Users,    label: 'Comunidad', body: 'La plataforma no reemplaza el ecosistema humano — lo amplifica.' },
  { icon: Rocket,   label: 'Bootstrapping', body: 'Cada peso se invierte con criterio. Levantar capital cuando exista tracción, no antes.' },
  { icon: Sparkles, label: 'Estética', body: 'Una plataforma latinoamericana puede — y debe — verse tan bien como cualquiera del mundo.' },
];
const ROADMAP = [
  { phase: 'Q3 2026', title: 'Ecosystem Live', status: 'EN CURSO', tone: EMERALD },
  { phase: 'Q4 2026', title: 'Company Media + Marketplace v1', status: 'PRÓXIMO', tone: '#3B82F6' },
  { phase: 'Q1 2027', title: 'SSO cross-vertical + Health preview', status: 'PLANEADO', tone: GOLD },
  { phase: 'Q2 2027', title: 'Contabilidad + IA vertical', status: 'ROADMAP', tone: '#8B5CF6' },
];

/* ============================================================================
   Small building blocks
   ========================================================================== */
const PillarCard = ({ icon: Icon, accent, eyebrow, title, body, testid }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7 }}
    data-testid={testid}
    style={{
      background: '#FFFFFF', borderRadius: 22, padding: '2rem 1.75rem',
      border: `1px solid ${accent}22`, boxShadow: '0 20px 50px rgba(11,31,58,0.05)',
    }}>
    <div style={{
      width: 46, height: 46, borderRadius: 14,
      background: `${accent}18`, border: `1px solid ${accent}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: accent, marginBottom: '1.15rem',
    }}>
      <Icon size={22} strokeWidth={2} />
    </div>
    <div style={{ fontSize: '0.65rem', letterSpacing: '0.24em', fontWeight: 700, color: accent, marginBottom: '0.65rem' }}>
      {eyebrow}
    </div>
    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem',
      fontWeight: 700, color: NAVY, letterSpacing: '-0.02em', margin: 0, marginBottom: '0.85rem' }}>
      {title}
    </h3>
    <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'rgba(11,31,58,0.65)', margin: 0, fontWeight: 300 }}>
      {body}
    </p>
  </motion.div>
);

const SectionHeader = ({ eyebrow, title, subtitle, dark }) => (
  <div style={{ maxWidth: 780, marginBottom: '3.5rem' }}>
    <div style={{
      fontSize: '0.7rem', letterSpacing: '0.28em', fontWeight: 700,
      color: dark ? EMERALD : EMERALD, marginBottom: '1rem',
    }}>{eyebrow}</div>
    <h2 style={{
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: 'clamp(1.85rem, 4vw, 2.8rem)', fontWeight: 300,
      lineHeight: 1.08, letterSpacing: '-0.03em', margin: 0, marginBottom: '1rem',
      color: dark ? '#FFFFFF' : NAVY,
    }}>{title}</h2>
    <p style={{
      fontSize: '1.05rem', lineHeight: 1.65,
      color: dark ? 'rgba(255,255,255,0.65)' : 'rgba(11,31,58,0.6)',
      fontWeight: 300, margin: 0,
    }}>{subtitle}</p>
  </div>
);

const TimelineItem = ({ item, idx }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }} transition={{ duration: 0.6, delay: idx * 0.08 }}
    style={{ position: 'relative', paddingBottom: '2.5rem' }}
    data-testid={`timeline-${item.year}`}>
    <div style={{
      position: 'absolute', left: '-1.75rem', top: 4, width: 14, height: 14,
      borderRadius: '50%', background: EMERALD,
      boxShadow: `0 0 0 4px #FFFFFF, 0 0 0 5px ${EMERALD}55`,
    }} />
    <div style={{ fontSize: '0.7rem', color: GOLD, fontWeight: 700, letterSpacing: '0.22em', marginBottom: '0.35rem' }}>
      {item.year}
    </div>
    <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.15rem',
      fontWeight: 700, color: NAVY, margin: 0, marginBottom: '0.4rem' }}>{item.title}</h4>
    <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'rgba(11,31,58,0.65)', margin: 0, fontWeight: 300 }}>
      {item.body}
    </p>
  </motion.div>
);

const ValueCard = ({ icon: Icon, label, body }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }} transition={{ duration: 0.6 }}
    style={{
      padding: '1.5rem 1.35rem', borderRadius: 18,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(6px)',
    }}>
    <div style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 12,
      background: `${EMERALD}22`, border: `1px solid ${EMERALD}55`,
      alignItems: 'center', justifyContent: 'center', color: EMERALD, marginBottom: '0.85rem' }}>
      <Icon size={18} />
    </div>
    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.05rem',
      fontWeight: 700, color: '#FFFFFF', margin: 0, marginBottom: '0.5rem' }}>{label}</div>
    <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 300 }}>
      {body}
    </p>
  </motion.div>
);

const RoadmapCard = ({ phase, title, status, tone }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }} transition={{ duration: 0.6 }}
    style={{ padding: '1.5rem 1.4rem', borderRadius: 18, background: '#FFFFFF',
      border: `1px solid ${tone}30`, boxShadow: '0 12px 30px rgba(11,31,58,0.05)' }}>
    <div style={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 700, color: tone, marginBottom: '0.6rem' }}>
      {phase}
    </div>
    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: NAVY, marginBottom: '0.6rem',
      fontFamily: '"Space Grotesk", sans-serif' }}>
      {title}
    </div>
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 100,
      background: `${tone}18`, color: tone, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em',
    }}>{status}</span>
  </motion.div>
);

export default NuestraHistoriaPage;
