import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import BrandMark from './BrandMark';
import { armWelcome } from './community/welcomeArm';

/**
 * AuthCallback — invoked when the URL fragment contains `session_id=...`.
 * Exchanges the session_id via the backend, sets the session cookie, then
 * hands control back to the router at `/`.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUserFromCallback, refresh } = useCommunityAuth();
  const [error, setError] = useState('');
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const raw = location.hash || window.location.hash || '';
    const sessionId = new URLSearchParams(raw.replace(/^#/, '')).get('session_id');
    if (!sessionId) {
      navigate('/', { replace: true });
      return;
    }

    (async () => {
      try {
        // First exchange the session_id with the backend. Then call `/me`
        // to confirm the httpOnly cookie was successfully set server-side.
        const exchanged = await authService.exchangeSession({ provider: 'google', sessionId });
        const refreshed = await refresh();
        if (!refreshed) throw new Error('No se pudo verificar la sesión en el servidor');
        setUserFromCallback(refreshed);
        // If the exchange response indicates a freshly-created account (created_at
        // very recent), arm the welcome modal so the UI shows the celebration.
        try {
          if (exchanged && exchanged.created_at) {
            const createdAt = Date.parse(exchanged.created_at);
            if (!isNaN(createdAt) && Date.now() - createdAt < 30_000) {
              armWelcome(exchanged.id);
            }
          }
        } catch {
          // best-effort only
        }
        // clear the hash before navigating away
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/', { replace: true, state: { justJoined: true } });
      } catch (e) {
        setError(e.message || 'No pudimos completar el ingreso.');
      }
    })();
  }, [location.hash, navigate, refresh, setUserFromCallback]);

  return (
    <main
      data-testid="auth-callback"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.18), transparent 40%), radial-gradient(circle at 70% 80%, rgba(236,72,153,0.15), transparent 45%), linear-gradient(160deg, #0A0F1C 0%, #0B1F3A 100%)',
        color: '#FFFFFF',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          padding: '2rem',
          borderRadius: 22,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(18px)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <BrandMark size={48} variant="full" showTagline={false} to={null} />
        </div>
        {!error ? (
          <>
            <div
              style={{
                width: 42,
                height: 42,
                margin: '0 auto 1rem',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.15)',
                borderTopColor: '#00C896',
                animation: 'pcSpin 0.8s linear infinite',
              }}
              data-testid="auth-callback-spinner"
            />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Conectando tu perfil…</h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.4rem' }}>
              Estamos preparando tu acceso a la comunidad.
            </p>
            <style>{`@keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>No pudimos ingresarte</h1>
            <p
              data-testid="auth-callback-error"
              style={{ fontSize: '0.85rem', color: '#FCA5A5', marginTop: '0.5rem' }}
            >
              {error}
            </p>
            <button
              onClick={() => navigate('/join', { replace: true })}
              data-testid="auth-callback-retry"
              style={{
                marginTop: '1rem',
                padding: '0.6rem 1rem',
                background: '#00C896',
                color: '#0B1F3A',
                border: 'none',
                borderRadius: 100,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Volver a intentar
            </button>
          </>
        )}
      </div>
    </main>
  );
};

export default AuthCallback;
