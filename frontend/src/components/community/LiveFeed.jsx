import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader, Filter, Sparkles } from 'lucide-react';
import { feedService, categoryService, growthService } from '../../services/feedService';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';
import FeedPostCard from './FeedPostCard';
import FeedComposer from './FeedComposer';
import IntelligentFeed from './IntelligentFeed';

const NAVY = '#0B1F3A';

/**
 * mergeFeedAndGrowth — weave community posts with growth items so the feed
 * never looks empty. Inserts one growth item every ~3 community posts, and
 * dedupes by id. Growth items are visually indistinguishable from posts
 * (rendered by the same FeedPostCard) but they carry `is_growth: true`
 * and a `source` block that unlocks a subtle source badge inside the card.
 */
const mergeFeedAndGrowth = (posts, growth) => {
  if (!growth || growth.length === 0) return posts;
  if (!posts || posts.length === 0) return growth;
  const seen = new Set(posts.map((p) => p.id));
  const g = growth.filter((it) => !seen.has(it.id));
  const out = [];
  let gi = 0;
  for (let i = 0; i < posts.length; i += 1) {
    out.push(posts[i]);
    if ((i + 1) % 3 === 0 && gi < g.length) {
      out.push(g[gi]);
      gi += 1;
    }
  }
  while (gi < g.length) { out.push(g[gi]); gi += 1; }
  return out;
};

/**
 * LiveFeed — infinite-scroll community feed.
 *
 * Loads incrementally as the user scrolls (IntersectionObserver sentinel).
 * Prepends new posts optimistically on composer submit while preserving the
 * user's scroll position. Skeleton loaders render while the initial batch
 * is in-flight so the layout doesn't jump.
 */
