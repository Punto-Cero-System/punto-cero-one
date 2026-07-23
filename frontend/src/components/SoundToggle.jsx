import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

const SoundToggle = ({ soundEnabled, setSoundEnabled }) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1 }}
      onClick={() => setSoundEnabled(!soundEnabled)}
      className="interactive"
      style={{
        position: 'fixed',
        top: '2rem',
        right: '2rem',
        zIndex: 1000,
        background: 'rgba(11, 31, 58, 0.8)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 200, 150, 0.3)',
        borderRadius: '12px',
        padding: '12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: soundEnabled ? '#00C896' : '#FFFFFF',
        transition: 'all 0.3s ease'
      }}
    >
      {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </motion.button>
  );
};

export default SoundToggle;
