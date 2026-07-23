import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import VisionSection from '../components/VisionSection';
import CircularCore from '../components/CircularCore';
import OrbitalEcosystem from '../components/OrbitalEcosystem';
import PuntoCeroLegalSection from '../components/PuntoCeroLegalSection';
import LatinAmericaBlock from '../components/LatinAmericaBlock';
import PeopleSection from '../components/PeopleSection';
import InvestorContactBlock from '../components/InvestorContactBlock';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';
import SoundToggle from '../components/SoundToggle';

const HomePage = () => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="noise-overlay" />
      <CustomCursor />
      <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />

      {/* Loading screen */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#0B1F3A',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '2rem',
            pointerEvents: 'none'
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: [0, 1.2, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 1.5, ease: [0.6, 0.05, 0.01, 0.9] }}
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '3px solid #00C896',
              position: 'relative',
              boxShadow: '0 0 60px rgba(0, 200, 150, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#00C896',
                fontFamily: '"Space Grotesk", sans-serif'
              }}
            >
              0
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: '1.2rem',
              fontWeight: 600,
              color: '#FFFFFF'
            }}
          >
            <span style={{ color: '#FFFFFF' }}>PUNTO</span>
            <span style={{ color: '#00C896' }}> CERO</span>
          </motion.div>
        </motion.div>
      )}

      {/* Main content - Only 8 blocks */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />

        {/* BLOCK 1: HERO */}
        <HeroSection />

        {/* BLOCK 2: VISION - From point to ecosystem */}
        <VisionSection />

        {/* BLOCK 3: TECHNOLOGY CORE */}
        <CircularCore />

        {/* BLOCK 4: VERTICALS ECOSYSTEM (includes Punto Cero Legal) */}
        <OrbitalEcosystem />
        <PuntoCeroLegalSection />

        {/* BLOCK 5+6: LATIN AMERICA + TIMELINE */}
        <LatinAmericaBlock />

        {/* BLOCK 7: PEOPLE - LIGHT SECTION */}
        <PeopleSection />

        {/* BLOCK 8: INVESTORS + CONTACT */}
        <InvestorContactBlock />

        {/* Institutional Footer */}
        <Footer />
      </div>
    </>
  );
};

export default HomePage;
