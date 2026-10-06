import {
  getEcosystem,
  getVertical,
  listAvailableVerticals,
  listVerticals,
  listWorkspacesByVertical,
  verticalExists,
  workspaceBelongsToVertical,
} from '../workspaceRegistryService';

describe('workspaceRegistryService', () => {
  it('delega el catálogo del ecosistema', () => {
    expect(getEcosystem().verticals).toHaveLength(5);
    expect(listVerticals()).toEqual(getEcosystem().verticals);
  });

  it('delega consultas de verticales y workspaces', () => {
    expect(getVertical('legal').key).toBe('legal');
    expect(verticalExists('medical')).toBe(true);
    expect(workspaceBelongsToVertical('medical')).toBe(true);
    expect(listWorkspacesByVertical('legal')).toEqual(['legal']);
  });

  it('delega la disponibilidad de verticales', () => {
    expect(listAvailableVerticals().map((vertical) => vertical.key)).toEqual(['legal', 'medical']);
  });
});
