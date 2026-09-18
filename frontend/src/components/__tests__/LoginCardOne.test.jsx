import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router hooks (same pattern as other tests in this folder)
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

// Mock the existing AuthContext (Identity Core JWT — NOT modified, only consumed)
const mockLogin = jest.fn();
let mockAuthValue = { user: false, login: mockLogin };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

import LoginCardOne, { LoginCardOneView } from '../LoginCardOne';

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthValue = { user: false, login: mockLogin };
});

describe('LoginCardOne (connected)', () => {
  it('renders the One visual: brand, tabs and social providers', () => {
    render(<LoginCardOne />);
    expect(screen.getByTestId('login-card-one')).toBeInTheDocument();
    expect(screen.getByTestId('login-card-one-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('login-card-one-google')).toBeInTheDocument();
    expect(screen.getByTestId('login-card-one-linkedin')).toBeInTheDocument();
    expect(screen.getByTestId('login-card-one-facebook')).toBeInTheDocument();
  });

  it('submits credentials through AuthContext.login and navigates to the resolved One space', async () => {
    mockLogin.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'Ana', role: 'member',
      systemContext: { workspaces: { recommended: 'comunidad' } },
    });
    render(<LoginCardOne />);

    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: '  ANA@B.COM ' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('ana@b.com', 'secret123');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows the AuthContext error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    render(<LoginCardOne />);

    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('login-card-one-error')).toHaveTextContent('Credenciales inválidas');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('respects a custom redirectTo', async () => {
    mockLogin.mockResolvedValue({ id: 'u1' });
    render(<LoginCardOne redirectTo="/workspace" />);
    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/workspace', { replace: true }));
  });

  it('shows the active-session state and enters One without re-asking credentials', () => {
    mockAuthValue = {
      user: { id: 'u1', email: 'a@b.com', name: 'Ana' },
      systemContext: { workspaces: { recommended: 'legal' } },
      login: mockLogin,
    };
    render(<LoginCardOne />);
    expect(screen.getByTestId('login-card-one-session')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('login-card-one-enter'));
    expect(mockNavigate).toHaveBeenCalledWith('/workspace/legal');
    expect(mockLogin).not.toHaveBeenCalled();
  });
});

describe('LoginCardOneView (pure export for the Core)', () => {
  it('works fully prop-driven without AuthContext', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 'u9' });
    render(<LoginCardOneView onSubmitCredentials={onSubmit} />);
    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), { target: { value: 'core@system.com' } });
    fireEvent.change(screen.getByTestId('login-card-one-password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('core@system.com', 'pw'));
  });
});