const LiveFeed = ({ initialCategory = null }) => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('discover');  // 'discover' | 'latest' | 'for-you'
  const [forYouMode, setForYouMode] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [resolvedCountry, setResolvedCountry] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const isAuthed = !!user && typeof user === 'object';
  const sentinelRef = useRef(null);
  const inflight = useRef(false);
  const nextCursorRef = useRef(null);
  const hasMoreRef = useRef(true);

  // Growth items are fetched once per session/category and interleaved
  // into the feed. They come from public sources (RSS) and appear as
  // "source" authored posts (is_growth: true).
  useEffect(() => {
    let cancelled = false;
    growthService.feed({ limit: 30, vertical: category || undefined })
      .then((d) => {
        if (cancelled) return;
        setGrowth(d.items || []);
        setResolvedCountry(d.resolved_country_label || null);
      })
      .catch(() => setGrowth([]));
    return () => { cancelled = true; };
  }, [category, refreshTick]);

  // stable page loader — reads cursor/category via refs to avoid stale closures
  const loadMore = useCallback(async () => {
    if (inflight.current || !hasMoreRef.current) return;
    inflight.current = true;
    setLoading(true);
    setError('');
    try {
      // "Para Ti" — first page is a ranked snapshot; subsequent pages fall
      // through to chronological /posts to keep infinite scroll flowing.
      if (tab === 'for-you' && nextCursorRef.current == null && items.length === 0) {
        const data = await feedService.forYou(30);
        const list = data.items || [];
        setItems(list);
        setForYouMode(data.mode || 'CHRONOLOGICAL');
        // Prepare chronological cursor from the oldest ranked item so we can
        // keep loading more content when the user scrolls beyond the ranking.
        const oldest = list.length ? list[list.length - 1].created_at : null;
        nextCursorRef.current = oldest;
        hasMoreRef.current = !!oldest;
        setCursor(oldest);
        setHasMore(!!oldest);
      } else {
        const data = await feedService.listPosts({
          limit: 15,
          cursor: nextCursorRef.current || undefined,
          category_key: category || undefined,
        });
        setItems((prev) => {
          if (!prev.length) return data.items;
          const seen = new Set(prev.map((p) => p.id));
          const next = data.items.filter((p) => !seen.has(p.id));
          return [...prev, ...next];
        });
        nextCursorRef.current = data.next_cursor;
        hasMoreRef.current = !!data.next_cursor;
        setCursor(data.next_cursor);
        setHasMore(!!data.next_cursor);
      }
    } catch (e) {
      setError(e.message || 'No se pudo cargar el feed');
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [category, tab, items.length]);

  // reset when category OR tab changes
  useEffect(() => {
    nextCursorRef.current = null;
    hasMoreRef.current = true;
    setCursor(null); setHasMore(true); setItems([]);
    if (tab === 'discover') return;  // Descubrir uses its own fetcher
    loadMore();
  }, [category, tab, loadMore]);

  // dynamic taxonomy
  useEffect(() => {
    categoryService.list('vertical').then(setCategories).catch(() => {});
  }, []);

  // IntersectionObserver — triggers loadMore when sentinel enters viewport
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '400px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore]);

  // Follow-change bus — when the user follows/unfollows anything, refresh
  // the feed so the recommendation ranking picks it up immediately.
  useEffect(() => {
    let t = null;
    const handler = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        nextCursorRef.current = null;
        hasMoreRef.current = true;
        setCursor(null); setHasMore(true); setItems([]);
        setRefreshTick((n) => n + 1);
        loadMore();
      }, 350);
    };
    window.addEventListener('pc:follow-change', handler);
    return () => {
      window.removeEventListener('pc:follow-change', handler);
      if (t) clearTimeout(t);
    };
  }, [loadMore]);

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

      {/* Tabs: Descubrir / Últimos / Para Ti */}
      <div data-testid="feed-tabs" style={{
        display: 'flex', gap: '0.35rem', padding: '0.4rem',
        background: '#FFFFFF', borderRadius: 100,
        border: '1px solid rgba(11,31,58,0.06)',
        alignSelf: 'flex-start', flexWrap: 'wrap',
      }}>
        <TabButton active={tab === 'discover'} onClick={() => setTab('discover')}
          testid="feed-tab-discover">
          <Sparkles size={12} style={{ marginRight: 3 }} /> Descubrir
        </TabButton>
        <TabButton active={tab === 'latest'} onClick={() => setTab('latest')}
          testid="feed-tab-latest">Últimos</TabButton>
        <TabButton active={tab === 'for-you'} onClick={() => isAuthed && setTab('for-you')}
          disabled={!isAuthed} testid="feed-tab-for-you">
          Para Ti {tab === 'for-you' && forYouMode && <ModeBadge mode={forYouMode} />}
        </TabButton>
      </div>

      {/* DESCUBRIR — Intelligent Mixed Feed (Wave 12) */}
      {tab === 'discover' && (
        <IntelligentFeed limit={30} />
      )}

      {tab !== 'discover' && resolvedCountry && (
        <div data-testid="feed-region-hint" style={{
          fontSize: '0.68rem', letterSpacing: '0.14em', fontWeight: 700,
          color: 'rgba(11,31,58,0.55)', display: 'inline-flex',
          alignItems: 'center', gap: '0.4rem',
          padding: '0.35rem 0.7rem', borderRadius: 100,
          background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)',
          color: '#00825E', alignSelf: 'flex-start',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#00C896', boxShadow: '0 0 8px #00C896',
          }} />
          FEED REGIONAL · {resolvedCountry.toUpperCase()}
        </div>
      )}

      {/* Category chips (solo en modo "Últimos") */}
      {tab === 'latest' && categories.length > 0 && (
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

      {/* Feed list — interleaves community posts with growth items every 3 slots */}
      {tab !== 'discover' && mergeFeedAndGrowth(items, growth).map((p) => (
        <FeedPostCard key={p.id} post={p} onDelete={onDelete} />
      ))}

      {/* Initial-load skeletons */}
      {tab !== 'discover' && loading && items.length === 0 && growth.length === 0 && (
        <>
          <FeedSkeleton />
          <FeedSkeleton />
          <FeedSkeleton />
        </>
      )}

      {tab !== 'discover' && !loading && items.length === 0 && growth.length === 0 && !error && (
        <div data-testid="feed-empty" style={{
          padding: '2rem 1.5rem', textAlign: 'center', borderRadius: 16,
          background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)',
          color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem',
        }}>
          Aún no hay publicaciones{category ? ' en esta categoría' : ''}. Sé el primero en publicar.
        </div>
      )}

      {/* Infinite-scroll sentinel + subtle loader */}
      {tab !== 'discover' && hasMore && (
        <div ref={sentinelRef} data-testid="feed-scroll-sentinel"
          style={{
            padding: '1rem', textAlign: 'center',
            color: 'rgba(11,31,58,0.4)', fontSize: '0.8rem',
          }}>
          {loading && items.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Loader size={14} className="pc-spin" /> Cargando más…
              <style>{`.pc-spin { animation: pcSpin 1s linear infinite; } @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
            </span>
          )}
        </div>
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

const FeedSkeleton = () => (
  <div data-testid="feed-skeleton" style={{
    background: '#FFFFFF', borderRadius: 16, padding: '1rem 1.15rem',
    border: '1px solid rgba(11,31,58,0.06)',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  }}>
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
      <Bar w={44} h={44} circle />
      <div style={{ flex: 1 }}>
        <Bar w={160} h={12} />
        <div style={{ height: 6 }} />
        <Bar w={110} h={10} />
      </div>
    </div>
    <Bar w="100%" h={12} />
    <Bar w="88%" h={12} />
    <Bar w="70%" h={12} />
    <style>{`
      @keyframes pcShimmer { 0% { background-position: -200px 0; } 100% { background-position: calc(200px + 100%) 0; } }
      .pc-bar { background: linear-gradient(90deg, rgba(11,31,58,0.06) 0px, rgba(11,31,58,0.12) 40px, rgba(11,31,58,0.06) 80px); background-size: 200px 100%; animation: pcShimmer 1.4s linear infinite; }
    `}</style>
  </div>
);

const Bar = ({ w, h, circle }) => (
  <div className="pc-bar" style={{
    width: typeof w === 'number' ? `${w}px` : w,
    height: `${h}px`,
    borderRadius: circle ? '50%' : 6,
  }} />
);

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

const TabButton = ({ active, onClick, disabled, children, testid }) => (
  <button onClick={onClick} disabled={disabled} data-testid={testid}
    style={{
      padding: '0.4rem 0.95rem', borderRadius: 100,
      background: active ? NAVY : 'transparent',
      color: active ? '#FFFFFF' : (disabled ? 'rgba(11,31,58,0.3)' : NAVY),
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>{children}</button>
);

const ModeBadge = ({ mode }) => {
  const map = {
    CHRONOLOGICAL: { label: 'Reciente', color: 'rgba(255,255,255,0.7)' },
    FOLLOW_BASED: { label: 'Afinidad', color: '#00C896' },
    TRENDING: { label: 'Trending', color: '#F59E0B' },
    AI_RECOMMENDED: { label: 'AI', color: '#8B5CF6' },
  };
  const m = map[mode] || map.CHRONOLOGICAL;
  return (
    <span data-testid={`for-you-mode-${mode}`} style={{
      fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.14em',
      padding: '2px 6px', borderRadius: 100, background: 'rgba(255,255,255,0.15)',
      color: m.color,
    }}>{m.label.toUpperCase()}</span>
  );
};

export default LiveFeed;
