import {
  getEcosystem,
  getVertical,
  listAvailableVerticals,
  listVerticals,
  listWorkspacesByVertical,
  verticalExists,
  workspaceBelongsToVertical,
} from './ecosystemEngine';
import workspaceRegistry, { isWorkspaceLaunchModeAllowed } from './workspaceRegistry';
// D2.2-B.3-A — la frontera open/closed se lee de la derivacion canonica en
// lugar de reescribirse aqui. Sin ciclo: `workspaceCatalog.js` no importa nada.
// D2.2-C.2 — ademas se reutiliza `WORKSPACE_STATUSES` para los filtros por status
// concreto, eliminando la copia literal del vocabulario.
import { isWorkspaceStatusOpen, WORKSPACE_STATUSES } from './workspaceCatalog';

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const findWorkspace = (workspaceKey) => {
  const key = normalizeKey(workspaceKey);
  return workspaceRegistry.workspaces.find((workspace) => workspace.key === key);
};

const syncVerticalMembership = (workspaceKey, verticalKey, previousVerticalKey) => {
  const previousVertical = getVertical(previousVerticalKey);
  const nextVertical = getVertical(verticalKey);

  if (previousVertical && previousVertical !== nextVertical) {
    previousVertical.workspaces = previousVertical.workspaces.filter((key) => key !== workspaceKey);
  }
  if (nextVertical && !nextVertical.workspaces.includes(workspaceKey)) {
    nextVertical.workspaces.push(workspaceKey);
  }
  // Fix FASE OMEGA: `ecosystem` quedo fuera de alcance tras el rename a
  // workspaceRegistry; la sincronizacion devuelve el registro actualizado.
  return workspaceRegistry;
};

export function registerWorkspace(workspace) {
  if (!workspace || typeof workspace !== 'object') return undefined;
  const key = normalizeKey(workspace.key || workspace.workspaceKey);
  const verticalKey = normalizeKey(workspace.verticalKey || workspace.vertical);
  if (!key || !verticalExists(verticalKey) || findWorkspace(key)) return undefined;

  const registered = { ...workspace, key, verticalKey };
  workspaceRegistry.workspaces.push(registered);
  syncVerticalMembership(key, verticalKey);
  return registered;
}

export function updateWorkspace(workspaceKey, changes = {}) {
  const workspace = findWorkspace(workspaceKey);
  if (!workspace || !changes || typeof changes !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(changes, 'launchMode')) {
    const status = Object.prototype.hasOwnProperty.call(changes, 'status')
      ? changes.status
      : Object.prototype.hasOwnProperty.call(changes, 'lifecycle')
        ? changes.lifecycle
        : workspace.status;
    if (!isWorkspaceLaunchModeAllowed(status, changes.launchMode)) return undefined;
  }

  const previousKey = workspace.key;
  const previousVerticalKey = workspace.verticalKey;
  const nextKey = normalizeKey(changes.key || changes.workspaceKey || previousKey);
  const nextVerticalKey = normalizeKey(changes.verticalKey || changes.vertical || previousVerticalKey);
  if (!nextKey || !verticalExists(nextVerticalKey)) return undefined;
  if (nextKey !== previousKey && findWorkspace(nextKey)) return undefined;

  Object.assign(workspace, changes, { key: nextKey, verticalKey: nextVerticalKey });
  if (nextKey !== previousKey) {
    const previousVertical = getVertical(previousVerticalKey);
    if (previousVertical) {
      previousVertical.workspaces = previousVertical.workspaces.map((key) => (
        key === previousKey ? nextKey : key
      ));
    }
  }
  syncVerticalMembership(nextKey, nextVerticalKey, previousVerticalKey);
  return workspace;
}

export function removeWorkspace(workspaceKey) {
  const workspace = findWorkspace(workspaceKey);
  if (!workspace) return undefined;

  const ecosystem = workspaceRegistry;
  const index = ecosystem.workspaces.indexOf(workspace);
  ecosystem.workspaces.splice(index, 1);
  const vertical = getVertical(workspace.verticalKey);
  if (vertical) vertical.workspaces = vertical.workspaces.filter((key) => key !== workspace.key);
  return workspace;
}

