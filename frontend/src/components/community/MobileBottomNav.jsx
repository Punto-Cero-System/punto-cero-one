/**
 * MobileBottomNav — bottom navigation bar for < 900px viewports.
 * Renders the primary navigation targets as icons + labels. Hidden on
 * larger screens via CSS. Uses `pc-bottom-nav-space` global class in
 * body to reserve safe area when the bar is visible.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import AppIcon from './AppIcon';

const NAV = [
  { key: 'home', label: 'Mi Espacio', to: '/', icon: 'home' },
  { key: 'news', label: 'Noticias', to: '/noticias', icon: 'news' },
  { key: 'jobs', label: 'Empleos', to: '/empleos', icon: 'jobs' },
  { key: 'events', label: 'Eventos', to: '/eventos', icon: 'events' },
  { key: 'me', label: 'Perfil', to: '/perfil', icon: 'community' },
];

const MobileBottomNav = () => (
  <>
    <nav data-testid="mobile-bottom-nav" className="pc-bottom-nav" aria-label="Navegación principal">
      {NAV.map((n) => (
        <NavLink
          key={n.key}
          to={n.to}
          end={n.to === '/'}
          data-testid={`mobile-bottom-nav-${n.key}`}
          className={({ isActive }) => `pc-bottom-nav-item${isActive ? ' pc-bottom-nav-item--active' : ''}`}
        >
          <AppIcon name={n.icon} size={22} variant="color" />
          <span className="pc-bottom-nav-label">{n.label}</span>
        </NavLink>
      ))}
    </nav>
    <style>{`
      .pc-bottom-nav {
        position: fixed; left: 0; right: 0; bottom: 0;
        display: none;
        justify-content: space-around; align-items: center;
        padding: 0.35rem 0.4rem calc(0.35rem + env(safe-area-inset-bottom));
        background: rgba(10, 15, 28, 0.94);
        backdrop-filter: blur(14px);
        border-top: 1px solid rgba(255,255,255,0.06);
        z-index: 90;
      }
      .pc-bottom-nav-item {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 2px;
        padding: 0.4rem 0.3rem; text-decoration: none;
        color: rgba(255,255,255,0.7); border-radius: 12px;
        transition: background 0.2s, color 0.2s;
      }
      .pc-bottom-nav-item--active {
        color: #FFFFFF; background: rgba(255,255,255,0.06);
      }
      .pc-bottom-nav-label {
        font-size: 0.6rem; font-weight: 700; letter-spacing: 0.02em;
      }
      @media (max-width: 900px) {
        .pc-bottom-nav { display: flex; }
        body { padding-bottom: 64px; }
      }
    `}</style>
  </>
);

export default MobileBottomNav;
