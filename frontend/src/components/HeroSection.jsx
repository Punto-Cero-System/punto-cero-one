import React, { useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const HeroSection = () => {
  const canvasRef = useRef(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let nodes = [];
    let connections = [];
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initNodes();
    };

    const initNodes = () => {
      nodes = [];
      const nodeCount = Math.floor((canvas.width * canvas.height) / 25000);
      
      // Central core node
      nodes.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: 0,
        vy: 0,
        radius: 8,
        isCore: true,
        pulsePhase: 0
      });

      // Surrounding nodes
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 3 + 1,
          isCore: false,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    };

    const drawNode = (node, time) => {
      ctx.beginPath();
      
      if (node.isCore) {
        // Animated core node
        const pulse = Math.sin(time * 0.002 + node.pulsePhase) * 0.3 + 1;
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * pulse * 2);
        gradient.addColorStop(0, 'rgba(0, 200, 150, 0.8)');
        gradient.addColorStop(0.5, 'rgba(0, 200, 150, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 200, 150, 0)');
        
        ctx.fillStyle = gradient;
        ctx.arc(node.x, node.y, node.radius * pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#00C896';
        ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Regular nodes
        const pulse = Math.sin(time * 0.001 + node.pulsePhase) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.6})`;
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawConnection = (node1, node2, distance, maxDistance) => {
      const opacity = (1 - distance / maxDistance) * 0.3;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 200, 150, ${opacity})`;
      ctx.lineWidth = 1;
      ctx.moveTo(node1.x, node1.y);
      ctx.lineTo(node2.x, node2.y);
      ctx.stroke();
    };

    const animate = (time) => {
      ctx.fillStyle = 'rgba(11, 31, 58, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw nodes
      nodes.forEach((node, i) => {
        if (!node.isCore) {
          // Update position
          node.x += node.vx;
          node.y += node.vy;

          // Bounce off edges
          if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
          if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

          // Mouse interaction
          const dx = mouseX - node.x;
          const dy = mouseY - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const force = (150 - dist) / 150;
            node.x -= (dx / dist) * force * 2;
            node.y -= (dy / dist) * force * 2;
          }
        }

        drawNode(node, time);

        // Draw connections
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = node.isCore || other.isCore ? 300 : 150;

          if (distance < maxDistance) {
            drawConnection(node, other, distance, maxDistance);
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

  const textVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1 + 0.5,
        duration: 0.8,
        ease: [0.6, 0.05, 0.01, 0.9]
      }
    })
  };

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)'
      }}
    >
      {/* Animated background canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <motion.div
          initial="hidden"
          animate="visible"
          style={{ marginBottom: '3rem' }}
        >
          <motion.h1
            custom={0}
            variants={textVariants}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '1.5rem',
              letterSpacing: '-0.02em'
            }}
          >
            <span style={{ color: '#FFFFFF' }}>Todo comienza</span>
            <br />
            <span style={{ 
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              en cero
            </span>
          </motion.h1>

          <motion.p
            custom={1}
            variants={textVariants}
            style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.8)',
              maxWidth: '800px',
              margin: '0 auto 2rem',
              fontWeight: 300
            }}
          >
            Un núcleo tecnológico compartido.
            <br />
            Múltiples plataformas especializadas.
            <br />
            Un ecosistema conectado para Latinoamérica.
          </motion.p>

          <motion.div
            custom={2}
            variants={textVariants}
            style={{
              display: 'flex',
              gap: '1.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '3rem'
            }}
          >
            <motion.a
              href="#ecosistema"
              whileHover={{ scale: 1.05, boxShadow: '0 10px 40px rgba(0, 200, 150, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              className="interactive"
              style={{
                padding: '1rem 2.5rem',
                background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              Explorar Ecosistema
            </motion.a>

            <motion.a
              href="#contacto"
              whileHover={{ 
                scale: 1.05,
                background: 'rgba(0, 200, 150, 0.1)',
                borderColor: '#00C896'
              }}
              whileTap={{ scale: 0.98 }}
              className="interactive"
              style={{
                padding: '1rem 2.5rem',
                background: 'transparent',
                color: '#FFFFFF',
                textDecoration: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: 600,
                border: '2px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              Conectar
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ 
            opacity: { delay: 2 },
            y: { delay: 2, duration: 1.5, repeat: Infinity }
          }}
          style={{
            position: 'absolute',
            bottom: '3rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.9rem'
          }}
        >
          <span>Descubre más</span>
          <div style={{
            width: 2,
            height: 40,
            background: 'linear-gradient(180deg, rgba(0, 200, 150, 0.8) 0%, transparent 100%)'
          }} />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
