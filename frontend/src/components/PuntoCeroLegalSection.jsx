import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Scale, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

const PuntoCeroLegalSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const features = [
    'Gestión de casos automatizada',
    'Documentos legales inteligentes',
    'CRM jurídico avanzado',
    'Análisis con IA',
    'Seguimiento de procesos',
    'Facturación integrada'
  ];

  return (
    <section
      id="punto-cero-legal"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Ambient orbital background */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.08)',
          pointerEvents: 'none'
        }}
      />

      <div style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <motion.div
            animate={{
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.5rem',
              background: 'rgba(0, 200, 150, 0.15)',
              border: '2px solid #00C896',
              borderRadius: '100px',
              marginBottom: '2rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.15em',
              boxShadow: '0 0 30px rgba(0, 200, 150, 0.3)'
            }}
          >
            <Sparkles size={16} />
            PRIMER VERTICAL ACTIVO
          </motion.div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 300,
            lineHeight: 1.05,
            marginBottom: '1.5rem',
            color: '#FFFFFF',
            letterSpacing: '-0.03em'
          }}>
            <span style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Punto Cero Legal
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '700px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            La primera expresión comercial del ecosistema Punto Cero System.
            <br />
            Diseñada para abogados y firmas legales en Latinoamérica.
          </p>
        </motion.div>

        {/* Main content grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '5rem',
          alignItems: 'center'
        }}>
          {/* Left: Circular image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1',
              maxWidth: '500px',
              margin: '0 auto'
            }}
          >
            {/* Outer orbit */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: '-30px',
                borderRadius: '50%',
                border: '1px dashed rgba(0, 200, 150, 0.3)'
              }}
            >
              <motion.div
                style={{
                  position: 'absolute',
                  top: '-4px',
                  left: '50%',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#00C896',
                  boxShadow: '0 0 20px rgba(0, 200, 150, 0.8)',
                  transform: 'translateX(-50%)'
                }}
              />
            </motion.div>

            {/* Image container */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(0, 200, 150, 0.3)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 200, 150, 0.2)'
            }}>
              <img
                src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80"
                alt="Punto Cero Legal"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'saturate(0.85) contrast(1.05)'
                }}
              />
              
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(11, 31, 58, 0.4) 0%, transparent 40%, rgba(0, 200, 150, 0.2) 100%)'
              }} />

              <div style={{
                position: 'absolute',
                bottom: '10%',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: 'rgba(11, 31, 58, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0, 200, 150, 0.3)',
                borderRadius: '100px'
              }}>
                <Scale size={18} color="#00C896" />
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  letterSpacing: '0.05em'
                }}>
                  LEGAL TECH
                </span>
              </div>
            </div>

            {/* Floating status */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '-20px',
                padding: '0.75rem 1.25rem',
                background: 'rgba(11, 31, 58, 0.95)',
                border: '1px solid rgba(0, 200, 150, 0.4)',
                borderRadius: '100px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#00C896',
                  boxShadow: '0 0 10px rgba(0, 200, 150, 0.8)'
                }}
              />
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '0.1em'
              }}>
                LIVE
              </span>
            </motion.div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <p style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '2rem',
              fontWeight: 300
            }}>
              Gestión legal inteligente impulsada por el core tecnológico compartido.
              Toda la potencia del ecosistema, especializada para el sector jurídico.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.25rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              marginBottom: '2rem'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, transparent 70%)',
                border: '2px solid #00C896',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif',
                flexShrink: 0
              }}>
                0
              </div>
              <div>
                <div style={{
                  fontSize: '0.7rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  letterSpacing: '0.15em',
                  fontWeight: 600
                }}>
                  POWERED BY
                </div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  marginTop: '0.2rem'
                }}>
                  Punto Cero System Core
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gap: '0.75rem',
              marginBottom: '2.5rem'
            }}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  transition={{ delay: 0.7 + index * 0.08, duration: 0.5 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, transparent 70%)',
                    border: '1px solid rgba(0, 200, 150, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle size={12} color="#00C896" />
                  </div>
                  <span style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 400
                  }}>
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <motion.a
                href="https://puntocerolegal.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                className="interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.1rem 2rem',
                  background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '1rem',
                  fontWeight: 600
                }}
              >
                Visitar puntocerolegal.com
                <ArrowRight size={18} />
              </motion.a>

              <motion.a
                href="mailto:puntocerosystem@gmail.com?subject=Demo - Punto Cero Legal"
                whileHover={{ 
                  scale: 1.05,
                  background: 'rgba(0, 200, 150, 0.1)',
                  borderColor: '#00C896'
                }}
                whileTap={{ scale: 0.98 }}
                className="interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.1rem 2rem',
                  background: 'transparent',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  border: '2px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                Solicitar Demo
              </motion.a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PuntoCeroLegalSection;
