/**
 * coreLegalAdapter.js — ADAPTADOR DE DATOS: Core Legal → Punto Cero One.
 *
 * El Core Legal (`:8001`) responde en snake_case y con envoltorios heterogéneos
 * (arrays sueltos, `{items}`, `{data}`, objetos planos o `null`). Este módulo
 * normaliza esas respuestas al vocabulario de One, en el FRONTEND.
 *
 * NO modifica el backend ni sus contratos: solo traduce la forma de la respuesta.
 * Es puro: sin React, sin fetch, sin efectos, sin estado.
 */

/** `client_name` → `clientName`; `_id` → `id`; ya-camelCase no se toca. */
export const snakeToCamel = (key) => {
  const raw = String(key ?? '');
  if (raw === '_id') return 'id';
  if (raw === 'id') return 'id';
  return raw.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Convierte recursivamente las claves de un objeto/array a camelCase. */
export const camelizeKeys = (value) => {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (!isPlainObject(value)) return value;
  return Object.entries(value).reduce((acc, [k, v]) => {
    acc[snakeToCamel(k)] = camelizeKeys(v);
    return acc;
  }, {});
};

/**
 * Normaliza cualquier envoltorio de Colección a array.
 * Acepta: array, `{items}`, `{data}`, `{results}`, `{docs}`, `{threads}` o null.
 */
export const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!isPlainObject(payload)) return [];
  const candidate = payload.items ?? payload.data ?? payload.results ?? payload.docs ?? payload.threads;
  return Array.isArray(candidate) ? candidate : [];
};

const str = (v) => (v === null || v === undefined ? '' : String(v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Fecha ISO o `YYYY-MM-DD` → texto legible corto. Nunca lanza. */
export const humanDate = (value) => {
  const raw = str(value);
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Marca `_id` como `id` sin perder el resto de la entidad. */

/** `/api/dashboard/kpis` → objeto plano camelCase. */
export const adaptKpis = (payload) => camelizeKeys(isPlainObject(payload) ? payload : {});

/** `/api/clients/` → lista de clientes. */
export const adaptClients = (payload) => toList(payload).map((raw) => {
  const c = withId(raw);
  return {
    id: c.id,
    name: str(c.name || c.fullName || c.clientName),
    email: str(c.email),
    phone: str(c.phone),
    country: str(c.country),
    city: str(c.city),
    status: str(c.status || 'active'),
    cases: num(c.cases),
    documents: num(c.documents),
    registerDate: humanDate(c.registerDate || c.createdAt),
  };
});

/** `/api/cases/` → lista de casos. */
export const adaptCases = (payload) => toList(payload).map((raw) => {
  const c = withId(raw);
  return {
    id: c.id,
    caseNumber: str(c.caseNumber),
    title: str(c.title),
    clientName: str(c.clientName),
    clientId: str(c.clientId),
    status: str(c.status || 'active'),
    caseType: str(c.caseType),
    startDate: humanDate(c.startDate || c.createdAt),
    updatedAt: humanDate(c.updatedAt),
  };
});

/** `/api/appointments/` → lista de citas de la agenda. */
export const adaptAppointments = (payload) => toList(payload).map((raw) => {
  const a = withId(raw);
  return {
    id: a.id,
    title: str(a.title),
    clientName: str(a.clientName),
    date: humanDate(a.date || a.startTime),
    time: str(a.time || a.startTime).includes('T') ? str(a.startTime).split('T')[1]?.slice(0, 5) : str(a.time),
    eventType: str(a.eventType),
    status: str(a.status || 'scheduled'),
  };
});

/** `/api/documents/` → lista de documentos. */
export const adaptDocuments = (payload) => toList(payload).map((raw) => {
  const d = withId(raw);
  return {
    id: d.id,
    name: str(d.name || d.originalFilename || d.fileName),
    category: str(d.category),
    vertical: str(d.vertical),
    size: num(d.size),
    uploadedAt: humanDate(d.uploadedAt || d.createdAt),
  };
});

/** `/api/invoices/` → lista de facturas. */
export const adaptInvoices = (payload) => toList(payload).map((raw) => {
  const i = withId(raw);
  return {
    id: i.id,
    number: str(i.number || i.invoiceNumber),
    clientName: str(i.clientName),
    amount: num(i.amount ?? i.total),
    currency: str(i.currency || 'COP'),
    status: str(i.status || 'pending'),
    issuedAt: humanDate(i.issuedAt || i.createdAt),
  };
});

/** `/api/messages/threads` → lista de hilos. */
export const adaptMessages = (payload) => toList(payload).map((raw) => {
  const t = withId(raw);
  return {
    id: t.id,
    subject: str(t.subject || t.title),
    participant: str(t.participant || t.participantName),
    lastMessageAt: humanDate(t.lastMessageAt),
    unread: num(t.unread ?? t.unreadCount) > 0,
  };
});

/** `/api/darwin/activity` → estado resumido de Darwin IA. */
export const adaptDarwin = (payload) => {
  const d = isPlainObject(payload) ? payload : {};
  const activity = toList(d.activity);
  return {
    status: str(d.status) || 'desconocido',
    operational: str(d.status) === 'operational',
    activities: activity.length,
    lastAction: activity.length ? str(activity[0].action) : null,
    lastExecutedAt: activity.length ? humanDate(activity[0].executedAt) : null,
    organizationId: str(d.organizationId),
  };
};

export default {
  snakeToCamel, camelizeKeys, toList, humanDate,
  adaptKpis, adaptClients, adaptCases, adaptAppointments,
  adaptDocuments, adaptInvoices, adaptMessages, adaptDarwin,
};

const withId = (raw) => ({ id: str(raw?._id ?? raw?.id), ...camelizeKeys(raw) });
