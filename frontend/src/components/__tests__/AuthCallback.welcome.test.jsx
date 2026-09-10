import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
// Do not import MemoryRouter; we mock router hooks directly below

// Mocks
jest.mock('../../services/authService', () => ({
  authService: {
    exchangeSession: jest.fn(),
  },
}));

const mockExchangeSession = require('../../services/authService').authService.exchangeSession;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ hash: '#session_id=abc123' }),
}), { virtual: true });

// Mock the CommunityAuthContext hook used by AuthCallback
const mockRefresh = jest.fn();
const mockSetUserFromCallback = jest.fn();
jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ refresh: mockRefresh, setUserFromCallback: mockSetUserFromCallback }),
}));

// Mock the welcome arming helper (access mock via require after mocking)
jest.mock('../community/welcomeArm', () => ({ armWelcome: jest.fn(), WELCOME_STORAGE_KEY: 'pcone_welcome_pending' }));
const { armWelcome } = require('../community/welcomeArm');

describe('AuthCallback → welcome/confetti gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('NEW USER — success triggers armWelcome, /me refresh and navigation', async () => {
    const now = new Date().toISOString();
    mockExchangeSession.mockResolvedValueOnce({ id: 'user_abc', created_at: now });
    mockRefresh.mockResolvedValueOnce({ id: 'user_abc' });

    const { default: AuthCallback } = await import('../AuthCallback');

    render(<AuthCallback />);

    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockSetUserFromCallback).toHaveBeenCalledWith({ id: 'user_abc' });
    expect(armWelcome).toHaveBeenCalledWith('user_abc');
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true, state: { justJoined: true } });
  });

  test('RETURNING USER — does not arm welcome', async () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    mockExchangeSession.mockResolvedValueOnce({ id: 'user_old', created_at: old });
    mockRefresh.mockResolvedValueOnce({ id: 'user_old' });

    const { default: AuthCallback } = await import('../AuthCallback');
    render(<AuthCallback />);

    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(armWelcome).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true, state: { justJoined: true } });
  });

  test('/me FAILURE — exchange ok but refresh fails -> shows error', async () => {
    mockExchangeSession.mockResolvedValueOnce({ id: 'user_x', created_at: new Date().toISOString() });
    mockRefresh.mockResolvedValueOnce(null);

    const { default: AuthCallback } = await import('../AuthCallback');
    render(<AuthCallback />);

    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('auth-callback-error')));
    expect(armWelcome).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/', expect.anything());
  });

  test('PROVIDER CANCELLATION / OAuth error -> shows recoverable error', async () => {
    mockExchangeSession.mockRejectedValueOnce(new Error('oauth_cancel'));

    const { default: AuthCallback } = await import('../AuthCallback');
    render(<AuthCallback />);

    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('auth-callback-error')));
    expect(armWelcome).not.toHaveBeenCalled();
  });

  test('SESSION FAILURE — invalid exchange -> no celebration', async () => {
    mockExchangeSession.mockResolvedValueOnce({});
    mockRefresh.mockResolvedValueOnce(null);

    const { default: AuthCallback } = await import('../AuthCallback');
    render(<AuthCallback />);

    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('auth-callback-error')));
    expect(armWelcome).not.toHaveBeenCalled();
  });

  test('FIRST LOGIN ONLY ONCE — first recent then second older', async () => {
    // First run: recent
    mockExchangeSession.mockResolvedValueOnce({ id: 'u_once', created_at: new Date().toISOString() });
    mockRefresh.mockResolvedValueOnce({ id: 'u_once' });
    const { default: AuthCallback } = await import('../AuthCallback');
    const renderResult = render(<AuthCallback />);
    await waitFor(() => expect(armWelcome).toHaveBeenCalledWith('u_once'));

    // Simulate second auth with older created_at — should not arm
    jest.clearAllMocks();
    mockExchangeSession.mockResolvedValueOnce({ id: 'u_once', created_at: new Date(Date.now() - 86400000).toISOString() });
    mockRefresh.mockResolvedValueOnce({ id: 'u_once' });
    // unmount and mount again to simulate a fresh callback lifecycle
    const { unmount } = renderResult;
    unmount();
    render(<AuthCallback />);
    await waitFor(() => expect(mockExchangeSession).toHaveBeenCalled());
    expect(armWelcome).not.toHaveBeenCalled();
  });
});
