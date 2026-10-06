/**
 * Workspace Identity — capa de configuración de Mi Espacio por identidad.
 *
 * QUÉ ES
 * Un único Workspace adaptable por identidad. NO son dashboards separados:
 * los tres perfiles comparten el mismo WorkspaceContext, el mismo registro
 * de widgets, el mismo drag & drop y el mismo autosave. Lo único que cambia
 * es el orden inicial, los widgets recomendados, los textos y el acento.
 *
 * POR QUÉ NO SE USA `user.role`
 * `backend/models.py` (FASE 4.3.1 / decisión 3J-D2) lo dice de forma explícita:
 *
 *     "role es CAPACIDAD TECNICA, no acceso a workspace.
 *      El acceso a espacios proviene de `verticals` / organizaciones,
 *      nunca del rol."
 *
 * El catálogo de roles (member, admin, investor, org_admin, agent,
 * admin_system) describe permisos técnicos, NO identidad de trabajo. Usarlo
 * para decidir el layout violaría esa decisión de arquitectura. Esta capa
 * deriva la identidad de señales de la PERSONA y, sobre todo, de la
 * elección explícita del usuario.
 *
 * REUTILIZACIÓN (regla 7)
 * `empresa` NO redefine sus paneles: apunta al preset `empresa` que ya existe
 * en `services/workspacePresets.js` (`presetId`). Si ese preset evoluciona,
 * la identidad empresa lo sigue. `personal` y `profesional` no tienen preset
 * equivalente, así que declaran su propia composición usando ÚNICAMENTE ids
 * que ya existen en `workspaceRegistry.jsx` (33 widgets, catálogo inalterado).
 *
 * EXTENSIBILIDAD (regla 6)
 * Añadir `agente` o una vertical futura es una entrada más en
 * WORKSPACE_IDENTITIES. `resolveIdentity` cae en `personal` ante cualquier
 * clave desconocida, así que un perfil nuevo nunca rompe el workspace.
 */
import { User, Briefcase, Building2 } from 'lucide-react';
import { getPreset } from '../services/workspacePresets';

export const IDENTITY_KEYS = {
  PERSONAL: 'personal',
  PROFESIONAL: 'profesional',
  EMPRESA: 'empresa',
};

const BASE_LEFT = ['profile-card', 'activity', 'quick-links'];
const BASE_CENTER = ['welcome-band', 'feed', 'inline-stats'];

export const WORKSPACE_IDENTITIES = [
  {
    key: IDENTITY_KEYS.PERSONAL,
    label: 'Personal',
    Icon: User,
    accent: '#00C896',
    description: 'Comunidad, mensajes, eventos y tu perfil.',
    // Sin preset equivalente en workspacePresets.js.
    presetId: null,
    panels: {
      left: [...BASE_LEFT, 'groups'],
      center: [...BASE_CENTER],
      right: [
        'messages', 'events', 'trending', 'rss-news',
        'suggested-people', 'discover-entities',
      ],
    },
    copy: {
      eyebrow: 'TU ESPACIO',
      title: 'Configura tu Mi Espacio',
      subtitle: 'Comunidad, mensajes, eventos y las personas que sigues.',
    },
  },
  {
    key: IDENTITY_KEYS.PROFESIONAL,
    label: 'Profesional',
    Icon: Briefcase,
    accent: '#0EA5E9',
    description: 'Agenda, clientes del ecosistema, mercado e IA.',
    presetId: null,
    panels: {
      left: ['profile-card', 'calendar-mini', 'activity', 'quick-links'],
      center: [...BASE_CENTER],
      right: [
        'messages', 'companies', 'ai-tools', 'ai-of-the-day',
        'events', 'rss-news', 'marketplace', 'trending-companies',
      ],
    },
    copy: {
      eyebrow: 'TU ESPACIO PROFESIONAL',
      title: 'Configura tu Mi Espacio',
      subtitle: 'Tu agenda, el mercado, las empresas y la IA que te acompaña.',
    },
  },
  {
    key: IDENTITY_KEYS.EMPRESA,
    label: 'Empresa',
    Icon: Building2,
    accent: '#8B5CF6',
    description: 'Equipo, comunicación, IA y cifras del negocio.',
    // REUTILIZA el preset existente. No se redefinen paneles aquí.
    presetId: 'empresa',
    panels: null,
    copy: {
      eyebrow: 'TU ESPACIO DE EMPRESA',
      title: 'Configura tu Mi Espacio',
      subtitle: 'Comunicación del equipo, mercado, IA y cifras de la empresa.',
    },
  },
];

const BY_KEY = WORKSPACE_IDENTITIES.reduce((acc, i) => {
  acc[i.key] = i;
  return acc;
}, {});

/** Clave usada cuando el usuario no ha elegido identidad. */
export const DEFAULT_IDENTITY = IDENTITY_KEYS.PERSONAL;
/**
 * Resuelve los paneles de una identidad.
 * Si la identidad declara `presetId` y ese preset existe, se USA el preset
 * (reutilización); si no, se usa la composición propia de la identidad.
 * Nunca devuelve undefined: cae en la identidad por defecto.
 */
export const resolvePanels = (key) => {
  const identity = BY_KEY[key] || BY_KEY[DEFAULT_IDENTITY];
  if (identity.presetId) {
    const preset = getPreset(identity.presetId);
    if (preset?.panels) {
      return {
        left: [...(preset.panels.left || [])],
        center: [...(preset.panels.center || [])],
        right: [...(preset.panels.right || [])],
      };
    }
  }
  return {
    left: [...(identity.panels.left || [])],
    center: [...(identity.panels.center || [])],
    right: [...(identity.panels.right || [])],
  };
};

/**
 * Inferencia de identidad a partir de datos de PERFIL.
 *
 * Deliberadamente conservadora y, punto importante, NO usa `role` (ver cabecera).
 * Tampoco concede permisos: solo propone un layout por defecto, y cualquier
 * elección explícita del usuario tiene prioridad.
 *
 * Hoy el Home solo dispone de los datos de sesión (id, email, name, picture,
 * role), que no incluyen el perfil extendido, así que la inferencia solo se
 * aplica cuando se le pasan datos de perfil reales.
 */
export const inferIdentity = (profile) => {
  if (!profile || typeof profile !== 'object') return null;
  const has = (v) => (Array.isArray(v) ? v.length > 0 : (typeof v === 'string' && v.trim().length > 0));

  if (has(profile.current_company)) return IDENTITY_KEYS.EMPRESA;

  if (
    has(profile.current_title) || has(profile.specialties) ||
    has(profile.skills) || has(profile.headline)
  ) return IDENTITY_KEYS.PROFESIONAL;

  return null;  // sin señales → null, la UI usa DEFAULT_IDENTITY
};

/**
 * Resuelve la identidad efectiva.
 * Precedencia: elección explícita > inferencia del perfil > identidad por
 * defecto. Toda clave desconocida cae en `personal` (fail-safe: nunca rompe).
 */
export const resolveIdentity = ({ choice, profile } = {}) => {
  if (choice && BY_KEY[choice]) return choice;
  return inferIdentity(profile) || DEFAULT_IDENTITY;
};

/** Devuelve la definición completa de una identidad (con sus textos y acento). */
export const getIdentity = (key) => BY_KEY[key] || BY_KEY[DEFAULT_IDENTITY];

/** Payload de workspace listo para `setWorkspace`, preservando preferencias. */
export const buildPayloadFromIdentity = (key, currentWidgets = {}) => ({
  layout_version: 1,
  panels: resolvePanels(key),
  widgets: currentWidgets || {},
  theme: 'auto',
});
