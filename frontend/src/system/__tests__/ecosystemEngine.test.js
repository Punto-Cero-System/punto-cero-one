import {
  getEcosystem,
  getVertical,
  listAvailableVerticals,
  listVerticals,
  listWorkspacesByVertical,
  verticalExists,
  workspaceBelongsToVertical,
} from '../ecosystemEngine';

describe('ecosystemEngine', () => {
  it('expone el ecosistema registrado', () => {
    expect(getEcosystem()).toEqual(expect.objectContaining({ verticals: expect.any(Array) }));
    expect(getEcosystem().verticals).toHaveLength(5);
  });

  it('lista las cinco verticales iniciales', () => {
    expect(listVerticals().map((vertical) => vertical.key)).toEqual([
      'legal',
      'medical',
      'odontologia',
      'psicologia',
      'enfermeria',
    ]);
  });

  it('obtiene una vertical existente', () => {
    expect(getVertical('LEGAL')).toEqual(expect.objectContaining({
      key: 'legal',
      name: 'Punto Cero Legal',
    }));
  });

  it('comprueba si una vertical existe', () => {
    expect(verticalExists('medical')).toBe(true);
    expect(verticalExists('unknown')).toBe(false);
  });

  it('comprueba la pertenencia de un workspace', () => {
    expect(workspaceBelongsToVertical('legal')).toBe(true);
    expect(workspaceBelongsToVertical('unknown')).toBe(false);
  });

  it('lista workspaces de una vertical', () => {
    expect(listWorkspacesByVertical('medical')).toEqual(['medical']);
    expect(listWorkspacesByVertical('unknown')).toEqual([]);
  });

  it('lista sólo verticales disponibles', () => {
    expect(listAvailableVerticals().map((vertical) => vertical.key)).toEqual([
      'legal',
      'medical',
    ]);
  });

  it('devuelve undefined para una vertical inexistente', () => {
    expect(getVertical('unknown')).toBeUndefined();
  });
});
