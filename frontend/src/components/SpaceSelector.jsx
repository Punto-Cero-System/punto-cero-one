import React from 'react';
import { getSpace, COMING_SOON_LABEL } from '../config/workspaceSpaces';

/**
 * SpaceSelector — FASE 3B: selector de espacio tras el login.
 *
 * Responsabilidad ÚNICA: pintar opciones y devolver la elegida.
 *
 * NO hace fetch, NO lee el token, NO calcula permisos.
 * Recibe `spaces` (de `identity.available_spaces`) y entrega `onSelect(spaceKey)`.
 * Las etiquetas y rutas salen del catálogo existente `workspaceSpaces.js`:
 * no se inventan strings ni rutas.
 */
const SpaceSelector = ({ spaces = [], onSelect, title = '¿Dónde quieres entrar?' }) => {
  const disponibles = (spaces || []).map((key) => getSpace(key)).filter(Boolean);

  if (!disponibles.length) {
    return (
      <section data-testid="space-selector-empty" className="space-selector space-selector--empty">
        <h2>Tu cuenta está creada</h2>
        <p>No tienes espacios asignados todavía.</p>
      </section>
    );
  }

  return (
    <section data-testid="space-selector" className="space-selector">
      <h2>{title}</h2>
      <ul className="space-selector__list">
        {disponibles.map((space) => {
          const comingSoon = space.status === 'coming_soon';
          return (
            <li key={space.key} className="space-selector__item">
              <button
                type="button"
                data-testid={`space-option-${space.key}`}
                onClick={() => !comingSoon && onSelect && onSelect(space.key)}
                disabled={comingSoon}
                aria-label={space.label}
              >
                <span aria-hidden="true">{space.emoji}</span>
                <span className="space-selector__label">{space.label}</span>
                {comingSoon && <span className="space-selector__badge">{COMING_SOON_LABEL}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default SpaceSelector;
