import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const stories = [
  {
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=900&auto=format&fit=crop&q=80',
    caption: 'Profesionales que impulsan sus firmas',
    tag: 'PROFESIONALES',
    align: 'left'
  },
  {
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900&auto=format&fit=crop&q=80',
    caption: 'Emprendedores que construyen desde cero',
    tag: 'EMPRENDEDORES',
    align: 'right'
  },
  {
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80',
    caption: 'Equipos que colaboran con tecnología',
    tag: 'EQUIPOS',
    align: 'left'
  },
  {
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&auto=format&fit=crop&q=80',
    caption: 'Empresas que crecen conectadas',
    tag: 'EMPRESAS',
    align: 'right'
  }
];

const StoryRow = ({ story, isLeft, index }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });

  return (
    <div
      ref={ref}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '4rem',
        alignItems: 'center',
        marginBottom: '6rem',
        direction: isLeft ? 'ltr' : 'rtl'
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 1, ease: [0.6, 0.05, 0.01, 0.9] }}
        style={{
          direction: 'ltr',
          position: 'relative',
          aspectRatio: '4/5',
          maxWidth: '500px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.15)'
        }}>
          <img
            src={story.image}
            alt={story.caption}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 60%, rgba(11, 31, 58, 0.4) 100%)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '1.5rem',
            padding: '0.4rem 0.9rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '100px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#0B1F3A',
            letterSpacing: '0.2em'
          }}>
            {story.tag}
          </div>
        </div>

        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: index * 0.5 }}
          style={{
            position: 'absolute',
            [isLeft ? 'right' : 'left']: '-30px',
            top: '20px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#00C896',
            opacity: 0.15,
            filter: 'blur(20px)'
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: isLeft ? 30 : -30 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? 30 : -30 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        style={{ direction: 'ltr' }}
      >
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#00C896',
          letterSpacing: '0.25em',
          marginBottom: '1rem'
        }}>
          0{index + 1} / 04
        </div>
        <h3 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
          fontWeight: 300,
          lineHeight: 1.15,
          color: '#1E1E1E',
          letterSpacing: '-0.03em'
        }}>
          {story.caption}
          <span style={{ color: '#00C896', fontWeight: 700 }}>.</span>
        </h3>
      </motion.div>
    </div>
  );
};

const PeopleSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.1 });

  return (
    <section
      id="comunidad"
      ref={sectionRef}
      style={{
        position: 'relative',
        padding: '8rem 2rem',
        background: '#F5F7FA',
        color: '#1E1E1E',
        overflow: 'hidden'
      }}
    >
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            marginBottom: '6rem',
            maxWidth: '900px'
          }}
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
              style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00C896' }}
            />
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.25em'
            }}>
              COMUNIDAD & PROPÓSITO
            </span>
          </div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 300,
            lineHeight: 1.1,
            marginBottom: '2rem',
            color: '#1E1E1E',
            letterSpacing: '-0.03em'
          }}>
            La tecnología es la infraestructura.
            <br />
            <span style={{ fontWeight: 700, color: '#0B1F3A' }}>
              Las personas son el propósito.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            lineHeight: 1.7,
            color: 'rgba(30, 30, 30, 0.65)',
            fontWeight: 300,
            maxWidth: '640px'
          }}>
            Punto Cero System construye infraestructura para que profesionales,
            emprendedores y empresas latinoamericanas crezcan juntas.
          </p>
        </motion.div>

        {stories.map((story, index) => (
          <StoryRow key={index} story={story} isLeft={story.align === 'left'} index={index} />
        ))}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            marginTop: '6rem',
            padding: '4rem 3rem',
            background: '#FFFFFF',
            borderRadius: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 80px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 300,
            lineHeight: 1.4,
            color: '#1E1E1E',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: '"Space Grotesk", sans-serif',
            letterSpacing: '-0.02em'
          }}>
            Estamos construyendo el{' '}
            <span style={{ fontWeight: 700, color: '#00C896' }}>ecosistema tecnológico</span>{' '}
            que conectará a profesionales, emprendedores y empresas en{' '}
            <span style={{ fontWeight: 700, color: '#0B1F3A' }}>18 países latinoamericanos</span>.
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PeopleSection;
