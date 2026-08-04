import React from 'react';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#F59E0B';

const EventCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Evento"
    badgeIcon={CalendarDays}
    testid={`card-event-${item.id}`}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.location && <CardMeta><MapPin size={11} /> {item.location}</CardMeta>}
        {item.country_label && !item.location && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
        {item.source && <CardMeta>{item.source}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Registrarse"
        icon={Ticket} color={ACCENT} testid={`card-event-register-${item.id}`} />
    }
  />
);

export default EventCard;
