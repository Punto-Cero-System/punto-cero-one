import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Lock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import AppIcon from '../components/community/AppIcon';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';
const EMERALD = '#00C896';

// Cards linking to existing, already-built investor experiences.
const CAPITAL_ITEMS = [
  {
    key: 'exec',
    title: 'Executive Summary',
    desc: 'Visión, problema, oportunidad, tecnología, ecosistema y etapa actual — 13 secciones editoriales.',
    to: '/executive-summary',
    icon: 'news',
    tag: '13 SECCIONES',
    accent: EMERALD,
  },
  {
    key: 'deck',
    title: 'Investor Pitch Deck',
    desc: '12 slides cinematográficos + descarga PDF versionada + analytics por slide.',
    to: '/investor-pitch-deck',
    icon: 'video',
    tag: '12 SLIDES · PDF',
    accent: '#8B5CF6',
  },
  {
    key: 'strategy',
    title: 'Capital Strategy',
    desc: 'Simulador financiero interactivo · 3 escenarios de capital · 36 meses de proyección.',
    to: '/capital-strategy',
    icon: 'capital',
    tag: 'SIMULADOR',
    accent: GOLD,
  },
  {
    key: 'room',
    title: 'Investor Room',
    desc: 'Punto de entrada institucional al portal privado de inversionistas.',
    to: '/investor-room',
    icon: 'legal',
    tag: 'INSTITUCIONAL',
    accent: '#3B82F6',
  },
  {
    key: 'portal',
    title: 'Investor Portal',
    desc: 'Área privada con documentos, actualizaciones y accesos por invitación.',
    to: '/investor-portal',
    icon: 'jobs',
    tag: 'PRIVADO · LOGIN',
    accent: EMERALD,
    locked: true,
  },
  {
    key: 'request',
    title: 'Solicitar reunión',
    desc: 'Contacto directo con el founding team para conversación estratégica 1:1.',
    to: '/request-access',
    icon: 'events',
    tag: 'CONTACTO',
    accent: '#EC4899',
  },
];

const CapitalHubPage = () => {
  return (
    <>
      <Header />

      <main style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0A0F1C 0%, #0B1F3A 40%, #0A0F1C 100%)',
        color: '#FFFFFF',
        paddingTop: '7rem',
        paddingBottom: '6rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative cosmic ring */}
        <div style={{
          position: 'absolute', top: '-200px', right: '-260px',
          width: 720, height: 720, borderRadius: '50%',
          background: `radial-gradient(circle, ${GOLD}22 0%, transparent 65%)`,
          filter: 'blur(30px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '20%', left: '-200px',
          width: 520, height: 520, borderRadius: '50%',
          border: `1px solid ${EMERALD}22`, pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 1.5rem', position: 'relative',
        }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{ marginBottom: '3.5rem' }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.9rem', borderRadius: 100,
              background: `${GOLD}15`, border: `1px solid ${GOLD}44`,
              fontSize: '0.65rem', letterSpacing: '0.22em', fontWeight: 700,
              color: GOLD, marginBottom: '1.25rem',
            }}>
              <AppIcon name="capital" size={14} variant="color" />
              INVESTOR CENTER
            </div>
            <h1 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2.2rem, 5.2vw, 3.6rem)',
              fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}>
              💎 <span style={{ fontWeight: 700, color: GOLD }}>Capital</span> · Punto Cero One
            </h1>
            <p style={{
              fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
              lineHeight: 1.65, maxWidth: 680,
              color: 'rgba(255,255,255,0.7)', fontWeight: 300,
            }}>
              Experiencia dedicada para inversionistas y aliados estratégicos. Explora la visión completa,
              el pitch institucional, el simulador financiero y el portal privado.
            </p>
          </motion.div>

          {/* Grid of cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}>
            {CAPITAL_ITEMS.map((item, i) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <Link
                  to={item.to}
                  data-testid={`capital-card-${item.key}`}
                  className="interactive"
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      position: 'relative',
                      padding: '1.6rem 1.5rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid rgba(255,255,255,0.09)`,
                      borderRadius: 20,
                      backdropFilter: 'blur(10px)',
                      color: '#FFFFFF',
                      overflow: 'hidden',
                      minHeight: 220,
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    {/* Accent orb */}
                    <div style={{
                      position: 'absolute', top: '-40px', right: '-40px',
                      width: 140, height: 140, borderRadius: '50%',
                      background: `radial-gradient(circle, ${item.accent}33 0%, transparent 70%)`,
                      filter: 'blur(16px)', pointerEvents: 'none',
                    }} />

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: '1rem', position: 'relative',
                    }}>
                      <AppIcon name={item.icon} size={28} variant="color" />
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.25rem 0.6rem', borderRadius: 100,
                        background: `${item.accent}18`, border: `1px solid ${item.accent}44`,
                        color: item.accent, fontSize: '0.58rem',
                        letterSpacing: '0.16em', fontWeight: 700,
                      }}>
                        {item.locked && <Lock size={9} />}{item.tag}
                      </span>
                    </div>

                    <h3 style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: '1.25rem', fontWeight: 700,
                      letterSpacing: '-0.01em',
                      marginBottom: '0.55rem',
                      color: '#FFFFFF',
                      position: 'relative',
                    }}>{item.title}</h3>

                    <p style={{
                      fontSize: '0.85rem', lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.65)',
                      flex: 1, position: 'relative',
                    }}>{item.desc}</p>

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      marginTop: '1rem', color: item.accent,
                      fontSize: '0.78rem', fontWeight: 700, position: 'relative',
                    }}>
                      Explorar <ArrowUpRight size={14} />
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Footer note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            style={{
              marginTop: '4rem', textAlign: 'center',
              fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.14em',
            }}
          >
            LOS INVERSIONISTAS NO SE MEZCLAN CON LOS USUARIOS · ESTA ES UNA EXPERIENCIA APARTE
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default CapitalHubPage;
