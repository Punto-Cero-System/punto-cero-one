import React, { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Scale, Stethoscope, ShoppingCart, Calculator, Building2, Home, Shield, Plane, GraduationCap, Users, Hotel, Truck, HardHat, Sprout, Heart } from 'lucide-react';

const OrbitalEcosystem = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });
  const [selectedVertical, setSelectedVertical] = useState(0);

  const verticals = [
    { name: 'Legal', icon: Scale, status: 'active', angle: 0 },
    { name: 'Medical', icon: Stethoscope, status: 'development', angle: 24 },
    { name: 'Dental', icon: Heart, status: 'development', angle: 48 },
    { name: 'Commerce', icon: ShoppingCart, status: 'future', angle: 72 },
    { name: 'Accounting', icon: Calculator, status: 'future', angle: 96 },
    { name: 'Business', icon: Building2, status: 'future', angle: 120 },
    { name: 'Real Estate', icon: Home, status: 'future', angle: 144 },
    { name: 'Insurance', icon: Shield, status: 'future', angle: 168 },
    { name: 'Travel', icon: Plane, status: 'future', angle: 192 },
    { name: 'Education', icon: GraduationCap, status: 'future', angle: 216 },
    { name: 'HR', icon: Users, status: 'future', angle: 240 },
    { name: 'Hospitality', icon: Hotel, status: 'future', angle: 264 },
    { name: 'Logistics', icon: Truck, status: 'future', angle: 288 },
    { name: 'Construction', icon: HardHat, status: 'future', angle: 312 },
    { name: 'Agro', icon: Sprout, status: 'future', angle: 336 }
  ];

  const statusConfig = {
    active: { color: '#00C896', label: 'DISPONIBLE', ring: '#00C896' },
    development: { color: '#D4AF37', label: 'EN DESARROLLO', ring: '#D4AF37' },
    future: { color: 'rgba(255, 255, 255, 0.4)', label: 'VISIÓN FUTURA', ring: 'rgba(255, 255, 255, 0.2)' }
  };

  const selected = verticals[selectedVertical];
  const selectedConfig = statusConfig[selected.status];

  return (
    <section
      id="ecosistema"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Ambient background */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '1000px',
        height: '1000px',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.08) 0%, transparent 60%)',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />

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
              ECOSISTEMA VIVO
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
            Un núcleo.
            <br />
            <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Quince verticales.
            </span>
            <br />
            Una constelación.
          </h2>
        </motion.div>

        {/* Orbital visualization */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Rotating orbit rings */}
          {[350, 300, 250].map((size, i) => (
            <motion.div
              key={size}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 60 + i * 20, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                border: `1px dashed rgba(0, 200, 150, ${0.15 - i * 0.03})`,
                pointerEvents: 'none'
              }}
            />
          ))}

          {/* Main orbit */}
          <div style={{
            position: 'absolute',
            width: '90%',
            maxWidth: '600px',
            aspectRatio: '1',
            borderRadius: '50%',
            border: '1px solid rgba(0, 200, 150, 0.15)'
          }} />

          {/* Central core */}
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="interactive"
            style={{
              position: 'absolute',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, rgba(11, 31, 58, 0.8) 70%)',
              border: '2px solid #00C896',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              boxShadow: '0 0 80px rgba(0, 200, 150, 0.4)',
              cursor: 'pointer'
            }}
          >
            {/* Inner pulse */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: '20px',
                borderRadius: '50%',
                border: '1px solid rgba(0, 200, 150, 0.4)'
              }}
            />

            <div style={{
              fontSize: '3rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontFamily: '"Space Grotesk", sans-serif',
              lineHeight: 1
            }}>
              0
            </div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '0.15em',
              marginTop: '0.5rem'
            }}>
              CORE
            </div>
          </motion.div>

          {/* Orbiting verticals */}
          {verticals.map((vertical, index) => {
            const angleRad = (vertical.angle * Math.PI) / 180;
            const orbitRadius = 260;
            const x = Math.cos(angleRad) * orbitRadius;
            const y = Math.sin(angleRad) * orbitRadius;
            const config = statusConfig[vertical.status];
            const isSelected = selectedVertical === index;

            return (
              <motion.div
                key={vertical.name}
                initial={{ scale: 0, opacity: 0 }}
                animate={isInView ? { 
                  scale: 1, 
                  opacity: 1,
                  x,
                  y
                } : { scale: 0, opacity: 0 }}
                transition={{ 
                  duration: 0.6, 
                  delay: 0.5 + index * 0.05,
                  ease: [0.6, 0.05, 0.01, 0.9]
                }}
                whileHover={{ scale: 1.3, zIndex: 100 }}
                onClick={() => setSelectedVertical(index)}
                className="interactive"
                style={{
                  position: 'absolute',
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: vertical.status === 'active'
                    ? 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
                    : vertical.status === 'development'
                    ? 'rgba(212, 175, 55, 0.15)'
                    : 'rgba(11, 31, 58, 0.8)',
                  border: `2px solid ${config.ring}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isSelected 
                    ? `0 0 30px ${config.color}80` 
                    : vertical.status === 'active' 
                    ? '0 0 20px rgba(0, 200, 150, 0.4)' 
                    : 'none'
                }}
              >
                {vertical.status === 'active' && (
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
                <vertical.icon 
                  size={20} 
                  color={vertical.status === 'active' ? '#FFFFFF' : config.color} 
                />

                {/* Label on hover */}
                <div style={{
                  position: 'absolute',
                  top: '-30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  opacity: isSelected ? 1 : 0,
                  transition: 'opacity 0.3s'
                }}>
                  {vertical.name}
                </div>
              </motion.div>
            );
          })}

          {/* Data flow particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 20 + i * 5,
                repeat: Infinity,
                ease: 'linear'
              }}
              style={{
                position: 'absolute',
                width: '260px',
                height: '260px',
                pointerEvents: 'none'
              }}
            >
              <motion.div
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#00C896',
                  boxShadow: '0 0 10px rgba(0, 200, 150, 0.8)',
                  transform: 'translateX(-50%)'
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Selected vertical info */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedVertical}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            style={{
              maxWidth: '600px',
              margin: '4rem auto 0',
              textAlign: 'center'
            }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              background: `${selectedConfig.color}15`,
              border: `1px solid ${selectedConfig.color}`,
              borderRadius: '100px',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: selectedConfig.color,
              letterSpacing: '0.1em',
              marginBottom: '1rem'
            }}>
              {selectedConfig.label}
            </div>

            <h3 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em'
            }}>
              Punto Cero {selected.name}
            </h3>

            <p style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.6
            }}>
              {selected.status === 'active' 
                ? 'Primera plataforma activa del ecosistema. Impulsada por el core tecnológico compartido.'
                : selected.status === 'development'
                ? 'En construcción. Formará parte del ecosistema tecnológico compartido de Punto Cero System.'
                : 'Visión futura. Cada industria conectada a través de una infraestructura compartida.'}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Instructions */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 2, duration: 0.8 }}
          style={{
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '3rem',
            letterSpacing: '0.05em'
          }}
        >
          Haz click en cualquier vertical para explorar
        </motion.p>
      </div>
    </section>
  );
};

export default OrbitalEcosystem;
