import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

const ZeroMoment = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.5 });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (isInView) {
      const phases = [0, 1, 2, 3];
      let currentPhaseIndex = 0;

      const interval = setInterval(() => {
        currentPhaseIndex = (currentPhaseIndex + 1) % phases.length;
        setPhase(phases[currentPhaseIndex]);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isInView]);

  const messages = [
    'Un punto',
    'Un núcleo',
    'Múltiples sistemas',
    'Un ecosistema'
  ];

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B1F3A',
        overflow: 'hidden'
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '2rem'
      }}>
        {/* Central zero animation */}
        <div style={{
          position: 'relative',
          width: '400px',
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Phase 0: Single point */}
          {phase === 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#00C896',
                boxShadow: '0 0 60px rgba(0, 200, 150, 0.8)'
              }}
            />
          )}

          {/* Phase 1: Expanding to core */}
          {phase === 1 && (
            <motion.div
              initial={{ scale: 0.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              style={{
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                border: '3px solid #00C896',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.2) 0%, transparent 70%)',
                boxShadow: '0 0 80px rgba(0, 200, 150, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif'
              }}>
                0
              </span>
            </motion.div>
          )}

          {/* Phase 2: Core with nodes */}
          {phase === 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'relative',
                width: '300px',
                height: '300px'
              }}
            >
              {/* Central core */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: '2px solid #00C896',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.3) 0%, transparent 70%)',
                boxShadow: '0 0 60px rgba(0, 200, 150, 0.5)'
              }} />

              {/* Surrounding nodes */}
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = (i / 6) * Math.PI * 2;
                const radius = 120;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{ scale: 1, x, y }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(0, 200, 150, 0.5)',
                      border: '2px solid #00C896',
                      boxShadow: '0 0 20px rgba(0, 200, 150, 0.5)'
                    }}
                  />
                );
              })}
            </motion.div>
          )}

          {/* Phase 3: Full ecosystem */}
          {phase === 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'relative',
                width: '400px',
                height: '400px'
              }}
            >
              {/* Network visualization */}
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const radius = 150;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                  <React.Fragment key={i}>
                    {/* Connection line */}
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '2px',
                        height: `${radius}px`,
                        background: 'linear-gradient(180deg, rgba(0, 200, 150, 0.5) 0%, transparent 100%)',
                        transformOrigin: 'top center',
                        transform: `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`
                      }}
                    />

                    {/* Node */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.05 + 0.2, duration: 0.3 }}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: 'rgba(0, 200, 150, 0.3)',
                        border: '2px solid #00C896',
                        boxShadow: '0 0 20px rgba(0, 200, 150, 0.4)'
                      }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Central core */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '3px solid #00C896',
                background: 'radial-gradient(circle, rgba(0, 200, 150, 0.4) 0%, transparent 70%)',
                boxShadow: '0 0 60px rgba(0, 200, 150, 0.6)'
              }} />
            </motion.div>
          )}
        </div>

        {/* Message */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          style={{
            marginTop: '4rem',
            textAlign: 'center'
          }}
        >
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #00C896 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {messages[phase]}
          </h2>
        </motion.div>
      </div>
    </section>
  );
};

export default ZeroMoment;
