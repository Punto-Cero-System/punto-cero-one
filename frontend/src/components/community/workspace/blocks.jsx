/**
 * Small building block shared by ActivityWidget / GroupsWidget / QuickLinksWidget.
 * Extracted verbatim from LeftSidebar so we can compose the same look.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppIcon from '../AppIcon';

const NAVY = '#0B1F3A';

export const SidebarBlock = ({ title, children, testid }) => (
  <div data-testid={testid} style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '1rem 1rem 0.75rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
      color: 'rgba(11,31,58,0.5)', marginBottom: '0.7rem',
    }}>{title.toUpperCase()}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingBottom: '0.25rem' }}>
      {children}
    </div>
  </div>
);

export const ActivityRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.82rem' }}>
    <span style={{ color: 'rgba(11,31,58,0.7)' }}>{label}</span>
    <span style={{ color: NAVY, fontWeight: 700 }}>{value}</span>
  </div>
);

export const GroupRow = ({ icon, label, hint }) => (
  <motion.a whileHover={{ x: 2 }} href="#groups" style={{
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.45rem 0', textDecoration: 'none', color: NAVY,
  }}>
    <AppIcon name={icon} size={22} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</span>
    </div>
  </motion.a>
);

export const QuickLink = ({ icon, label, href, to, external }) => {
  const Comp = to ? Link : 'a';
  const props = to ? { to } : { href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) };
  return (
    <Comp {...props} style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.4rem 0', textDecoration: 'none',
      color: NAVY, fontSize: '0.85rem', fontWeight: 500,
    }}>
      <AppIcon name={icon} size={20} />
      <span>{label}</span>
    </Comp>
  );
};
