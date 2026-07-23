import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown } from 'lucide-react';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const navItems = [
    { label: 'Plataforma', href: '#plataforma' },
    { 
      label: 'Ecosistema', 
      href: '#ecosistema',
      dropdown: [
        { label: 'Visión Global', href: '#ecosistema' },
        { label: 'Punto Cero Legal', href: '#punto-cero-legal' },
        { label: 'Latinoamérica', href: '#latam' }
      ]
    },
    { label: 'Tecnología', href: '#core' },
    { 
      label: 'Empresa', 
      href: '#',
      dropdown: [
        { label: 'Inversionistas', href: '#inversionistas' },
        { label: 'Partners', href: '#partners' },
        { label: 'Comunidad', href: '#comunidad' },
        { label: 'Prensa', href: '#prensa' },
        { label: 'Carreras', href: '#carreras' }
      ]
    },
    { label: 'Contacto', href: '#contacto' }
  ];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.6, 0.05, 0.01, 0.9] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 100,
        background: 'rgba(11, 31, 58, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 200, 150, 0.1)'
      }}
    >
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <motion.a
          href="#"
          whileHover={{ scale: 1.05 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2
          }}
        >
          <div>
            <span style={{ color: '#FFFFFF' }}>PUNTO</span>
            <span style={{ color: '#00C896' }}> CERO</span>
          </div>
          <div style={{
            fontSize: '0.6rem',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.6)',
            letterSpacing: '0.05em',
            marginTop: '0.1rem'
          }}>
            SYSTEM
          </div>
        </motion.a>

        {/* Desktop Navigation */}
        <nav style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="desktop-nav">
            {navItems.map((item, index) => (
              <div 
                key={item.label}
                style={{ position: 'relative' }}
                onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <motion.a
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index + 0.3 }}
                  className="interactive"
                  style={{
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    position: 'relative',
                    padding: '0.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#00C896';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#FFFFFF';
                  }}
                >
                  {item.label}
                  {item.dropdown && <ChevronDown size={16} />}
                </motion.a>

                {/* Dropdown */}
                {item.dropdown && openDropdown === item.label && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '0.5rem',
                      background: 'rgba(11, 31, 58, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(0, 200, 150, 0.2)',
                      borderRadius: '12px',
                      padding: '0.5rem',
                      minWidth: '200px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {item.dropdown.map((subItem) => (
                      <a
                        key={subItem.label}
                        href={subItem.href}
                        style={{
                          display: 'block',
                          padding: '0.75rem 1rem',
                          color: 'rgba(255, 255, 255, 0.8)',
                          textDecoration: 'none',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(0, 200, 150, 0.1)';
                          e.target.style.color = '#00C896';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                          e.target.style.color = 'rgba(255, 255, 255, 0.8)';
                        }}
                      >
                        {subItem.label}
                      </a>
                    ))}
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn interactive"
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mobile-menu"
            style={{
              display: 'none',
              background: 'rgba(11, 31, 58, 0.95)',
              borderTop: '1px solid rgba(0, 200, 150, 0.1)',
              padding: '1rem',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            {navItems.map((item) => (
              <div key={item.label}>
                <a
                  href={item.href}
                  onClick={() => !item.dropdown && setMobileMenuOpen(false)}
                  style={{
                    display: 'block',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    padding: '1rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600
                  }}
                >
                  {item.label}
                </a>
                {item.dropdown && (
                  <div style={{ paddingLeft: '1rem' }}>
                    {item.dropdown.map((subItem) => (
                      <a
                        key={subItem.label}
                        href={subItem.href}
                        onClick={() => setMobileMenuOpen(false)}
                        style={{
                          display: 'block',
                          color: 'rgba(255, 255, 255, 0.7)',
                          textDecoration: 'none',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem'
                        }}
                      >
                        {subItem.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: block !important;
          }
          .mobile-menu {
            display: block !important;
          }
        }
      `}</style>
    </motion.header>
  );
};

export default Header;
