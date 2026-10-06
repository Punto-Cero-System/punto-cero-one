import React, { useEffect, useState } from 'react';import EmptyState from '../components/EmptyState';

import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Share2, ExternalLink, Rss, Sparkles, Clock } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { widgetsService } from '../services/widgetsService';

const EMERALD = '#00C896';
const GOLD = '#D4AF37';

const FEEDS = [
  { key: 'noticias',    label: 'Todo',        color: NAVY },
  { key: 'tecnologia',  label: 'Tecnología',  color: '#3B82F6' },
];

/**
 * NewsPage — Google Discover / Microsoft Start / Apple News inspired.
 * One hero card + a two-column magazine grid, no tiny lists.
 * Powered by the RSS widget backend (/api/widgets/rss) — ACTIVE feeds render
 * live content; CONFIG_PENDING falls back to the built-in mock automatically.
 */
const NewsPage = () => {
  const [feed, setFeed] = useState('noticias');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    widgetsService.rss({ feed_key: feed, limit: 18 })
      .then((r) => setItems(r?.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [feed]);

  const toggleSave = (link) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link); else next.add(link);
      return next;
    });
  };

  const share = async (item) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: item.link });
      } else {
        await navigator.clipboard.writeText(item.link);
      }
    } catch { /* noop */ }
  };

  const hero = items[0];
  const rest = items.slice(1);

  return (
    <CategoryPage
      icon="news"
      eyebrow="News Experience"
      title="Descubre lo que mueve al ecosistema"
      subtitle="Contenido curado en vivo desde fuentes verificadas. Guarda, comparte y sigue temas de tu interés."
      testid="news-page"
    >
      {/* Feed picker */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}
           data-testid="news-feed-picker">
        {FEEDS.map((f) => {
          const active = feed === f.key;
          return (
            <button key={f.key} onClick={() => setFeed(f.key)}
              data-testid={`news-feed-${f.key}`}
              style={{
                padding: '0.55rem 1rem', borderRadius: 100,
                background: active ? f.color : '#FFFFFF',
                border: `1px solid ${active ? f.color : 'rgba(11,31,58,0.10)'}`,
                color: active ? '#FFFFFF' : f.color,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: active ? `0 6px 18px ${f.color}44` : 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                transition: 'all 0.3s ease',
              }}>
              <Rss size={12} /> {f.label}
            </button>
          );
        })}
      </div>

      {loading && <NewsSkeleton />}

      {!loading && hero && (
        <HeroCard item={hero} onSave={toggleSave} onShare={share} isSaved={saved.has(hero.link)} />
      )}

      {!loading && rest.length > 0 && (
        <div className="pcone-news-grid" style={{
          display: 'grid', gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        }}>
          <AnimatePresence>
            {rest.map((item, i) => (
              <NewsCard key={item.link || i} item={item} idx={i}
                onSave={toggleSave} onShare={share} isSaved={saved.has(item.link)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState
          testid="news-empty"
          icon="news"
          title="Todavía no hay noticias cargadas"
          why="Las noticias llegan de fuentes externas del ecosistema. Mientras tanto, la comunidad sigue publicando actividad en tiempo real."
          actions={[
            { label: 'Ver la comunidad', to: '/comunidad', kind: 'primary', testid: 'news-empty-cta-community' },
            { label: 'Explorar empresas', to: '/empresas', testid: 'news-empty-cta-companies' },
          ]}
        />
      )}
    </CategoryPage>
  );
};

const CategoryChip = ({ label, color = EMERALD }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '0.25rem 0.65rem', borderRadius: 100,
    background: `${color}18`, border: `1px solid ${color}55`,
    color, fontSize: '0.6rem', letterSpacing: '0.16em', fontWeight: 700,
  }}><Sparkles size={9} /> {label}</span>
);

const HeroCard = ({ item, onSave, onShare, isSaved }) => {
  const image = item.image || `https://picsum.photos/seed/${encodeURIComponent(item.title)}/1200/600`;
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      data-testid="news-hero"
      style={{
        borderRadius: 22, overflow: 'hidden', position: 'relative', minHeight: 360,
        background: `linear-gradient(180deg, rgba(11,31,58,0.15) 40%, rgba(11,31,58,0.92) 100%), url(${image}) center/cover`,
        boxShadow: '0 20px 60px rgba(11,31,58,0.15)',
        color: '#FFFFFF',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '2rem 2.25rem',
      }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <CategoryChip label="DESTACADO" color={GOLD} />
      </div>
      <a href={item.link} target="_blank" rel="noopener noreferrer"
         style={{ textDecoration: 'none', color: '#FFFFFF' }}>
        <h2 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 'clamp(1.4rem, 3vw, 2.05rem)', fontWeight: 700,
          letterSpacing: '-0.02em', lineHeight: 1.15,
          margin: 0, marginBottom: '0.85rem', maxWidth: 760,
        }}>{item.title}</h2>
      </a>
      {item.summary && (
        <p style={{
          fontSize: '0.98rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.82)',
          margin: 0, marginBottom: '1.2rem', maxWidth: 720, fontWeight: 300,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{stripHtml(item.summary)}</p>
      )}
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {item.published && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                         fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
            <Clock size={12} /> {formatTime(item.published)}
          </span>
        )}
        <ActionBtn onClick={() => onSave(item.link)} label={isSaved ? 'Guardado' : 'Guardar'} icon={Bookmark} active={isSaved} />
        <ActionBtn onClick={() => onShare(item)} label="Compartir" icon={Share2} />
        <a href={item.link} target="_blank" rel="noopener noreferrer" style={readMoreBtn}>
          Leer más <ExternalLink size={12} />
        </a>
      </div>
    </motion.article>
  );
};

