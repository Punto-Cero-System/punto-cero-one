import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Sparkles } from 'lucide-react';
import BrandMark from '../components/BrandMark';

const NAVY = '#0B1F3A';

/**
 * JoinPage — extremely simple community join flow.
 * One-click social auth (Google, LinkedIn, Facebook, Apple, Microsoft)
 * with email as secondary fallback. Profile is auto-created from the
 * provider's returned identity (name, photo, country, language, email) —
 * no additional forms on first entry.
 *
 * All handlers are placeholders that surface a friendly notice today;
 * they route through a stable `handleSocial(provider)` entry point so
 * a backend integration only needs to fill in that single function.
 */
const SOCIALS = [
  { key: 'google', label: 'Continuar con Google', color: '#FFFFFF', text: '#0B1F3A', ring: 'rgba(66,133,244,0.35)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.3l6.7-6.7C35.4 2 30 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.5-4.1 7.1-10.2 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.9 0 20.4 0 24s1 7.1 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.7-4.1-13.6-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
    ),
  },
  { key: 'linkedin', label: 'Continuar con LinkedIn', color: '#0A66C2', text: '#FFFFFF', ring: 'rgba(10,102,194,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V9h3v10zM6.5 7.5A1.75 1.75 0 118.25 5.75 1.75 1.75 0 016.5 7.5zM19 19h-3v-5.5c0-1.4-.6-2.5-1.9-2.5-1.1 0-1.7.8-2 1.5-.1.3-.1.6-.1.9V19h-3V9h3v1.3a3.2 3.2 0 012.8-1.5c2 0 3.5 1.3 3.5 4.2V19z"/></svg>),
  },
  { key: 'facebook', label: 'Continuar con Facebook', color: '#1877F2', text: '#FFFFFF', ring: 'rgba(24,119,242,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H7.6V13h2.6v8h3.3z"/></svg>),
  },
  { key: 'apple', label: 'Continuar con Apple', color: '#000000', text: '#FFFFFF', ring: 'rgba(0,0,0,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M17.05 20.3c-.94.91-1.98.77-2.97.32-1.05-.46-2-.5-3.11 0-1.39.6-2.12.42-2.95-.32C4.87 17.09 5.4 12.11 8.71 11.9c1.06.06 1.79.6 2.42.65.94-.19 1.83-.75 2.83-.7 1.19.09 2.09.56 2.68 1.4-2.4 1.44-2 4.55.41 5.42-.46 1.11-1.05 2.2-1.99 3.62zM12.85 11.35c-.12-1.79 1.36-3.29 3.05-3.42.24 2.07-1.87 3.61-3.05 3.42z"/></svg>),
  },
  { key: 'microsoft', label: 'Continuar con Microsoft', color: '#FFFFFF', text: '#0B1F3A', ring: 'rgba(102,102,102,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="3" width="8.5" height="8.5" fill="#F25022"/><rect x="12.5" y="3" width="8.5" height="8.5" fill="#7FBA00"/><rect x="3" y="12.5" width="8.5" height="8.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="8.5" height="8.5" fill="#FFB900"/></svg>),
  },
];

const JoinPage = () => {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  const handleSocial = (provider) => {
    // Backend integration point — hook up here when auth service is provisioned.
    setNotice(`Conectando con ${provider}… disponible próximamente.`);
    setTimeout(() => setNotice(''), 3500);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setNotice(`Enviamos un enlace mágico a ${email}. Revisa tu bandeja.`);
    setEmail('');
    setTimeout(() => setNotice(''), 4500);
  };

  return (
    <main data-testid="join-page" style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(236,72,153,0.18) 0%, transparent 45%),
        linear-gradient(160deg, #0A0F1C 0%, #0B1F3A 100%)`,
      color: '#FFFFFF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      {/* Decorative orbits */}
      <div style={{
        position: 'absolute', top: '-160px', left: '-160px', width: 480, height: 480,
        borderRadius: '50%', border: '1px solid rgba(139,92,246,0.2)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-200px', right: '-200px', width: 620, height: 620,
        borderRadius: '50%', border: '1px solid rgba(0,200,150,0.15)', pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: '100%', maxWidth: 460,
          padding: '2.25rem 2rem 2rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.35)',
          position: 'relative',
        }}
      >
        <Link to="/" data-testid="join-back" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)',
          textDecoration: 'none', marginBottom: '1.25rem',
        }}>
          <ArrowLeft size={13} /> Volver
        </Link>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.35rem' }}>
          <BrandMark size={48} variant="full" showTagline to={null} />
        </div>

        <h1 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 'clamp(1.55rem, 3vw, 1.9rem)', fontWeight: 700,
          letterSpacing: '-0.02em', textAlign: 'center', margin: 0,
          marginBottom: '0.4rem',
        }}>
          Bienvenido a la comunidad
        </h1>
        <p style={{
          fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)',
          textAlign: 'center', margin: 0, marginBottom: '1.6rem',
        }}>
          Un clic. Tu perfil se crea automáticamente. Sin formularios largos.
        </p>

        {/* Social auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {SOCIALS.map((s) => (
            <motion.button
              key={s.key}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocial(s.label.replace('Continuar con ', ''))}
              data-testid={`join-${s.key}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.65rem', width: '100%',
                padding: '0.85rem 1rem', borderRadius: 12,
                background: s.color, color: s.text,
                border: `1px solid ${s.ring}`,
                fontSize: '0.88rem', fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 4px 14px ${s.ring}`,
              }}
            >
              {s.icon}
              <span>{s.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          margin: '1.35rem 0 1rem',
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{
            fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700,
            color: 'rgba(255,255,255,0.4)',
          }}>O</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Email fallback */}
        {!emailOpen ? (
          <button
            onClick={() => setEmailOpen(true)}
            data-testid="join-email-open"
            style={{
              width: '100%', padding: '0.85rem 1rem', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
          >
            <Mail size={16} /> Continuar con correo electrónico
          </button>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              data-testid="join-email-input"
              autoFocus
              style={{
                width: '100%', height: 46, padding: '0 1rem',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#FFFFFF', fontSize: '0.9rem', outline: 'none',
              }}
            />
            <button type="submit" data-testid="join-email-submit" style={{
              width: '100%', padding: '0.75rem', borderRadius: 12,
              background: 'linear-gradient(135deg, #00C896, #06B6D4)',
              color: '#0B1F3A', fontSize: '0.88rem', fontWeight: 800,
              border: 'none', cursor: 'pointer',
            }}>
              Enviar enlace mágico
            </button>
          </form>
        )}

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '1rem', padding: '0.75rem 0.9rem',
              borderRadius: 10, background: 'rgba(0,200,150,0.08)',
              border: '1px solid rgba(0,200,150,0.25)',
              fontSize: '0.78rem', color: '#00C896',
              display: 'flex', alignItems: 'center', gap: '0.45rem',
            }}
            data-testid="join-notice"
          >
            <Sparkles size={13} /> {notice}
          </motion.div>
        )}

        <p style={{
          marginTop: '1.35rem', textAlign: 'center',
          fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.55,
        }}>
          Al unirte aceptas nuestros términos y política de privacidad.
          Creamos tu perfil con nombre, foto, país e idioma que tu proveedor comparta.
          Podrás completarlo más adelante.
        </p>
      </motion.div>
    </main>
  );
};

export default JoinPage;
