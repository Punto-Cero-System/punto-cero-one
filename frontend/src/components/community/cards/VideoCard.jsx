import React from 'react';
import { Play, Video } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#EF4444';

const VideoCard = ({ item }) => (
  <BaseCard
    accent={ACCENT}
    badgeLabel="Video"
    badgeIcon={Video}
    testid={`card-video-${item.id}`}
    media={
      <a href={item.external_url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'block', position: 'relative', aspectRatio: '16 / 9', background: '#0A0F1C' }}>
        {item.image && (
          <img src={item.image} alt="" referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}>
            <Play size={20} color="#0B1F3A" fill="#0B1F3A" />
          </div>
        </div>
      </a>
    }
    title={item.title}
    description={item.description}
    meta={
      <>
        {item.source && <CardMeta>{item.source}</CardMeta>}
        {item.category && <CardMeta>· {item.category}</CardMeta>}
      </>
    }
    primaryAction={
      <CardCTA href={item.external_url} label="Ver en YouTube"
        icon={Play} color={ACCENT} testid={`card-video-open-${item.id}`} />
    }
  />
);

export default VideoCard;
