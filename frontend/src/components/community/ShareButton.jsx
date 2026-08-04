/**
 * ShareButton — botón universal de compartir con enlaces profundos oficiales.
 * Usa URLs oficiales (share intent) — NO carga SDKs pesados.
 *
 * Uso:
 *   <ShareButton url="https://.../empresas/rappi" title="Rappi en Punto Cero" />
 *
 * Data-testids:
 *   share-button-{targetId}         → botón principal
 *   share-menu-{targetId}           → popover
 *   share-menu-{network}-{targetId} → cada red social
 */
import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, Linkedin, Facebook, MessageCircle, Send, X as XIcon } from 'lucide-react';

const NAVY = '#0B1F3A';

const buildShareUrls = (url, title) => {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title || '');
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    whatsapp: `https://api.whatsapp.com/send?text=${t}%20${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
  };
};

const ShareButton = ({ url, title = '', targetId = 'default', compact = false, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const share = async (network) => {
    const urls = buildShareUrls(url, title);
    if (network === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch { /* ignore */ }
      return;
    }
    if (network === 'native' && navigator.share) {
      try { await navigator.share({ url, title }); } catch { /* ignore */ }
      setOpen(false);
      return;
    }
    if (urls[network]) window.open(urls[network], '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const btn = compact ? {
    padding: '0.35rem 0.55rem', fontSize: '0.7rem',
  } : {
    padding: '0.5rem 0.85rem', fontSize: '0.78rem',
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
      <button
        type="button"
        onClick={() => (navigator.share ? share('native') : setOpen((v) => !v))}
        data-testid={`share-button-${targetId}`}
        aria-label={ariaLabel || 'Compartir'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: 'rgba(11,31,58,0.05)', color: NAVY,
          border: '1px solid rgba(11,31,58,0.08)', borderRadius: 100,
          cursor: 'pointer', fontWeight: 600, ...btn,
        }}
      >
        <Share2 size={compact ? 12 : 13} /> {compact ? '' : 'Compartir'}
      </button>
      {open && (
        <div
          data-testid={`share-menu-${targetId}`}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            minWidth: 200, background: '#FFFFFF',
            border: '1px solid rgba(11,31,58,0.10)', borderRadius: 12,
            boxShadow: '0 12px 30px rgba(11,31,58,0.15)',
            padding: '0.35rem', zIndex: 10,
          }}
        >
          {[
            ['linkedin', 'LinkedIn', Linkedin, '#0A66C2'],
            ['facebook', 'Facebook', Facebook, '#1877F2'],
            ['twitter', 'X (Twitter)', XIcon, '#000000'],
            ['whatsapp', 'WhatsApp', MessageCircle, '#25D366'],
            ['telegram', 'Telegram', Send, '#26A5E4'],
          ].map(([net, label, Icon, color]) => (
            <button
              key={net}
              type="button"
              data-testid={`share-menu-${net}-${targetId}`}
              onClick={() => share(net)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem',
                padding: '0.42rem 0.55rem', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: 'none', textAlign: 'left',
                color: NAVY, fontSize: '0.75rem', fontWeight: 600,
              }}
            >
              <Icon size={13} color={color} /> {label}
            </button>
          ))}
          <button
            type="button"
            data-testid={`share-menu-copy-${targetId}`}
            onClick={() => share('copy')}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: '0.5rem',
              padding: '0.42rem 0.55rem', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: 'none', textAlign: 'left',
              color: NAVY, fontSize: '0.75rem', fontWeight: 600,
              borderTop: '1px solid rgba(11,31,58,0.06)', marginTop: 4,
            }}
          >
            {copied ? <Check size={13} color="#00825E" /> : <Copy size={13} />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareButton;
