import React from 'react';
import { Link } from 'react-router-dom';

// Punto Cero One official brand mark
export const PC_ONE_LOGO_URL =
  'https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/ryqkybmj_ChatGPT%20Image%2027%20jul%202026%2C%2004_03_53%20p.m..png';

/**
 * BrandMark — reusable Punto Cero One brand mark. Uses the official logo asset.
 * Variants: 'full' (default: image + optional tagline) | 'compact' (image only).
 * Automatically prefers a limpio look on any background thanks to inherit filters.
 */
const BrandMark = ({
  variant = 'full',
  size = 40,
  to = '/',
  showTagline = false,
  ariaLabel = 'Punto Cero One',
  className,
}) => {
  const inner = (
    <span
      className={className}
      data-testid="brandmark"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.65rem',
        textDecoration: 'none',
        color: 'inherit',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: size, height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #1E1B4B 0%, #0A0F1C 60%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 0 24px rgba(139,92,246,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>
        <img
          src={PC_ONE_LOGO_URL}
          alt={ariaLabel}
          loading="eager"
          decoding="async"
          style={{
            width: '160%', height: '160%',
            objectFit: 'cover',
            objectPosition: 'center',
            filter: 'contrast(1.05)',
          }}
        />
      </span>
      {variant === 'full' && (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
          <span style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '1.05rem', fontWeight: 700,
            letterSpacing: '0.02em',
          }}>
            PUNTO CERO <span style={{
              background: 'linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>ONE</span>
          </span>
          {showTagline && (
            <span style={{
              fontSize: '0.55rem',
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
              fontWeight: 500,
            }}>TODO EMPIEZA AQUÍ</span>
          )}
        </span>
      )}
    </span>
  );
  if (!to) return inner;
  return (
    <Link to={to} aria-label={ariaLabel} style={{ textDecoration: 'none', color: 'inherit' }}>
      {inner}
    </Link>
  );
};

export default BrandMark;
