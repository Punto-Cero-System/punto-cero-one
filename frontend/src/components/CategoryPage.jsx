import React from 'react';
import { motion } from 'framer-motion';
import Header from './Header';
import Footer from './Footer';
import CustomCursor from './CustomCursor';
import CommunityLayout from './community/CommunityLayout';
import LeftSidebar from './community/LeftSidebar';
import RightWidgets from './community/RightWidgets';
import AppIcon from './community/AppIcon';

const NAVY = '#0B1F3A';

/**
 * CategoryPage — reusable layout for every content vertical (Noticias, Videos,
 * Empleos, Empresas, Eventos, IA, Comunidad).  Preserves the 3-column grid
 * so the community shell stays consistent and every screen feels part of the
 * same product.  Only the center column swaps.
 *
 * Props:
 *   icon:       AppIcon name for the header glyph.
 *   eyebrow:    small uppercase tag above the title.
 *   title:      main H1.
 *   subtitle:   short paragraph under the title.
 *   testid:     data-testid for the page container (e.g. "news-page").
 *   children:   center-column body.
 */
const CategoryPage = ({ icon = 'community', eyebrow, title, subtitle, testid, children }) => {
  return (
    <>
      <CustomCursor />
      <Header />
      <main
        data-testid={testid}
        style={{ paddingTop: '58px', background: '#F4F6FB', minHeight: '100vh' }}
      >
        <CommunityLayout
          top={<CategoryHero icon={icon} eyebrow={eyebrow} title={title} subtitle={subtitle} />}
          left={<LeftSidebar />}
          center={<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>}
          right={<RightWidgets />}
        />
      </main>
      <Footer />
    </>
  );
};

const CategoryHero = ({ icon, eyebrow, title, subtitle }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    style={{
      position: 'relative',
      padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 3rem)',
      background:
        'radial-gradient(circle at 15% 20%, rgba(59,130,246,0.15) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(236,72,153,0.13) 0%, transparent 45%), linear-gradient(120deg, #0A0F1C 0%, #0B1F3A 55%, #1E1B4B 100%)',
      color: '#FFFFFF',
      overflow: 'hidden',
    }}
  >
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
        padding: '0.4rem 0.85rem', borderRadius: 100,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        alignSelf: 'flex-start',
      }}>
        <AppIcon name={icon} size={16} variant="mono-light" />
        {eyebrow && (
          <span style={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>
            {eyebrow.toUpperCase()}
          </span>
        )}
      </div>
      <h1 style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: 'clamp(1.9rem, 4.5vw, 3rem)',
        fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em',
        margin: 0, maxWidth: 900,
      }}>{title}</h1>
      {subtitle && (
        <p style={{
          fontSize: 'clamp(0.9rem, 1.4vw, 1.05rem)',
          color: 'rgba(255,255,255,0.72)', margin: 0, maxWidth: 720, lineHeight: 1.55,
        }}>{subtitle}</p>
      )}
    </div>
  </motion.section>
);

export default CategoryPage;
export { NAVY };
