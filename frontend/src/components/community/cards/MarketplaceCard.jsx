import React from 'react';
import { ShoppingBag } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#EC4899';

const MarketplaceCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Marketplace"
    badgeIcon={ShoppingBag}
    testid={`card-marketplace-${item.id}`}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.source && <CardMeta>{item.source}</CardMeta>}
        {item.category && <CardMeta>{item.category}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver producto" color={ACCENT}
        testid={`card-marketplace-open-${item.id}`} />
    }
  />
);

export default MarketplaceCard;
