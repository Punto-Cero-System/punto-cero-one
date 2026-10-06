/**
 * Tests de la capa System Entry — decisión única de destino (frontend).
 *
 * Cubren el contrato real de `GET /api/auth/system-context` del Identity Core:
 * la respuesta del núcleo es la que decide a qué espacio entra el usuario.
 * No hay auth aquí: la sesión (pcl_token / pcl_user) la gobierna AuthContext.
 */
import {
  SYSTEM_IDENTITY,
  SYSTEM_ROUTES,
  WORKSPACE_ROUTES,
  resolveIdentityType,
  resolveVerticals,
  resolveOrganizationRoles,
  resolveWorkspacePath,
  resolveEntryPath,
  describeEntry,
} from '../systemEntryRules';
import {
  SYSTEM_IDENTITIES,
  getIdentity,
  defaultSpaceForIdentity,
  COMING_SOON_IDENTITIES,
} from '../systemIdentities';

const context = (over = {}) => ({
  user: { id: 'u1', email: 'a@b.com', name: 'Ana' },
  session: { sources: ['jwt'], unified: false },
  identity: { account_type: 'personal', verticals: [], primary_vertical: null },
  organizations: [],
  workspaces: { available: [], coming_soon: [], recommended: null },
  ...over,
});

describe('systemEntry — identidad', () => {
  it('normaliza el vocabulario del núcleo a las 4 identidades de producto', () => {
    expect(resolveIdentityType(context())).toBe(SYSTEM_IDENTITY.PERSONAL);
    expect(resolveIdentityType(context({ identity: { account_type: 'profesional' } }))).toBe(SYSTEM_IDENTITY.PROFESSIONAL);
    expect(resolveIdentityType(context({ identity: { account_type: 'empresa' } }))).toBe(SYSTEM_IDENTITY.ORGANIZATION);
    expect(resolveIdentityType(context({ identity: { account_type: 'organizacion' } }))).toBe(SYSTEM_IDENTITY.ORGANIZATION);
    expect(resolveIdentityType(context({ identity: { account_type: 'agente' } }))).toBe(SYSTEM_IDENTITY.AGENT);
  });

  it('tolera mayúsculas y tildes', () => {
    expect(resolveIdentityType(context({ identity: { account_type: 'PROFESIONAL' } }))).toBe(SYSTEM_IDENTITY.PROFESSIONAL);
    expect(resolveIdentityType(context({ identity: { account_type: 'organización' } }))).toBe(SYSTEM_IDENTITY.ORGANIZATION);
  });

  it('infiere sin inventar cuando el núcleo no clasifica', () => {
    expect(resolveIdentityType(context({
      identity: {},
      organizations: [{ id: 'o1', name: 'Firma', relation: 'owner' }],
    }))).toBe(SYSTEM_IDENTITY.ORGANIZATION);
    expect(resolveIdentityType(context({ identity: { verticals: ['legal'] } }))).toBe(SYSTEM_IDENTITY.PROFESSIONAL);
    expect(resolveIdentityType(context({ identity: {} }))).toBe(SYSTEM_IDENTITY.PERSONAL);
  });

  it('normaliza verticales y roles de organización', () => {
    expect(resolveVerticals(context({ identity: { verticals: ['Legal', 'legal', ' MEDICAL ', ''] } })))
      .toEqual(['legal', 'medical']);
    expect(resolveOrganizationRoles(context({
      organizations: [{ relation: 'Owner' }, { role: 'member' }, { relation: 'owner' }],
    }))).toEqual(['owner', 'member']);
  });
});

