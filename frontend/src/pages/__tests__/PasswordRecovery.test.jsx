/**
 * Recuperación de contraseña — Flujo completo.
 *
 * Cubre las tres superficies del flujo:
 *   1. /login          → el enlace que inicia la recuperación (LoginCardOne)
 *   2. /join           → el formulario que pide el email (modo 'forgot')
 *   3. /reset-password → la pantalla que consume el token del enlace
 *
 * No toca backend: se verifica el contrato que el cliente envía
 * (`authService.forgotPassword` / `authService.resetPassword`), que es el
 * contrato real de `/api/community/auth/password/{forgot,reset}`.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Router: JoinPage y ResetPasswordPage leen el query string.
const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}), { virtual: true });

// AuthContext de System (JWT) — consumido, nunca modificado.
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: false, login: jest.fn() }),
}));

// Sesión de comunidad: el reset la reestablece en el servidor, el cliente
// solo la refresca.
const mockRefresh = jest.fn(() => Promise.resolve({ id: 'u1' }));
jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: null, refresh: mockRefresh }),
}));

// Servicio de auth: estos son exactamente los llamadas del flujo de recuperación.
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();
const mockListProviders = jest.fn();
jest.mock('../../services/authService', () => ({
  AUTH_PROVIDERS: {
    google: { key: 'google', label: 'Google', available: true, startLogin: jest.fn() },
    linkedin: { key: 'linkedin', label: 'LinkedIn', available: false, startLogin: jest.fn() },
    facebook: { key: 'facebook', label: 'Facebook', available: false, startLogin: jest.fn() },
  },
  authService: {
    listProviders: (...a) => mockListProviders(...a),
    forgotPassword: (...a) => mockForgotPassword(...a),
    resetPassword: (...a) => mockResetPassword(...a),
  },
}));

// El post-registro encola el WelcomeModal; irrelevante para este flujo.
jest.mock('../../components/community/welcomeArm', () => ({ armWelcome: jest.fn() }));

// Identity Core / Access Bridge: fuera del alcance de esta fase.
jest.mock('../../system/systemEntryRules', () => ({ resolveEntryPath: () => '/' }));
jest.mock('../../system/accessBridgeClient', () => ({ fetchEntitlements: () => Promise.resolve({ entitlements: [] }) }));
jest.mock('../../system/accessBridgeEntry', () => ({
  resolveAccessShell: jest.fn(), resolvePostLoginEntry: jest.fn(() => null),
}));
jest.mock('../../system/sessionManager', () => ({
  getSessionState: jest.fn(), hydrateSession: jest.fn(), launchVertical: jest.fn(),
}));
jest.mock('../../system/workspaceOrchestrator', () => ({ resolveWorkspaceDestination: jest.fn() }));
jest.mock('../../system/workspaceActivation', () => ({ activateWorkspace: jest.fn() }));

import LoginPage from '../LoginPage';
import JoinPage from '../JoinPage';
import ResetPasswordPage from '../ResetPasswordPage';

// El backend SIEMPRE responde 200 con este texto, exista el email o no.
const GENERIC = 'Si el email existe, enviamos un enlace de recuperación.';

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockRefresh.mockResolvedValue({ id: 'u1' });
  mockListProviders.mockResolvedValue({ enabled: [{ key: 'google' }], coming_soon: [] });
  mockForgotPassword.mockResolvedValue({ ok: true, message: GENERIC });
  mockResetPassword.mockResolvedValue({ id: 'u1', email: 'ana@b.com', name: 'Ana' });
});

describe('Recuperación · punto de entrada en /login', () => {
  it('muestra "¿Olvidaste tu contraseña?" y lo lleva al formulario de /join', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByTestId('login-card-one-tab-email'));

    // El formulario entra con AnimatePresence: hay que esperarlo. El timeout
    // se amplía porque la suite completa corre 28 archivos en paralelo y el
    // primer render del árbol puede tardar bajo carga.
    const forgot = await screen.findByTestId('login-card-one-forgot', undefined, { timeout: 8000 });
    expect(forgot).toHaveTextContent('¿Olvidaste tu contraseña?');

    fireEvent.click(forgot);
    expect(mockNavigate).toHaveBeenCalledWith('/join?modo=forgot');
  });

describe('Recuperación · solicitud en /join', () => {
  const openForgotViaLink = async () => {
    render(<JoinPage />);
    fireEvent.click(screen.getByTestId('join-tab-email'));
    fireEvent.click(await screen.findByTestId('join-goto-forgot'));
  };

  it('el enlace de la pestaña Correo abre el modo recuperación', async () => {
    await openForgotViaLink();
    expect(screen.getByTestId('join-email-submit')).toHaveTextContent('Enviar enlace');
    // En recuperación no se pide contraseña ni nombre.
    expect(screen.queryByTestId('join-input-password')).not.toBeInTheDocument();
    expect(screen.queryByTestId('join-input-name')).not.toBeInTheDocument();
  });

  it('el deep-link ?modo=forgot abre directo el formulario de recuperación', async () => {
    mockSearchParams = new URLSearchParams('modo=forgot');
    render(<JoinPage />);

    expect(await screen.findByTestId('join-email-submit')).toHaveTextContent('Enviar enlace');
    expect(screen.getByTestId('join-goto-login')).toBeInTheDocument();
  });

  it('envía el email y muestra el mensaje genérico', async () => {
    await openForgotViaLink();
    fireEvent.change(screen.getByTestId('join-input-email'), { target: { value: '  ANA@B.COM ' } });
    fireEvent.click(screen.getByTestId('join-email-submit'));

    await waitFor(() => {
      // El cliente normaliza con trim() antes de enviar.
      expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'ANA@B.COM' });
    });
    // Genérico: no revela si la cuenta existe.
    expect(await screen.findByTestId('join-notice')).toHaveTextContent(GENERIC);
  });

  it('vuelve al modo login tras solicitar la recuperación', async () => {
    await openForgotViaLink();
    fireEvent.change(screen.getByTestId('join-input-email'), { target: { value: 'ana@b.com' } });
    fireEvent.click(screen.getByTestId('join-email-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('join-email-submit')).toHaveTextContent('Iniciar sesión');
    });
  });

  it('muestra el error si la solicitud falla', async () => {
    mockForgotPassword.mockRejectedValue(new Error('No se pudo completar la operación'));
    await openForgotViaLink();
    fireEvent.change(screen.getByTestId('join-input-email'), { target: { value: 'ana@b.com' } });
    fireEvent.click(screen.getByTestId('join-email-submit'));

    expect(await screen.findByTestId('join-error'))
      .toHaveTextContent('No se pudo completar la operación');
  });
});

describe('Recuperación · cambio de contraseña en /reset-password', () => {
  it('bloquea el envío si el enlace no trae token', async () => {
    mockSearchParams = new URLSearchParams();
    render(<ResetPasswordPage />);

    expect(await screen.findByTestId('reset-error'))
      .toHaveTextContent(/Enlace de recuperación inválido/i);
    expect(screen.getByTestId('reset-submit')).toBeDisabled();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('exige mínimo 8 caracteres y confirmación coincidente', async () => {
    mockSearchParams = new URLSearchParams('token=abc12345');
    render(<ResetPasswordPage />);

    const pwd = await screen.findByTestId('reset-input-password');
    fireEvent.change(pwd, { target: { value: 'corta' } });
    fireEvent.change(screen.getByTestId('reset-input-confirm'), { target: { value: 'corta' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    expect(await screen.findByTestId('reset-error'))
      .toHaveTextContent(/al menos 8 caracteres/i);
    expect(mockResetPassword).not.toHaveBeenCalled();

    fireEvent.change(pwd, { target: { value: 'nuevaclave1' } });
    fireEvent.change(screen.getByTestId('reset-input-confirm'), { target: { value: 'otraclave99' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    expect(await screen.findByTestId('reset-error')).toHaveTextContent(/no coinciden/i);
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('cambia la contraseña con el token, confirma y refresca la sesión', async () => {
    mockSearchParams = new URLSearchParams('token=abc12345');
    render(<ResetPasswordPage />);

    fireEvent.change(await screen.findByTestId('reset-input-password'), {
      target: { value: 'nuevaclave1' },
    });
    fireEvent.change(screen.getByTestId('reset-input-confirm'), {
      target: { value: 'nuevaclave1' },
    });
    fireEvent.click(screen.getByTestId('reset-submit'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        token: 'abc12345', password: 'nuevaclave1',
      });
    });
    // El backend ya estableció sesión con el reset: el cliente la refresca.
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(await screen.findByTestId('reset-success'))
      .toHaveTextContent(/Contraseña actualizada/i);
  });

  it('muestra el error cuando el enlace expiró o ya se usó', async () => {
    mockResetPassword.mockRejectedValue(new Error('El enlace expiró. Solicita uno nuevo.'));
    mockSearchParams = new URLSearchParams('token=abc12345');
    render(<ResetPasswordPage />);

    fireEvent.change(await screen.findByTestId('reset-input-password'), {
      target: { value: 'nuevaclave1' },
    });
    fireEvent.change(screen.getByTestId('reset-input-confirm'), {
      target: { value: 'nuevaclave1' },
    });
    fireEvent.click(screen.getByTestId('reset-submit'));

    expect(await screen.findByTestId('reset-error'))
      .toHaveTextContent(/El enlace expiró/i);
    expect(screen.queryByTestId('reset-success')).not.toBeInTheDocument();
  });
});

});
