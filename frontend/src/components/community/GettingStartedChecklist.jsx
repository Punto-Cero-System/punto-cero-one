/**
 * GettingStartedChecklist — FASE 2.3 activación inicial.
 * Checklist ligera, opcional y no invasiva para usuarios nuevos.
 * Solo frontend, sin backend: el progreso se deriva del usuario en
 * sesión + flags locales (seguir / explorar / publicar) y se puede
 * cerrar para siempre (localStorage). Sin gamificación ni puntos.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const DISMISS_KEY = 'pcone_getting_started_dismissed';
const FLAG_FOLLOW = 'pcone_gs_followed';
const FLAG_COMPANIES = 'pcone_gs_companies';
const FLAG_POST = 'pcone_gs_posted';

const readFlag = (k) => {
  try { return localStorage.getItem(k) === '1'; } catch { return false; }
};

const GettingStartedChecklist = () => {
  const { user } = useCommunityAuth();
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY));
  const [, setTick] = useState(0);

  useEffect(() => {
    const onFollow = (e) => {
      try {
        if (e?.detail?.following) localStorage.setItem(FLAG_FOLLOW, '1');
      } catch { /* noop */ }
      setTick((t) => t + 1);
    };
    const onPost = () => {
      try { localStorage.setItem(FLAG_POST, '1'); } catch { /* noop */ }
      setTick((t) => t + 1);
    };
    window.addEventListener('pc:follow-change', onFollow);
    window.addEventListener('pc:post-created', onPost);
    return () => {
      window.removeEventListener('pc:follow-change', onFollow);
      window.removeEventListener('pc:post-created', onPost);
    };
  }, []);

  if (!user || typeof user !== 'object' || dismissed) return null;

  // NOTA: el usuario de sesión viene de /api/community/auth/me
  // (CommunityUserPublic: headline, picture, country, city — SIN bio).
  // Por eso el paso "perfil" se deriva solo de esos campos; no tocar backend.
  const profileDone = !!(user.headline || user.picture || user.country || user.city);
  const steps = [
    { key: 'profile', label: 'Completa tu perfil', done: profileDone, to: '/perfil', testid: 'gs-step-profile' },
    { key: 'follow', label: 'Sigue profesionales', done: readFlag(FLAG_FOLLOW), to: '/comunidad', testid: 'gs-step-follow' },
    { key: 'companies', label: 'Explora empresas', done: readFlag(FLAG_COMPANIES), to: '/empresas', testid: 'gs-step-companies' },
    { key: 'post', label: 'Participa en la comunidad', done: readFlag(FLAG_POST), to: '/comunidad', testid: 'gs-step-post' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div data-testid="getting-started-checklist" style={{
      background: '#FFFFFF', borderRadius: 16, padding: '1rem 1.15rem',
      border: '1px solid rgba(11,31,58,0.08)', boxShadow: '0 8px 30px rgba(11,31,58,0.06)',
      marginBottom: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: '0.95rem' }}>Bienvenido a Punto Cero One</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(11,31,58,0.6)', marginTop: 2 }}>
            {doneCount} de {steps.length} pasos · a tu ritmo, sin prisa.
          </div>
        </div>
        <button onClick={dismiss} data-testid="gs-dismiss" title="Ocultar guía"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(11,31,58,0.4)', padding: 4 }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: '0.7rem' }}>
        {steps.map((s) => (
          <Link key={s.key} to={s.to} data-testid={s.testid}
            onClick={() => {
              try {
                if (s.key === 'companies') localStorage.setItem(FLAG_COMPANIES, '1');
                if (s.key === 'follow') localStorage.setItem(FLAG_FOLLOW, '1');
              } catch { /* noop */ }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              fontSize: '0.83rem', color: s.done ? 'rgba(11,31,58,0.45)' : NAVY,
              fontWeight: s.done ? 500 : 700,
            }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: s.done ? '#00C896' : 'transparent',
              border: s.done ? 'none' : '1.5px solid rgba(11,31,58,0.25)',
              color: '#FFFFFF',
            }}>
              {s.done && <Check size={12} />}
            </span>
            <span style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
            {!s.done && <span style={{ color: '#00A277', fontSize: '0.75rem' }}>→</span>}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default GettingStartedChecklist;
