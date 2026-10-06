import { activateWorkspace } from '../workspaceActivation';

const registry = [
  { space_key: 'legal', status: 'live', launchMode: 'workspace', permission: 'workspace.open.legal' },
  { space_key: 'medical', status: 'live', launchMode: 'workspace', permission: 'workspace.open.medical' },
  { space_key: 'preview', status: 'preview', launchMode: 'controlled', permission: 'workspace.open.preview' },
  { space_key: 'declared', status: 'declared', launchMode: 'controlled', permission: 'workspace.open.declared' },
];

const decision = (workspaceKey, launchMode = 'workspace') => ({
  workspaceKey,
  verticalKey: workspaceKey,
  launchMode,
});

describe('activateWorkspace', () => {
  it('activa legal live', () => {
    expect(activateWorkspace(decision('legal'), {
      registry,
      entitlements: ['workspace.open.legal'],
    })).toEqual({
      activated: true,
      workspaceKey: 'legal',
      status: 'live',
      target: 'legal',
    });
  });

  it('activa medical live', () => {
    expect(activateWorkspace(decision('medical'), {
      registry,
      entitlements: ['workspace.open.medical'],
    })).toEqual(expect.objectContaining({
      activated: true,
      workspaceKey: 'medical',
      status: 'live',
      target: 'medical',
    }));
  });

  it('activa un workspace preview de forma controlada', () => {
    expect(activateWorkspace(decision('preview', 'controlled'), {
      registry,
      entitlements: ['workspace.open.preview'],
    })).toEqual(expect.objectContaining({
      activated: true,
      workspaceKey: 'preview',
      status: 'preview',
    }));
  });

  it('activa un workspace live en modo controlled', () => {
    expect(activateWorkspace(decision('medical', 'controlled'), {
      registry: [{ ...registry[1], launchMode: 'controlled' }],
      entitlements: ['workspace.open.medical'],
    })).toEqual(expect.objectContaining({
      activated: true,
      workspaceKey: 'medical',
      status: 'live',
    }));
  });

  it('usa el launchMode del Registry aunque la decisión discrepe', () => {
    expect(activateWorkspace(decision('preview', 'workspace'), {
      registry,
      entitlements: ['workspace.open.preview'],
    })).toEqual(expect.objectContaining({
      activated: true,
      workspaceKey: 'preview',
      status: 'preview',
    }));
  });

  it('deniega preview con launchMode workspace (prueba de mutación)', () => {
    const mutatedRegistry = registry.map((workspace) => (
      workspace.space_key === 'preview'
        ? { ...workspace, launchMode: 'workspace' }
        : workspace
    ));
    expect(activateWorkspace(decision('preview', 'controlled'), {
      registry: mutatedRegistry,
      entitlements: ['workspace.open.preview'],
    })).toEqual(NO_ACTIVA);
  });

  it('deniega declared y deprecated para cualquier launchMode', () => {
    ['declared', 'deprecated'].forEach((status) => {
      ['workspace', 'controlled'].forEach((launchMode) => {
        expect(activateWorkspace(decision('closed'), {
          registry: [{
            space_key: 'closed',
            status,
            launchMode,
            permission: 'workspace.open.closed',
          }],
          entitlements: ['workspace.open.closed'],
        })).toEqual(NO_ACTIVA);
      });
    });
  });

  it('deniega live con launchMode ausente o vacío', () => {
    [undefined, ''].forEach((launchMode) => {
      const workspace = { ...registry[0] };
      if (launchMode === undefined) delete workspace.launchMode;
      else workspace.launchMode = launchMode;
      expect(activateWorkspace(decision('legal'), {
        registry: [workspace],
        entitlements: ['workspace.open.legal'],
      })).toEqual(NO_ACTIVA);
    });
  });

  it('deniega live con un launchMode desconocido', () => {
    expect(activateWorkspace(decision('legal'), {
      registry: [{ ...registry[0], launchMode: 'automatic' }],
      entitlements: ['workspace.open.legal'],
    })).toEqual(NO_ACTIVA);
  });

  it('no activa un workspace declared', () => {
    expect(activateWorkspace(decision('declared'), {
      registry,
      entitlements: ['workspace.open.declared'],
    })).toEqual({ activated: false, reason: 'workspace_not_available' });
  });

  it('no activa un workspace inexistente', () => {
    expect(activateWorkspace(decision('unknown'), {
      registry,
      entitlements: ['workspace.open.unknown'],
    })).toEqual({ activated: false, reason: 'workspace_not_available' });
  });

  it('no activa sin decisión', () => {
    expect(activateWorkspace(null, { registry })).toEqual({
      activated: false,
      reason: 'workspace_not_available',
    });
  });
});

