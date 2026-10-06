/**
 * D2.2-C.4 — CONTRATO DE LANZAMIENTO DEL WORKSPACE (lado frontend).
 *
 * QUÉ ES ESTE ARCHIVO
 * -------------------
 * La contraparte ejecutable de `docs/architecture/WORKSPACE-LAUNCH-CONTRACT.md`
 * para el navegador. El test Python congela los cuatro ejes en el Registry
 * (backend); este congela los mismos cuatro ejes donde el frontend realmente
 * diverge: en `workspaceCatalog`, `sessionManager` y `workspaceOrchestrator`.
 *
 * POR QUÉ EXISTE
 * --------------
 * D2.2-C.3 encontró que "disponible" y "lanzable" son DOS fronteras distintas
 * que el frontend respondía con el mismo `status`:
 *
 *     preview  ->  OPEN           (lifecycle: `deriveAvailability`)
 *     preview  ->  NO LAUNCHABLE  (`isLaunchable`: exige `status === 'live'`)
 *
 * Esa divergencia es INTRENCIONAL, pero no estaba escrita en ningún contrato.
 * Aquí queda escrita y protegida.
 *
 * LO QUE ESTE ARCHIVO PROHÍBE HACER
 * ---------------------------------
 * NO corrige nada. En concreto:
 *   · NO cambia `medical` ni `empresa`.
 *   · NO unifica lifecycle con launchability.
 *   · NO decide D3 (launchMode) ni D4 (external).
 *
 * Un fallo aquí significa "alguien movió un eje congelado", no "el contrato
 * está mal". La deuda se congela, no se corrige.
 */
import {
  canLaunchWorkspace,
  deriveAvailability,
  getWorkspaceStatus,
  isWorkspaceAvailable,
  isWorkspaceStatusOpen,
  WORKSPACE_CATALOG,
  WORKSPACE_STATUSES,
} from '../workspaceCatalog';
import { isLaunchable } from '../sessionManager';
import { resolveWorkspaceDestination } from '../workspaceOrchestrator';
import workspaceRegistry from '../workspaceRegistry';
import { activateWorkspace } from '../workspaceActivation';

// Eje A — el ÚNICO vocabulario de lifecycle.
const VALID_LIFECYCLE = ['live', 'preview', 'declared', 'deprecated'];

// Eje D — vocabulario de NAVEGACIÓN, no lifecycle. Prohibido como status.
const NOT_LIFECYCLE = ['available', 'coming_soon', 'external'];

// Ejes C y D — atributos de ejes que siguen ABIERTOS en este carril.
const BLOCKED_AXES = ['launchMode', 'external'];

describe('Eje A · LIFECYCLE es la única autoridad', () => {
  it('todo status del catálogo pertenece al vocabulario canónico', () => {
    const fuera = WORKSPACE_CATALOG
      .filter((w) => !VALID_LIFECYCLE.includes(w.status))
      .map((w) => w.key);
    expect(fuera).toEqual([]);
  });

  it('el catálogo no declara `availability` como campo', () => {
    // Availability es DERIVACIÓN. Si algún día aparece como campo, este test
    // cae: significaría que alguien empezó a almacenarla.
    const conAvailability = WORKSPACE_CATALOG
      .filter((w) => Object.prototype.hasOwnProperty.call(w, 'availability'))
      .map((w) => w.key);
    expect(conAvailability).toEqual([]);
  });

  it('el vocabulario de navegación no aparece como lifecycle', () => {
    expect(NOT_LIFECYCLE).not.toContain(WORKSPACE_STATUSES.LIVE);
    // `workspaceRegistry.lifecycles` también es vocabulario de lifecycle y
    // debe coincidir con el canónico.
    expect([...workspaceRegistry.lifecycles].sort())
      .toEqual([...VALID_LIFECYCLE].sort());
  });
});

describe('Eje B · AVAILABILITY es una derivación, no un dato', () => {
  it('el mapa lifecycle -> disponibilidad no cambia', () => {
    const esperado = {
      live: 'open',
      preview: 'open',
      declared: 'closed',
      deprecated: 'closed',
    };
    Object.entries(esperado).forEach(([status, want]) => {
      expect(deriveAvailability(status)).toBe(want);
    });
  });

  it('un status ausente o desconocido CIERRA (fail-closed)', () => {
    // La parte que importa: un status ausente NO se asume disponible.
    expect(deriveAvailability('inventado')).toBe('closed');
    expect(deriveAvailability(undefined)).toBe('closed');
    expect(deriveAvailability('')).toBe('closed');
    expect(isWorkspaceStatusOpen('inventado')).toBe(false);
  });

  it('la frontera OPEN/CLOSED cubre los cuatro lifecycles sin huecos', () => {
    const abiertos = VALID_LIFECYCLE.filter(isWorkspaceStatusOpen);
    const cerrados = VALID_LIFECYCLE.filter((s) => !isWorkspaceStatusOpen(s));
    expect(abiertos).toEqual(['live', 'preview']);
    expect(cerrados).toEqual(['declared', 'deprecated']);
  });
});

