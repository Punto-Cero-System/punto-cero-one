import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ManifestoSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const manifestoItems = [
    {
      number: '01',
      title: 'Pensar desde cero',
      description: 'No copiamos modelos existentes. Diseñamos infraestructura tecnológica pensando primero en las necesidades reales de Latinoamérica.',
      color: '#00C896'
    },
    {
      number: '02',
      title: 'Construir para escalar',
      description: 'Cada línea de código está diseñada para crecer. Arquitectura modular, APIs robustas, integraciones nativas. Escalabilidad desde el día uno.',
      color: '#00C896'
    },
    {
      number: '03',
      title: 'Conectar ecosistemas',
      description: 'Plataformas aisladas son cosa del pasado. Construimos sistemas que se comunican entre sí, creando un ecosistema tecnológico integrado y sin fricción.',
      color: '#00C896'
    },
    {
      number: '04',
      title: 'Innovar con propósito',
      description: 'La tecnología no es un fin, es un medio. Cada innovación debe resolver problemas reales y crear valor tangible para empresas e instituciones.',
      color: '#D4AF37'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.8,
        ease: [0.6, 0.05, 0.01, 0.9]
      }
    }
  };

  return (
    <section
      id="vision"
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
          style={{ marginBottom: '5rem' }}
        >
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Cómo pensamos.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Cómo construimos.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px'
          }}>
            Estos son los principios que guían cada decisión tecnológica,
            cada línea de código, cada plataforma que creamos.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3rem'
          }}
        >
          {manifestoItems.map((item, index) => (
            <motion.div
              key={item.number}
              variants={itemVariants}
              whileHover={{ x: 10 }}
              className="interactive"
              style={{
                position: 'relative',
                display: 'flex',
                gap: '2rem',
                alignItems: 'flex-start',
                padding: '2.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                backdropFilter: 'blur(12px)',
                overflow: 'hidden'
              }}
            >
              {/* Number */}
              <div style={{
                minWidth: '100px',
                height: '100px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${item.color}20 0%, transparent 100%)`,
                border: `2px solid ${item.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '2rem',
                fontWeight: 700,
                color: item.color
              }}>
                {item.number}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  color: '#FFFFFF'
                }}>
                  {item.title}
                </h3>

                <p style={{
                  fontSize: 'clamp(1rem, 2vw, 1.1rem)',
                  lineHeight: 1.8,
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  {item.description}
                </p>
              </div>

              {/* Arrow indicator */}
              <motion.div
                animate={{ x: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  alignSelf: 'center',
                  color: item.color,
                  opacity: 0.5
                }}
              >
                <ArrowRight size={24} />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ManifestoSection;
