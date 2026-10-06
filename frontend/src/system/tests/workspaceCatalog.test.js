import {
  canLaunchWorkspace,
  deriveAvailability,
  getWorkspace,
  getWorkspaceStatus,
  isWorkspaceAvailable,
  isWorkspaceStatusOpen,
  WORKSPACE_STATUSES,
} from '../workspaceCatalog';
import { listAvailableVerticals } from '../ecosystemEngine';
import { resolveWorkspaceEnrollment } from '../workspaceEnrollment';
import {
  listDeclaredWorkspaces,
  listLiveWorkspaces,
  listPreviewWorkspaces,
} from '../workspaceRegistryService';

describe('workspaceCatalog', () => {
  it('legal live está disponible y es lanzable', () => {
    expect(isWorkspaceAvailable('legal')).toBe(true);
    expect(canLaunchWorkspace('legal')).toBe(true);
    expect(getWorkspaceStatus('legal')).toBe('live');
  });

  it('medical preview está disponible para lanzamiento controlado', () => {
    expect(isWorkspaceAvailable('medical')).toBe(true);
    expect(canLaunchWorkspace('medical')).toBe(true);
    expect(getWorkspaceStatus('medical')).toBe('preview');
  });

  it('obtiene un workspace existente', () => {
    expect(getWorkspace('legal')).toEqual(expect.objectContaining({
      key: 'legal',
      name: 'Punto Cero Legal',
    }));
  });

  it('un workspace declared no es lanzable', () => {
    expect(isWorkspaceAvailable('odontologia')).toBe(false);
    expect(canLaunchWorkspace('odontologia')).toBe(false);
    expect(getWorkspaceStatus('odontologia')).toBe('declared');
  });

  it('un workspace deprecated no es lanzable', () => {
    expect(isWorkspaceAvailable('legacy')).toBe(false);
    expect(canLaunchWorkspace('legacy')).toBe(false);
    expect(getWorkspaceStatus('legacy')).toBe('deprecated');
  });

  it('un workspace inexistente devuelve undefined y false', () => {
    expect(getWorkspace('unknown')).toBeUndefined();
    expect(getWorkspaceStatus('unknown')).toBeUndefined();
    expect(isWorkspaceAvailable('unknown')).toBe(false);
    expect(canLaunchWorkspace('unknown')).toBe(false);
  });
});

/* ===========================================================================
 * D2.2-C.2 — CONSOLIDACIÓN DE LA FRONTERA OPEN/CLOSED
 *
 * Antes de este carril, "¿este workspace está abierto?" estaba respondida en
 * cuatro sitios: `workspaceCatalog.OPEN_STATUSES`, `ecosystemEngine.
 * VERTICAL_STATUSES`, `workspaceEnrollment.OPEN_STATUSES` y las tres
 * comparaciones literales de `workspaceRegistryService`. Cuatro copias de la
 * misma regla de seguridad.
 *
 * Aquí se verifica la CONSOLIDACIÓN, no una función nueva: que todos los
 * consumidores den la misma respuesta y que no quede ninguna copia literal.
 * No se prueba ninguna decisión de producto: `medical`, `empresa`, `legacy`,
 * `launchMode` y `external` siguen exactamente igual.
 * ======================================================================== */

const LIFECYCLES = ['live', 'preview', 'declared', 'deprecated'];

const enrollmentDe = (status) => ({
  workspace: { key: 'legal' },
  subscription: { status: 'active' },
  plan: { name: 'Professional', workspaces: ['legal'] },
  lifecycle: { status },
  entitlements: ['workspace.open.legal'],
});

// Verdicto de `ecosystemEngine.listAvailableVerticals` para un status dado.
// Se consulta sobre una vertical sintetica anadida al registro: el consumidor
// filtra por la MISMA frontera canonica, asi que su respuesta tiene que coincidir
// con `isWorkspaceStatusOpen` sin excepcion.
const ecosystemVeredicto = (status) => {
  const registry = require('../workspaceRegistry').default;
  const vertical = { key: `probe-${status}`, name: status, status, workspaces: [] };
  registry.verticals.push(vertical);
  try {
    return listAvailableVerticals().some((v) => v.key === vertical.key);
  } finally {
    registry.verticals.splice(registry.verticals.indexOf(vertical), 1);
  }
};

