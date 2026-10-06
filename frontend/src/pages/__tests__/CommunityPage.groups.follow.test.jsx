import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * OMEGA FASE B2 — integración de Comunidad con el Social Graph.
 *
 * Comprueba que un grupo es una entidad seguible desde la página de Comunidad
 * y que la integración NO duplica nada:
 *   · seguir y unseguir pasan por `followsService` (la misma API que ya usan
 *     company/hashtag), con `entity_type="group"`;
 *   · seguir NO es ser miembro: no toca `groupsService.join/leave`;
 *   · no hay contadores: la UI no muestra ni calcula ninguno (la única fuente
 *     de verdad es la colección `follows`);
 *   · la privacidad no se reimplementa: si el servidor rechaza, la UI hace
 *     rollback y no fabrica estado ni llama a ninguna otra API.
 */

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
  // CategoryPage monta el Header de la app, que navega con useNavigate.
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/comunidad', search: '', hash: '' }),
  useParams: () => ({}),
}), { virtual: true });

// CategoryPage monta el shell de la app (Header, NotificationsBell,
// RightWidgets, Discovery…). B2 prueba el grid de grupos y su cableado al
// Social Graph, así que aquí se aísla el shell y se renderizan solo los hijos.
jest.mock('../../components/CategoryPage', () => {
  const ReactMod = require('react');
  return {
    __esModule: true,
    NAVY: '#0B1F3A',
    default: ({ children }) =>
      ReactMod.createElement('div', { 'data-testid': 'category-shell' }, children),
  };
});

jest.mock('../../contexts/CommunityAuthContext', () => ({
  useCommunityAuth: () => ({ user: { id: 'usr_ana' } }),
}));

jest.mock('../../services/feedService', () => ({
  groupsService: {
    list: jest.fn(),
    categories: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    get: jest.fn(),
    members: jest.fn(),
    posts: jest.fn(),
    create: jest.fn(),
    createPost: jest.fn(),
  },
}));

jest.mock('../../services/followsService', () => ({
  followsService: {
    bulkStatus: jest.fn(),
    follow: jest.fn(),
    unfollow: jest.fn(),
  },
}));

import CommunityPage from '../CommunityPage';
import { groupsService } from '../../services/feedService';
import { followsService } from '../../services/followsService';

const PUBLICA = 'grp_publica';
const PRIVADA = 'grp_privada';

const GROUPS = [
  {
    id: PUBLICA,
    name: 'Legal Latam',
    category: 'legal',
    description: 'Comunidad pública',
    privacy: 'public',
    members_count: 1200,
    is_member: false,
  },
  {
    id: PRIVADA,
    name: 'Fundadores',
    category: 'capital',
    description: 'Comunidad privada',
    privacy: 'private',
    members_count: 42,
    is_member: true,
  },
];

beforeEach(() => {
  groupsService.list.mockResolvedValue({ items: GROUPS });
  groupsService.categories.mockResolvedValue({ categories: [] });
  groupsService.get.mockResolvedValue(GROUPS[1]);
  groupsService.members.mockResolvedValue({ items: [] });
  groupsService.posts.mockResolvedValue({ items: [] });
  groupsService.leave.mockResolvedValue({ ok: true, left: true });
  followsService.bulkStatus.mockResolvedValue({ following: {} });
  followsService.follow.mockResolvedValue({ ok: true, my_following: true, count: 1 });
  followsService.unfollow.mockResolvedValue({ ok: true, my_following: false, count: 0 });
});

