/**
 * Right panel primitives — extracted from RightWidgets.jsx so each widget
 * can be rendered independently by the Widget Manager without pulling in
 * the whole panel.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import AppIcon from '../AppIcon';

const NAVY = '#0B1F3A';

export const RightCard = ({ title, icon, children, testid, seeAllHref, seeAllLabel }) => (
  <div data-testid={testid} style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '0.95rem 1rem 0.8rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
      color: 'rgba(11,31,58,0.55)', marginBottom: '0.7rem',
    }}>
      <AppIcon name={icon} size={16} /> <span>{title.toUpperCase()}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      {children}
    </div>
    {seeAllHref && (
      <a href={seeAllHref}
        data-testid={testid ? `${testid}-see-all` : 'right-card-see-all'}
        style={{
          display: 'block', textAlign: 'center', marginTop: '0.55rem',
          padding: '0.3rem 0', fontSize: '0.72rem', fontWeight: 700,
          color: '#00A277', textDecoration: 'none', letterSpacing: '0.06em',
        }}>
        {seeAllLabel || 'Ver todos'} →
      </a>
    )}
  </div>
);

export const TrendRow = ({ n, label, meta }) => (
  <a href="#trends" style={{
    display: 'flex', gap: '0.6rem', padding: '0.35rem 0', textDecoration: 'none', alignItems: 'flex-start',
  }}>
    <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.4)', fontWeight: 700, marginTop: 2 }}>
      {String(n).padStart(2, '0')}
    </span>
    <div>
      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>
        <TrendingUp size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{meta}
      </div>
    </div>
  </a>
);

export const EventRow = ({ month, day, title, hint }) => (
  <div style={{
    display: 'flex', gap: '0.7rem', padding: '0.45rem 0',
    borderBottom: '1px solid rgba(11,31,58,0.05)', alignItems: 'center',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: 'linear-gradient(135deg, #0B1F3A, #1E3A8A)',
      color: '#FFFFFF', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontSize: '0.5rem', letterSpacing: '0.14em', fontWeight: 700 }}>{month}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1 }}>{day}</span>
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</div>
    </div>
  </div>
);

export const CompanyRow = ({ tag, name, href, to, external }) => {
  const Comp = to ? Link : 'a';
  const props = to ? { to } : { href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) };
  return (
    <Comp {...props} style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.45rem 0', textDecoration: 'none',
      borderBottom: '1px solid rgba(11,31,58,0.05)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: '#0B1F3A', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1rem',
        flexShrink: 0,
      }}>0</div>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY }}>{name}</div>
        <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>{tag}</div>
      </div>
    </Comp>
  );
};

export const ToolRow = ({ icon, label, hint }) => (
  <a href="#tools" style={{
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.4rem 0', textDecoration: 'none',
  }}>
    <AppIcon name={icon} size={20} />
    <div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</div>
    </div>
  </a>
);
