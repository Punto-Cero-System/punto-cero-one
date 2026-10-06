/**
 * MobileBottomNav — bottom navigation bar for < 900px viewports.
 * Renders the primary navigation targets as icons + labels. Hidden on
 * larger screens via CSS. Uses `pc-bottom-nav-space` global class in
 * body to reserve safe area when the bar is visible.
 *
 * PUNTO 7 · C6 — La barra se DERIVA de `NAV_ITEMS` (la MISMA fuente de verdad
 * que el header) en vez de declarar su propia lista. Antes eran dos arrays
 * paralelos: la alineación Desktop/Móvil del Punto 4 dependía de que alguien
 * recordara editar los dos a mano, y ya se había desincronizado (`/perfil`
 * sólo existía aquí). Ahora el único destino extra que se conserva es
 * "Perfil", que no es un módulo del ecosistema sino una cuenta de usuario —
 * por eso vive aparte y no se cuela en `NAV_ITEMS`.
 *
 * Sin cambio de destinos ni de claves: los `data-testid` se conservan
 * exactamente igual (`mobile-bottom-nav-<key>`).
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import AppIcon from './AppIcon';
import { NAV_ITEMS } from '../Header';

/** Destino que no pertenece al ecosistema: el perfil del propio usuario. */
const ACCOUNT_ITEM = { key: 'me', label: 'Perfil', to: '/perfil', icon: 'community' };

const NAV = [...NAV_ITEMS, ACCOUNT_ITEM];

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
