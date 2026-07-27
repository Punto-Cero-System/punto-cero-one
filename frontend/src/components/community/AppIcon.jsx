import React from 'react';

/**
 * AppIcon — family iconography for the Punto Cero One ecosystem.
 * Every icon shares the same "ring" (24×24 circle, stroke 2) around a glyph.
 * Variants: color (default) | mono-light | mono-dark.
 * Accepts standard SVG props (size, className, etc.).
 */
const APP_MAP = {
  legal: { ring: '#00C896', glyph: (
    <>
      <path d="M12 6v12" strokeLinecap="round" />
      <path d="M6 9h12" strokeLinecap="round" />
      <path d="M9 9l-2 4h4l-2-4M15 9l-2 4h4l-2-4" strokeLinejoin="round" fill="none" />
    </>
  ) },
  news: { ring: '#3B82F6', glyph: (
    <>
      <rect x="6.5" y="7.5" width="11" height="9" rx="1.5" fill="none" />
      <path d="M9 10.5h6M9 13h4" strokeLinecap="round" />
    </>
  ) },
  video: { ring: '#8B5CF6', glyph: (
    <path d="M10 8.5v7l6-3.5-6-3.5z" strokeLinejoin="round" fill="currentColor" />
  ) },
  jobs: { ring: '#D4AF37', glyph: (
    <>
      <rect x="6.5" y="9" width="11" height="7.5" rx="1" fill="none" />
      <path d="M10 9v-1.5a1 1 0 011-1h2a1 1 0 011 1V9" fill="none" strokeLinecap="round" />
    </>
  ) },
  ai: { ring: '#22D3EE', glyph: (
    <>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
      <path d="M12 12L8 9M12 12L16 9M12 12L8 15M12 12L16 15" strokeLinecap="round" />
    </>
  ) },
  companies: { ring: '#94A3B8', glyph: (
    <>
      <rect x="7" y="8" width="10" height="9" fill="none" />
      <path d="M9.5 11h1M13.5 11h1M9.5 14h1M13.5 14h1" strokeLinecap="round" />
    </>
  ) },
  marketplace: { ring: '#FB923C', glyph: (
    <>
      <path d="M7 10h10l-1 6.5H8L7 10z" fill="none" strokeLinejoin="round" />
      <path d="M9.5 10V8.5a2.5 2.5 0 015 0V10" fill="none" strokeLinecap="round" />
    </>
  ) },
  learn: { ring: '#A855F7', glyph: (
    <>
      <path d="M5.5 10L12 7l6.5 3-6.5 3-6.5-3z" fill="none" strokeLinejoin="round" />
      <path d="M8 11.5v3c0 1 1.8 2 4 2s4-1 4-2v-3" fill="none" />
    </>
  ) },
  events: { ring: '#EC4899', glyph: (
    <>
      <rect x="7" y="8.5" width="10" height="8.5" rx="1" fill="none" />
      <path d="M9.5 7v3M14.5 7v3M7 11h10" strokeLinecap="round" />
    </>
  ) },
  music: { ring: '#EF4444', glyph: (
    <>
      <path d="M10 14V8.5l4-1V13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </>
  ) },
  podcast: { ring: '#F472B6', glyph: (
    <>
      <rect x="10" y="7" width="4" height="7" rx="2" fill="none" />
      <path d="M8 12a4 4 0 008 0M12 16v2" fill="none" strokeLinecap="round" />
    </>
  ) },
  capital: { ring: '#D4AF37', glyph: (
    <path d="M12 6.5l4 4.5-4 6.5-4-6.5 4-4.5z" fill="none" strokeLinejoin="round" />
  ) },
  travel: { ring: '#06B6D4', glyph: (
    <>
      <circle cx="12" cy="12" r="4.5" fill="none" />
      <path d="M7.5 12h9M12 7.5c1.5 1.5 2 3 2 4.5s-.5 3-2 4.5c-1.5-1.5-2-3-2-4.5s.5-3 2-4.5z" fill="none" />
    </>
  ) },
  health: { ring: '#F87171', glyph: (
    <path d="M12 17.5s-5-3-5-7a3 3 0 015-2.2A3 3 0 0117 10.5c0 4-5 7-5 7z" fill="none" strokeLinejoin="round" />
  ) },
  accounting: { ring: '#10B981', glyph: (
    <>
      <path d="M8 6.5v11l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1-1V6.5z" fill="none" strokeLinejoin="round" />
      <path d="M10 10h4M10 13h4" strokeLinecap="round" />
    </>
  ) },
  home: { ring: '#38BDF8', glyph: (
    <path d="M6.5 12L12 7l5.5 5v5.5h-3v-3h-5v3h-3z" fill="none" strokeLinejoin="round" />
  ) },
  search: { ring: '#64748B', glyph: (
    <>
      <circle cx="11" cy="11" r="3.5" fill="none" />
      <path d="M14 14l3 3" strokeLinecap="round" />
    </>
  ) },
  community: { ring: '#14B8A6', glyph: (
    <>
      <circle cx="9" cy="10" r="1.75" fill="none" />
      <circle cx="15" cy="10" r="1.75" fill="none" />
      <path d="M6 16c0-2 1.5-3 3-3s3 1 3 3M12 16c0-2 1.5-3 3-3s3 1 3 3" fill="none" strokeLinecap="round" />
    </>
  ) },
};

const AppIcon = ({
  name = 'home',
  size = 24,
  variant = 'color',
  strokeWidth = 1.75,
  className,
  style,
  ...rest
}) => {
  const spec = APP_MAP[name] || APP_MAP.home;
  const color =
    variant === 'mono-light' ? '#FFFFFF' :
    variant === 'mono-dark' ? '#0B1F3A' :
    spec.ring;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', color, ...style }}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      fill="none"
      aria-hidden="true"
      data-app-icon={name}
      {...rest}
    >
      <circle cx="12" cy="12" r="10.5" strokeOpacity={variant === 'color' ? 0.6 : 1} />
      {spec.glyph}
    </svg>
  );
};

export { APP_MAP };
export default AppIcon;
