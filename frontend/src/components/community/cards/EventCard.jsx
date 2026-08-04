import React from 'react';
import { CalendarDays, MapPin, Ticket, Clock } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#F59E0B';

const HeroBand = ({ image, accent }) => (
  <div style={{
    position: 'relative', height: 128,
    background: image
      ? `${accent} center / cover no-repeat url(${image})`
      : `linear-gradient(135deg, ${accent} 0%, #D97706 100%)`,
  }}>
    <div aria-hidden style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.35) 100%)',
    }} />
  </div>
);

const EventCard = ({ item }) => {
  const meta = item.metadata || {};
  const date = meta.meta?.date || meta.meta?.start_at || item.created_at;
  const organizer = meta.meta?.organizer || item.source;
  const banner = meta.meta?.banner_url || item.image;

  const fmtDate = (d) => {
    if (!d) return null;
    try {
      const dt = new Date(d);
      if (isNaN(dt)) return null;
      return dt.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };
  const dateLabel = fmtDate(date);

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Evento"
      badgeIcon={CalendarDays}
      testid={`card-event-${item.id}`}
      media={<HeroBand image={banner} accent={ACCENT} />}
      title={item.title}
      description={item.description}
      meta={
        <>
          {dateLabel && <CardMeta><Clock size={11} /> {dateLabel}</CardMeta>}
          {item.location && <CardMeta><MapPin size={11} /> {item.location}</CardMeta>}
          {item.country_label && !item.location && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
          {organizer && <CardMeta>· {organizer}</CardMeta>}
          {item.category && <CardMeta style={{
            padding: '1px 7px', borderRadius: 6,
            background: 'rgba(245,158,11,0.14)', color: '#B45309',
            fontSize: '0.6rem', fontWeight: 700,
          }}>{item.category}</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Registrarse"
          icon={Ticket} color={ACCENT} testid={`card-event-register-${item.id}`} />
      }
    />
  );
};

export default EventCard;
