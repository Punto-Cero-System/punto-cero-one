import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Image, Video, Calendar, Briefcase, Sparkles, Send } from 'lucide-react';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';

/**
 * FeedComposer — real publisher wired to the backend feed.
 * When `onSubmit` is provided the composer will call it with `{ text, categoryKey }`
 * and reset on success. If it's not provided the composer stays inert (used for
 * dev previews).
 */
const FeedComposer = ({ onSubmit, categoryKey = null }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user } = useCommunityAuth();
  const authorInitial = (user?.name || user?.email || '0').charAt(0).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      if (onSubmit) await onSubmit({ text: text.trim(), categoryKey });
      setText('');
    } catch (err) {
      setError(err?.message === 'Debes iniciar sesión' ? 'Inicia sesión para publicar.' : 'No se pudo publicar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="feed-composer"
      style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        padding: '1rem 1.15rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {user?.picture ? (
          <img src={user.picture} alt={user.name} referrerPolicy="no-referrer"
            style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 100%)',
            color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
          }}>{authorInitial}</div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="¿Qué quieres compartir con la comunidad?"
          data-testid="feed-composer-input"
          rows={2}
          style={{
            flex: 1, minWidth: 0,
            border: '1px solid rgba(11,31,58,0.1)', borderRadius: 100,
            padding: '0.85rem 1.15rem', fontSize: '0.92rem',
            resize: 'none', outline: 'none', fontFamily: 'inherit',
            background: '#FAFAFA', color: NAVY,
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(0,200,150,0.4)')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(11,31,58,0.1)')}
        />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        flexWrap: 'wrap', paddingTop: '0.15rem',
        borderTop: '1px solid rgba(11,31,58,0.06)',
      }}>
        <ComposerChip icon={<Image size={16} />} label="Foto" color="#3B82F6" />
        <ComposerChip icon={<Video size={16} />} label="Video" color="#8B5CF6" />
        <ComposerChip icon={<Calendar size={16} />} label="Evento" color="#EC4899" />
        <ComposerChip icon={<Briefcase size={16} />} label="Empleo" color="#D4AF37" />
        <ComposerChip icon={<Sparkles size={16} />} label="IA" color="#22D3EE" />

        <div style={{ marginLeft: 'auto' }}>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            disabled={!text.trim() || busy}
            data-testid="feed-composer-submit"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: 100,
              border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
              background: text.trim()
                ? `linear-gradient(135deg, ${NAVY} 0%, #1E3A8A 100%)`
                : 'rgba(11,31,58,0.08)',
              color: text.trim() ? '#FFFFFF' : 'rgba(11,31,58,0.4)',
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.02em',
              transition: 'background 0.2s',
            }}
          >
            <Send size={14} /> {busy ? 'Publicando…' : 'Publicar'}
          </motion.button>
        </div>
      </div>
      {error && (
        <div data-testid="feed-composer-error" style={{
          marginTop: '-0.15rem', padding: '0.5rem 0.75rem', borderRadius: 8,
          background: 'rgba(255,90,90,0.08)', color: '#B91C1C',
          fontSize: '0.8rem',
        }}>{error}</div>
      )}
    </form>
  );
};

const ComposerChip = ({ icon, label, color }) => (
  <button type="button" className="interactive" style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.4rem 0.7rem', borderRadius: 100,
    border: 'none', background: 'transparent',
    cursor: 'pointer', color: 'rgba(11,31,58,0.7)',
    fontSize: '0.78rem', fontWeight: 600,
    transition: 'background 0.2s',
  }}
    onMouseEnter={(e) => (e.currentTarget.style.background = `${color}14`)}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <span style={{ color }}>{icon}</span>
    <span>{label}</span>
  </button>
);

export default FeedComposer;
