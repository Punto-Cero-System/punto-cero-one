/**
 * Tests FASE 7.5 — Ecosystem Session Manager.
 * Validan: estado de sesión (usuario/sesión/entitlements/workspaces/vertical),
 * decisiones 100% Workspace Registry (entry_url/status/permission), solicitud
 * de Access Intent, lanzamiento, vertical no disponible → permanecer en System,
 * y el detector de aperturas de verticales.
 */
jest.mock('../accessBridgeClient', () => ({
  fetchSpaces: jest.fn(),
  fetchEntitlements: jest.fn(),
  createIntent: jest.fn(),
}));

beforeAll(() => {
  // Silencia la navegación real de jsdom cuando el manager lanza internamente.
  try {
    Object.defineProperty(window.location, 'assign', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  } catch {
    // Si jsdom lo bloquea, la llamada real solo imprime "Not implemented".
  }
});

import { waitFor } from '@testing-library/react';
import {
  VERTICAL_OPEN_EVENT,
  buildLaunchUrl,
  getSessionState,
  hydrateSession,
  isLaunchable,
  launchSessionVertical,
  launchVertical,
  requestVertical,
  selectLaunchableSpace,
  subscribeSession,
} from '../sessionManager';
import { fetchSpaces, fetchEntitlements, createIntent } from '../accessBridgeClient';

// Fixtures = contenido REAL que devuelve el Workspace Registry (entry_url incluida).
const REGISTRY = [
  { space_key: 'legal', status: 'live', permission: 'workspace.open.legal', entry_url: 'https://legal.puntocerosystem.com/one' },
  { space_key: 'medical', status: 'declared', permission: 'workspace.open.medical', entry_url: 'https://medical.puntocerosystem.com/one' },
  { space_key: 'psicologia', status: 'live', permission: 'workspace.open.psicologia', entry_url: 'https://psicologia.puntocerosystem.com/one' },
  { space_key: 'comunidad', status: 'live', permission: 'workspace.open.comunidad', entry_url: null, route: '/' },
  { space_key: 'empresa', status: 'preview', permission: 'workspace.open.empresa', entry_url: null },
];

beforeEach(async () => {
  jest.clearAllMocks();
  fetchSpaces.mockResolvedValue({ spaces: REGISTRY });
  fetchEntitlements.mockResolvedValue({ entitlements: ['workspace.open.legal'] });
  createIntent.mockResolvedValue({ intent: { intent_code: 'tok_1' } });
  await hydrateSession({
    user: { id: 'u1', email: 'u1@pc.com' },
    token: 'jwt',
    entitlements: ['workspace.open.legal'],
    workspaces: REGISTRY,
  });
  jest.clearAllMocks();
});

describe('estado de la sesión del ecosistema', () => {
  it('hidrata usuario, sesión activa, entitlements, workspaces y vertical', async () => {
    const s = getSessionState();
    expect(s.user).toEqual({ id: 'u1', email: 'u1@pc.com' });
    expect(s.session).toEqual({ active: true });
    expect(s.entitlements).toEqual(['workspace.open.legal']);
    expect(s.workspaces).toHaveLength(REGISTRY.length);
    expect(s.activeVertical).toBeNull();
  });

  it('sin token → sesión inactiva', async () => {
    await hydrateSession({ token: null, entitlements: [], workspaces: [] });
    expect(getSessionState().session.active).toBe(false);
  });

  it('hydrateSession sin campos opcionales consulta al Bridge (registry + entitlements)', async () => {
    await hydrateSession({});
    expect(fetchSpaces).toHaveBeenCalled();
    expect(fetchEntitlements).toHaveBeenCalled();
  });

  it('los suscriptores reciben cambios de estado y pueden darse de baja', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSession(listener);
    await hydrateSession({ entitlements: ['workspace.open.legal', 'workspace.open.psicologia'] });
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    unsubscribe();
    await hydrateSession({ entitlements: [] });
    expect(listener).not.toHaveBeenCalled();
    await hydrateSession({ entitlements: ['workspace.open.legal'] });
  });
});

describe('selectLaunchableSpace — decisiones SOLO del Workspace Registry', () => {
  it('entitlement + live + entry_url → la vertical del registry (orden del registry)', () => {
    const space = selectLaunchableSpace(REGISTRY, ['workspace.open.legal']);
    expect(space.space_key).toBe('legal');
  });

  it('sin entitlement → null (permanece en Punto Cero System)', () => {
    expect(selectLaunchableSpace(REGISTRY, ['workspace.open.comunidad'])).toBeNull();
    expect(selectLaunchableSpace(REGISTRY, [])).toBeNull();
    expect(selectLaunchableSpace(REGISTRY, null)).toBeNull();
  });

  it('vertical no live (declared/preview) → null aunque haya entitlement', () => {
    expect(
      selectLaunchableSpace(REGISTRY, ['workspace.open.medical', 'workspace.open.empresa']),
    ).toBeNull();
  });

  it('live pero sin entry_url en el registry → null (la URL la da el registry)', () => {
    expect(selectLaunchableSpace(REGISTRY, ['workspace.open.comunidad'])).toBeNull();
  });

  it('múltiples entitlements → gana el primero en el orden del registry', () => {
    const spaces = [
      { space_key: 'psicologia', status: 'live', permission: 'workspace.open.psicologia', entry_url: 'https://psicologia.puntocerosystem.com/one' },
      { space_key: 'legal', status: 'live', permission: 'workspace.open.legal', entry_url: 'https://legal.puntocerosystem.com/one' },
    ];
    expect(
      selectLaunchableSpace(spaces, ['workspace.open.legal', 'workspace.open.psicologia'])
        .space_key,
    ).toBe('psicologia');
  });

  it('Medical: preparado: al pasar a live en el registry, lanza con la misma mecánica', () => {
    const spaces = REGISTRY.map((s) =>
      s.space_key === 'medical' ? { ...s, status: 'live' } : s,
    );
    const space = selectLaunchableSpace(spaces, ['workspace.open.medical']);
    expect(space.space_key).toBe('medical');
    expect(space.entry_url).toBe('https://medical.puntocerosystem.com/one');
  });

  it('el dominio NO está hardcodeado: usa la entry_url que traiga el registry', () => {
    const custom = [
      { space_key: 'legal', status: 'live', permission: 'workspace.open.legal', entry_url: 'https://mx.corp.example/vertical?lang=es' },
    ];
    const space = selectLaunchableSpace(custom, ['workspace.open.legal']);
    expect(buildLaunchUrl(space.entry_url, 'AAA')).toBe(
      'https://mx.corp.example/vertical?lang=es&intent=AAA',
    );
  });

  it('registry vacío → null', () => {
    expect(selectLaunchableSpace(undefined, ['workspace.open.legal'])).toBeNull();
    expect(selectLaunchableSpace([], ['workspace.open.legal'])).toBeNull();
  });

  it('isLaunchable exige entry_url + permission + status live', () => {
    expect(isLaunchable(REGISTRY[0])).toBe(true);
    expect(isLaunchable({ ...REGISTRY[0], entry_url: null })).toBe(false);
    expect(isLaunchable({ ...REGISTRY[0], status: 'declared' })).toBe(false);
    expect(isLaunchable(null)).toBe(false);
  });
});

