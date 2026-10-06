import { getWorkspace } from './workspaceRegistryService';
// D2.2-C.2 — antes este modulo declaraba `OPEN_STATUSES = new Set(['live',
// 'preview'])`, una copia literal de la frontera OPEN/CLOSED. La copia podia
// divergir en silencio y no normalizaba la entrada (no aceptaba 'LIVE').
//
// Ahora reutiliza `isWorkspaceStatusOpen`, la autoridad funcional que ya
// espeja `workspace_registry.derive_availability()`. Sin ciclo: ni
// `workspaceCatalog.js` ni `workspaceRegistryService.js` importan este modulo.
import { isWorkspaceStatusOpen } from './workspaceCatalog';

const ACTIVE_SUBSCRIPTIONS = new Set(['active', 'trial']);
const SUPPORTED_PLANS = new Set(['free', 'starter', 'professional', 'business', 'enterprise']);
const OPEN_ENTITLEMENT = 'workspace.open.';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const keyOf = (value) => {
  if (typeof value === 'string') return normalize(value);
  if (!value || typeof value !== 'object') return '';
  return normalize(
    value.workspaceKey
      || value.workspace_key
      || value.space_key
      || value.key
      || value.id
      || value.slug,
  );
};

const listKeys = (value) => {
  if (!Array.isArray(value)) return null;
  return value.map(keyOf).filter(Boolean);
};

const workspaceKeysFromPlan = (plan) => {
  if (Array.isArray(plan)) return listKeys(plan);
  if (!plan || typeof plan !== 'object') return null;
  return listKeys(plan.workspaces)
    || listKeys(plan.workspaceKeys)
    || listKeys(plan.allowedWorkspaces);
};

const workspaceKeysFromOrganization = (organization) => {
  if (!organization || typeof organization !== 'object') return null;
  const direct = keyOf(
    organization.workspace
      || organization.workspaceKey
      || organization.workspace_key,
  );
  if (direct) return [direct];
  return listKeys(organization.workspaces)
    || listKeys(organization.workspaceKeys)
    || listKeys(organization.allowedWorkspaces);
};

const subscriptionStatus = (subscription) => normalize(
  typeof subscription === 'string' ? subscription : subscription?.status,
);

const lifecycleStatus = (lifecycle) => normalize(
  typeof lifecycle === 'string' ? lifecycle : lifecycle?.status || lifecycle?.state,
);

const hasEntitlement = (workspaceKey, entitlements) => {
  if (!Array.isArray(entitlements)) return false;
  return entitlements.some((entitlement) => {
    const value = typeof entitlement === 'string'
      ? entitlement
      : entitlement?.key || entitlement?.code || entitlement?.entitlement;
    return normalize(value) === `${OPEN_ENTITLEMENT}${workspaceKey}`;
  });
};

const rejected = (reason) => ({
  enrolled: false,
  launchAllowed: false,
  reason,
});

export function resolveWorkspaceEnrollment(input = {}) {
  const values = input && typeof input === 'object' ? input : {};
  const {
    workspace,
    subscription,
    plan,
    organization,
    lifecycle,
    entitlements,
  } = values;
  const workspaceKey = keyOf(workspace);
  const catalogWorkspace = getWorkspace(workspaceKey);

  if (!workspaceKey || !catalogWorkspace) return rejected('workspace_not_found');

  const status = lifecycleStatus(lifecycle);
  // D2.2-C.2 — misma frontera que el resto del sistema. El resto de la
  // condicion (launchable/enabled) NO es frontera de lifecycle: es un corte
  // operativo explicito, asi que se deja intacto.
  if (!isWorkspaceStatusOpen(status) || lifecycle?.launchable === false || lifecycle?.enabled === false) {
    return rejected('lifecycle_incompatible');
  }

  const subscriptionState = subscriptionStatus(subscription);
  if (!ACTIVE_SUBSCRIPTIONS.has(subscriptionState)) {
    const subscriptionReasons = {
      expired: 'subscription_expired',
      cancelled: 'subscription_cancelled',
      suspended: 'subscription_suspended',
      pending: 'subscription_pending',
    };
    return rejected(subscriptionReasons[subscriptionState] || 'subscription_not_active');
  }

  const planName = normalize(typeof plan === 'string' ? plan : plan?.name || plan?.key);
  const planKeys = workspaceKeysFromPlan(plan);
  if (!planName || !SUPPORTED_PLANS.has(planName) || !planKeys?.includes(workspaceKey)) {
    return rejected('plan_workspace_not_allowed');
  }

  const organizationKeys = workspaceKeysFromOrganization(organization);
  if (organization && (!organizationKeys || !organizationKeys.includes(workspaceKey))) {
    return rejected('organization_workspace_not_allowed');
  }

  if (!hasEntitlement(workspaceKey, entitlements)) return rejected('entitlement_missing');

  return {
    enrolled: true,
    launchAllowed: true,
    reason: null,
  };
}

export default resolveWorkspaceEnrollment;
