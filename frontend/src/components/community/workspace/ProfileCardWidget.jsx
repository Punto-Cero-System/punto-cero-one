/**
 * Workspace adapters — thin wrappers around EXISTING UI pieces.
 *
 * Each file in this folder exports one widget by ID. The widget is a
 * plain React component; the Widget Manager owns visibility, order and
 * collapsed state via WorkspaceContext. NO new visual design here — we
 * are simply making the current UI addressable by ID.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Users } from 'lucide-react';
import { useCommunityAuth } from '../../../contexts/CommunityAuthContext';
import useCommunityStats, { formatCount } from '../../../hooks/useCommunityStats';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

/**
 * Copied from LeftSidebar unchanged — displays profile card + Unirse CTA.
 * Kept here so it can be enabled/disabled independently of the other left
 * blocks and re-ordered by the user.
 */
const ProfileCardWidget = () => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';
  const { stats } = useCommunityStats(45000);
  const memberCount = stats?.total_members ?? null;
  const memberLabel = memberCount == null ? '…' : formatCount(memberCount);
  return (
    <div data-testid="workspace-profile-card" style={{
      background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(11,31,58,0.06)',
      boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
    }}>
      <div style={{
        height: 56,
        background: 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 80%, #EC4899 100%)',
      }} />
      <div style={{ padding: '0 1rem 1.15rem', textAlign: 'center', marginTop: -30 }}>
        {isAuthed && user.picture ? (
          <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
            style={{
              width: 60, height: 60, borderRadius: '50%',
              border: '3px solid #FFFFFF', objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(11,31,58,0.15)',
            }} />
        ) : isAuthed ? (
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#0A0F1C', margin: '0 auto',
            border: '3px solid #FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Space Grotesk", sans-serif',
            color: '#FFFFFF', fontWeight: 700, fontSize: '1.35rem',
          }}>{(user.name || user.email || 'M').charAt(0).toUpperCase()}</div>
        ) : (
          <div
            data-testid="workspace-members-counter"
            title={`${memberLabel} miembros en Punto Cero One`}
            style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0A0F1C 0%, #1E3A8A 60%, #4C1D95 100%)',
              margin: '0 auto',
              border: '3px solid #FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", sans-serif',
              color: '#FFFFFF', fontWeight: 800,
              fontSize: memberLabel.length > 4 ? '0.85rem' : '1.1rem',
              lineHeight: 1,
              boxShadow: '0 4px 14px rgba(11,31,58,0.25), inset 0 0 0 1px rgba(0,200,150,0.35)',
              whiteSpace: 'nowrap',
              padding: '0 6px',
            }}
          >{memberLabel}</div>
        )}
        <div style={{ marginTop: '0.6rem', fontWeight: 700, fontSize: '0.95rem', color: NAVY }}>
          {isAuthed ? user.name : 'Bienvenido a Mi Espacio'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)', marginTop: '0.15rem' }}>
          {isAuthed ? (user.headline || user.email) : 'Personaliza tu escritorio profesional'}
        </div>
        {/* Live community pulse — always visible so the widget feels alive */}
        <div
          data-testid="workspace-members-pulse"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            marginTop: '0.65rem',
            padding: '0.28rem 0.7rem',
            background: 'linear-gradient(120deg, rgba(0,200,150,0.10), rgba(124,58,237,0.08))',
            border: '1px solid rgba(0,200,150,0.28)',
            borderRadius: 100,
            fontSize: '0.68rem', fontWeight: 700, color: '#00825E',
            letterSpacing: '0.01em',
          }}
        >
          <motion.span
            animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: EMERALD, display: 'inline-block' }}
          />
          <Users size={11} />
          <span data-testid="workspace-members-count">{memberLabel}</span>
          <span style={{ color: 'rgba(11,31,58,0.55)', fontWeight: 500 }}>miembros creciendo</span>
        </div>
        {!isAuthed ? (
          <Link to="/join" style={{
            display: 'block', marginTop: '0.9rem',
            padding: '0.55rem 0.9rem',
            background: NAVY, color: '#FFFFFF',
            borderRadius: 100, fontSize: '0.78rem', fontWeight: 600,
            textDecoration: 'none', textAlign: 'center',
          }}>Unirse a la comunidad</Link>
        ) : (
          <Link to="/mi-espacio/configuracion" data-testid="workspace-personalize-cta" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            marginTop: '0.75rem',
            padding: '0.4rem 0.85rem',
            background: 'rgba(124,58,237,0.08)', color: '#5B21B6',
            borderRadius: 100, fontSize: '0.7rem', fontWeight: 700,
            textDecoration: 'none',
          }}>
            <Sparkles size={11} /> Personalizar Mi Espacio
          </Link>
        )}
      </div>
    </div>
  );
};

export default ProfileCardWidget;

/* Nuestra Historia card (identical to the premium promo in LeftSidebar). */
export const NuestraHistoriaCard = () => (
  <Link to="/nuestra-historia" style={{
    display: 'block', textDecoration: 'none', color: '#FFFFFF',
    position: 'relative', overflow: 'hidden',
    borderRadius: 18,
    background: `linear-gradient(135deg, ${NAVY} 0%, #1E1B4B 55%, #4C1D95 100%)`,
    padding: '1rem 1.1rem',
    boxShadow: `0 10px 30px rgba(11,31,58,0.18), 0 0 0 1px ${EMERALD}33`,
  }}>
    <motion.div
      animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'absolute', top: -60, right: -60, width: 160, height: 160,
        borderRadius: '50%', border: `1px dashed ${EMERALD}44`, pointerEvents: 'none',
      }} />
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute', bottom: -40, right: -20, width: 90, height: 90,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GOLD}44 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: '0.6rem',
      fontSize: '0.6rem', letterSpacing: '0.24em', fontWeight: 700,
      color: EMERALD, marginBottom: '0.55rem',
    }}>
      <Sparkles size={11} /> CONOCE PUNTO CERO
    </div>
    <div style={{
      position: 'relative', fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2,
      marginBottom: '0.35rem',
    }}>Nuestra Historia</div>
    <div style={{
      position: 'relative', fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)',
      marginBottom: '0.75rem', lineHeight: 1.45,
    }}>Visión, misión y las personas detrás del ecosistema.</div>
    <motion.div whileHover={{ x: 2 }} style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.7rem', fontWeight: 700, color: GOLD, letterSpacing: '0.05em',
    }}>Explorar la historia <ArrowRight size={12} /></motion.div>
  </Link>
);
