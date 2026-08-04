import React from 'react';
import { Newspaper, MapPin, Share2, Bookmark, Copy } from 'lucide-react';
import BaseCard, { CardCTA, CardGhostCTA, CardMeta } from './BaseCard';

const ACCENT = '#0369A1';

const NewsCard = ({ item }) => {
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
      badgeLabel="Noticia"
      badgeIcon={Newspaper}
      testid={`card-news-${item.id}`}
      media={item.image && (
        <a href={item.external_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', maxHeight: 220, overflow: 'hidden' }}>
          <img src={item.image} alt="" referrerPolicy="no-referrer"
            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
        </a>
      )}
      title={item.title}
      description={item.description}
      meta={
        <>
          <CardMeta>{item.source || 'Fuente pública'}</CardMeta>
          {item.country_label && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Ver noticia" color={ACCENT}
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
