import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const VideosPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listVideos().then(setItems); }, []);

  return (
    <CategoryPage
      icon="video"
      eyebrow="Videos"
      title="La visión, contada en pantalla"
      subtitle="Manifiestos, demos de producto, conversaciones con fundadores y crónicas del ecosistema."
      testid="videos-page"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1rem',
      }}>
        {items.map((v, idx) => (
          <motion.article
            key={v.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
            data-testid={`video-item-${v.id}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0A0F1C' }}>
              <img src={v.cover} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.15)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.94)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Play size={20} color={NAVY} fill={NAVY} />
                </div>
              </div>
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                padding: '0.15rem 0.45rem', borderRadius: 6,
                background: 'rgba(0,0,0,0.7)', color: '#FFFFFF',
                fontSize: '0.68rem', fontWeight: 700,
              }}>{v.length}</div>
            </div>
            <div style={{ padding: '0.85rem 1rem 1rem' }}>
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3,
                color: NAVY, margin: 0, marginBottom: '0.25rem', letterSpacing: '-0.01em',
              }}>{v.title}</h3>
              <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)' }}>
                {v.channel} · {v.views} vistas
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </CategoryPage>
  );
};

export default VideosPage;
