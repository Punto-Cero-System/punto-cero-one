import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Newspaper, Download, Image as ImageIcon, Video } from 'lucide-react';

const PressSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

  const resources = [
    { icon: Download, title: 'Brand Assets', description: 'Logos, colores, tipografía' },
    { icon: ImageIcon, title: 'Fotografía', description: 'Imágenes corporativas' },
    { icon: Video, title: 'Videos', description: 'Material audiovisual' },
    { icon: Newspaper, title: 'Press Releases', description: 'Comunicados oficiales' }
  ];

  return (
    <section
      id="prensa"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '80vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #0B1F3A 100%)'
      }}
    >
      <div style={{
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <Newspaper size={60} color="#00C896" style={{ marginBottom: '2rem' }} />

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Prensa
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              & Media
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Materiales de prensa, recursos de marca, y contacto para medios.
          </p>
        </motion.div>

        {/* Resources */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2rem',
            marginBottom: '4rem'
          }}
        >
          {resources.map((resource, index) => (
            <motion.div
              key={resource.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.6 }}
              whileHover={{ y: -5 }}
              className="interactive"
              style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                textAlign: 'center'
              }}
            >
              <resource.icon size={40} color="#00C896" style={{ marginBottom: '1rem' }} />
              <h4 style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#FFFFFF',
                marginBottom: '0.5rem'
              }}>
                {resource.title}
              </h4>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                {resource.description}
              </p>
              <div style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.5)'
              }}>
                Próximamente
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact */}
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
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#FFFFFF'
          }}>
            Contacto de Prensa
          </h3>

          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '1.5rem'
          }}>
            Para consultas de medios, entrevistas, o solicitudes de información:
          </p>

          <motion.a
            href="mailto:puntocerosystem@gmail.com?subject=Consulta de Prensa"
            whileHover={{ scale: 1.05 }}
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            puntocerosystem@gmail.com
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default PressSection;
