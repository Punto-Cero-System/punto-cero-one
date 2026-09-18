import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Sparkles, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { AUTH_PROVIDERS, authService } from '../services/authService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useAuth } from '../contexts/AuthContext';
import { armWelcome } from '../components/community/welcomeArm';

const NAVY = '#0B1F3A';

/**
 * V1 release surfaces ONLY Google + LinkedIn + Facebook. Microsoft, Apple
 * and X (Twitter) remain fully wired in the backend + AUTH_PROVIDERS map
 * so activating them later is a one-line PR — but they are hidden from
 * the client UI. See _V1_HIDDEN below.
 */
const _V1_HIDDEN = new Set(['microsoft', 'apple', 'twitter', 'github']);

const _PROVIDER_SPECS = [
  { key: 'google', label: 'Google', color: '#FFFFFF', text: '#0B1F3A', ring: 'rgba(66,133,244,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.3l6.7-6.7C35.4 2 30 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.5-4.1 7.1-10.2 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.9 0 20.4 0 24s1 7.1 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.7-4.1-13.6-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>),
  },
  { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', text: '#FFFFFF', ring: 'rgba(10,102,194,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V9h3v10zM6.5 7.5A1.75 1.75 0 118.25 5.75 1.75 1.75 0 016.5 7.5zM19 19h-3v-5.5c0-1.4-.6-2.5-1.9-2.5-1.1 0-1.7.8-2 1.5-.1.3-.1.6-.1.9V19h-3V9h3v1.3a3.2 3.2 0 012.8-1.5c2 0 3.5 1.3 3.5 4.2V19z"/></svg>),
  },
  { key: 'microsoft', label: 'Microsoft', color: '#FFFFFF', text: '#0B1F3A', ring: 'rgba(102,102,102,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24"><rect x="3" y="3" width="8.5" height="8.5" fill="#F25022"/><rect x="12.5" y="3" width="8.5" height="8.5" fill="#7FBA00"/><rect x="3" y="12.5" width="8.5" height="8.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="8.5" height="8.5" fill="#FFB900"/></svg>),
  },
  { key: 'apple', label: 'Apple', color: '#000000', text: '#FFFFFF', ring: 'rgba(0,0,0,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M17.05 20.3c-.94.91-1.98.77-2.97.32-1.05-.46-2-.5-3.11 0-1.39.6-2.12.42-2.95-.32C4.87 17.09 5.4 12.11 8.71 11.9c1.06.06 1.79.6 2.42.65.94-.19 1.83-.75 2.83-.7 1.19.09 2.09.56 2.68 1.4-2.4 1.44-2 4.55.41 5.42-.46 1.11-1.05 2.2-1.99 3.62zM12.85 11.35c-.12-1.79 1.36-3.29 3.05-3.42.24 2.07-1.87 3.61-3.05 3.42z"/></svg>),
  },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', text: '#FFFFFF', ring: 'rgba(24,119,242,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H7.6V13h2.6v8h3.3z"/></svg>),
  },
  { key: 'twitter', label: 'X', color: '#000000', text: '#FFFFFF', ring: 'rgba(255,255,255,0.15)',
    icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>),
  },
];

const PROVIDER_META = _PROVIDER_SPECS.filter((p) => !_V1_HIDDEN.has(p.key));

/**
 * JoinPage — social + email/password auth.
 *
 * Tabs:
 *   - "Social"          → Google (LIVE) + Apple/Microsoft/LinkedIn/FB/X (Próximamente)
 *   - "Correo"          → email/password with register/login toggle + forgot link
 */
