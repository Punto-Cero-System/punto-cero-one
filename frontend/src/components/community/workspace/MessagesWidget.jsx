/**
 * MessagesWidget — direct messages panel for Mi Espacio.
 *
 * Reuses the EXISTING messaging system:
 *   - GET /api/messages/conversations for the list
 *   - RealtimeContext SSE `message` events for live unread updates
 *   - PresenceDot for online status
 *   - navigates to /mensajes for a full-screen conversation
 *
 * NO new backend endpoints, NO new chat surface. This is a compact
 * dashboard widget that surfaces what already exists.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowUpRight } from 'lucide-react';
import { RightCard } from './rightBlocks';
import PresenceDot from '../PresenceDot';
import { messagingService } from '../../../services/coreServices';
import { useCommunityAuth } from '../../../contexts/CommunityAuthContext';
import { useRealtime } from '../../../contexts/RealtimeContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';

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

const MessagesWidget = () => {
  const { user } = useCommunityAuth();
  const { subscribe } = useRealtime();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  const isAuthed = !!user && typeof user === 'object';

  const load = useCallback(async () => {
    if (!isAuthed) { setItems([]); return; }
    try {
      const d = await messagingService.listConversations();
      const list = (d?.items || []).slice(0, 5);
      setItems(list);
    } catch { setItems([]); }
  }, [isAuthed]);

  useEffect(() => { load(); }, [load]);

  // Live: bump unread and reorder when a new message lands.
  useEffect(() => {
    if (!isAuthed) return;
    return subscribe('message', (evt) => {
      const convId = evt?.conversation_id;
      const msg = evt?.message;
      if (!convId || !msg) return;
      setItems((prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((c) => c.id === convId);
        if (idx < 0) {
          // conversation not in the top-5 — refetch so it surfaces.
          load();
          return prev;
        }
        const target = { ...prev[idx],
          last_message: msg,
          updated_at: msg.created_at,
          unread_count: (prev[idx].unread_count || 0) + (msg?.sender?.id === user?.id ? 0 : 1),
        };
        const next = [target, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    });
  }, [subscribe, load, isAuthed, user]);

  useEffect(() => {
    if (!items) return;
    setTotalUnread(items.reduce((n, c) => n + (c.unread_count || 0), 0));
  }, [items]);

  if (!isAuthed) return null;
  if (!items) return null;

  return (
    <RightCard
      title="Mensajes"
      icon="community"
      testid="workspace-widget-messages"
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '-0.2rem 0 0.3rem',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
          {items.length === 0 ? 'Sin conversaciones aún' : `${items.length} recientes`}
        </div>
        {totalUnread > 0 && (
          <span data-testid="messages-widget-total-unread" style={{
            fontSize: '0.62rem', fontWeight: 800,
            padding: '2px 8px', borderRadius: 100,
            background: EMERALD, color: '#FFFFFF',
          }}>{totalUnread}</span>
        )}
      </div>

      {items.length === 0 && (
        <Link to="/mensajes" data-testid="messages-widget-empty-cta"
          style={{
            display: 'block', padding: '0.75rem 0.6rem',
            textAlign: 'center', fontSize: '0.75rem', color: NAVY,
            background: 'rgba(11,31,58,0.03)', borderRadius: 10,
            textDecoration: 'none', border: '1px dashed rgba(11,31,58,0.1)',
          }}>
          <MessageCircle size={16} style={{ verticalAlign: -3 }} /> Inicia una conversación
        </Link>
      )}

      {items.map((c) => {
        const others = (c.participants || []).filter((p) => p.id !== user?.id);
        const peer = others[0] || {};
        const preview = c.last_message?.body || '(sin mensajes)';
        const unread = c.unread_count || 0;
        return (
          <button
            key={c.id}
            data-testid={`messages-widget-item-${c.id}`}
            onClick={() => navigate('/mensajes', { state: { conversationId: c.id } })}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              width: '100%', textAlign: 'left', padding: '0.55rem 0.5rem',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderTop: '1px solid rgba(11,31,58,0.05)',
            }}
          >
            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
              {peer.picture ? (
                <img src={peer.picture} alt={peer.name} referrerPolicy="no-referrer"
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)', color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.85rem',
                }}>{(peer.name || 'M').charAt(0).toUpperCase()}</div>
              )}
              {peer.kind === 'user' && peer.id && <PresenceDot userId={peer.id} size={9} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '0.35rem',
              }}>
                <span style={{
                  fontSize: '0.82rem', fontWeight: unread ? 800 : 700, color: NAVY,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{peer.name || 'Conversación'}</span>
                <span style={{ fontSize: '0.6rem', color: 'rgba(11,31,58,0.5)', flexShrink: 0 }}>
                  {relTime(c.last_message?.created_at || c.updated_at)}
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <span style={{
                  fontSize: '0.72rem', color: unread ? NAVY : 'rgba(11,31,58,0.6)',
                  fontWeight: unread ? 700 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{preview}</span>
                {unread > 0 && (
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 800,
                    padding: '1px 6px', borderRadius: 100,
                    background: EMERALD, color: '#FFFFFF', flexShrink: 0,
                  }}>{unread}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}

      <Link to="/mensajes" data-testid="messages-widget-open-all"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          marginTop: '0.55rem', padding: '0.35rem 0.3rem',
          fontSize: '0.72rem', color: NAVY, fontWeight: 700,
          textDecoration: 'none',
        }}>
        Ver todas <ArrowUpRight size={13} />
      </Link>
    </RightCard>
  );
};

export default MessagesWidget;
