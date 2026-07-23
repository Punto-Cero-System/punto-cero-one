import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

const LatinAmericaLiving = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [pulseIndex, setPulseIndex] = useState(0);

  const countries = [
    { name: 'México', code: 'MX', status: 'roadmap', currency: 'MXN', x: 20, y: 22, size: 'lg' },
    { name: 'Guatemala', code: 'GT', status: 'roadmap', currency: 'GTQ', x: 22, y: 30 },
    { name: 'Honduras', code: 'HN', status: 'roadmap', currency: 'HNL', x: 24, y: 32 },
    { name: 'El Salvador', code: 'SV', status: 'roadmap', currency: 'USD', x: 23, y: 33 },
    { name: 'Nicaragua', code: 'NI', status: 'roadmap', currency: 'NIO', x: 25, y: 35 },
    { name: 'Costa Rica', code: 'CR', status: 'roadmap', currency: 'CRC', x: 26, y: 37 },
    { name: 'Panamá', code: 'PA', status: 'roadmap', currency: 'PAB', x: 28, y: 39 },
    { name: 'República Dominicana', code: 'DO', status: 'roadmap', currency: 'DOP', x: 38, y: 27 },
    { name: 'Colombia', code: 'CO', status: 'active', currency: 'COP', x: 32, y: 46, size: 'lg' },
    { name: 'Venezuela', code: 'VE', status: 'roadmap', currency: 'VES', x: 38, y: 41 },
    { name: 'Ecuador', code: 'EC', status: 'roadmap', currency: 'USD', x: 30, y: 52 },
    { name: 'Perú', code: 'PE', status: 'roadmap', currency: 'PEN', x: 32, y: 60 },
    { name: 'Brasil', code: 'BR', status: 'roadmap', currency: 'BRL', x: 50, y: 56, size: 'lg' },
    { name: 'Bolivia', code: 'BO', status: 'roadmap', currency: 'BOB', x: 38, y: 65 },
    { name: 'Paraguay', code: 'PY', status: 'roadmap', currency: 'PYG', x: 44, y: 70 },
    { name: 'Chile', code: 'CL', status: 'roadmap', currency: 'CLP', x: 34, y: 78 },
    { name: 'Argentina', code: 'AR', status: 'roadmap', currency: 'ARS', x: 40, y: 80, size: 'lg' },
    { name: 'Uruguay', code: 'UY', status: 'roadmap', currency: 'UYU', x: 46, y: 78 }
  ];

  // Auto-pulse different countries
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % countries.length);
    }, 800);
    return () => clearInterval(interval);
  }, [countries.length]);

  const activeCountry = countries.find(c => c.status === 'active');

  return (
    <section
      id="latam"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Background orbital rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.08)',
          pointerEvents: 'none'
        }}
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1200px',
          height: '1200px',
          borderRadius: '50%',
          border: '1px dashed rgba(212, 175, 55, 0.05)',
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
          style={{ textAlign: 'center', marginBottom: '4rem' }}
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
              ECOSISTEMA LATINOAMERICANO
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
            Un núcleo tecnológico.
            <br />
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Muchos contextos locales.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '650px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            Diferentes monedas. Diferentes regulaciones. Diferentes culturas.
            Una infraestructura tecnológica compartida.
          </p>
        </motion.div>

        {/* Main visualization */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '4rem',
          alignItems: 'center'
        }}>
          {/* Left: Living map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1',
              maxWidth: '600px',
              margin: '0 auto'
            }}
          >
            {/* Container with subtle border */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 200, 150, 0.05) 0%, transparent 70%)',
              border: '1px solid rgba(0, 200, 150, 0.1)'
            }} />

            {/* SVG connection lines */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {activeCountry && countries.map((country) => {
                if (country.code === activeCountry.code) return null;
                return (
                  <motion.line
                    key={`line-${country.code}`}
                    x1={activeCountry.x}
                    y1={activeCountry.y}
                    x2={country.x}
                    y2={country.y}
                    stroke="rgba(0, 200, 150, 0.15)"
                    strokeWidth="0.15"
                    strokeDasharray="0.5 1"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 1.5, delay: 1 }}
                  />
                );
              })}

              {/* Data flow animations */}
              {activeCountry && countries.filter(c => c.status !== 'active').slice(0, 5).map((country, i) => (
                <motion.circle
                  key={`flow-${country.code}`}
                  r="0.5"
                  fill="#00C896"
                  initial={{ 
                    cx: activeCountry.x, 
                    cy: activeCountry.y,
                    opacity: 0
                  }}
                  animate={{
                    cx: [activeCountry.x, country.x],
                    cy: [activeCountry.y, country.y],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.6,
                    ease: 'linear'
                  }}
                />
              ))}
            </svg>

            {/* Country nodes */}
            {countries.map((country, index) => {
              const isActive = country.status === 'active';
              const isPulsing = pulseIndex === index;
              const size = country.size === 'lg' ? 20 : 14;

              return (
                <motion.div
                  key={country.code}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  transition={{ delay: 0.5 + index * 0.05, duration: 0.5 }}
                  whileHover={{ scale: 2, zIndex: 100 }}
                  onMouseEnter={() => setHoveredCountry(country)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  className="interactive"
                  style={{
                    position: 'absolute',
                    left: `${country.x}%`,
                    top: `${country.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    background: isActive
                      ? 'radial-gradient(circle, #00C896 0%, #00a077 100%)'
                      : 'rgba(212, 175, 55, 0.2)',
                    border: isActive
                      ? '2px solid #FFFFFF'
                      : '1px solid rgba(212, 175, 55, 0.4)',
                    cursor: 'pointer',
                    boxShadow: isActive
                      ? '0 0 20px rgba(0, 200, 150, 0.8), 0 0 40px rgba(0, 200, 150, 0.4)'
                      : 'none'
                  }}
                >
                  {/* Active country - constant pulse */}
                  {isActive && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{
                          position: 'absolute',
                          inset: '-2px',
                          borderRadius: '50%',
                          border: '2px solid #00C896',
                          pointerEvents: 'none'
                        }}
                      />
                      <motion.div
                        animate={{ scale: [1, 3.5, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                        style={{
                          position: 'absolute',
                          inset: '-2px',
                          borderRadius: '50%',
                          border: '1px solid #00C896',
                          pointerEvents: 'none'
                        }}
                      />
                    </>
                  )}

                  {/* Roadmap countries - random pulsing */}
                  {!isActive && isPulsing && (
                    <motion.div
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 1.5 }}
                      style={{
                        position: 'absolute',
                        inset: '-1px',
                        borderRadius: '50%',
                        border: '1px solid rgba(212, 175, 55, 0.6)',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </motion.div>
              );
            })}

            {/* Central label */}
            {!hoveredCountry && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 2 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.05)',
                  fontFamily: '"Space Grotesk", sans-serif',
                  letterSpacing: '-0.05em'
                }}>
                  LATAM
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right: Info panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {/* Hovered country display */}
            <div style={{ minHeight: '350px' }}>
              <AnimatePresence mode="wait">
                {hoveredCountry ? (
                  <motion.div
                    key={hoveredCountry.code}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div style={{
                      fontSize: '0.75rem',
                      color: hoveredCountry.status === 'active' ? '#00C896' : '#D4AF37',
                      letterSpacing: '0.2em',
                      fontWeight: 700,
                      marginBottom: '1rem'
                    }}>
                      {hoveredCountry.status === 'active' ? '● PRESENCIA ACTIVA' : '○ ROADMAP DE EXPANSIÓN'}
                    </div>

                    <h3 style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: '3rem',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      marginBottom: '1rem',
                      lineHeight: 1,
                      letterSpacing: '-0.02em'
                    }}>
                      {hoveredCountry.name}
                    </h3>

                    <div style={{
                      display: 'flex',
                      gap: '2rem',
                      marginTop: '2rem'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'rgba(255, 255, 255, 0.4)',
                          letterSpacing: '0.1em',
                          marginBottom: '0.3rem'
                        }}>
                          MONEDA
                        </div>
                        <div style={{
                          fontSize: '1.2rem',
                          color: '#FFFFFF',
                          fontWeight: 600
                        }}>
                          {hoveredCountry.currency}
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'rgba(255, 255, 255, 0.4)',
                          letterSpacing: '0.1em',
                          marginBottom: '0.3rem'
                        }}>
                          CÓDIGO
                        </div>
                        <div style={{
                          fontSize: '1.2rem',
                          color: '#FFFFFF',
                          fontWeight: 600
                        }}>
                          {hoveredCountry.code}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Stats display in circular format */}
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#00C896',
                        letterSpacing: '0.2em',
                        fontWeight: 700,
                        marginBottom: '1rem'
                      }}>
                        VISIÓN A LARGO PLAZO
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '2rem'
                    }}>
                      {[
                        { value: '18', label: 'Países' },
                        { value: '15+', label: 'Monedas' },
                        { value: '650M', label: 'Habitantes' },
                        { value: '1', label: 'Ecosistema' }
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * i + 0.5 }}
                        >
                          <div style={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontSize: '3.5rem',
                            fontWeight: 300,
                            color: '#FFFFFF',
                            lineHeight: 1,
                            letterSpacing: '-0.03em',
                            marginBottom: '0.5rem'
                          }}>
                            {stat.value}
                          </div>
                          <div style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.5)',
                            letterSpacing: '0.05em'
                          }}>
                            {stat.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex',
              gap: '2rem',
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#00C896',
                    boxShadow: '0 0 10px rgba(0, 200, 150, 0.6)'
                  }}
                />
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                  Presencia Activa
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'rgba(212, 175, 55, 0.3)',
                  border: '1px solid rgba(212, 175, 55, 0.5)'
                }} />
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                  Roadmap de Expansión
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LatinAmericaLiving;
