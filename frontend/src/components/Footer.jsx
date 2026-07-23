import React from 'react';
import { motion } from 'framer-motion';
import { Instagram, Music, Youtube, Share2, Facebook } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const navSections = [
    {
      title: 'PLATAFORMA',
      links: [
        { label: 'Visión', href: '#vision' },
        { label: 'Core', href: '#core' },
        { label: 'Ecosistema', href: '#ecosistema' },
        { label: 'Punto Cero Legal', href: '#punto-cero-legal' }
      ]
    },
    {
      title: 'EMPRESA',
      links: [
        { label: 'Latinoamérica', href: '#latam' },
        { label: 'Comunidad', href: '#comunidad' },
        { label: 'Investor Room', href: '#contacto' },
        { label: 'Contacto', href: '#contacto' }
      ]
    },
    {
      title: 'LEGAL',
      links: [
        { label: 'Política de Privacidad', href: '#' },
        { label: 'Política de Cookies', href: '#' },
        { label: 'Términos y Condiciones', href: '#' },
        { label: 'Acuerdo Profesional', href: '#' }
      ]
    }
  ];

  const socials = [
    { name: 'Instagram', url: 'https://www.instagram.com/puntocerosystem/', icon: Instagram },
    { name: 'TikTok', url: 'https://www.tiktok.com/@puntocerosystem', icon: Music },
    { name: 'YouTube', url: 'https://www.youtube.com/@puntocerosystem', icon: Youtube },
    { name: 'Pinterest', url: 'https://co.pinterest.com/puntocerosystem', icon: Share2 },
    { name: 'Facebook', url: 'https://www.facebook.com/Punto7Cero7', icon: Facebook }
  ];

  return (
    <footer style={{
      position: 'relative',
      background: '#071527',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      padding: '5rem 2rem 2.5rem',
      overflow: 'hidden'
    }}>
      {/* Ambient gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '400px',
        background: 'radial-gradient(ellipse at top, rgba(0, 200, 150, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Top section - Brand + Newsletter/Nav */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) 2fr',
          gap: '4rem',
          marginBottom: '4rem',
          paddingBottom: '4rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }} className="footer-top">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                <span style={{ color: '#FFFFFF' }}>PUNTO</span>
                <span style={{ color: '#00C896' }}> CERO</span>
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.4)',
                letterSpacing: '0.3em',
                fontWeight: 500
              }}>
                S Y S T E M
              </div>
            </div>

            <p style={{
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.55)',
              marginBottom: '2rem',
              maxWidth: '320px',
              fontWeight: 300
            }}>
              Infraestructura tecnológica para Latinoamérica.
              Un núcleo. Múltiples verticales. Un ecosistema conectado.
            </p>

            {/* Social */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {socials.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -3, borderColor: '#00C896', color: '#00C896' }}
                  className="interactive"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textDecoration: 'none',
                    transition: 'all 0.3s ease'
                  }}
                  aria-label={social.name}
                >
                  <social.icon size={15} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Navigation columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '2rem'
          }}>
            {navSections.map((section, idx) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#00C896',
                  letterSpacing: '0.25em',
                  marginBottom: '1.5rem'
                }}>
                  {section.title}
                </div>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        style={{
                          color: 'rgba(255, 255, 255, 0.6)',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                          transition: 'color 0.3s ease',
                          fontWeight: 400
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#FFFFFF')}
                        onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.6)')}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, auto))',
            gap: '2rem',
            marginBottom: '3rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <div>
            <div style={{
              fontSize: '0.65rem',
              color: 'rgba(255, 255, 255, 0.35)',
              letterSpacing: '0.2em',
              marginBottom: '0.4rem',
              fontWeight: 600
            }}>
              EMAIL
            </div>
            <a
              href="mailto:puntocerosystem@gmail.com"
              style={{
                fontSize: '0.95rem',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              puntocerosystem@gmail.com
            </a>
          </div>

          <div>
            <div style={{
              fontSize: '0.65rem',
              color: 'rgba(255, 255, 255, 0.35)',
              letterSpacing: '0.2em',
              marginBottom: '0.4rem',
              fontWeight: 600
            }}>
              WHATSAPP
            </div>
            <a
              href="https://wa.me/573025717944"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.95rem',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              +57 302 571 7944
            </a>
          </div>

          <div>
            <div style={{
              fontSize: '0.65rem',
              color: 'rgba(255, 255, 255, 0.35)',
              letterSpacing: '0.2em',
              marginBottom: '0.4rem',
              fontWeight: 600
            }}>
              ORIGEN
            </div>
            <div style={{
              fontSize: '0.95rem',
              color: '#FFFFFF',
              fontWeight: 500
            }}>
              Latinoamérica
            </div>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.4)'
          }}>
            © {currentYear} Punto Cero System. Todos los derechos reservados.
          </div>

          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              color: '#00C896',
              fontWeight: 600
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00C896'
            }} />
            Construyendo desde cero
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-top {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
