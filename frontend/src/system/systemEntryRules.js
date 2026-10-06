/**
 * System Entry — decisión única de destino de Punto Cero System (REGLAS).
 *
 * NOTA de nomenclatura: este módulo se llama `systemEntryRules.js` y el
 * componente `SystemEntry.jsx`. NO pueden llamarse `systemEntry.js` y
 * `SystemEntry.jsx`: en Windows (FS case-insensitive) y por el orden de
 * resolución de webpack/jest (`.js` antes de `.jsx`), un import
 * `./system/SystemEntry` devolvería estas reglas en lugar del componente.
 *
 * FUENTE ÚNICA DE VERDAD (frontend) para traducir la respuesta del Identity Core
 * (`GET /api/auth/system-context`) a una ruta navegable.
 *
 * ⚠️ Reglas de esta capa:
 * - Es PURA: no hace fetch, no toca localStorage, no usa React.
 * - NO autentica: la sesión (`pcl_token` / `pcl_user`) la gobierna `AuthContext`.
 * - NO crea usuarios, roles ni identidades nuevas: solo lee lo que devuelve el núcleo.
 * - Único lugar del frontend donde se decide el destino post-login. Ningún
 *   componente debe volver a hardcodear `legal → /workspace/legal`.
 *
 * Contrato consumido (`system-context`):
 * {
 *   user: { id, email, name },
 *   session: { sources: [], unified: bool },
 *   identity: { account_type, verticals: [], primary_vertical, profile_ref },
 *   organizations: [ { id, name, role, relation, ... } ],
 *   workspaces: { available: [{key,label}], coming_soon: [{key,label}],
 *                 recommended, recommended_reason }
 * }
 */

/** Identidades soportadas por Punto Cero System (nomenclatura de producto). */
export const SYSTEM_IDENTITY = {
  PERSONAL: 'personal',
  PROFESSIONAL: 'profesional',
  ORGANIZATION: 'organizacion',
  AGENT: 'agente',
};

/** Rutas de workspace ya existentes en App.js. */
export const WORKSPACE_ROUTES = {
  legal: '/workspace/legal',
  medical: '/workspace/medical',
  empresa: '/workspace/empresa',
};

/** Destinos que no son workspace de vertical. */
export const SYSTEM_ROUTES = {
  community: '/',
  admin: '/admin',
  investor: '/investor-portal',
};

/**
 * Normaliza el `account_type` del núcleo a la identidad de producto.
 * Acepta tanto el vocabulario del núcleo (`personal`, `profesional`,
 * `organizacion`, `empresa`, `agente`) como variantes con acento/mayúsculas.
 */
export const resolveIdentityType = (systemContext) => {
  const identity = systemContext?.identity || {};
  const raw = String(identity.account_type || '').trim().toLowerCase();
  const organizations = Array.isArray(systemContext?.organizations) ? systemContext.organizations : [];

  if (raw === 'agente' || raw === 'agent' || raw === 'agencia') return SYSTEM_IDENTITY.AGENT;
  if (raw === 'empresa' || raw === 'organizacion' || raw === 'organización' || raw === 'organization') {
    return SYSTEM_IDENTITY.ORGANIZATION;
  }
  if (raw === 'profesional' || raw === 'professional') return SYSTEM_IDENTITY.PROFESSIONAL;
  if (raw === 'personal' || raw === 'persona') return SYSTEM_IDENTITY.PERSONAL;

  // Sin `account_type` explícito el núcleo no clasificó: se infiere sin inventar datos.
  if (organizations.length > 0) return SYSTEM_IDENTITY.ORGANIZATION;
  const verticals = Array.isArray(identity.verticals) ? identity.verticals : [];
  if (verticals.length > 0) return SYSTEM_IDENTITY.PROFESSIONAL;
  return SYSTEM_IDENTITY.PERSONAL;
};

/** Verticales activas del núcleo (normalizadas, sin duplicados). */
export const resolveVerticals = (systemContext) => {
  const raw = systemContext?.identity?.verticals;
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean))];
};

/** Roles/relaciones del usuario dentro de sus organizaciones (lectura, sin mutar). */
export const resolveOrganizationRoles = (systemContext) => {
  const orgs = Array.isArray(systemContext?.organizations) ? systemContext.organizations : [];
  return [...new Set(orgs.map((o) => String(o?.relation || o?.role || '').trim().toLowerCase()).filter(Boolean))];
};
/** Rutas que el núcleo puede recomendar (workspaces por vertical + comunidad). */
export const RECOMMENDED_ROUTES = {
  ...WORKSPACE_ROUTES,
  comunidad: SYSTEM_ROUTES.community,
};

