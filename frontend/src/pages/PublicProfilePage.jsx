import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Briefcase, Globe2, Linkedin, Twitter, Github, ExternalLink,
  UserPlus, UserCheck, Award, Sparkles, ArrowLeft, Loader2,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FeedPostCard from '../components/community/FeedPostCard';
import { profileService } from '../services/profileService';
import { feedService } from '../services/feedService';
import { followsService } from '../services/followsService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const API = process.env.REACT_APP_BACKEND_URL;

const asAbsoluteMedia = (url) => {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  return `${API}${url}`;
};

/**
 * PublicProfilePage — SEO-friendly public profile at /u/:userId.
 *
 * Reuses:
 *   - GET /api/community/users/:id       (backend)
 *   - GET /api/feed/posts?author_id=:id  (backend)
 *   - POST/DELETE /api/follows/user/:id
 *   - <FeedPostCard>                     (feed component)
 *
 * Displays: cover, avatar, name+headline, follow CTA, bio, specialties,
 * verticals, country/company, stats (posts/followers/following) + latest posts.
 * Fully responsive (single column on mobile, two-column on desktop).
 */
const PublicProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useCommunityAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 'followers' | 'following' | null — opens the FollowsListModal below.
  const [listMode, setListMode] = useState(null);

  const isSelf = viewer && typeof viewer === 'object' && viewer.id === userId;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try {
        const p = await profileService.publicProfile(userId);
        if (cancelled) return;
        setProfile(p);
        // SEO: dynamic <title> + description
        if (typeof document !== 'undefined') {
          document.title = `${p.name} · Punto Cero One`;
          const desc = p.headline || p.bio || 'Miembro del ecosistema Punto Cero One';
          let m = document.querySelector('meta[name="description"]');
          if (!m) {
            m = document.createElement('meta');
            m.name = 'description';
            document.head.appendChild(m);
          }
          m.content = desc.slice(0, 160);
        }
      } catch (e) {
        setError(e.message || 'No se pudo cargar el perfil');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!profile) return;
    feedService.listPosts({ author_id: profile.id, limit: 20 })
      .then((d) => setPosts(d.items || []))
      .catch(() => setPosts([]));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !viewer || typeof viewer !== 'object' || isSelf) return;
    followsService.bulkStatus('user', [profile.id])
      .then((r) => setFollowing(!!r?.following?.[profile.id]))
      .catch(() => setFollowing(false));
  }, [profile?.id, viewer?.id, isSelf]);

  const toggleFollow = async () => {
    if (!viewer || typeof viewer !== 'object') return navigate('/join');
    if (followBusy || isSelf) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    // Optimistic count update so the followers stat refreshes immediately.
    setProfile((p) => p ? {
      ...p,
      followers_count: Math.max(0, (p.followers_count || 0) + (next ? 1 : -1)),
    } : p);
    try {
      const res = next
        ? await followsService.follow('user', profile.id)
        : await followsService.unfollow('user', profile.id);
      // Sync with authoritative count from the server if available.
      if (res && typeof res.count === 'number') {
        setProfile((p) => p ? { ...p, followers_count: res.count } : p);
      }
      window.dispatchEvent(new CustomEvent('pc:follow-change', {
        detail: { entityType: 'user', entityId: profile.id, following: next, count: res?.count },
      }));
    } catch {
      // rollback both toggle + count
      setFollowing(!next);
      setProfile((p) => p ? {
        ...p,
        followers_count: Math.max(0, (p.followers_count || 0) + (next ? -1 : 1)),
      } : p);
    } finally { setFollowBusy(false); }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 82, background: '#F4F6FB', minHeight: '100vh' }}
          data-testid="public-profile-loading">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 size={26} className="pcone-spin" color={NAVY} />
          </div>
        </main>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 82, background: '#F4F6FB', minHeight: '100vh' }}>
          <div style={{ maxWidth: 640, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}
            data-testid="public-profile-not-found">
            <div style={{ fontSize: '3rem' }}>🕵️</div>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', color: NAVY }}>Perfil no encontrado</h1>
            <p style={{ color: 'rgba(11,31,58,0.6)' }}>{error || 'Este usuario no existe o cambió de identificador.'}</p>
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.6rem 1.1rem', borderRadius: 100,
              background: NAVY, color: '#FFFFFF', textDecoration: 'none', fontWeight: 700,
            }}>
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          </div>
        </main>
      </>
    );
  }

  const ui = profile.ui_preferences || {};
  const heroGradient = ui.gradient || `linear-gradient(135deg, ${NAVY}, #4C1D95)`;
  const socials = profile.social || {};

  return (
    <>
      <Header />
      <main data-testid="public-profile-page" style={{
        paddingTop: 58, background: '#F4F6FB', minHeight: '100vh',
      }}>
        {/* Hero — cover + avatar + name + CTA */}
        <section style={{ maxWidth: 1120, margin: '0 auto', padding: '1rem clamp(0.75rem, 2vw, 2rem) 0' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
            border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 6px 30px rgba(11,31,58,0.05)',
          }}>
            <div style={{
              height: 200,
              background: profile.cover_url
                ? `linear-gradient(180deg, transparent 40%, rgba(11,31,58,0.35) 100%), url(${asAbsoluteMedia(profile.cover_url)}) center/cover`
                : heroGradient,
            }} />
            <div style={{
              padding: '0 clamp(1rem, 2.5vw, 2rem) 1.5rem',
              display: 'flex', gap: '1.5rem', alignItems: 'flex-end',
              marginTop: -50, flexWrap: 'wrap',
            }}>
              <div style={{
                width: 108, height: 108, borderRadius: '50%',
                background: '#FFFFFF', border: '4px solid #FFFFFF',
                boxShadow: '0 12px 40px rgba(11,31,58,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {profile.picture ? (
                  <img src={asAbsoluteMedia(profile.picture)} alt={profile.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fb = e.target.nextSibling;
                      e.target.style.display = 'none';
                      if (fb) fb.style.display = 'flex';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
                <span style={{
                  display: profile.picture ? 'none' : 'flex',
                  width: '100%', height: '100%',
                  alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '2.2rem', fontWeight: 700, color: NAVY,
                }}>{(profile.name || '?').charAt(0).toUpperCase()}</span>
              </div>

              <div style={{ flex: 1, minWidth: 240, paddingTop: '1.4rem' }}>
                <h1 data-testid="public-profile-name"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 700,
                    color: NAVY, margin: 0, letterSpacing: '-0.02em',
                  }}>
                  {profile.name}
                  {profile.email_verified && (
                    <Award size={16} color="#00C896" style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                  )}
                </h1>
                {profile.headline && (
                  <div data-testid="public-profile-headline"
                    style={{ color: 'rgba(11,31,58,0.65)', marginTop: 4, fontSize: '0.95rem' }}>
                    {profile.headline}
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: '0.85rem', marginTop: '0.6rem',
                  fontSize: '0.78rem', color: 'rgba(11,31,58,0.55)', flexWrap: 'wrap',
                }}>
                  {profile.country && (
                    <span style={metaSpan}><MapPin size={12} />{profile.country}{profile.city ? ` · ${profile.city}` : ''}</span>
                  )}
                  {profile.current_company && (
                    <span style={metaSpan}><Briefcase size={12} />{profile.current_company}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: '1rem' }}>
                {isSelf ? (
                  <Link to="/perfil" data-testid="public-profile-edit-cta"
                    style={{
                      padding: '0.55rem 1.1rem', borderRadius: 100,
                      background: '#FFFFFF', color: NAVY,
                      border: '1px solid rgba(11,31,58,0.15)',
                      textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
                    }}>Editar perfil</Link>
                ) : (
                  <button onClick={toggleFollow} disabled={followBusy}
                    data-testid="public-profile-follow-btn"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '0.55rem 1.1rem', borderRadius: 100,
                      background: following ? '#FFFFFF' : NAVY,
                      color: following ? NAVY : '#FFFFFF',
                      border: `1px solid ${following ? 'rgba(11,31,58,0.15)' : NAVY}`,
                      fontSize: '0.82rem', fontWeight: 700, cursor: followBusy ? 'wait' : 'pointer',
                      opacity: followBusy ? 0.65 : 1,
                    }}>
                    {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    {following ? 'Siguiendo' : 'Seguir'}
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div data-testid="public-profile-stats"
              style={{
                display: 'flex', gap: '2rem', flexWrap: 'wrap',
                padding: '0 clamp(1rem, 2.5vw, 2rem) 1.5rem',
                borderTop: '1px solid rgba(11,31,58,0.06)', paddingTop: '1rem',
              }}>
              <Stat label="Publicaciones" value={profile.posts_count} testid="stat-posts" />
              <Stat label="Seguidores" value={profile.followers_count} testid="stat-followers"
                onClick={() => setListMode('followers')} />
              <Stat label="Siguiendo" value={profile.following_count} testid="stat-following"
                onClick={() => setListMode('following')} />
            </div>
          </div>
        </section>

        {/* Content grid — left: about; right: posts */}
        <section style={{
          maxWidth: 1120, margin: '1rem auto 4rem',
          padding: '0 clamp(0.75rem, 2vw, 2rem)',
          display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)',
          gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
        }} className="pc-public-profile-grid">
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {profile.bio && (
              <Card title="Biografía" testid="profile-bio">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: 0,
                            color: 'rgba(11,31,58,0.75)', fontSize: '0.88rem' }}>{profile.bio}</p>
              </Card>
            )}

            {(profile.specialties?.length || profile.skills?.length) ? (
              <Card title="Especialidades" testid="profile-specialties">
                <TagsRow tags={[...(profile.specialties || []), ...(profile.skills || [])]} />
              </Card>
            ) : null}

            {profile.verticals?.length ? (
              <Card title="Verticales" testid="profile-verticals">
                <TagsRow tags={profile.verticals} kind="vertical" />
              </Card>
            ) : null}

            {(profile.interests?.length) ? (
              <Card title="Intereses" testid="profile-interests">
                <TagsRow tags={profile.interests} />
              </Card>
            ) : null}

            {(profile.portfolio_url || socials.website || socials.linkedin || socials.twitter || socials.github) && (
              <Card title="Enlaces" testid="profile-links">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SocialLink url={profile.portfolio_url} icon={<ExternalLink size={13} />} label="Portafolio" />
                  <SocialLink url={socials.website} icon={<Globe2 size={13} />} label="Sitio web" />
                  <SocialLink url={socials.linkedin} icon={<Linkedin size={13} />} label="LinkedIn" />
                  <SocialLink url={socials.twitter} icon={<Twitter size={13} />} label="X / Twitter" />
                  <SocialLink url={socials.github} icon={<Github size={13} />} label="GitHub" />
                </div>
              </Card>
            )}
          </aside>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0 4px', color: 'rgba(11,31,58,0.55)', fontSize: '0.72rem',
                          letterSpacing: '0.12em', fontWeight: 800 }}>
              PUBLICACIONES RECIENTES
            </div>
            {posts.length === 0 ? (
              <div data-testid="public-profile-empty-posts"
                style={{
                  background: '#FFFFFF', borderRadius: 16, padding: '2rem 1rem',
                  textAlign: 'center', color: 'rgba(11,31,58,0.55)',
                  border: '1px solid rgba(11,31,58,0.06)',
                }}>
                <Sparkles size={22} style={{ opacity: 0.5 }} />
                <div style={{ marginTop: 8, fontSize: '0.9rem' }}>Sin publicaciones aún</div>
              </div>
            ) : posts.map((post) => (
              <FeedPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      </main>
      <Footer />

      {listMode && (
        <FollowsListModal userId={profile.id} mode={listMode}
          onClose={() => setListMode(null)} />
      )}

      <style>{`
        .pcone-spin { animation: pcSpin 1s linear infinite; }
        @keyframes pcSpin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .pc-public-profile-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </>
  );
};

const metaSpan = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
};

const Stat = ({ label, value, testid, onClick }) => {
  const interactive = !!onClick;
  return (
    <div data-testid={testid}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default', userSelect: 'none' }}>
      <div style={{ fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '1.35rem', fontWeight: 700, color: NAVY }}>
        {(value ?? 0).toLocaleString('es-MX')}
      </div>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.14em',
                    fontWeight: 700,
                    color: interactive ? '#00A277' : 'rgba(11,31,58,0.5)' }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
};

const Card = ({ title, children, testid }) => (
  <section data-testid={testid}
    style={{
      background: '#FFFFFF', borderRadius: 14, padding: '1rem 1.15rem',
      border: '1px solid rgba(11,31,58,0.06)',
      boxShadow: '0 4px 18px rgba(11,31,58,0.03)',
    }}>
    <h2 style={{
      margin: '0 0 0.6rem 0', fontSize: '0.72rem', letterSpacing: '0.14em',
      fontWeight: 800, color: 'rgba(11,31,58,0.55)', textTransform: 'uppercase',
    }}>{title}</h2>
    {children}
  </section>
);

const TagsRow = ({ tags = [], kind }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {tags.slice(0, 30).map((t, i) => {
      const label = String(t || '').trim();
      if (!label) return null;
      const to = kind === 'vertical' ? `/${label.toLowerCase()}` : null;
      const chip = (
        <span style={{
          padding: '0.35rem 0.75rem', borderRadius: 100,
          background: 'rgba(11,31,58,0.05)', color: NAVY,
          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.01em',
        }}>{label}</span>
      );
      return to ? <Link key={`${label}-${i}`} to={to} style={{ textDecoration: 'none' }}>{chip}</Link>
                : <React.Fragment key={`${label}-${i}`}>{chip}</React.Fragment>;
    })}
  </div>
);

const SocialLink = ({ url, icon, label }) => {
  if (!url) return null;
  const href = /^https?:/i.test(url) ? url : `https://${url}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: NAVY, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
      }}>
      {icon}<span>{label}</span>
    </a>
  );
};

