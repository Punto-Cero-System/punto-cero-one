import React, { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';

const HumanImpactSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.1 });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start']
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  const stories = [
    {
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
      caption: 'Cada negocio tiene un punto de partida.',
      subtitle: 'ENTREPRENEUR',
      align: 'left'
    },
    {
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=80',
      caption: 'Cada profesional tiene un sistema por construir.',
      subtitle: 'PROFESSIONAL',
      align: 'right'
    },
    {
      image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop&q=80',
      caption: 'Cada región tiene un futuro por conectar.',
      subtitle: 'ECOSYSTEM',
      align: 'left'
    }
  ];

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 50%, #0B1F3A 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Ambient orbital background */}
      <motion.div
        style={{
          y: y1,
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(0, 200, 150, 0.1)',
          pointerEvents: 'none'
        }}
      />
      <motion.div
        style={{
          y: y2,
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          border: '1px solid rgba(212, 175, 55, 0.1)',
          pointerEvents: 'none'
        }}
      />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Section intro */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{
            textAlign: 'center',
            marginBottom: '8rem',
            maxWidth: '900px',
            margin: '0 auto 8rem'
          }}
        >
          {/* Small circle indicator */}
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#00C896',
              margin: '0 auto 2rem',
              boxShadow: '0 0 20px rgba(0, 200, 150, 0.6)'
            }}
          />

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 300,
            lineHeight: 1.15,
            marginBottom: '1.5rem',
            color: '#FFFFFF',
            letterSpacing: '-0.03em'
          }}>
            La tecnología es la infraestructura.
            <br />
            <span style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Las personas son la razón.
            </span>
          </h2>
        </motion.div>

        {/* Stories - alternating layout */}
        {stories.map((story, index) => (
          <StoryBlock key={index} story={story} index={index} />
        ))}
      </div>
    </section>
  );
};

const StoryBlock = ({ story, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const textY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  const isLeft = story.align === 'left';

  return (
    <div
      ref={ref}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '4rem',
        alignItems: 'center',
        marginBottom: '10rem',
        direction: isLeft ? 'ltr' : 'rtl'
      }}
    >
      {/* Image with circular mask */}
      <motion.div
        style={{
          y: imageY,
          direction: 'ltr',
          position: 'relative'
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.6, 0.05, 0.01, 0.9] }}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            maxWidth: '500px',
            margin: '0 auto',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.5)',
            border: '2px solid rgba(0, 200, 150, 0.2)'
          }}
        >
          <img
            src={story.image}
            alt={story.caption}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'saturate(0.9) contrast(1.05)'
            }}
          />
          
          {/* Overlay gradient */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(11, 31, 58, 0.3) 0%, transparent 50%, rgba(0, 200, 150, 0.15) 100%)'
          }} />

          {/* Orbital ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: '-20px',
              borderRadius: '50%',
              border: '1px dashed rgba(0, 200, 150, 0.3)',
              pointerEvents: 'none'
            }}
          />

          {/* Pulse indicator */}
          <motion.div
            animate={{ 
              scale: [1, 1.4, 1],
              opacity: [0.6, 0.2, 0.6]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              position: 'absolute',
              bottom: '15%',
              right: '15%',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#00C896',
              boxShadow: '0 0 30px rgba(0, 200, 150, 0.8)'
            }}
          />
        </motion.div>
      </motion.div>

      {/* Text */}
      <motion.div
        style={{
          y: textY,
          direction: 'ltr'
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: isLeft ? 30 : -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? 30 : -30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00C896'
              }}
            />
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#00C896',
              letterSpacing: '0.2em',
              fontFamily: '"Space Grotesk", sans-serif'
            }}>
              {story.subtitle}
            </span>
          </div>

          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
            fontWeight: 300,
            lineHeight: 1.2,
            color: '#FFFFFF',
            letterSpacing: '-0.02em'
          }}>
            {story.caption.split('.')[0]}
            <span style={{ color: '#00C896', fontWeight: 700 }}>.</span>
          </h3>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HumanImpactSection;
