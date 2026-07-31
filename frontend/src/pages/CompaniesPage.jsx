import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Globe2 } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const CompaniesPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listCompanies().then(setItems); }, []);

  return (
    <CategoryPage
      icon="companies"
      eyebrow="Empresas del ecosistema"
      title="Los verticales que forman Punto Cero System"
      subtitle="Cada empresa comparte la misma base tecnológica One. Legal ya está LIVE; el resto llega en el roadmap 2026."
      testid="companies-page"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        {items.map((c, idx) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
            data-testid={`company-item-${c.id}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.2rem 1.25rem',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              display: 'flex', flexDirection: 'column', gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: NAVY,
                color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1.15rem',
              }}>0</div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '1.02rem', fontWeight: 700, color: NAVY,
                  margin: 0, letterSpacing: '-0.01em',
                }}>{c.name}</h2>
                <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>{c.vertical}</div>
              </div>
              <span style={{
                marginLeft: 'auto',
                padding: '0.25rem 0.6rem', borderRadius: 100,
                background: c.status === 'LIVE' ? 'rgba(0,200,150,0.13)' : 'rgba(212,175,55,0.15)',
                color: c.status === 'LIVE' ? '#00A277' : '#8A6D14',
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em',
              }}>{c.status}</span>
            </div>
            <p style={{
              fontSize: '0.87rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.5,
            }}>{c.desc}</p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)',
            }}>
              <Globe2 size={12} /> {c.country}
            </div>
            {c.href && (
              <a
                href={c.href} target="_blank" rel="noopener noreferrer"
                data-testid={`company-item-cta-${c.id}`}
                style={{
                  marginTop: '0.35rem',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.78rem', fontWeight: 700, color: NAVY,
                  textDecoration: 'none',
                }}
              >
                Visitar <ExternalLink size={12} />
              </a>
            )}
          </motion.article>
        ))}
      </div>
    </CategoryPage>
  );
};

export default CompaniesPage;
