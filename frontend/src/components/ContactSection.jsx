import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Mail, MessageCircle, Instagram, Music, Youtube, Share2, Facebook } from 'lucide-react';

const ContactSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: false, amount: 0.3 });

  const socialLinks = [
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/puntocerosystem/',
      icon: Instagram,
      color: '#E4405F'
    },
    {
      name: 'TikTok',
      url: 'https://www.tiktok.com/@puntocerosystem',
      icon: Music,
      color: '#00f2ea'
    },
    {
      name: 'YouTube',
      url: 'https://www.youtube.com/@puntocerosystem',
      icon: Youtube,
      color: '#FF0000'
    },
    {
      name: 'Pinterest',
      url: 'https://co.pinterest.com/puntocerosystem',
      icon: Share2,
      color: '#E60023'
    },
    {
      name: 'Facebook',
      url: 'https://www.facebook.com/Punto7Cero7',
      icon: Facebook,
      color: '#1877F2'
    }
  ];

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent('Hola, quiero conocer más sobre Punto Cero System y su ecosistema tecnológico.');
    window.open(`https://wa.me/573025717944?text=${message}`, '_blank');
  };

  return (
    <section
      id="contacto"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6rem 2rem',
        background: 'linear-gradient(180deg, #0B1F3A 0%, #0a1a2e 100%)',
        overflow: 'hidden'
      }}
    >
      {/* Background glow effect */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(0, 200, 150, 0.15) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
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
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '1.5rem'
          }}>
            <span style={{ color: '#FFFFFF' }}>Todo comienza</span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              en cero.
            </span>
          </h2>

          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
            lineHeight: 1.8,
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '700px',
            margin: '0 auto 3rem'
          }}>
            Construyamos el futuro juntos. Alianzas estratégicas,
            conversaciones tecnológicas, exploración del ecosistema.
          </p>

          {/* Contact methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              marginBottom: '4rem',
              alignItems: 'center'
            }}
          >
            {/* WhatsApp CTA */}
            <motion.button
              onClick={handleWhatsAppClick}
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 20px 60px rgba(0, 200, 150, 0.4)'
              }}
              whileTap={{ scale: 0.98 }}
              className="interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.5rem 3rem',
                background: 'linear-gradient(135deg, #00C896 0%, #00a077 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '16px',
                fontSize: '1.2rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <MessageCircle size={24} />
              Conectar por WhatsApp
            </motion.button>

            {/* Email */}
            <motion.a
              href="mailto:puntocerosystem@gmail.com"
              whileHover={{ scale: 1.05 }}
              className="interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.5rem 3rem',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#FFFFFF',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '16px',
                fontSize: '1.1rem',
                fontWeight: 600,
                textDecoration: 'none',
                backdropFilter: 'blur(12px)'
              }}
            >
              <Mail size={24} />
              puntocerosystem@gmail.com
            </motion.a>
          </motion.div>

          {/* Social media links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <p style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '1.5rem',
              fontWeight: 600,
              letterSpacing: '0.1em'
            }}>
              SÍGUENOS
            </p>

            <div style={{
              display: 'flex',
              gap: '1.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                  transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                  whileHover={{ 
                    scale: 1.2,
                    y: -5,
                    boxShadow: `0 10px 30px ${social.color}40`
                  }}
                  className="interactive"
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    backdropFilter: 'blur(12px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${social.color}20`;
                    e.currentTarget.style.borderColor = social.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <social.icon size={24} />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;
