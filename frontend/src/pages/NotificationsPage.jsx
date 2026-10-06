import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Check, Trash2 } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { notificationService } from '../services/coreServices';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const notifyBellSync = () => {
  try { window.dispatchEvent(new CustomEvent('pc:notifications-updated')); } catch { /* noop */ }
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const formatRelative = (iso) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

const NotificationsPage = () => {
  const { user } = useCommunityAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (reset = false, cur = null) => {
    setLoading(true);
    try {
      const data = await notificationService.list({ limit: 25, cursor: reset ? undefined : cur });
      setItems((prev) => (reset ? (data.items || []) : [...prev, ...(data.items || [])]));
      setUnreadCount(typeof data.unread === 'number'
        ? data.unread
        : (data.items || []).filter((n) => !n.is_read).length);
      setCursor(data.next_cursor); setHasMore(!!data.next_cursor);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  // Reload when authentication resolves or changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) load(true); }, [user]);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/join" replace />;

  const openItem = async (n) => {
    if (!n.is_read) {
      try {
        await notificationService.markRead(n.id, false);
        setItems((p) => p.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
        setUnreadCount((count) => Math.max(0, count - 1));
        notifyBellSync();
      } catch { /* noop */ }
    }
    if (n.subject_url) navigate(n.subject_url);
  };

  const toggleRead = async (n, e) => {
    e?.stopPropagation();
    try {
      await notificationService.markRead(n.id, n.is_read);
      setItems((p) => p.map((x) => x.id === n.id ? { ...x, is_read: !x.is_read } : x));
      setUnreadCount((count) => Math.max(0, count + (n.is_read ? 1 : -1)));
      notifyBellSync();
    } catch { /* noop */ }
  };
  const remove = async (n, e) => {
    e?.stopPropagation();
    try {
      await notificationService.remove(n.id);
      setItems((p) => p.filter((x) => x.id !== n.id));
      if (!n.is_read) setUnreadCount((count) => Math.max(0, count - 1));
      notifyBellSync();
    } catch { /* noop */ }
  };
  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      setItems((p) => p.map((x) => ({ ...x, is_read: true })));
      setUnreadCount(0);
      notifyBellSync();
    } catch { /* noop */ }
  };

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const weekAgo = today - 6 * 24 * 60 * 60 * 1000;
    const hoy = []; const semana = []; const anteriores = [];
    items.forEach((n) => {
      const t = new Date(n.created_at).getTime();
      const day = startOfDay(Number.isNaN(t) ? new Date() : new Date(t));
      if (day === today) hoy.push(n);
      else if (day >= weekAgo) semana.push(n);
      else anteriores.push(n);
    });
    return [
      { key: 'hoy', label: 'Hoy', items: hoy },
      { key: 'semana', label: 'Esta semana', items: semana },
      { key: 'anteriores', label: 'Anteriores', items: anteriores },
    ].filter((g) => g.items.length > 0);
  }, [items]);
  return (
    <CategoryPage icon="community" eyebrow="Notification Center" title="Todas tus notificaciones"
      subtitle="Reacciones, comentarios, seguidores, empleos, eventos y mensajes — en un solo lugar."
      testid="notifications-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div data-testid="notifications-unread-page" style={{ fontSize: '0.8rem', fontWeight: 700, color: unreadCount > 0 ? NAVY : 'rgba(11,31,58,0.45)' }}>
          {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
        </div>
        {items.length > 0 && unreadCount > 0 && (
          <button onClick={markAll} data-testid="notifications-mark-all-page"
            style={{ padding: '0.5rem 0.9rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
            <Check size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Marcar todo como leído
          </button>
        )}
      </div>
      {unreadCount > 0 && (
        <div data-testid="notifications-return-summary" role="status" aria-live="polite"
          style={{ padding: '0.9rem 1.1rem', borderRadius: 12, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', color: NAVY }}>
          <div style={{ fontWeight: 800 }}>Tenemos novedades para ti</div>
          <div style={{ fontSize: '0.82rem', marginTop: 3 }}>
            Tienes {unreadCount} {unreadCount === 1 ? 'novedad' : 'novedades'} sin leer.
          </div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
          <div data-testid={`notifications-group-${g.key}`} style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(11,31,58,0.5)', marginTop: '0.5rem' }}>
            {g.label}
          </div>
          {g.items.map((n) => (
        <div key={n.id} data-testid={`notification-row-${n.id}`}
          style={{ display: 'flex', gap: '0.75rem', padding: '1rem 1.15rem', borderRadius: 12, background: n.is_read ? '#FFFFFF' : 'rgba(0,200,150,0.06)', border: '1px solid rgba(11,31,58,0.06)' }}>
          {n.actor_picture ? (
            <img src={n.actor_picture} alt={n.actor_name || 'Tu comunidad'} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(n.actor_name || 'C').charAt(0)}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: n.is_read ? 500 : 700, color: NAVY, fontSize: '0.9rem' }}>{n.title}</div>
            {n.body && <div style={{ fontSize: '0.82rem', color: 'rgba(11,31,58,0.65)', marginTop: 2 }}>{n.body}</div>}
            <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', marginTop: 6 }}>
              <span data-testid={`notification-actor-${n.id}`} style={{ fontWeight: 700 }}>{n.actor_name || 'Tu comunidad'}</span>
              <span> · </span>
              <span data-testid={`notification-when-${n.id}`}>{formatRelative(n.created_at)}</span>
            </div>
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
        </div>
      ))}
      {loading && items.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>}
      {!loading && items.length === 0 && (
        <div data-testid="notifications-empty-page" style={{ padding: '2.2rem 1.5rem', textAlign: 'center', borderRadius: 16, background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)', color: 'rgba(11,31,58,0.65)', fontSize: '0.9rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.35rem' }}>No tienes novedades todavía.</div>
          <div style={{ marginBottom: '1rem' }}>Sigue profesionales y empresas para recibir actualizaciones.</div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/comunidad" data-testid="notifications-empty-explore"
              style={{ padding: '0.55rem 1rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>
              Explorar publicaciones
            </Link>
            <Link to="/empresas" data-testid="notifications-empty-discover"
              style={{ padding: '0.55rem 1rem', borderRadius: 100, background: '#FFFFFF', color: NAVY, fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', border: '1px solid rgba(11,31,58,0.15)' }}>
              Descubrir empresas
            </Link>
          </div>
        </div>
      )}
      {hasMore && !loading && items.length > 0 && (
        <button data-testid="notifications-load-more" onClick={() => load(false, cursor)}
          style={{ padding: '0.7rem 1rem', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)', color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cargar más</button>
      )}
    </CategoryPage>
  );
};

export default NotificationsPage;
