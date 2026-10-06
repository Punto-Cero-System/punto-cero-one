/**
 * FASE 3B — System Login Router: Identity Contract → destino.
 *
 * Casos cubiertos:
 *   1. Un espacio   → redirect a la ruta del catálogo
 *   2. Varios       → mostrar selector
 *   3. Sin espacios → estado seguro (no rompe sesión)
 *   4. Token inválido → null (el login existente gestiona el logout)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { normalizeAccessContext, getAccessContext, EMPTY_ACCESS_CONTEXT } from '../accessContext';
import { resolveEntryFromAccess } from '../systemEntryRules';
import SpaceSelector from '../../components/SpaceSelector';
import { getSpace } from '../../config/workspaceSpaces';

const toPath = (key) => {
  const space = getSpace(key);
  return space ? space.path : '/';
};

describe('normalizeAccessContext', () => {
  it('lee el Identity Contract del Bridge', () => {
    const out = normalizeAccessContext({
      subject_id: 'pc_usr_ABC',
      identity: {
        entity_id: 'pc_usr_ABC',
        system: 'punto_cero_system',
        identity_type: 'personal',
        available_spaces: ['legal', 'comunidad'],
      },
      entitlements: ['workspace.open.legal'],
    });
    expect(out.subjectId).toBe('pc_usr_ABC');
    expect(out.entityId).toBe('pc_usr_ABC');
    expect(out.system).toBe('punto_cero_system');
    expect(out.identityType).toBe('personal');
    expect(out.availableSpaces).toEqual(['legal', 'comunidad']);
  });

  it('tolera un Bridge sin bloque identity (contrato previo)', () => {
    const out = normalizeAccessContext({ subject_id: 'x', entitlements: [] });
    expect(out.availableSpaces).toEqual([]);
    expect(out.entityId).toBeNull();
  });

  it('nunca lanza con entradas inválidas', () => {
    expect(normalizeAccessContext(null)).toEqual({ ...EMPTY_ACCESS_CONTEXT });
    expect(normalizeAccessContext(undefined).availableSpaces).toEqual([]);
    expect(normalizeAccessContext({ identity: null }).availableSpaces).toEqual([]);
  });
});

describe('getAccessContext', () => {
  // Este entorno de test no expone `fetch` global: se instala un mock.
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch.mockReset();
  });

  it('envía el JWT y devuelve el contexto', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ subject_id: 'e', identity: { available_spaces: ['legal'] } }),
    });
    const out = await getAccessContext('tok123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/access/entitlements'),
      { headers: { Authorization: 'Bearer tok123' } },
    );
    expect(out.availableSpaces).toEqual(['legal']);
  });

  it('CASO 4: token inválido (401) → null, sin romper', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(getAccessContext('malo')).resolves.toBeNull();
  });

  it('sin token no hace fetch', async () => {
    await expect(getAccessContext(null)).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fallo de red → null (la sesión sigue viva)', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    await expect(getAccessContext('tok')).resolves.toBeNull();
  });
});

describe('resolveEntryFromAccess', () => {
  it('CASO 1: un solo espacio → redirect', () => {
    const r = resolveEntryFromAccess({ availableSpaces: ['legal'] }, toPath);
    expect(r.action).toBe('redirect');
    expect(r.path).toBe('/workspace/legal');
  });

  it('CASO 2: varios espacios → selector', () => {
    const r = resolveEntryFromAccess({ availableSpaces: ['legal', 'comunidad'] }, toPath);
    expect(r.action).toBe('select');
    expect(r.spaces).toEqual(['legal', 'comunidad']);
    expect(r.path).toBeUndefined();
  });

  it('CASO 3: sin espacios → estado seguro, sin romper sesión', () => {
    const r = resolveEntryFromAccess({ availableSpaces: [] }, toPath);
    expect(r.action).toBe('select');
    expect(r.spaces).toEqual([]);
  });

  it('contexto nulo no rompe', () => {
    expect(resolveEntryFromAccess(null, toPath).action).toBe('select');
  });
});

describe('SpaceSelector (solo UI)', () => {
  it('renderiza las opciones del catálogo y devuelve la elegida', () => {
    const onSelect = jest.fn();
    render(<SpaceSelector spaces={['legal', 'comunidad']} onSelect={onSelect} />);
    expect(screen.getByTestId('space-option-legal')).toBeTruthy();
    expect(screen.getByTestId('space-option-comunidad')).toBeTruthy();
    fireEvent.click(screen.getByTestId('space-option-legal'));
    expect(onSelect).toHaveBeenCalledWith('legal');
  });

  it('usa las etiquetas del catálogo, no strings inventadas', () => {
    render(<SpaceSelector spaces={['comunidad']} onSelect={() => {}} />);
    expect(screen.getByText(getSpace('comunidad').label)).toBeTruthy();
  });

  it('CASO 3: sin espacios muestra estado seguro', () => {
    render(<SpaceSelector spaces={[]} onSelect={() => {}} />);
    expect(screen.getByTestId('space-selector-empty')).toBeTruthy();
    expect(screen.getByText(/No tienes espacios asignados todavía/)).toBeTruthy();
  });

  it('descarta espacios desconocidos del catálogo', () => {
    render(<SpaceSelector spaces={['inventado']} onSelect={() => {}} />);
    expect(screen.getByTestId('space-selector-empty')).toBeTruthy();
  });
});
