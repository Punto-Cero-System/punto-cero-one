/**
 * Resolves the System destination after Universal Login.
 *
 * This module deliberately has no knowledge of routes, React, the browser, or
 * the Access Bridge.  It only turns the already-resolved access data into a
 * small, serializable decision.
 */

import { isWorkspaceStatusOpen } from './workspaceCatalog';
import { isWorkspaceLaunchModeAllowed } from './workspaceRegistry';

const OPEN_ENTITLEMENT = 'workspace.open.';

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const keyOf = (value) => {
  if (typeof value === 'string') return normalizeKey(value);
  if (!value || typeof value !== 'object') return '';
  return normalizeKey(value.workspaceKey || value.workspace_key || value.space_key || value.key || value.id || value.slug);
};

const asList = (value) => (Array.isArray(value) ? value : []);

const registryEntries = (registry) => {
  if (Array.isArray(registry)) return registry;
  if (!registry || typeof registry !== 'object') return [];
  return asList(registry.workspaces || registry.spaces || registry.items || registry.available);
};

const availableKeys = (availableWorkspaces) => {
  if (!Array.isArray(availableWorkspaces)) return null;
  return new Set(availableWorkspaces.map(keyOf).filter(Boolean));
};

const isExplicitlyUnavailable = (workspace) => (
  workspace?.available === false || workspace?.enabled === false || workspace?.isAvailable === false
);

const findWorkspace = (key, entries, allowedKeys) => {
  if (!key || (allowedKeys && !allowedKeys.has(key))) return null;

  const workspace = entries.find((entry) => keyOf(entry) === key);
  if (!workspace || isExplicitlyUnavailable(workspace)) return null;

  // D2.2-B.3-A — fail-closed. Antes era `workspace.status || 'live'`: un
  // workspace SIN status se asumia `live` y por tanto ABRIA, que es lo
  // contrario de lo que hace `policy_can.can()` con un estado desconocido.
  // Ahora un status ausente cierra. `isWorkspaceStatusOpen('')` es `false`, asi
  // que basta con dejar de mentirle al normalizador.
  const status = normalizeKey(workspace.status);
  if (!status || !isWorkspaceStatusOpen(status)) return null;
  const launchMode = normalizeKey(workspace.launchMode);
  if (!isWorkspaceLaunchModeAllowed(status, launchMode)) return null;

  return { workspace, workspaceKey: key, status, launchMode };
};

const decision = (match, reason) => ({
  stayInSystem: false,
  workspace: match.workspace,
  workspaceKey: match.workspaceKey,
  status: match.status,
  launchMode: match.launchMode,
  controlledAccess: match.launchMode === 'controlled',
  reason,
});

const entitlementWorkspaceKeys = (entitlements) => asList(entitlements)
  .map((entitlement) => {
    const value = typeof entitlement === 'string'
      ? entitlement
      : entitlement?.key || entitlement?.code || entitlement?.entitlement;
    const normalized = normalizeKey(value);
    return normalized.startsWith(OPEN_ENTITLEMENT)
      ? normalized.slice(OPEN_ENTITLEMENT.length)
      : '';
  })
  .filter(Boolean);

const recommendedWorkspaceKey = (systemContext) => keyOf(
  systemContext?.workspaces?.recommended
    || systemContext?.workspace?.recommended
    || systemContext?.recommendedWorkspace,
);

const organizationWorkspaceKey = (organization) => keyOf(
  organization?.workspace
    || organization?.workspaceKey
    || organization?.workspace_key
    || organization?.vertical
    || organization?.verticalKey,
);

/**
 * @param {object} input
 * @param {Array<string|object>} input.entitlements effective workspace entitlements
 * @param {Array<object>|object} input.registry workspace registry
 * @param {object} input.systemContext Universal Login system context
 * @param {object} input.activeOrganization active organization, if any
 * @param {Array<string|object>} input.availableWorkspaces workspaces available to this session
 * @returns {object} a destination decision; never performs navigation
 */
export function resolveWorkspaceDestination({
  entitlements,
  registry,
  systemContext,
  activeOrganization,
  availableWorkspaces,
} = {}) {
  const entries = registryEntries(registry);
  const allowedKeys = availableKeys(availableWorkspaces);

  for (const workspaceKey of entitlementWorkspaceKeys(entitlements)) {
    const match = findWorkspace(workspaceKey, entries, allowedKeys);
    if (match) return decision(match, 'active_entitlement');
  }

  const recommended = findWorkspace(recommendedWorkspaceKey(systemContext), entries, allowedKeys);
  if (recommended) return decision(recommended, 'system_recommendation');

  const organization = findWorkspace(organizationWorkspaceKey(activeOrganization), entries, allowedKeys);
  if (organization) return decision(organization, 'active_organization');

  for (const workspace of asList(availableWorkspaces)) {
    const match = findWorkspace(keyOf(workspace), entries, allowedKeys);
    if (match) return decision(match, 'available_workspace');
  }

  return { stayInSystem: true, reason: 'no_available_workspace' };
}
