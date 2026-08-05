import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#8B5CF6';

const AiToolCard = ({ item }) => {
  const useCases = item.metadata?.use_cases || [];
  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="IA"
      badgeIcon={Sparkles}
      testid={`card-ai-${item.id}`}
      header={item.image && (
        <img src={item.image} alt={item.title} referrerPolicy="no-referrer" loading="lazy" decoding="async"
          style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: '#F4F6FB', padding: 3 }} />
      )}
      title={item.title}
      description={item.description}
      meta={
        <>
          {item.category && <CardMeta>{item.category}</CardMeta>}
          {useCases.length > 0 && (
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {useCases.slice(0, 3).map((u) => (
                <span key={u} style={{
                  padding: '2px 7px', borderRadius: 100,
                  background: 'rgba(139,92,246,0.10)', color: '#5B21B6',
                  fontSize: '0.65rem', fontWeight: 700,
                }}>{u}</span>
              ))}
            </span>
          )}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Visitar herramienta"
          icon={ExternalLink} color={ACCENT}
          testid={`card-ai-open-${item.id}`} />
      }
    />
  );
};

export default AiToolCard;
