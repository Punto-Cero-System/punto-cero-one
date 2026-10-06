import { resolveWorkspaceDestination } from '../workspaceOrchestrator';

const liveWorkspace = (space_key, launchMode = 'workspace') => ({
  space_key,
  status: 'live',
  launchMode,
});

describe('resolveWorkspaceDestination', () => {
  it('prioriza el entitlement activo sobre los demás candidatos', () => {
    const result = resolveWorkspaceDestination({
      entitlements: ['workspace.open.legal'],
      registry: [liveWorkspace('legal')],
      systemContext: { workspaces: { recommended: 'medical' } },
    });

    expect(result).toEqual(expect.objectContaining({ workspaceKey: 'legal' }));
  });

  it('resuelve Medical cuando su entitlement y registry están live', () => {
    const result = resolveWorkspaceDestination({
      entitlements: ['workspace.open.medical'],
      registry: [liveWorkspace('medical')],
    });

    expect(result).toEqual(expect.objectContaining({ workspaceKey: 'medical' }));
  });

  it('no abre un workspace declared', () => {
    const result = resolveWorkspaceDestination({
      entitlements: ['workspace.open.medical'],
      registry: [{ space_key: 'medical', status: 'declared' }],
    });

    expect(result).toEqual({ stayInSystem: true, reason: 'no_available_workspace' });
  });

  it('valida en registry la recomendación de systemContext sin entitlement', () => {
    const result = resolveWorkspaceDestination({
      entitlements: [],
      registry: [liveWorkspace('medical')],
      systemContext: { workspaces: { recommended: 'medical' } },
    });

    expect(result).toEqual(expect.objectContaining({ workspaceKey: 'medical' }));
  });

  it('resuelve el workspace asociado a la organización activa', () => {
    const result = resolveWorkspaceDestination({
      entitlements: [],
      registry: [liveWorkspace('legal')],
      activeOrganization: { workspaceKey: 'legal' },
    });

    expect(result).toEqual(expect.objectContaining({ workspaceKey: 'legal' }));
  });

  it('preserva el launchMode declarado incluso cuando live es controlled', () => {
    const workspace = liveWorkspace('legal', 'controlled');
    const result = resolveWorkspaceDestination({
      entitlements: ['workspace.open.legal'],
      registry: [workspace],
    });

    expect(result).toEqual(expect.objectContaining({
      workspaceKey: 'legal',
      status: 'live',
      launchMode: 'controlled',
      controlledAccess: true,
    }));
    expect(workspace.launchMode).toBe('controlled');
  });

  it('devuelve el contrato exacto de permanencia cuando no hay coincidencias', () => {
    const result = resolveWorkspaceDestination({
      entitlements: [],
      registry: [],
      availableWorkspaces: [],
    });

    expect(result).toEqual({ stayInSystem: true, reason: 'no_available_workspace' });
  });
});

/* ===========================================================================
 * D2.2-B.3-C — ENDURECIMIENTO FAIL-CLOSED (cinturón del orchestrator)
 *
 * El orchestrator YA fallaba cerrado desde D2.2-B.3-A: en `findWorkspace` se
 * sustituyó `status || 'live'` por `normalizeKey(workspace.status)` más el corte
 * `if (!status || ...) return null`. Aquí no cambia su lógica.
 *
 * Estos tests NO son nuevos requisitos: fijan el comportamiento que el módulo
 * debe conservar y cubren A–E en su propia superficie. Son la red que demuestra
 * que el endurecimiento de `workspaceActivation` no se apoyó en que el
 * orchestrator hiciera el trabajo sucio por él.
 * ======================================================================== */

const PERMANECE = { stayInSystem: true, reason: 'no_available_workspace' };
const conStatus = (status) => (status === undefined
  ? [{ space_key: 'x', launchMode: 'workspace' }]
  : [{ space_key: 'x', status, launchMode: 'workspace' }]);

describe('D2.2-B.3-C · resolveWorkspaceDestination falla cerrado', () => {
  const resuelve = (registry) => resolveWorkspaceDestination({
    entitlements: ['workspace.open.x'],
    registry,
  });

  it('A · workspace SIN status no abre', () => {
    expect(resuelve(conStatus(undefined))).toEqual(PERMANECE);
  });

  it('B · status INVÁLIDO no abre', () => {
    expect(resuelve(conStatus('inventado'))).toEqual(PERMANECE);
  });

  it('C · status UNDEFINED no abre', () => {
    expect(resuelve([{ space_key: 'x', status: undefined }])).toEqual(PERMANECE);
  });

  it('D · status NULL no abre', () => {
    expect(resuelve([{ space_key: 'x', status: null }])).toEqual(PERMANECE);
  });

  it('E · status VACÍO no abre', () => {
    expect(resuelve(conStatus(''))).toEqual(PERMANECE);
  });

  it('F · preview con launchMode workspace no abre', () => {
    expect(resuelve([{ space_key: 'x', status: 'preview', launchMode: 'workspace' }]))
      .toEqual(PERMANECE);
  });

  it('G · launchMode ausente o vacío no abre', () => {
    expect(resuelve([{ space_key: 'x', status: 'live' }])).toEqual(PERMANECE);
    expect(resuelve([{ space_key: 'x', status: 'live', launchMode: '' }])).toEqual(PERMANECE);
  });

  it('H · workspace correcto se comporta EXACTAMENTE como antes', () => {
    // Camino válido intacto: `live` sigue resolviendo con la misma forma.
    expect(resuelve([liveWorkspace('x')])).toEqual(expect.objectContaining({
      stayInSystem: false,
      workspaceKey: 'x',
      status: 'live',
    }));
  });

  it('no lanza ante registry ausente o vacío: solo permanece en el sistema', () => {
    [undefined, null, {}, []].forEach((registry) => {
      expect(() => resuelve(registry)).not.toThrow();
      expect(resuelve(registry)).toEqual(PERMANECE);
    });
  });
});
