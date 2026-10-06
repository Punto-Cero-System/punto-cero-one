import workspaceRegistry from '../workspaceRegistry';

const workspace = (key) => workspaceRegistry.workspaces.find((item) => item.key === key);

describe('workspaceRegistry', () => {
  it('expone el Registry y los workspaces registrados', () => {
    expect(workspaceRegistry).toEqual(expect.objectContaining({
      verticals: expect.any(Array),
      workspaces: expect.any(Array),
    }));
    expect(workspaceRegistry.workspaces.map((item) => item.key)).toEqual([
      'legal',
      'medical',
      'odontologia',
      'psicologia',
      'enfermeria',
    ]);
  });

  it('mantiene estados correctos', () => {
    expect(workspace('legal')).toEqual(expect.objectContaining({ state: 'enabled', status: 'live' }));
    expect(workspace('medical')).toEqual(expect.objectContaining({ state: 'enabled', status: 'preview' }));
    expect(workspace('odontologia')).toEqual(expect.objectContaining({ state: 'disabled', status: 'declared' }));
  });

  it('mantiene lifecycle y launchMode', () => {
    expect(workspace('legal')).toEqual(expect.objectContaining({ lifecycle: 'live', launchMode: 'workspace' }));
    expect(workspace('medical')).toEqual(expect.objectContaining({ lifecycle: 'preview', launchMode: 'controlled' }));
    expect(workspaceRegistry.launchModes).toEqual(['workspace', 'controlled']);
    expect(workspaceRegistry.workspaces.every((item) => (
      workspaceRegistry.launchModes.includes(item.launchMode)
    ))).toBe(true);
  });
});
