import React from 'react';

/**
 * CommunityLayout — 3-column layout (left sidebar / feed / right widgets).
 * Sidebars collapse on tablet/mobile via CSS.
 *
 * Props:
 *   - top: React node rendered full-width above the 3-column grid (usually the main slider).
 *   - left: React node for left sidebar.
 *   - center: React node for feed column.
 *   - right: React node for right widget column.
 */
const CommunityLayout = ({ top, left, center, right }) => {
  return (
    <>
      {top && <div className="pc-community-top">{top}</div>}
      <div className="pc-community-grid">
        {left && <div className="pc-community-col pc-community-left">{left}</div>}
        <div className="pc-community-col pc-community-center">{center}</div>
        {right && <div className="pc-community-col pc-community-right">{right}</div>}
      </div>

      <style>{`
        .pc-community-top { width: 100%; }
        .pc-community-grid {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 1rem clamp(0.75rem, 2vw, 2rem) 4rem;
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr) 320px;
          gap: clamp(1rem, 1.5vw, 1.5rem);
          align-items: start;
          box-sizing: border-box;
        }
        .pc-community-col { min-width: 0; }
        .pc-community-center { display: flex; flex-direction: column; gap: 0.85rem; }

        @media (max-width: 1400px) {
          .pc-community-grid {
            grid-template-columns: 240px minmax(0, 1fr) 300px;
          }
        }
        @media (max-width: 1200px) {
          .pc-community-grid {
            grid-template-columns: 220px minmax(0, 1fr);
            gap: 1.15rem;
          }
          .pc-community-right { display: none; }
        }
        @media (max-width: 900px) {
          .pc-community-grid {
            grid-template-columns: minmax(0, 1fr);
            padding: 0.75rem 0.75rem 5rem;
            gap: 0.85rem;
          }
          .pc-community-left { display: none; }
        }
        @media (max-width: 480px) {
          .pc-community-grid {
            padding: 0.5rem 0.5rem 5rem;
          }
        }
      `}</style>
    </>
  );
};

export default CommunityLayout;