export function enableWorkspace(workspaceKey) {
  return updateWorkspace(workspaceKey, { enabled: true, state: 'enabled' });
}

export function disableWorkspace(workspaceKey) {
  return updateWorkspace(workspaceKey, { enabled: false, state: 'disabled' });
}

export function changeWorkspaceState(workspaceKey, state) {
  return updateWorkspace(workspaceKey, { state });
}

export function changeLaunchMode(workspaceKey, launchMode) {
  return updateWorkspace(workspaceKey, { launchMode });
}

export function changeLifecycle(workspaceKey, lifecycle) {
  return updateWorkspace(workspaceKey, { lifecycle, status: lifecycle });
}

export function getRegistry() {
  return getEcosystem();
}

export function listRegistry() {
  return workspaceRegistry.workspaces;
}

export function listWorkspaces() {
  return workspaceRegistry.workspaces;
}

export function listAvailableWorkspaces() {
  // D2.2-B.3-A — antes era `enabled !== false && ['live','preview'].includes(status)`:
  // una COPIA del vocabulario de lifecycle escrita a mano en este modulo. Se
  // sustituye por la derivacion compartida, de modo que la frontera
  // open/closed esta escrita en un unico sitio y no puede divergir de
  // `workspaceCatalog`.
  return workspaceRegistry.workspaces.filter((workspace) => (
    workspace.enabled !== false && isWorkspaceStatusOpen(workspace.status)
  ));
}

// D2.2-C.2 — estas tres funciones NO son la frontera OPEN/CLOSED: cada una
// pide UN status concreto, no "abierto o cerrado". Por eso no se resuelven con
// `isWorkspaceStatusOpen` (que solo distingue abierto de cerrado) sino con una
// igualdad normalizada contra el vocabulario canonico.
//
// Antes comparaban contra literales crudos (`workspace.status === 'live'`), lo
// que hacia que estas funciones NO normalizaran la entrada: un status con
// mayusculas o espacios devolvia una lista vacia en silencio. Se conserva
// exactamente el mismo conjunto de resultados para las entradas que ya
// funcionaban, y se elimina la copia del vocabulario.
const listByStatus = (status) => workspaceRegistry.workspaces.filter(
  (workspace) => normalizeKey(workspace.status) === normalizeKey(status),
);

export function listLiveWorkspaces() {
  return listByStatus(WORKSPACE_STATUSES.LIVE);
}

export function listPreviewWorkspaces() {
  return listByStatus(WORKSPACE_STATUSES.PREVIEW);
}

export function listDeclaredWorkspaces() {
  return listByStatus(WORKSPACE_STATUSES.DECLARED);
}

export function workspaceExists(workspaceKey) {
  return Boolean(findWorkspace(workspaceKey));
}

export function getWorkspace(workspaceKey) {
  return findWorkspace(workspaceKey);
}

export function listStates() {
  return [...new Set(listRegistry().map((workspace) => workspace.lifecycle))].filter(Boolean);
}

export {
  getEcosystem,
  listVerticals,
  getVertical,
  workspaceBelongsToVertical,
  listWorkspacesByVertical,
  listAvailableVerticals,
  verticalExists,
};

export default {
  getEcosystem,
  getRegistry,
  listVerticals,
  getVertical,
  workspaceBelongsToVertical,
  listWorkspacesByVertical,
  listAvailableVerticals,
  verticalExists,
  registerWorkspace,
  updateWorkspace,
  removeWorkspace,
  enableWorkspace,
  disableWorkspace,
  changeWorkspaceState,
  changeLaunchMode,
  changeLifecycle,
  listRegistry,
  listWorkspaces,
  listAvailableWorkspaces,
  listLiveWorkspaces,
  listPreviewWorkspaces,
  listDeclaredWorkspaces,
  workspaceExists,
  getWorkspace,
  listStates,
};
