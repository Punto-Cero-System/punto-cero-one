import fs from 'fs';
import path from 'path';
import {
  canLaunchWorkspace,
  deriveAvailability,
  getWorkspace,
  getWorkspaceStatus,
  isWorkspaceAvailable,
  isWorkspaceStatusOpen,
  WORKSPACE_CATALOG,
} from '../workspaceCatalog';

const snapshotPath = path.resolve(
  __dirname,
  '../../../../docs/architecture/workspace_projection.snapshot.json',
);
const projection = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const projectionFields = ['key', 'status', 'label', 'route', 'location'];
const prohibitedFields = ['launchMode', 'external', 'permission'];

describe('workspaceCatalog projection migration compatibility gate', () => {
  it('keeps the existing catalog keys and public lookup behavior', () => {
    const currentKeys = [
      'legal',
      'medical',
      'odontologia',
      'psicologia',
      'enfermeria',
      'legacy',
    ];
    expect(WORKSPACE_CATALOG.map(({ key }) => key)).toEqual(currentKeys);
    currentKeys.forEach((key) => {
      expect(getWorkspace(key)).toEqual(expect.objectContaining({ key }));
    });
    expect(getWorkspace('missing')).toBeUndefined();
    expect(getWorkspaceStatus('missing')).toBeUndefined();
    expect(isWorkspaceAvailable('missing')).toBe(false);
    expect(canLaunchWorkspace('missing')).toBe(false);
  });

  it.each([
    ['live', 'open', true],
    ['preview', 'open', true],
    ['declared', 'closed', false],
    ['deprecated', 'closed', false],
  ])('%s lifecycle remains separate from derived availability', (
    status,
    expectedAvailability,
    expectedOpen,
  ) => {
    expect(deriveAvailability(status)).toBe(expectedAvailability);
    expect(isWorkspaceStatusOpen(status)).toBe(expectedOpen);
  });

  it('has no stored or projected prohibited fields', () => {
    expect(WORKSPACE_CATALOG.every((workspace) => (
      prohibitedFields.every((field) => !Object.prototype.hasOwnProperty.call(workspace, field))
    ))).toBe(true);
    projection.forEach((workspace) => {
      expect(Object.keys(workspace).sort()).toEqual([...projectionFields].sort());
      prohibitedFields.forEach((field) => {
        expect(workspace).not.toHaveProperty(field);
      });
    });
  });

  it('uses explicit location without deriving it from entry_url or lifecycle', () => {
    const byKey = new Map(projection.map((workspace) => [workspace.key, workspace]));
    expect(byKey.get('legal').location).toBe('internal');
    expect(byKey.get('comunidad').location).toBe('external');
    expect(byKey.get('empresa').location).toBe('internal');
    expect(['live', 'preview', 'declared', 'deprecated'])
      .toContain(byKey.get('comunidad').status);
    expect(byKey.get('comunidad').status).toBe('live');
  });

  it('blocks direct replacement while projection keys or lifecycle differ', () => {
    const catalogByKey = new Map(WORKSPACE_CATALOG.map((workspace) => [workspace.key, workspace]));
    const projectionByKey = new Map(projection.map((workspace) => [workspace.key, workspace]));

    expect(projectionByKey.get('medical').status).toBe('declared');
    expect(catalogByKey.get('medical').status).toBe('preview');
    expect(projectionByKey.has('legacy')).toBe(false);
    expect(catalogByKey.has('legacy')).toBe(true);
    expect(projectionByKey.has('empresa')).toBe(true);
    expect(catalogByKey.has('empresa')).toBe(false);
  });
});
