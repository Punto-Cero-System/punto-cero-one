import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Handshake, Zap, Globe, Code } from 'lucide-react';

const PartnersSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

  const partnerTypes = [
    {
      icon: Code,
      title: 'Partners Tecnológicos',
      description: 'Integraciones con cloud providers, IA, APIs, y herramientas enterprise.',
      examples: ['Cloud Infrastructure', 'AI Platforms', 'Enterprise APIs']
    },
    {
      icon: Handshake,
      title: 'Partners Estratégicos',
      description: 'Asociaciones con cámaras de comercio, universidades, y asociaciones profesionales.',
      examples: ['Cámaras de Comercio', 'Universidades', 'Asociaciones']
    },
    {
      icon: Globe,
      title: 'Partners Comerciales',
      description: 'Colaboración con firmas profesionales y empresas enterprise en Latinoamérica.',
      examples: ['Firmas Legales', 'Consultoras', 'Corporaciones']
    }
  ];

  return (
    <section
      id="partners"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)'
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
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Construyamos juntos
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              el ecosistema.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Punto Cero System busca partners tecnológicos, estratégicos y comerciales
            para crear el ecosistema tecnológico más grande de Latinoamérica.
          </p>
        </motion.div>

        {/* Partner types */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginBottom: '5rem'
          }}
        >
          {partnerTypes.map((type, index) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.4 + index * 0.15, duration: 0.6 }}
              whileHover={{ y: -10, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.2)' }}
              className="interactive"
              style={{
                padding: '2.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(0, 200, 150, 0.2)',
                borderRadius: '20px',
                backdropFilter: 'blur(12px)'
              }}
            >
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.2) 0%, transparent 100%)',
                border: '2px solid rgba(0, 200, 150, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                <type.icon size={32} color="#00C896" />
              </div>

              <h3 style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                marginBottom: '1rem',
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                {type.title}
              </h3>

              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '1.5rem'
              }}>
                {type.description}
              </p>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {type.examples.map((example) => (
                  <span
                    key={example}
                    style={{
                      padding: '0.4rem 0.9rem',
                      background: 'rgba(0, 200, 150, 0.1)',
                      border: '1px solid rgba(0, 200, 150, 0.2)',
                      borderRadius: '100px',
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}
                  >
                    {example}
                  </span>
                ))}
              </div>
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
            padding: '3rem 2rem',
            background: 'rgba(0, 200, 150, 0.05)',
            border: '1px solid rgba(0, 200, 150, 0.2)',
            borderRadius: '20px'
          }}
        >
          <h3 style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#FFFFFF'
          }}>
            ¿Listo para ser parte del ecosistema?
          </h3>

          <p style={{
            fontSize: '1.1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem'
          }}>
            Conectemos para explorar oportunidades estratégicas de colaboración.
          </p>

          <motion.a
            href="mailto:puntocerosystem@gmail.com?subject=Oportunidad de Partnership"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="interactive"
            style={{
              display: 'inline-block',
              padding: '1.25rem 2.5rem',
              background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 600
            }}
          >
            Iniciar Conversación Estratégica
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default PartnersSection;
