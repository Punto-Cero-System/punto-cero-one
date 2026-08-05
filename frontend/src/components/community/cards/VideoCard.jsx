import React from 'react';
import { Play, Video, Clock } from 'lucide-react';
import BaseCard, { CardCTA, CardMeta } from './BaseCard';

const ACCENT = '#EF4444';

const VideoCard = ({ item }) => {
  const meta = item.metadata || {};
  const duration = meta.duration || meta.meta?.duration;

  return (
    <BaseCard
      accent={ACCENT}
      badgeLabel="Video"
      badgeIcon={Video}
      testid={`card-video-${item.id}`}
      media={
        <a href={item.external_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', position: 'relative', aspectRatio: '16 / 9', background: '#0A0F1C' }}>
          {item.image ? (
            <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1F2937, #111827)',
            }} />
          )}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }}>
              <Play size={22} color="#0B1F3A" fill="#0B1F3A" />
            </div>
          </div>
          {duration && (
            <span style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '0.22rem 0.55rem', borderRadius: 6,
              background: 'rgba(0,0,0,0.75)', color: '#FFFFFF',
              fontSize: '0.7rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            }}>{duration}</span>
          )}
        </a>
      }
      title={item.title}
      description={item.description}
      meta={
        <>
          {item.source && <CardMeta style={{ fontWeight: 700, color: ACCENT }}>{item.source}</CardMeta>}
          {item.category && <CardMeta>· {item.category}</CardMeta>}
          {duration && !item.image && <CardMeta><Clock size={11} /> {duration}</CardMeta>}
        </>
      }
      primaryAction={
        <CardCTA href={item.external_url} label="Ver en YouTube"
          icon={Play} color={ACCENT} testid={`card-video-open-${item.id}`} />
      }
    />
  );
};

export default VideoCard;