/**
 * FollowsListModal — light dialog listing followers or following. Consumes
 * GET /api/follows/user/:id/{followers|following}. No extra state, no new
 * collections; reuses the existing `follows` records via the two new list
 * endpoints in follows_routes.
 */
const FollowsListModal = ({ userId, mode, onClose }) => {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setItems([]);
    const load = mode === 'followers'
      ? followsService.listFollowers(userId)
      : followsService.listFollowing(userId);
    load
      .then((d) => { if (!cancelled) { setItems(d.items || []); setCount(d.count || 0); } })
      .catch((e) => { if (!cancelled) setError(e?.message || 'No se pudo cargar la lista'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, mode]);

  const title = mode === 'followers' ? 'Seguidores' : 'Siguiendo';

  return (
    <div data-testid="follows-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(11,31,58,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
      <div data-testid="follows-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)', maxHeight: '78vh', overflow: 'auto',
          background: '#FFFFFF', borderRadius: 18,
          boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
        }}>
        <div style={{
          padding: '1rem 1.15rem', borderBottom: '1px solid rgba(11,31,58,0.06)',
          display: 'flex', alignItems: 'center', gap: 8,
          position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: '1.05rem', fontWeight: 700, color: NAVY }}>
              {title}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>
              {count.toLocaleString('es-MX')} {count === 1 ? 'persona' : 'personas'}
            </div>
          </div>
          <button onClick={onClose} data-testid="follows-modal-close"
            aria-label="Cerrar"
            style={{ padding: '0.35rem 0.55rem', borderRadius: 8,
                     background: 'rgba(11,31,58,0.04)', border: 'none',
                     cursor: 'pointer', color: NAVY, fontWeight: 700 }}>×</button>
        </div>
        <div style={{ padding: '0.35rem 0.4rem 0.6rem' }}>
          {loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)', fontSize: '0.85rem' }}>
              <Loader2 size={16} className="pcone-spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Cargando…
              <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
                @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {error && (
            <div style={{ padding: '1rem', color: '#B91C1C', fontSize: '0.85rem' }}>{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)', fontSize: '0.85rem' }}>
              {mode === 'followers' ? 'Aún no tiene seguidores.' : 'Aún no sigue a nadie.'}
            </div>
          )}
          {items.map((u) => (
            <Link key={u.id} to={`/u/${u.id}`} onClick={onClose}
              data-testid={`follows-modal-item-${u.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '0.65rem 0.75rem', borderRadius: 10,
                textDecoration: 'none', color: NAVY,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(11,31,58,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              {u.picture ? (
                <img src={asAbsoluteMedia(u.picture)} alt="" referrerPolicy="no-referrer"
                  loading="lazy"
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#F4F6FB' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0B1F3A, #1E293B)',
                              color: '#FFFFFF', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700 }}>
                  {(u.name || u.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name || u.email || 'Miembro'}
                </div>
                {(u.headline || u.current_company) && (
                  <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.headline || u.current_company}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePage;
