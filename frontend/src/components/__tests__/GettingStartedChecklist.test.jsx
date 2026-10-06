import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => ({
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}), { virtual: true });

jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: { id: 'u1', name: 'Nuevo' } }),
}));

import GettingStartedChecklist from '../community/GettingStartedChecklist';

describe('GettingStartedChecklist (Fase 2.3)', () => {
  beforeEach(() => { localStorage.clear(); });

  test('muestra bienvenida + 4 pasos y permite cerrar', () => {
    render(<GettingStartedChecklist />);
    expect(screen.getByTestId('getting-started-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('gs-step-profile')).toBeInTheDocument();
    expect(screen.getByTestId('gs-step-follow')).toBeInTheDocument();
    expect(screen.getByTestId('gs-step-companies')).toBeInTheDocument();
    expect(screen.getByTestId('gs-step-post')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gs-dismiss'));
    expect(screen.queryByTestId('getting-started-checklist')).toBeNull();
    expect(localStorage.getItem('pcone_getting_started_dismissed')).toBe('1');
  });

  test('no se muestra si ya fue cerrada', () => {
    localStorage.setItem('pcone_getting_started_dismissed', '1');
    render(<GettingStartedChecklist />);
    expect(screen.queryByTestId('getting-started-checklist')).toBeNull();
  });
});
