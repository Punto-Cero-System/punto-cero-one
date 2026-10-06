export const WORKSPACE_STATUSES = Object.freeze({
  LIVE: 'live',
  PREVIEW: 'preview',
  DECLARED: 'declared',
  DEPRECATED: 'deprecated',
});

// D2.2-B.3-A — `available` y `coming_soon` NO son lifecycle. Son la
// DERIVACION de un lifecycle, y por eso se calcula en una sola funcion en vez
// de declararse en cada catalogo. Antes este archivo declaraba un flag
// `launchable` por entrada que reproducia exactamente la misma informacion que
// el status: era un segundo vocabulario disfrazado, y podia contradecir al
// status sin que nada lo notara.
//
// La frontera OPEN/CLOSED coincide con la que usa `policy_can.can()` en su
// paso 6 (`declared`/`deprecated` exigen `allow_non_live`), de modo que
// "disponible aqui" y "autorizado sin flag" dicen lo mismo.
//
// Se mantiene el mismo vocabulario de siempre: `live`/`preview` abren,
// `declared`/`deprecated` no. Un status ausente o desconocido CIERRA
// (fail-closed); ya no se asume `live`.
const OPEN_STATUSES = new Set([
  WORKSPACE_STATUSES.LIVE,
  WORKSPACE_STATUSES.PREVIEW,
]);

const CLOSED_STATUSES = new Set([
  WORKSPACE_STATUSES.DECLARED,
  WORKSPACE_STATUSES.DEPRECATED,
]);

const normalizeKey = (key) => String(key ?? '').trim().toLowerCase();

/**
 * Traduce un lifecycle a disponibilidad. Fail-closed.
 * `live`/`preview` -> 'open'; `declared`/`deprecated` -> 'closed';
 * ausente o desconocido -> 'closed'.
 *
 * Espeja `workspace_registry.derive_availability()` en el backend. Es una
 * proyeccion del eje canonico, no una fuente de verdad propia: el contrato test
 * compara ambas y falla si divergen.
 */
export function deriveAvailability(status) {
  const normalized = normalizeKey(status);
  if (OPEN_STATUSES.has(normalized)) return 'open';
  if (CLOSED_STATUSES.has(normalized)) return 'closed';
  return 'closed';
}

export function isWorkspaceStatusOpen(status) {
  return deriveAvailability(status) === 'open';
}

export const WORKSPACE_CATALOG = Object.freeze([
  { key: 'legal', name: 'Punto Cero Legal', status: WORKSPACE_STATUSES.LIVE },
  { key: 'medical', name: 'Punto Cero Medical', status: WORKSPACE_STATUSES.PREVIEW },
  { key: 'odontologia', name: 'Punto Cero Odontología', status: WORKSPACE_STATUSES.DECLARED },
  { key: 'psicologia', name: 'Punto Cero Psicología', status: WORKSPACE_STATUSES.DECLARED },
  { key: 'enfermeria', name: 'Punto Cero Enfermería', status: WORKSPACE_STATUSES.DECLARED },
  { key: 'legacy', name: 'Punto Cero Legacy', status: WORKSPACE_STATUSES.DEPRECATED },
]);

export function getWorkspace(key) {
  const normalizedKey = normalizeKey(key);
  return WORKSPACE_CATALOG.find((workspace) => workspace.key === normalizedKey);
}

export function getWorkspaceStatus(key) {
  return getWorkspace(key)?.status;
}

export function isWorkspaceAvailable(key) {
  return isWorkspaceStatusOpen(getWorkspaceStatus(key));
}

/**
 * Lanzable == disponible.
 *
 * Antes era `launchable && isWorkspaceAvailable(...)`, dos condiciones. El flag
 * `launchable` se elimino en D2.2-B.3-A porque era redundante con el status:
 * para las seis entradas sus valores coincidian exactamente con `OPEN_STATUSES`.
 *
 * Si producto necesitara restringir la apertura de un workspace `live` mas alla
 * de su lifecycle, ese es el hueco de D3 (`launchMode`), no un flag aqui.
 */
export function canLaunchWorkspace(key) {
  return isWorkspaceAvailable(key);
}

export default WORKSPACE_CATALOG;