const renderPage = async () => {
  render(<CommunityPage />);
  await waitFor(() => expect(screen.getByTestId(`group-item-${PUBLICA}`)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId(`group-item-${PRIVADA}`)).toBeInTheDocument());
  // FollowButton arranca deshabilitado hasta resolver el estado en el grafo:
  // sin esta espera el clic se perdería y la prueba probaría nada.
  await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`)).not.toBeDisabled());
  await waitFor(() => expect(screen.getByTestId(`group-follow-${PRIVADA}`)).not.toBeDisabled());
};

describe('Comunidad · Social Graph de grupos (OMEGA B2)', () => {
  it('ofrece un control de seguimiento por grupo, servido por el grafo', async () => {
    await renderPage();

    expect(screen.getByTestId(`group-follow-${PUBLICA}`)).toBeInTheDocument();
    expect(screen.getByTestId(`group-follow-${PRIVADA}`)).toBeInTheDocument();

    // El estado inicial se pide al grafo (`bulkStatus(type, [id])`); la página
    // no lo inventa ni lo guarda por su cuenta.
    expect(followsService.bulkStatus).toHaveBeenCalledWith('group', [PUBLICA]);
    expect(followsService.bulkStatus).toHaveBeenCalledWith('group', [PRIVADA]);
  });

  it('refleja el estado real: si ya se sigue, el botón lo muestra', async () => {
    followsService.bulkStatus.mockResolvedValue({ following: { [PUBLICA]: true } });
    await renderPage();

    await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`))
      .toHaveTextContent('Siguiendo'));
    expect(screen.getByTestId(`group-follow-${PRIVADA}`)).toHaveTextContent('Seguir');
  });

  it('seguir usa la API de follows existente con entity_type="group"', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId(`group-follow-${PUBLICA}`));

    await waitFor(() => expect(followsService.follow).toHaveBeenCalledWith('group', PUBLICA));
    expect(followsService.follow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`))
      .toHaveTextContent('Siguiendo'));
  });

  it('dejar de seguir usa la misma API: no hay segunda representación', async () => {
    followsService.bulkStatus.mockResolvedValue({ following: { [PUBLICA]: true } });
    await renderPage();
    await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`))
      .toHaveTextContent('Siguiendo'));

    fireEvent.click(screen.getByTestId(`group-follow-${PUBLICA}`));

    await waitFor(() => expect(followsService.unfollow).toHaveBeenCalledWith('group', PUBLICA));
    expect(followsService.follow).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`))
      .toHaveTextContent('Seguir'));
  });

  it('seguir NO otorga membresía: no toca join/leave ni el badge de miembro', async () => {
    await renderPage();
    expect(screen.getByTestId(`group-join-${PUBLICA}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`group-follow-${PUBLICA}`));

    await waitFor(() => expect(followsService.follow).toHaveBeenCalled());
    expect(groupsService.join).not.toHaveBeenCalled();
    expect(groupsService.leave).not.toHaveBeenCalled();
    expect(screen.getByTestId(`group-join-${PUBLICA}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`group-joined-${PUBLICA}`)).toBeNull();
  });

  it('la membresía previa sigue intacta: un grupo privado ya unido mantiene su badge', async () => {
    await renderPage();

    expect(screen.getByTestId(`group-joined-${PRIVADA}`)).toHaveTextContent('Miembro');
    expect(screen.queryByTestId(`group-join-${PRIVADA}`)).toBeNull();
  });

  it('no reimplementa privacidad: si el servidor rechaza, hay rollback y ninguna otra llamada', async () => {
    followsService.follow.mockRejectedValue(new Error('follows 403'));
    await renderPage();

    fireEvent.click(screen.getByTestId(`group-follow-${PUBLICA}`));

    // Rollback al estado real: el botón vuelve a "Seguir".
    await waitFor(() => expect(screen.getByTestId(`group-follow-${PUBLICA}`))
      .toHaveTextContent('Seguir'));
    // Y no se intenta ninguna vía alternativa para "conseguir" el grupo.
    expect(groupsService.join).not.toHaveBeenCalled();
    expect(groupsService.leave).not.toHaveBeenCalled();
    expect(screen.queryByTestId(`group-joined-${PUBLICA}`)).toBeNull();
  });

  it('aclara en los grupos privados que seguir no da acceso', async () => {
    await renderPage();

    expect(screen.getByTestId(`group-follow-hint-${PRIVADA}`))
      .toHaveTextContent('Seguir el grupo no da acceso');
    expect(screen.queryByTestId(`group-follow-hint-${PUBLICA}`)).toBeNull();
  });

  // --- OMEGA B3 · el backend puede rechazar la salida de un grupo -----------
  it('muestra el motivo del servidor cuando no se puede salir del grupo', async () => {
    groupsService.leave.mockRejectedValue(
      new Error('El grupo necesita al menos un administrador'));
    await renderPage();

    fireEvent.click(screen.getByTestId(`group-item-${PRIVADA}`));
    fireEvent.click(await screen.findByTestId('group-detail-leave'));

    await waitFor(() => expect(screen.getByTestId('group-detail-leave-error'))
      .toHaveTextContent('El grupo necesita al menos un administrador'));
    // El rechazo no se intenta sortear por otra vía.
    expect(groupsService.join).not.toHaveBeenCalled();
    expect(followsService.follow).not.toHaveBeenCalled();
  });

  it('salir bien no deja mensaje de error', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId(`group-item-${PRIVADA}`));
    fireEvent.click(await screen.findByTestId('group-detail-leave'));

    await waitFor(() => expect(groupsService.leave).toHaveBeenCalledWith(PRIVADA));
    expect(screen.queryByTestId('group-detail-leave-error')).toBeNull();
  });
});