/**
 * Resuelve la ruta del workspace a partir del catálogo del núcleo.
 * Regla de autoridad: `workspaces.recommended` decide. Si el recomendado es un
 * workspace disponible con ruta conocida → esa ruta. Si el núcleo no recomienda
 * nada, se cae a la primera vertical activa y, en último término, a la comunidad.
 */
export const resolveWorkspacePath = (systemContext) => {
  const workspaces = systemContext?.workspaces || {};
  const available = Array.isArray(workspaces.available) ? workspaces.available : [];
  const availableKeys = available.map((w) => String(w?.key || '').toLowerCase());
  const recommended = String(workspaces.recommended || '').toLowerCase();

  // `recommended` es autoridad: se respeta siempre, incluida la comunidad (`/`),
  // aunque el núcleo marque el módulo como no disponible.
  if (recommended && RECOMMENDED_ROUTES[recommended]) return RECOMMENDED_ROUTES[recommended];

  // Fallback 1: primera vertical activa que sea workspace conocido y esté disponible.
  const verticals = resolveVerticals(systemContext);
  const verticalMatch = verticals.find(
    (v) => WORKSPACE_ROUTES[v] && (availableKeys.length === 0 || availableKeys.includes(v)),
  );
  if (verticalMatch) return WORKSPACE_ROUTES[verticalMatch];

  // Fallback 2: cualquier workspace disponible con ruta conocida.
  const availableMatch = availableKeys.find((k) => WORKSPACE_ROUTES[k]);
  if (availableMatch) return WORKSPACE_ROUTES[availableMatch];

  // Última red: la comunidad de Punto Cero One (destino por defecto del sistema).
  return SYSTEM_ROUTES.community;
};

/**
 * Destino de entrada del sistema: un único router de decisión.
 *
 * @param {object|null} systemContext respuesta de `/api/auth/system-context`
 * @param {object} [options]
 * @param {string} [options.force]   destino forzado (equivalente a `redirectTo`)
 * @param {boolean} [options.isAdmin] hubo login por consola admin
 * @param {boolean} [options.isInvestor] rol inversor (portal propio)
 * @returns {string} ruta navegable
 */
export const resolveEntryPath = (systemContext, options = {}) => {
  const { force, isAdmin = false, isInvestor = false } = options;

  if (force) return force;
  if (isInvestor) return SYSTEM_ROUTES.investor;
  if (isAdmin) return SYSTEM_ROUTES.admin;
  if (!systemContext) return SYSTEM_ROUTES.community;

  // El Core Legal (:8001) entrega el workspace YA resuelto en `path`; es la
  // autoridad maxima del destino. Si viene, se navega ahi sin recalcular y
  // NUNCA se cae a comunidad cuando el Core Legal resolvio una vertical.
  if (typeof systemContext.path === 'string' && systemContext.path.startsWith('/')) {
    return systemContext.path;
  }
  return resolveWorkspacePath(systemContext);
};

/**
 * Resumen legible de la identidad resuelta (para UI y para depuración local).
 * No decide nada por sí mismo: es una proyección de `resolveEntryPath`.
 */
export const describeEntry = (systemContext, options = {}) => {
  const identityType = resolveIdentityType(systemContext);
  const verticals = resolveVerticals(systemContext);
  return {
    identityType,
    verticals,
    organizationRoles: resolveOrganizationRoles(systemContext),
    recommended: systemContext?.workspaces?.recommended || null,
    path: resolveEntryPath(systemContext, options),
  };
};

/**
 * Resuelve el destino usando el Identity Contract del Access Bridge.
 *
 * FASE 3B. `accessContext` proviene de `GET /api/access/entitlements`
 * (Identity Core → `identity.available_spaces`). Es la MISMA identidad que
 * usa el backend para autorizar: el frontend no recalcula permisos.
 *
 * Casos (regla de negocio):
 *   · 0 espacios  → 'select'  (mostrar selector; NO se rompe la sesión)
 *   · 1 espacio   → 'redirect' con la ruta del catálogo
 *   · >1 espacios → 'select'
 *
 * `resolvePath` traduce una clave de espacio a ruta usando el catálogo
 * existente. No se inventan rutas.
 *
 * @param {object|null} accessContext  salida de `normalizeAccessContext`
 * @param {(key:string)=>string} [resolvePath]
 * @returns {{action:'redirect'|'select', path?:string, spaces:string[]}}
 */
export const resolveEntryFromAccess = (accessContext, resolvePath) => {
  const spaces = Array.isArray(accessContext?.availableSpaces) ? accessContext.availableSpaces : [];
  const toPath = typeof resolvePath === 'function' ? resolvePath : (key) => key;

  if (spaces.length === 0) return { action: 'select', spaces };
  if (spaces.length === 1) return { action: 'redirect', path: toPath(spaces[0]), spaces };
  return { action: 'select', spaces };
};

export default resolveEntryPath;
