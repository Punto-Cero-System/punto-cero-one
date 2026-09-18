import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock router hooks/links (same pattern as components/__tests__)
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

// Mock the shared AuthContext (Identity Core JWT) — consumed, never modified
const mockLogin = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: false, login: mockLogin }),
}));

import LoginPage from '../LoginPage';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage (/login — Login Universal)', () => {
  it('renders LoginCardOne with the System title', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('workspace-login-page')).toBeInTheDocument();
    expect(screen.getByTestId('login-card-one')).toBeInTheDocument();
    expect(screen.getByText('Acceso Punto Cero System')).toBeInTheDocument();
  });

  it('logs in through AuthContext and redirects to the Legal workspace resolved by the core', async () => {
    mockLogin.mockResolvedValue({
      id: 'u1', email: 'ana@b.com', name: 'Ana', role: 'admin',
      systemContext: { workspaces: { recommended: 'legal' } },
    });
    render(<LoginPage />);

    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: '  ANA@B.COM ' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('ana@b.com', 'secret123');
      expect(mockNavigate).toHaveBeenCalledWith('/workspace/legal', { replace: true });
    });
  });

  it('shows the error and does not navigate when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    render(<LoginPage />);

    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('login-card-one-error')).toHaveTextContent('Credenciales inválidas');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
