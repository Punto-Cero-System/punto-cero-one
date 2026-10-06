import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const InvestorSetupPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // {email, name}
  const [autoLoginError, setAutoLoginError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    if (!token) return setError('Falta el token de invitación en la URL.');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data?.detail;
        throw new Error(Array.isArray(d) ? d.map((x) => x.msg).join(' ') : (d || 'No se pudo activar la cuenta.'));
      }
      setDone({ email: data.email, name: data.name });
      // Attempt auto-login
      try {
        await login(data.email, password);
        setTimeout(() => navigate('/investor-portal', { replace: true }), 1200);
      } catch (le) {
        setAutoLoginError(le.message || 'Cuenta activada, pero no pudimos iniciar sesión automáticamente.');
      }
    } catch (err) {
      setError(err.message || 'Error al activar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={setupWrap} data-testid="investor-setup-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 2 }}>
        <Link to="/" style={backLink} data-testid="setup-back-home">
          <ArrowLeft size={13} /> Volver a Punto Cero System
        </Link>

        <div style={setupBadge}>
          <Shield size={11} color="#D4AF37" />
          <span style={{ fontSize: '0.66rem', color: '#D4AF37', fontWeight: 700, letterSpacing: '0.25em' }}>
            INVESTOR ROOM · ACTIVAR CUENTA
          </span>
        </div>

        <h1 style={setupTitle}>
          Configura tu <span style={{ fontWeight: 700, background: 'linear-gradient(135deg, #00C896, #D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>acceso</span>.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', marginBottom: '2.5rem', fontWeight: 300 }}>
          Define una contraseña segura para acceder a tu portal privado.
        </p>

        {done ? (
          <div data-testid="setup-success" style={successCard}>
            <div style={successIcon}><CheckCircle size={24} color="#00C896" /></div>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem', fontWeight: 300, color: '#FFFFFF', margin: '0 0 0.75rem' }}>
              Bienvenido, <b style={{ fontWeight: 700 }}>{done.name}</b>.
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 1rem' }}>
              Cuenta activada para {done.email}.
            </p>
            {autoLoginError ? (
              <>
                <div style={{ fontSize: '0.82rem', color: '#ff9a9a', marginBottom: '1rem' }}>{autoLoginError}</div>
                <Link to="/admin/login" style={pillLink}>Ir al login</Link>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#00C896' }}>Redirigiendo a tu portal…</div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} data-testid="setup-form" style={formCard}>
            <Field label="Nueva contraseña" type="password" value={password} onChange={setPassword} testid="setup-password" />
            <Field label="Confirma la contraseña" type="password" value={confirm} onChange={setConfirm} testid="setup-confirm" />
            {error && (
              <div data-testid="setup-error" style={errorBox}>
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <motion.button
              type="submit" disabled={loading}
              whileHover={loading ? {} : { scale: 1.02 }}
              whileTap={loading ? {} : { scale: 0.98 }}
              className="interactive"
              data-testid="setup-submit"
              style={{
                width: '100%', padding: '1rem 1.5rem',
                background: loading ? 'rgba(212,175,55,0.4)' : 'linear-gradient(135deg, #D4AF37 0%, #b8942d 100%)',
                color: '#0B1F3A', border: 'none', borderRadius: '100px',
                fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {loading ? 'Activando…' : <>Activar cuenta <ArrowRight size={15} /></>}
            </motion.button>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
              <Lock size={11} /> La invitación expira en 7 días desde su emisión.
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

const setupWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(ellipse at center, #0d2543 0%, #0B1F3A 60%, #071527 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem',
  position: 'relative', overflow: 'hidden',
};
const backLink = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: '2.5rem',
};
const setupBadge = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.4rem 0.9rem', background: 'rgba(212,175,55,0.1)',
  border: '1px solid rgba(212,175,55,0.3)', borderRadius: '100px', marginBottom: '2rem',
};
const setupTitle = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 'clamp(2rem, 3.5vw, 2.5rem)', fontWeight: 300,
  color: '#FFFFFF', marginBottom: '0.75rem', letterSpacing: '-0.03em', lineHeight: 1.1,
};
const formCard = {
  padding: '2.5rem', background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px',
  backdropFilter: 'blur(12px)',
};
const errorBox = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.7rem 1rem', background: 'rgba(255,90,90,0.08)',
  border: '1px solid rgba(255,90,90,0.3)', borderRadius: '10px',
  color: '#ff9a9a', fontSize: '0.82rem', marginBottom: '1rem',
};
const successCard = {
  padding: '2.5rem', textAlign: 'center', background: 'rgba(0,200,150,0.06)',
  border: '1px solid rgba(0,200,150,0.35)', borderRadius: '20px',
};
const successIcon = {
  width: '56px', height: '56px', borderRadius: '50%',
  background: 'rgba(0,200,150,0.15)', border: '2px solid rgba(0,200,150,0.5)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
};
const pillLink = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.6rem 1.1rem', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px',
  color: '#FFFFFF', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
};

const Field = ({ label, type, value, onChange, testid }) => (
  <div style={{ marginBottom: '1.15rem' }}>
    <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', fontWeight: 600, marginBottom: '0.5rem' }}>
      {label.toUpperCase()}
    </label>
    <input
      data-testid={testid} type={type} value={value}
      onChange={(e) => onChange(e.target.value)} required
      style={{
        width: '100%', padding: '0.9rem 1rem',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', color: '#FFFFFF', fontSize: '0.95rem',
        fontFamily: 'inherit', outline: 'none',
      }}
      onFocus={(e) => (e.target.style.borderColor = '#00C896')}
      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
    />
  </div>
);

export default InvestorSetupPage;