describe('systemEntry — destino del workspace', () => {
  it('respeta la recomendación del núcleo (autoridad)', () => {
    expect(resolveWorkspacePath(context({ workspaces: { recommended: 'legal' } }))).toBe(WORKSPACE_ROUTES.legal);
    expect(resolveWorkspacePath(context({ workspaces: { recommended: 'medical' } }))).toBe(WORKSPACE_ROUTES.medical);
    expect(resolveWorkspacePath(context({ workspaces: { recommended: 'empresa' } }))).toBe(WORKSPACE_ROUTES.empresa);
    expect(resolveWorkspacePath(context({ workspaces: { recommended: 'comunidad' } }))).toBe(SYSTEM_ROUTES.community);
  });

  it('cae a la primera vertical activa si el núcleo no recomienda nada', () => {
    expect(resolveWorkspacePath(context({ identity: { verticals: ['legal'] } }))).toBe(WORKSPACE_ROUTES.legal);
  });

  it('cae a comunidad cuando no hay verticales ni recomendación', () => {
    expect(resolveWorkspacePath(context())).toBe(SYSTEM_ROUTES.community);
  });

  it('no navega a un workspace no disponible (medical coming_soon)', () => {
    expect(resolveWorkspacePath(context({
      identity: { account_type: 'profesional', verticals: ['medical'] },
      workspaces: {
        available: [{ key: 'legal', label: 'Punto Cero Legal' }],
        coming_soon: [{ key: 'medical', label: 'Punto Cero Medical' }],
        recommended: 'comunidad',
      },
    }))).toBe(SYSTEM_ROUTES.community);
  });

  it('respeta la recomendación del núcleo aunque el módulo esté en coming_soon', () => {
    // Decisión del núcleo = contrato: el frontend no la reinterpreta.
    expect(resolveWorkspacePath(context({
      workspaces: { available: [], coming_soon: [{ key: 'medical' }], recommended: 'medical' },
    }))).toBe(WORKSPACE_ROUTES.medical);
  });

  it('es tolerante a un contexto vacío o nulo', () => {
    expect(resolveWorkspacePath(null)).toBe(SYSTEM_ROUTES.community);
    expect(resolveWorkspacePath(undefined)).toBe(SYSTEM_ROUTES.community);
    expect(resolveWorkspacePath({})).toBe(SYSTEM_ROUTES.community);
  });
});
describe('systemEntry — entry point', () => {
  it('sin contexto → comunidad', () => {
    expect(resolveEntryPath(null)).toBe(SYSTEM_ROUTES.community);
  });

  it('admin de consola → /admin; inversor → /investor-portal; force gana a todo', () => {
    expect(resolveEntryPath(context({ workspaces: { recommended: 'legal' } }), { isAdmin: true })).toBe(SYSTEM_ROUTES.admin);
    expect(resolveEntryPath(context({ workspaces: { recommended: 'legal' } }), { isInvestor: true })).toBe(SYSTEM_ROUTES.investor);
    expect(resolveEntryPath(context({ workspaces: { recommended: 'legal' } }), { force: '/x' })).toBe('/x');
  });

  it('describeEntry proyecta identidad, verticales, roles y ruta', () => {
    const summary = describeEntry(context({
      identity: { account_type: 'profesional', verticals: ['legal'] },
      organizations: [{ relation: 'owner' }],
      workspaces: { recommended: 'legal' },
    }));
    expect(summary).toEqual({
      identityType: SYSTEM_IDENTITY.PROFESSIONAL,
      verticals: ['legal'],
      organizationRoles: ['owner'],
      recommended: 'legal',
      path: WORKSPACE_ROUTES.legal,
    });
  });
});

describe('systemIdentities — estructura declarativa', () => {
  it('declara las cuatro identidades del sistema', () => {
    expect(SYSTEM_IDENTITIES.map((i) => i.key)).toEqual([
      SYSTEM_IDENTITY.PERSONAL,
      SYSTEM_IDENTITY.PROFESSIONAL,
      SYSTEM_IDENTITY.ORGANIZATION,
      SYSTEM_IDENTITY.AGENT,
    ]);
  });

  it('expone fichas y espacio por defecto sin decidir la navegación', () => {
    expect(getIdentity(SYSTEM_IDENTITY.PROFESSIONAL).label).toBe('Profesional');
    expect(defaultSpaceForIdentity(SYSTEM_IDENTITY.PROFESSIONAL)).toBe(WORKSPACE_ROUTES.legal);
    expect(defaultSpaceForIdentity('no-existe')).toBe(SYSTEM_ROUTES.community);
  });

  it('marca como próximas las identidades sin módulo interno', () => {
    expect(COMING_SOON_IDENTITIES).toEqual(
      expect.arrayContaining([SYSTEM_IDENTITY.ORGANIZATION, SYSTEM_IDENTITY.AGENT]),
    );
    expect(COMING_SOON_IDENTITIES).not.toContain(SYSTEM_IDENTITY.PROFESSIONAL);
  });
});
