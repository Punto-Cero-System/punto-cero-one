import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-router hooks used by the modal
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

// Mock canvas-confetti and access mock via require()
jest.mock('canvas-confetti', () => ({ __esModule: true, default: jest.fn() }));
const confettiMock = require('canvas-confetti').default;

// Mock useCommunityAuth to provide a user
jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: { id: 'user_welcome' } }),
}));

// Import the modal directly (not lazy) for testing
import WelcomeModal from '../community/WelcomeModal';
import { WELCOME_STORAGE_KEY } from '../community/welcomeArm';

describe('WelcomeModal confetti gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('confetti runs only when localStorage pending matches user id', async () => {
    // Arm welcome by setting localStorage
    localStorage.setItem(WELCOME_STORAGE_KEY, 'user_welcome');
    render(<WelcomeModal />);

    await waitFor(() => expect(screen.getByTestId('welcome-modal')), { timeout: 2500 });
    // confetti called via runConfetti loop; assert it was invoked at least once
    await waitFor(() => expect(confettiMock).toHaveBeenCalled(), { timeout: 2500 });
  });

  test('no confetti when no pending key', async () => {
    render(<WelcomeModal />);
    // Modal should not render
    expect(screen.queryByTestId('welcome-modal')).toBeNull();
    expect(confettiMock).not.toHaveBeenCalled();
  });
});
