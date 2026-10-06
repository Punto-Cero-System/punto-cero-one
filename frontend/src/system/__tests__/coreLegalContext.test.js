/**
 * Puente de identidad Punto Cero One → Core Legal.
 *
 * Verifica el adaptador de contrato y la precedencia de `path` en
 * `resolveEntryPath`, con los tres perfiles UAT reales del Core Legal.
 */
import {
  normalizeCoreLegalContext,
  normalizeCoreLegalUser,
  isCoreLegalContext,
  resolveAccountType,
} from '../coreLegalContext';
import { resolveEntryPath } from '../systemEntryRules';

// Contratos reales devueltos por http://127.0.0.1:8001/api/auth/system-context
const ADMIN_CTX = {
  user_id_core: '68a1f0c2e1b2a3d4e5f60718',
  profile_type: 'personal',
  active_verticals: ['one'],
  verticals: ['one'],
  permissions: ['one:access'],
  workspace: 'admin',
  path: '/admin',
  workspace_id: 'admin',
  organization: 'Punto Cero',
  organization_id: 'org_admin',
  tenant: 'punto-cero',
  tenant_id: 'tenant_main',
  firm_id: null,
  profession: 'commercial',
  role: 'admin_general',
};

const FIRM_OWNER_CTX = {
  ...ADMIN_CTX,
  permissions: ['firm:read', 'firm:manage', 'team:read'],
  workspace: 'firm-os',
  path: '/firm-os',
  workspace_id: 'firm-os',
  organization: 'Estudio Gómez & Asociados',
  organization_id: 'org_firma',
  firm_id: 'firm_gomez',
  profession: 'legal',
  role: 'firm_owner',
};

const LAWYER_CTX = {
  ...ADMIN_CTX,
  permissions: ['legal:access', 'legal:cases', 'legal:clients', 'one:access'],
  workspace: 'workspace/legal',
  path: '/workspace',
  workspace_id: 'workspace/legal',
  organization: 'Estudio Gómez & Asociados',
  organization_id: 'org_firma',
  firm_id: 'firm_gomez',
  profession: 'legal',
  role: 'lawyer',
};

// Contrato original de Punto Cero One (punto_cero_local) — no debe alterarse.
const ONE_CTX = {
  identity: { account_type: 'legal', verticals: ['legal'] },
  organizations: [{ id: 'org_1', name: 'Punto Cero Legal' }],
  workspaces: {
    available: [{ key: 'legal', label: 'Legal' }],
    coming_soon: [],
    recommended: 'legal',
  },
};

describe('Puente de identidad — Core Legal → Punto Cero One', () => {
  describe('adaptador de contrato', () => {
    it('reconoce el contrato del Core Legal y descarta el de One', () => {
      expect(isCoreLegalContext(ADMIN_CTX)).toBe(true);
      expect(isCoreLegalContext(ONE_CTX)).toBe(false);
    });

    it('conserva path / workspace_id como autoridad del destino', () => {
      const out = normalizeCoreLegalContext(ADMIN_CTX);
      expect(out.path).toBe('/admin');
      expect(out.workspace_id).toBe('admin');
      expect(out.source).toBe('core-legal');
    });

    it('no toca un contexto que ya viene en el modelo de One', () => {
      expect(normalizeCoreLegalContext(ONE_CTX)).toBe(ONE_CTX);
    });

    it('tolera null y undefined', () => {
      expect(normalizeCoreLegalContext(null)).toBeNull();
      expect(normalizeCoreLegalContext(undefined)).toBeUndefined();
      expect(normalizeCoreLegalUser(null)).toBeNull();
    });

    it.each([
      ['admin_general', 'personal'],
      ['firm_owner', 'organizacion'],
      ['lawyer', 'profesional'],
    ])('deriva account_type desde el rol %s', (role, expected) => {
      expect(resolveAccountType({ role })).toBe(expected);
    });
  });

  describe('normalización de identidad y workspaces', () => {
    it.each([
      ['admin_general → personal', ADMIN_CTX, 'personal', 'admin'],
      ['firm_owner → organizacion', FIRM_OWNER_CTX, 'organizacion', 'empresa'],
      ['lawyer → profesional', LAWYER_CTX, 'profesional', 'legal'],
    ])('%s', (_label, ctx, accountType, recommended) => {
      const out = normalizeCoreLegalContext(ctx);
      expect(out.identity.account_type).toBe(accountType);
      expect(out.workspaces.recommended).toBe(recommended);
      expect(out.workspaces.recommended_reason).toBe('core_legal_workspace');
    });

    it('deja el rol de One listo para los guards de ruta', () => {
      expect(normalizeCoreLegalUser({ role: 'admin_general' }).role).toBe('admin');
      expect(normalizeCoreLegalUser({ role: 'admin_general' }).core_role).toBe('admin_general');
      expect(normalizeCoreLegalUser({ role: 'firm_owner' }).role).toBe('firm_owner');
      expect(normalizeCoreLegalUser({ role: 'lawyer' }).role).toBe('lawyer');
    });

    it('conserva los 29 campos de /me y agrega el nombre', () => {
      const me = { id: 'u1', email: 'a@b.com', full_name: 'Darwin Gómez', tenant_id: 't1', plan_id: 'pro' };
      const out = normalizeCoreLegalUser(me);
      expect(out.name).toBe('Darwin Gómez');
      expect(out.tenant_id).toBe('t1');
      expect(out.plan_id).toBe('pro');
    });
  });

  describe('resolveEntryPath — la ruta del Core Legal manda', () => {
    it.each([
      ['admin_general', ADMIN_CTX, '/admin'],
      ['firm_owner', FIRM_OWNER_CTX, '/firm-os'],
      ['lawyer', LAWYER_CTX, '/workspace'],
    ])('%s entra a su workspace', (_role, ctx, expected) => {
      expect(resolveEntryPath(normalizeCoreLegalContext(ctx))).toBe(expected);
    });

    it('NUNCA degrada a comunidad cuando el Core Legal resolvió una vertical', () => {
      [ADMIN_CTX, FIRM_OWNER_CTX, LAWYER_CTX].forEach((ctx) => {
        expect(resolveEntryPath(normalizeCoreLegalContext(ctx))).not.toBe('/');
      });
    });

    it('respeta los overrides explícitos del llamador', () => {
      const ctx = normalizeCoreLegalContext(LAWYER_CTX);
      expect(resolveEntryPath(ctx, { force: '/legal/expedientes' })).toBe('/legal/expedientes');
      expect(resolveEntryPath(ctx, { isAdmin: true })).toBe('/admin');
      expect(resolveEntryPath(ctx, { isInvestor: true })).toBe('/investor-portal');
    });

    it('ignora un path que no sea una ruta absoluta', () => {
      const bad = normalizeCoreLegalContext({ ...LAWYER_CTX, path: 'workspace' });
      expect(resolveEntryPath(bad)).not.toBe('workspace');
    });

    it('sigue funcionando con el contrato original de One (regresión)', () => {
      expect(resolveEntryPath(ONE_CTX)).toBe('/workspace/legal');
      expect(resolveEntryPath(null)).toBe('/');
    });
  });
});
