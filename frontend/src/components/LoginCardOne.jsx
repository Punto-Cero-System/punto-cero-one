import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * LoginCardOne — tarjeta de login PORTABLE con el diseño visual de Punto Cero One.
 *
 * Pensada para vivir embebida (esquina superior derecha) en la página principal
 * de Punto Cero System. NO crea autenticación nueva: consume el AuthContext
 * existente (Identity Core, JWT) y, tras un login exitoso, navega al espacio
 * recomendado por GET /api/auth/system-context. Sin iframes, sin URLs de
 * autenticación hardcodeadas (el endpoint lo resuelve el AuthContext).
 *
 * ── INSTRUCCIONES DE IMPORTACIÓN (en Punto Cero System) ──────────────────
 * 1. Copiar este archivo a `src/components/LoginCardOne.jsx` del Core.
 * 2. Ajustar UNA línea si el AuthContext del Core vive en otra ruta:
 *      import { useAuth } from '../contexts/AuthContext';
 * 3. En la página principal de System (dentro del árbol de <AuthProvider> y
 *    <BrowserRouter>):
 *      import LoginCardOne from './components/LoginCardOne';
 *      ...
 *      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 50 }}>
 *        <LoginCardOne />
 *      </div>
 * 4. Flujo garantizado: formulario → AuthContext.login(email, password) →
 *    POST /api/auth/login → pcl_token → /api/auth/me → /api/auth/system-context
 *    → espacio recomendado.
 * 5. Opcional: <LoginCardOne redirectTo="/" onSuccess={(u) => ...} /> para
 *    forzar un destino existente.
 * 6. Si el Core NO quiere depender de este AuthContext, usar el export
 *    nombrado puro: <LoginCardOneView onSubmitCredentials={fn} onEnter={fn} />
 * ──────────────────────────────────────────────────────────────────────────
 */

const NAVY = '#0B1F3A';

