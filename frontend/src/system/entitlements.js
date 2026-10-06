/**
 * entitlements.js — FASE 5/6: derivación frontend de entitlements.
 *
 * Aditivo y compatible: no reemplaza systemEntryRules ni AuthContext.
 * Los entitlements se derivan del system-context (verticals/organizations)
 * con la misma prioridad que el backend (entitlement_service.py).
 * El rol queda como fallback legacy (admin->legal, investor->empresa).
 */

export const permissionFor = (spaceKey) => `workspace.open.${String(spaceKey || '').toLowerCase()}`;

export function selectEntitlements(context) {
  if (!context) return [];
  if (Array.isArray(context.entitlements)) return context.entitlements.filter(Boolean);
  const out = new Set();
  const verticals = context?.identity?.verticals || context?.verticals || [];
  verticals.forEach((v) => {
    if (typeof v === 'string' && v.trim()) out.add(permissionFor(v.trim()));
  });
  const orgs = context?.organizations || [];
  if (Array.isArray(orgs) && orgs.length > 0) out.add(permissionFor('empresa'));
  // Compat: workspaces.available del system-context también otorgan entitlement.
  const available = context?.workspaces?.available || [];
  available.forEach((s) => {
    const key = typeof s === 'string' ? s : s?.key;
    if (key) out.add(permissionFor(key));
  });
  return [...out];
}

export function hasEntitlement(entitlements, spaceKey) {
  if (!Array.isArray(entitlements)) return false;
  return entitlements.includes(permissionFor(spaceKey));
}

export function spaceKeyFromEntitlement(permission) {
  const prefix = 'workspace.open.';
  if (typeof permission !== 'string' || !permission.startsWith(prefix)) return null;
  return permission.slice(prefix.length);
}
