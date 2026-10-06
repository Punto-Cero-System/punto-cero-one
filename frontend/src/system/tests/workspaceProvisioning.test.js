import { resolveWorkspaceProvisioning } from '../workspaceProvisioning';

describe('resolveWorkspaceProvisioning', () => {
  it('provisiona legal live con entitlement y contexto de usuario', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'legal',
      entitlements: ['workspace.open.legal'],
      userContext: { id: 'user-1' },
    })).toEqual({
      provisioned: true,
      workspaceKey: 'legal',
      reason: 'workspace_available',
    });
  });

  it('provisiona medical preview para lanzamiento controlado', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'medical',
      entitlements: ['workspace.open.medical'],
      systemContext: { workspaces: { available: [{ key: 'medical' }] } },
    })).toEqual(expect.objectContaining({
      provisioned: true,
      workspaceKey: 'medical',
      reason: 'workspace_available',
    }));
  });

  it('provisiona un workspace permitido por la organización activa', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'legal',
      activeOrganization: { id: 'org-1', workspaceKey: 'legal' },
      userContext: { id: 'user-1' },
    })).toEqual(expect.objectContaining({
      provisioned: true,
      workspaceKey: 'legal',
    }));
  });

  it('no provisiona un workspace declared', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'odontologia',
      entitlements: ['workspace.open.odontologia'],
      userContext: { id: 'user-1' },
    })).toEqual({
      provisioned: false,
      reason: 'workspace_not_provisioned',
    });
  });

  it('no provisiona un workspace inexistente', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'unknown',
      entitlements: ['workspace.open.unknown'],
      userContext: { id: 'user-1' },
    })).toEqual({
      provisioned: false,
      reason: 'workspace_not_provisioned',
    });
  });

  it('no provisiona sin contexto suficiente', () => {
    expect(resolveWorkspaceProvisioning({
      workspaceKey: 'legal',
      entitlements: ['workspace.open.legal'],
    })).toEqual({
      provisioned: false,
      reason: 'workspace_not_provisioned',
    });
  });
});
