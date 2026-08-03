import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Mail } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { authService } from '../services/authService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

/**
 * VerifyEmailPage — consumes ?token=... from the verification email.
 *
 *   • Valid token   → auto-confirms, establishes session, redirects home.
 *   • Missing/expired → shows an error + "reenviar" CTA that just calls
 *                       /verify/send with the current session (or the email
 *                       we can infer from the invalid token record — which
 *                       we don't have client-side; so we ask for it).
 */
const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState('pending'); // pending | ok | error
  const [message, setMessage] = useState('');
  const [emailForResend, setEmailForResend] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { refresh } = useCommunityAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Enlace inválido o incompleto.');
      return;
    }
    authService.confirmEmailVerification({ token })
      .then(async () => {
        setStatus('ok');
        setMessage('¡Correo verificado! Estamos entrando…');
        await refresh();
        setTimeout(() => navigate('/', { replace: true }), 1400);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'No se pudo verificar el correo.');
      });
  }, [token, refresh, navigate]);

  const resend = async (e) => {
    e.preventDefault();
    if (resendBusy) return;
    setResendBusy(true); setResendMsg('');
    try {
      const r = await authService.sendEmailVerification({ email: emailForResend.trim() || undefined });
      setResendMsg(r.message || 'Si la cuenta existe y no está verificada, enviamos un nuevo enlace.');
    } catch (err) {
      setResendMsg(err.message || 'No se pudo enviar el correo.');
    } finally { setResendBusy(false); }
  };

  return (
    <main data-testid="verify-email-page" style={{
      minHeight: '100vh',
      background: `radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18) 0%, transparent 40%),
                   radial-gradient(circle at 80% 80%, rgba(0,200,150,0.18) 0%, transparent 45%),
                   linear-gradient(160deg, #0A0F1C 0%, #0B1F3A 100%)`,
      color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 460, padding: '2.25rem 2rem 2rem',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22, backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.35)',
        }}>
        <Link to="/" data-testid="verify-back" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)',
          textDecoration: 'none', marginBottom: '1rem',
        }}><ArrowLeft size={13} /> Volver</Link>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <BrandMark size={44} variant="full" showTagline to={null} />
        </div>

        <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
          {status === 'pending' && (
            <>
              <Loader2 size={38} className="pcone-spin" color="#00C896" style={{ marginBottom: 12 }} />
              <h1 style={h1Style}>Verificando tu correo…</h1>
              <p style={pStyle}>Solo un momento.</p>
            </>
          )}
          {status === 'ok' && (
            <div data-testid="verify-success">
              <CheckCircle2 size={44} color="#00C896" style={{ marginBottom: 12 }} />
              <h1 style={h1Style}>¡Verificado!</h1>
              <p style={pStyle}>{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div data-testid="verify-error">
              <XCircle size={44} color="#F87171" style={{ marginBottom: 12 }} />
              <h1 style={h1Style}>Verificación fallida</h1>
              <p style={pStyle}>{message}</p>
            </div>
          )}
        </div>

        {status === 'error' && (
          <form onSubmit={resend} data-testid="verify-resend-form"
            style={{
              padding: '1rem', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                          color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', fontWeight: 700 }}>
              <Mail size={13} /> Reenviar enlace
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
              Introduce el correo con el que te registraste (o si ya iniciaste sesión, dejamos el campo vacío).
            </p>
            <input type="email" value={emailForResend}
              onChange={(e) => setEmailForResend(e.target.value)}
              placeholder="tu@correo.com"
              data-testid="verify-resend-email"
              autoComplete="email"
              style={{
                height: 42, padding: '0 0.85rem', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#FFFFFF', fontSize: '0.85rem', outline: 'none',
              }} />
            <button type="submit" disabled={resendBusy} data-testid="verify-resend-submit"
              style={{
                padding: '0.7rem', borderRadius: 10,
                background: 'linear-gradient(135deg, #00C896, #06B6D4)',
                color: NAVY, fontWeight: 800, fontSize: '0.85rem',
                border: 'none', cursor: resendBusy ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: resendBusy ? 0.7 : 1,
              }}>
              {resendBusy && <Loader2 size={13} className="pcone-spin" />}
              Enviarme un nuevo enlace
            </button>
            {resendMsg && (
              <div data-testid="verify-resend-msg" style={{
                fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)',
                padding: '0.5rem 0.75rem', borderRadius: 8,
                background: 'rgba(0,200,150,0.08)',
                border: '1px solid rgba(0,200,150,0.25)',
              }}>{resendMsg}</div>
            )}
          </form>
        )}

        <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
          @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </main>
  );
};

const h1Style = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 'clamp(1.4rem, 3vw, 1.75rem)', fontWeight: 700,
  letterSpacing: '-0.02em', margin: 0, marginBottom: '0.4rem', color: '#FFFFFF',
};
const pStyle = {
  fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)', margin: 0,
};

export default VerifyEmailPage;
