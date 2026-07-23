import React from 'react';
import { motion } from 'framer-motion';

const MarqueeSection = () => {
  const text = 'INFRAESTRUCTURA TECNOLÓGICA • ECOSISTEMA CONECTADO • LATINOAMÉRICA • ';

  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      padding: '4rem 0',
      background: 'rgba(0, 200, 150, 0.05)',
      borderTop: '1px solid rgba(0, 200, 150, 0.2)',
      borderBottom: '1px solid rgba(0, 200, 150, 0.2)'
    }}>
      <motion.div
        animate={{ x: [0, -1000] }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'linear'
        }}
        style={{
          display: 'flex',
          whiteSpace: 'nowrap'
        }}
      >
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FFFFFF 0%, #00C896 50%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              paddingRight: '4rem'
            }}
          >
            {text}
          </div>
        ))}
      </motion.div>
    </section>
  );
};

export default MarqueeSection;
