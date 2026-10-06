/**
 * FASE 4.4 — Alineacion de la politica de acceso del frontend con el backend
 * (D1 status + D2 role no concede workspace).
 *
 * Fija que la decision de shell/post-login se toma EXCLUSIVAMENTE de los
 * entitlements que entrega el Access Bridge, y que `role` ya no concede nada.
 */
import {
  resolveAccessShell,
  resolvePostLoginEntry,
  resolveAllowedSpaceKeys,
  spaceKeysFromEntitlements,
} from '../accessBridgeEntry';

const LEGAL = 'workspace.open.legal';
const COMUNIDAD = 'workspace.open.comunidad';
const EMPRESA = 'workspace.open.empresa';
const AGENTE = 'workspace.open.agente';
const MEDICAL = 'workspace.open.medical';

describe('FASE 4.4: spaceKeysFromEntitlements', () => {
  it('extrae las claves de los permisos del Bridge', () => {
    expect(spaceKeysFromEntitlements([LEGAL, COMUNIDAD])).toEqual(['legal', 'comunidad']);
  });

  it('deduplica y descarta permisos ajenos', () => {
    expect(spaceKeysFromEntitlements([LEGAL, LEGAL, 'otro.permiso', 'workspace.open'])).toEqual(['legal']);
  });

  it('tolera entrada invalida', () => {
    expect(spaceKeysFromEntitlements(null)).toEqual([]);
    expect(spaceKeysFromEntitlements(undefined)).toEqual([]);
  });
});

describe('FASE 4.4: resolveAllowedSpaceKeys', () => {
  it('prefiere entitlements sobre available_spaces', () => {
    expect(resolveAllowedSpaceKeys([LEGAL], ['comunidad', 'legal'])).toEqual(['legal']);
  });

  it('cae a available_spaces si no hay entitlements', () => {
    expect(resolveAllowedSpaceKeys([], ['comunidad'])).toEqual(['comunidad']);
  });

  it('sin ninguna fuente devuelve lista vacia', () => {
    expect(resolveAllowedSpaceKeys(null, null)).toEqual([]);
  });
});

describe('FASE 4.4: CASO 1 — admin sin vertical no abre Legal', () => {
  it('admin con solo comunidad NO entra a Legal', () => {
    const shell = resolveAccessShell(null, [COMUNIDAD], { role: 'admin' });
    expect(shell.hasAccess).toBe(true);
    expect(shell.spaceKey).toBe('comunidad');
    expect(shell.path).toBe('/portal');
    // Regresion del cambio: antes `role === 'admin'` devolvia '/admin'.
    expect(shell.path).not.toBe('/admin');
  });
});

describe('FASE 4.4: CASO 2 — member con vertical legal', () => {
  it('member con legal + comunidad entra a workspace', () => {
    const shell = resolveAccessShell(null, [LEGAL, COMUNIDAD], { role: 'member' });
    expect(shell).toEqual({ path: '/workspace', spaceKey: 'legal', hasAccess: true });
  });
});

describe('FASE 4.4: CASO 3 — admin con vertical legal', () => {
  it('admin con legal conserva el acceso a Legal', () => {
    const shell = resolveAccessShell(null, [LEGAL, COMUNIDAD], { role: 'admin' });
    expect(shell.path).toBe('/workspace');
    expect(shell.spaceKey).toBe('legal');
  });
});

describe('FASE 4.4: CASO 4 — usuario suspendido (sin entitlements)', () => {
  it('sin permisos no navega y no concede acceso', () => {
    const shell = resolveAccessShell(null, [], { role: 'admin' });
    expect(shell).toEqual({ path: null, spaceKey: null, hasAccess: false });
  });

  it('suspendido con vertical legal tampoco entra', () => {
    // El backend ya filtro: si suspendido, `entitlements` llega vacio aunque
    // el usuario declare vertical. Aqui se comprueba que el frontend no
    // reintroduce el acceso por rol.
    const shell = resolveAccessShell(null, [], { role: 'admin_system' });
    expect(shell.hasAccess).toBe(false);
    expect(shell.path).toBeNull();
  });

  it('resolvePostLoginEntry devuelve null para que el llamador no navegue', () => {
    expect(resolvePostLoginEntry(null, [], { role: 'admin' })).toBeNull();
  });
});

describe('FASE 4.4: CASO 5 — los tres admins reales mantienen Legal', () => {
  it.each([
    'admin@puntocerosystem.com',
    'darwin@puntocerolegal.com',
    'alejandro@puntocerolegal.com',
  ])('%s mantiene workspace.open.legal', (email) => {
    const shell = resolveAccessShell(null, [LEGAL, COMUNIDAD], { role: 'admin', email });
    expect(shell.path).toBe('/workspace');
    expect(shell.hasAccess).toBe(true);
  });
});

describe('FASE 4.4: el rol NO concede workspace', () => {
  it.each(['admin', 'admin_system', 'investor', 'member', 'agent', 'org_admin'])(
    'role=%s sin entitlement no abre ningun workspace',
    (role) => {
      const shell = resolveAccessShell(null, [COMUNIDAD], { role });
      expect(shell.spaceKey).toBe('comunidad');
      expect(shell.path).not.toBe('/workspace');
      expect(shell.path).not.toBe('/admin');
      expect(shell.path).not.toBe('/firm-os');
    },
  );

  it('el parametro `user` no altera la decision', () => {
    const conAdmin = resolveAccessShell(null, [COMUNIDAD], { role: 'admin' });
    const sinUser = resolveAccessShell(null, [COMUNIDAD], null);
    expect(conAdmin).toEqual(sinUser);
  });
});

describe('FASE 4.4: shells por espacio', () => {
  it('empresa -> /firm-os', () => {
    expect(resolveAccessShell(null, [EMPRESA, COMUNIDAD], null).path).toBe('/firm-os');
  });

  it('agente -> /agent', () => {
    expect(resolveAccessShell(null, [AGENTE, COMUNIDAD], null).path).toBe('/agent');
  });

  it('medical -> /medical', () => {
    expect(resolveAccessShell(null, [MEDICAL, COMUNIDAD], null).path).toBe('/medical');
  });

  it('empresa tiene prioridad sobre legal', () => {
    expect(resolveAccessShell(null, [LEGAL, EMPRESA], null).path).toBe('/firm-os');
  });
});
