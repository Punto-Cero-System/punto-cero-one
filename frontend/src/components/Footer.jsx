import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      position: 'relative',
      padding: '3rem 2rem',
      background: '#0a1a2e',
      borderTop: '1px solid rgba(0, 200, 150, 0.1)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Logo and tagline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '2rem'
        }}>
          <div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              <span style={{ color: '#FFFFFF' }}>PUNTO</span>
              <span style={{ color: '#00C896' }}> CERO</span>
            </div>
            <p style={{
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.5)',
              maxWidth: '300px'
            }}>
              Infraestructura tecnológica para Latinoamérica.
              <br />
              Un núcleo. Múltiples verticales. Un ecosistema.
            </p>
          </div>

          {/* Quick links */}
          <div style={{
            display: 'flex',
            gap: '4rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <h4 style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#00C896',
                marginBottom: '1rem',
                letterSpacing: '0.1em'
              }}>
                NAVEGACIÓN
              </h4>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {['Core', 'Ecosistema', 'Visión', 'Contacto'].map((item) => (
                  <li key={item}>
                    <a
                      href={`#${item.toLowerCase()}`}
                      style={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        textDecoration: 'none',
                        fontSize: '0.95rem',
                        transition: 'color 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#00C896'}
                      onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#00C896',
                marginBottom: '1rem',
                letterSpacing: '0.1em'
              }}>
                CONTACTO
              </h4>
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <li>
                  <a
                    href="mailto:puntocerosystem@gmail.com"
                    style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      textDecoration: 'none',
                      fontSize: '0.95rem',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#00C896'}
                    onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
                  >
                    Email
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/573025717944"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      textDecoration: 'none',
                      fontSize: '0.95rem',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#00C896'}
                    onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.6)'}
                  >
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <p style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.5)',
            margin: 0
          }}>
            © {currentYear} Punto Cero System. Todos los derechos reservados.
          </p>

          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              fontSize: '0.9rem',
              color: '#00C896',
              fontWeight: 600
            }}
          >
            Construyendo el futuro desde cero
          </motion.div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
