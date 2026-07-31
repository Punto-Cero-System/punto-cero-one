import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Briefcase } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const JobsPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listJobs().then(setItems); }, []);

  return (
    <CategoryPage
      icon="jobs"
      eyebrow="Empleos"
      title="Únete al equipo que construye LatAm desde cero"
      subtitle="Oportunidades abiertas en Punto Cero System, Punto Cero Legal y los verticales del ecosistema."
      testid="jobs-page"
    >
      {items.map((j, idx) => (
        <motion.article
          key={j.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, delay: idx * 0.05 }}
          data-testid={`job-item-${j.id}`}
          style={{
            background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem',
            border: '1px solid rgba(11,31,58,0.06)',
            boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #0B1F3A, #1E3A8A)',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Briefcase size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.05rem', fontWeight: 700, color: NAVY,
                margin: 0, marginBottom: '0.15rem', letterSpacing: '-0.01em',
              }}>{j.title}</h2>
              <div style={{ fontSize: '0.8rem', color: 'rgba(11,31,58,0.65)' }}>
                {j.company} · <MapPin size={11} style={{ verticalAlign: -1 }} /> {j.location}
                <span style={{
                  marginLeft: 8, padding: '0.15rem 0.45rem', borderRadius: 100,
                  background: 'rgba(0,200,150,0.1)', color: '#00A277',
                  fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em',
                }}>{j.modality.toUpperCase()}</span>
              </div>
              <p style={{
                fontSize: '0.87rem', color: 'rgba(11,31,58,0.72)',
                margin: '0.55rem 0 0.75rem', lineHeight: 1.5,
              }}>{j.desc}</p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                {j.tags.map((t) => (
                  <span key={t} style={{
                    padding: '0.2rem 0.55rem', borderRadius: 100,
                    background: 'rgba(11,31,58,0.05)', color: NAVY,
                    fontSize: '0.7rem', fontWeight: 600,
                  }}>{t}</span>
                ))}
              </div>
              <Link
                to="/join"
                data-testid={`job-item-apply-${j.id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.5rem 0.95rem', borderRadius: 100,
                  background: NAVY, color: '#FFFFFF',
                  fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                }}
              >
                Postular
              </Link>
            </div>
          </div>
        </motion.article>
      ))}
    </CategoryPage>
  );
};

export default JobsPage;
