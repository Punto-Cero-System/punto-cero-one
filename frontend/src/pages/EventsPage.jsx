import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Check } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { eventService } from '../services/platformService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import ExternalSourcesSection from '../components/community/ExternalSourcesSection';

const EventsPage = () => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const isAuthed = !!user && typeof user === 'object';

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const data = await eventService.list({ limit: 20, cursor: reset ? undefined : cursor });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.next_cursor); setHasMore(!!data.next_cursor);
    } catch (e) { /* silent */ } finally { setLoading(false); }
  }, [cursor]);

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);

  const rsvp = async (event, status) => {
    if (!isAuthed) { window.location.assign('/join'); return; }
    try {
      const r = await eventService.rsvp(event.id, status);
      setItems((p) => p.map((e) => {
        if (e.id !== event.id) return e;
        const nextRsvp = r.status || null;
        // recompute counts client-side using the response
        return { ...e, my_rsvp: nextRsvp };
      }));
      // Refresh counts from server for the affected event
      const fresh = await eventService.get(event.id);
      setItems((p) => p.map((e) => (e.id === event.id ? fresh : e)));
    } catch (err) { /* silent */ }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return { day: d.getDate(), mon: d.toLocaleString('es-CO', { month: 'short' }).replace('.', '').toUpperCase(), time: d.toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' }) };
    } catch { return { day: '?', mon: '', time: '' }; }
  };

  return (
    <CategoryPage
      icon="events"
      eyebrow="Eventos del ecosistema"
      title="Encuentros que conectan a la comunidad"
      subtitle="Roundtables, demos, meetups y talleres. Presenciales, virtuales o híbridos."
      testid="events-page"
    >
      {items.map((e, idx) => {
        const d = fmtDate(e.starts_at);
        return (
          <motion.article
            key={e.id}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.03 }}
            data-testid={`event-card-${e.id}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, padding: '1.05rem 1.15rem 1.2rem',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
            }}
          >
            <div style={{
              width: 62, height: 62, borderRadius: 14,
              background: 'linear-gradient(135deg, #0B1F3A, #4C1D95)',
              color: '#FFFFFF', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700, opacity: 0.85 }}>{d.mon.slice(0, 3)}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 }}>{d.day}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.05rem', fontWeight: 700, color: NAVY, margin: 0 }}>{e.title}</h2>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', margin: '0.35rem 0 0.55rem', fontSize: '0.78rem', color: 'rgba(11,31,58,0.65)' }}>
                <span><Calendar size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{d.day} {d.mon} · {d.time}</span>
                {e.location && <span><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{e.location}</span>}
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 100, background: 'rgba(11,31,58,0.06)', color: NAVY, fontSize: '0.66rem', fontWeight: 700 }}>
                  {e.modality === 'online' ? 'Online' : e.modality === 'in_person' ? 'Presencial' : 'Híbrido'}
                </span>
                {e.company_name && <span>· {e.company_name}</span>}
              </div>
              {e.description && <p style={{ fontSize: '0.87rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.5 }}>{e.description.slice(0, 260)}{e.description.length > 260 ? '…' : ''}</p>}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button data-testid={`event-rsvp-going-${e.id}`} onClick={() => rsvp(e, 'going')}
                  style={{ padding: '0.5rem 0.95rem', borderRadius: 100, border: 'none', cursor: 'pointer', background: e.my_rsvp === 'going' ? '#00C896' : NAVY, color: e.my_rsvp === 'going' ? NAVY : '#FFFFFF', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {e.my_rsvp === 'going' && <Check size={12} />}Asistiré
                </button>
                <button data-testid={`event-rsvp-interested-${e.id}`} onClick={() => rsvp(e, 'interested')}
                  style={{ padding: '0.5rem 0.85rem', borderRadius: 100, cursor: 'pointer', background: e.my_rsvp === 'interested' ? 'rgba(212,175,55,0.2)' : 'transparent', border: '1px solid rgba(11,31,58,0.12)', color: e.my_rsvp === 'interested' ? '#8A6D14' : NAVY, fontSize: '0.78rem', fontWeight: 600 }}>
                  Me interesa
                </button>
                <span style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.5)', marginLeft: 6 }} data-testid={`event-attendees-${e.id}`}>
                  {e.attendees_count} asistir{e.attendees_count === 1 ? 'á' : 'án'} · {e.interested_count} interesad{e.interested_count === 1 ? 'o' : 'os'}
                </span>
              </div>
            </div>
          </motion.article>
        );
      })}

      {loading && items.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>}
      {!loading && items.length === 0 && (
        <div data-testid="events-empty" style={{ padding: '1.4rem', textAlign: 'center', borderRadius: 16, background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)', color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem' }}>
          Aún no hay encuentros propios. Estos son eventos profesionales regionales para tu país:
        </div>
      )}

      <ExternalSourcesSection
        type="events"
        title="Eventos regionales y meetups"
        subtitle="Conferencias, webinars, networking y cursos por país."
        limit={12}
        testid="events-external-sources"
      />

      {hasMore && !loading && (
        <button data-testid="events-load-more" onClick={() => load(false)}
          style={{ padding: '0.7rem 1rem', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)', color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cargar más</button>
      )}
    </CategoryPage>
  );
};

export default EventsPage;
