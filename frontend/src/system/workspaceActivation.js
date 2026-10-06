import { isWorkspaceStatusOpen } from './workspaceCatalog';
import { isWorkspaceLaunchModeAllowed } from './workspaceRegistry';
import { resolveWorkspaceProvisioning } from './workspaceProvisioning';

const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();

const keyOf = (value) => {
  if (typeof value === 'string') return normalizeKey(value);
  if (!value || typeof value !== 'object') return '';
  return normalizeKey(
    value.workspaceKey
      || value.workspace_key
      || value.space_key
      || value.key
      || value.id
      || value.slug,
  );
};

const registryEntries = (registry) => {
  if (Array.isArray(registry)) return registry;
  if (!registry || typeof registry !== 'object') return [];
  return Array.isArray(registry.workspaces)
    ? registry.workspaces
    : Array.isArray(registry.spaces)
      ? registry.spaces
      : Array.isArray(registry.items)
        ? registry.items
        : Array.isArray(registry.available)
          ? registry.available
          : [];
};

const isDisabled = (workspace, configuration) => (
  workspace?.available === false
  || workspace?.enabled === false
  || workspace?.isAvailable === false
  || workspace?.config?.enabled === false
  || configuration?.enabled === false
);

const cannotLaunch = (workspace, configuration) => (
  workspace?.launchable === false
  || workspace?.allowLaunch === false
  || workspace?.launchAllowed === false
  || workspace?.config?.launchable === false
  || workspace?.config?.allowLaunch === false
  || configuration?.launchable === false
  || configuration?.allowLaunch === false
);

const hasEntitlement = (workspace, workspaceKey, entitlements) => {
  if (!Array.isArray(entitlements)) return true;
  if (!workspace?.permission) return true;
  return entitlements.includes(workspace.permission)
    || entitlements.includes(`workspace.open.${workspaceKey}`);
};

const unavailable = () => ({ activated: false, reason: 'workspace_not_available' });

export function activateWorkspace(decision, options = {}) {
  if (!decision || typeof decision !== 'object') return unavailable();

  const normalizedOptions = Array.isArray(options) ? { registry: options } : options || {};
  const entries = registryEntries(normalizedOptions.registry);
  const workspaceKey = keyOf(decision.workspaceKey || decision.workspace_key);
  if (!workspaceKey) return unavailable();

  const workspace = entries.find((entry) => keyOf(entry) === workspaceKey);
  const configuration = normalizedOptions.configuration
    || normalizedOptions.config
    || workspace?.configuration
    || workspace?.config;
  if (
    !workspace
    || isDisabled(workspace, configuration)
    || cannotLaunch(workspace, configuration)
    || !hasEntitlement(workspace, workspaceKey, normalizedOptions.entitlements)
  ) {
    return unavailable();
  }

  // D2.2-B.3-C — fail-closed. Antes era `normalizeKey(workspace.status ||
  // decision.status)`: cuando el REGISTRO no declaraba status, se caia al
  // status de la decision y un workspace mal definido se activaba. El registry
  // es la autoridad del lifecycle, no la decision: la decision es la salida de
  // otro modulo y no puede imponer su status al catalogo.
  //
  // Un status ausente cierra. `isWorkspaceStatusOpen('')` es `false`, asi que
  // basta con dejar de rellenarlo, igual que hace `workspaceOrchestrator.js`.
  const status = normalizeKey(workspace.status);
  if (!status || !isWorkspaceStatusOpen(status)) return unavailable();
  const launchMode = normalizeKey(workspace.launchMode);
  if (!isWorkspaceLaunchModeAllowed(status, launchMode)) return unavailable();

  const hasProvisioningContext = [
    'systemContext',
    'activeOrganization',
    'userContext',
  ].some((key) => Object.prototype.hasOwnProperty.call(normalizedOptions, key));
  if (hasProvisioningContext) {
    const provisioning = resolveWorkspaceProvisioning({
      workspaceKey,
      entitlements: normalizedOptions.entitlements,
      systemContext: normalizedOptions.systemContext,
      activeOrganization: normalizedOptions.activeOrganization,
      userContext: normalizedOptions.userContext,
    });
    if (!provisioning.provisioned) return unavailable();
  }

  return {
    activated: true,
    workspaceKey,
    status,
    target: keyOf(decision.verticalKey) || keyOf(workspace.verticalKey) || workspaceKey,
  };
}

export default activateWorkspace;
