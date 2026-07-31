import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, Send, MoreHorizontal, Lightbulb, Trophy, HandHeart, HelpCircle, Info, Copy, Flag, UserPlus, Building2 } from 'lucide-react';
import PresenceDot from './PresenceDot';
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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';
  const isOwner = isAuthed && user?.id === post.author.id;

  // Register a view once per session for this post
  useEffect(() => {
    feedService.view(post.id, getViewSessionId()).catch(() => {});
  }, [post.id]);

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

  const share = async () => {
    setPost((p) => ({ ...p, counts: { ...p.counts, shares: p.counts.shares + 1 } }));
    try {
      const url = `${window.location.origin}/?post=${post.id}`;
      if (navigator.share) { await navigator.share({ title: 'Punto Cero One', url }); }
      else { await navigator.clipboard?.writeText(url); }
      await feedService.share(post.id, navigator.share ? 'native' : 'clipboard');
    } catch { /* ignore */ }
  };

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
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0B1F3A 0%, #7C3AED 100%)',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif',
            }}>{(post.author.name || 'M').charAt(0).toUpperCase()}</div>
          )}
          <PresenceDot userId={post.author.id} size={11} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div data-testid={`feed-post-author-${post.id}`} style={{ fontWeight: 700, fontSize: '0.92rem', color: NAVY }}>{post.author.name}</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
            {post.author.headline || 'Miembro de Punto Cero One'} · {new Date(post.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {(isOwner || user?.role === 'admin') && (
          <button onClick={handleDelete} data-testid={`feed-post-delete-${post.id}`}
            style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}>
            <MoreHorizontal size={16} />
          </button>
        )}
        <FeedPostMenu post={post} onSave={toggleSave} onShare={share} isAuthed={isAuthed} />
      </div>

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
          }}>
          <Info size={11} />
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

      {/* actions */}
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
        <ActionButton icon={<Share2 size={16} />} label="Compartir" onClick={share}
          testid={`feed-post-share-${post.id}`} />
        <ActionButton icon={<Bookmark size={16} />} label={post.my_saved ? 'Guardado' : 'Guardar'}
          active={post.my_saved} onClick={toggleSave} disabled={!isAuthed}
          testid={`feed-post-save-${post.id}`} />
      </div>

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
                  data-testid={`feed-post-comment-submit-${post.id}`}
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

export default FeedPostCard;

const FeedPostMenu = ({ post, onSave, onShare, isAuthed }) => {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const menuRef = React.useRef(null);

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
    const reason = window.prompt('¿Por qué reportas esta publicación?');
    if (!reason) return;
    try { await feedService.report(post.id, reason); alert('Reporte enviado. Gracias.'); }
    catch { alert('No se pudo enviar el reporte.'); }
    setOpen(false);
  };

  const items = [
    { label: copied ? '¡Enlace copiado!' : 'Copiar enlace', icon: Copy, onClick: copyLink, testid: `menu-copy-${post.id}` },
    { label: 'Compartir', icon: Share2, onClick: (e) => { e.stopPropagation(); onShare(); setOpen(false); }, testid: `menu-share-${post.id}` },
    { label: post.my_saved ? 'Quitar de guardados' : 'Guardar', icon: Bookmark, onClick: (e) => { e.stopPropagation(); onSave(); setOpen(false); }, testid: `menu-save-${post.id}`, hidden: !isAuthed },
    { label: 'Ver empresa', icon: Building2, onClick: (e) => { e.stopPropagation(); window.location.href = '/empresas'; }, testid: `menu-company-${post.id}` },
    { label: 'Seguir autor', icon: UserPlus, onClick: (e) => { e.stopPropagation(); alert('Próximamente'); setOpen(false); }, testid: `menu-follow-${post.id}`, hidden: !isAuthed },
    { label: 'Reportar', icon: Flag, onClick: report, testid: `menu-report-${post.id}`, danger: true, hidden: !isAuthed },
  ].filter((x) => !x.hidden);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        data-testid={`feed-post-menu-${post.id}`}
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
    </div>
  );
};
