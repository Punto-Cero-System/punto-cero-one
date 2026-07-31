import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X } from 'lucide-react';
import { notificationService } from '../../services/coreServices';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

/**
 * NotificationsBell — header dropdown showing latest notifications + unread count.
 * Polls every 30s. Fully cross-vertical (uses /api/notifications/*).
 */
const NotificationsBell = () => {
  const { user } = useCommunityAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const isAuthed = !!user && typeof user === 'object';

  const load = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const data = await notificationService.list({ limit: 8 });
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch { /* noop */ }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => clearInterval(timerRef.current);
  }, [isAuthed, load]);

  if (!isAuthed) return null;

  const markAllRead = async () => {
    await notificationService.markAllRead();
    setItems((p) => p.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const openItem = async (n) => {
    if (!n.is_read) {
      try { await notificationService.markRead(n.id); } catch { /* noop */ }
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.subject_url) navigate(n.subject_url);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button data-testid="notifications-bell" onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={16} />
        {unread > 0 && (
          <span data-testid="notifications-unread-count" style={{
            position: 'absolute', top: -3, right: -3,
            background: '#EF4444', color: '#FFFFFF',
            fontSize: '0.6rem', fontWeight: 800, borderRadius: 100,
            padding: '1px 5px', minWidth: 14, textAlign: 'center',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            data-testid="notifications-dropdown"
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 340, maxWidth: 380, maxHeight: 480, overflow: 'auto', background: '#0A0F1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.55)', zIndex: 60 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>Notificaciones</span>
              {unread > 0 && (
                <button onClick={markAllRead} data-testid="notifications-mark-all"
                  style={{ fontSize: '0.7rem', background: 'transparent', color: '#00C896', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  <Check size={11} style={{ verticalAlign: -1 }} /> Marcar todo
                </button>
              )}
            </div>
            {items.length === 0 && (
              <div data-testid="notifications-empty" style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                No tienes notificaciones todavía.
              </div>
            )}
            {items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                data-testid={`notification-item-${n.id}`}
                style={{
                  width: '100%', padding: '0.7rem 0.9rem', textAlign: 'left', background: n.is_read ? 'transparent' : 'rgba(0,200,150,0.06)',
                  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  color: '#FFFFFF', cursor: 'pointer', display: 'flex', gap: '0.55rem',
                }}>
                {n.actor_picture ? (
                  <img src={n.actor_picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem' }}>{(n.actor_name || 'P').charAt(0)}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{new Date(n.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C896', alignSelf: 'center' }} />}
              </button>
            ))}
            <div style={{ padding: '0.65rem 1rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => { setOpen(false); navigate('/notificaciones'); }} data-testid="notifications-see-all"
                style={{ background: 'transparent', border: 'none', color: '#00C896', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                Ver todas →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationsBell;
