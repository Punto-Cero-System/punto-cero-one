import React from 'react';
import { Building2, MapPin, Users } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#0EA5E9';

const CompanyCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Empresa"
    badgeIcon={Building2}
    testid={`card-company-${item.id}`}
    header={item.image && (
      <img src={item.image} alt={item.title} referrerPolicy="no-referrer"
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
    )}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.category && <CardMeta>{item.category}</CardMeta>}
        {item.country_label && <CardMeta><MapPin size={11} /> {item.country_label}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver empresa" color={ACCENT}
        testid={`card-company-open-${item.id}`} />
    }
  />
);

export default CompanyCard;
