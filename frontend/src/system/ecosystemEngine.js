import workspaceRegistry from './workspaceRegistry';
// D2.2-C.2 — la frontera OPEN/CLOSED es la MISMA que decide si un workspace
// abre. Antes este modulo declaraba `VERTICAL_STATUSES = new Set(['live',
// 'preview'])`: una copia literal de la regla que ademas podia divergir en
// silencio (un Set asi no se normaliza, no acepta 'LIVE' ni ' live').
//
// Reutiliza `isWorkspaceStatusOpen`, que es la autoridad funcional y ya espeja
// `workspace_registry.derive_availability()`. Sin ciclo: `workspaceCatalog.js`
// no importa nada de aqui.
import { isWorkspaceStatusOpen } from './workspaceCatalog';

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

export function getEcosystem() {
  return workspaceRegistry;
}

export function listVerticals() {
  return workspaceRegistry.verticals;
}

export function getVertical(verticalKey) {
  const key = normalizeKey(verticalKey);
  return workspaceRegistry.verticals.find((vertical) => vertical.key === key);
}

export function workspaceBelongsToVertical(workspaceKey) {
  const key = normalizeKey(workspaceKey);
  return workspaceRegistry.verticals.some((vertical) => vertical.workspaces.includes(key));
}

export function listWorkspacesByVertical(verticalKey) {
  return getVertical(verticalKey)?.workspaces || [];
}

export function listAvailableVerticals() {
  // D2.2-C.2 — reutiliza la frontera canonica en vez de repetir el Set.
  return workspaceRegistry.verticals.filter((vertical) => isWorkspaceStatusOpen(vertical.status));
}

export function verticalExists(verticalKey) {
  return Boolean(getVertical(verticalKey));
}