const NewsCard = ({ item, idx, onSave, onShare, isSaved }) => {
  const image = item.image || `https://picsum.photos/seed/${encodeURIComponent(item.title)}/600/300`;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45, delay: Math.min(idx * 0.03, 0.35) }}
      whileHover={{ y: -4, boxShadow: '0 24px 50px rgba(11,31,58,0.14)' }}
      data-testid={`news-card-${idx}`}
      style={{
        background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 6px 22px rgba(11,31,58,0.05)',
        display: 'flex', flexDirection: 'column',
      }}>
      <a href={item.link} target="_blank" rel="noopener noreferrer"
         style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ height: 180, background: `url(${image}) center/cover`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, left: 12 }}>
            <CategoryChip label="ECOSISTEMA" />
          </div>
        </div>
      </a>
      <div style={{ padding: '1.05rem 1.2rem 1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <h3 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.05rem', fontWeight: 700, color: NAVY,
            margin: 0, marginBottom: '0.55rem', letterSpacing: '-0.015em', lineHeight: 1.25,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{item.title}</h3>
        </a>
        {item.summary && (
          <p style={{
            fontSize: '0.83rem', color: 'rgba(11,31,58,0.62)', lineHeight: 1.5,
            margin: 0, marginBottom: '0.85rem',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{stripHtml(item.summary)}</p>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          {item.published && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                           fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)', fontWeight: 500 }}>
              <Clock size={10} /> {formatTime(item.published)}
            </span>
          )}
          <button data-testid={`news-save-${idx}`} onClick={() => onSave(item.link)}
            style={iconBtn(isSaved)} aria-label="Guardar">
            <Bookmark size={14} fill={isSaved ? EMERALD : 'transparent'} />
          </button>
          <button data-testid={`news-share-${idx}`} onClick={() => onShare(item)}
            style={iconBtn(false)} aria-label="Compartir">
            <Share2 size={14} />
          </button>
        </div>
      </div>
    </motion.article>
  );
};

const NewsSkeleton = () => (
  <div style={{
    display: 'grid', gap: '1.25rem',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  }}>
    <div className="pc-skel-hero" style={{
      gridColumn: '1 / -1', height: 320, borderRadius: 22,
      background: 'linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%)',
      backgroundSize: '200% 100%',
    }} />
    {[...Array(4)].map((_, i) => (
      <div key={i} style={{
        borderRadius: 18, overflow: 'hidden', background: '#FFFFFF',
        border: '1px solid rgba(11,31,58,0.06)', height: 340,
      }}>
        <div className="pc-skel-hero" style={{ height: 180,
          background: 'linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%)',
          backgroundSize: '200% 100%' }} />
        <div style={{ padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={skelLine('80%', 14)} />
          <div style={skelLine('95%', 10)} />
          <div style={skelLine('60%', 10)} />
        </div>
      </div>
    ))}
    <style>{`.pc-skel-hero { animation: pcSkel 1.4s ease-in-out infinite; }
      @keyframes pcSkel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

const skelLine = (w, h) => ({
  width: w, height: h, borderRadius: 4,
  background: 'linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%)',
  backgroundSize: '200% 100%', animation: 'pcSkel 1.4s ease-in-out infinite',
});

const ActionBtn = ({ onClick, label, icon: Icon, active }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '0.4rem 0.85rem', borderRadius: 100, cursor: 'pointer',
    background: active ? `${EMERALD}22` : 'rgba(255,255,255,0.1)',
    border: `1px solid ${active ? EMERALD : 'rgba(255,255,255,0.25)'}`,
    color: active ? EMERALD : '#FFFFFF', fontSize: '0.72rem', fontWeight: 600,
    backdropFilter: 'blur(6px)',
  }}><Icon size={12} fill={active ? EMERALD : 'transparent'} /> {label}</button>
);

const iconBtn = (active) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: '50%',
  background: active ? `${EMERALD}18` : 'rgba(11,31,58,0.04)',
  border: 'none', cursor: 'pointer',
  color: active ? EMERALD : 'rgba(11,31,58,0.55)',
});

const readMoreBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '0.45rem 1rem', borderRadius: 100,
  background: '#FFFFFF', color: NAVY, textDecoration: 'none',
  fontSize: '0.72rem', fontWeight: 700,
};

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '').trim();
const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 16);
    return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default NewsPage;
