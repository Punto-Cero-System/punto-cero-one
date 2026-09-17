import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock router Links (same pattern as the other page tests)
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

import WorkspaceSpacePlaceholderPage from '../WorkspaceSpacePlaceholderPage';

describe('WorkspaceSpacePlaceholderPage (/workspace/:space)', () => {
  it('renders the space label and its construction status', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="legal" />);

    expect(screen.getByTestId('workspace-space-placeholder')).toHaveAttribute('data-space', 'legal');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legal');
    expect(screen.getByTestId('workspace-space-placeholder-status')).toBeInTheDocument();
  });

  it('flags coming-soon spaces', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="medical" />);

    expect(screen.getByTestId('workspace-space-placeholder-status')).toHaveTextContent('PRÓXIMAMENTE');
  });

  it('offers the way back to the Gateway', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="empresa" />);

    expect(screen.getByTestId('workspace-space-back').getAttribute('href')).toBe('/workspace');
  });

  it('falls back safely for an unknown space key', () => {
    render(<WorkspaceSpacePlaceholderPage spaceKey="desconocido" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('desconocido');
    expect(screen.getByTestId('workspace-space-back')).toBeInTheDocument();
  });
});