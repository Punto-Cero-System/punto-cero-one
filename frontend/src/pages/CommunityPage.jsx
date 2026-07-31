import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import AppIcon from '../components/community/AppIcon';
import { mockApi } from '../services/mockData';

const CommunityPage = () => {
  const [groups, setGroups] = useState([]);
  useEffect(() => { mockApi.listGroups().then(setGroups); }, []);

  return (
    <CategoryPage
      icon="community"
      eyebrow="Comunidad"
      title="Grupos, círculos y conversaciones activas"
      subtitle="Encuentra tu tribu dentro del ecosistema. Grupos abiertos por vertical, país y disciplina."
      testid="community-page"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {groups.map((g, idx) => (
          <motion.article
            key={g.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.04 }}
            data-testid={`group-item-${g.id}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, padding: '1.05rem 1.15rem 1.2rem',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              display: 'flex', flexDirection: 'column', gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)',
                color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: '1rem', fontWeight: 700, color: NAVY, margin: 0, letterSpacing: '-0.01em',
                }}>{g.name}</h2>
                <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>
                  <AppIcon name="community" size={11} /> {g.hint}
                </div>
              </div>
            </div>
            <span style={{
              alignSelf: 'flex-start',
              padding: '0.2rem 0.55rem', borderRadius: 100,
              background: 'rgba(11,31,58,0.05)', color: NAVY,
              fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em',
            }}>{g.tag.toUpperCase()}</span>
            <button
              data-testid={`group-join-${g.id}`}
              style={{
                marginTop: '0.25rem', padding: '0.5rem 0.85rem', borderRadius: 100,
                background: NAVY, color: '#FFFFFF', border: 'none',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Unirme al grupo
            </button>
          </motion.article>
        ))}
      </div>
    </CategoryPage>
  );
};

export default CommunityPage;
