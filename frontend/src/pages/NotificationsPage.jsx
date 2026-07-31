import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Check, Trash2 } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { notificationService } from '../services/coreServices';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const NotificationsPage = () => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const data = await notificationService.list({ limit: 25, cursor: reset ? undefined : cursor });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.next_cursor); setHasMore(!!data.next_cursor);
    } catch { /* noop */ } finally { setLoading(false); }
  }, [cursor]);

  useEffect(() => { if (user) load(true); /* eslint-disable-next-line */ }, [user]);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/join" replace />;

  const toggleRead = async (n) => {
    await notificationService.markRead(n.id, n.is_read);
    setItems((p) => p.map((x) => x.id === n.id ? { ...x, is_read: !x.is_read } : x));
  };
  const remove = async (n) => {
    await notificationService.remove(n.id);
    setItems((p) => p.filter((x) => x.id !== n.id));
  };
  const markAll = async () => {
    await notificationService.markAllRead();
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
  };

  return (
    <CategoryPage icon="community" eyebrow="Notification Center" title="Todas tus notificaciones"
      subtitle="Reacciones, comentarios, seguidores, empleos, eventos y mensajes — en un solo lugar."
      testid="notifications-page">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={markAll} data-testid="notifications-mark-all-page"
          style={{ padding: '0.5rem 0.9rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
          <Check size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Marcar todo como leído
        </button>
      </div>
      {items.map((n) => (
        <div key={n.id} data-testid={`notification-row-${n.id}`}
          style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1.15rem', borderRadius: 12, background: n.is_read ? '#FFFFFF' : 'rgba(0,200,150,0.06)', border: '1px solid rgba(11,31,58,0.06)' }}>
          {n.actor_picture ? (
            <img src={n.actor_picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(n.actor_name || 'P').charAt(0)}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: n.is_read ? 500 : 700, color: NAVY, fontSize: '0.9rem' }}>{n.title}</div>
            {n.body && <div style={{ fontSize: '0.82rem', color: 'rgba(11,31,58,0.65)', marginTop: 2 }}>{n.body}</div>}
            <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.45)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('es-CO')}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => toggleRead(n)} title={n.is_read ? 'Marcar no leído' : 'Marcar leído'}
              data-testid={`notification-toggle-${n.id}`}
              style={{ padding: 6, borderRadius: 8, background: 'transparent', border: '1px solid rgba(11,31,58,0.1)', cursor: 'pointer', color: NAVY }}>
              <Check size={12} />
            </button>
            <button onClick={() => remove(n)} title="Eliminar" data-testid={`notification-delete-${n.id}`}
              style={{ padding: 6, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,90,90,0.3)', cursor: 'pointer', color: '#B91C1C' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
      {loading && items.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>}
      {!loading && items.length === 0 && (
        <div data-testid="notifications-empty-page" style={{ padding: '2rem', textAlign: 'center', borderRadius: 16, background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)', color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem' }}>
          No tienes notificaciones todavía. ¡Vuelve pronto!
        </div>
      )}
      {hasMore && !loading && (
        <button data-testid="notifications-load-more" onClick={() => load(false)}
          style={{ padding: '0.7rem 1rem', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)', color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cargar más</button>
      )}
    </CategoryPage>
  );
};

export default NotificationsPage;
