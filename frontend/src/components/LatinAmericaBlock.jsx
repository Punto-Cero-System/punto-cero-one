import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

const LatinAmericaBlock = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.15 });
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [pulseIndex, setPulseIndex] = useState(0);

  const countries = [
    { name: 'México', code: 'MX', status: 'roadmap', currency: 'MXN', x: 20, y: 22 },
    { name: 'Guatemala', code: 'GT', status: 'roadmap', currency: 'GTQ', x: 22, y: 30 },
    { name: 'Honduras', code: 'HN', status: 'roadmap', currency: 'HNL', x: 24, y: 32 },
    { name: 'El Salvador', code: 'SV', status: 'roadmap', currency: 'USD', x: 23, y: 34 },
    { name: 'Nicaragua', code: 'NI', status: 'roadmap', currency: 'NIO', x: 25, y: 36 },
    { name: 'Costa Rica', code: 'CR', status: 'roadmap', currency: 'CRC', x: 26, y: 38 },
    { name: 'Panamá', code: 'PA', status: 'roadmap', currency: 'PAB', x: 28, y: 40 },
    { name: 'Rep. Dominicana', code: 'DO', status: 'roadmap', currency: 'DOP', x: 40, y: 27 },
    { name: 'Colombia', code: 'CO', status: 'active', currency: 'COP', x: 33, y: 46 },
    { name: 'Venezuela', code: 'VE', status: 'roadmap', currency: 'VES', x: 40, y: 41 },
    { name: 'Ecuador', code: 'EC', status: 'roadmap', currency: 'USD', x: 30, y: 52 },
    { name: 'Perú', code: 'PE', status: 'roadmap', currency: 'PEN', x: 32, y: 60 },
    { name: 'Brasil', code: 'BR', status: 'roadmap', currency: 'BRL', x: 52, y: 55 },
    { name: 'Bolivia', code: 'BO', status: 'roadmap', currency: 'BOB', x: 38, y: 65 },
    { name: 'Paraguay', code: 'PY', status: 'roadmap', currency: 'PYG', x: 45, y: 70 },
    { name: 'Chile', code: 'CL', status: 'roadmap', currency: 'CLP', x: 33, y: 78 },
    { name: 'Argentina', code: 'AR', status: 'roadmap', currency: 'ARS', x: 40, y: 80 },
    { name: 'Uruguay', code: 'UY', status: 'roadmap', currency: 'UYU', x: 46, y: 79 }
  ];

  const timeline = [
    { phase: 'AHORA', title: 'Punto Cero Legal', description: 'Primer vertical activo. Colombia como mercado inicial.', status: 'active' },
    { phase: 'PRÓXIMA ETAPA', title: 'Verticales adicionales', description: 'Medical y Dental en desarrollo. Expansión inicial de core.', status: 'next' },
    { phase: 'EXPANSIÓN', title: 'Mercados regionales', description: 'Ampliación progresiva hacia mercados hispanohablantes.', status: 'expansion' },
    { phase: 'VISIÓN FUTURA', title: 'Ecosistema regional', description: '18 países conectados a través de una infraestructura compartida.', status: 'future' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % countries.length);
    }, 700);
    return () => clearInterval(interval);
  }, [countries.length]);

  const activeCountry = countries.find(c => c.status === 'active');

  return (
    <section
      id="latam"
      ref={sectionRef}
      style={{
        position: 'relative',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 50%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 200, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1200px',
          height: '1200px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.06)',
          pointerEvents: 'none'
        }}
      />

      <div style={{
        maxWidth: '1400px',
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
              ECOSISTEMA LATINOAMERICANO
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
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>18 países</span>. Un ecosistema.
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.6)',
            maxWidth: '640px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            Múltiples monedas. Múltiples culturas. Un núcleo tecnológico compartido.
          </p>
        </motion.div>

        {/* Main visualization + names grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '4rem',
          alignItems: 'center',
          marginBottom: '6rem'
        }}>
          {/* Living map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1, delay: 0.3 }}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1',
              maxWidth: '550px',
              margin: '0 auto'
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 200, 150, 0.06) 0%, transparent 70%)',
              border: '1px solid rgba(0, 200, 150, 0.1)'
            }} />

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
                    stroke="rgba(0, 200, 150, 0.12)"
                    strokeWidth="0.15"
                    strokeDasharray="0.5 1"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 1.5, delay: 1 }}
                  />
                );
              })}
              {activeCountry && countries.filter(c => c.status !== 'active').slice(0, 5).map((country, i) => (
                <motion.circle
                  key={`flow-${country.code}`}
                  r="0.4"
                  fill="#00C896"
                  initial={{ cx: activeCountry.x, cy: activeCountry.y, opacity: 0 }}
                  animate={{
                    cx: [activeCountry.x, country.x],
                    cy: [activeCountry.y, country.y],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.6, ease: 'linear' }}
                />
              ))}
            </svg>

            {countries.map((country, index) => {
              const isActive = country.status === 'active';
              const isPulsing = pulseIndex === index;
              const size = isActive ? 18 : 12;
              return (
                <motion.div
                  key={country.code}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  transition={{ delay: 0.5 + index * 0.04, duration: 0.5 }}
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
                      : 'rgba(212, 175, 55, 0.25)',
                    border: isActive ? '2px solid #FFFFFF' : '1px solid rgba(212, 175, 55, 0.5)',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 0 20px rgba(0, 200, 150, 0.7)' : 'none'
                  }}
                >
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
                    </>
                  )}
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
          </motion.div>

          {/* Info panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
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
                    fontSize: '0.7rem',
                    color: hoveredCountry.status === 'active' ? '#00C896' : '#D4AF37',
                    letterSpacing: '0.25em',
                    fontWeight: 700,
                    marginBottom: '1rem'
                  }}>
                    {hoveredCountry.status === 'active' ? '● PRESENCIA ACTIVA' : '○ ROADMAP'}
                  </div>
                  <h3 style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginBottom: '1rem',
                    lineHeight: 1,
                    letterSpacing: '-0.02em'
                  }}>
                    {hoveredCountry.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>MONEDA</div>
                      <div style={{ fontSize: '1.2rem', color: '#FFFFFF', fontWeight: 600 }}>{hoveredCountry.currency}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.15em', marginBottom: '0.3rem' }}>CÓDIGO</div>
                      <div style={{ fontSize: '1.2rem', color: '#FFFFFF', fontWeight: 600 }}>{hoveredCountry.code}</div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* Country names grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem 1.5rem'
                  }}>
                    {countries.map((country, i) => (
                      <motion.div
                        key={country.code}
                        initial={{ opacity: 0, x: -10 }}
                        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                        transition={{ delay: 0.6 + i * 0.03, duration: 0.4 }}
                        onMouseEnter={() => setHoveredCountry(country)}
                        onMouseLeave={() => setHoveredCountry(null)}
                        className="interactive"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: country.status === 'active' ? '#00C896' : 'rgba(212, 175, 55, 0.6)',
                          boxShadow: country.status === 'active' ? '0 0 8px rgba(0, 200, 150, 0.8)' : 'none'
                        }} />
                        <span style={{
                          fontSize: '0.85rem',
                          color: country.status === 'active' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)',
                          fontWeight: country.status === 'active' ? 600 : 400,
                          transition: 'color 0.3s'
                        }}>
                          {country.name}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{
              display: 'flex',
              gap: '2rem',
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00C896', boxShadow: '0 0 8px rgba(0, 200, 150, 0.6)' }}
                />
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem' }}>Activo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.4)', border: '1px solid rgba(212, 175, 55, 0.5)' }} />
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem' }}>Roadmap de Expansión</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* TIMELINE */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          style={{
            marginTop: '6rem',
            paddingTop: '4rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.25em',
              marginBottom: '1.5rem'
            }}>
              TIMELINE DE EXPANSIÓN
            </div>
            <h3 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 300,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.2
            }}>
              Un sistema que <span style={{ fontWeight: 700, color: '#00C896' }}>evoluciona</span> progresivamente.
            </h3>
          </div>

          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2rem'
          }}>
            {/* Connection line - horizontal */}
            <div style={{
              position: 'absolute',
              top: '30px',
              left: '5%',
              right: '5%',
              height: '1px',
              background: 'linear-gradient(90deg, #00C896 0%, rgba(0, 200, 150, 0.3) 30%, rgba(212, 175, 55, 0.3) 70%, rgba(255, 255, 255, 0.1) 100%)'
            }} />

            {timeline.map((item, index) => {
              const statusColors = {
                active: '#00C896',
                next: '#00C896',
                expansion: '#D4AF37',
                future: 'rgba(255, 255, 255, 0.3)'
              };
              const color = statusColors[item.status];

              return (
                <motion.div
                  key={item.phase}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: 1 + index * 0.15, duration: 0.6 }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                >
                  {/* Node */}
                  <motion.div
                    animate={item.status === 'active' ? {
                      boxShadow: [
                        '0 0 20px rgba(0, 200, 150, 0.5)',
                        '0 0 40px rgba(0, 200, 150, 0.8)',
                        '0 0 20px rgba(0, 200, 150, 0.5)'
                      ]
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: item.status === 'active' 
                        ? 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
                        : `rgba(11, 31, 58, 0.9)`,
                      border: `2px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.5rem',
                      backdropFilter: 'blur(12px)',
                      position: 'relative',
                      zIndex: 1
                    }}
                  >
                    <span style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: item.status === 'active' ? '#FFFFFF' : color
                    }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </motion.div>

                  <div style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: color,
                    letterSpacing: '0.2em',
                    marginBottom: '0.75rem'
                  }}>
                    {item.phase}
                  </div>

                  <div style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginBottom: '0.5rem'
                  }}>
                    {item.title}
                  </div>

                  <div style={{
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    color: 'rgba(255, 255, 255, 0.55)',
                    maxWidth: '220px'
                  }}>
                    {item.description}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LatinAmericaBlock;
