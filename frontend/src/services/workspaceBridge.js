/**
 * workspaceBridge.js — PUENTE DE DATOS: Punto Cero One → Core Legal OS.
 *
 * Punto Cero One sigue siendo la puerta de entrada y el proveedor de identidad.
 * Este servicio NO crea autenticación: reutiliza el `pcl_token` que ya emite
 * `AuthContext` (misma clave que usa el Core Legal) y solo consume su API.
 *
 * Alcance: clientes · casos · agenda · documentos · facturación · comunicaciones
 *         · Darwin IA. El Core Legal es el sistema operativo; aquí no hay lógica
 *         de negocio, solo transporte y normalización de forma.
 *
 * Ninguna función habla con el backend propio de One (`:8000`).
 */

import {
  adaptKpis, adaptClients, adaptCases, adaptAppointments,
  adaptDocuments, adaptInvoices, adaptMessages, adaptDarwin,
} from './coreLegalAdapter';

// Variable propia del puente. NO reutiliza REACT_APP_BACKEND_URL (comunidad One).
const BRIDGE_BASE = (
  process.env.REACT_APP_WORKSPACE_API || 'http://127.0.0.1:8001/api'
).replace(/\/+$/, '');

const TOKEN_KEY = 'pcl_token'; // misma clave que AuthContext y que el Core Legal

/** Token vigente. Devuelve '' si no hay sesión (nunca lanza). */
export const getBridgeToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

/** Error de dominio del puente, con el código HTTP para que la UI pueda decidir. */
export class BridgeError extends Error {
  constructor(message, status, path) {
    super(message);
    this.name = 'BridgeError';
    this.status = status;
    this.path = path;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Traduce los códigos HTTP del Core Legal a estados que la UI sabe mostrar.
 * 401 → sesión; 403 → sin permiso; 404 → módulo no disponible. Nunca rompe.
 */
const describeStatus = (status) => {
  if (status === 401) return 'Sesión no válida o expirada. Vuelve a iniciar sesión.';
  if (status === 403) return 'Tu rol no tiene permiso sobre este módulo.';
  if (status === 404) return 'Módulo no disponible en el Core Legal.';
  if (status >= 500) return 'El Core Legal no respondió correctamente.';
  return 'No se pudo completar la solicitud al Core Legal.';
};

/**
 * Llamada base al Core Legal. Reutiliza `pcl_token`, envía `Authorization: Bearer`
 * y devuelve el JSON ya normalizado. Lanza `BridgeError` con el status original.
 */
const bridgeFetch = async (path, { method = 'GET', body } = {}) => {
  const token = getBridgeToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BRIDGE_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new BridgeError('No hay conexión con el Core Legal (127.0.0.1:8001).', 0, path);
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = isPlainObject(data) ? data.detail : null;
    const message = typeof detail === 'string' ? detail : describeStatus(res.status);
    throw new BridgeError(message, res.status, path);
  }
  return data;
};

/* ══════════════════════════════════════════════════════════════════
   Capacidades del Core Legal OS — una función por módulo.
   Todas consumen :8001 y devuelven datos ya normalizados a One.
   ══════════════════════════════════════════════════════════════════ */

/** KPIs del dashboard operativo. */
export const getWorkspaceDashboard = () => bridgeFetch('/dashboard/kpis').then(adaptKpis);

/** Clientes del profesional. */
export const getClients = () => bridgeFetch('/clients/').then(adaptClients);

/** Casos / expedientes. */
export const getCases = () => bridgeFetch('/cases/').then(adaptCases);

/** Agenda: citas y reuniones. */
export const getAppointments = () => bridgeFetch('/appointments/').then(adaptAppointments);

/** Documentos del expediente. */
export const getDocuments = () => bridgeFetch('/documents/').then(adaptDocuments);

/** Facturación: facturas emitidas. */
export const getInvoices = () => bridgeFetch('/invoices/').then(adaptInvoices);

/** Comunicaciones: hilos de mensajes. */
export const getMessages = () => bridgeFetch('/messages/threads').then(adaptMessages);

/** Darwin IA: estado y última actividad. */
export const getDarwinStatus = () => bridgeFetch('/darwin/activity').then(adaptDarwin);

/**
 * Carga el resumen operativo del espacio de una sola vez.
 * Usa `Promise.allSettled`: un módulo caído (403/404) NO debe vaciar el resto
 * del dashboard. Cada sección llega con su propio estado.
 */
export const getWorkspaceSnapshot = async () => {
  const sections = [
    ['kpis', getWorkspaceDashboard, {}],
    ['clients', getClients, []],
    ['cases', getCases, []],
    ['appointments', getAppointments, []],
    ['documents', getDocuments, []],
    ['invoices', getInvoices, []],
    ['messages', getMessages, []],
    ['darwin', getDarwinStatus, { status: 'desconocido', operational: false, activities: 0 }],
  ];

  const results = await Promise.allSettled(sections.map(([, fn]) => fn()));

  return sections.reduce((acc, [key, , fallback], i) => {
    const r = results[i];
    if (r.status === 'fulfilled') {
      acc[key] = { data: r.value, error: null };
    } else {
      acc[key] = { data: fallback, error: r.reason?.message || 'Error desconocido' };
    }
    return acc;
  }, {});
};

export { BRIDGE_BASE };
