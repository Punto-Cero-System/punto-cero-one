import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Scale, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

const PuntoCeroLegalSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

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
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.15) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '4rem',
          alignItems: 'center'
        }}>
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.8 }}
          >
            {/* Status badge */}
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 0 20px rgba(0, 200, 150, 0.3)',
                  '0 0 30px rgba(0, 200, 150, 0.5)',
                  '0 0 20px rgba(0, 200, 150, 0.3)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1.5rem',
                background: 'rgba(0, 200, 150, 0.15)',
                border: '2px solid #00C896',
                borderRadius: '100px',
                marginBottom: '2rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#00C896',
                letterSpacing: '0.1em'
              }}
            >
              <Sparkles size={18} />
              PRIMER VERTICAL ACTIVO
            </motion.div>

            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '1.5rem',
              color: '#FFFFFF'
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Punto Cero
              </span>
              <br />
              Legal
            </h2>

            <p style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
              lineHeight: 1.8,
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '2rem'
            }}>
              La primera plataforma del ecosistema Punto Cero System.
              <br /><br />
              Gestión legal inteligente impulsada por el core tecnológico
              compartido. Diseñada para abogados y firmas legales en Latinoamérica.
            </p>

            {/* Powered by badge */}
            <div style={{
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.5rem',
                fontWeight: 600,
                letterSpacing: '0.05em'
              }}>
                POWERED BY
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#00C896'
              }}>
                PUNTO CERO SYSTEM CORE
              </div>
              <div style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '0.5rem'
              }}>
                IA • Seguridad • Automatización • APIs • Infraestructura compartida
              </div>
            </div>

            {/* CTAs */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <motion.a
                href="mailto:puntocerosystem@gmail.com?subject=Demo - Punto Cero Legal"
                whileHover={{ scale: 1.05, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                className="interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.25rem 2.5rem',
                  background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  border: 'none'
                }}
              >
                Solicitar Demo
                <ArrowRight size={20} />
              </motion.a>

              <motion.a
                href="mailto:puntocerosystem@gmail.com?subject=Información - Punto Cero Legal"
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
                  padding: '1.25rem 2.5rem',
                  background: 'transparent',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  border: '2px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                Más Información
              </motion.a>
            </div>
          </motion.div>

          {/* Right - Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Visual representation */}
            <div style={{
              position: 'relative',
              padding: '3rem',
              background: 'rgba(0, 200, 150, 0.03)',
              border: '1px solid rgba(0, 200, 150, 0.2)',
              borderRadius: '24px',
              backdropFilter: 'blur(12px)'
            }}>
              {/* Icon */}
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2rem',
                boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)'
              }}>
                <Scale size={50} color="#FFFFFF" />
              </div>

              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1.5rem',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                Características Principales
              </h3>

              {/* Features list */}
              <div style={{
                display: 'grid',
                gap: '1rem'
              }}>
                {features.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: 20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <CheckCircle size={20} color="#00C896" />
                    <span style={{
                      fontSize: '1rem',
                      color: 'rgba(255, 255, 255, 0.9)'
                    }}>
                      {feature}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PuntoCeroLegalSection;