/* ===========================================================================
 * D2.2-B.3-C — ENDURECIMIENTO FAIL-CLOSED
 *
 * Qué cambió y por qué
 * --------------------
 * ANTES: `normalizeKey(workspace.status || decision.status)`. Cuando el REGISTRO
 * no declaraba status, el módulo caía al status de la DECISIÓN. Eso convertía un
 * workspace mal definido en uno operativo: bastaba con que la decisión trajera
 * `status: 'live'` para que un registro sin status se activara.
 *
 * AHORA: el status se lee SOLO del registro. El registro es la autoridad del
 * lifecycle (contrato D2.2); la decisión es la salida de otro módulo y no puede
 * imponer su status al catálogo. Sin status, cierra.
 *
 * Estos tests fijan el comportamiento NUEVO. El caso `sin status` (A) es el que
 * falla contra el código anterior; los demás ya cerraban y sirven de red contra
 * una regresión futura.
 *
 * El launchMode también debe existir en el Registry; la decisión no puede
 * aportar uno ausente ni reemplazar el valor declarado.
 * ======================================================================== */

const NO_ACTIVA = { activated: false, reason: 'workspace_not_available' };

// Registry con una sola entrada, deliberadamente anómala en cada test.
const registroCon = (workspace) => [{ ...workspace }];
const sinStatus = registroCon({ space_key: 'x', permission: 'workspace.open.x' });

describe('D2.2-B.3-C · activateWorkspace falla cerrado', () => {
  it('A · workspace SIN status no abre aunque la decisión diga live', () => {
    // El caso que motivó el cambio. Antes devolvía activated:true.
    expect(activateWorkspace({ workspaceKey: 'x', status: 'live' }, {
      registry: sinStatus,
      entitlements: ['workspace.open.x'],
    })).toEqual(NO_ACTIVA);
  });

  it('B · status INVÁLIDO no abre', () => {
    expect(activateWorkspace({ workspaceKey: 'x', status: 'live' }, {
      registry: registroCon({
        space_key: 'x', status: 'inventado', permission: 'workspace.open.x',
      }),
      entitlements: ['workspace.open.x'],
    })).toEqual(NO_ACTIVA);
  });

  it('C · status UNDEFINED no abre', () => {
    expect(activateWorkspace({ workspaceKey: 'x', status: 'live' }, {
      registry: registroCon({
        space_key: 'x', status: undefined, permission: 'workspace.open.x',
      }),
      entitlements: ['workspace.open.x'],
    })).toEqual(NO_ACTIVA);
  });

  it('D · status NULL no abre', () => {
    expect(activateWorkspace({ workspaceKey: 'x', status: 'live' }, {
      registry: registroCon({
        space_key: 'x', status: null, permission: 'workspace.open.x',
      }),
      entitlements: ['workspace.open.x'],
    })).toEqual(NO_ACTIVA);
  });

  it('E · status VACÍO no abre', () => {
    expect(activateWorkspace({ workspaceKey: 'x', status: 'live' }, {
      registry: registroCon({
        space_key: 'x', status: '', permission: 'workspace.open.x',
      }),
      entitlements: ['workspace.open.x'],
    })).toEqual(NO_ACTIVA);
  });

  it('F · workspace correcto se comporta EXACTAMENTE como antes', () => {
    // Red de seguridad: el endurecimiento no puede alterar el camino válido.
    expect(activateWorkspace(decision('legal'), {
      registry,
      entitlements: ['workspace.open.legal'],
    })).toEqual({
      activated: true,
      workspaceKey: 'legal',
      status: 'live',
      target: 'legal',
    });
  });

  it('no lanza ante entradas degeneradas: solo devuelve unavailable', () => {
    // "Si falta información necesaria: no lanzar." Se comprueba con entradas
    // que antes de endurecer tampoco lanzaban, para fijar que NO se introduce
    // un throw nuevo en el camino de fallo.
    const entradas = [
      [undefined, {}],
      [null, {}],
      [{}, {}],
      [{ workspaceKey: '' }, { registry }],
      [{ workspaceKey: 'x' }, { registry: [] }],
      [{ workspaceKey: 'x' }, { registry: null }],
    ];
    entradas.forEach(([decision_, options]) => {
      expect(() => activateWorkspace(decision_, options)).not.toThrow();
      expect(activateWorkspace(decision_, options)).toEqual(NO_ACTIVA);
    });
  });
});
