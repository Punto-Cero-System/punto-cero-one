import fs from 'fs';
import path from 'path';
import workspaceRegistry from '../workspaceRegistry';
import {
  deriveAvailability,
  WORKSPACE_CATALOG,
} from '../workspaceCatalog';

const contractPath = path.resolve(
  __dirname,
  '../../../../docs/architecture/workspace_projection.contract.json',
);
const snapshotPath = path.resolve(
  __dirname,
  '../../../../docs/architecture/workspace_projection.snapshot.json',
);
const projectionContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const projectionSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const projectionFields = ['key', 'status', 'label', 'route', 'location'];
const prohibitedFields = [
  'launchMode',
  'launch_mode',
  'external',
  'availability',
  'permission',
  'emoji',
  'description',
  'presetId',
];
const lifecycleStatuses = ['live', 'preview', 'declared', 'deprecated'];

describe('Workspace projection contract', () => {
  it('defines exactly the safe projection fields and lifecycle values', () => {
    expect(Object.keys(projectionContract.properties).sort())
      .toEqual([...projectionFields].sort());
    expect([...projectionContract.required].sort())
      .toEqual([...projectionFields].sort());
    expect(projectionContract.additionalProperties).toBe(false);
    expect(projectionContract.properties.status.enum)
      .toEqual(lifecycleStatuses);
    expect(projectionContract.properties.location.enum)
      .toEqual(['internal', 'external']);
    prohibitedFields.forEach((field) => {
      expect(projectionContract.properties).not.toHaveProperty(field);
    });
  });

  it('does not store availability in frontend lifecycle records', () => {
    [...WORKSPACE_CATALOG, ...workspaceRegistry.workspaces].forEach((workspace) => {
      expect(workspace).not.toHaveProperty('availability');
    });
  });

  it('projects location independently of lifecycle and launch behavior', () => {
    const byKey = Object.fromEntries(
      projectionSnapshot.map((workspace) => [workspace.key, workspace]),
    );
    expect(projectionContract.properties.location.enum).toEqual(['internal', 'external']);
    expect(projectionContract.properties).not.toHaveProperty('availability');
    expect(projectionContract.properties).not.toHaveProperty('launchMode');
    expect(projectionContract.properties).not.toHaveProperty('external');
    expect(projectionContract.properties).not.toHaveProperty('permission');
    expect(byKey.legal).toEqual(expect.objectContaining({
      status: 'live',
      location: 'internal',
    }));
    expect(byKey.comunidad).toEqual(expect.objectContaining({
      status: 'live',
      location: 'external',
    }));
    expect(byKey.empresa).toEqual(expect.objectContaining({
      status: 'preview',
      location: 'internal',
    }));
  });

  it('keeps lifecycle separate from availability, which remains derived', () => {
    expect(workspaceRegistry.lifecycles).toEqual(lifecycleStatuses);
    expect(WORKSPACE_CATALOG.every((workspace) => (
      lifecycleStatuses.includes(workspace.status)
    ))).toBe(true);
    expect(deriveAvailability('live')).toBe('open');
    expect(deriveAvailability('preview')).toBe('open');
    expect(deriveAvailability('declared')).toBe('closed');
    expect(deriveAvailability('deprecated')).toBe('closed');
    expect(WORKSPACE_CATALOG.some((workspace) => (
      Object.prototype.hasOwnProperty.call(workspace, 'availability')
    ))).toBe(false);
  });
});
