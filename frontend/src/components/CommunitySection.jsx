import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Users, Briefcase, GraduationCap, Heart } from 'lucide-react';

const CommunitySection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

  return (
    <section
      id="comunidad"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '80vh',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)'
      }}
    >
      <div style={{
        maxWidth: '1000px',
        width: '100%',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
        >
          <Users size={60} color="#00C896" style={{ marginBottom: '2rem' }} />

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Comunidad
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Punto Cero
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '800px',
            margin: '0 auto 3rem'
          }}>
            Estamos construyendo una comunidad de profesionales, emprendedores,
            desarrolladores y empresas que crecerán juntas a través de tecnología.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{
              padding: '3rem',
              background: 'rgba(0, 200, 150, 0.05)',
              border: '1px solid rgba(0, 200, 150, 0.2)',
              borderRadius: '24px',
              marginBottom: '3rem'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2rem',
              marginBottom: '2rem'
            }}>
              {[
                { icon: Briefcase, label: 'Profesionales' },
                { icon: GraduationCap, label: 'Estudiantes' },
                { icon: Users, label: 'Emprendedores' },
                { icon: Heart, label: 'Partners' }
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                  style={{ textAlign: 'center' }}
                >
                  <item.icon size={32} color="#00C896" style={{ marginBottom: '1rem' }} />
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#FFFFFF'
                  }}>
                    {item.label}
                  </div>
                </motion.div>
              ))}
            </div>

            <p style={{
              fontSize: '1.1rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontStyle: 'italic'
            }}>
              Próximamente: Webinars • Eventos • Training • Networking
            </p>
          </motion.div>

          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            Mantente conectado a través de nuestras redes sociales para actualizaciones.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunitySection;
