import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Bookmark, Send, MoreHorizontal, Lightbulb, Trophy, HandHeart, HelpCircle, Info, Copy, Flag, UserPlus, Building2 } from 'lucide-react';
import PresenceDot from './PresenceDot';
import UserHoverCard from './UserHoverCard';
import { feedService, getViewSessionId } from '../../services/feedService';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

const REACTIONS = [
  { kind: 'like',       icon: Heart,     color: '#EC4899', label: 'Me gusta' },
  { kind: 'insight',    icon: Lightbulb, color: '#F59E0B', label: 'Insight' },
  { kind: 'celebrate',  icon: Trophy,    color: '#00C896', label: 'Celebrar' },
  { kind: 'support',    icon: HandHeart, color: '#3B82F6', label: 'Apoyo' },
  { kind: 'curious',    icon: HelpCircle,color: '#7C3AED', label: 'Curioso' },
];
const REACTION_META = Object.fromEntries(REACTIONS.map((r) => [r.kind, r]));

/**
 * FeedPostCard — real post rendered from the backend. Optimistic UI for
 * reactions/saves so the interaction feels instant, then reconciles with the
 * server response.  Comments load lazily on first expand.
 */
const FeedPostCard = ({ post: initial, onDelete }) => {
  const [post, setPost] = useState(initial);
  // P0.2 — `post` is the local, optimistic copy. It must be reconciled with
  // the prop whenever the parent hands us a fresher version of the SAME post
  // (refetch, parent re-render, follow/refresh). Without this the card keeps
  // rendering the first `initial` forever, even though React.memo below lets
  // it re-render when `updated_at` or a counter changed.
  const syncedFromRef = useRef(initial);
  useEffect(() => {
    if (syncedFromRef.current === initial) return;
    syncedFromRef.current = initial;
    setPost(initial);
  }, [initial]);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';
  const isOwner = isAuthed && user?.id === post.author.id;

  // Register a view once per session for this post. Growth/editorial items use
  // a synthetic `source-<id>` id that no real post row matches, so the call
  // was a guaranteed 404 for every external card in the feed. Skip them.
  useEffect(() => {
    if (post.is_growth) return;
    feedService.view(post.id, getViewSessionId()).catch(() => {});
  }, [post.id, post.is_growth]);

  const react = async (kind) => {
    if (!isAuthed) return;
    const prev = post;
    // optimistic
    const wasSame = post.my_reaction === kind;
    const nextCount = post.counts.reactions + (wasSame ? -1 : (post.my_reaction ? 0 : 1));
    setPost((p) => ({
      ...p,
      my_reaction: wasSame ? null : kind,
      counts: { ...p.counts, reactions: nextCount },
    }));
    try {
      await feedService.react(post.id, kind);
    } catch {
      setPost(prev);
    }
  };

  const toggleSave = async () => {
    if (!isAuthed) return;
    const prev = post;
    setPost((p) => ({
      ...p,
      my_saved: !p.my_saved,
      counts: { ...p.counts, saves: p.counts.saves + (p.my_saved ? -1 : 1) },
    }));
    try { await feedService.toggleSave(post.id); }
    catch { setPost(prev); }
  };

  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [shareToast, setShareToast] = useState('');

  const flashShare = (msg) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(''), 2500);
  };

  const buildShareUrl = () => post.is_growth
    ? (post.link_url || `${window.location.origin}/`)
    : `${window.location.origin}/?post=${post.id}`;

  const trackShare = async (destination) => {
    setPost((p) => ({ ...p, counts: { ...p.counts, shares: (p.counts.shares || 0) + 1 } }));
    if (!post.is_growth) {
      try { await feedService.share(post.id, destination); } catch { /* soft-fail */ }
    }
  };

  const shareCopyLink = async () => {
    setSharePopoverOpen(false);
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      flashShare('Enlace copiado');
      await trackShare('clipboard');
    } catch {
      flashShare('No se pudo copiar');
    }
  };

  const shareNative = async () => {
    setSharePopoverOpen(false);
    const url = buildShareUrl();
    if (!navigator.share) return shareCopyLink();
    try {
      await navigator.share({ title: 'Punto Cero One', text: post.body?.slice(0, 140), url });
      await trackShare('native');
    } catch { /* user cancelled */ }
  };

  const shareToPuntoCero = async () => {
    setSharePopoverOpen(false);
    if (!isAuthed) return flashShare('Inicia sesión para compartir en tu feed');
    const url = buildShareUrl();
    const excerpt = (post.body || '').slice(0, 200).trim();
    const author = post.author?.name || 'la comunidad';
    const body = `💬 Compartiendo de ${author}: ${excerpt ? '"' + excerpt + '"' : ''}\n\n${url}`.trim();
    try {
      await feedService.createPost({ body, visibility: 'public' });
      await trackShare('internal');
      flashShare('Publicado en tu feed');
      // trigger feed refresh
      window.dispatchEvent(new CustomEvent('pc:feed-refresh'));
    } catch {
      flashShare('No se pudo publicar');
    }
  };

  // Kept for backwards-compat with keyboard shortcuts / external callers.
  const share = () => setSharePopoverOpen((v) => !v);

  const openComments = async () => {
    setShowComments((v) => !v);
    if (!commentsLoaded) {
      try {
        const data = await feedService.listComments(post.id);
        setComments(data.items || []);
        setCommentsLoaded(true);
      } catch { /* ignore */ }
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim() || busy || !isAuthed) return;
    setBusy(true);
    try {
      const c = await feedService.addComment(post.id, commentBody.trim());
      setComments((cs) => [...cs, c]);
      setCommentBody('');
      setPost((p) => ({ ...p, counts: { ...p.counts, comments: p.counts.comments + 1 } }));
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!isOwner && user?.role !== 'admin') return;
    if (!window.confirm('¿Eliminar esta publicación?')) return;
    try {
      await feedService.deletePost(post.id);
      if (onDelete) onDelete(post.id);
    } catch { /* ignore */ }
  };

  const myReactionMeta = post.my_reaction ? REACTION_META[post.my_reaction] : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-testid={`feed-post-${post.id}`}
      style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '1rem 1.15rem 0.5rem' }}>
        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          {post.author.picture ? (
            <img src={post.author.picture} alt={post.author.name} referrerPolicy="no-referrer"
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
          ) : post.is_growth ? (
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #0EA5E9, #7C3AED)',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif', fontSize: '0.62rem',
              letterSpacing: '0.1em',
            }}>RSS</div>
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0B1F3A 0%, #7C3AED 100%)',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif',
            }}>{(post.author.name || 'M').charAt(0).toUpperCase()}</div>
          )}
          {!post.is_growth && <PresenceDot userId={post.author.id} size={11} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {post.is_growth ? (
            <span data-testid={`feed-post-author-${post.id}`}
              style={{ fontWeight: 700, fontSize: '0.92rem', color: NAVY }}>
              {post.author.name}
            </span>
          ) : (
            <UserHoverCard userId={post.author.id} fallback={post.author}>
              <span data-testid={`feed-post-author-${post.id}`}
                style={{ fontWeight: 700, fontSize: '0.92rem', color: NAVY, cursor: 'default' }}>
                {post.author.name}
              </span>
            </UserHoverCard>
          )}
          <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
            {post.author.headline || 'Miembro de Punto Cero One'} · {new Date(post.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {post.is_growth && (
          <span data-testid={`feed-post-source-badge-${post.id}`}
            style={{
              fontSize: '0.58rem', letterSpacing: '0.18em', fontWeight: 800,
              padding: '3px 8px', borderRadius: 100,
              background: 'rgba(14,165,233,0.1)', color: '#0369A1',
              border: '1px solid rgba(14,165,233,0.28)',
              whiteSpace: 'nowrap',
            }}>FUENTE PÚBLICA</span>
        )}
        {(isOwner || user?.role === 'admin') && !post.is_growth && (
          <button onClick={handleDelete} data-testid={`feed-post-delete-${post.id}`} aria-label="Eliminar publicación"
            style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}>
            <MoreHorizontal size={16} />
          </button>
        )}
        {!post.is_growth && <FeedPostMenu post={post} onSave={toggleSave} onShare={share} isAuthed={isAuthed} />}
      </div>

      {/* Growth item image (RSS-provided, license-friendly) */}
      {post.is_growth && post.source?.image_url && (
        <a href={post.link_url} target="_blank" rel="noopener noreferrer"
          data-testid={`feed-post-source-image-${post.id}`}
          style={{ display: 'block', margin: '0 1.15rem', borderRadius: 12, overflow: 'hidden' }}>
          <img src={post.source.image_url} alt=""
            referrerPolicy="no-referrer"
            style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} />
        </a>
      )}

      {/* "Por qué ves esta publicación" — surfaces the ranking reasons from /api/feed/for-you */}
      {post.for_you?.reasons?.length > 0 && (
        <div data-testid={`feed-post-why-${post.id}`} title={post.for_you.reasons.join(' · ')}
          style={{
            margin: '-0.4rem 1.15rem 0.6rem',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start',
            padding: '0.28rem 0.7rem', borderRadius: 100,
            background: 'rgba(0,200,150,0.09)', border: '1px solid rgba(0,200,150,0.28)',
            color: '#0B6F52', fontSize: '0.66rem', fontWeight: 600,
            width: 'fit-content', cursor: 'help',
          }}>          <Info size={11} />
          <span>Porque {post.for_you.reasons[0]}</span>
          {post.for_you.reasons.length > 1 && (
            <span style={{ opacity: 0.6, fontWeight: 700 }}>+{post.for_you.reasons.length - 1}</span>
          )}
        </div>
      )}

      {/* body */}
      <div style={{ padding: '0 1.15rem 0.85rem' }}>
        <p style={{
          fontSize: '0.94rem', lineHeight: 1.55, color: 'rgba(11,31,58,0.9)',
          margin: 0, whiteSpace: 'pre-wrap',
        }}>{renderBody(post.body)}</p>
        {post.image_url && (
          <a href={post.image_url.startsWith('http') ? post.image_url : `${process.env.REACT_APP_BACKEND_URL}${post.image_url}`}
             target="_blank" rel="noopener noreferrer"
             data-testid={`feed-post-image-${post.id}`}
             style={{
               display: 'block', marginTop: '0.65rem', borderRadius: 12, overflow: 'hidden',
               background: '#F4F6FB', maxHeight: 520,
             }}>
            <img
              src={post.image_url.startsWith('http') ? post.image_url : `${process.env.REACT_APP_BACKEND_URL}${post.image_url}`}
              alt="Publicación" referrerPolicy="no-referrer" loading="lazy" decoding="async"
              style={{
                width: '100%', height: 'auto', maxHeight: 520,
                objectFit: 'contain', display: 'block', margin: '0 auto',
              }} />
          </a>
        )}
        {post.hashtags?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
            {post.hashtags.map((t) => (
              <span key={t} style={{
                padding: '0.15rem 0.55rem', borderRadius: 100,
                background: 'rgba(0,200,150,0.1)', color: '#00A277',
                fontSize: '0.7rem', fontWeight: 700,
              }}>#{t}</span>
            ))}
          </div>
        )}
        {post.link_url && (
          <a href={post.link_url} target="_blank" rel="noopener noreferrer" data-testid={`feed-post-link-${post.id}`}
            style={{
              marginTop: '0.6rem', display: 'block',
              padding: '0.55rem 0.85rem', borderRadius: 10,
              background: '#F4F6FB', border: '1px solid rgba(11,31,58,0.06)',
              color: NAVY, fontSize: '0.8rem', textDecoration: 'none', wordBreak: 'break-all',
            }}
          >{post.link_url}</a>
        )}
      </div>

      {/* counters row */}
      {!post.is_growth && (
        <div style={{
          padding: '0.35rem 1.15rem',
          display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)',
          borderTop: '1px solid rgba(11,31,58,0.04)',
        }}>
          <span data-testid={`feed-post-reactions-${post.id}`}>{post.counts.reactions} reacciones</span>
          <span>·</span>
          <span data-testid={`feed-post-comments-count-${post.id}`}>{post.counts.comments} comentarios</span>
          <span style={{ marginLeft: 'auto' }}>{post.counts.views} vistas</span>
        </div>
      )}

      {/* actions */}
      {post.is_growth ? (
        <div style={{
          padding: '0.6rem 1.15rem 0.9rem',
          borderTop: '1px solid rgba(11,31,58,0.05)',
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <a href={post.link_url} target="_blank" rel="noopener noreferrer"
            data-testid={`feed-post-source-cta-${post.id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.85rem', borderRadius: 100,
              background: NAVY, color: '#FFFFFF', textDecoration: 'none',
              fontSize: '0.76rem', fontWeight: 700,
            }}>
            Leer en {post.source?.name || 'la fuente'}
          </a>
          <SharePopover open={sharePopoverOpen} onToggle={() => setSharePopoverOpen((v) => !v)}
            onCopy={shareCopyLink} onNative={shareNative} onRepost={shareToPuntoCero}
            postId={post.id} isAuthed={isAuthed} align="right">
            <button data-testid={`feed-post-share-${post.id}`}
              onClick={() => setSharePopoverOpen((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.85rem', borderRadius: 100,
                background: 'rgba(11,31,58,0.05)', color: NAVY, border: 'none', cursor: 'pointer',
                fontSize: '0.76rem', fontWeight: 700,
              }}>
              <Share2 size={13} /> Compartir
            </button>
          </SharePopover>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          padding: '0.4rem 0.55rem', gap: '0.25rem',
          borderTop: '1px solid rgba(11,31,58,0.05)',
        }}>
          <ReactionButton
            testid={`feed-post-react-${post.id}`}
            meta={myReactionMeta}
            onClick={() => react('like')}
            onPickReaction={react}
            disabled={!isAuthed}
          />
          <ActionButton icon={<MessageCircle size={16} />} label="Comentar" onClick={openComments}
            testid={`feed-post-comment-${post.id}`} />
          <SharePopover open={sharePopoverOpen} onToggle={() => setSharePopoverOpen((v) => !v)}
            onCopy={shareCopyLink} onNative={shareNative} onRepost={shareToPuntoCero}
            postId={post.id} isAuthed={isAuthed}>
            <ActionButton icon={<Share2 size={16} />} label="Compartir"
              onClick={() => setSharePopoverOpen((v) => !v)}
              testid={`feed-post-share-${post.id}`} />
          </SharePopover>
          <ActionButton icon={<Bookmark size={16} />} label={post.my_saved ? 'Guardado' : 'Guardar'}
            active={post.my_saved} onClick={toggleSave} disabled={!isAuthed}
            testid={`feed-post-save-${post.id}`} />
        </div>
      )}

      {shareToast && (
        <div data-testid={`feed-post-share-toast-${post.id}`}
          style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            padding: '0.45rem 0.9rem', borderRadius: 100, background: NAVY, color: '#FFFFFF',
            fontSize: '0.72rem', fontWeight: 700, zIndex: 30,
            boxShadow: '0 8px 24px rgba(11,31,58,0.25)',
          }}>{shareToast}</div>
      )}

      {/* comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            data-testid={`feed-post-comments-${post.id}`}
            style={{
              padding: '0.5rem 1.15rem 1rem',
              borderTop: '1px solid rgba(11,31,58,0.05)',
              background: '#FAFBFD',
            }}
          >
            {isAuthed && (
              <form onSubmit={submitComment} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text" value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Escribe un comentario…"
                  data-testid={`feed-post-comment-input-${post.id}`}
                  style={{
                    flex: 1, padding: '0.55rem 0.85rem', borderRadius: 100,
                    border: '1px solid rgba(11,31,58,0.12)', outline: 'none',
                    fontSize: '0.85rem',
                  }}
                />
                <button type="submit" disabled={!commentBody.trim() || busy}
                  data-testid={`feed-post-comment-submit-${post.id}`} aria-label="Publicar comentario"
                  style={{
                    padding: '0.5rem 0.85rem', borderRadius: 100, border: 'none',
                    background: NAVY, color: '#FFFFFF', cursor: 'pointer', fontSize: '0.8rem',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <Send size={12} />
                </button>
              </form>
            )}
            {comments.length === 0 && commentsLoaded && (
              <div style={{ fontSize: '0.8rem', color: 'rgba(11,31,58,0.5)' }}>Sé el primero en comentar.</div>
            )}
            {comments.map((c) => (
              <div key={c.id} data-testid={`feed-comment-${c.id}`}
                style={{ display: 'flex', gap: '0.55rem', padding: '0.4rem 0', alignItems: 'flex-start' }}>
                {c.author.picture ? (
                  <img src={c.author.picture} alt={c.author.name} referrerPolicy="no-referrer"
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0A0F1C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                    {(c.author.name || 'M').charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '0.4rem 0.75rem', border: '1px solid rgba(11,31,58,0.06)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY }}>{c.author.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(11,31,58,0.85)' }}>{c.body}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

const renderBody = (raw) => {
  if (!raw) return null;
  // simple hashtag/link linkifier — highlights #tags, leaves the rest as text.
  const parts = raw.split(/(#[a-zA-Z0-9_ñáéíóúü]+)/g);
  return parts.map((p, i) => (
    p.startsWith('#')
      ? <span key={i} style={{ color: '#00A277', fontWeight: 600 }}>{p}</span>
      : <React.Fragment key={i}>{p}</React.Fragment>
  ));
};

const ActionButton = ({ icon, label, onClick, active, disabled, testid }) => (
  <button
    onClick={onClick} disabled={disabled}
    data-testid={testid}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: '0.4rem', padding: '0.55rem', borderRadius: 8,
      background: active ? 'rgba(0,200,150,0.1)' : 'transparent',
      border: 'none', color: active ? '#00A277' : 'rgba(11,31,58,0.7)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.8rem', fontWeight: 600, opacity: disabled ? 0.55 : 1,
      transition: 'background 0.15s',
    }}
    onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = 'rgba(11,31,58,0.04)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >{icon}<span>{label}</span></button>
);

const ReactionButton = ({ meta, onClick, onPickReaction, disabled, testid }) => {
  const [showPicker, setShowPicker] = useState(false);
  const closeTimer = React.useRef(null);
  const open = () => { clearTimeout(closeTimer.current); setShowPicker(true); };
  const close = () => { closeTimer.current = setTimeout(() => setShowPicker(false), 250); };

  return (
    <div style={{ position: 'relative' }} onMouseEnter={open} onMouseLeave={close}>
      <button onClick={onClick} disabled={disabled} data-testid={testid}
        style={{
          width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.4rem', padding: '0.55rem', borderRadius: 8,
          background: meta ? `${meta.color}18` : 'transparent',
          border: 'none', color: meta ? meta.color : 'rgba(11,31,58,0.7)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.8rem', fontWeight: 600, opacity: disabled ? 0.55 : 1,
        }}>
        {meta
          ? (<><meta.icon size={16} /><span>{meta.label}</span></>)
          : (<><Heart size={16} /><span>Reaccionar</span></>)}
      </button>
      <AnimatePresence>
        {showPicker && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            data-testid={`${testid}-picker`}
            style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', gap: '0.35rem', padding: '0.4rem 0.55rem',
              background: '#FFFFFF', borderRadius: 100,
              boxShadow: '0 8px 32px rgba(11,31,58,0.15)',
              border: '1px solid rgba(11,31,58,0.06)', zIndex: 5,
            }}
          >
            {REACTIONS.map((r) => (
              <button key={r.kind} onClick={() => { onPickReaction(r.kind); setShowPicker(false); }}
                data-testid={`${testid}-picker-${r.kind}`}
                title={r.label}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: `${r.color}18`, color: r.color, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <r.icon size={14} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(FeedPostCard, (prev, next) => (
  // FeedPostCard is a large tree that owns its own internal state. It only
  // needs to re-render if the post identity or any field the card actually
  // renders changed. We compare a small signature to skip the vast majority
  // of parent-driven re-renders (feed scroll, sibling updates).
  //
  // Every field below is one the card paints: `author.picture` is the avatar
  // and `for_you.reasons` renders the "Porque …" chip, so omitting them left
  // real updates invisible until the user reloaded the feed.
  prev.post?.id === next.post?.id &&
  prev.post?.updated_at === next.post?.updated_at &&
  prev.post?.image_url === next.post?.image_url &&
  prev.post?.body === next.post?.body &&
  prev.post?.counts?.reactions === next.post?.counts?.reactions &&
  prev.post?.counts?.comments === next.post?.counts?.comments &&
  prev.post?.counts?.saves === next.post?.counts?.saves &&
  prev.post?.counts?.shares === next.post?.counts?.shares &&
  prev.post?.author?.picture === next.post?.author?.picture &&
  (prev.post?.for_you?.reasons?.join('|') || '') === (next.post?.for_you?.reasons?.join('|') || '') &&
  prev.post?.my_reaction === next.post?.my_reaction &&
  prev.post?.my_saved === next.post?.my_saved
));

const FeedPostMenu = ({ post, onSave, onShare, isAuthed }) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');
  const [reportDone, setReportDone] = React.useState('');
  const menuRef = React.useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const copyLink = async (e) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/?post=${post.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };
  const report = async (e) => {
    e.stopPropagation();
    try {
      await feedService.report(post.id, reportReason);
      setReportDone('Reporte enviado. Gracias.');
    } catch {
      setReportDone('No se pudo enviar el reporte.');
    }
    setReportOpen(false);
    setTimeout(() => setReportDone(''), 2500);
  };

  const items = [
    { label: copied ? '¡Enlace copiado!' : 'Copiar enlace', icon: Copy, onClick: copyLink, testid: `menu-copy-${post.id}` },
    { label: 'Compartir', icon: Share2, onClick: (e) => { e.stopPropagation(); onShare(); setOpen(false); }, testid: `menu-share-${post.id}` },
    { label: post.my_saved ? 'Quitar de guardados' : 'Guardar', icon: Bookmark, onClick: (e) => { e.stopPropagation(); onSave(); setOpen(false); }, testid: `menu-save-${post.id}`, hidden: !isAuthed },
    { label: 'Ver empresa', icon: Building2, onClick: (e) => { e.stopPropagation(); setOpen(false); navigate('/empresas'); }, testid: `menu-company-${post.id}` },
    { label: 'Seguir autor', icon: UserPlus, onClick: (e) => { e.stopPropagation(); setReportDone('Seguir autores estará disponible próximamente.'); setTimeout(() => setReportDone(''), 2500); setOpen(false); }, testid: `menu-follow-${post.id}`, hidden: !isAuthed },
    { label: 'Reportar', icon: Flag, onClick: (e) => { e.stopPropagation(); setReportOpen(true); setOpen(false); }, testid: `menu-report-${post.id}`, danger: true, hidden: !isAuthed },
  ].filter((x) => !x.hidden);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        data-testid={`feed-post-menu-${post.id}`} aria-label="Menú de opciones de la publicación"
        style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.55)', cursor: 'pointer', padding: 4 }}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          data-testid={`feed-post-menu-open-${post.id}`}
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 30,
            minWidth: 220, background: '#FFFFFF', borderRadius: 12,
            boxShadow: '0 20px 50px rgba(11,31,58,0.18), 0 0 0 1px rgba(11,31,58,0.06)',
            overflow: 'hidden', padding: '0.4rem 0',
          }}>
          {items.map((it) => (
            <button key={it.label} onClick={it.onClick} data-testid={it.testid}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '0.6rem 1rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: it.danger ? '#B91C1C' : '#0B1F3A',
                fontSize: '0.82rem', textAlign: 'left', fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(11,31,58,0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <it.icon size={14} /> {it.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Inline report form — replaces window.prompt + alert */}
      {reportOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          data-testid={`feed-post-report-form-${post.id}`}
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 30,
            width: 260, padding: '0.8rem',
            background: '#FFFFFF', borderRadius: 12,
            boxShadow: '0 20px 50px rgba(11,31,58,0.18), 0 0 0 1px rgba(11,31,58,0.06)',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY, marginBottom: 6 }}>
            ¿Por qué reportas esta publicación?
          </div>
          <input
            autoFocus value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Contenido inapropiado, spam…"
            data-testid={`feed-post-report-input-${post.id}`}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem',
              border: '1px solid rgba(11,31,58,0.12)', borderRadius: 8,
              fontSize: '0.8rem', marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setReportOpen(false); setReportReason(''); }}
              data-testid={`feed-post-report-cancel-${post.id}`}
              style={{
                padding: '0.4rem 0.75rem', borderRadius: 100, border: '1px solid rgba(11,31,58,0.12)',
                background: 'transparent', color: NAVY, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              }}>Cancelar</button>
            <button type="button" disabled={!reportReason.trim()} onClick={report}
              data-testid={`feed-post-report-submit-${post.id}`}
              style={{
                padding: '0.4rem 0.85rem', borderRadius: 100, border: 'none',
                background: reportReason.trim() ? '#B91C1C' : 'rgba(11,31,58,0.12)',
                color: '#FFFFFF', cursor: reportReason.trim() ? 'pointer' : 'not-allowed',
                fontSize: '0.78rem', fontWeight: 700,
              }}>Enviar</button>
          </div>
        </motion.div>
      )}

      {reportDone && (
        <div
          data-testid={`feed-post-menu-toast-${post.id}`}
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 31,
            padding: '0.5rem 0.75rem', borderRadius: 10, maxWidth: 260,
            background: '#FFFFFF', color: NAVY,
            border: '1px solid rgba(11,31,58,0.08)',
            boxShadow: '0 12px 32px rgba(11,31,58,0.14)',
            fontSize: '0.76rem', fontWeight: 600,
          }}
        >{reportDone}</div>
      )}
    </div>
  );
};

/**
 * SharePopover — inline popover with the 3 share options.
 *
 *   1. Copiar enlace              (clipboard, always available)
 *   2. Compartir a Punto Cero     (repost — auth-gated)
 *   3. Compartir por…             (Web Share API — if supported)
 *
 * Renders its trigger via `children` so the caller keeps full control of
 * layout/testid. The popover positions relative to the trigger using
 * position:absolute inside a wrapping <span>.
 */
const SharePopover = ({ open, onToggle, onCopy, onNative, onRepost, postId, isAuthed, align = 'left', children }) => {
  const nativeAvailable = typeof navigator !== 'undefined' && !!navigator.share;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      {open && (
        <>
          <div onClick={onToggle} style={{
            position: 'fixed', inset: 0, zIndex: 40,
          }} />
          <div data-testid={`feed-post-share-popover-${postId}`}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)',
              [align === 'right' ? 'right' : 'left']: 0,
              zIndex: 41, minWidth: 220,
              background: '#FFFFFF', borderRadius: 12,
              border: '1px solid rgba(11,31,58,0.08)',
              boxShadow: '0 20px 60px rgba(11,31,58,0.15)',
              padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
            }}>
            <SharePopoverItem icon={<Copy size={14} />} label="Copiar enlace" onClick={onCopy}
              testid={`feed-post-share-copy-${postId}`} />
            <SharePopoverItem icon={<Send size={14} />} label="Compartir en Punto Cero"
              onClick={onRepost} disabled={!isAuthed}
              hint={!isAuthed ? 'Inicia sesión' : null}
              testid={`feed-post-share-internal-${postId}`} />
            {nativeAvailable && (
              <SharePopoverItem icon={<Share2 size={14} />} label="Compartir por…"
                onClick={onNative}
                testid={`feed-post-share-native-${postId}`} />
            )}
          </div>
        </>
      )}
    </span>
  );
};

const SharePopoverItem = ({ icon, label, onClick, disabled, hint, testid }) => (
  <button onClick={onClick} disabled={disabled} data-testid={testid}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0.55rem 0.75rem', borderRadius: 8,
      background: 'transparent', border: 'none', color: NAVY,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.82rem', fontWeight: 600, textAlign: 'left',
      opacity: disabled ? 0.55 : 1,
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(11,31,58,0.05)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
    {icon}
    <span style={{ flex: 1 }}>{label}</span>
    {hint && <span style={{ fontSize: '0.65rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</span>}
  </button>
);
