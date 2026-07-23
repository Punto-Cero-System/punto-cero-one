import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const VisionSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const evolutionSteps = [
    { label: 'PUNTO', size: 8 },
    { label: 'CORE', size: 24 },
    { label: 'PLATAFORMA', size: 48 },
    { label: 'VERTICALES', size: 72 },
    { label: 'ECOSISTEMA', size: 100 }
  ];

  return (
    <section
      id="vision"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <div style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        position: 'relative'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
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
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.25em'
            }}>
              LA VISIÓN
            </span>
          </div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: '1.5rem',
            color: '#FFFFFF',
            letterSpacing: '-0.03em'
          }}>
            De un punto,
            <br />
            <span style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              todo se conecta.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '640px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            El origen de un sistema tecnológico diseñado para conectar
            profesionales, empresas y países a través de una infraestructura compartida.
          </p>
        </motion.div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(1rem, 4vw, 3rem)',
          flexWrap: 'wrap',
          padding: '3rem 0'
        }}>
          {evolutionSteps.map((step, index) => (
            <React.Fragment key={step.label}>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                transition={{ delay: 0.3 + index * 0.2, duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      `0 0 ${step.size / 3}px rgba(0, 200, 150, 0.3)`,
                      `0 0 ${step.size / 2}px rgba(0, 200, 150, 0.5)`,
                      `0 0 ${step.size / 3}px rgba(0, 200, 150, 0.3)`
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{
                    width: `${step.size}px`,
                    height: `${step.size}px`,
                    borderRadius: '50%',
                    background: index === 0
                      ? '#00C896'
                      : `radial-gradient(circle, rgba(0, 200, 150, ${0.15 + index * 0.05}) 0%, transparent 70%)`,
                    border: index > 0 ? `${index === evolutionSteps.length - 1 ? 2 : 1}px solid rgba(0, 200, 150, ${0.3 + index * 0.1})` : 'none'
                  }}
                />
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.6)',
                  letterSpacing: '0.15em'
                }}>
                  {step.label}
                </div>
              </motion.div>

              {index < evolutionSteps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={isInView ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                  transition={{ delay: 0.4 + index * 0.2, duration: 0.6 }}
                  style={{
                    width: '30px',
                    height: '1px',
                    background: 'linear-gradient(90deg, rgba(0, 200, 150, 0.5) 0%, rgba(0, 200, 150, 0.2) 100%)',
                    transformOrigin: 'left'
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.5, duration: 1 }}
          style={{
            marginTop: '6rem',
            textAlign: 'center',
            display: 'flex',
            gap: 'clamp(1rem, 3vw, 2.5rem)',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}
        >
          {['ECOSISTEMA', 'COMUNIDAD', 'SISTEMA', 'VERTICALES', 'PROFESIONALES', 'EMPRENDEDORES', 'EMPRESAS'].map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: 1.6 + i * 0.08, duration: 0.5 }}
              whileHover={{ color: '#00C896', y: -3 }}
              className="interactive"
              style={{
                fontSize: 'clamp(0.85rem, 1.4vw, 1rem)',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.5)',
                letterSpacing: '0.15em',
                cursor: 'default',
                fontFamily: '"Space Grotesk", sans-serif'
              }}
            >
              {word}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default VisionSection;
