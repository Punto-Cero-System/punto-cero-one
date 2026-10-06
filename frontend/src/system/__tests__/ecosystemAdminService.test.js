import {
  activateWorkspace,
  createWorkspace,
  deactivateWorkspace,
  deleteWorkspace,
  editWorkspace,
  getWorkspace,
  listRegistry,
  listStates,
  listVerticals,
} from '../ecosystemAdminService';

const workspaceKey = 'admin-test';
const workspace = {
  key: workspaceKey,
  verticalKey: 'legal',
  lifecycle: 'declared',
  status: 'declared',
  state: 'disabled',
  enabled: false,
  launchMode: 'controlled',
};

afterEach(() => {
  deleteWorkspace(workspaceKey);
});

describe('ecosystemAdminService', () => {
  it('lista el Registry', () => {
    expect(listRegistry()).toEqual(expect.any(Array));
    expect(listRegistry().some((item) => item.key === 'legal')).toBe(true);
  });

  it('crea y consulta un workspace', () => {
    expect(createWorkspace(workspace)).toEqual(expect.objectContaining({ key: workspaceKey }));
    expect(getWorkspace(workspaceKey)).toEqual(expect.objectContaining({ key: workspaceKey }));
  });

  it('edita un workspace', () => {
    createWorkspace(workspace);
    expect(editWorkspace(workspaceKey, { name: 'Admin Test Updated' })).toEqual(
      expect.objectContaining({ name: 'Admin Test Updated' }),
    );
  });

  it('activa y desactiva un workspace', () => {
    createWorkspace(workspace);
    expect(activateWorkspace(workspaceKey)).toEqual(expect.objectContaining({ enabled: true }));
    expect(deactivateWorkspace(workspaceKey)).toEqual(expect.objectContaining({ enabled: false }));
  });

  it('elimina un workspace', () => {
    createWorkspace(workspace);
    expect(deleteWorkspace(workspaceKey)).toEqual(expect.objectContaining({ key: workspaceKey }));
    expect(getWorkspace(workspaceKey)).toBeUndefined();
  });

  it('consulta verticales y estados', () => {
    expect(listVerticals()).toHaveLength(5);
    expect(listStates()).toEqual(expect.arrayContaining(['live', 'preview', 'declared']));
  });
});
