import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Brain, Database, Lock, Zap, FileText, Users, BarChart, CreditCard } from 'lucide-react';

const CoreSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

  const capabilities = [
    { icon: Brain, label: 'IA', color: '#00C896' },
    { icon: Database, label: 'DATA', color: '#00C896' },
    { icon: Lock, label: 'SECURITY', color: '#00C896' },
    { icon: Zap, label: 'AUTOMATION', color: '#00C896' },
    { icon: FileText, label: 'DOCUMENTS', color: '#00C896' },
    { icon: Users, label: 'CRM', color: '#00C896' },
    { icon: BarChart, label: 'ANALYTICS', color: '#00C896' },
    { icon: CreditCard, label: 'BILLING', color: '#00C896' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.6, 0.05, 0.01, 0.9]
      }
    }
  };

  return (
    <section
      id="core"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)'
      }}
    >
      <div style={{
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <motion.div
            animate={isInView ? {
              scale: [1, 1.02, 1],
              opacity: [0.5, 1, 0.5]
            } : {}}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              display: 'inline-block',
              padding: '0.5rem 1.5rem',
              background: 'rgba(0, 200, 150, 0.1)',
              border: '1px solid rgba(0, 200, 150, 0.3)',
              borderRadius: '100px',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#00C896',
              letterSpacing: '0.1em'
            }}
          >
            PUNTO CERO CORE
          </motion.div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Un núcleo.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Infinitas posibilidades.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Una infraestructura tecnológica compartida que impulsa
            múltiples verticales especializadas. Escalable, segura, inteligente.
          </p>
        </motion.div>

        {/* Core visualization */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          style={{
            position: 'relative',
            maxWidth: '900px',
            margin: '0 auto',
            height: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Central core */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.1 }}
            className="interactive"
            style={{
              position: 'absolute',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0, 200, 150, 0.2) 0%, transparent 70%)',
              border: '2px solid #00C896',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              boxShadow: '0 0 60px rgba(0, 200, 150, 0.4)'
            }}
          >
            <div style={{
              textAlign: 'center',
              fontFamily: '"Space Grotesk", sans-serif'
            }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem'
              }}>
                0
              </div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#FFFFFF'
              }}>
                CORE
              </div>
            </div>
          </motion.div>

          {/* Capability nodes */}
          {capabilities.map((cap, index) => {
            const angle = (index / capabilities.length) * Math.PI * 2 - Math.PI / 2;
            const radius = 280;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <React.Fragment key={cap.label}>
                {/* Connection line */}
                <motion.div
                  variants={itemVariants}
                  style={{
                    position: 'absolute',
                    width: '2px',
                    height: `${radius}px`,
                    background: `linear-gradient(180deg, ${cap.color} 0%, transparent 100%)`,
                    transformOrigin: 'top center',
                    transform: `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`,
                    left: '50%',
                    top: '50%',
                    opacity: 0.3
                  }}
                />

                {/* Capability node */}
                <motion.div
                  variants={itemVariants}
                  whileHover={{ 
                    scale: 1.2,
                    boxShadow: `0 0 40px ${cap.color}80`
                  }}
                  className="interactive"
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'rgba(11, 31, 58, 0.9)',
                    border: `2px solid ${cap.color}40`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    backdropFilter: 'blur(12px)',
                    cursor: 'pointer'
                  }}
                >
                  <cap.icon size={28} color={cap.color} />
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    textAlign: 'center'
                  }}>
                    {cap.label}
                  </span>
                </motion.div>
              </React.Fragment>
            );
          })}
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginTop: '6rem'
          }}
        >
          {[
            {
              title: 'Arquitectura Compartida',
              description: 'Un solo core tecnológico alimenta múltiples plataformas verticales, reduciendo costos y maximizando eficiencia.'
            },
            {
              title: 'Escalabilidad Inteligente',
              description: 'Diseñado desde cero para crecer. La infraestructura se adapta automáticamente a las necesidades del ecosistema.'
            },
            {
              title: 'Integración Total',
              description: 'Todas las plataformas se comunican entre sí, creando un ecosistema conectado y sin fricción.'
            }
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.2)' }}
              className="interactive"
              style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                backdropFilter: 'blur(12px)'
              }}
            >
              <h3 style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CoreSection;
