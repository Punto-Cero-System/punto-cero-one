import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock router Links (same pattern as the other page tests)
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

// El dashboard operativo consume el puente -> se aísla la red aquí.
// Función simple (no jest.fn): CRA corre con resetMocks y borraría la impl.
jest.mock('../../services/workspaceBridge', () => ({
  getWorkspaceSnapshot: () => Promise.resolve({
    kpis: { data: { totalCases: 3, activeCases: 2, totalRevenue: 1500000, unreadMessages: 1 }, error: null },
    clients: { data: [{ id: 'c1', name: 'Juan Restrepo', cases: 1 }], error: null },
    cases: { data: [{ id: 'k1', caseNumber: 'CAS-2026-023', status: 'active' }], error: null },
    appointments: { data: [{ id: 'a1', title: 'Audiencia', date: '30 ago 2026' }], error: null },
    documents: { data: [], error: null },
    invoices: { data: [], error: null },
    messages: { data: [], error: null },
    darwin: { data: { status: 'operational', operational: true, activities: 4, lastAction: 'professional.agenda', lastExecutedAt: '24 sept 2026' }, error: null },
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Darwin Gómez', role: 'lawyer' }, systemContext: { workspace_id: 'workspace/legal' } }),
}));

import WorkspaceSpacePlaceholderPage from '../WorkspaceSpacePlaceholderPage';

describe('WorkspaceSpacePlaceholderPage (/workspace/:space)', () => {
  it('renders the operational dashboard fed by the Core Legal bridge', async () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="legal" />);

    expect(screen.getByTestId('workspace-dashboard')).toHaveAttribute('data-space', 'legal');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legal');

    // Los datos vienen del snapshot del puente, no de props ni mocks de UI.
    await waitFor(() => expect(screen.getByTestId('workspace-section-clients')).toBeInTheDocument());
    expect(screen.getByText('Juan Restrepo')).toBeInTheDocument();
    expect(screen.getByText('CAS-2026-023')).toBeInTheDocument();
    expect(screen.getByText('Audiencia')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-section-darwin')).toHaveTextContent('OPERATIONAL');
    expect(screen.getByTestId('workspace-kpi-Casos')).toHaveTextContent('3');
    expect(screen.getByTestId('workspace-kpi-Activos')).toHaveTextContent('2');
  });

  it('flags coming-soon spaces', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="medical" />);

    expect(screen.getByTestId('workspace-space-placeholder-status')).toHaveTextContent('PRÓXIMAMENTE');
  });

  it('offers the way back to the system entry (no Gateway screen)', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="empresa" />);

    const back = screen.getByTestId('workspace-space-back');
    expect(back.getAttribute('href')).toBe('/');
    expect(back).toHaveTextContent('Volver al inicio');
  });

  it('falls back safely for an unknown space key', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="desconocido" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('desconocido');
    expect(screen.getByTestId('workspace-space-back')).toBeInTheDocument();
  });
});
