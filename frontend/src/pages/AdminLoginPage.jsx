import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminLoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const destinationFor = (u) => {
    if (from) return from;
    if (u?.role === 'admin') return '/admin';
    if (u?.role === 'investor') return '/investor-portal';
    return '/';
  };

  // If already logged in, bounce to the right destination
  React.useEffect(() => {
    if (user && user.role) navigate(destinationFor(user), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      navigate(destinationFor(u), { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-testid="admin-login-page"
    >
      {/* Ambient orbit */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 240, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '1100px',
          height: '1100px',
          borderRadius: '50%',
          border: '1px dashed rgba(212, 175, 55, 0.08)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{ width: '100%', maxWidth: '440px', position: 'relative' }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '3rem',
          }}
          data-testid="admin-login-back-home"
        >
          <ArrowLeft size={14} /> Volver a Punto Cero System
        </Link>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.9rem',
            background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '100px',
            marginBottom: '2rem',
          }}
        >
          <Shield size={12} color="#D4AF37" />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D4AF37', letterSpacing: '0.2em' }}>
            Acceso Workspace Punto Cero System
          </span>
        </div>

        <h1
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 4vw, 2.6rem)',
            fontWeight: 300,
            color: '#FFFFFF',
            marginBottom: '0.75rem',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          Investor Room{' '}
          <span
            style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00C896 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Console
          </span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', marginBottom: '2.5rem', fontWeight: 300 }}>
          Acceso restringido. Solo administradores autorizados.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: '2.5rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            backdropFilter: 'blur(12px)',
          }}
          data-testid="admin-login-form"
        >
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            required
            testid="admin-login-email"
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            required
            testid="admin-login-password"
          />

          {error && (
            <div
              data-testid="admin-login-error"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 90, 90, 0.08)',
                border: '1px solid rgba(255, 90, 90, 0.3)',
                borderRadius: '10px',
                color: '#ff9a9a',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? {} : { scale: 1.02 }}
            whileTap={loading ? {} : { scale: 0.98 }}
            className="interactive"
            data-testid="admin-login-submit"
            style={{
              width: '100%',
              padding: '1rem 1.5rem',
              background: loading
                ? 'rgba(212,175,55,0.4)'
                : 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
              color: '#0B1F3A',
              border: 'none',
              borderRadius: '100px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Iniciando sesión…' : (<>Ingresar <ArrowRight size={16} /></>)}
          </motion.button>

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <Lock size={12} />
            Sesión JWT con expiración automática.
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Field = ({ label, type, value, onChange, required, testid }) => (
  <div style={{ marginBottom: '1.25rem' }}>
    <label
      style={{
        display: 'block',
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.15em',
        fontWeight: 600,
        marginBottom: '0.5rem',
      }}
    >
      {label.toUpperCase()}
    </label>
    <input
      data-testid={testid}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      style={{
        width: '100%',
        padding: '0.9rem 1rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: '#FFFFFF',
        fontSize: '0.95rem',
        fontFamily: 'inherit',
        outline: 'none',
      }}
      onFocus={(e) => (e.target.style.borderColor = '#00C896')}
      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
    />
  </div>
);

export default AdminLoginPage;
