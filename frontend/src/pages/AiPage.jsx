import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const STATUS_META = {
  beta: { label: 'BETA', bg: 'rgba(0,200,150,0.13)', color: '#00A277' },
  preview: { label: 'PREVIEW', bg: 'rgba(59,130,246,0.14)', color: '#1D4ED8' },
  soon: { label: 'PRÓXIMAMENTE', bg: 'rgba(212,175,55,0.15)', color: '#8A6D14' },
};

const AiPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listAiTools().then(setItems); }, []);

  return (
    <CategoryPage
      icon="ai"
      eyebrow="IA & Herramientas"
      title="Inteligencia artificial aplicada al ecosistema"
      subtitle="La misma base tecnológica One que impulsa Legal se está extendiendo a nuevas capacidades para toda la comunidad."
      testid="ai-page"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        {items.map((a, idx) => {
          const st = STATUS_META[a.status] || STATUS_META.soon;
          return (
            <motion.article
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              data-testid={`ai-item-${a.id}`}
              style={{
                background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem 1.25rem',
                border: '1px solid rgba(11,31,58,0.06)',
                boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
                display: 'flex', flexDirection: 'column', gap: '0.55rem',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 140, height: 140,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)',
                filter: 'blur(20px)', pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #22D3EE, #7C3AED)',
                  color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: '1rem', fontWeight: 700, color: NAVY, margin: 0, letterSpacing: '-0.01em',
                  }}>{a.name}</h2>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>{a.tag}</div>
                </div>
                <span style={{
                  marginLeft: 'auto',
                  padding: '0.25rem 0.55rem', borderRadius: 100,
                  background: st.bg, color: st.color,
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                }}>{st.label}</span>
              </div>
              <p style={{
                fontSize: '0.88rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.5,
              }}>{a.desc}</p>
            </motion.article>
          );
        })}
      </div>
    </CategoryPage>
  );
};

export default AiPage;