const PROVIDERS = [
  { key: 'google', label: 'Google', color: '#FFFFFF', text: NAVY, ring: 'rgba(66,133,244,0.35)',
    icon: (<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.3l6.7-6.7C35.4 2 30 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.5-4.1 7.1-10.2 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.9 0 20.4 0 24s1 7.1 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.7-4.1-13.6-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>) },
  { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', text: '#FFFFFF', ring: 'rgba(10,102,194,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V9h3v10zM6.5 7.5A1.75 1.75 0 118.25 5.75 1.75 1.75 0 016.5 7.5zM19 19h-3v-5.5c0-1.4-.6-2.5-1.9-2.5-1.1 0-1.7.8-2 1.5-.1.3-.1.6-.1.9V19h-3V9h3v1.3a3.2 3.2 0 012.8-1.5c2 0 3.5 1.3 3.5 4.2V19z"/></svg>) },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', text: '#FFFFFF', ring: 'rgba(24,119,242,0.4)',
    icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.3H7.6V13h2.6v8h3.3z"/></svg>) },
];

const DefaultBrand = () => (
  <div data-testid="login-card-one-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
    <span style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'linear-gradient(135deg, #00C896 0%, #06B6D4 55%, #D4AF37 100%)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.95rem', color: NAVY,
      boxShadow: '0 6px 18px rgba(0,200,150,0.35)',
    }}>0</span>
    <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1.05rem', color: '#FFFFFF', letterSpacing: '-0.01em' }}>
      Punto Cero <span style={{ background: 'linear-gradient(135deg, #00C896, #D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>One</span>
    </span>
  </div>
);

const TabBtn = ({ active, onClick, children, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    style={{
      flex: 1, padding: '0.5rem 0.8rem', borderRadius: 100,
      background: active ? 'linear-gradient(135deg, #00C896, #06B6D4)' : 'transparent',
      color: active ? NAVY : 'rgba(255,255,255,0.7)',
      border: 'none', cursor: 'pointer',
      fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
      transition: 'background 0.2s ease, color 0.2s ease',
    }}>{children}</button>
);

/**
 * LoginCardOneView — vista PURA (sin contextos ni router). Recibe todo por props:
 *   onSubmitCredentials(email, password) → Promise<user>   (obligatoria)
 *   user                                  → sesión actual (si existe, muestra estado autenticado)
 *   onEnter()                             → click "Entrar a One" estando autenticado
 *   onSocialLogin(providerKey)            → opcional; sin ella los botones sociales muestran PRONTO
 *   onForgotPassword()                    → opcional; sin ella el enlace no se muestra
 *   brand, title, subtitle, maxWidth, initialTab
 */
export const LoginCardOneView = ({
  onSubmitCredentials,
  user = null,
  onEnter,
  onSocialLogin,
  onForgotPassword,
  brand,
  title = 'Bienvenido a la comunidad',
  subtitle = 'Un clic y ya eres parte del ecosistema.',
  maxWidth = 400,
  initialTab = 'social',
}) => {
  const [tab, setTab] = useState(initialTab); // 'social' | 'email'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy || typeof onSubmitCredentials !== 'function') return;
    setBusy(true); setError('');
    try {
      await onSubmitCredentials(email.trim().toLowerCase(), password);
      // La navegación al espacio resuelto la ejecuta el wrapper conectado.
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar sesión');
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      data-testid="login-card-one"
      style={{
        width: '100%', maxWidth, padding: '1.75rem 1.6rem 1.5rem',
        background: 'rgba(10,15,28,0.72)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 22, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.35)', position: 'relative',
        color: '#FFFFFF', boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '1.1rem' }}>{brand || <DefaultBrand />}</div>

      {user ? (
        /* Sesión activa — misma identidad del sistema, sin pedir credenciales otra vez */
        <div data-testid="login-card-one-session" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: '1rem' }}>
            {user.picture ? (
              <img src={user.picture} alt={user.name || 'Usuario'} referrerPolicy="no-referrer"
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0B1F3A, #00C896)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.9rem',
              }}>{(user.name || user.email || '0').charAt(0).toUpperCase()}</span>
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user.name || 'Mi cuenta'}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)' }}>{user.email}</div>
            </div>
          </div>
          <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onEnter} data-testid="login-card-one-enter"
            style={{
              width: '100%', padding: '0.8rem', borderRadius: 12,
              background: 'linear-gradient(135deg, #00C896, #06B6D4)',
              color: NAVY, fontSize: '0.9rem', fontWeight: 800, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            Entrar a One <ArrowRight size={15} />
          </motion.button>
        </div>
      ) : (
        <>
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em',
            textAlign: 'center', margin: 0, marginBottom: '0.3rem',
          }}>{title}</h2>
          <p style={{
            fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)',
            textAlign: 'center', margin: 0, marginBottom: '1.1rem',
          }}>{subtitle}</p>

          <div data-testid="login-card-one-tabs" style={{
            display: 'flex', padding: 4, borderRadius: 100,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '1rem',
          }}>
            <TabBtn active={tab === 'social'} onClick={() => setTab('social')} testid="login-card-one-tab-social">Social</TabBtn>
            <TabBtn active={tab === 'email'} onClick={() => setTab('email')} testid="login-card-one-tab-email">Correo</TabBtn>
          </div>

          <AnimatePresence mode="wait">
            {tab === 'social' ? (
              <motion.div key="social" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {PROVIDERS.map((s) => {
                  const wired = typeof onSocialLogin === 'function';
                  return (
                    <motion.button key={s.key} type="button"
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                      onClick={() => wired && onSocialLogin(s.key)}
                      data-testid={`login-card-one-${s.key}`}
                      aria-label={`Continuar con ${s.label}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.65rem', width: '100%', padding: '0.7rem 1rem', borderRadius: 12,
                        background: s.color, color: s.text, border: `1px solid ${s.ring}`,
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: `0 4px 14px ${s.ring}`, position: 'relative', opacity: wired ? 1 : 0.82,
                      }}>
                      {s.icon}
                      <span>Continuar con {s.label}</span>
                      {!wired && (
                        <span data-testid={`login-card-one-${s.key}-soon`} style={{
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
              <motion.form key="email" onSubmit={submit}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
                data-testid="login-card-one-form">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', display: 'inline-flex' }}>
                    <Mail size={14} />
                  </span>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com" required autoComplete="email"
                    data-testid="login-card-one-email"
                    style={{
                      width: '100%', height: 44, boxSizing: 'border-box', padding: '0 1rem 0 2.2rem',
                      borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF',
                      fontSize: '0.88rem', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña" required autoComplete="current-password"
                    data-testid="login-card-one-password"
                    style={{
                      width: '100%', height: 44, boxSizing: 'border-box', padding: '0 2.5rem 0 1rem',
                      borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF',
                      fontSize: '0.88rem', outline: 'none',
                    }}
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    data-testid="login-card-one-toggle-password"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                    }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <button type="submit" disabled={busy} data-testid="login-card-one-submit"
                  style={{
                    width: '100%', padding: '0.8rem', borderRadius: 12,
                    background: 'linear-gradient(135deg, #00C896, #06B6D4)',
                    color: NAVY, fontSize: '0.9rem', fontWeight: 800,
                    border: 'none', cursor: busy ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: busy ? 0.7 : 1,
                  }}>
                  {busy && <Loader2 size={14} className="pcone-spin" />}
                  {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>

                {typeof onForgotPassword === 'function' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', marginTop: 2 }}>
                    <button type="button" onClick={onForgotPassword} data-testid="login-card-one-forgot"
                      style={{
                        background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.65)',
                        cursor: 'pointer', fontSize: '0.76rem', padding: 0, textDecoration: 'underline',
                        textUnderlineOffset: 3, fontWeight: 600,
                      }}>¿Olvidaste tu contraseña?</button>
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                data-testid="login-card-one-error"
                style={{
                  marginTop: '0.9rem', padding: '0.7rem 0.9rem', borderRadius: 10,
                  background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.3)',
                  fontSize: '0.78rem', color: '#FCA5A5',
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                }}>
                <Sparkles size={13} /> {error}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
        @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
};

/**
 * LoginCardOne (default) — versión CONECTADA: consume el AuthContext existente
 * (login → JWT) y react-router. Tras login exitoso navega al espacio resuelto
 * por el contexto del núcleo, salvo que se proporcione `redirectTo`.
 *
 * Props opcionales: redirectTo, onSuccess(user), onSocialLogin, onForgotPassword,
 * brand, title, subtitle, maxWidth, initialTab.
 */
const LoginCardOne = ({ redirectTo, onSuccess, ...viewProps }) => {
  const { user, login, systemContext } = useAuth();
  const navigate = useNavigate();

  const destinationFor = (context) => {
    if (redirectTo) return redirectTo;
    const recommended = context?.workspaces?.recommended;
    if (recommended === 'legal') return '/workspace/legal';
    if (recommended === 'medical') return '/workspace/medical';
    return '/';
  };

  const handleSubmit = async (email, password) => {
    const result = await login(email, password);
    if (typeof onSuccess === 'function') await onSuccess(result);
    navigate(destinationFor(result?.systemContext), { replace: true });
    return result;
  };

  return (
    <LoginCardOneView
      {...viewProps}
      user={user && typeof user === 'object' ? user : null}
      onSubmitCredentials={handleSubmit}
      onEnter={() => navigate(destinationFor(systemContext))}
    />
  );
};

export default LoginCardOne;
