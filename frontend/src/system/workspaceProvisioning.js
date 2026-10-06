import {
  canLaunchWorkspace,
  getWorkspace,
  getWorkspaceStatus,
} from './workspaceCatalog';
import { resolveWorkspaceEnrollment } from './workspaceEnrollment';

const OPEN_ENTITLEMENT = 'workspace.open.';

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

const hasContext = ({ systemContext, activeOrganization, userContext }) => (
  [systemContext, activeOrganization, userContext].some((value) => (
    value && typeof value === 'object' && Object.keys(value).length > 0
  ))
);

const hasEntitlement = (workspaceKey, entitlements) => {
  if (!Array.isArray(entitlements)) return false;
  return entitlements.some((entitlement) => {
    const value = typeof entitlement === 'string'
      ? entitlement
      : entitlement?.key || entitlement?.code || entitlement?.entitlement;
    return normalizeKey(value) === `${OPEN_ENTITLEMENT}${workspaceKey}`;
  });
};

const organizationAllowsWorkspace = (workspaceKey, activeOrganization) => {
  if (!activeOrganization || typeof activeOrganization !== 'object') return false;

  const directWorkspace = keyOf(
    activeOrganization.workspace
      || activeOrganization.workspaceKey
      || activeOrganization.workspace_key
      || activeOrganization.vertical
      || activeOrganization.verticalKey,
  );
  if (directWorkspace === workspaceKey) return true;

  const workspaces = Array.isArray(activeOrganization.workspaces)
    ? activeOrganization.workspaces
    : [];
  return workspaces.some((workspace) => keyOf(workspace) === workspaceKey);
};

const contextAllowsWorkspace = (workspaceKey, systemContext, userContext) => {
  const available = systemContext?.workspaces?.available;
  if (Array.isArray(available) && available.some((workspace) => keyOf(workspace) === workspaceKey)) {
    return true;
  }

  return keyOf(userContext?.workspace || userContext?.workspaceKey || userContext?.workspace_key)
    === workspaceKey;
};

const rejected = () => ({
  provisioned: false,
  reason: 'workspace_not_provisioned',
});

export function resolveWorkspaceProvisioning({
  workspaceKey,
  entitlements,
  systemContext,
  activeOrganization,
  userContext,
  subscription,
  plan,
  organization,
  lifecycle,
} = {}) {
  const normalizedKey = normalizeKey(workspaceKey);
  const workspace = getWorkspace(normalizedKey);
  if (!workspace || !canLaunchWorkspace(normalizedKey)) return rejected();
  if (!hasContext({ systemContext, activeOrganization, userContext })) return rejected();

  const hasEnrollmentInput = [subscription, plan, organization, lifecycle]
    .some((value) => value !== undefined);
  if (hasEnrollmentInput) {
    const enrollment = resolveWorkspaceEnrollment({
      workspace: normalizedKey,
      subscription,
      plan,
      organization: organization ?? activeOrganization,
      lifecycle,
      entitlements,
    });
    if (!enrollment.enrolled || !enrollment.launchAllowed) return rejected();
  }

  const hasAccess = hasEntitlement(normalizedKey, entitlements)
    || organizationAllowsWorkspace(normalizedKey, activeOrganization)
    || contextAllowsWorkspace(normalizedKey, systemContext, userContext);
  if (!hasAccess) return rejected();

  const status = getWorkspaceStatus(normalizedKey);
  if (status !== workspace.status) return rejected();

  return {
    provisioned: true,
    workspaceKey: normalizedKey,
    reason: 'workspace_available',
  };
}

export default resolveWorkspaceProvisioning;
