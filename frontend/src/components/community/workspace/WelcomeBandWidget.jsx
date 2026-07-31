import React from 'react';
import { motion } from 'framer-motion';

const WelcomeBandWidget = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: 0.2 }}
    data-testid="feed-welcome-bar"
    style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      padding: '0.85rem 1.1rem', borderRadius: 16,
      background: 'linear-gradient(120deg, rgba(11,31,58,0.94) 0%, rgba(76,29,149,0.85) 100%)',
      color: '#FFFFFF',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 10px 40px rgba(11,31,58,0.15)',
    }}
  >
    <span style={{
      width: 10, height: 10, borderRadius: '50%',
      background: '#00C896', boxShadow: '0 0 10px #00C896',
      animation: 'pcBeat 1.8s ease-in-out infinite', flexShrink: 0,
    }} />
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.005em' }}>
        Mi Espacio · Punto Cero One
      </div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)' }}>
        Este es tu escritorio inteligente. Personaliza los widgets desde Configuración.
      </div>
    </div>
    <style>{`@keyframes pcBeat { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }`}</style>
  </motion.div>
);
export default WelcomeBandWidget;
