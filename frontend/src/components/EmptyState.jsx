/**
 * EmptyState — estado vacío como EXPERIENCIA DE ACTIVACIÓN.
 *
 * ORIGEN (regla 6 · reutilizar antes de crear)
 * Este componente no es una invención: es el `EmptyState` que ya existía
 * dentro de `MarketplacePage.jsx` (cohete + título + cuerpo), promovido a
 * compartido y EXTENDIDO. `MarketplacePage` ahora lo importa, así que no
 * existe código duplicado y su `data-testid="marketplace-empty"` se conserva.
 *
 * QUÉ CAMBIA RESPECTO AL ORIGINAL
 * Antes: "Sin datos" y un párrafo. Un callejón sin salida.
 * Ahora responde siempre las tres preguntas del producto:
 *
 *   1. ¿Qué está pasando?   → `title`
 *   2. ¿Por qué importa?     → `why`
 *   3. ¿Qué puedo hacer?     → `actions` (CTAs a rutas YA existentes)
 *
 * REGLAS QUE RESPETA
 *   · No inventa datos ni contenido: no rellena la lista con placeholders.
 *   · No crea rutas: cada CTA apunta a una ruta que ya existe.
 *   · No inventa funcionalidades: si la capacidad no existe, no se ofrece.
 *
 * Props:
 *   testid   data-testid del contenedor (compatible con los ya usados).
 *   icon     nombre de AppIcon, opcional. Sin él cae al cohete original.
 *   title    ¿Qué está pasando?
 *   why      ¿Por qué importa?
 *   body     alias de `why` (compatibilidad con el EmptyState original).
 *   actions  [{ label, to?, href?, onClick?, kind? }] — CTAs de activación.
 *   tone     'default' | 'dark' para fondos oscuros.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './community/AppIcon';

const NAVY = '#0B1F3A';

const btn = (kind, accent) => ({
  primary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0.6rem 1.15rem', borderRadius: 100, border: 'none',
    background: accent, color: NAVY, fontWeight: 800,
    fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'none',
  },
  ghost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0.6rem 1.15rem', borderRadius: 100,
    background: 'transparent', color: NAVY, fontWeight: 700,
    fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'none',
    border: '1px solid rgba(11,31,58,0.15)',
  },
}[kind] || {});

const EmptyState = ({
  testid, icon, title, why, body, actions = [], accent = '#00C896',
}) => {
  const reason = why || body;
  return (
    <div
      data-testid={testid}
      style={{
        background: '#FFFFFF', borderRadius: 22, padding: '3rem 1.75rem',
        textAlign: 'center', border: '1px dashed rgba(11,31,58,0.15)',
      }}
    >
      <div style={{ marginBottom: '0.9rem' }}>
        {icon
          ? <AppIcon name={icon} size={40} />
          : <div style={{ fontSize: '2.4rem' }}>🚀</div>}
      </div>

      {/* 1 · ¿Qué está pasando? */}
      <h3
        style={{
          margin: 0, fontFamily: '"Space Grotesk", sans-serif',
          color: NAVY, fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      {/* 2 · ¿Por qué importa? */}
      {reason && (
        <p
          style={{
            maxWidth: 520, margin: '0.7rem auto 0',
            color: 'rgba(11,31,58,0.62)', lineHeight: 1.55, fontSize: '0.9rem',
          }}
        >
          {reason}
        </p>
      )}

      {/* 3 · ¿Qué puedo hacer ahora? */}
      {actions.length > 0 && (
        <div
          style={{
            display: 'flex', gap: '0.55rem', justifyContent: 'center',
            flexWrap: 'wrap', marginTop: '1.25rem',
          }}
        >
          {actions.map((a) => {
            const style = btn(a.kind || 'ghost', accent);
            if (a.to) {
              return (
                <Link key={a.label} to={a.to} data-testid={a.testid} style={style}>
                  {a.label}
                </Link>
              );
            }
            if (a.href) {
              return (
                <a key={a.label} href={a.href} data-testid={a.testid} style={style}>
                  {a.label}
                </a>
              );
            }
            return (
              <button key={a.label} type="button" onClick={a.onClick} data-testid={a.testid} style={style}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
export { EmptyState };
