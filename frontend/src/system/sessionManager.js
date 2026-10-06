/**
 * sessionManager.js — FASE 7.5: Ecosystem Session Manager.
 *
 * Único servicio que administra la sesión del ecosistema y centraliza TODA
 * la logica de lanzamiento de verticales.
 *
 * Estado mantenido:
 *   - user                usuario autenticado
 *   - session.active      sesión activa
 *   - entitlements        entitlements `workspace.open.*`
 *   - workspaces          workspaces disponibles (Workspace Registry)
 *   - activeVertical      vertical activa (ultima lanzada)
 *
 * Reglas de decision (SIEMPRE del Workspace Registry, via GET /api/access/spaces):
 *   - space.entry_url  -> URL externa de la vertical (UNICA fuente de dominios)
 *   - space.status     -> debe ser "live" para estar disponible
 *   - space.permission -> entitlement que exige la vertical
 * El frontend NO decide dominios, NO decide por roles, NO hardcodea nada.
 *
 * Deteccion de aperturas: cualquier parte de la app puede solicitar abrir una
 * vertical con `requestVertical`/`launchVertical` o emitiendo el evento
 * window `pcs:open-vertical` ({detail: {spaceKey}}); el manager resuelve,
 * pide el Access Intent y lanza, o devuelve null y el usuario PERMANECE en
 * Punto Cero System.
 *
 * NO modifica AuthContext, login, Identity Core, Access Bridge ni JWT.
 * Al Access Bridge unicamente se le solicita un intent (POST /api/access/intent).
 */
import { createIntent, fetchEntitlements, fetchSpaces } from './accessBridgeClient';

/** Evento window para solicitar la apertura de una vertical. */
export const VERTICAL_OPEN_EVENT = 'pcs:open-vertical';

const initialState = {
  user: null,
  session: { active: false },
  entitlements: [],
  workspaces: [],
  activeVertical: null,
};

let state = { ...initialState };
let hydrated = false;
let detectorStarted = false;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // Un listener roto nunca rompe el Session Manager.
    }
  });
};

const setState = (patch) => {
  state = { ...state, ...patch };
  notify();
};

/** Estado vigente de la sesión del ecosistema. */
export function getSessionState() {
  return state;
}

/** Suscripción a cambios de estado. Devuelve la función de baja. */
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function entryHost() {
  try {
    return window.location.host;
  } catch {
    return undefined;
  }
}

/**
 * Hidrata el estado de la sesión: usuario, bandera de sesión activa,
 * entitlements y workspaces (registry). Todo campo es opcional y los fallos
 * de red conservan el estado previo (nunca lanza).
 */
export async function hydrateSession({ user, token, entitlements, workspaces } = {}) {
  const patch = {};
  if (user !== undefined) patch.user = user;
  if (token !== undefined) patch.session = { active: Boolean(token) };
  if (entitlements !== undefined) {
    patch.entitlements = Array.isArray(entitlements) ? entitlements : [];
  }
  if (Object.keys(patch).length) setState(patch);

  if (workspaces !== undefined) {
    setState({ workspaces: Array.isArray(workspaces) ? workspaces : [] });
  } else {
    try {
      setState({ workspaces: (await fetchSpaces()).spaces || [] });
    } catch {
      // Registry inaccesible: se conserva el estado previo (inicial: []).
    }
  }

  if (entitlements === undefined) {
    try {
      setState({ entitlements: (await fetchEntitlements()).entitlements || [] });
    } catch {
      // Bridge de entitlements inaccesible: se conserva el estado previo.
    }
  }

  hydrated = true;
  startVerticalOpenDetector();
  return state;
}

/**
 * Espacio lanzable según el registry: con `entry_url`, `status: live` y
 * `permission`. El primer espacio del registry cuyo permission posea el
 * usuario gana. Devuelve el espacio o null.
 */
