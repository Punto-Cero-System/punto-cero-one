import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Calendar } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { mockApi } from '../services/mockData';

const EventsPage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { mockApi.listEvents().then(setItems); }, []);

  return (
    <CategoryPage
      icon="events"
      eyebrow="Eventos"
      title="Encuentros que conectan a la comunidad"
      subtitle="Roundtables privados, demos públicas, meetups regionales — la agenda del ecosistema en un solo lugar."
      testid="events-page"
    >
      {items.map((e, idx) => (
        <motion.article
          key={e.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, delay: idx * 0.05 }}
          data-testid={`event-item-${e.id}`}
          style={{
            background: '#FFFFFF', borderRadius: 16, padding: '1.05rem 1.15rem 1.15rem',
            border: '1px solid rgba(11,31,58,0.06)',
            boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
            display: 'flex', gap: '1rem', alignItems: 'flex-start',
          }}
        >
          <div style={{
            width: 62, height: 62, borderRadius: 14,
            background: 'linear-gradient(135deg, #0B1F3A, #4C1D95)',
            color: '#FFFFFF', flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700, opacity: 0.85 }}>
              {e.date.split(' ')[1]?.slice(0, 3).toUpperCase() || 'EVT'}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1 }}>
              {e.date.split(' ')[0]}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.05rem', fontWeight: 700, color: NAVY,
              margin: 0, letterSpacing: '-0.01em',
            }}>{e.title}</h2>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', margin: '0.35rem 0 0.55rem', fontSize: '0.78rem', color: 'rgba(11,31,58,0.65)' }}>
              <span><Calendar size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{e.date}</span>
              <span><MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{e.location}</span>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: 100,
                background: 'rgba(11,31,58,0.06)', color: NAVY,
                fontSize: '0.66rem', fontWeight: 700,
              }}>{e.modality}</span>
            </div>
            <p style={{ fontSize: '0.87rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.5 }}>
              {e.desc}
            </p>
            <Link
              to="/join"
              data-testid={`event-item-cta-${e.id}`}
              style={{
                marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.45rem 0.85rem', borderRadius: 100,
                background: NAVY, color: '#FFFFFF',
                fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none',
              }}
            >
              Solicitar invitación
            </Link>
          </div>
        </motion.article>
      ))}
    </CategoryPage>
  );
};

export default EventsPage;
