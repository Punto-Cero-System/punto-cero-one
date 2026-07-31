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
          max-width: 1360px;
          margin: 0 auto;
          padding: 1.25rem 1rem 4rem;
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr) 320px;
          gap: 1.5rem;
          align-items: start;
        }
        .pc-community-col { min-width: 0; }
        .pc-community-center { display: flex; flex-direction: column; gap: 1rem; }

        @media (max-width: 1280px) {
          .pc-community-grid {
            grid-template-columns: 240px minmax(0, 1fr) 300px;
            gap: 1.15rem;
          }
        }
        @media (max-width: 1200px) {
          .pc-community-grid {
            grid-template-columns: 240px minmax(0, 1fr);
            gap: 1.25rem;
          }
          .pc-community-right { display: none; }
        }
        @media (max-width: 900px) {
          .pc-community-grid {
            grid-template-columns: 1fr;
            padding: 1rem 0.75rem 5rem;
            gap: 1rem;
          }
          .pc-community-left { display: none; }
        }
      `}</style>
    </>
  );
};

export default CommunityLayout;
