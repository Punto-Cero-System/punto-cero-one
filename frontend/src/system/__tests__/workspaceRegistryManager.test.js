import {
  changeLaunchMode,
  changeLifecycle,
  changeWorkspaceState,
  disableWorkspace,
  enableWorkspace,
  registerWorkspace,
  removeWorkspace,
  updateWorkspace,
} from '../workspaceRegistryManager';
import { getEcosystem } from '../workspaceRegistryService';

const workspaceKey = 'manager-test';
const workspace = {
  key: workspaceKey,
  verticalKey: 'legal',
  lifecycle: 'live',
  status: 'live',
  state: 'disabled',
  enabled: false,
  launchMode: 'controlled',
};

beforeEach(() => {
  removeWorkspace(workspaceKey);
});

afterEach(() => {
  removeWorkspace(workspaceKey);
});

describe('workspaceRegistryManager', () => {
  it('registra un workspace', () => {
    expect(registerWorkspace(workspace)).toEqual(expect.objectContaining(workspace));
    expect(getEcosystem().workspaces.some((item) => item.key === workspaceKey)).toBe(true);
  });

  it('actualiza un workspace', () => {
    registerWorkspace(workspace);
    expect(updateWorkspace(workspaceKey, { name: 'Manager Test Updated' })).toEqual(
      expect.objectContaining({ key: workspaceKey, name: 'Manager Test Updated' }),
    );
  });

  it('elimina un workspace', () => {
    registerWorkspace(workspace);
    expect(removeWorkspace(workspaceKey)).toEqual(expect.objectContaining({ key: workspaceKey }));
    expect(removeWorkspace(workspaceKey)).toBeUndefined();
  });

  it('habilita y deshabilita un workspace', () => {
    registerWorkspace(workspace);
    expect(enableWorkspace(workspaceKey)).toEqual(expect.objectContaining({ enabled: true, state: 'enabled' }));
    expect(disableWorkspace(workspaceKey)).toEqual(expect.objectContaining({ enabled: false, state: 'disabled' }));
  });

  it('cambia lifecycle', () => {
    registerWorkspace(workspace);
    expect(changeLifecycle(workspaceKey, 'preview')).toEqual(
      expect.objectContaining({ lifecycle: 'preview', status: 'preview' }),
    );
  });

  it('cambia launchMode', () => {
    registerWorkspace(workspace);
    expect(changeLaunchMode(workspaceKey, 'workspace')).toEqual(
      expect.objectContaining({ launchMode: 'workspace' }),
    );
  });

  it('rechaza launchModes no soportados o incompatibles con preview', () => {
    registerWorkspace(workspace);
    expect(changeLaunchMode(workspaceKey, 'automatic')).toBeUndefined();
    changeLifecycle(workspaceKey, 'preview');
    expect(changeLaunchMode(workspaceKey, 'workspace')).toBeUndefined();
    expect(changeLaunchMode(workspaceKey, 'controlled')).toEqual(
      expect.objectContaining({ launchMode: 'controlled' }),
    );
  });

  it('cambia state', () => {
    registerWorkspace(workspace);
    expect(changeWorkspaceState(workspaceKey, 'enabled')).toEqual(
      expect.objectContaining({ state: 'enabled' }),
    );
  });
});
