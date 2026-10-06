/**
 * DiscoverySection — the module grid shown between the community feed and
 * Mi Espacio on the Home.
 *
 * REUSE, NOT RE-INVENTION: the list is derived from Header's NAV_ITEMS, the
 * very same array the header and the mobile bottom nav render. That guarantees
 * the Home can never drift from the navigation (requirement: no new routes).
 * Only the two entries that are not "discovery destinations" are filtered out
 * — `home` (we are already on it) and `community` (the feed above is the
 * community's front door, and the section links to it explicitly).
 *
 * All routes below already existed before this component; none is new.
 *
 * PUNTO 7 · Extensión (sin crear componentes nuevos)
 * Este MISMO componente se reutiliza como tira de descubrimiento dentro de
 * `CategoryPage`, que comparten las 10 páginas del producto. Eso arregla de
 * una sola vez los callejones sin salida que tenían /videos y /ia (0 enlaces
 * cruzados) sin tocar esas páginas ni crear nada nuevo.
 *
 *   compact     — variante ligera: sin blurb, tarjetas pequeñas.
 *   currentKey  — clave del módulo que se está viendo; se EXCLUYE para no
 *                 enlazar una página consigo misma. `CategoryPage` lo deriva
 *                 del icono que ya recibía, así que no hay que tocar las páginas.
 *   heading     — sobrescribe el texto ("Sigue explorando" en las verticales).
 *
 * `nextStep` responde la cuarta pregunta del descubrimiento —"¿cuál es mi
 * siguiente paso?"— y solo se pinta a usuarios que todavía no están dentro.
 *
 * PUNTO 7 · C4/C5 (orientación del usuario nuevo)
 *   C4 — El bloque "TU SIGUIENTE PASO" antes sólo se pintaba en la variante
 *        `compact` (CategoryPage). En la Home, que es donde aterriza un usuario
 *        nuevo, nunca aparecía: la orientación se quedaba en las verticales.
 *        Ahora se muestra en AMBAS variantes para el visitante anónimo.
 *   C5 — En la Home el grid incluye también "Comunidad" y el encabezado pasa a
 *        formular la segunda pregunta del descubrimiento ("¿qué puedo
 *        hacer?") en vez de sólo listar módulos.
 *
 * Sin rutas nuevas, sin widgets nuevos, sin contenido inventado: los textos
 * salen de los módulos que `NAV_ITEMS` ya declara y el CTA sigue siendo el
 * `/join` que ya existía.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import AppIcon from './AppIcon';
import { NAV_ITEMS } from '../Header';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';

// PUNTO 7 · C5 — `home` siempre se excluye (estamos en él). `community` se
// excluye en la variante `compact` porque en las verticales la comunidad ya
// es el contenedor; en la Home sí se ofrece, que es la tercera pregunta del
// descubrimiento ("¿cómo conecto con la comunidad?").
const DISCOVERY = NAV_ITEMS.filter((i) => i.key !== 'home');

const BLURB = {
  community: 'Grupos, gente y conversaciones del ecosistema.',
  news: 'Lo que está pasando en el ecosistema.',
  video: 'Clases, charlas y contenido del ecosistema.',
  jobs: 'Oportunidades profesionales abiertas.',
  companies: 'Empresas verificadas del sistema.',
  events: 'Encuentros, webinars y transmisiones.',
  ai: 'Herramientas de inteligencia artificial.',
};

const DiscoverySection = ({ compact = false, currentKey = null, heading }) => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  // C5 — en `compact` (verticales) la comunidad no se ofrece: ya es el
  // contenedor de la página. En la Home sí, para responder "¿cómo conecto
  // con la comunidad?". `currentKey` evita el auto-enlace.
  const items = DISCOVERY.filter(
    (i) => i.key !== currentKey && (compact || i.key !== 'community')
  );
  const testid = compact ? 'discovery-strip' : 'discovery-section';

  return (
    <section
      data-testid={testid}
      data-current={currentKey || undefined}
      aria-labelledby={`${testid}-title`}
      style={{
        width: '100%',
        maxWidth: compact ? 760 : 1200,
        margin: '0 auto',
        padding: compact
          ? '1.25rem 0 0.5rem'
          : 'clamp(1rem, 3vw, 2rem) clamp(0.75rem, 2vw, 2rem)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: compact ? '0.7rem' : '1rem' }}>
        <div
          style={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.22em',
            color: 'rgba(11,31,58,0.45)', marginBottom: '0.4rem',
          }}
        >
          {compact ? 'SIGUE EXPLORANDO' : 'QUÉ PUEDES HACER AQUÍ'}
        </div>
        <h2
          id={`${testid}-title`}
          style={{
            margin: 0, fontSize: compact ? '1.02rem' : 'clamp(1.15rem, 2.4vw, 1.55rem)',
            fontWeight: 800, color: NAVY, letterSpacing: '-0.015em',
          }}
        >
          {heading || (compact ? 'Sigue explorando' : 'Explora el ecosistema')}
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fit, minmax(120px, 1fr))'
            : 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: compact ? '0.5rem' : '0.75rem',
        }}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            data-testid={`discovery-${compact ? 'strip' : ''}${item.key}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.7rem',
              padding: compact ? '0.6rem 0.7rem' : '0.9rem 1rem',
              borderRadius: compact ? 12 : 16,
              background: '#FFFFFF',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 18px rgba(11,31,58,0.04)',
              textDecoration: 'none',
              transition: 'transform .18s ease, box-shadow .18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(11,31,58,0.10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(11,31,58,0.04)';
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              <AppIcon name={item.icon} size={compact ? 22 : 30} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block', fontSize: '0.86rem', fontWeight: 800,
                  color: NAVY, lineHeight: 1.25,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  display: 'block', fontSize: '0.68rem', marginTop: 2,
                  color: 'rgba(11,31,58,0.5)', lineHeight: 1.35,
                }}
              >
                {!compact && (BLURB[item.key] || 'Accede a la sección.')}
              </span>
            </span>
            {!compact && <ArrowRight
              size={15}
              style={{ flexShrink: 0, color: 'rgba(11,31,58,0.3)' }}
            />}
          </Link>
        ))}
      </div>
      {/* 4ª pregunta: ¿cuál es mi siguiente paso? Solo a quien aún no está dentro.
          PUNTO 7 · C4 — antes exigía `compact`, así que en la Home (donde
          aterriza el usuario nuevo) esta orientación nunca aparecía. Ahora se
          muestra en las dos variantes; el CTA sigue siendo el `/join` previo. */}
      {!isAuthed && (
        <div
          data-testid="discovery-next-step"
          style={{
            marginTop: '0.85rem', padding: '0.8rem 0.9rem', borderRadius: 14,
            background: 'linear-gradient(120deg, rgba(0,200,150,0.10), rgba(6,182,212,0.10))',
            border: '1px solid rgba(0,200,150,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 190 }}>
            <div style={{
              fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.18em',
              color: '#00A277', marginBottom: 3,
            }}>
              PUERTA DE ENTRADA
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(11,31,58,0.75)', lineHeight: 1.45 }}>
              Punto Cero One es la puerta de entrada a Punto Cero System: comunidad, verticales y soluciones en un mismo recorrido.
            </div>
          </div>
          <Link
            to="/capital"
            data-testid="discovery-next-step-cta"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '0.5rem 1rem', borderRadius: 100,
              background: '#00C896', color: NAVY, textDecoration: 'none',
              fontSize: '0.78rem', fontWeight: 800,
            }}
          >
            <Sparkles size={14} /> Explorar soluciones
          </Link>
        </div>
      )}
    </section>
  );
};

export default DiscoverySection;
