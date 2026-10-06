/**
 * coreLegalContext.js — ADAPTADOR de contrato: Core Legal → Punto Cero One.
 *
 * El Core Legal (`:8001`) entrega su `system-context` con el workspace YA
 * resuelto:
 *
 *   { user_id_core, profile_type, active_verticals, verticals, permissions,
 *     workspace, path, workspace_id, organization, organization_id, tenant,
 *     tenant_id, firm_id, profession, role }
 *
 * El motor de Punto Cero One (`systemEntryRules.js`) espera otro modelo
 * (`identity.account_type`, `workspaces.recommended`). Este módulo traduce en
 * el FRONTEND, sin tocar el backend, los contratos ni la base de datos.
 *
 * Principio: la ruta la decide el Core Legal (`path`). Aqui solo se normaliza
 * el vocabulario de identidad para que los guards y el motor sigan funcionando.
 *
 * Puro: sin React, sin fetch, sin efectos.
 */

// Rol del Core Legal → account_type del vocabulario de One.
const CORE_ROLE_TO_ACCOUNT_TYPE = {
  // `admin_general` es una persona administradora, no una organización.
  admin_general: 'personal',
  admin: 'personal',
  socio_comercial: 'personal',
  firm_owner: 'organizacion',
  firm_lawyer: 'profesional',
  lawyer: 'profesional',
  doctor: 'profesional',
  dentist: 'profesional',
  psychologist: 'profesional',
  nurse: 'profesional',
  client: 'personal',
  member: 'personal',
  investor: 'personal',
};

// Rol del Core Legal → rol que espera el vocabulary de One (guards de ruta).
// `ProtectedAdminRoute` compara literalmente contra 'admin'.
const CORE_ROLE_TO_ONE_ROLE = {
  admin_general: 'admin',
  admin: 'admin',
  investor: 'investor',
};

// workspace_id del Core Legal → key del catálogo de workspaces de One.
const CORE_WORKSPACE_TO_ONE_KEY = {
  admin: 'admin',
  'firm-os': 'empresa',
  'workspace/legal': 'legal',
  'workspace/medical': 'medical',
  'workspace/empresa': 'empresa',
  'workspace/odontologia': 'odontologia',
  'workspace/psicologia': 'psicologia',
  'workspace/enfermeria': 'enfermeria',
  'workspace/finance': 'finance',
  'workspace/accounting': 'accounting',
  'workspace/inmobiliaria': 'inmobiliaria',
  workspace: 'legal',
  one: 'comunidad',
  comunidad: 'comunidad',
  portal: 'comunidad',
};

const LABEL_BY_KEY = {
  admin: 'Administración',
  legal: 'Punto Cero Legal',
  medical: 'Punto Cero Medical',
  empresa: 'Punto Cero Empresa',
  comunidad: 'Punto Cero One',
};

const asArray = (v) => (Array.isArray(v) ? v : []);
const lower = (v) => String(v ?? '').trim().toLowerCase();

/** ¿Este contexto viene del Core Legal? (tiene `path`/`workspace_id` de raíz) */
export const isCoreLegalContext = (ctx) => Boolean(
  ctx && (ctx.path || ctx.workspace_id) && !ctx.workspaces,
);

/** account_type normalizado a partir del rol y la vertical del Core Legal. */
export const resolveAccountType = (context) => {
  const byRole = CORE_ROLE_TO_ACCOUNT_TYPE[lower(context?.role)];
  if (byRole) return byRole;
  const profession = lower(context?.profession);
  if (profession && profession !== 'commercial') return 'profesional';
  const profileType = lower(context?.profile_type);
  if (profileType === 'organization') return 'organizacion';
  if (profileType === 'professional') return 'profesional';
  return 'personal';
};

/** Normaliza el usuario del Core Legal al vocabulario de roles de One. */
export const normalizeCoreLegalUser = (user) => {
  if (!user || typeof user !== 'object') return user;
  const coreRole = lower(user.role);
  const oneRole = CORE_ROLE_TO_ONE_ROLE[coreRole] || coreRole;
  return {
    ...user,
    name: user.name || user.full_name || user.email,
    role: oneRole,
    core_role: user.role,
  };
};

/**
 * Traduce el `system-context` del Core Legal al modelo de Punto Cero One.
 * Conserva `path` / `workspace_id` como autoridad del destino.
 */
export const normalizeCoreLegalContext = (context, user) => {
  if (!context || typeof context !== 'object') return context;
  if (!isCoreLegalContext(context)) return context; // ya es contrato One

  const verticals = [...new Set([
    ...asArray(context.verticals),
    ...asArray(context.active_verticals),
  ].map(lower).filter(Boolean))];

  const workspaceId = lower(context.workspace_id || context.workspace);
  const oneKey = CORE_WORKSPACE_TO_ONE_KEY[workspaceId] || 'comunidad';
  const accountType = resolveAccountType(context);

  const identityUser = user || {};
  const organizationId = context.organization_id || context.organization || context.tenant_id || null;

  return {
    // ── Autoridad del Core Legal (se conservan tal cual) ──
    path: context.path,
    workspace_id: context.workspace_id,
    workspace: context.workspace,
    permissions: asArray(context.permissions),
    verticals,
    active_verticals: asArray(context.active_verticals),
    organization_id: organizationId,
    organization: context.organization,
    tenant_id: context.tenant_id || null,
    firm_id: context.firm_id ?? null,
    profession: context.profession || null,
    role: context.role,
    user_id_core: context.user_id_core || null,
    profile_type: context.profile_type || null,
    source: 'core-legal',

    // ── Vocabulario normalizado de Punto Cero One ──
    user: {
      id: identityUser.id || null,
      email: identityUser.email || null,
      name: identityUser.name || identityUser.full_name || null,
      picture: identityUser.picture || null,
    },
    session: { sources: ['jwt'], unified: true },
    identity: {
      account_type: accountType,
      verticals,
      verticals_source: 'core-legal',
      primary_vertical: verticals.find((v) => v !== 'one') || verticals[0] || null,
      profile_ref: '/api/auth/me',
    },
    organizations: organizationId
      ? [{ id: organizationId, relation: accountType === 'organizacion' ? 'owner' : 'member' }]
      : [],
    workspaces: {
      available: [{ key: oneKey, label: LABEL_BY_KEY[oneKey] || oneKey }],
      coming_soon: [],
      recommended: oneKey,
      recommended_reason: 'core_legal_workspace',
    },
  };
};

export default normalizeCoreLegalContext;
