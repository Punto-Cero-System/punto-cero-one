import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const NewsPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listNews().then(setItems); }, []);

  return (
    <CategoryPage
      icon="news"
      eyebrow="Noticias del ecosistema"
      title="Lo que está pasando en Punto Cero One"
      subtitle="Actualizaciones oficiales, movimientos regionales y contenido curado por el equipo del ecosistema."
      testid="news-page"
    >
      {items.map((n, idx) => (
        <motion.article
          key={n.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, delay: idx * 0.05 }}
          data-testid={`news-item-${n.id}`}
          style={{
            background: '#FFFFFF', borderRadius: 16,
            border: '1px solid rgba(11,31,58,0.06)',
            boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
            overflow: 'hidden',
          }}
        >
          {n.cover && (
            <div style={{ width: '100%', aspectRatio: '16 / 7', background: '#0A0F1C' }}>
              <img src={n.cover} alt={n.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <div style={{ padding: '1.15rem 1.15rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{
                fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
                padding: '0.25rem 0.55rem', borderRadius: 100,
                background: 'rgba(0,200,150,0.1)', color: '#00A277',
              }}>{n.tag.toUpperCase()}</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.5)' }}>{n.author} · {n.date}</span>
            </div>
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.015em',
              lineHeight: 1.3, color: NAVY, margin: 0, marginBottom: '0.4rem',
            }}>{n.title}</h2>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.55, color: 'rgba(11,31,58,0.72)', margin: 0 }}>
              {n.excerpt}
            </p>
            {n.href && (
              <a
                href={n.href} target="_blank" rel="noopener noreferrer"
                data-testid={`news-item-cta-${n.id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  marginTop: '0.85rem', padding: '0.5rem 0.85rem', borderRadius: 100,
                  background: NAVY, color: '#FFFFFF', fontSize: '0.78rem', fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Abrir <ExternalLink size={12} />
              </a>
            )}
          </div>
        </motion.article>
      ))}
    </CategoryPage>
  );
};

export default NewsPage;
