import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, X, Send, Shield, Check } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { groupsService } from '../services/feedService';

const CommunityPage = () => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(null);

  const load = useCallback(() => {
    groupsService.list({ category: activeCat || undefined }).then((d) => setGroups(d.items || []))
      .catch(() => setGroups([]));
  }, [activeCat]);

  useEffect(() => {
    groupsService.categories().then((d) => setCategories(d.categories || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const join = async (g) => {
    if (!isAuthed) { window.location.assign('/join'); return; }
    try {
      await groupsService.join(g.id);
      load();
    } catch { /* silent */ }
  };

  return (
    <CategoryPage
      icon="community"
      eyebrow="Comunidades profesionales"
      title="Encuentra tu tribu profesional en LATAM"
      subtitle="Grupos por vertical, país y disciplina. Únete o crea el tuyo."
      testid="community-page"
    >
      <div style={{
        display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <CatChip label="Todas" active={!activeCat} onClick={() => setActiveCat(null)} testid="community-cat-all" />
        {categories.map((c) => (
          <CatChip key={c.key} label={c.label} active={activeCat === c.key}
            onClick={() => setActiveCat(c.key)} testid={`community-cat-${c.key}`} />
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button data-testid="community-create-btn"
            onClick={() => (isAuthed ? setCreatorOpen(true) : window.location.assign('/join'))}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.55rem 1rem', borderRadius: 100,
              background: NAVY, color: '#FFFFFF', border: 'none',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            }}>
            <Plus size={14} /> Crear grupo
          </button>
        </div>
      </div>

      <div data-testid="community-groups-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        {groups.map((g, idx) => (
          <motion.article key={g.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.03 }}
            data-testid={`group-item-${g.id}`}
            onClick={() => setDetailOpen(g.id)}
            style={{
              background: '#FFFFFF', borderRadius: 16,
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              display: 'flex', flexDirection: 'column',
              cursor: 'pointer', overflow: 'hidden',
            }}
          >
            <div style={{
              height: 96,
              background: g.cover_url
                ? `center / cover no-repeat url(${g.cover_url.startsWith('http') ? g.cover_url : `${process.env.REACT_APP_BACKEND_URL}${g.cover_url}`})`
                : 'linear-gradient(135deg, #0B1F3A, #4C1D95, #7C3AED)',
            }} />
            <div style={{ padding: '0.9rem 1.15rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)',
                  color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -30, border: '3px solid #FFFFFF',
                }}>
                  <Users size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '1rem', fontWeight: 700, color: NAVY, margin: 0, letterSpacing: '-0.01em',
                  }}>{g.name}</h2>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>
                    {g.category} · {g.members_count} {g.members_count === 1 ? 'miembro' : 'miembros'}
                  </div>
                </div>
                {g.privacy === 'private' && <Shield size={13} color="#5B21B6" />}
              </div>
              {g.description && (
                <p style={{
                  fontSize: '0.82rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{g.description}</p>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {g.is_member ? (
                  <span data-testid={`group-joined-${g.id}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '0.4rem 0.75rem', borderRadius: 100,
                    background: 'rgba(0,200,150,0.13)', color: '#00825E',
                    fontSize: '0.75rem', fontWeight: 700,
                  }}><Check size={12} /> Miembro</span>
                ) : (
                  <button data-testid={`group-join-${g.id}`}
                    onClick={(e) => { e.stopPropagation(); join(g); }}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 100,
                      background: NAVY, color: '#FFFFFF', border: 'none',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    }}>
                    Unirme al grupo
                  </button>
                )}
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {groups.length === 0 && (
        <div data-testid="community-empty" style={{
          padding: '2rem', textAlign: 'center', borderRadius: 16,
          background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)',
          color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem',
        }}>Aún no hay grupos en esta categoría. ¡Sé el primero en crear uno!</div>
      )}

      {creatorOpen && (
        <GroupCreator categories={categories} onClose={() => setCreatorOpen(false)}
          onCreated={() => { setCreatorOpen(false); load(); }} />
      )}

      {detailOpen && (
        <GroupDetail groupId={detailOpen} onClose={() => setDetailOpen(null)} onChanged={load} />
      )}
    </CategoryPage>
  );
};

const CatChip = ({ label, active, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid} style={{
    padding: '0.35rem 0.85rem', borderRadius: 100, cursor: 'pointer',
    background: active ? 'rgba(11,31,58,0.9)' : '#FFFFFF',
    border: `1px solid ${active ? NAVY : 'rgba(11,31,58,0.12)'}`,
    color: active ? '#FFFFFF' : NAVY,
    fontSize: '0.74rem', fontWeight: 700,
  }}>{label}</button>
);

const GroupCreator = ({ categories, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', description: '', category: categories[0]?.key || 'marketing', privacy: 'public', rules: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setErr('');
    try {
      await groupsService.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        privacy: form.privacy,
        rules: form.rules.trim() || undefined,
      });
      onCreated();
    } catch (e2) { setErr(e2.message || 'No se pudo crear'); } finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} data-testid="group-creator-backdrop" style={{
      position: 'fixed', inset: 0, background: 'rgba(10,15,28,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1.5rem',
    }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        data-testid="group-creator"
        style={{
          width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: 16,
          padding: '1.5rem 1.65rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#00A277', fontWeight: 700 }}>NUEVO GRUPO</div>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.25rem', color: NAVY, margin: '0.15rem 0 0' }}>Crea tu comunidad</h3>
          </div>
          <button type="button" onClick={onClose} data-testid="group-creator-close"
            style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <Field label="Nombre"><input value={form.name} data-testid="group-creator-name" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inp} required minLength={2} /></Field>
        <Field label="Descripción"><textarea value={form.description} data-testid="group-creator-description" onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gap: '0.65rem', gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Categoría"><select value={form.category} data-testid="group-creator-category" onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inp}>{categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
          <Field label="Privacidad"><select value={form.privacy} data-testid="group-creator-privacy" onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.value }))} style={inp}><option value="public">Público</option><option value="private">Privado</option></select></Field>
        </div>
        <Field label="Normas del grupo (opcional)"><textarea value={form.rules} data-testid="group-creator-rules" onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Field>
        {err && <div data-testid="group-creator-error" style={{ color: '#B91C1C', fontSize: '0.8rem' }}>{err}</div>}
        <button type="submit" disabled={busy} data-testid="group-creator-submit" style={{ marginTop: '0.35rem', padding: '0.7rem 1.15rem', borderRadius: 100, border: 'none', background: NAVY, color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem', cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Creando…' : 'Crear grupo'}</button>
      </form>
    </div>
  );
};

const GroupDetail = ({ groupId, onClose, onChanged }) => {
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  const reload = useCallback(async () => {
    const [g, m, p] = await Promise.all([
      groupsService.get(groupId),
      groupsService.members(groupId),
      groupsService.posts(groupId),
    ]);
    setGroup(g); setMembers(m.items || []); setPosts(p.items || []);
  }, [groupId]);

  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const join = async () => { await groupsService.join(groupId); await reload(); onChanged?.(); };
  const leave = async () => { await groupsService.leave(groupId); await reload(); onChanged?.(); };
  const publish = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try { await groupsService.createPost(groupId, body.trim()); setBody(''); await reload(); }
    finally { setBusy(false); }
  };

  if (!group) return null;
  return (
    <div onClick={onClose} data-testid="group-detail-backdrop" style={{
      position: 'fixed', inset: 0, background: 'rgba(10,15,28,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1.5rem',
      overflow: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} data-testid="group-detail" style={{
        width: 'min(640px, 100%)', maxHeight: '90vh', overflow: 'auto',
        background: '#FFFFFF', borderRadius: 16,
      }}>
        <GroupCoverStrip group={group} onChanged={reload} />
        <div style={{ padding: '1.25rem 1.65rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#00A277', fontWeight: 700 }}>{group.category?.toUpperCase()}</div>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.3rem', color: NAVY, margin: '0.15rem 0 0.35rem' }}>{group.name}</h3>
            <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)' }}>
              {group.members_count} miembros · {group.posts_count} publicaciones · {group.privacy === 'private' ? 'Privado' : 'Público'}
            </div>
          </div>
          <button onClick={onClose} data-testid="group-detail-close" style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {group.description && <p style={{ marginTop: '0.85rem', fontSize: '0.88rem', color: 'rgba(11,31,58,0.78)', lineHeight: 1.5 }}>{group.description}</p>}
        {group.rules && (
          <div style={{ marginTop: '0.75rem', padding: '0.8rem', background: '#F4F6FB', borderRadius: 10, fontSize: '0.82rem', color: NAVY }}>
            <b>Normas:</b> {group.rules}
          </div>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
          {group.is_member ? (
            <button onClick={leave} data-testid="group-detail-leave" style={{ padding: '0.5rem 1rem', borderRadius: 100, background: 'rgba(11,31,58,0.06)', border: '1px solid rgba(11,31,58,0.12)', color: NAVY, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Salir del grupo</button>
          ) : (
            <button onClick={isAuthed ? join : () => window.location.assign('/join')} data-testid="group-detail-join" style={{ padding: '0.5rem 1rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>{isAuthed ? 'Unirme al grupo' : 'Unirse para participar'}</button>
          )}
        </div>

        {group.is_member && (
          <form onSubmit={publish} style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
            <input value={body} onChange={(e) => setBody(e.target.value)} data-testid="group-detail-post-input" placeholder="Publica algo al grupo…" style={inp} />
            <button type="submit" disabled={!body.trim() || busy} data-testid="group-detail-post-submit" style={{ padding: '0.55rem 0.85rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: body.trim() ? 'pointer' : 'not-allowed' }}><Send size={13} /></button>
          </form>
        )}

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: 'rgba(11,31,58,0.5)', marginBottom: '0.5rem' }}>PUBLICACIONES</div>
          {posts.length === 0 && <div style={{ padding: '0.85rem', fontSize: '0.82rem', color: 'rgba(11,31,58,0.55)' }}>Aún no hay publicaciones en este grupo.</div>}
          {posts.map((p) => (
            <div key={p.id} data-testid={`group-post-${p.id}`} style={{ display: 'flex', gap: 10, padding: '0.7rem 0', borderBottom: '1px solid rgba(11,31,58,0.06)' }}>
              {p.author?.picture ? <img src={p.author.picture} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0A0F1C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(p.author?.name || 'M').charAt(0).toUpperCase()}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY }}>{p.author?.name || 'Miembro'}</div>
                <div style={{ fontSize: '0.86rem', color: 'rgba(11,31,58,0.85)', lineHeight: 1.45 }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: 'rgba(11,31,58,0.5)', marginBottom: '0.5rem' }}>MIEMBROS ({members.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {members.slice(0, 20).map((m) => (
              <div key={m.id} data-testid={`group-member-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.6rem', borderRadius: 100, background: 'rgba(11,31,58,0.05)' }}>
                {m.picture ? <img src={m.picture} alt="" referrerPolicy="no-referrer" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0A0F1C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>{(m.name || 'M').charAt(0).toUpperCase()}</div>}
                <span style={{ fontSize: '0.75rem', color: NAVY }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

const GroupCoverStrip = ({ group, onChanged }) => {
  const inputRef = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const cover = group.cover_url
    ? (group.cover_url.startsWith('http') ? group.cover_url : `${process.env.REACT_APP_BACKEND_URL}${group.cover_url}`)
    : null;

  const upload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/groups/${group.id}/cover`, {
        method: 'PUT', body: form, credentials: 'include',
      });
      if (!res.ok) throw new Error();
      await onChanged?.();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/groups/${group.id}/cover`, {
        method: 'DELETE', credentials: 'include',
      });
      await onChanged?.();
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      position: 'relative', height: 130, borderRadius: '16px 16px 0 0', overflow: 'hidden',
      background: cover
        ? `center / cover no-repeat url(${cover})`
        : 'linear-gradient(135deg, #0B1F3A, #4C1D95, #7C3AED)',
    }}>
      {group.is_admin && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={upload}
            data-testid="group-cover-input" style={{ display: 'none' }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            data-testid="group-cover-upload"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.7rem', borderRadius: 100, background: 'rgba(255,255,255,0.9)', border: 'none', color: NAVY, fontSize: '0.68rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
            {cover ? 'Cambiar portada' : 'Subir portada'}
          </button>
          {cover && (
            <button onClick={clear} disabled={busy} data-testid="group-cover-delete"
              style={{ padding: '0.35rem 0.55rem', borderRadius: 100, background: 'rgba(11,31,58,0.8)', border: 'none', color: '#FFFFFF', fontSize: '0.68rem', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
              Quitar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.5)', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.3rem' }}>{label.toUpperCase()}</div>
    {children}
  </label>
);
const inp = { width: '100%', padding: '0.55rem 0.75rem', borderRadius: 10, border: '1px solid rgba(11,31,58,0.14)', outline: 'none', background: '#FFFFFF', color: NAVY, fontSize: '0.88rem', fontFamily: 'inherit' };

export default CommunityPage;
