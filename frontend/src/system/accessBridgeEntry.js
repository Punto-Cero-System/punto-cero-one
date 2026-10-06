import { hasEntitlement, spaceKeyFromEntitlement } from './entitlements';

/**
 * accessBridgeEntry.js — FASE 4.4: ÚNICA fuente de decisión de acceso del
 * frontend (destino post-login y shell de workspace).
 *
 * CAMBIO ARQUITECTÓNICO (alinea el frontend con backend D1 + D2):
 *   - ANTES: `user.role === 'admin'` concedía el shell `/admin`, y
 *     `WorkspaceGatewayPage` recomendaba `legal` a cualquier admin.
 *   - AHORA: la decisión sale EXCLUSIVAMENTE de los `entitlements` que entrega
 *     el Access Bridge (`workspace.open.<space_key>`).
 *
 * `role` es capacidad técnica (admin, investor, member...), NO acceso. Un admin
 * sin `workspace.open.legal` ya no entra a Legal: lo que puede abrir es
 * exactamente lo que el backend autorizó.
 *
 * `status` NO se consulta aquí: el backend ya lo aplicó. Un usuario suspendido
 * recibe `entitlements: []` y por tanto `hasAccess: false` (estado seguro, sin
 * navegar). El frontend no reimplementa la política: solo la consume.
 *
 * Contrato HTTP sin cambios. Sin fetch. Sin efectos secundarios.
 */

/** Claves de espacio presentes en una lista de permisos del Bridge. */
export function spaceKeysFromEntitlements(entitlements) {
  if (!Array.isArray(entitlements)) return [];
  const out = [];
  entitlements.forEach((permission) => {
    const key = spaceKeyFromEntitlement(permission);
    if (key && !out.includes(key)) out.push(key);
  });
  return out;
}

/** Claves permitidas a partir de entitlements y/o de available_spaces. */
export function resolveAllowedSpaceKeys(entitlements, availableSpaces) {
  const fromEntitlements = spaceKeysFromEntitlements(entitlements);
  if (fromEntitlements.length > 0) return fromEntitlements;
  if (!Array.isArray(availableSpaces)) return [];
  return availableSpaces.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean);
}

/**
 * Resuelve el shell de acceso de un sujeto autenticado.
 *
 * @param {object|null} systemContext contexto del Identity Core
 * @param {string[]} entitlements     permisos `workspace.open.*` del Bridge
 * @param {object|null} user          se conserva por compatibilidad de firma;
 *                                    NO participa en la decisión
 * @returns {{path: string|null, spaceKey: string|null, hasAccess: boolean}}
 */
export function resolveAccessShell(systemContext, entitlements, user) {
  const allowed = resolveAllowedSpaceKeys(entitlements, null);

  // Sin permisos: estado seguro. No se navega a ninguna parte.
  if (allowed.length === 0) return { path: null, spaceKey: null, hasAccess: false };

  if (allowed.includes('empresa')) return { path: '/firm-os', spaceKey: 'empresa', hasAccess: true };
  if (allowed.includes('agente')) return { path: '/agent', spaceKey: 'agente', hasAccess: true };
  if (hasEntitlement(entitlements, 'legal') || allowed.includes('legal')) {
    return { path: '/workspace', spaceKey: 'legal', hasAccess: true };
  }
  if (hasEntitlement(entitlements, 'medical') || allowed.includes('medical')) {
    return { path: '/medical', spaceKey: 'medical', hasAccess: true };
  }
  return { path: '/portal', spaceKey: 'comunidad', hasAccess: true };
}

/**
 * Destino post-login. FUENTE UNICA de decisión para JoinPage y SystemEntry.
 *
 * Distingue dos situaciones que antes se confundían porque ambas daban
 * `entitlements: []`:
 *
 *   1. Bridge RESPONDIÓ y no autorizó nada (`status` suspendido/pendiente):
 *      devuelve `null`. El usuario no entra. Fail-closed. Es D1.
 *   2. Bridge NO PUDO consultarse (`entitlementsResolved: false`): devuelve
 *      `fallbackPath` (lo que el Identity Core recomienda). No se bloquea al
 *      usuario por una caída de red. Es la invariante que ya declaraba
 *      JoinPage: "el fallo de /api/access/* no debe impedir el acceso".
 *
 * En ambos casos se decide por entitlements, nunca por `role`.
 */
export function resolvePostLoginEntry(systemContext, entitlements, user, options = {}) {
  const { entitlementsResolved = true, fallbackPath = null } = options;
  const shell = resolveAccessShell(systemContext, entitlements, user);
  if (shell.hasAccess) return shell.path;
  if (!entitlementsResolved && fallbackPath) return fallbackPath;
  return null;
}

