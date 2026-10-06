/**
 * accessContext.js — FASE 3B: cliente del Identity Contract del Access Bridge.
 *
 * Consume el endpoint EXISTENTE `GET /api/access/entitlements`. No crea
 * endpoints ni cambia contratos del backend.
 *
 * Responsabilidades (y solo estas):
 *   · enviar el JWT ya emitido por el login;
 *   · leer `identity.available_spaces` que devolvió Identity Core;
 *   · normalizar a `[]` cuando el Bridge aún no expone el bloque `identity`.
 *
 * NO calcula permisos, NO decide destinos, NO emite tokens.
 * La decisión de destino vive en `systemEntryRules.resolveEntryPath`.
 *
 * Fallo de red o de identidad: devuelve `null`. Nunca inventa espacios.
 */

const API = process.env.REACT_APP_BACKEND_URL || '';

const EMPTY = Object.freeze({
  subjectId: null,
  entityId: null,
  system: null,
  identityType: null,
  availableSpaces: [],
  entitlements: [],
});

/** Normaliza la respuesta del Bridge. Tolerante: nunca lanza. */
export function normalizeAccessContext(payload) {
  if (!payload || typeof payload !== 'object') return { ...EMPTY };

  const identity = payload.identity && typeof payload.identity === 'object' ? payload.identity : {};
  const spaces = Array.isArray(identity.available_spaces) ? identity.available_spaces : [];
  const entitlements = Array.isArray(payload.entitlements) ? payload.entitlements : [];

  return {
    subjectId: payload.subject_id || null,
    entityId: identity.entity_id || null,
    system: identity.system || null,
    identityType: identity.identity_type || null,
    // Sin duplicados y en el orden que entrega Identity Core.
    availableSpaces: spaces.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()),
    entitlements: entitlements.filter((e) => typeof e === 'string' && e.trim()),
  };
}

/**
 * Consulta el contexto de acceso del usuario autenticado.
 * @param {string} token JWT ya emitido por `POST /api/auth/login`
 * @returns {Promise<object|null>} contexto normalizado, o null si no hay identidad
 */
export async function getAccessContext(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${API}/api/access/entitlements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return normalizeAccessContext(await res.json());
  } catch {
    // El Bridge puede no estar disponible: la sesión sigue siendo válida.
    return null;
  }
}

/** Contextos que suman rutas de navegación, para tests y depuración. */
export { EMPTY as EMPTY_ACCESS_CONTEXT };
