import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
  Navigate: () => null,
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('../../components/CategoryPage', () => ({
  __esModule: true,
  default: ({ children }) => <main>{children}</main>,
  NAVY: '#0B1F3A',
}));

jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../contexts/RealtimeContext', () => ({
  useRealtime: () => ({ subscribe: () => () => {} }),
}));

jest.mock('../../services/coreServices', () => ({
  notificationService: {
    list: jest.fn(),
    markRead: jest.fn(),
    remove: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

import { notificationService } from '../../services/coreServices';
import NotificationsBell from '../../components/community/NotificationsBell';
import NotificationsPage from '../NotificationsPage';

describe('NotificationsPage return experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('highlights unread updates when the user returns', async () => {
    notificationService.list.mockResolvedValue({
      items: [{
        id: 'notif-1',
        title: 'Ana comentó tu publicación',
        actor_name: 'Ana',
        is_read: false,
        created_at: new Date().toISOString(),
      }],
      unread: 3,
      next_cursor: null,
    });

    render(<NotificationsPage />);

    expect(await screen.findByTestId('notifications-return-summary'))
      .toHaveTextContent('Tenemos novedades para ti');
    expect(screen.getByTestId('notifications-return-summary'))
      .toHaveTextContent('Tienes 3 novedades sin leer.');
  });

  it('invites the user to follow professionals and companies when empty', async () => {
    notificationService.list.mockResolvedValue({
      items: [],
      unread: 0,
      next_cursor: null,
    });

    render(<NotificationsPage />);

    expect(await screen.findByTestId('notifications-empty-page'))
      .toHaveTextContent('No tienes novedades todavía.');
    expect(screen.getByTestId('notifications-empty-page'))
      .toHaveTextContent('Sigue profesionales y empresas para recibir actualizaciones.');
    expect(screen.getByTestId('notifications-empty-explore')).toHaveAttribute('href', '/comunidad');
    expect(screen.getByTestId('notifications-empty-discover')).toHaveAttribute('href', '/empresas');
  });

  it('refreshes and signals pending activity when the community window regains focus', async () => {
    notificationService.list.mockResolvedValue({
      items: [],
      unread: 2,
      next_cursor: null,
    });

    render(<NotificationsBell />);

    await screen.findByTestId('notifications-unread-count');
    expect(notificationService.list).toHaveBeenCalledTimes(1);

    fireEvent.focus(window);

    await waitFor(() => expect(notificationService.list).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByTestId('notifications-bell'));
    expect(await screen.findByTestId('notifications-pending-summary'))
      .toHaveTextContent('Tienes 2 novedades sin leer.');
  });
});
