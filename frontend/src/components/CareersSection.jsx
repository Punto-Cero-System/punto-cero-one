import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Rocket, Code, Palette, TrendingUp, Users, Briefcase } from 'lucide-react';

const CareersSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.2 });

  const roles = [
    { icon: Code, title: 'Ingenieros de Software', areas: ['Backend', 'Frontend', 'Full Stack', 'DevOps'] },
    { icon: Palette, title: 'Diseñadores', areas: ['UI/UX', 'Product Design', 'Brand Design'] },
    { icon: TrendingUp, title: 'Business Development', areas: ['Sales', 'Partnerships', 'Growth'] },
    { icon: Users, title: 'Product & AI', areas: ['Product Managers', 'AI Specialists', 'Data Science'] },
    { icon: Briefcase, title: 'Profesionales', areas: ['Legal', 'Finance', 'Operations'] },
    { icon: Rocket, title: 'Estrategia', areas: ['Marketing', 'Content', 'Community'] }
  ];

  const values = [
    'Construir desde cero',
    'Pensar en grande',
    'Escalar rápido',
    'Impactar Latinoamérica'
  ];

  return (
    <section
      id="carreras"
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
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem',
            color: '#FFFFFF'
          }}>
            Construye
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              la infraestructura tecnológica
            </span>
            <br />
            de Latinoamérica.
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto'
          }}>
            Únete al equipo que está construyendo el ecosistema tecnológico
            que conectará a miles de profesionales y empresas en 18 países.
          </p>
        </motion.div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap',
            marginBottom: '5rem'
          }}
        >
          {values.map((value, index) => (
            <motion.div
              key={value}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
              style={{
                padding: '1rem 2rem',
                background: 'rgba(0, 200, 150, 0.1)',
                border: '1px solid rgba(0, 200, 150, 0.3)',
                borderRadius: '100px',
                fontSize: '1rem',
                fontWeight: 600,
                color: '#00C896'
              }}
            >
              {value}
            </motion.div>
          ))}
        </motion.div>

        {/* Roles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            marginBottom: '5rem'
          }}
        >
          {roles.map((role, index) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.6 }}
              whileHover={{ y: -5, boxShadow: '0 15px 40px rgba(0, 200, 150, 0.2)' }}
              className="interactive"
              style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px'
              }}
            >
              <role.icon size={36} color="#00C896" style={{ marginBottom: '1rem' }} />
              <h4 style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1rem'
              }}>
                {role.title}
              </h4>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {role.areas.map((area) => (
                  <span
                    key={area}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}
                  >
                    {area}
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
          transition={{ delay: 1, duration: 0.8 }}
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.05) 0%, rgba(212, 175, 55, 0.05) 100%)',
            border: '1px solid rgba(0, 200, 150, 0.2)',
            borderRadius: '24px'
          }}
        >
          <Rocket size={50} color="#00C896" style={{ marginBottom: '1.5rem' }} />
          
          <h3 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            marginBottom: '1rem',
            color: '#FFFFFF'
          }}>
            ¿Listo para construir el futuro?
          </h3>

          <p style={{
            fontSize: '1.1rem',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2.5rem',
            maxWidth: '700px',
            margin: '0 auto 2.5rem'
          }}>
            Estamos construyendo el equipo que transformará la tecnología en Latinoamérica.
            Envía tu CV y cuéntanos por qué quieres ser parte de Punto Cero System.
          </p>

          <motion.a
            href="mailto:puntocerosystem@gmail.com?subject=Aplicación - Carreras en Punto Cero System"
            whileHover={{ scale: 1.05, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)' }}
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
            Únete al Equipo
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default CareersSection;
