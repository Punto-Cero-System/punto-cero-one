/**
 * BaseCard — shared card primitive for the Intelligent Mixed Feed.
 *
 * All content-type cards (NewsCard, JobCard, EventCard, ...) render this
 * base and override the accent color, badge label, primary action, and
 * media zone. Keeping the layout in one place gives the feed a coherent
 * "same-family" look while letting each type feel distinct via colour.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

const NAVY = '#0B1F3A';

const BaseCard = ({
  accent = NAVY,
  badgeLabel,
  badgeIcon: BadgeIcon,
  media,
  header,
  title,
  description,
  meta,
  primaryAction,
  secondaryActions,
  footer,
  testid,
  onClick,
}) => (
  <motion.article
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    data-testid={testid}
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      borderRadius: 16,
      border: '1px solid rgba(11,31,58,0.06)',
      boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
    }}
  >
    <span
      aria-hidden
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
      }}
    />

    {media && (
      <div style={{ borderBottom: '1px solid rgba(11,31,58,0.04)' }}>
        {media}
      </div>
    )}

    <div style={{ padding: '1rem 1.15rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {(badgeLabel || header) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          {badgeLabel && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.22rem 0.55rem', borderRadius: 100,
              background: `${accent}18`, color: accent,
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}>
              {BadgeIcon && <BadgeIcon size={11} />} {badgeLabel}
            </span>
          )}
          {header}
        </div>
      )}

      {title && (
        <h3 style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: '1rem', fontWeight: 700,
          color: NAVY, margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em',
        }}>{title}</h3>
      )}

      {description && (
        <p style={{
          fontSize: '0.85rem', lineHeight: 1.5,
          color: 'rgba(11,31,58,0.72)', margin: 0,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{description}</p>
      )}

      {meta && (
        <div style={{
          display: 'flex', gap: '0.55rem', flexWrap: 'wrap',
          fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)', fontWeight: 500,
        }}>{meta}</div>
      )}
    </div>

    {(primaryAction || secondaryActions?.length) && (
      <div style={{
        marginTop: 'auto',
        padding: '0.55rem 1.15rem 0.95rem',
        borderTop: '1px solid rgba(11,31,58,0.04)',
        display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center',
      }}>
        {primaryAction}
        {secondaryActions}
      </div>
    )}

    {footer}
  </motion.article>
);

export const CardCTA = ({ href, label, icon: Icon = ExternalLink, color = NAVY, testid, onClick }) => (
  <a
    href={href}
    onClick={onClick}
    target={href && href.startsWith('http') ? '_blank' : undefined}
    rel="noopener noreferrer"
    data-testid={testid}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '0.5rem 0.85rem', borderRadius: 100,
      background: color, color: '#FFFFFF', textDecoration: 'none',
      fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.01em',
    }}>
    {label} <Icon size={13} />
  </a>
);

export const CardGhostCTA = ({ onClick, label, icon: Icon, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '0.45rem 0.75rem', borderRadius: 100,
      background: 'rgba(11,31,58,0.05)', color: NAVY, border: 'none',
      fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
    }}>
    {Icon && <Icon size={12} />} {label}
  </button>
);

export const CardMeta = ({ children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }}>{children}</span>
);

export default BaseCard;
