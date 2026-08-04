import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Image, Video, Calendar, Briefcase, Sparkles, Send, FileText, BarChart3, ShoppingBag, X } from 'lucide-react';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const API = process.env.REACT_APP_BACKEND_URL;

/**
 * FeedComposer — real publisher wired to the backend feed.
 * When `onSubmit` is provided the composer will call it with
 * `{ text, categoryKey, imageUrl }` and reset on success. If it's not
 * provided the composer stays inert (used for dev previews).
 */
const FeedComposer = ({ onSubmit, categoryKey = null }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [image, setImage] = useState(null);  // { url, previewUrl }
  const { user } = useCommunityAuth();
  const authorInitial = (user?.name || user?.email || '0').charAt(0).toUpperCase();
  const photoInputRef = React.useRef(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const chipStub = (label) => () => flash(`${label}: disponible próximamente`);

  const onPhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('Solo se permiten imágenes');
      return;
    }
    // Optimistic preview
    const previewUrl = URL.createObjectURL(file);
    setImage({ url: null, previewUrl });
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/api/feed/media/upload`, {
        method: 'POST', body: form, credentials: 'include',
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))).detail || 'upload_failed';
        throw new Error(detail);
      }
      const data = await res.json();
      setImage({ url: data.url, previewUrl });
    } catch (err) {
      setImage(null);
      URL.revokeObjectURL(previewUrl);
      flash(err.message === 'Debes iniciar sesión'
        ? 'Inicia sesión para subir fotos'
        : `No se pudo subir la imagen`);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !image?.url) || busy || uploading) return;
    setBusy(true); setError('');
    try {
      if (onSubmit) await onSubmit({
        text: text.trim() || (image ? '📷' : ''),
        categoryKey,
        imageUrl: image?.url || null,
      });
      setText('');
      clearImage();
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

      {image && (
        <div data-testid="feed-composer-image-preview" style={{
          position: 'relative', borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(11,31,58,0.08)',
        }}>
          <img src={image.previewUrl} alt="preview"
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={clearImage} data-testid="feed-composer-image-remove"
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(11,31,58,0.75)', border: 'none',
              color: '#FFFFFF', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <X size={14} />
          </button>
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(11,31,58,0.4)', color: '#FFFFFF',
              fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em',
            }}>Subiendo…</div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        flexWrap: 'wrap', paddingTop: '0.15rem',
        borderTop: '1px solid rgba(11,31,58,0.06)',
      }}>
        <ComposerChip icon={<Image size={16} />} label="Foto" color="#3B82F6" onClick={() => photoInputRef.current?.click()} testid="composer-chip-photo" />
        <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoPick}
          data-testid="composer-photo-input" style={{ display: 'none' }} />
        <ComposerChip icon={<Video size={16} />} label="Video" color="#8B5CF6" onClick={chipStub('Video')} testid="composer-chip-video" />
        <ComposerChip icon={<FileText size={16} />} label="Documento" color="#0EA5E9" onClick={chipStub('Documento')} testid="composer-chip-doc" />
        <ComposerChip icon={<BarChart3 size={16} />} label="Encuesta" color="#14B8A6" onClick={chipStub('Encuesta')} testid="composer-chip-poll" />
        <ComposerChip icon={<ShoppingBag size={16} />} label="Marketplace" color="#F97316" onClick={chipStub('Marketplace')} testid="composer-chip-marketplace" />
        <ComposerChip icon={<Calendar size={16} />} label="Evento" color="#EC4899" onClick={chipStub('Evento')} testid="composer-chip-event" />
        <ComposerChip icon={<Briefcase size={16} />} label="Empleo" color="#D4AF37" onClick={chipStub('Empleo')} testid="composer-chip-job" />
        <ComposerChip icon={<Sparkles size={16} />} label="IA" color="#22D3EE" onClick={() => { window.location.href = '/ia'; }} testid="composer-chip-ai" />

        <div style={{ marginLeft: 'auto' }}>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            disabled={(!text.trim() && !image?.url) || busy || uploading}
            data-testid="feed-composer-submit"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: 100,
              border: 'none', cursor: (text.trim() || image?.url) ? 'pointer' : 'not-allowed',
              background: (text.trim() || image?.url)
                ? `linear-gradient(135deg, ${NAVY} 0%, #1E3A8A 100%)`
                : 'rgba(11,31,58,0.08)',
              color: (text.trim() || image?.url) ? '#FFFFFF' : 'rgba(11,31,58,0.4)',
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
      {toast && (
        <div data-testid="feed-composer-toast" style={{
          padding: '0.55rem 0.85rem', borderRadius: 10,
          background: 'rgba(139,92,246,0.08)', color: '#5B21B6',
          border: '1px solid rgba(139,92,246,0.2)',
          fontSize: '0.78rem', fontWeight: 600,
        }}>{toast}</div>
      )}
    </form>
  );
};

const ComposerChip = ({ icon, label, color, onClick, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="interactive" style={{
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