export function selectLaunchableSpace(workspaces, entitlements) {
  const spaces = Array.isArray(workspaces) ? workspaces : [];
  const rights = Array.isArray(entitlements) ? entitlements : [];
  for (const space of spaces) {
    if (!isLaunchable(space)) continue;
    if (!rights.includes(space.permission)) continue;
    return space;
  }
  return null;
}

/** Disponibilidad de lanzamiento — decidida 100% por el Workspace Registry. */
export function isLaunchable(space) {
  return Boolean(space && space.entry_url && space.permission && space.status === 'live');
}

/** Construye la URL final sobre la entry_url del registry (nunca un dominio propio). */
export function buildLaunchUrl(entryUrl, intentCode) {
  const base = String(entryUrl || '').replace(/[?&]$/, '');
  if (!base || !intentCode) return null;
  return `${base}${base.includes('?') ? '&' : '?'}intent=${encodeURIComponent(intentCode)}`;
}

function findSpace(spaceKey) {
  const key = String(spaceKey || '').trim().toLowerCase();
  return (
    state.workspaces.find((space) => String(space?.space_key || '').toLowerCase() === key) || null
  );
}

/**
 * Solicita el Access Intent para una vertical concreta.
 * Devuelve {spaceKey, url, intent} o null si la vertical no está disponible,
 * no se posee el entitlement o el Bridge no responde → permanecer en System.
 */
export async function requestVertical(spaceKey, context = {}) {
  if (!hydrated) {
    try {
      await hydrateSession({});
    } catch {
      // sin hidratación previa no hay decisiones que tomar.
    }
  }
  const space = findSpace(spaceKey);
  if (!isLaunchable(space) || !state.entitlements.includes(space.permission)) {
    return null;
  }
  try {
    const payload = await createIntent(space.space_key, {
      entry_host: entryHost(),
      ...context,
    });
    const code = payload?.intent?.intent_code;
    const url = buildLaunchUrl(space.entry_url, code);
    if (!url) return null;
    setState({ activeVertical: space.space_key });
    return { spaceKey: space.space_key, url, intent: payload.intent };
  } catch {
    // Intent denegado o Bridge caído: el usuario permanece en Punto Cero System.
    return null;
  }
}

/** Redirección al Core de la vertical (aislada para poder testearla). */
export function redirectToVertical(url) {
  window.location.assign(url);
}

/** Abre una vertical: requestVertical + lanzamiento. null → permanece en System. */
export async function launchVertical(spaceKey, context = {}) {
  const request = await requestVertical(spaceKey, context);
  if (!request) return null;
  redirectToVertical(request.url);
  return request.url;
}

/**
 * Lanzamiento automático post-login (o tras cualquier hidratación): elige la
 * vertical del registry para la que hay entitlement y la lanza.
 * Devuelve la URL o null (permanece en Punto Cero System).
 */
export async function launchSessionVertical(context = {}) {
  if (!hydrated) {
    try {
      await hydrateSession({});
    } catch {
      // sin hidratación previa no hay decisiones que tomar.
    }
  }
  const space = selectLaunchableSpace(state.workspaces, state.entitlements);
  if (!space) return null;
  return launchVertical(space.space_key, context);
}

function handleVerticalOpenRequest(event) {
  const detail = event?.detail;
  const spaceKey = typeof detail === 'string' ? detail : detail?.spaceKey || detail?.space_key;
  if (!spaceKey) return;
  const context =
    typeof detail === 'object' && detail?.context && typeof detail.context === 'object'
      ? detail.context
      : {};
  // Resolución asíncrona: si la vertical no está disponible devuelve null y
  // el usuario permanece en Punto Cero System (no hay navegación).
  launchVertical(spaceKey, context);
}

/**
 * Detector de solicitudes de apertura de verticales (idempotente).
 * Se inicia automáticamente en hydrateSession().
 */
export function startVerticalOpenDetector() {
  if (detectorStarted || typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener(VERTICAL_OPEN_EVENT, handleVerticalOpenRequest);
  detectorStarted = true;
}

