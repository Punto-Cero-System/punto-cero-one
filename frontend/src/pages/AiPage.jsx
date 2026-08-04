import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { contentSourcesService } from '../services/feedService';
import AiToolCard from '../components/community/cards/AiToolCard';

/**
 * AiPage — Wave 12 Centro IA.
 * Uses the Content Sources System registry. NO chat, NO API keys, NO
 * external APIs consumed. Just a curated discovery centre of IA tools
 * with descriptions, use-cases, categories and click-out URLs.
 */
const AiPage = () => {
  const [tools, setTools] = useState([]);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    contentSourcesService.aiTools().then((d) => setTools(d.items || [])).catch(() => setTools([]));
  }, []);

  const categories = useMemo(() => {
    const s = new Set(tools.map((t) => t.category).filter(Boolean));
    return Array.from(s);
  }, [tools]);

  const visible = category ? tools.filter((t) => t.category === category) : tools;

  return (
    <CategoryPage
      icon="ai"
      eyebrow="Centro de Inteligencia Artificial"
      title="Descubre las herramientas de IA que están cambiando el trabajo"
      subtitle="Curación de herramientas por caso de uso. No chateamos con IA aquí; te llevamos directo a las mejores."
      testid="ai-page"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '0.9rem 1.15rem', borderRadius: 14,
          background: 'linear-gradient(120deg, rgba(139,92,246,0.08), rgba(34,211,238,0.08))',
          border: '1px solid rgba(139,92,246,0.16)',
          display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap',
          marginBottom: '1rem',
        }}>
        <Sparkles size={16} color="#5B21B6" />
        <span style={{ fontWeight: 700, color: '#5B21B6', fontSize: '0.85rem' }}>
          Filtrar por caso de uso:
        </span>
        <CategoryChip label="Todas" active={!category} onClick={() => setCategory(null)} />
        {categories.map((c) => (
          <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </motion.div>

      <div data-testid="ai-tools-grid" style={{
        display: 'grid', gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      }}>
        {visible.map((t) => <AiToolCard key={t.id} item={t} />)}
      </div>

      {visible.length === 0 && (
        <div style={{
          padding: '2rem', textAlign: 'center', borderRadius: 14,
          background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)',
          color: 'rgba(11,31,58,0.6)',
        }}>Cargando herramientas…</div>
      )}
    </CategoryPage>
  );
};

const CategoryChip = ({ label, active, onClick }) => (
  <button onClick={onClick}
    data-testid={`ai-category-${(label || 'all').toLowerCase().replace(/\s+/g, '-')}`}
    style={{
      padding: '0.3rem 0.75rem', borderRadius: 100, cursor: 'pointer',
      background: active ? 'rgba(139,92,246,0.18)' : 'transparent',
      border: `1px solid ${active ? '#8B5CF6' : 'rgba(11,31,58,0.12)'}`,
      color: active ? '#5B21B6' : NAVY,
      fontSize: '0.72rem', fontWeight: 700,
    }}>{label}</button>
);

export default AiPage;
