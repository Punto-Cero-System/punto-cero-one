/**
 * CompanyTrustBadge — the single source of truth for what a company's trust
 * state means to a visitor.
 *
 * WHY THIS EXISTS
 * ---------------
 * The listing used to render a bare green shield whenever
 * `verification === "verified"`. Because the curated directory also wrote
 * `verification: "verified"`, that shield appeared on 41 real third-party
 * brands (Microsoft, Bancolombia, Ecopetrol…) with nothing behind it. A green
 * shield reads as a legal endorsement, so the UI was making a claim the
 * backend could not support.
 *
 * The badge now names the state in words and carries a tooltip explaining it,
 * so "included in our directory" is never read as "identity verified".
 *
 * Two independent axes are rendered, in this priority order:
 *   1. `verification === "verified"` → identity was actually checked
 *   2. `origin === "directory"`     → curated public reference entry
 *
 * And a narrower split INSIDE `verified`, added when traceability landed:
 *   a. `verified_at` present → a named person checked it on a date. That can be
 *      stated confidently.
 *   b. `verified_at` absent   → the status says verified, but nothing records
 *      who did it or when. This is the shape every company verified before
 *      traceability existed. An unattributable claim is not dressed up as a
 *      supported one, so it reads as pending instead.
 *
 * Props: `company`, `size` ('sm' | 'md'), and optional `className`.
 */
import React from 'react';
import { ShieldCheck, Building2, Clock, AlertTriangle, CircleDashed } from 'lucide-react';

/**
 * Resolve the trust state. Kept as a named export so tests can assert the
 * mapping without rendering.
 */
export const resolveTrustState = (company = {}) => {
  const verification = company.verification || 'unverified';
  const origin = company.origin || (company.is_public_seed ? 'directory' : 'member');

  if (verification === 'verified') {
    // Only the date portion of the ISO string: deterministic across locales
    // and timezones, and nothing is parsed or mutated on the way.
    const checkedOn = company.verified_at ? String(company.verified_at).slice(0, 10) : '';

    if (checkedOn) {
      return {
        key: 'verified',
        label: 'Verificada',
        Icon: ShieldCheck,
        color: '#00C896',
        bg: 'rgba(0,200,150,0.10)',
        border: 'rgba(0,200,150,0.30)',
        title: `Verificada por Punto Cero — revisión registrada el ${checkedOn}.`
          + (company.verification_source === 'manual_review' ? ' Fuente: revisión manual.' : ''),
      };
    }

    return {
      key: 'verified-pending',
      label: 'Verificación pendiente',
      Icon: Clock,
      color: '#B45309',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.28)',
      title: 'Verificación pendiente de información adicional.',
    };
  }
  if (verification === 'flagged') {
    return {
      key: 'flagged',
      label: 'En disputa',
      Icon: AlertTriangle,
      color: '#B91C1C',
      bg: 'rgba(220,38,38,0.08)',
      border: 'rgba(220,38,38,0.25)',
      title: 'Esta ficha está siendo revisada por el equipo de Punto Cero.',
    };
  }
  if (origin === 'directory') {
    return {
      key: 'directory',
      label: 'Directorio Punto Cero',
      Icon: Building2,
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.10)',
      border: 'rgba(59,130,246,0.28)',
      title: 'Organización incluida por Punto Cero como referencia pública. '
        + 'Esto describe su origen, no una verificación legal.',
    };
  }
  if (verification === 'pending') {
    return {
      key: 'pending',
      label: 'Registrada',
      Icon: Clock,
      color: '#B45309',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.28)',
      title: 'Registrada por un miembro de la comunidad. Pendiente de validación.',
    };
  }
  return {
    key: 'unverified',
    label: 'Sin verificar',
    Icon: CircleDashed,
    color: 'rgba(11,31,58,0.55)',
    bg: 'rgba(11,31,58,0.05)',
    border: 'rgba(11,31,58,0.12)',
    title: 'Todavía no se ha comprobado la identidad de esta empresa.',
  };
};

// Default is "md" (label visible) on purpose: a badge that hides what it means
// by default reintroduces exactly the ambiguity this component removes. Callers
// that place it inside a tight heading must opt into "sm" explicitly.
const CompanyTrustBadge = ({ company, size = 'md' }) => {
  const { label, Icon, color, bg, border, title, key } = resolveTrustState(company);
  const compact = size === 'sm';

  return (
    <span
      data-testid={`company-trust-${key}`}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 5,
        padding: compact ? '2px 7px' : '4px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: compact ? '0.58rem' : '0.7rem',
        fontWeight: 800,
        letterSpacing: compact ? '0.04em' : '0.05em',
        whiteSpace: 'nowrap',
        cursor: 'help',
        fontFamily: 'inherit',
      }}
    >
      <Icon size={compact ? 10 : 13} style={{ flexShrink: 0 }} />
      {!compact && label}
    </span>
  );
};

export default CompanyTrustBadge;
