/**
 * CompanyTrustBadge — mapping between backend trust state and what the user reads.
 *
 * The regression these tests lock down: the listing used to render a green
 * shield for `verification === "verified"`, and the curated directory wrote
 * that value on every seeded entry. A bare shield on Microsoft or Bancolombia
 * read as a legal endorsement that nothing had ever checked.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanyTrustBadge, { resolveTrustState } from '../CompanyTrustBadge';

describe('resolveTrustState', () => {
  it('una empresa del directorio NO se presenta como verificada', () => {
    const s = resolveTrustState({ origin: 'directory', verification: 'unverified' });
    expect(s.key).toBe('directory');
    expect(s.label).toBe('Directorio Punto Cero');
    expect(s.key).not.toBe('verified');
  });

  it('la verificación real tiene prioridad sobre el origen', () => {
    const s = resolveTrustState({
      origin: 'directory',
      verification: 'verified',
      verified_at: '2026-10-05T09:00:00+00:00',
    });
    expect(s.key).toBe('verified');
  });

  it('una empresa registrada por un usuario aparece como "Registrada"', () => {
    expect(resolveTrustState({ origin: 'member', verification: 'pending' }).label)
      .toBe('Registrada');
  });

  it('sin verificación ni directorio cae en "Sin verificar"', () => {
    expect(resolveTrustState({ origin: 'member', verification: 'unverified' }).label)
      .toBe('Sin verificar');
  });

  it('una empresa en disputa no se confunde con verificada', () => {
    const s = resolveTrustState({ origin: 'member', verification: 'flagged' });
    expect(s.key).toBe('flagged');
    expect(s.key).not.toBe('verified');
  });

  it('deriva el origen de is_public_seed en documentos antiguos', () => {
    // Documento previo a la fase: sin `origin`, con la marca histórica.
    expect(resolveTrustState({
      is_public_seed: true,
      verification: 'verified',
      verified_at: '2026-01-01T00:00:00+00:00',
    }).key).toBe('verified');
    expect(resolveTrustState({ is_public_seed: true, verification: 'unverified' }).key)
      .toBe('directory');
  });

  it('el texto explicativo aclara que directorio ≠ verificación legal', () => {
    expect(resolveTrustState({ origin: 'directory' }).title)
      .toMatch(/no una verificación legal/i);
  });
});

describe('CompanyTrustBadge', () => {
  it('muestra el estado del directorio junto al nombre', () => {
    render(<CompanyTrustBadge company={{ origin: 'directory', verification: 'unverified' }} />);
    expect(screen.getByTestId('company-trust-directory')).toBeInTheDocument();
    expect(screen.getByText('Directorio Punto Cero')).toBeInTheDocument();
  });

  it('expone la explicación como title accesible', () => {
    render(<CompanyTrustBadge company={{ origin: 'directory' }} />);
    const badge = screen.getByTestId('company-trust-directory');
    expect(badge).toHaveAttribute('title');
    expect(badge.getAttribute('title').length).toBeGreaterThan(20);
  });

  it('en tamaño compacto el icono va sin repetir la etiqueta', () => {
    render(<CompanyTrustBadge company={{ origin: 'directory' }} size="sm" />);
    expect(screen.queryByText('Directorio Punto Cero')).not.toBeInTheDocument();
    expect(screen.getByTestId('company-trust-directory')).toBeInTheDocument();
  });

  it('una empresa verificada conserva el estado visible', () => {
    render(<CompanyTrustBadge company={{
      origin: 'member',
      verification: 'verified',
      verified_at: '2026-10-05T09:00:00+00:00',
    }} />);
    expect(screen.getByTestId('company-trust-verified')).toBeInTheDocument();
    expect(screen.getByText('Verificada')).toBeInTheDocument();
  });
});

// ── Trazabilidad de la verificación ─────────────────────────────────────────
// Quién revisó, cuándo y por qué medio. El badge solo afirma lo que el
// backend puede respaldar: sin fecha registrada no hay afirmación que
// respaldar, así que el texto cambia en lugar de seguir diciendo "Verificada".
describe('CompanyTrustBadge — trazabilidad', () => {
  it('verificada CON registro expone responsable, fecha y fuente', () => {
    const s = resolveTrustState({
      origin: 'member',
      verification: 'verified',
      verified_at: '2026-10-05T09:15:00+00:00',
      verified_by: 'adm_1',
      verified_by_name: 'Ana',
      verification_source: 'manual_review',
    });
    expect(s.key).toBe('verified');
    expect(s.label).toBe('Verificada');
    expect(s.title).toMatch(/Verificada por Punto Cero/);
    expect(s.title).toContain('2026-10-05');
    expect(s.title).toMatch(/revisión manual/i);
  });

  it('una empresa verificada SIN registro no se presenta como verificada', () => {
    // Documento marcado como verificado antes de que existiera la trazabilidad.
    // No se inventa responsable ni fecha: el badge baja la afirmación a
    // "pendiente de información adicional".
    const s = resolveTrustState({ origin: 'member', verification: 'verified' });
    expect(s.key).toBe('verified-pending');
    expect(s.label).toBe('Verificación pendiente');
    expect(s.title).toMatch(/pendiente de información adicional/i);
  });

  it('sin fecha registrada no se fabrica ninguna', () => {
    const s = resolveTrustState({ verification: 'verified', verified_at: null });
    expect(s.title).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('el estado legado se renderiza como pendiente, no como escudo verde', () => {
    render(<CompanyTrustBadge company={{ origin: 'member', verification: 'verified' }} />);
    expect(screen.getByTestId('company-trust-verified-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('company-trust-verified')).not.toBeInTheDocument();
    expect(screen.getByText('Verificación pendiente')).toBeInTheDocument();
  });

  it('una verificación legada sigue distinguiéndose de un pendiente de registro', () => {
    // Misma familia visual (ámbar/reló), distinta etiqueta y testid: no se
    // confunde con `verification: 'pending'`, que dice "Registrada".
    expect(resolveTrustState({ origin: 'member', verification: 'pending' }).label)
      .toBe('Registrada');
    expect(resolveTrustState({ origin: 'member', verification: 'verified' }).label)
      .toBe('Verificación pendiente');
  });
});
