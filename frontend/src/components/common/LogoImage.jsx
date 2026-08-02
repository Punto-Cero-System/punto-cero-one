import React, { useState } from 'react';

/**
 * LogoImage — renders a company/entity logo with graceful fallback.
 *
 * External logo providers (Clearbit, Google favicons, uploads) fail
 * frequently: DNS issues, discontinued services, blocked networks, ad
 * blockers. When the <img> errors we render a colored badge with the
 * entity's first letter instead of an infinite broken-image icon.
 *
 * Props
 * -----
 *   src        — image URL (nullable)
 *   name       — entity name (used for fallback initial + alt)
 *   size       — square size in px (default 46)
 *   radius     — border-radius in px (default: size/4)
 *   border     — optional CSS border (e.g. '3px solid #FFFFFF')
 *   background — fallback background (default: NAVY)
 *   color      — fallback text color (default: #FFFFFF)
 *   className, style — pass-through for extra styling
 */
const NAVY = '#0B1F3A';

const LogoImage = ({
  src,
  name = '',
  size = 46,
  radius,
  border,
  background = NAVY,
  color = '#FFFFFF',
  className,
  style,
  ...rest
}) => {
  const [broken, setBroken] = useState(false);
  const finalRadius = radius != null ? radius : Math.round(size / 4);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const showFallback = !src || broken;

  const commonStyle = {
    width: size, height: size, borderRadius: finalRadius,
    ...(border ? { border } : {}),
    ...(style || {}),
  };

  if (showFallback) {
    return (
      <div
        className={className}
        aria-label={name || 'logo'}
        style={{
          ...commonStyle,
          background,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Space Grotesk", sans-serif',
          fontWeight: 700,
          fontSize: Math.max(12, Math.round(size * 0.42)),
          userSelect: 'none',
          flexShrink: 0,
        }}
        {...rest}
      >{initial}</div>
    );
  }

  return (
    <img
      src={src}
      alt={name || ''}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
      style={{
        ...commonStyle,
        objectFit: 'cover',
        background: '#FFFFFF',
        flexShrink: 0,
      }}
      {...rest}
    />
  );
};

export default LogoImage;
