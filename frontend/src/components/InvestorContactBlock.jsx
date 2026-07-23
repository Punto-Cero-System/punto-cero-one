import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Mail, MessageCircle, ArrowRight, Instagram, Music, Youtube, Share2, Facebook, Lock } from 'lucide-react';

const InvestorContactBlock = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.15 });

  const socialLinks = [
    { name: 'Instagram', url: 'https://www.instagram.com/puntocerosystem/', icon: Instagram },
    { name: 'TikTok', url: 'https://www.tiktok.com/@puntocerosystem', icon: Music },
    { name: 'YouTube', url: 'https://www.youtube.com/@puntocerosystem', icon: Youtube },
    { name: 'Pinterest', url: 'https://co.pinterest.com/puntocerosystem', icon: Share2 },
    { name: 'Facebook', url: 'https://www.facebook.com/Punto7Cero7', icon: Facebook }
  ];

  const handleWhatsApp = () => {
    const message = encodeURIComponent('Hola, quiero conocer más sobre Punto Cero System y su ecosistema tecnológico.');
    window.open(`https://wa.me/573025717944?text=${message}`, '_blank');
  };

  return (
    <section
      id="contacto"
      ref={sectionRef}
      style={{
        position: 'relative',
        padding: '8rem 2rem',
        background: 'linear-gradient(180deg, #0a1a2e 0%, #071527 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Ambient background */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '1000px',
          height: '1000px',
          borderRadius: '50%',
          border: '1px dashed rgba(0, 200, 150, 0.06)',
          pointerEvents: 'none'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.1) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
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
              style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37' }}
            />
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#D4AF37',
              letterSpacing: '0.25em'
            }}>
              PRÓXIMA CONVERSACIÓN
            </span>
          </div>

          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 300,
            lineHeight: 1.05,
            marginBottom: '1.5rem',
            color: '#FFFFFF',
            letterSpacing: '-0.03em'
          }}>
            Todo comienza
            <br />
            <span style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              en cero.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.65)',
            maxWidth: '640px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            Alianzas estratégicas, conversaciones tecnológicas, exploración del ecosistema.
          </p>
        </motion.div>

        {/* Investor Room Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            position: 'relative',
            padding: '4rem 3rem',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(0, 200, 150, 0.05) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            borderRadius: '32px',
            backdropFilter: 'blur(12px)',
            marginBottom: '4rem',
            overflow: 'hidden'
          }}
        >
          {/* Corner accent */}
          <div style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '3rem',
            alignItems: 'center',
            position: 'relative'
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.9rem',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '100px',
                marginBottom: '1.5rem'
              }}>
                <Lock size={12} color="#D4AF37" />
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#D4AF37',
                  letterSpacing: '0.15em'
                }}>
                  ACCESO PRIVADO
                </span>
              </div>

              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 700,
                color: '#FFFFFF',
                marginBottom: '1rem',
                lineHeight: 1.2,
                letterSpacing: '-0.02em'
              }}>
                Investor Room
              </h3>

              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'rgba(255, 255, 255, 0.65)',
                fontWeight: 300
              }}>
                Materiales estratégicos, roadmap de producto, documentación corporativa
                y conversaciones preparadas.
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <motion.a
                href="mailto:puntocerosystem@gmail.com?subject=Solicitud de Acceso - Investor Room"
                whileHover={{ scale: 1.05, boxShadow: '0 20px 60px rgba(212, 175, 55, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                className="interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.15rem 2rem',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
                  color: '#0B1F3A',
                  textDecoration: 'none',
                  borderRadius: '100px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em'
                }}
              >
                Solicitar Acceso
                <ArrowRight size={18} />
              </motion.a>
              <p style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.4)',
                marginTop: '1rem'
              }}>
                Conversaciones estratégicas preparadas
              </p>
            </div>
          </div>
        </motion.div>

        {/* Direct contact channels */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '4rem'
          }}
        >
          <motion.button
            onClick={handleWhatsApp}
            whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(0, 200, 150, 0.35)' }}
            whileTap={{ scale: 0.98 }}
            className="interactive"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '2rem',
              background: 'linear-gradient(135deg, rgba(0, 200, 150, 0.1) 0%, rgba(0, 200, 150, 0.02) 100%)',
              border: '1px solid rgba(0, 200, 150, 0.3)',
              borderRadius: '20px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: '#FFFFFF'
            }}
          >
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 10px 30px rgba(0, 200, 150, 0.4)'
            }}>
              <MessageCircle size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#00C896', letterSpacing: '0.15em', marginBottom: '0.3rem', fontWeight: 700 }}>
                WHATSAPP DIRECTO
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF' }}>
                +57 302 571 7944
              </div>
            </div>
          </motion.button>

          <motion.a
            href="mailto:puntocerosystem@gmail.com"
            whileHover={{ y: -5, boxShadow: '0 20px 60px rgba(255, 255, 255, 0.1)' }}
            whileTap={{ scale: 0.98 }}
            className="interactive"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '2rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              textDecoration: 'none',
              color: '#FFFFFF'
            }}
          >
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Mail size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)', letterSpacing: '0.15em', marginBottom: '0.3rem', fontWeight: 700 }}>
                EMAIL CORPORATIVO
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF' }}>
                puntocerosystem@gmail.com
              </div>
            </div>
          </motion.a>
        </motion.div>

        {/* Social media */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '0.25em',
            marginBottom: '1.5rem'
          }}>
            SÍGUENOS
          </div>
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {socialLinks.map((social, i) => (
              <motion.a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.15, borderColor: '#00C896', color: '#00C896' }}
                className="interactive"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.7)',
                  textDecoration: 'none'
                }}
                aria-label={social.name}
              >
                <social.icon size={18} />
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default InvestorContactBlock;
