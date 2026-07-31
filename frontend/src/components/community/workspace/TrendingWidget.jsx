import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RightCard } from './rightBlocks';
import { feedService } from '../../../services/feedService';

const NAVY = '#0B1F3A';

const TrendingWidget = () => {
  const [items, setItems] = useState(null);
  useEffect(() => {
    feedService.trending().then((d) => setItems(d.hashtags || [])).catch(() => setItems([]));
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <RightCard title="Tendencias" icon="ai" testid="workspace-widget-trending">
      {items.map((h) => (
        <Link key={h.tag} to={`/?hashtag=${encodeURIComponent(h.tag)}`}
          data-testid={`right-widget-trend-${h.tag}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.4rem 0.85rem', textDecoration: 'none',
            color: NAVY, fontSize: '0.82rem', fontWeight: 600,
            borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <span style={{ color: '#00A277' }}>#{h.tag}</span>
          <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{h.posts_7d} · 7d</span>
        </Link>
      ))}
    </RightCard>
  );
};
export default TrendingWidget;
