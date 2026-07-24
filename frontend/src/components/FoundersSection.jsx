import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Compass, Cpu, Globe, Briefcase, ArrowRight } from 'lucide-react';

// ============================================================================
// FOUNDERS SECTION · THE PEOPLE BEHIND THE VISION
// Real founding team of Punto Cero System.
// Two founders + central "PUNTO CERO" node representing the human origin point.
// ============================================================================

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

// If the founder-to-photo mapping needs adjusting, swap the `photo` URLs below.
const FOUNDERS = [
  {
    key: 'darwin',
    photo: 'https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/tyanc7gv_ChatGPT%20Image%2024%20jul%202026%2C%2009_32_02%20a.m..png',
    title: 'Abogado.',
    name: 'Darwin José Gómez Gómez',
    role: 'FOUNDER · CHAIRMAN · CTO',
    roleEs: 'Presidente Fundador y Director de Tecnología',
    tagline: 'VISION · GOVERNANCE · TECHNOLOGY',
    responsibilities: [
      'Visión fundacional',
      'Gobernanza estratégica',
      'Dirección tecnológica',
      'Arquitectura de plataforma',
      'Desarrollo del core',
      'Liderazgo técnico',
      'Innovación e infraestructura',
    ],
    accent: EMERALD,
    icon: Cpu,
  },
  {
    key: 'jonathan',
    photo: 'https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/it8kuli6_ChatGPT_Image_3_mar_2026__10_24_41-removebg-preview.png',
    title: 'Economista.',
    name: 'Jonathan Alejandro Cetina Guerrero',
    role: 'CO-FOUNDER · CEO',
    roleEs: 'Director Ejecutivo Global',
    tagline: 'INTERNATIONAL ECONOMIC RELATIONS · EXECUTIVE LEADERSHIP · GLOBAL EXPANSION',
    responsibilities: [
      'Liderazgo ejecutivo global',
      'Estrategia de negocio',
      'Perspectiva económica internacional',
      'Desarrollo del ecosistema',
      'Estrategia comercial',
      'Relaciones estratégicas',
      'Expansión internacional',
      'Relaciones con inversionistas',
    ],
    accent: GOLD,
    icon: Globe,
  },
];

// ----------------------------------------------------------------------------
// Circular portrait with animated orbital rings + accent glow
// ----------------------------------------------------------------------------
const FounderPortrait = ({ founder, inView, delay = 0, side = 'left' }) => {
  const Icon = founder.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 1.1, delay, ease: [0.6, 0.05, 0.01, 0.9] }}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '360px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
      }}
      data-testid={`founder-portrait-${founder.key}`}
    >
      {/* Rotating outer orbital ring */}
      <motion.div
        animate={inView ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: '-14px',
          borderRadius: '50%',
          border: `1px dashed ${founder.accent}55`,
          pointerEvents: 'none',
        }}
      />
      {/* Counter-rotating inner ring */}
      <motion.div
        animate={inView ? { rotate: -360 } : { rotate: 0 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: '-4px',
          borderRadius: '50%',
          border: `1px solid ${founder.accent}30`,
          pointerEvents: 'none',
        }}
      />
      {/* Orbiting emerald node */}
      <motion.div
        animate={inView ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: '-14px',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          position: 'absolute',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: founder.accent,
          boxShadow: `0 0 18px ${founder.accent}dd`,
        }} />
      </motion.div>

      {/* Soft accent glow */}
      <div style={{
        position: 'absolute',
        inset: '-40px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${founder.accent}22 0%, transparent 65%)`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      {/* Portrait frame */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        background: `linear-gradient(160deg, ${NAVY} 0%, #071527 100%)`,
        boxShadow: `0 30px 80px rgba(11,31,58,0.35), 0 0 0 1px ${founder.accent}44, inset 0 0 40px rgba(0,0,0,0.25)`,
      }}>
        <img
          src={founder.photo}
          alt={founder.name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            filter: 'contrast(1.05) saturate(1.05)',
          }}
        />
        {/* Subtle bottom vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 55%, rgba(11,31,58,0.55) 100%)`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* Role chip anchored to portrait */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.7, delay: delay + 0.6 }}
        style={{
          position: 'absolute',
          bottom: '-14px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.5rem 1.15rem',
          background: '#FFFFFF',
          border: `1px solid ${founder.accent}55`,
          borderRadius: '100px',
          boxShadow: `0 12px 28px rgba(11,31,58,0.18)`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={12} color={founder.accent} strokeWidth={2.4} />
        <span style={{
          fontSize: '0.66rem',
          fontWeight: 700,
          color: NAVY,
          letterSpacing: '0.18em',
        }}>{founder.role}</span>
      </motion.div>
    </motion.div>
  );
};

