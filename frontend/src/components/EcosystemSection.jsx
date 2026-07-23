import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Scale, CheckCircle, Clock, Lightbulb } from 'lucide-react';

const EcosystemSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const verticals = [
    {
      name: 'Punto Cero Legal',
      description: 'Plataforma integral para la gestión legal y jurídica de empresas. Automatización de procesos, seguimiento de casos, y gestión documental inteligente.',
      status: 'DISPONIBLE',
      icon: Scale,
      color: '#00C896',
      gradient: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)'
    },
    {
      name: 'Punto Cero Salud',
      description: 'Ecosistema de gestión clínica y administrativa para instituciones de salud. Historia clínica digital, telemedicina, y analytics de salud.',
      status: 'EN DESARROLLO',
      icon: CheckCircle,
      color: 'rgba(0, 200, 150, 0.6)',
      gradient: 'linear-gradient(135deg, rgba(0, 200, 150, 0.3) 0%, rgba(0, 160, 119, 0.3) 100%)'
    },
    {
      name: 'Punto Cero Edu',
      description: 'Plataforma educativa avanzada con IA adaptativa, gestión académica, y herramientas de aprendizaje personalizado para instituciones educativas.',
      status: 'EN DESARROLLO',
      icon: Lightbulb,
      color: 'rgba(0, 200, 150, 0.6)',
      gradient: 'linear-gradient(135deg, rgba(0, 200, 150, 0.3) 0%, rgba(0, 160, 119, 0.3) 100%)'
    },
    {
      name: 'Punto Cero Finance',
      description: 'Infraestructura financiera para empresas latinoamericanas. Contabilidad inteligente, análisis predictivo, y automatización de procesos financieros.',
      status: 'VISIÓN FUTURA',
      icon: Clock,
      color: 'rgba(212, 175, 55, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(180, 140, 30, 0.2) 100%)'
    },
    {
      name: 'Punto Cero Logistics',
      description: 'Gestión logística integral con tracking en tiempo real, optimización de rutas con IA, y control de inventario para operaciones latinoamericanas.',
      status: 'VISIÓN FUTURA',
      icon: Clock,
      color: 'rgba(212, 175, 55, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(180, 140, 30, 0.2) 100%)'
    },
    {
      name: 'Punto Cero Commerce',
      description: 'Plataforma de comercio electrónico enterprise con IA, gestión omnicanal, pagos integrados, y analytics avanzados para el mercado latinoamericano.',
      status: 'VISIÓN FUTURA',
      icon: Clock,
      color: 'rgba(212, 175, 55, 0.5)',
      gradient: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(180, 140, 30, 0.2) 100%)'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.6, 0.05, 0.01, 0.9]
      }
    }
  };

  return (
    <section
      id="ecosistema"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)'
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
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Un ecosistema.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Múltiples verticales.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            Plataformas especializadas construidas sobre un núcleo tecnológico compartido.
            <br />
            Cada vertical está diseñada para transformar industrias específicas en Latinoamérica.
          </p>
        </motion.div>

        {/* Vertical cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '2rem'
          }}
        >
          {verticals.map((vertical, index) => (
            <motion.div
              key={vertical.name}
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                boxShadow: vertical.status === 'DISPONIBLE' 
                  ? '0 20px 60px rgba(0, 200, 150, 0.3)'
                  : '0 20px 60px rgba(255, 255, 255, 0.1)'
              }}
              className="interactive"
              style={{
                position: 'relative',
                padding: '2.5rem',
                background: vertical.status === 'DISPONIBLE'
                  ? 'rgba(0, 200, 150, 0.05)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: vertical.status === 'DISPONIBLE'
                  ? '2px solid rgba(0, 200, 150, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                backdropFilter: 'blur(12px)',
                overflow: 'hidden'
              }}
            >
              {/* Status badge */}
              <div style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                padding: '0.4rem 0.9rem',
                background: vertical.status === 'DISPONIBLE'
                  ? 'rgba(0, 200, 150, 0.2)'
                  : vertical.status === 'EN DESARROLLO'
                  ? 'rgba(212, 175, 55, 0.2)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${vertical.color}`,
                borderRadius: '100px',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: vertical.color,
                letterSpacing: '0.05em'
              }}>
                {vertical.status}
              </div>

              {/* Icon */}
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '16px',
                background: vertical.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                border: `1px solid ${vertical.color}`
              }}>
                <vertical.icon size={32} color={vertical.status === 'DISPONIBLE' ? '#FFFFFF' : vertical.color} />
              </div>

              {/* Content */}
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#FFFFFF'
              }}>
                {vertical.name}
              </h3>

              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '1.5rem'
              }}>
                {vertical.description}
              </p>

              {/* CTA */}
              {vertical.status === 'DISPONIBLE' && (
                <motion.a
                  href="#contacto"
                  whileHover={{ x: 5 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#00C896',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.95rem'
                  }}
                >
                  Explorar plataforma
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </motion.a>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom message */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 1, duration: 0.8 }}
          style={{
            marginTop: '5rem',
            textAlign: 'center',
            padding: '3rem',
            background: 'rgba(0, 200, 150, 0.05)',
            border: '1px solid rgba(0, 200, 150, 0.2)',
            borderRadius: '20px',
            backdropFilter: 'blur(12px)'
          }}
        >
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.3rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.9)',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            <span style={{ color: '#00C896', fontWeight: 600 }}>Una base tecnológica.</span>
            {' '}Múltiples industrias especializadas.
            {' '}<span style={{ color: '#D4AF37', fontWeight: 600 }}>Un solo ecosistema conectado.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default EcosystemSection;
