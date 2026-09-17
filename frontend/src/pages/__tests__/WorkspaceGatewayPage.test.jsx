import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock router hooks/links (same pattern as components/__tests__)
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

const mockLogout = jest.fn();
let mockAuthValue = { user: false, token: null, logout: mockLogout };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

let mockCommunityValue = { user: null };
jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => mockCommunityValue,
}), { virtual: true });

import WorkspaceGatewayPage, { getRecommendedSpace, readLastSpace, writeLastSpace, clearLastSpace, formatRelativeTime, orderSpacesForDisplay, GATEWAY_LAST_SPACE_KEY } from '../WorkspaceGatewayPage';

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthValue = { user: false, token: null, logout: mockLogout };
  mockCommunityValue = { user: null };
  window.localStorage.clear();
});

describe('WorkspaceGatewayPage (/workspace)', () => {
  it('renders the initial "Bienvenido a Punto Cero System" structure', () => {
    render(<WorkspaceGatewayPage />);
    expect(screen.getByTestId('workspace-gateway-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bienvenido a Punto Cero System');
  });

  it('renders the Punto Cero System Gateway hero with One, Legal and Medical', () => {
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-gateway-hero')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-gateway-title')).toHaveTextContent('Punto Cero System Gateway');
    expect(screen.getByTestId('workspace-gateway-destination-one')).toHaveTextContent('Punto Cero One');
    expect(screen.getByTestId('workspace-gateway-destination-legal')).toHaveTextContent('Punto Cero Legal');
    expect(screen.getByTestId('workspace-gateway-destination-medical')).toHaveTextContent('Punto Cero Medical');
  });

  it('recommends Legal from community verticals without changing navigation', () => {
    expect(getRecommendedSpace({ communityUser: { verticals: ['legal'] } })).toEqual(
      expect.objectContaining({ spaceKey: 'legal' }),
    );
    mockAuthValue = { user: { name: 'Ana', role: 'admin' }, token: 'jwt', logout: mockLogout };
    mockCommunityValue = { user: { name: 'Ana', verticals: ['legal'] } };
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-recommendation')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-recommendation-space')).toHaveTextContent('Legal');
    expect(screen.getByTestId('workspace-recommendation-reason')).toHaveTextContent('verticales');
    expect(screen.getByTestId('workspace-space-legal-recommended')).toHaveTextContent('RECOMENDADO');
    expect(screen.getByTestId('workspace-space-legal').getAttribute('href')).toBe('/workspace/legal');
  });

  it('recommends Medical from the professional headline and hides the block without signals', () => {
    expect(getRecommendedSpace({ communityUser: { headline: 'Médica clínica y salud' } })).toEqual(
      expect.objectContaining({ spaceKey: 'medical' }),
    );

    mockAuthValue = { user: false, token: null, logout: mockLogout };
    mockCommunityValue = { user: null };
    const { unmount } = render(<WorkspaceGatewayPage />);
    expect(screen.queryByTestId('workspace-recommendation')).not.toBeInTheDocument();
    unmount();

    mockAuthValue = { user: { name: 'Luis', role: 'member' }, token: 'jwt', logout: mockLogout };
    mockCommunityValue = { user: { name: 'Luis', headline: 'Médico clínico' } };
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-recommendation-space')).toHaveTextContent('Medical');
    expect(screen.getByTestId('workspace-space-medical-recommended')).toBeInTheDocument();
    expect(hrefs()).not.toContain('/workspace/medical');
  });

  it('remembers the last selected space locally and can forget it', () => {
    expect(readLastSpace()).toBeNull();
    expect(writeLastSpace('legal')).toEqual(expect.objectContaining({ space: 'legal' }));
    expect(JSON.parse(window.localStorage.getItem(GATEWAY_LAST_SPACE_KEY)).space).toBe('legal');
    expect(writeLastSpace('no-existe')).toBeNull();

    render(<WorkspaceGatewayPage />);
    expect(screen.getByTestId('workspace-last-space')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-last-space-name')).toHaveTextContent('Legal');
    expect(screen.getByTestId('workspace-last-space-link').getAttribute('href')).toBe('/workspace/legal');

    fireEvent.click(screen.getByTestId('workspace-last-space-clear'));
    expect(screen.queryByTestId('workspace-last-space')).not.toBeInTheDocument();
    expect(clearLastSpace()).toBe(true);
  });

  it('ignores corrupt local memory without breaking the Gateway', () => {
    window.localStorage.setItem(GATEWAY_LAST_SPACE_KEY, 'no-json{{{');
    render(<WorkspaceGatewayPage />);
    expect(screen.queryByTestId('workspace-last-space')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-spaces')).toBeInTheDocument();
  });

  it('formats relative time defensively without throwing', () => {
    const now = Date.parse('2026-09-17T12:00:00.000Z');
    expect(formatRelativeTime(new Date(now - 30 * 1000).toISOString(), now)).toBe('hace un momento');
    expect(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString(), now)).toBe('hace 5 minutos');
    expect(formatRelativeTime(new Date(now - 3 * 60 * 60 * 1000).toISOString(), now)).toBe('hace 3 horas');
    expect(formatRelativeTime(new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe('hace 2 días');
    expect(formatRelativeTime('2020-01-05T10:00:00.000Z', now)).toMatch(/05\/01\/2020/);
    expect(formatRelativeTime(null, now)).toBe('fecha no disponible');
    expect(formatRelativeTime('no-fecha', now)).toBe('fecha no disponible');
    expect(formatRelativeTime(new Date(now + 60 * 1000).toISOString(), now)).toBe('fecha no disponible');
  });

  it('shows work continuity with continue and explore actions', () => {
    writeLastSpace('legal');
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-continuity')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-continuity-title')).toHaveTextContent('Continuidad de trabajo');
    expect(screen.getByTestId('workspace-continuity-space')).toHaveTextContent('Legal');
    expect(screen.getByTestId('workspace-continuity-visited')).toHaveTextContent('Visitado:');
    expect(screen.getByTestId('workspace-continuity-cta').getAttribute('href')).toBe('/workspace/legal');
    expect(screen.getByTestId('workspace-continuity-cta')).toHaveTextContent('Continuar en Legal');
    expect(screen.getByTestId('workspace-continuity-explore').getAttribute('href')).toBe('#workspace-spaces');
    expect(hrefs()).toContain('/workspace/legal');
  });

  it('hides continuity when there is no valid last space', () => {
    render(<WorkspaceGatewayPage />);
    expect(screen.queryByTestId('workspace-continuity')).not.toBeInTheDocument();
  });

  it('orders the recommended space first without mutating the catalog', () => {
    const catalog = [
      { key: 'legal' },
      { key: 'medical' },
      { key: 'empresa' },
      { key: 'comunidad' },
    ];
    expect(orderSpacesForDisplay(catalog, 'empresa').map((s) => s.key)).toEqual([
      'empresa',
      'legal',
      'medical',
      'comunidad',
    ]);
    expect(catalog.map((s) => s.key)).toEqual(['legal', 'medical', 'empresa', 'comunidad']);
    expect(orderSpacesForDisplay(catalog, null).map((s) => s.key)).toEqual([
      'legal',
      'medical',
      'empresa',
      'comunidad',
    ]);
    expect(orderSpacesForDisplay(catalog, 'no-existe').map((s) => s.key)).toEqual([
      'legal',
      'medical',
      'empresa',
      'comunidad',
    ]);
  });

  it('renders the recommended card first with highlight and microcopy', () => {
    mockAuthValue = { user: { name: 'Luis', role: 'member' }, token: 'jwt', logout: mockLogout };
    mockCommunityValue = { user: { name: 'Luis', headline: 'Médico clínico' } };
    render(<WorkspaceGatewayPage />);

    const cardIds = screen
      .getAllByTestId(/^workspace-space-[a-z]+$/)
      .map((el) => el.getAttribute('data-testid'));
    expect(cardIds).toEqual([
      'workspace-space-medical',
      'workspace-space-legal',
      'workspace-space-empresa',
      'workspace-space-comunidad',
    ]);
    expect(screen.getByTestId('workspace-space-medical-recommended')).toHaveTextContent('RECOMENDADO');
    expect(screen.getByTestId('workspace-space-medical-recommended-reason')).toHaveTextContent('Sugerido según tu perfil');
    expect(screen.getByTestId('workspace-space-medical').getAttribute('aria-disabled')).toBe('true');
  });

  it('saves local memory when a real space card is clicked', () => {
    render(<WorkspaceGatewayPage />);
    expect(readLastSpace()).toBeNull();
    fireEvent.click(screen.getByTestId('workspace-space-legal'));
    expect(JSON.parse(window.localStorage.getItem(GATEWAY_LAST_SPACE_KEY)).space).toBe('legal');
    expect(screen.getByTestId('workspace-last-space')).toBeInTheDocument();
  });

  it('routes unauthenticated visitors to /login', () => {
    render(<WorkspaceGatewayPage />);
    expect(screen.getByText(/No se detectó sesión activa/)).toBeInTheDocument();
    expect(hrefs()).toContain('/login');
    expect(screen.queryByTestId('workspace-gateway-logout')).not.toBeInTheDocument();
  });

  it('shows the active identity block with JWT source and community state', () => {
    mockAuthValue = { user: { name: 'Ana', email: 'ana@example.com', role: 'admin' }, token: 'jwt', logout: mockLogout };
    mockCommunityValue = { user: null };
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-identity')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-identity-title')).toHaveTextContent('Identidad activa');
    expect(screen.getByTestId('workspace-identity-user')).toHaveTextContent('Ana');
    expect(screen.getByTestId('workspace-identity-source')).toHaveTextContent('JWT');
    expect(screen.getByTestId('workspace-identity-status')).toHaveTextContent('Autenticado');
    expect(screen.getByTestId('workspace-identity-community')).toHaveTextContent('Comunidad no vinculada');
  });

  it('shows Comunidad conectada when the community session exists', () => {
    mockAuthValue = { user: { name: 'Ana', role: 'admin' }, token: 'jwt', logout: mockLogout };
    mockCommunityValue = { user: { name: 'Ana Comunidad' } };
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-identity-community')).toHaveTextContent('Comunidad conectada');
  });

  it('shows Estado/Acceso info on every space card without changing navigation', () => {
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-space-legal-access')).toHaveTextContent('Disponible');
    expect(screen.getByTestId('workspace-space-legal-access')).toHaveTextContent('Preparado');
    expect(screen.getByTestId('workspace-space-comunidad-access')).toHaveTextContent('Disponible');
    expect(screen.getByTestId('workspace-space-medical-access')).toHaveTextContent('Próximamente');
    expect(screen.getByTestId('workspace-space-empresa-access')).toHaveTextContent('Próximamente');
    expect(screen.getByTestId('workspace-space-legal').getAttribute('href')).toBe('/workspace/legal');
    expect(screen.getByTestId('workspace-space-comunidad').getAttribute('href')).toBe('/join');
  });

  it('shows the authenticated session and allows logout', () => {
    mockAuthValue = { user: { name: 'Ana', role: 'admin' }, token: 'jwt', logout: mockLogout };
    render(<WorkspaceGatewayPage />);

    expect(screen.getByText(/Autenticado como/)).toBeInTheDocument();
    expect(screen.getAllByText('Ana').length).toBeGreaterThanOrEqual(1);
    expect(hrefs()).not.toContain('/login');

    fireEvent.click(screen.getByTestId('workspace-gateway-logout'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders "Mis espacios" with the four ecosystem spaces', () => {
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-spaces')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Mis espacios');
    ['legal', 'medical', 'empresa', 'comunidad'].forEach((key) => {
      expect(screen.getByTestId(`workspace-space-${key}`)).toBeInTheDocument();
    });
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    expect(screen.getByText('Comunidad One')).toBeInTheDocument();
  });

  it('navigates to /workspace/legal and /join for the enabled spaces', () => {
    render(<WorkspaceGatewayPage />);

    expect(screen.getByTestId('workspace-space-legal').getAttribute('href')).toBe('/workspace/legal');
    expect(screen.getByTestId('workspace-space-comunidad').getAttribute('href')).toBe('/join');
  });

  it('keeps Medical and Empresa non-navigable with a PRÓXIMAMENTE badge', () => {
    render(<WorkspaceGatewayPage />);

    ['medical', 'empresa'].forEach((key) => {
      const card = screen.getByTestId(`workspace-space-${key}`);
      expect(card.tagName).not.toBe('A');
      expect(card.getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByTestId(`workspace-space-${key}-badge`)).toHaveTextContent('PRÓXIMAMENTE');
    });
    expect(hrefs()).not.toContain('/workspace/medical');
    expect(hrefs()).not.toContain('/workspace/empresa');
  });
});