// ----------------------------------------------------------------------------
// Central "PUNTO CERO" origin node (visual anchor between founders)
// ----------------------------------------------------------------------------
const OriginNode = ({ inView }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
    transition={{ duration: 1.2, delay: 0.4, ease: [0.6, 0.05, 0.01, 0.9] }}
    style={{
      position: 'relative',
      width: '180px',
      height: '180px',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {/* Concentric pulsing rings */}
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={inView ? { scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] } : {}}
        transition={{ duration: 3.6, repeat: Infinity, delay: i * 1.2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `1px solid ${EMERALD}55`,
        }}
      />
    ))}
    {/* Core */}
    <div style={{
      width: '110px',
      height: '110px',
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${EMERALD}, ${NAVY})`,
      boxShadow: `0 0 40px ${EMERALD}66, inset 0 0 20px rgba(0,0,0,0.3)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#FFFFFF',
    }}>
      <div style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '2.4rem',
        fontWeight: 700,
        lineHeight: 1,
        color: GOLD,
      }}>0</div>
      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.28em',
        fontWeight: 700,
        marginTop: '0.25rem',
        color: '#FFFFFF',
      }}>PUNTO CERO</div>
    </div>
  </motion.div>
);

// ----------------------------------------------------------------------------
// Founder info card (below portrait) — clean, editorial, non-square-SaaS
// ----------------------------------------------------------------------------
const FounderCard = ({ founder, inView, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
    transition={{ duration: 0.9, delay }}
    style={{
      padding: '2rem 1.75rem 2.25rem',
      background: '#FFFFFF',
      borderRadius: '28px',
      border: `1px solid rgba(11,31,58,0.06)`,
      boxShadow: '0 20px 60px rgba(11,31,58,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}
    data-testid={`founder-card-${founder.key}`}
  >
    {/* Accent line */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: `linear-gradient(90deg, transparent, ${founder.accent}, transparent)`,
    }} />

    <div style={{
      fontSize: '0.7rem',
      color: founder.accent,
      fontWeight: 700,
      letterSpacing: '0.2em',
      marginBottom: '0.75rem',
    }}>{founder.title}</div>

    <h3 style={{
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: 'clamp(1.35rem, 2.2vw, 1.7rem)',
      fontWeight: 700,
      lineHeight: 1.15,
      color: NAVY,
      letterSpacing: '-0.02em',
      marginBottom: '0.6rem',
    }}>{founder.name}</h3>

    <div style={{
      fontSize: '0.8rem',
      color: NAVY,
      fontWeight: 600,
      marginBottom: '0.35rem',
    }}>{founder.roleEs}</div>

    <div style={{
      fontSize: '0.65rem',
      color: 'rgba(11,31,58,0.55)',
      fontWeight: 700,
      letterSpacing: '0.15em',
      marginBottom: '1.5rem',
    }}>{founder.tagline}</div>

    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.4rem',
    }}>
      {founder.responsibilities.map((r) => (
        <span key={r} style={{
          padding: '0.35rem 0.75rem',
          background: `${founder.accent}12`,
          border: `1px solid ${founder.accent}30`,
          borderRadius: '100px',
          fontSize: '0.7rem',
          color: NAVY,
          fontWeight: 600,
        }}>{r}</span>
      ))}
    </div>
  </motion.div>
);

