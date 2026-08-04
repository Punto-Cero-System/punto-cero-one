import React from 'react';
import { Github, Star, GitFork } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#334155';

const RepoCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Repositorio"
    badgeIcon={Github}
    testid={`card-repo-${item.id}`}
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.category && <CardMeta>{item.category}</CardMeta>}
        {item.metadata?.stars != null && <CardMeta><Star size={11} /> {item.metadata.stars}</CardMeta>}
        {item.metadata?.forks != null && <CardMeta><GitFork size={11} /> {item.metadata.forks}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver en GitHub" icon={Github} color={ACCENT}
        testid={`card-repo-open-${item.id}`} />
    }
  />
);

export default RepoCard;
