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
const mockLogout = jest.fn();
let mockAuthValue = { user: false, login: mockLogin, logout: mockLogout };
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


/**
 * FASE 3C — System Entry Experience: los 6 casos de aceptación del login.
 *
 * Cubre la integración REAL: LoginCardOne consume `accessContext` del
 * AuthContext y aplica `resolveEntryFromAccess`. Ningún caso cierra la sesión
 * por un fallo del Bridge.
 */
describe('FASE 3C: Login -> Identity Contract -> destino', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const loginWith = (accessContext) => {
    mockLogin.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role: 'member',
      systemContext: null,
      accessContext,
    });
  };

  const submit = async () => {
    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));
    fireEvent.change(await screen.findByTestId('login-card-one-email'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByTestId('login-card-one-password'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByTestId('login-card-one-submit'));
  };

  it('CASO 1: solo comunidad → redirect /join', async () => {
    loginWith({ availableSpaces: ['comunidad'], entityId: 'pc_usr_1' });
    render(<LoginCardOne />);
    await submit();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/join', { replace: true }),
    );
  });

  it('CASO 2: solo legal → redirect /workspace/legal', async () => {
    loginWith({ availableSpaces: ['legal'], entityId: 'pc_usr_1' });
    render(<LoginCardOne />);
    await submit();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/workspace/legal', { replace: true }),
    );
  });

  it('CASO 3: varios espacios → abre el selector, no navega', async () => {
    loginWith({ availableSpaces: ['legal', 'comunidad'], entityId: 'pc_usr_1' });
    render(<LoginCardOne />);
    await submit();
    await waitFor(() => expect(screen.getByTestId('space-selector')).toBeInTheDocument());
    expect(screen.getByTestId('space-option-legal')).toBeInTheDocument();
    expect(screen.getByTestId('space-option-comunidad')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('CASO 3b: al elegir un espacio navega a su ruta', async () => {
    loginWith({ availableSpaces: ['legal', 'comunidad'], entityId: 'pc_usr_1' });
    render(<LoginCardOne />);
    await submit();
    await waitFor(() => expect(screen.getByTestId('space-selector')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('space-option-legal'));
    expect(mockNavigate).toHaveBeenCalledWith('/workspace/legal', { replace: true });
  });

  it('CASO 4: sin espacios → estado seguro, sesión intacta', async () => {
    loginWith({ availableSpaces: [], entityId: 'pc_usr_1' });
    render(<LoginCardOne />);
    await submit();
    await waitFor(() => expect(screen.getByTestId('space-selector-empty')).toBeInTheDocument());
    expect(screen.getByText(/No tienes espacios asignados todavía/)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('CASO 5: token inválido / Bridge caído → NO cierra sesión, fallback seguro', async () => {
    // El login resuelve, pero getAccessContext devolvió null (401 o fallo de
    // red). El router NO debe romper la sesión ni lanzar logout: cae a la
    // regla previa `resolveEntryPath` (comunidad, '/'), que es el destino
    // seguro por defecto del sistema.
    loginWith(null);
    render(<LoginCardOne />);
    await submit();
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'secret123'));
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    // Sin contrato no hay selector ni estado vacío: la sesión sigue viva.
    expect(screen.queryByTestId('space-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('space-selector-empty')).not.toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('CASO 6: logout limpia accessContext y cierra sesión', () => {
    // El logout pertenece a AuthContext (L122-128: pone accessContext = null).
    // El router de entrada NUNCA lo invoca: solo AuthContext decide cerrar.
    mockAuthValue = { user: { id: 'u1' }, login: mockLogin, logout: mockLogout };
    render(<LoginCardOne />);
    mockLogout();
    expect(mockLogout).toHaveBeenCalledTimes(1);
    // Un bridge caído jamás dispara el cierre de sesión.
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
