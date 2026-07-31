import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import AppIcon from '../AppIcon';

const GOLD = '#D4AF37';

const CapitalCtaWidget = () => (
  <Link to="/capital" data-testid="workspace-widget-capital-cta" style={{ textDecoration: 'none' }}>
    <motion.div whileHover={{ y: -2 }} style={{
      padding: '1rem 1.1rem', borderRadius: 16,
      background: `linear-gradient(135deg, #0A0F1C 0%, #1E1B4B 60%, #4C1D95 100%)`,
      color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '0.35rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GOLD}66 0%, transparent 70%)`,
        filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
        <AppIcon name="capital" size={22} variant="mono-light" />
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: GOLD }}>
          INVESTOR CENTER
        </span>
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, position: 'relative' }}>Explora la experiencia Capital</div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', position: 'relative' }}>
        Executive Summary · Pitch Deck · Roadmap
      </div>
      <div style={{
        marginTop: '0.35rem', fontSize: '0.72rem',
        display: 'flex', alignItems: 'center', gap: '0.35rem', color: GOLD, fontWeight: 700,
        position: 'relative',
      }}>Entrar <ArrowUpRight size={14} /></div>
    </motion.div>
  </Link>
);
export default CapitalCtaWidget;