const JoinPage = () => {
  const [tab, setTab] = useState('social'); // 'social' | 'email'
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [enabledProviders, setEnabledProviders] = useState(['google']); // fallback
  const navigate = useNavigate();
  const { user, refresh } = useCommunityAuth();
  const { login } = useAuth();

  useEffect(() => {
    if (user && typeof user === 'object') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    authService.listProviders()
      .then((p) => setEnabledProviders((p.enabled || []).map((x) => x.key)))
      .catch(() => { /* keep fallback */ });
  }, []);

  const flash = (msg, kind = 'ok') => {
    if (kind === 'ok') { setNotice(msg); setError(''); setTimeout(() => setNotice(''), 4500); }
    else { setError(msg); setNotice(''); setTimeout(() => setError(''), 5000); }
  };

  const handleSocial = (providerKey, label) => {
    const provider = AUTH_PROVIDERS[providerKey];
    const isEnabled = enabledProviders.includes(providerKey) && provider?.startLogin;
    if (isEnabled) {
      provider.startLogin();
      return;
    }
    flash(`${label} estará disponible próximamente. Usa Google o Correo para ingresar ahora.`);
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'register') {
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
        const inviteCode = new URLSearchParams(window.location.search).get('invite') || undefined;
        const created = await authService.registerEmail({
          email: email.trim(), password, name: name.trim() || undefined,
          invite_code: inviteCode,
        });
        const refreshed = await refresh();
        const uid = created?.id || refreshed?.id;
        if (uid) armWelcome(uid);
        navigate('/', { replace: true });
      } else if (mode === 'login') {
        const authenticated = await login(email.trim().toLowerCase(), password);
        const recommended = authenticated?.systemContext?.workspaces?.recommended;
        if (recommended === 'legal') navigate('/workspace/legal', { replace: true });
        else if (recommended === 'medical') navigate('/workspace/medical', { replace: true });
        else navigate('/', { replace: true });
      } else if (mode === 'forgot') {
        const r = await authService.forgotPassword({ email: email.trim() });
        flash(r.message || 'Si el email existe, enviamos un enlace de recuperación.');
        setMode('login');
      }
    } catch (err) {
      flash(err.message || 'No se pudo completar la operación', 'error');
    } finally { setBusy(false); }
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
      <div style={{ position: 'absolute', top: '-160px', left: '-160px', width: 480, height: 480, borderRadius: '50%', border: '1px solid rgba(139,92,246,0.2)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: 620, height: 620, borderRadius: '50%', border: '1px solid rgba(0,200,150,0.15)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{
          width: '100%', maxWidth: 460, padding: '2.25rem 2rem 2rem',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22, backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.35)', position: 'relative',
        }}>
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
          letterSpacing: '-0.02em', textAlign: 'center', margin: 0, marginBottom: '0.4rem',
        }}>Bienvenido a la comunidad</h1>
        <p style={{
          fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)',
          textAlign: 'center', margin: 0, marginBottom: '1.35rem',
        }}>
          {mode === 'register' ? 'Crea tu cuenta y accede al ecosistema.' :
            mode === 'forgot' ? 'Te enviaremos un enlace para restablecer tu contraseña.' :
              'Un clic y ya eres parte del ecosistema.'}
        </p>

        {/* Tabs */}
        <div data-testid="join-tabs" style={{
          display: 'flex', padding: 4, borderRadius: 100,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1.1rem',
        }}>
          <TabBtn active={tab === 'social'} onClick={() => setTab('social')} testid="join-tab-social">Social</TabBtn>
          <TabBtn active={tab === 'email'} onClick={() => { setTab('email'); setMode('login'); }} testid="join-tab-email">Correo</TabBtn>
        </div>

        <AnimatePresence mode="wait">
        {tab === 'social' ? (
          <motion.div key="social" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {PROVIDER_META.map((s) => {
              const available = enabledProviders.includes(s.key);
              return (
                <motion.button key={s.key}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  onClick={() => handleSocial(s.key, s.label)}
                  data-testid={`join-${s.key}`}
                  aria-label={s.label}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '0.65rem', width: '100%', padding: '0.75rem 1rem', borderRadius: 12,
                    background: s.color, color: s.text, border: `1px solid ${s.ring}`,
                    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: `0 4px 14px ${s.ring}`, position: 'relative', opacity: available ? 1 : 0.82,
                  }}>
                  {s.icon}
                  <span>Continuar con {s.label}</span>
                  {!available && (
                    <span data-testid={`join-${s.key}-soon`} style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
                      padding: '0.2rem 0.45rem', borderRadius: 999,
                      background: 'rgba(0,0,0,0.15)', color: s.text, opacity: 0.75,
                    }}><Lock size={9} /> PRONTO</span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.form key="email" onSubmit={submitEmail}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
            data-testid="join-email-form">
            {mode === 'register' && (
              <Input value={name} onChange={setName} placeholder="Tu nombre (opcional)"
                testid="join-input-name" autoComplete="name" />
            )}
            <Input value={email} onChange={setEmail} type="email" placeholder="tu@correo.com"
              testid="join-input-email" required autoComplete="email" autoFocus icon={<Mail size={14} />} />
            {mode !== 'forgot' && (
              <div style={{ position: 'relative' }}>
                <Input value={password} onChange={setPassword}
                  type={showPwd ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Crea una contraseña (mín. 8)' : 'Tu contraseña'}
                  testid="join-input-password" required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  data-testid="join-toggle-password"
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            )}

            <button type="submit" disabled={busy} data-testid="join-email-submit"
              style={{
                width: '100%', padding: '0.8rem', borderRadius: 12,
                background: 'linear-gradient(135deg, #00C896, #06B6D4)',
                color: NAVY, fontSize: '0.9rem', fontWeight: 800,
                border: 'none', cursor: busy ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: busy ? 0.7 : 1,
              }}>
              {busy && <Loader2 size={14} className="pcone-spin" />}
              {mode === 'register' ? 'Crear cuenta' : mode === 'forgot' ? 'Enviar enlace' : 'Iniciar sesión'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: 4 }}>
              {mode === 'login' ? (
                <>
                  <button type="button" onClick={() => setMode('forgot')} data-testid="join-goto-forgot"
                    style={ghostLinkStyle}>¿Olvidaste tu contraseña?</button>
                  <button type="button" onClick={() => setMode('register')} data-testid="join-goto-register"
                    style={ghostLinkStyle}>Crear cuenta</button>
                </>
              ) : mode === 'register' ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Mín. 8 caracteres.</span>
                  <button type="button" onClick={() => setMode('login')} data-testid="join-goto-login"
                    style={ghostLinkStyle}>Ya tengo cuenta</button>
                </>
              ) : (
                <button type="button" onClick={() => setMode('login')} data-testid="join-goto-login"
                  style={{ ...ghostLinkStyle, marginLeft: 'auto' }}>Volver a iniciar sesión</button>
              )}
            </div>
          </motion.form>
        )}
        </AnimatePresence>

        <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
          @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>

        <AnimatePresence>
          {notice && (
            <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginTop: '1rem', padding: '0.75rem 0.9rem', borderRadius: 10,
                background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)',
                fontSize: '0.78rem', color: '#00C896',
                display: 'flex', alignItems: 'center', gap: '0.45rem',
              }}
              data-testid="join-notice">
              <Sparkles size={13} /> {notice}
            </motion.div>
          )}
          {error && (
            <motion.div key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginTop: '1rem', padding: '0.75rem 0.9rem', borderRadius: 10,
                background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.3)',
                fontSize: '0.78rem', color: '#FCA5A5',
              }}
              data-testid="join-error">{error}</motion.div>
          )}
        </AnimatePresence>

        <p style={{
          marginTop: '1.35rem', textAlign: 'center',
          fontSize: '0.66rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.55,
        }}>
          Al continuar aceptas nuestros <Link to="/legal/terminos" style={{ color: 'rgba(255,255,255,0.6)' }}>Términos</Link>
          {' y '}
          <Link to="/legal/privacidad" style={{ color: 'rgba(255,255,255,0.6)' }}>Política de Privacidad</Link>.
        </p>
      </motion.div>
    </main>
  );
};

