import { resolveWorkspaceEnrollment } from '../workspaceEnrollment';

const base = {
  workspace: { key: 'legal' },
  subscription: { status: 'active' },
  plan: { name: 'Professional', workspaces: ['legal', 'medical'] },
  lifecycle: { status: 'live', launchable: true },
  entitlements: ['workspace.open.legal'],
};

describe('resolveWorkspaceEnrollment', () => {
  it('enrolls an active subscription', () => {
    expect(resolveWorkspaceEnrollment(base)).toEqual({
      enrolled: true,
      launchAllowed: true,
      reason: null,
    });
  });

  it('enrolls a trial subscription', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      subscription: { status: 'trial' },
    })).toEqual(expect.objectContaining({ enrolled: true, launchAllowed: true }));
  });

  it.each(['Free', 'Starter', 'Professional', 'Business', 'Enterprise'])(
    'supports the %s plan when it includes the workspace',
    (name) => {
      expect(resolveWorkspaceEnrollment({
        ...base,
        plan: { name, workspaces: ['legal'] },
      }).enrolled).toBe(true);
    },
  );

  it('rejects an expired subscription', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      subscription: { status: 'expired' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'subscription_expired' });
  });

  it('rejects a suspended subscription', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      subscription: { status: 'suspended' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'subscription_suspended' });
  });

  it('rejects a cancelled subscription', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      subscription: { status: 'cancelled' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'subscription_cancelled' });
  });

  it('rejects a pending subscription', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      subscription: { status: 'pending' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'subscription_pending' });
  });

  it('rejects a plan without workspace access', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      plan: { name: 'Starter', workspaces: ['medical'] },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'plan_workspace_not_allowed' });
  });

  it('rejects a workspace that does not exist in the catalog', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      workspace: { key: 'unknown' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'workspace_not_found' });
  });

  it('rejects a workspace outside the catalog', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      workspace: { key: 'external-vertical' },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'workspace_not_found' });
  });

  it('rejects an organization without workspace permission', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      organization: { id: 'org-1', workspaces: ['medical'] },
    })).toEqual({
      enrolled: false,
      launchAllowed: false,
      reason: 'organization_workspace_not_allowed',
    });
  });

  it('rejects an incompatible lifecycle', () => {
    expect(resolveWorkspaceEnrollment({
      ...base,
      lifecycle: { status: 'deprecated', launchable: false },
    })).toEqual({ enrolled: false, launchAllowed: false, reason: 'lifecycle_incompatible' });
  });

  it('rejects undefined data without throwing', () => {
    expect(() => resolveWorkspaceEnrollment()).not.toThrow();
    expect(resolveWorkspaceEnrollment()).toEqual({
      enrolled: false,
      launchAllowed: false,
      reason: 'workspace_not_found',
    });
  });

  it('rejects incomplete data', () => {
    expect(resolveWorkspaceEnrollment({ workspace: { key: 'legal' } })).toEqual({
      enrolled: false,
      launchAllowed: false,
      reason: 'lifecycle_incompatible',
    });
  });
});