describe('buildLaunchUrl', () => {
  it('añade ?intent= a la entry_url del registry', () => {
    expect(buildLaunchUrl('https://legal.puntocerosystem.com/one', 'abc')).toBe(
      'https://legal.puntocerosystem.com/one?intent=abc',
    );
  });

  it('devuelve null sin entry_url o sin code', () => {
    expect(buildLaunchUrl('', 'x')).toBeNull();
    expect(buildLaunchUrl('https://a.b', '')).toBeNull();
  });

  it('codifica el intent_code', () => {
    expect(buildLaunchUrl('https://a.b/one', 'a+b')).toBe('https://a.b/one?intent=a%2Bb');
  });
});

describe('requestVertical / launchVertical (Access Intent)', () => {
  it('pide el intent al Bridge y devuelve la URL del registry + marca la vertical activa', async () => {
    const req = await requestVertical('legal');
    expect(createIntent).toHaveBeenCalledWith('legal', expect.any(Object));
    expect(req.url).toBe('https://legal.puntocerosystem.com/one?intent=tok_1');
    expect(getSessionState().activeVertical).toBe('legal');
  });

  it('vertical no disponible (declared) → null y NO pide intent', async () => {
    await expect(requestVertical('medical')).resolves.toBeNull();
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('sin entitlement → null y NO pide intent', async () => {
    await hydrateSession({ entitlements: ['workspace.open.comunidad'] });
    await expect(requestVertical('legal')).resolves.toBeNull();
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('Bridge deniega el intent → null (permanece en System)', async () => {
    createIntent.mockRejectedValue(new Error('intent:403'));
    await expect(requestVertical('legal')).resolves.toBeNull();
  });

  it('respuesta del intent sin code → null', async () => {
    createIntent.mockResolvedValue({ intent: {} });
    await expect(requestVertical('legal')).resolves.toBeNull();
  });

  it('launchVertical lanza la URL; vertical no disponible no navega', async () => {
    const url = await launchVertical('legal');
    expect(url).toBe('https://legal.puntocerosystem.com/one?intent=tok_1');
    expect(createIntent).toHaveBeenCalledWith('legal', expect.any(Object));

    createIntent.mockClear();
    await expect(launchVertical('medical')).resolves.toBeNull();
    expect(createIntent).not.toHaveBeenCalled();
  });
});

describe('launchSessionVertical (automático tras el login)', () => {
  it('elige la vertical por entitlement+registry y lanza', async () => {
    const url = await launchSessionVertical();
    expect(url).toBe('https://legal.puntocerosystem.com/one?intent=tok_1');
    expect(createIntent).toHaveBeenCalledWith('legal', expect.any(Object));
    expect(getSessionState().activeVertical).toBe('legal');
  });

  it('sin entitlement seleccionable → null, sin intent y sin redirección', async () => {
    await hydrateSession({ entitlements: ['workspace.open.comunidad'] });
    await expect(launchSessionVertical()).resolves.toBeNull();
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('registry vacío → null (permanece en Punto Cero System)', async () => {
    await hydrateSession({ workspaces: [] });
    await expect(launchSessionVertical()).resolves.toBeNull();
  });
});

describe('detector de aperturas de verticales (pcs:open-vertical)', () => {
  it('una solicitud de apertura válida dispara el lanzamiento completo', async () => {
    const received = [];
    const unsubscribe = subscribeSession((s) => received.push(s));
    window.dispatchEvent(
      new CustomEvent(VERTICAL_OPEN_EVENT, { detail: { spaceKey: 'legal' } }),
    );
    await waitFor(() =>
      expect(createIntent).toHaveBeenCalledWith('legal', expect.any(Object)),
    );
    // El estado solo se actualiza a vertical activa cuando el intent es válido:
    // eso prueba que la resolución del detector llegó al final del lanzamiento.
    await waitFor(() =>
      expect(received.some((s) => s.activeVertical === 'legal')).toBe(true),
    );
    unsubscribe();
  });

  it('una solicitud hacia una vertical no disponible permanece en System', async () => {
    window.dispatchEvent(
      new CustomEvent(VERTICAL_OPEN_EVENT, { detail: { spaceKey: 'medical' } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createIntent).not.toHaveBeenCalled();
  });
});

