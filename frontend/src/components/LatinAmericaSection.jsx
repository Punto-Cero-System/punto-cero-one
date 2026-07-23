import React, { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Globe, TrendingUp, Users, Zap } from 'lucide-react';

const LatinAmericaSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });
  const [hoveredCountry, setHoveredCountry] = useState(null);

  const countries = [
    { name: 'México', code: 'MX', status: 'roadmap', currency: 'MXN', x: 15, y: 25 },
    { name: 'Guatemala', code: 'GT', status: 'roadmap', currency: 'GTQ', x: 18, y: 32 },
    { name: 'Honduras', code: 'HN', status: 'roadmap', currency: 'HNL', x: 20, y: 34 },
    { name: 'El Salvador', code: 'SV', status: 'roadmap', currency: 'USD', x: 19, y: 35 },
    { name: 'Nicaragua', code: 'NI', status: 'roadmap', currency: 'NIO', x: 21, y: 36 },
    { name: 'Costa Rica', code: 'CR', status: 'roadmap', currency: 'CRC', x: 22, y: 38 },
    { name: 'Panamá', code: 'PA', status: 'roadmap', currency: 'PAB', x: 24, y: 40 },
    { name: 'Colombia', code: 'CO', status: 'active', currency: 'COP', x: 28, y: 48 },
    { name: 'Venezuela', code: 'VE', status: 'roadmap', currency: 'VES', x: 32, y: 42 },
    { name: 'Ecuador', code: 'EC', status: 'roadmap', currency: 'USD', x: 26, y: 52 },
    { name: 'Perú', code: 'PE', status: 'roadmap', currency: 'PEN', x: 28, y: 60 },
    { name: 'Brasil', code: 'BR', status: 'roadmap', currency: 'BRL', x: 45, y: 58 },
    { name: 'Bolivia', code: 'BO', status: 'roadmap', currency: 'BOB', x: 32, y: 65 },
    { name: 'Paraguay', code: 'PY', status: 'roadmap', currency: 'PYG', x: 38, y: 68 },
    { name: 'Chile', code: 'CL', status: 'roadmap', currency: 'CLP', x: 30, y: 75 },
    { name: 'Argentina', code: 'AR', status: 'roadmap', currency: 'ARS', x: 35, y: 78 },
    { name: 'Uruguay', code: 'UY', status: 'roadmap', currency: 'UYU', x: 40, y: 76 },
    { name: 'República Dominicana', code: 'DO', status: 'roadmap', currency: 'DOP', x: 35, y: 28 }
  ];

  const stats = [
    { icon: Globe, value: '18', label: 'Países', color: '#00C896' },
    { icon: TrendingUp, value: '15+', label: 'Monedas', color: '#D4AF37' },
    { icon: Users, value: '650M+', label: 'Habitantes', color: '#00C896' },
    { icon: Zap, value: '1', label: 'Ecosistema', color: '#00C896' }
  ];

  return (
    <section
      id="latam"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.1) 0%, transparent 70%)',
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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              18 países.
            </span>
            <br />
            Múltiples monedas.
            <br />
            Un ecosistema conectado.
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            Punto Cero System está diseñado para conectar Latinoamérica a través de tecnología.
            <br />
            Diferentes países. Diferentes culturas. Diferentes monedas. Una infraestructura compartida.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            marginBottom: '5rem'
          }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.6 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="interactive"
              style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${stat.color}40`,
                borderRadius: '16px',
                textAlign: 'center',
                backdropFilter: 'blur(12px)'
              }}
            >
              <stat.icon size={32} color={stat.color} style={{ marginBottom: '1rem' }} />
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                color: stat.color,
                marginBottom: '0.5rem',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500
              }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Interactive Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.8, duration: 1 }}
          style={{
            position: 'relative',
            maxWidth: '900px',
            margin: '0 auto',
            padding: '3rem',
            background: 'rgba(0, 200, 150, 0.02)',
            border: '1px solid rgba(0, 200, 150, 0.1)',
            borderRadius: '24px',
            backdropFilter: 'blur(12px)',
            minHeight: '600px'
          }}
        >
          {/* Map title */}
          <div style={{
            textAlign: 'center',
            marginBottom: '3rem'
          }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#00C896',
              marginBottom: '0.5rem',
              fontFamily: '"Space Grotesk", sans-serif'
            }}>
              Ecosistema Latinoamericano
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              Presencia actual y roadmap de expansión
            </p>
          </div>

          {/* Country nodes */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '500px'
          }}>
            {countries.map((country, index) => (
              <motion.div
                key={country.code}
                initial={{ scale: 0, opacity: 0 }}
                animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ delay: 1 + index * 0.05, duration: 0.4 }}
                whileHover={{ scale: 1.5, zIndex: 100 }}
                onMouseEnter={() => setHoveredCountry(country)}
                onMouseLeave={() => setHoveredCountry(null)}
                className="interactive"
                style={{
                  position: 'absolute',
                  left: `${country.x}%`,
                  top: `${country.y}%`,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: country.status === 'active' 
                    ? 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
                    : 'rgba(212, 175, 55, 0.3)',
                  border: country.status === 'active'
                    ? '3px solid #00C896'
                    : '2px solid rgba(212, 175, 55, 0.5)',
                  cursor: 'pointer',
                  boxShadow: country.status === 'active'
                    ? '0 0 20px rgba(0, 200, 150, 0.6)'
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#FFFFFF'
                }}
              >
                {country.status === 'active' && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#00C896',
                      zIndex: -1
                    }}
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* Hovered country info */}
          <AnimatePresence>
            {hoveredCountry && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  position: 'absolute',
                  bottom: '2rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '1.5rem 2rem',
                  background: 'rgba(11, 31, 58, 0.95)',
                  border: '1px solid rgba(0, 200, 150, 0.3)',
                  borderRadius: '16px',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                  minWidth: '250px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  marginBottom: '0.5rem'
                }}>
                  {hoveredCountry.name}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '0.75rem'
                }}>
                  Moneda: {hoveredCountry.currency}
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '0.4rem 1rem',
                  background: hoveredCountry.status === 'active'
                    ? 'rgba(0, 200, 150, 0.2)'
                    : 'rgba(212, 175, 55, 0.2)',
                  border: `1px solid ${hoveredCountry.status === 'active' ? '#00C896' : '#D4AF37'}`,
                  borderRadius: '100px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: hoveredCountry.status === 'active' ? '#00C896' : '#D4AF37',
                  letterSpacing: '0.05em'
                }}>
                  {hoveredCountry.status === 'active' ? 'ACTIVO' : 'ROADMAP'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          style={{
            marginTop: '3rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#00C896',
              border: '2px solid #00C896',
              boxShadow: '0 0 10px rgba(0, 200, 150, 0.5)'
            }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
              Presencia Activa
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'rgba(212, 175, 55, 0.3)',
              border: '2px solid rgba(212, 175, 55, 0.5)'
            }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem' }}>
              Roadmap de Expansión
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LatinAmericaSection;
