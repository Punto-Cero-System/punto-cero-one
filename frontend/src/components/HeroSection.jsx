import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';

const HeroSection = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let nodes = [];
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initNodes();
    };

    const initNodes = () => {
      nodes = [];
      const count = Math.floor((canvas.width * canvas.height) / 30000);
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          radius: Math.random() * 1.5 + 0.5,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    };

    const animate = (time) => {
      ctx.fillStyle = 'rgba(11, 31, 58, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          node.x -= (dx / dist) * force * 1.5;
          node.y -= (dy / dist) * force * 1.5;
        }

        const pulse = Math.sin(time * 0.001 + node.pulsePhase) * 0.2 + 0.8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 200, 150, ${pulse * 0.5})`;
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx2 = node.x - other.x;
          const dy2 = node.y - other.y;
          const distance = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (distance < 130) {
            const opacity = (1 - distance / 130) * 0.25;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 200, 150, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', resize);
    resize();
    animate(0);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />

      {/* Ambient orbital rings */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.06)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: '1400px',
        width: '100%',
        padding: '2rem',
        textAlign: 'center'
      }}>
        {/* Small tag */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1.25rem',
            background: 'rgba(0, 200, 150, 0.08)',
            border: '1px solid rgba(0, 200, 150, 0.25)',
            borderRadius: '100px',
            marginBottom: '3rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#00C896',
            letterSpacing: '0.2em'
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00C896'
            }}
          />
          LATIN AMERICAN TECHNOLOGY PLATFORM
        </motion.div>

        {/* THE BRAND — DOMINANT DISPLAY */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          style={{
            marginBottom: '2rem'
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 30, letterSpacing: '-0.06em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '-0.04em' }}
            transition={{ duration: 1.4, delay: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(3.5rem, 12vw, 10rem)',
              fontWeight: 700,
              lineHeight: 0.9,
              margin: 0,
              color: '#FFFFFF',
              letterSpacing: '-0.04em'
            }}
          >
            PUNTO
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'inline-block'
            }}>
              CERO
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, letterSpacing: '0.2em' }}
            animate={{ opacity: 1, letterSpacing: '0.5em' }}
            transition={{ duration: 1.4, delay: 1.2 }}
            style={{
              fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '1rem',
              fontFamily: '"Space Grotesk", sans-serif'
            }}
          >
            S Y S T E M
          </motion.div>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.4 }}
          style={{
            fontSize: 'clamp(1.05rem, 1.8vw, 1.4rem)',
            lineHeight: 1.65,
            color: 'rgba(255, 255, 255, 0.75)',
            maxWidth: '760px',
            margin: '3rem auto 0',
            fontWeight: 300
          }}
        >
          No es una aplicación. Es una <strong style={{ color: '#FFFFFF', fontWeight: 600 }}>plataforma</strong>.
          Construimos la infraestructura tecnológica que permitirá a miles de{' '}
          <span style={{ color: '#00C896' }}>profesionales</span>,{' '}
          <span style={{ color: '#00C896' }}>emprendedores</span> y{' '}
          <span style={{ color: '#00C896' }}>empresas</span>{' '}
          latinoamericanas crecer juntas.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.6 }}
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '3rem'
          }}
        >
          <motion.a
            href="#vision"
            whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(0, 200, 150, 0.35)' }}
            whileTap={{ scale: 0.98 }}
            className="interactive"
            style={{
              padding: '1rem 2.25rem',
              background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: '100px',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            Explorar la Visión
          </motion.a>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              to="/request-access"
              className="interactive"
              style={{
                padding: '1rem 2.25rem',
                background: 'transparent',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '100px',
                fontSize: '1rem',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'inline-block'
              }}
            >
              Solicitar Acceso al Investor Room
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ 
            opacity: { delay: 2.2 },
            y: { delay: 2.2, duration: 1.8, repeat: Infinity }
          }}
          style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.75rem',
            letterSpacing: '0.2em'
          }}
        >
          <ArrowDown size={16} />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
