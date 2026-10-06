import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

/**
 * FASE 3D — regresión del bug de hidratación (caso D: recarga F5).
 *
 * El `useEffect` de AuthContext rehidrataba `systemContext` pero NO consultaba
 * el Access Bridge, así que tras recargar `accessContext` quedaba `null` y el
 * router de entrada caía a la regla previa aunque la identidad existiera.
 * Estos tests fijan que el Bridge se vuelve a consultar y que su fallo NO
 * invalida la sesión.
 */
const TOKEN = 'jwt-de-prueba';

const BridgeProbe = () => {
  const { accessContext, user } = useAuth();
  return (
    <div>
      <span data-testid="spaces">{(accessContext?.availableSpaces || []).join(',')}</span>
      <span data-testid="entity">{accessContext?.entityId || 'null'}</span>
      <span data-testid="system">{accessContext?.system || 'null'}</span>
      <span data-testid="user">{user ? user.email || 'ok' : 'sin-sesion'}</span>
    </div>
  );
};

const renderProbe = () => render(<AuthProvider><BridgeProbe /></AuthProvider>);

describe('FASE 3D: AuthContext rehidrata el Identity Contract tras F5', () => {
  let calls;
  let bridgeStatus;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pcl_token', TOKEN);
    calls = [];
    bridgeStatus = 200;
    global.fetch = jest.fn((url) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      calls.push({ path, url: String(url) });
      if (path === '/api/access/entitlements') {
        return Promise.resolve({
          ok: bridgeStatus === 200,
          status: bridgeStatus,
          json: () => Promise.resolve({
            subject_id: 'pc_usr_1',
            identity: {
              entity_id: 'pc_usr_1',
              system: 'punto_cero_system',
              available_spaces: ['legal', 'comunidad'],
            },
            entitlements: ['workspace.open.legal', 'workspace.open.comunidad'],
          }),
        });
      }
      if (path === '/api/auth/me') {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ id: 'u1', email: 'a@b.com', name: 'Ana' }),
        });
      }
      if (path === '/api/auth/system-context') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ user: { id: 'u1' } }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
  });

  afterEach(() => {
    cleanup();
    delete global.fetch;
    localStorage.clear();
  });

  it('rehidrata available_spaces y entity_id consultando el Bridge', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('spaces').textContent).toBe('legal,comunidad'));
    expect(screen.getByTestId('entity').textContent).toBe('pc_usr_1');
    expect(screen.getByTestId('system').textContent).toBe('punto_cero_system');
    expect(screen.getByTestId('user').textContent).toBe('a@b.com');

    const bridge = calls.find((c) => c.path === '/api/access/entitlements');
    expect(bridge).toBeDefined();
    expect(bridge.url).toContain('/api/access/entitlements');
  });

  it('el JWT guardado NO lleva entity_id: el Bridge se consulta con el token', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'));
    const bridge = calls.find((c) => c.path === '/api/access/entitlements');
    expect(bridge).toBeDefined();
  });

  it('Bridge caído (401) tras F5: la SESIÓN SOBREVIVE, sin logout', async () => {
    bridgeStatus = 401;
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'));
    // Sin contexto, pero autenticado y con el token intacto en localStorage.
    expect(screen.getByTestId('spaces').textContent).toBe('');
    expect(screen.getByTestId('entity').textContent).toBe('null');
    expect(localStorage.getItem('pcl_token')).toBe(TOKEN);
  });

  it('sin token en localStorage: no se consulta el Bridge y no hay sesión', async () => {
    localStorage.clear();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('sin-sesion'));
    expect(calls.find((c) => c.path === '/api/access/entitlements')).toBeUndefined();
  });
});
