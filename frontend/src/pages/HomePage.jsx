import React from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';

// Founders / people components — reused inside the SECONDARY slider (feed).
import FoundersSection from '../components/FoundersSection';
import PeopleSection from '../components/PeopleSection';
import CareersSection from '../components/CareersSection';

// Community layout & building blocks.
import CommunityLayout from '../components/community/CommunityLayout';
import LeftSidebar from '../components/community/LeftSidebar';
import RightWidgets from '../components/community/RightWidgets';
import LiveFeed from '../components/community/LiveFeed';
import FeedItem from '../components/community/FeedItem';
import { InlineWidgetStrip } from '../components/community/Widgets';
import SlideCarousel from '../components/SlideCarousel';

// Redesigned primary slider content (professional, feed-friendly).
import { PRIMARY_SLIDES } from '../components/PrimarySlides';

const SECONDARY_SLIDES = [
  { key: 'founders', node: <FoundersSection /> },
  { key: 'people', node: <PeopleSection /> },
  { key: 'careers', node: <CareersSection /> },
];

/**
 * HomePage — Punto Cero One community home.
 * ── Primary slider on top (redesigned, 6 modern slides, 12s autoplay).
 * ── 3-column community layout (left sidebar / feed / right widgets).
 * ── Center column is a fully-real LiveFeed (backend at /api/feed/*) with a
 *    couple of editorial "always-on" items woven in for ecosystem context.
 */
const HomePage = () => {
  return (
    <>
      <CustomCursor />
      <Header />

      <main id="top" style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}>
        <CommunityLayout
          top={
            <SlideCarousel
              id="pc-slider-primary"
              slides={PRIMARY_SLIDES}
              autoplayMs={12000}
              height="clamp(520px, 74vh, 720px)"
              label="Slider principal · visión Punto Cero One"
            />
          }
          left={<LeftSidebar />}
          center={
            <>
              {/* Welcome transition band */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
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
                    Bienvenido a la comunidad
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)' }}>
                    Publica tu primer punto cero y conecta con el ecosistema
                  </div>
                </div>
                <style>{`@keyframes pcBeat { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }`}</style>
              </motion.div>

              {/* REAL FEED — powered by /api/feed/* */}
              <LiveFeed />

              {/* Editorial ecosystem slider (always-on, non-feed item) */}
              <FeedItem
                kind="slider"
                author="The Founding Team"
                timestamp="Historia del ecosistema"
                title="Las personas detrás de la visión → 18 países"
                body="Recorrido por el equipo fundador, la comunidad y la ambición regional para Latinoamérica."
                padded={false}
                node={
                  <SlideCarousel
                    id="pc-slider-team"
                    slides={SECONDARY_SLIDES}
                    autoplayMs={14000}
                    height="clamp(720px, 100vh, 1100px)"
                    label="Slider equipo fundador y comunidad"
                  />
                }
              />

              <InlineWidgetStrip />
            </>
          }
          right={<RightWidgets />}
        />
      </main>

      <Footer />
    </>
  );
};

export default HomePage;
