import React from 'react';
import { ShoppingBag, Tag } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#EC4899';

const MarketplaceCard = ({ item }) => {
  const meta = item.metadata || {};
  const price = meta.meta?.price;
  const currency = meta.meta?.currency || 'USD';
  const provider = meta.meta?.provider || item.source;

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Marketplace"
      badgeIcon={ShoppingBag}
      testid={`card-marketplace-${item.id}`}
      media={item.image ? (
        <div style={{ position: 'relative', height: 176, background: '#F4F6FB' }}>
          <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {price && (
            <span style={{
              position: 'absolute', top: 10, left: 10,
              padding: '0.35rem 0.7rem', borderRadius: 100,
              background: 'rgba(11,31,58,0.9)', color: '#FFFFFF',
              fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.03em',
            }}>{currency} {price}</span>
          )}
        </div>
      ) : (
        <div style={{
          position: 'relative', height: 128,
          background: `linear-gradient(135deg, ${ACCENT}, #BE185D)`,
        }} />
      )}
      title={item.title}
      description={item.description}
      meta={
        <>
          {provider && <CardMeta>{provider}</CardMeta>}
          {item.category && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 7px', borderRadius: 6,
              background: 'rgba(236,72,153,0.12)', color: '#9D174D',
              fontSize: '0.6rem', fontWeight: 700,
            }}><Tag size={9} /> {item.category}</span>
          )}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Ver producto" color={ACCENT}
          testid={`card-marketplace-open-${item.id}`} />
      }
    />
  );
};

export default MarketplaceCard;
