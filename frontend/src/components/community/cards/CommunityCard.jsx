import React from 'react';
import { Users } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#059669';

const CommunityCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Comunidad"
    badgeIcon={Users}
    testid={`card-community-${item.id}`}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.category && <CardMeta>{item.category}</CardMeta>}
        {item.country && <CardMeta>· {item.country}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver más" color={ACCENT}
        testid={`card-community-open-${item.id}`} />
    }
  />
);

export default CommunityCard;
