import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { messagingService } from '../services/coreServices';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useRealtime } from '../contexts/RealtimeContext';

const MessagesPage = () => {
  const { user } = useCommunityAuth();
  const { subscribe, status } = useRealtime();
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
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)', fontSize: '0.82rem' }}>
              Aún no tienes conversaciones. Cuando escribas o recibas un mensaje aparecerán aquí.
            </div>
          )}
          {conversations.map((c) => {
            const other = c.participants.find((p) => p.id !== user.id) || c.participants[0];
            return (
              <button key={c.id} onClick={() => openConv(c)}
                data-testid={`messages-conv-${c.id}`}
                style={{ width: '100%', padding: '0.75rem 0.9rem', textAlign: 'left', display: 'flex', gap: '0.55rem', alignItems: 'center',
                         background: active?.id === c.id ? 'rgba(0,200,150,0.08)' : 'transparent',
                         border: 'none', borderBottom: '1px solid rgba(11,31,58,0.05)', cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(other.name || '·').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message?.body || 'Sin mensajes'}</div>
                </div>
                {c.unread_count > 0 && <span style={{ background: '#EF4444', color: '#FFFFFF', fontSize: '0.62rem', fontWeight: 800, padding: '2px 6px', borderRadius: 100 }}>{c.unread_count}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(11,31,58,0.06)', display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(11,31,58,0.06)', fontWeight: 700, color: NAVY }}>
                {(active.participants.find((p) => p.id !== user.id) || {}).name}
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
              <form onSubmit={send} style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid rgba(11,31,58,0.06)' }}>
                <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un mensaje…"
                  data-testid="messages-input" style={{ flex: 1, padding: '0.55rem 0.85rem', borderRadius: 100, border: '1px solid rgba(11,31,58,0.12)', outline: 'none', fontSize: '0.85rem' }} />
                <button type="submit" disabled={busy || !body.trim()} data-testid="messages-send"
                  style={{ padding: '0.5rem 0.85rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
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