const ghostLinkStyle = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.65)',
  cursor: 'pointer', fontSize: '0.76rem', padding: 0, textDecoration: 'underline',
  textUnderlineOffset: 3, fontWeight: 600,
};

const TabBtn = ({ active, onClick, children, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    style={{
      flex: 1, padding: '0.5rem 0.8rem', borderRadius: 100,
      background: active ? 'linear-gradient(135deg, #00C896, #06B6D4)' : 'transparent',
      color: active ? NAVY : 'rgba(255,255,255,0.7)',
      border: 'none', cursor: 'pointer',
      fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
      transition: 'all 0.2s ease',
    }}>{children}</button>
);

const Input = ({ value, onChange, type = 'text', placeholder, testid, required, autoComplete, autoFocus, icon }) => (
  <div style={{ position: 'relative' }}>
    {icon && (
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: 'rgba(255,255,255,0.4)', display: 'inline-flex',
      }}>{icon}</span>
    )}
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      autoComplete={autoComplete} autoFocus={autoFocus}
      data-testid={testid}
      style={{
        width: '100%', height: 44, boxSizing: 'border-box',
        padding: `0 ${type === 'password' ? '2.5rem' : '1rem'} 0 ${icon ? '2.2rem' : '1rem'}`,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#FFFFFF', fontSize: '0.88rem', outline: 'none',
      }}
    />
  </div>
);

export default JoinPage;
