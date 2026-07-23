import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import CircularCore from '../components/CircularCore';
import ZeroMoment from '../components/ZeroMoment';
import OrbitalEcosystem from '../components/OrbitalEcosystem';
import PuntoCeroLegalSection from '../components/PuntoCeroLegalSection';
import HumanImpactSection from '../components/HumanImpactSection';
import LatinAmericaLiving from '../components/LatinAmericaLiving';
import ManifestoSection from '../components/ManifestoSection';
import InvestorsSection from '../components/InvestorsSection';
import PartnersSection from '../components/PartnersSection';
import CommunitySection from '../components/CommunitySection';
import PressSection from '../components/PressSection';
import CareersSection from '../components/CareersSection';
import MarqueeSection from '../components/MarqueeSection';
import ContactSection from '../components/ContactSection';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';
import SoundToggle from '../components/SoundToggle';

const HomePage = () => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Noise overlay */}
      <div className="noise-overlay" />
      
      {/* Custom cursor */}
      <CustomCursor />
      
      {/* Sound toggle */}
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
          {/* Animated zero */}
          <motion.div
            initial={{ scale: 0, rotate: 0 }}
            animate={{ 
              scale: [0, 1.2, 1],
              rotate: [0, 180, 360]
            }}
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

          {/* Loading text */}
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

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <HeroSection />
        <CircularCore />
        <ZeroMoment />
        <HumanImpactSection />
        <OrbitalEcosystem />
        <PuntoCeroLegalSection />
        <LatinAmericaLiving />
        <ManifestoSection />
        <InvestorsSection />
        <PartnersSection />
        <CommunitySection />
        <PressSection />
        <CareersSection />
        <MarqueeSection />
        <ContactSection />
        <Footer />
      </div>
    </>
  );
};

export default HomePage;
