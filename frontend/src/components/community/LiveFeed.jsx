import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader, RefreshCcw, Filter } from 'lucide-react';
import { feedService, categoryService } from '../../services/feedService';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';
import FeedPostCard from './FeedPostCard';
import FeedComposer from './FeedComposer';

const NAVY = '#0B1F3A';

/**
 * LiveFeed — end-to-end community feed powered by /api/feed/*.
 *
 * - Anonymous visitors see public posts (read-only).
 * - Authenticated members can compose, react, comment, save, share.
 * - Filter chips are driven by the dynamic /api/categories taxonomy — adding a
 *   new category on the server appears here without a code change.
 *
 * Pagination uses the server's opaque cursor (ISO timestamp) — no offsets.
 */
const LiveFeed = ({ initialCategory = null }) => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState(initialCategory);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const isAuthed = !!user && typeof user === 'object';
  const inflight = useRef(false);

  const load = useCallback(async (reset = false) => {
    if (inflight.current) return;
    inflight.current = true;
    if (reset) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await feedService.listPosts({
        limit: 15,
        cursor: reset ? undefined : cursor,
        category_key: category || undefined,
      });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch (e) {
      setError(e.message || 'No se pudo cargar el feed');
    } finally {
      setLoading(false); setRefreshing(false);
      inflight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, category]);

  // reload on category change
  useEffect(() => {
    setCursor(null); setHasMore(true); setItems([]);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // dynamic taxonomy
  useEffect(() => {
    categoryService.list('vertical').then(setCategories).catch(() => {});
  }, []);

  const onNewPost = async ({ text, categoryKey }) => {
    const post = await feedService.createPost({
      body: text,
      category_key: categoryKey || category || null,
    });
    setItems((prev) => [post, ...prev]);
    return post;
  };

  const onDelete = (id) => setItems((prev) => prev.filter((p) => p.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} data-testid="live-feed">
      {/* Composer (auth-gated) */}
      {isAuthed ? (
        <FeedComposer onSubmit={onNewPost} categoryKey={category} />
      ) : (
        <ComposerLoggedOut />
      )}

      {/* Category chips */}
      {categories.length > 0 && (
        <div data-testid="feed-category-chips" style={{
          display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
          padding: '0.6rem 0.9rem', borderRadius: 14,
          background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.06)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.6rem', letterSpacing: '0.2em', fontWeight: 700,
            color: 'rgba(11,31,58,0.55)', paddingRight: '0.35rem',
          }}><Filter size={11} />FILTRO</span>
          <FilterChip label="Todo" active={!category} onClick={() => setCategory(null)} testid="feed-chip-all" />
          {categories.map((c) => (
            <FilterChip key={c.key} label={c.label}
              color={c.color || '#00C896'}
              active={category === c.key}
              onClick={() => setCategory(c.key)}
              testid={`feed-chip-${c.key}`}
            />
          ))}
        </div>
      )}

      {/* Feed list */}
      {items.map((p) => (<FeedPostCard key={p.id} post={p} onDelete={onDelete} />))}

      {loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(11,31,58,0.5)' }} data-testid="feed-loading">
          <Loader size={16} className="pc-spin" /> Cargando publicaciones…
          <style>{`.pc-spin { animation: pcSpin 1s linear infinite; } @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div data-testid="feed-empty" style={{
          padding: '2rem 1.5rem', textAlign: 'center', borderRadius: 16,
          background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)',
          color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem',
        }}>
          Aún no hay publicaciones{category ? ' en esta categoría' : ''}. Sé el primero en publicar.
        </div>
      )}

      {hasMore && !loading && (
        <button data-testid="feed-load-more"
          onClick={() => load(false)}
          style={{
            padding: '0.7rem 1rem', borderRadius: 12,
            background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)',
            color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center',
          }}>
          <RefreshCcw size={13} /> Cargar más
        </button>
      )}

      {error && (
        <div data-testid="feed-error" style={{
          padding: '0.85rem 1rem', borderRadius: 10,
          background: 'rgba(255,90,90,0.08)', color: '#B91C1C',
          border: '1px solid rgba(255,90,90,0.25)', fontSize: '0.85rem',
        }}>{error}</div>
      )}
    </div>
  );
};

const ComposerLoggedOut = () => (
  <div data-testid="feed-composer-locked" style={{
    background: 'linear-gradient(120deg, rgba(11,31,58,0.98), rgba(76,29,149,0.92))',
    color: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap',
    boxShadow: '0 10px 40px rgba(11,31,58,0.15)',
  }}>
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>Publica tu punto cero</div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
        Únete con Google para publicar, reaccionar y comentar.
      </div>
    </div>
    <a href="/join" data-testid="feed-composer-join-cta" style={{
      padding: '0.55rem 1rem', borderRadius: 100,
      background: 'linear-gradient(135deg, #00C896, #06B6D4)', color: '#0B1F3A',
      fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none',
    }}>Unirse ahora</a>
  </div>
);

const FilterChip = ({ label, active, onClick, color = '#00C896', testid }) => (
  <button onClick={onClick} data-testid={testid}
    style={{
      padding: '0.3rem 0.75rem', borderRadius: 100, cursor: 'pointer',
      background: active ? `${color}22` : 'rgba(11,31,58,0.03)',
      border: `1px solid ${active ? color : 'rgba(11,31,58,0.08)'}`,
      color: active ? color : 'rgba(11,31,58,0.7)',
      fontSize: '0.72rem', fontWeight: 600,
    }}>{label}</button>
);

export default LiveFeed;