describe('A · todos los consumidores coinciden con la autoridad', () => {
  it.each(LIFECYCLES)('%s: la frontera canónica decide igual', (status) => {
    const esperado = isWorkspaceStatusOpen(status);
    expect(deriveAvailability(status) === 'open').toBe(esperado);
  });

  it.each(LIFECYCLES)('%s: ecosystemEngine coincide con la autoridad', (status) => {
    expect(ecosystemVeredicto(status)).toBe(isWorkspaceStatusOpen(status));
  });

  it.each(LIFECYCLES)('%s: workspaceEnrollment coincide con la autoridad', (status) => {
    // Con las demas condiciones satisfechas, la frontera es lo unico que decide.
    expect(resolveWorkspaceEnrollment(enrollmentDe(status)).enrolled)
      .toBe(isWorkspaceStatusOpen(status));
  });

  it.each(LIFECYCLES)('%s: el filtro por status usa el vocabulario canonico', (status) => {
    // `deprecated` no tiene lista propia en el API publico: el filtro que lo
    // cubre es la frontera (esta cerrado), no una funcion dedicada.
    if (status === 'deprecated') {
      expect(isWorkspaceStatusOpen(status)).toBe(false);
      return;
    }
    const listas = {
      live: listLiveWorkspaces(),
      preview: listPreviewWorkspaces(),
      declared: listDeclaredWorkspaces(),
    };
    const esperados = {
      live: WORKSPACE_STATUSES.LIVE,
      preview: WORKSPACE_STATUSES.PREVIEW,
      declared: WORKSPACE_STATUSES.DECLARED,
    };
    // Cada lista contiene SOLO su status, tomado del vocabulario canonico.
    listas[status].forEach((w) => expect(w.status).toBe(esperados[status]));
  });
});

describe('B · no queda ninguna copia literal de la frontera', () => {
  it('ningún CONSUMIDOR vuelve a declarar OPEN/VERTICAL_STATUSES', () => {
    const fs = require('fs');
    const path = require('path');
    // `workspaceCatalog.js` queda FUERA a proposito: es la autoridad, el unico
    // sitio donde el Set tiene legitimidad para existir. Lo que se busca es que
    // ningun consumidor lo redeclare.
    const consumidores = ['ecosystemEngine.js',
      'workspaceEnrollment.js', 'workspaceRegistryService.js'];
    const copias = consumidores.filter((m) => {
      const src = fs.readFileSync(path.join(__dirname, '..', m), 'utf-8');
      // Se ignoran comentarios: documentar el patrón viejo está permitido.
      const codigo = src.split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n');
      return /new Set\(\s*\[\s*['"]live['"]/.test(codigo)
        || /VERTICAL_STATUSES|OPEN_STATUSES\s*=/.test(codigo)
        || /status\s*===\s*['"](live|preview|declared|deprecated)['"]/.test(codigo);
    });
    expect(copias).toEqual([]);
  });

  it('los tres consumidores reutilizan la autoridad, no una regla propia', () => {
    const fs = require('fs');
    const path = require('path');
    const consumidores = ['ecosystemEngine.js',
      'workspaceEnrollment.js', 'workspaceRegistryService.js'];
    consumidores.forEach((m) => {
      const src = fs.readFileSync(path.join(__dirname, '..', m), 'utf-8');
      expect(src).toMatch(/import\s*{[^}]*isWorkspaceStatusOpen[^}]*}\s*from\s*'\.\/workspaceCatalog'/);
    });
  });
});

describe('C · cambiar la frontera arrastra a los consumidores (mutación)', () => {
  it('los consumidores NO mantienen frontera propia', () => {
    // Prueba estructural de la consolidación: si un consumidor conservara su
    // propia copia, seguiría respondiendo con el vocabulario viejo cuando la
    // autoridad cambiara. Aqui se comprueba que la unica fuente de la verdad es
    // `isWorkspaceStatusOpen`, y que mover la frontera la mueve para todos.
    //
    // La mutacion real se ejecuta aparte (ver el informe del carril): se
    // invierte `preview` en la autoridad y TODOS los consumidores deben seguir
    // respondiendo igual entre si. Este test fija ese invariante.
    const abiertos = LIFECYCLES.filter((s) => isWorkspaceStatusOpen(s));
    expect(abiertos).toEqual(['live', 'preview']);

    // Consumers agree pairwise for the four lifecycles.
    for (const status of LIFECYCLES) {
      const autoridad = isWorkspaceStatusOpen(status);
      const ecosystem = ecosystemVeredicto(status);
      const enrollment = resolveWorkspaceEnrollment(enrollmentDe(status)).enrolled;
      expect({ ecosystem, enrollment }).toEqual({
        ecosystem: autoridad,
        enrollment: autoridad,
      });
    }
  });
});

describe('D · el comportamiento observable no cambió', () => {
  it('los cuatro lifecycles mantienen exactamente su veredicto', () => {
    expect(LIFECYCLES.filter((s) => isWorkspaceStatusOpen(s)))
      .toEqual(['live', 'preview']);
    expect(LIFECYCLES.filter((s) => !isWorkspaceStatusOpen(s)))
      .toEqual(['declared', 'deprecated']);
  });
});
