import React, { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Brain, Database, Lock, Zap, FileText, Users, BarChart, CreditCard } from 'lucide-react';

const CircularCore = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });
  const [activeCapability, setActiveCapability] = useState(0);

  const capabilities = [
    { icon: Brain, label: 'Inteligencia Artificial', short: 'IA', description: 'Modelos de IA adaptados a contextos latinoamericanos' },
    { icon: Database, label: 'Data Infrastructure', short: 'DATA', description: 'Arquitectura de datos escalable y segura' },
    { icon: Lock, label: 'Security & Trust', short: 'SEC', description: 'Seguridad enterprise en cada capa del sistema' },
    { icon: Zap, label: 'Automation', short: 'AUTO', description: 'Automatización inteligente de procesos' },
    { icon: FileText, label: 'Documents', short: 'DOC', description: 'Gestión documental impulsada por IA' },
    { icon: Users, label: 'Identity & CRM', short: 'CRM', description: 'Gestión unificada de identidad y relaciones' },
    { icon: BarChart, label: 'Analytics', short: 'DATA', description: 'Analytics predictivos en tiempo real' },
    { icon: CreditCard, label: 'Billing & Payments', short: 'PAY', description: 'Multi-moneda y multi-país nativo' }
  ];

  return (
    <section
      id="core"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      <div style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Section header */}
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
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#00C896'
              }}
            />
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.2em'
            }}>
              PUNTO CERO CORE
            </span>
          </div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.15,
            marginBottom: '1.5rem',
            color: '#FFFFFF',
            letterSpacing: '-0.02em'
          }}>
            Un punto.
            <br />
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Ocho capacidades.
            </span>
            <br />
            Un sistema.
          </h2>
        </motion.div>

        {/* Two column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '4rem',
          alignItems: 'center'
        }}>
          {/* Left: Circular visualization */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxWidth: '500px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Outer orbital ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '1px dashed rgba(0, 200, 150, 0.15)'
              }}
            />

            {/* Inner orbital ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                width: '70%',
                height: '70%',
                borderRadius: '50%',
                border: '1px dashed rgba(212, 175, 55, 0.1)'
              }}
            />

            {/* Central core */}
            <motion.div
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : { scale: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              style={{
                position: 'relative',
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, rgba(11, 31, 58, 0.8) 70%)',
                border: '2px solid #00C896',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                boxShadow: '0 0 60px rgba(0, 200, 150, 0.5)'
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{
                  position: 'absolute',
                  inset: '10px',
                  borderRadius: '50%',
                  border: '1px solid rgba(0, 200, 150, 0.4)'
                }}
              />
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '0.15em',
                textAlign: 'center'
              }}>
                CORE
                <div style={{
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: '#00C896',
                  lineHeight: 1,
                  marginTop: '0.5rem',
                  fontFamily: '"Space Grotesk", sans-serif'
                }}>
                  0
                </div>
              </div>
            </motion.div>

            {/* Orbiting capability nodes */}
            {capabilities.map((cap, index) => {
              const angle = (index / capabilities.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 180;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isActive = activeCapability === index;

              return (
                <motion.div
                  key={cap.label}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { 
                    scale: 1, 
                    opacity: 1,
                    x,
                    y
                  } : { scale: 0, opacity: 0 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: 0.5 + index * 0.08
                  }}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => setActiveCapability(index)}
                  className="interactive"
                  style={{
                    position: 'absolute',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: isActive
                      ? 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
                      : 'rgba(11, 31, 58, 0.9)',
                    border: `2px solid ${isActive ? '#00C896' : 'rgba(0, 200, 150, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(12px)',
                    boxShadow: isActive 
                      ? '0 0 30px rgba(0, 200, 150, 0.6)' 
                      : '0 0 10px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <cap.icon size={22} color={isActive ? '#FFFFFF' : '#00C896'} />

                  {isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: '50%',
                        border: '2px solid #00C896',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </motion.div>
              );
            })}

            {/* Connection lines to active */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
              viewBox="0 0 500 500"
            >
              {capabilities.map((_, index) => {
                const angle = (index / capabilities.length) * Math.PI * 2 - Math.PI / 2;
                const radius = 180;
                const x = 250 + Math.cos(angle) * radius;
                const y = 250 + Math.sin(angle) * radius;
                const isActive = activeCapability === index;

                return (
                  <motion.line
                    key={`line-${index}`}
                    x1={250}
                    y1={250}
                    x2={x}
                    y2={y}
                    stroke={isActive ? '#00C896' : 'rgba(0, 200, 150, 0.1)'}
                    strokeWidth={isActive ? '1' : '0.5'}
                    strokeDasharray={isActive ? '0' : '3 3'}
                    initial={{ pathLength: 0 }}
                    animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
                    transition={{ duration: 1, delay: 1 + index * 0.05 }}
                  />
                );
              })}
            </svg>
          </div>

          {/* Right: Active capability info */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <motion.div
              key={activeCapability}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.2) 0%, transparent 100%)',
                  border: '1px solid rgba(0, 200, 150, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {React.createElement(capabilities[activeCapability].icon, { size: 26, color: '#00C896' })}
                </div>
                <div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#00C896',
                    letterSpacing: '0.2em',
                    fontWeight: 700,
                    marginBottom: '0.3rem'
                  }}>
                    CAPACIDAD {String(activeCapability + 1).padStart(2, '0')}/08
                  </div>
                  <h3 style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    lineHeight: 1.1
                  }}>
                    {capabilities[activeCapability].label}
                  </h3>
                </div>
              </div>

              <p style={{
                fontSize: '1.1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '2rem',
                fontWeight: 300
              }}>
                {capabilities[activeCapability].description}
              </p>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.5rem',
                background: 'rgba(0, 200, 150, 0.05)',
                borderRadius: '16px',
                border: '1px solid rgba(0, 200, 150, 0.15)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#00C896'
                }} />
                <span style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  Compartido entre todos los verticales del ecosistema
                </span>
              </div>
            </motion.div>

            {/* Navigation dots */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '3rem',
              flexWrap: 'wrap'
            }}>
              {capabilities.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveCapability(index)}
                  className="interactive"
                  style={{
                    width: activeCapability === index ? '32px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: activeCapability === index ? '#00C896' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CircularCore;
