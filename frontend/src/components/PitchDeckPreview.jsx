import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';

const pitchSlides = [
  { n: '01', title: 'Cover', subtitle: 'One core. Multiple verticals. One ecosystem.' },
  { n: '02', title: 'The Opportunity', subtitle: 'Latinoamérica: fragmentación, culturas y monedas.' },
  { n: '03', title: 'The Vision', subtitle: 'Esto no es una aplicación. Es una plataforma.' },
  { n: '04', title: 'Shared Technology Core', subtitle: 'IA, CRM, Automation, APIs, Security, Data.' },
  { n: '05', title: 'The First Vertical', subtitle: 'Punto Cero Legal · puntocerolegal.com' },
  { n: '06', title: '18-Country Opportunity', subtitle: 'Múltiples mercados. Una arquitectura.' },
  { n: '07', title: 'Why the Architecture Matters', subtitle: 'Build once. Reuse. Adapt. Expand.' },
  { n: '08', title: 'The Ecosystem', subtitle: 'Profesionales · Empresas · Comunidad.' },
  { n: '09', title: 'The Roadmap', subtitle: 'Now · Next · Expansion · Future.' },
  { n: '10', title: 'Business Model', subtitle: 'SaaS · Enterprise · Integraciones · Servicios.' },
  { n: '11', title: 'Current Stage', subtitle: 'Etapa temprana. Arquitectura escalable.' },
  { n: '12', title: 'The Conversation', subtitle: 'Build the future of Latin American technology.' }
];

const PitchDeckPreview = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.15 });

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        padding: '8rem 2rem',
        background: '#FFFFFF',
        color: '#1E1E1E',
        overflow: 'hidden'
      }}
    >
      {/* Subtle background circle */}
      <div style={{
        position: 'absolute',
        top: '50%',
        right: '-200px',
        transform: 'translateY(-50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.04) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '4rem',
          alignItems: 'flex-start',
          marginBottom: '5rem'
        }}>
          {/* Left: Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '2rem'
            }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00C896' }}
              />
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#00C896',
                letterSpacing: '0.25em'
              }}>
                INVESTOR PITCH DECK
              </span>
            </div>

            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              marginBottom: '1.5rem',
              color: '#1E1E1E',
              letterSpacing: '-0.03em'
            }}>
              12 slides.
              <br />
              <span style={{ fontWeight: 700, color: '#0B1F3A' }}>Una narrativa.</span>
            </h2>

            <p style={{
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'rgba(30, 30, 30, 0.6)',
              fontWeight: 300,
              marginBottom: '2rem'
            }}>
              La arquitectura del pitch deck estructurado. Cada slide comunica una capa
              de la visión: desde el núcleo tecnológico compartido hasta la conversación estratégica.
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <Link
                to="/executive-summary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.75rem',
                  background: 'linear-gradient(135deg, #0B1F3A 0%, #163156 100%)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  boxShadow: '0 10px 30px rgba(11, 31, 58, 0.25)'
                }}
                className="interactive"
                data-testid="cta-executive-summary"
              >
                Executive Summary
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/investor-pitch-deck"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.75rem',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
                  color: '#0B1F3A',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  boxShadow: '0 10px 30px rgba(212, 175, 55, 0.25)'
                }}
                className="interactive"
                data-testid="cta-explore-pitch-deck"
              >
                Explorar Investor Pitch Deck
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/request-access"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.75rem',
                  background: 'transparent',
                  color: '#0B1F3A',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  border: '1px solid rgba(11, 31, 58, 0.2)'
                }}
                className="interactive"
                data-testid="cta-request-full-access"
              >
                Solicitar acceso completo
                <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>

          {/* Right: Feature emphasis */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              padding: '2.5rem',
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(0, 200, 150, 0.05) 100%)',
              borderRadius: '24px',
              border: '1px solid rgba(212, 175, 55, 0.15)'
            }}
          >
            <Layers size={32} color="#D4AF37" style={{ marginBottom: '1.5rem' }} />
            <div style={{
              fontSize: '0.7rem',
              color: '#D4AF37',
              letterSpacing: '0.2em',
              fontWeight: 700,
              marginBottom: '0.75rem'
            }}>
              MENSAJE CENTRAL
            </div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
              lineHeight: 1.3,
              fontWeight: 300,
              color: '#1E1E1E',
              letterSpacing: '-0.02em'
            }}>
              Construir el <span style={{ fontWeight: 700 }}>core una vez</span>. Reutilizar la infraestructura. Adaptar a industrias. <span style={{ fontWeight: 700, color: '#00C896' }}>Expandir a través de mercados.</span>
            </div>
          </motion.div>
        </div>

        {/* Slides grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          {pitchSlides.map((slide, index) => (
            <motion.div
              key={slide.n}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.4 + index * 0.04, duration: 0.5 }}
              whileHover={{ y: -4, borderColor: '#00C896', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)' }}
              className="interactive"
              style={{
                padding: '1.5rem',
                background: '#F5F7FA',
                border: '1px solid rgba(11, 31, 58, 0.06)',
                borderRadius: '16px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Slide number */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '10px',
                fontSize: '3rem',
                fontWeight: 700,
                color: 'rgba(11, 31, 58, 0.04)',
                fontFamily: '"Space Grotesk", sans-serif',
                lineHeight: 1
              }}>
                {slide.n}
              </div>

              <div style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#00C896',
                letterSpacing: '0.2em',
                marginBottom: '0.75rem',
                position: 'relative'
              }}>
                SLIDE {slide.n}
              </div>

              <div style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0B1F3A',
                marginBottom: '0.5rem',
                position: 'relative',
                letterSpacing: '-0.01em'
              }}>
                {slide.title}
              </div>

              <div style={{
                fontSize: '0.8rem',
                color: 'rgba(30, 30, 30, 0.55)',
                lineHeight: 1.5,
                position: 'relative'
              }}>
                {slide.subtitle}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PitchDeckPreview;
