import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Send } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { messagingService } from '../services/coreServices';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useRealtime } from '../contexts/RealtimeContext';
import PresenceDot from '../components/community/PresenceDot';

// Human-friendly relative time ("hace 5 min", "ayer", "18 jul").
const relTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

const MessagesPage = () => {
  const { user } = useCommunityAuth();
  const { subscribe, status } = useRealtime();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConvs = useCallback(async () => {
    try { const d = await messagingService.listConversations(); setConversations(d.items || []); }
    catch { /* noop */ }
  }, []);

  useEffect(() => { if (user) loadConvs(); }, [user, loadConvs]);

  // Deep-link: /mensajes navigated with state.conversationId (from the
  // Messages widget) auto-opens that conversation.
  useEffect(() => {
    const wantId = location.state?.conversationId;
    if (!wantId || active?.id === wantId) return;
    const found = conversations.find((c) => c.id === wantId);
    if (found) { openConv(found); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, location.state]);

  // Live: incoming `message` events either append to the open conversation or
  // bump the unread counter of the corresponding sidebar entry.
  useEffect(() => {
    if (!user) return;
    const off = subscribe('message', (evt) => {
      const convId = evt?.conversation_id;
      const msg = evt?.message;
      if (!convId || !msg) return;
      if (active?.id === convId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      setConversations((prev) => prev.map((c) => (
        c.id === convId
          ? { ...c, last_message: msg, updated_at: msg.created_at, unread_count: active?.id === convId ? 0 : (c.unread_count || 0) + 1 }
          : c
      )));
    });
    return off;
  }, [user, active?.id, subscribe]);

  const openConv = async (c) => {
    setActive(c);
    try { setMessages(await messagingService.listMessages(c.id)); }
    catch { setMessages([]); }
    // Reflect read-status locally (backend clears server-side on listMessages).
    setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)));
  };

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || !active || busy) return;
    setBusy(true);
    try {
      const m = await messagingService.send(active.id, { body: body.trim() });
      setMessages((p) => (p.some((x) => x.id === m.id) ? p : [...p, m])); setBody('');
    } catch { /* noop */ } finally { setBusy(false); }
  };

  if (user === undefined) return null;
  if (!user) return <Navigate to="/join" replace />;

  return (
    <CategoryPage icon="community" eyebrow="Messaging Service" title="Mensajes"
      subtitle="Conecta con miembros y empresas de todas las verticales del ecosistema."
      testid="messages-page">
      <div data-testid="messages-realtime-status" style={{ position: 'absolute', top: 8, right: 12, fontSize: '0.65rem', color: 'rgba(11,31,58,0.55)' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6, background: status === 'open' ? '#00C896' : status === 'connecting' ? '#F59E0B' : '#9CA3AF' }} />
        {status === 'open' ? 'Live' : status === 'connecting' ? 'Conectando…' : 'Sin conexión live'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '0.85rem', minHeight: 480 }}>
        <div data-testid="messages-conversations" style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(11,31,58,0.06)', overflow: 'auto' }}>
          {conversations.length === 0 && (

            <div data-testid="messages-empty" style={{

              padding: '1.5rem 1rem', textAlign: 'center', borderRadius: 12,

              border: '1px dashed rgba(11,31,58,0.12)', background: 'rgba(11,31,58,0.02)',

            }}>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>

                Todavía no tienes conversaciones

              </div>

              <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)', margin: '0.3rem 0 0.7rem' }}>

                Conecta con la comunidad para empezar a conversar.

              </div>

              <Link to="/comunidad" data-testid="messages-empty-cta-community" style={{

                display: 'inline-flex', padding: '0.4rem 0.9rem', borderRadius: 100,

                background: '#00C896', color: NAVY, fontSize: '0.74rem', fontWeight: 800, textDecoration: 'none',

              }}>Buscar en la comunidad</Link>

            </div>

          )}
          {conversations.map((c) => {
            const other = c.participants.find((p) => p.id !== user.id) || c.participants[0];
            const preview = c.last_message?.body || 'Sin mensajes aún';
            const when = c.last_message?.created_at || c.updated_at;
            const isActive = active?.id === c.id;
            return (
              <button key={c.id} onClick={() => openConv(c)}
                data-testid={`messages-conv-${c.id}`}
                style={{ width: '100%', padding: '0.85rem 1rem', textAlign: 'left', display: 'flex', gap: '0.7rem', alignItems: 'center',
                         background: isActive ? 'linear-gradient(135deg, rgba(0,200,150,0.10), rgba(0,200,150,0.02))' : 'transparent',
                         border: 'none', borderBottom: '1px solid rgba(11,31,58,0.05)', cursor: 'pointer',
                         transition: 'background 0.2s ease' }}>
                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${NAVY}, #7C3AED)`,
                                color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1rem' }}>
                    {(other.name || '·').charAt(0).toUpperCase()}
                  </div>
                  {other.kind === 'user' && other.id !== user.id && (
                    <PresenceDot userId={other.id} size={11} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: '0.87rem', fontWeight: 700, color: NAVY,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {other.name}
                    </div>
                    {when && (
                      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)', flexShrink: 0, fontWeight: 500 }}>
                        {relTime(when)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem',
                                  color: c.unread_count > 0 ? NAVY : 'rgba(11,31,58,0.55)',
                                  fontWeight: c.unread_count > 0 ? 600 : 400,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preview}
                    </div>
                    {c.unread_count > 0 && (
                      <span data-testid={`messages-unread-${c.id}`}
                            style={{ background: '#EF4444', color: '#FFFFFF',
                                     fontSize: '0.6rem', fontWeight: 800,
                                     padding: '2px 7px', borderRadius: 100,
                                     minWidth: 20, textAlign: 'center' }}>
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(11,31,58,0.06)', display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <>
              <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid rgba(11,31,58,0.06)',
                            display: 'flex', alignItems: 'center', gap: 10 }}>
                {(() => {
                  const peer = active.participants.find((p) => p.id !== user.id) || {};
                  return (
                    <>
                      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%',
                                      background: `linear-gradient(135deg, ${NAVY}, #7C3AED)`,
                                      color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>
                          {(peer.name || '·').charAt(0).toUpperCase()}
                        </div>
                        {peer.kind === 'user' && <PresenceDot userId={peer.id} size={10} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: '0.9rem' }}>{peer.name}</div>
                        {peer.kind === 'user' && (
                          <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.55)' }}>
                            <PresenceDot userId={peer.id} size={7} inline showLabel />
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div data-testid="messages-list" style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {messages.map((m) => {
                  const mine = m.sender.id === user.id;
                  return (
                    <div key={m.id} data-testid={`message-${m.id}`}
                      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%',
                               padding: '0.55rem 0.85rem', borderRadius: 14,
                               background: mine ? NAVY : 'rgba(11,31,58,0.06)', color: mine ? '#FFFFFF' : NAVY,
                               fontSize: '0.86rem' }}>{m.body}</div>
                  );
                })}
                {messages.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(11,31,58,0.45)', fontSize: '0.82rem' }}>Envía el primer mensaje.</div>}
              </div>
              <form onSubmit={send} style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid rgba(11,31,58,0.06)', alignItems: 'flex-end' }}>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un mensaje…"
                  data-testid="messages-input" rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
                  }}
                  ref={(el) => {
                    if (!el) return;
                    // auto-grow: reset then match scrollHeight, clamped by CSS max-height
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
                  }}
                  style={{ flex: 1, padding: '0.6rem 0.9rem', borderRadius: 18,
                    border: '1px solid rgba(11,31,58,0.12)', outline: 'none',
                    fontSize: '0.85rem', fontFamily: 'inherit',
                    resize: 'none', lineHeight: 1.4, maxHeight: 140, overflowY: 'auto' }} />
                <button type="submit" disabled={busy || !body.trim()} data-testid="messages-send" aria-label="Enviar mensaje"
                  style={{ padding: '0.5rem 0.85rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer', height: 40 }}>
                  <Send size={13} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(11,31,58,0.5)', fontSize: '0.9rem' }}>
              Selecciona una conversación para comenzar
            </div>
          )}
        </div>
      </div>
    </CategoryPage>
  );
};

export default MessagesPage;