describe('Eje C · LAUNCHABILITY es una frontera INDEPENDIENTE', () => {
  it('`preview` está OPEN por lifecycle pero NO es lanzable', () => {
    // LA divergencia congelada. Si algún día cambia, es una DECISIÓN (D3), no un
    // refactor: este test obliga a que esa decisión sea consciente.
    expect(deriveAvailability('preview')).toBe('open');
    expect(isWorkspaceAvailable('medical')).toBe(true);

    // Y aun así `sessionManager.isLaunchable` lo rechaza: exige `live`.
    expect(isLaunchable({
      space_key: 'medical',
      status: 'preview',
      permission: 'workspace.open.medical',
      entry_url: 'https://medical.puntocerosystem.com/one',
    })).toBe(false);
  });

  it('`live` sí es lanzable: la frontera se mueve, no desaparece', () => {
    expect(isLaunchable({
      space_key: 'legal',
      status: 'live',
      permission: 'workspace.open.legal',
      entry_url: 'https://legal.puntocerosystem.com/one',
    })).toBe(true);
  });

  it('ningún lifecycle cerrado se cuela como lanzable', () => {
    ['declared', 'deprecated'].forEach((status) => {
      expect(isLaunchable({
        space_key: 'x',
        status,
        permission: 'workspace.open.x',
        entry_url: 'https://x.example/one',
      })).toBe(false);
    });
  });

  it('el catálogo NO transporta launchability como campo', () => {
    // Launchability NO es un eje del catálogo. Si apareciera, estaríamos
    // mezclando un eje local con la autoridad de lifecycle.
    const modelados = WORKSPACE_CATALOG
      .filter((w) => 'launchable' in w || 'isLaunchable' in w)
      .map((w) => w.key);
    expect(modelados).toEqual([]);
  });

  it('`canLaunchWorkspace` es un alias de disponibilidad, NO de launchability', () => {
    // Cuidado con este nombre: `canLaunchWorkspace` pregunta "¿está abierto?",
    // no "¿se lanza al público?". Es un nombre engañoso que este test congela
    // para que nadie lo use creyendo que implementa el eje C.
    expect(getWorkspaceStatus('medical')).toBe(WORKSPACE_STATUSES.PREVIEW);
    expect(canLaunchWorkspace('medical')).toBe(isWorkspaceAvailable('medical'));
  });
});

describe('Eje D · LAUNCHMODE declarado por el Registry', () => {
  it('el orchestrator conserva el launchMode registrado', () => {
    const registry = workspaceRegistry.workspaces;
    const preview = resolveWorkspaceDestination({
      registry,
      availableWorkspaces: ['medical'],
      entitlements: ['workspace.open.medical'],
    });
    expect(preview.workspaceKey).toBe('medical');
    expect(preview.launchMode).toBe('controlled');
    expect(preview.controlledAccess).toBe(true);

    const liveControlled = resolveWorkspaceDestination({
      registry: registry.map((workspace) => (
        workspace.key === 'legal'
          ? { ...workspace, launchMode: 'controlled' }
          : workspace
      )),
      availableWorkspaces: ['legal'],
      entitlements: ['workspace.open.legal'],
    });
    expect(liveControlled.launchMode).toBe('controlled');
    expect(liveControlled.controlledAccess).toBe(true);

    const live = resolveWorkspaceDestination({
      registry,
      availableWorkspaces: ['legal'],
      entitlements: ['workspace.open.legal'],
    });
    expect(live.launchMode).toBe('workspace');
  });

  it('preview con launchMode workspace falla cerrado', () => {
    const result = resolveWorkspaceDestination({
      registry: workspaceRegistry.workspaces.map((workspace) => (
        workspace.key === 'medical'
          ? { ...workspace, launchMode: 'workspace' }
          : workspace
      )),
      availableWorkspaces: ['medical'],
      entitlements: ['workspace.open.medical'],
    });
    expect(result).toEqual({ stayInSystem: true, reason: 'no_available_workspace' });
  });

  it('activation exige un launchMode declarado y compatible en el Registry', () => {
    const legal = workspaceRegistry.workspaces.find((workspace) => workspace.key === 'legal');
    const result = activateWorkspace({
      workspaceKey: 'legal',
      launchMode: 'controlled',
    }, {
      registry: [{ ...legal, launchMode: undefined }],
      entitlements: ['workspace.open.legal'],
    });
    expect(result).toEqual({ activated: false, reason: 'workspace_not_available' });
  });

  it('el catálogo no introduce los ejes bloqueados', () => {
    // Ninguna superficie que consume el frontend debe transportar
    // `launchMode`/`external` mientras D3/D4 sigan abiertas.
    BLOCKED_AXES.forEach((eje) => {
      expect(Object.keys(WORKSPACE_CATALOG[0])).not.toContain(eje);
    });
  });
});

describe('Deuda congelada · NO sincronizar sin decisión de producto', () => {
  it('`medical` sigue `preview` en el catálogo del frontend', () => {
    // El backend lo declara `declared`. Esa divergencia es INTENCIONAL y
    // requiere decisión de producto (qué vertical se abre y cuándo).
    expect(getWorkspaceStatus('medical')).toBe(WORKSPACE_STATUSES.PREVIEW);
  });

  it('`empresa` NO aparece en el catálogo del frontend', () => {
    // Congelamos también su AUSENCIA: nadie lo añade "para arreglar" el mapa.
    expect(getWorkspaceStatus('empresa')).toBeUndefined();
  });

  it('`legacy` sigue declarado y cerrado', () => {
    expect(getWorkspaceStatus('legacy')).toBe(WORKSPACE_STATUSES.DEPRECATED);
    expect(isWorkspaceAvailable('legacy')).toBe(false);
  });
});