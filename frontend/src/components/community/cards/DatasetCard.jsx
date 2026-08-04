import React from 'react';
import { Database, Globe } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#14B8A6';

const DatasetCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Dataset"
    badgeIcon={Database}
    testid={`card-dataset-${item.id}`}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.source && <CardMeta>{item.source}</CardMeta>}
        {item.country_label && <CardMeta><Globe size={11} /> {item.country_label}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver dataset" color={ACCENT}
        testid={`card-dataset-open-${item.id}`} />
    }
  />
);

export default DatasetCard;