// ----------------------------------------------------------------------------
// Founding story narrative
// ----------------------------------------------------------------------------
const FoundingStory = ({ inView }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
    transition={{ duration: 0.9, delay: 0.3 }}
    style={{
      marginTop: '5rem',
      padding: '3.5rem 3rem',
      background: NAVY,
      borderRadius: '32px',
      color: '#FFFFFF',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Decorative orbital line */}
    <div style={{
      position: 'absolute',
      top: '-160px',
      right: '-160px',
      width: '480px',
      height: '480px',
      borderRadius: '50%',
      border: `1px solid ${EMERALD}22`,
      pointerEvents: 'none',
    }} />
    <div style={{
      position: 'absolute',
      top: '-80px',
      right: '-80px',
      width: '320px',
      height: '320px',
      borderRadius: '50%',
      border: `1px solid ${GOLD}22`,
      pointerEvents: 'none',
    }} />

    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.15fr 1fr',
      gap: '3.5rem',
      alignItems: 'center',
      position: 'relative',
    }} className="founding-story-grid">
      <div>
        <div style={{
          fontSize: '0.7rem',
          color: GOLD,
          fontWeight: 700,
          letterSpacing: '0.25em',
          marginBottom: '1.5rem',
        }}>THE FOUNDING STORY</div>

        <h3 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 'clamp(1.75rem, 3.2vw, 2.35rem)',
          fontWeight: 300,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          marginBottom: '1.5rem',
        }}>
          Punto Cero System comenzó con una visión y un equipo fundador dispuesto a construir <span style={{ fontWeight: 700, color: GOLD }}>desde cero</span>.
        </h3>

        <p style={{
          fontSize: '1rem',
          lineHeight: 1.75,
          color: 'rgba(255,255,255,0.75)',
          marginBottom: '1.25rem',
          fontWeight: 300,
        }}>
          Con recursos limitados pero una visión de largo plazo, los fundadores invirtieron su propio tiempo, dinero, trabajo y sacrificio para construir la base tecnológica inicial. Esa base evolucionó en <b style={{ color: '#FFFFFF' }}>Punto Cero Legal</b>, el primer vertical comercial LIVE del ecosistema.
        </p>

        <p style={{
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: 'rgba(255,255,255,0.6)',
          fontWeight: 300,
        }}>
          La próxima etapa es escalar la capacidad de ejecución, incorporar talento, desarrollar alianzas estratégicas, validar el mercado y expandir el ecosistema.
        </p>
      </div>

      <div>
        <div style={{
          padding: '1.5rem 1.75rem',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${EMERALD}33`,
          borderRadius: '20px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{
            fontSize: '0.65rem',
            color: EMERALD,
            fontWeight: 700,
            letterSpacing: '0.25em',
            marginBottom: '1rem',
          }}>MENSAJE CENTRAL</div>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.35rem',
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: '#FFFFFF',
          }}>
            Empezar desde cero no es una desventaja.
          </div>
          <div style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.35rem',
            fontWeight: 300,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: GOLD,
            marginTop: '0.35rem',
          }}>
            Es donde comienza la transformación.
          </div>
        </div>

        {/* Chain of vision */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1.15rem 1.25rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '18px',
          fontSize: '0.72rem',
          lineHeight: 1.9,
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '0.08em',
        }}>
          <div style={{ fontWeight: 700, color: EMERALD }}>TWO FOUNDERS</div>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>↓</div>
          <div>ONE VISION</div>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>↓</div>
          <div>SHARED TECHNOLOGY CORE</div>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>↓</div>
          <div style={{ color: GOLD, fontWeight: 700 }}>PUNTO CERO LEGAL · LIVE</div>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>↓</div>
          <div>FUTURE VERTICALS</div>
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>↓</div>
          <div style={{ fontWeight: 700 }}>LATIN AMERICAN ECOSYSTEM</div>
        </div>
      </div>
    </div>
  </motion.div>
);

// ----------------------------------------------------------------------------
// Main section
// ----------------------------------------------------------------------------
const FoundersSection = () => {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.15 });

  return (
    <section
      id="founders"
      ref={sectionRef}
      data-testid="founders-section"
      style={{
        position: 'relative',
        padding: '9rem 2rem',
        background: '#FFFFFF',
        color: NAVY,
        overflow: 'hidden',
      }}
    >
      {/* Decorative background orbits */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '-200px',
        width: '520px',
        height: '520px',
        borderRadius: '50%',
        border: `1px solid ${EMERALD}12`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '5%',
        right: '-260px',
        width: '640px',
        height: '640px',
        borderRadius: '50%',
        border: `1px solid ${GOLD}18`,
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        position: 'relative',
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.9 }}
          style={{ maxWidth: '860px', marginBottom: '5rem' }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.75rem',
          }}>
            <motion.div
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{ width: '8px', height: '8px', borderRadius: '50%', background: EMERALD }}
            />
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: EMERALD,
              letterSpacing: '0.28em',
            }}>THE FOUNDING TEAM</span>
          </div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
            fontWeight: 300,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
            color: NAVY,
          }}>
            Las personas detrás de la <span style={{ fontWeight: 700, color: NAVY }}>visión</span>.
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 1.5vw, 1.1rem)',
            lineHeight: 1.7,
            color: 'rgba(11,31,58,0.65)',
            fontWeight: 300,
            maxWidth: '680px',
          }}>
            Antes de un equipo grande, capital significativo o una organización expansiva, hubo la decisión de empezar. Los fundadores representan el punto de origen humano del ecosistema.
          </p>
        </motion.div>

        {/* Founders composition · Portrait · Origin · Portrait */}
        <div
          className="founders-composition"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '3rem',
            alignItems: 'center',
            marginBottom: '5rem',
            position: 'relative',
          }}
        >
          {/* Left portrait (Darwin) */}
          <FounderPortrait founder={FOUNDERS[0]} inView={inView} delay={0.1} side="left" />

          {/* Central origin node */}
          <div style={{ position: 'relative' }}>
            {/* Connecting lines behind the origin node */}
            <div
              className="founders-connector founders-connector-left"
              style={{
                position: 'absolute',
                top: '50%',
                right: '100%',
                width: '160px',
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${EMERALD}44 30%, ${EMERALD})`,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <div
              className="founders-connector founders-connector-right"
              style={{
                position: 'absolute',
                top: '50%',
                left: '100%',
                width: '160px',
                height: '2px',
                background: `linear-gradient(-90deg, transparent, ${GOLD}44 30%, ${GOLD})`,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            {/* Traveling dots along connectors */}
            <motion.div
              animate={inView ? { x: [-160, 0], opacity: [0, 1, 0] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="founders-traveler"
              style={{
                position: 'absolute',
                top: '50%',
                right: '100%',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: EMERALD,
                boxShadow: `0 0 12px ${EMERALD}`,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <motion.div
              animate={inView ? { x: [0, 160], opacity: [0, 1, 0] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              className="founders-traveler"
              style={{
                position: 'absolute',
                top: '50%',
                left: '100%',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: GOLD,
                boxShadow: `0 0 12px ${GOLD}`,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />

            <OriginNode inView={inView} />

            <div style={{
              marginTop: '1.75rem',
              textAlign: 'center',
              fontSize: '0.65rem',
              letterSpacing: '0.28em',
              color: 'rgba(11,31,58,0.5)',
              fontWeight: 700,
            }}>THE ORIGIN POINT</div>
          </div>

          {/* Right portrait (Jonathan) */}
          <FounderPortrait founder={FOUNDERS[1]} inView={inView} delay={0.25} side="right" />
        </div>

        {/* Founder info cards */}
        <div
          className="founders-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
          }}
        >
          <FounderCard founder={FOUNDERS[0]} inView={inView} delay={0.3} />
          <FounderCard founder={FOUNDERS[1]} inView={inView} delay={0.45} />
        </div>

        {/* Founding story */}
        <FoundingStory inView={inView} />

        {/* Closing pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          style={{
            marginTop: '4rem',
            textAlign: 'center',
          }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.9rem',
            padding: '0.85rem 1.75rem',
            background: NAVY,
            color: '#FFFFFF',
            borderRadius: '100px',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}>
            <span style={{ color: EMERALD, fontWeight: 700 }}>ONE FOUNDING VISION</span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>ONE TECHNOLOGY FOUNDATION</span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span style={{ color: GOLD, fontWeight: 700 }}>ONE GLOBAL ECOSYSTEM</span>
            <ArrowRight size={14} color={GOLD} />
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .founders-composition {
            grid-template-columns: 1fr !important;
            gap: 2.5rem !important;
          }
          .founders-connector { display: none !important; }
          .founders-traveler { display: none !important; }
          .founders-cards-grid { grid-template-columns: 1fr !important; }
          .founding-story-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
        }
        @media (max-width: 1100px) {
          .founders-connector { width: 90px !important; }
        }
      `}</style>
    </section>
  );
};

export { FOUNDERS };
export default FoundersSection;
