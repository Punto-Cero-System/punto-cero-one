/**
 * Workspace Spaces — catalogo del selector universal de Punto Cero System.
 *
 * Fuente unica de verdad para los espacios que ofrece /workspace.
 * Este catalogo es SOLO de navegacion: declara donde vive cada espacio y si ya
 * es alcanzable. No hace fetch, no tiene efectos secundarios y no aplica presets.
 *
 * Campos:
 * - key       → identificador estable usado en rutas/testids (NO renombrar sin migracion).
 * - emoji     → icono mostrado en la tarjeta del Gateway.
 * - label     → nombre visible del espacio.
 * - presetId  → mapea a un preset de `services/workspacePresets.js`.
 *               Todavia NO se aplica (el Gateway no invoca applyPreset) — reservado
 *               para la fase en que cada espacio tenga su propio layout.
 * - vertical  → mapea al query param ya soportado por el backend:
 *               `GET /api/companies?vertical=<x>` (ver company_routes.py).
 * - path      → destino de navegacion.
 * - status    → 'available'   el espacio esta operativo, la tarjeta navega.
 *               'coming_soon' el espacio esta anunciado, la tarjeta NO navega.
 *               'external'    vive fuera del Workspace (Comunidad Punto Cero One).
 */

export const SPACE_STATUS = {
  AVAILABLE: 'available',
  COMING_SOON: 'coming_soon',
  EXTERNAL: 'external',
};

export const COMING_SOON_LABEL = 'PRÓXIMAMENTE';

export const WORKSPACE_SPACES = [
  {
    key: 'legal',
    emoji: '⚖️',
    label: 'Legal',
    presetId: 'legal',
    vertical: 'legal',
    path: '/workspace/legal',
    status: SPACE_STATUS.AVAILABLE,
    description: 'Feed jurídico, IA legal y empresas del sector.',
  },
  {
    key: 'medical',
    emoji: '🏥',
    label: 'Medical',
    presetId: 'health',
    vertical: 'health',
    path: '/workspace/medical',
    status: SPACE_STATUS.COMING_SOON,
    description: 'Salud & bienestar: noticias, eventos y profesionales.',
  },
  {
    key: 'empresa',
    emoji: '🏢',
    label: 'Empresa',
    presetId: 'empresa',
    vertical: 'empresa',
    path: '/workspace/empresa',
    status: SPACE_STATUS.COMING_SOON,
    description: 'Todo lo que una empresa activa necesita en un vistazo.',
  },
  {
    key: 'comunidad',
    emoji: '🌎',
    label: 'Comunidad One',
    presetId: null,
    vertical: 'one',
    path: '/join',
    status: SPACE_STATUS.EXTERNAL,
    description: 'Comunidad Punto Cero One. Un clic y ya eres parte.',
  },
];

/** Busca un espacio por su `key`. Devuelve null si no existe. */
export const getSpace = (key) => WORKSPACE_SPACES.find((s) => s.key === key) || null;
