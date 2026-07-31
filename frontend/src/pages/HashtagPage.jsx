import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Hash, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FollowButton from '../components/community/FollowButton';
import FeedPostCard from '../components/community/FeedPostCard';
import { followsService } from '../services/followsService';
import { feedService } from '../services/feedService';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';

/**
 * HashtagPage — /h/:tag
 * Aggregates posts, follower count and a follow toggle for a single hashtag.
 * 100% built on existing endpoints (/api/feed/posts?hashtag=, /api/follows).
 */
const HashtagPage = () => {
  const { tag } = useParams();
  const normalized = (tag || '').replace(/^#/, '').toLowerCase();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      feedService.listPosts({ hashtag: normalized, limit: 20 }),
      followsService.count('hashtag', normalized),
    ]).then(([p, c]) => {
      setPosts(p.status === 'fulfilled' ? (p.value?.items || []) : []);
      setCount(c.status === 'fulfilled' ? (c.value?.count || 0) : 0);
    }).finally(() => setLoading(false));
  }, [normalized]);

  return (
    <>
      <Header />
      <main data-testid="hashtag-page" style={{ paddingTop: 58, background: '#F7F8FC', minHeight: '100vh' }}>
        <section style={{
          padding: '4rem 2rem 3rem',
          background: `linear-gradient(160deg, ${NAVY} 0%, #4C1D95 100%)`,
          color: '#FFFFFF', position: 'relative', overflow: 'hidden',
        }}>
          <motion.div
            animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', top: -100, right: -100, width: 320, height: 320,
              borderRadius: '50%', border: `1px dashed ${EMERALD}44`,
            }} />
          <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
            <Link to="/" data-testid="hashtag-back" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              fontSize: '0.8rem', marginBottom: '1.75rem', fontWeight: 500,
            }}><ArrowLeft size={14} /> Volver</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{
                width: 90, height: 90, borderRadius: 22,
                background: `linear-gradient(135deg, ${EMERALD}22, ${EMERALD}05)`,
                border: `1px solid ${EMERALD}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: EMERALD, flexShrink: 0,
              }}>
                <Hash size={38} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: '0.65rem', color: EMERALD, letterSpacing: '0.28em',
                              fontWeight: 700, marginBottom: '0.55rem' }}>HASHTAG</div>
                <h1 style={{
                  fontFamily: '"Space Grotesk", sans-serif', margin: 0,
                  fontSize: 'clamp(2rem, 4.4vw, 2.75rem)', fontWeight: 700,
                  letterSpacing: '-0.03em',
                }}>#{normalized}</h1>
                <div style={{ display: 'flex', gap: '1rem', marginTop: 8,
                              fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                  <span data-testid="hashtag-follower-count">
                    <b style={{ color: '#FFFFFF' }}>{count}</b> siguen este hashtag
                  </span>
                  <span>
                    <b style={{ color: '#FFFFFF' }}>{posts.length}</b> publicaciones recientes
                  </span>
                </div>
              </div>
              <FollowButton entityType="hashtag" entityId={normalized}
                testid="hashtag-follow-btn" size="lg" />
            </div>
          </div>
        </section>

        <section style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem 5rem',
                          display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading && <SkeletonPost />}
          {!loading && posts.length === 0 && (
            <div style={{
              background: '#FFFFFF', borderRadius: 22, padding: '3rem 2rem',
              textAlign: 'center', border: '1px dashed rgba(11,31,58,0.15)',
            }}>
              <TrendingUp size={36} color="rgba(11,31,58,0.35)" />
              <h3 style={{ marginTop: '0.85rem', color: NAVY }}>
                Aún sin publicaciones en <b>#{normalized}</b>
              </h3>
              <p style={{ color: 'rgba(11,31,58,0.55)', maxWidth: 460, margin: '0.6rem auto 0' }}>
                Sé el primero: publica algo usando <b>#{normalized}</b> y arranca la conversación.
              </p>
            </div>
          )}
          {!loading && posts.map((p) => (
            <FeedPostCard key={p.id} post={p} onDelete={() => {}} />
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
};

const SkeletonPost = () => (
  <div style={{
    background: '#FFFFFF', borderRadius: 16, height: 180,
    border: '1px solid rgba(11,31,58,0.06)',
    background: 'linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%)',
    backgroundSize: '200% 100%', animation: 'pcSkel 1.4s ease-in-out infinite',
  }} />
);

export default HashtagPage;
