import React from 'react';
import { Newspaper, MapPin, Share2, Bookmark, Copy, Clock } from 'lucide-react';
import BaseCard, { CardCTA, CardGhostCTA, CardMeta } from './BaseCard';

const ACCENT = '#0369A1';

const NewsCard = ({ item, layout = 'medium' }) => {
  const meta = item.metadata || {};
  const category = item.category || meta.vertical;
  const author = meta.author;
  const date = item.created_at || meta.meta?.published_at;
  const isHero = layout === 'hero';

  const fmtDate = (d) => {
    if (!d) return null;
    try {
      const dt = new Date(d);
      if (isNaN(dt)) return null;
      return dt.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };
  const dateLabel = fmtDate(date);

  const flash = (msg) => {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      padding: '0.6rem 1rem', borderRadius: 100, background: '#0B1F3A',
      color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700, zIndex: 9999,
      boxShadow: '0 12px 30px rgba(11,31,58,0.25)',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  };

  const share = async () => {
    const url = item.external_url;
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: item.title, text: item.description, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); flash('Enlace copiado'); } catch {}
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(item.external_url || ''); flash('Enlace copiado'); } catch {}
  };

  const save = () => flash('Guardado próximamente');

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel={category ? category.toUpperCase() : 'Noticia'}
      badgeIcon={Newspaper}
      testid={`card-news-${item.id}`}
      media={item.image ? (
        <a href={item.external_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', position: 'relative',
                   maxHeight: isHero ? 420 : 240,
                   overflow: 'hidden' }}>
          <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
            style={{ width: '100%',
                     maxHeight: isHero ? 420 : 240,
                     objectFit: 'cover', display: 'block' }} />
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.4) 100%)',
          }} />
          {isHero && (
            <span style={{
              position: 'absolute', bottom: 14, left: 16,
              padding: '0.32rem 0.7rem', borderRadius: 100,
              background: 'rgba(255,255,255,0.95)', color: ACCENT,
              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.16em',
            }}>{(category || 'NOTICIA').toUpperCase()}</span>
          )}
        </a>
      ) : (
        <div style={{
          height: isHero ? 160 : 96,
          background: `linear-gradient(135deg, ${ACCENT} 0%, #075985 100%)`,
        }} />
      )}
      title={
        isHero ? (
          <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {item.title}
          </span>
        ) : item.title
      }
      description={item.description}
      meta={
        <>
          <CardMeta style={{ fontWeight: 700, color: ACCENT }}>{item.source || 'Fuente'}</CardMeta>
          {dateLabel && <CardMeta><Clock size={11} /> {dateLabel}</CardMeta>}
          {author && <CardMeta>· {author}</CardMeta>}
          {item.country_label && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Leer noticia" color={ACCENT}
          testid={`card-news-open-${item.id}`} />
      }
      secondaryActions={
        <>
          <CardGhostCTA onClick={share} icon={Share2} label="Compartir" testid={`card-news-share-${item.id}`} />
          <CardGhostCTA onClick={copy} icon={Copy} label="Copiar" testid={`card-news-copy-${item.id}`} />
          <CardGhostCTA onClick={save} icon={Bookmark} label="Guardar" testid={`card-news-save-${item.id}`} />
        </>
      }
    />
  );
};

export default NewsCard;
