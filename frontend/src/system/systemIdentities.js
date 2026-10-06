/**
 * Identidades de Punto Cero System — estructura preparada (V1, solo declarativa).
 *
 * Las cuatro identidades del sistema, listas para cuando cada una tenga su
 * módulo propio:
 *
 *   Personal                 persona individual dentro de la comunidad One
 *   Profesional              ejerce una profesión con vertical (legal/medical/…)
 *   Empresa / Organización   pertenece o dirige una firma/empresa
 *   Agente                   opera en nombre de terceros (agencia, corretaje…)
 *
 * ⚠️ Alcance deliberadamente mínimo:
 * - NO autentica, NO crea usuarios, NO crea roles. Las identidades reales las
 *   determina el núcleo (`identity.account_type` + `organizations` + verticales).
 * - Este módulo solo describe cómo se presentará cada identidad y a qué espacio
 *   se orienta por defecto. `systemEntry.resolveIdentityType()` es quien clasifica.
 * - `defaultSpace` es una PISTA de navegación, no una decisión: la decisión final
 *   siempre la toma `workspaces.recommended` que devuelve el núcleo.
 */

import { SYSTEM_IDENTITY, SYSTEM_ROUTES, WORKSPACE_ROUTES } from './systemEntryRules';

export const SYSTEM_IDENTITIES = [
  {
    key: SYSTEM_IDENTITY.PERSONAL,
    label: 'Personal',
    description: 'Persona individual dentro de la comunidad Punto Cero One.',
    defaultSpace: SYSTEM_ROUTES.community,
    signInRoute: '/join',
    moduleStatus: 'available',
  },
  {
    key: SYSTEM_IDENTITY.PROFESSIONAL,
    label: 'Profesional',
    description: 'Ejerce una profesión con vertical propia (legal, medical, empresa).',
    defaultSpace: WORKSPACE_ROUTES.legal,
    signInRoute: '/login',
    moduleStatus: 'available',
  },
  {
    key: SYSTEM_IDENTITY.ORGANIZATION,
    label: 'Empresa / Organización',
    description: 'Pertenece a una firma o empresa y opera sus espacios de equipo.',
    defaultSpace: WORKSPACE_ROUTES.empresa,
    signInRoute: '/login',
    moduleStatus: 'coming_soon',
  },
  {
    key: SYSTEM_IDENTITY.AGENT,
    label: 'Agente',
    description: 'Opera en nombre de terceros: agencias, corretaje y representación.',
    defaultSpace: SYSTEM_ROUTES.community,
    signInRoute: '/login',
    moduleStatus: 'coming_soon',
  },
];

/** Devuelve la ficha declarativa de una identidad resuelta. Null si no existe. */
export const getIdentity = (identityKey) =>
  SYSTEM_IDENTITIES.find((i) => i.key === identityKey) || null;

/**
 * Espacio al que se orienta una identidad por defecto.
 * Uso previsto: UI informativa y futuras rutas por identidad. NO sustituye a
 * `systemEntry.resolveEntryPath()`, que sigue siendo la autoridad de navegación.
 */
export const defaultSpaceForIdentity = (identityKey) =>
  getIdentity(identityKey)?.defaultSpace || SYSTEM_ROUTES.community;

/**
 * Identidades cuyos módulos internos aún no existen. Se declaran aquí para que
 * la UI futura sepa qué mostrar como PRÓXIMAMENTE sin inventar rutas.
 */
export const COMING_SOON_IDENTITIES = SYSTEM_IDENTITIES
  .filter((i) => i.moduleStatus !== 'available')
  .map((i) => i.key);

export default SYSTEM_IDENTITIES;
