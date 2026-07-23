import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Core', href: '#core' },
    { label: 'Ecosistema', href: '#ecosistema' },
    { label: 'Visión', href: '#vision' },
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
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            cursor: 'pointer'
          }}
        >
          <span style={{ color: '#FFFFFF' }}>PUNTO</span>
          <span style={{ color: '#00C896' }}> CERO</span>
        </motion.div>

        {/* Desktop Navigation */}
        <nav style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '2rem' }} className="desktop-nav">
            {navItems.map((item, index) => (
              <motion.a
                key={item.label}
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
                  padding: '0.5rem 0'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#00C896';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#FFFFFF';
                }}
              >
                {item.label}
              </motion.a>
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
            padding: '1rem'
          }}
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'block',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '1rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {item.label}
            </a>
          ))}
        </motion.div>
      )}

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
