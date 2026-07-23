import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, Target, Rocket, Shield, ArrowRight } from 'lucide-react';

const InvestorsSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const highlights = [
    {
      icon: Target,
      title: 'Visión de Plataforma',
      description: 'No es una aplicación. Es infraestructura tecnológica para múltiples verticales industriales.'
    },
    {
      icon: Rocket,
      title: 'Expansión Multi-País',
      description: 'Diseñado desde cero para operar en 18 países latinoamericanos con diferentes monedas y regulaciones.'
    },
    {
      icon: TrendingUp,
      title: 'Primer Vertical Activo',
      description: 'Punto Cero Legal ya opera como la primera expresión comercial del ecosistema tecnológico.'
    },
    {
      icon: Shield,
      title: 'Arquitectura Compartida',
      description: 'Un core tecnológico alimenta múltiples verticales, maximizando eficiencia y reduciendo costos.'
    }
  ];

  return (
    <section
      id="inversionistas"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)'
      }}
    >
      <div style={{
        maxWidth: '1200px',
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
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '100px',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#D4AF37',
              letterSpacing: '0.1em'
            }}
          >
            INVERSIONISTAS
          </motion.div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            No es una aplicación.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #00C896 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Es una plataforma.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            Punto Cero System construye la infraestructura tecnológica que permitirá
            a miles de profesionales y empresas latinoamericanas crecer juntas.
          </p>
        </motion.div>

        {/* Highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            marginBottom: '5rem'
          }}
        >
          {highlights.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.6 }}
              whileHover={{ y: -10, boxShadow: '0 20px 60px rgba(212, 175, 55, 0.2)' }}
              className="interactive"
              style={{
                padding: '2.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '20px',
                backdropFilter: 'blur(12px)'
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, transparent 100%)',
                border: '2px solid rgba(212, 175, 55, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                <item.icon size={28} color="#D4AF37" />
              </div>

              <h3 style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#FFFFFF',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                {item.title}
              </h3>

              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                {item.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(0, 200, 150, 0.05) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '24px',
            backdropFilter: 'blur(12px)'
          }}
        >
          <h3 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#FFFFFF',
            fontFamily: '"Space Grotesk", sans-serif'
          }}>
            Construye el futuro de la tecnología en Latinoamérica
          </h3>

          <p style={{
            fontSize: '1.1rem',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2.5rem',
            maxWidth: '700px',
            margin: '0 auto 2.5rem'
          }}>
            Estamos preparando el Investor Room con materiales estratégicos, 
            roadmap de producto, y documentación corporativa.
          </p>

          <motion.a
            href="mailto:puntocerosystem@gmail.com?subject=Solicitud de Acceso - Investor Room"
            whileHover={{ 
              scale: 1.05,
              boxShadow: '0 20px 60px rgba(212, 175, 55, 0.4)'
            }}
            whileTap={{ scale: 0.98 }}
            className="interactive"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.25rem 2.5rem',
              background: 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Solicitar Acceso al Investor Room
            <ArrowRight size={20} />
          </motion.a>

          <p style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '1.5rem'
          }}>
            Conversaciones estratégicas preparadas. No aggressive pitches.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default InvestorsSection;
