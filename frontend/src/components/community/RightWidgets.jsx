import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, TrendingUp, Users } from 'lucide-react';
import AppIcon from './AppIcon';
import {
  MarketsWidget, AIOfTheDayWidget, PollWidget,
  CoursesWidget, LaunchesWidget, MarketplaceWidget,
} from './Widgets';
import {
  CryptoLiveWidget, FxLiveWidget, WeatherLiveWidget, RssLiveWidget, YoutubeLiveWidget,
} from './LiveWidgets';
import PresenceDot from './PresenceDot';
import { feedService } from '../../services/feedService';
import { useRealtime } from '../../contexts/RealtimeContext';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';

const LiveTrendingWidget = () => {
  const [items, setItems] = useState(null);
  useEffect(() => {
    feedService.trending().then((d) => setItems(d.hashtags || [])).catch(() => setItems([]));
  }, []);
  if (!items) return null;
  if (items.length === 0) {
    return (
      <Widget title="Tendencias" icon="ai">
        <div style={{ padding: '0.5rem 0.85rem', fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)' }}>
          Aún no hay hashtags en tendencia. Publica con #tuTema para arrancar la conversación.
        </div>
      </Widget>
    );
  }
  return (
    <Widget title="Tendencias" icon="ai">
      {items.map((h) => (
        <Link key={h.tag} to={`/?hashtag=${encodeURIComponent(h.tag)}`}
          data-testid={`right-widget-trend-${h.tag}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.4rem 0.85rem', textDecoration: 'none',
            color: NAVY, fontSize: '0.82rem', fontWeight: 600,
            borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <span style={{ color: '#00A277' }}>#{h.tag}</span>
          <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{h.posts_7d} · 7d</span>
        </Link>
      ))}
    </Widget>
  );
};

/**
 * RightWidgets — LinkedIc/Facebook-style widgets column.
 * News, trends, events, videos, companies, courses, tools, AI.
 */
const RightWidgets = () => {
  return (
    <aside data-testid="community-right-widgets" style={{
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      {/* Noticias — LIVE (RSS con fallback a mock) */}
      <RssLiveWidget feedKey="noticias" title="Noticias del ecosistema" />

      {/* Tendencias — LIVE from /api/feed/trending, falls back to editorial defaults */}
      <LiveTrendingWidget />
      <Widget title="Tendencias editoriales" icon="ai">
        <TrendRow n={1} label="#PuntoCeroLegal" meta="Producto LIVE" />
        <TrendRow n={2} label="#Latam18" meta="Ecosistema regional" />
        <TrendRow n={3} label="#StartFromZero" meta="Cultura fundadora" />
        <TrendRow n={4} label="#IAaplicada" meta="Casos reales" />
      </Widget>

      {/* Eventos */}
      <Widget title="Próximos eventos" icon="events">
        <EventRow month="MAR" day="12" title="Investor Roundtable" hint="Bogotá · Presencial" />
        <EventRow month="ABR" day="03" title="Legal Tech Latam" hint="Online · Gratis" />
      </Widget>

      {/* Empresas */}
      <Widget title="Empresas del ecosistema" icon="companies">
        <CompanyRow tag="Legal · vertical" name="Punto Cero Legal" href="https://puntocerolegal.com" external />
      </Widget>

      {/* Investor Center · Strategic Growth (NO es vertical) */}
      <Widget title="Investor Center" icon="capital">
        <CompanyRow tag="Strategic growth · institucional" name="Punto Cero · Capital" to="/capital" />
      </Widget>

      {/* IA · Herramientas */}
      <Widget title="IA & Herramientas" icon="ai">
        <ToolRow icon="ai" label="Asistente Legal (beta)" hint="Punto Cero Legal" />
        <ToolRow icon="capital" label="Simulador de Capital" hint="Escenarios financieros" />
        <ToolRow icon="learn" label="Academia" hint="Próximamente" />
      </Widget>

      {/* Integrated modules — fill any remaining space with life */}
      <CryptoLiveWidget />
      <FxLiveWidget />
      <WeatherLiveWidget />
      <YoutubeLiveWidget />
      <MarketsWidget />
      <AIOfTheDayWidget />
      <PollWidget />
      <LaunchesWidget />
      <CoursesWidget />
      <MarketplaceWidget />

      {/* People suggestions — pulled from the feed's most active recent authors */}
      <SuggestedPeople />

      {/* CTA Capital */}
      <Link to="/capital" data-testid="widgets-capital-cta" style={{ textDecoration: 'none' }}>
        <motion.div whileHover={{ y: -2 }} style={{
          padding: '1rem 1.1rem', borderRadius: 16,
          background: `linear-gradient(135deg, #0A0F1C 0%, #1E1B4B 60%, #4C1D95 100%)`,
          color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '0.35rem',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 120, height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${GOLD}66 0%, transparent 70%)`,
            filter: 'blur(20px)', pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            <AppIcon name="capital" size={22} variant="mono-light" />
            <span style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: GOLD }}>
              INVESTOR CENTER
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, position: 'relative' }}>
            Explora la experiencia Capital
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', position: 'relative' }}>
            Executive Summary · Pitch Deck · Roadmap
          </div>
          <div style={{
            marginTop: '0.35rem', fontSize: '0.72rem',
            display: 'flex', alignItems: 'center', gap: '0.35rem', color: GOLD, fontWeight: 700,
            position: 'relative',
          }}>
            Entrar <ArrowUpRight size={14} />
          </div>
        </motion.div>
      </Link>
    </aside>
  );
};

const Widget = ({ title, icon, children }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '0.95rem 1rem 0.8rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
      color: 'rgba(11,31,58,0.55)', marginBottom: '0.7rem',
    }}>
      <AppIcon name={icon} size={16} /> <span>{title.toUpperCase()}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      {children}
    </div>
  </div>
);

const NewsRow = ({ title, hint }) => (
  <a href="#news" style={{
    display: 'block', padding: '0.4rem 0', textDecoration: 'none',
    borderBottom: '1px solid rgba(11,31,58,0.05)',
  }}>
    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY, lineHeight: 1.35 }}>{title}</div>
    <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)', marginTop: '0.15rem' }}>{hint}</div>
  </a>
);

const TrendRow = ({ n, label, meta }) => (
  <a href="#trends" style={{
    display: 'flex', gap: '0.6rem', padding: '0.35rem 0', textDecoration: 'none', alignItems: 'flex-start',
  }}>
    <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.4)', fontWeight: 700, marginTop: 2 }}>
      {String(n).padStart(2, '0')}
    </span>
    <div>
      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>
        <TrendingUp size={10} style={{ verticalAlign: -1, marginRight: 3 }} />{meta}
      </div>
    </div>
  </a>
);

const EventRow = ({ month, day, title, hint }) => (
  <div style={{
    display: 'flex', gap: '0.7rem', padding: '0.45rem 0',
    borderBottom: '1px solid rgba(11,31,58,0.05)', alignItems: 'center',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: 'linear-gradient(135deg, #0B1F3A, #1E3A8A)',
      color: '#FFFFFF', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontSize: '0.5rem', letterSpacing: '0.14em', fontWeight: 700 }}>{month}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1 }}>{day}</span>
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: NAVY, lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</div>
    </div>
  </div>
);

const CompanyRow = ({ tag, name, href, to, external }) => {
  const Comp = to ? Link : 'a';
  const props = to ? { to } : { href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) };
  return (
    <Comp {...props} style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.45rem 0', textDecoration: 'none',
      borderBottom: '1px solid rgba(11,31,58,0.05)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: '#0B1F3A', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1rem',
        flexShrink: 0,
      }}>0</div>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY }}>{name}</div>
        <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>{tag}</div>
      </div>
    </Comp>
  );
};

const ToolRow = ({ icon, label, hint }) => (
  <a href="#tools" style={{
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.4rem 0', textDecoration: 'none',
  }}>
    <AppIcon name={icon} size={20} />
    <div>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</div>
    </div>
  </a>
);

export default RightWidgets;

/* ============================================================================
   SuggestedPeople — surfaced from recent feed authors, with realtime presence.
   ========================================================================== */
const SuggestedPeople = () => {
  const [people, setPeople] = useState(null);
  const { subscribe } = useRealtime();

  useEffect(() => {
    let cancelled = false;
    // Pull the last page of feed posts and dedupe by author.
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/feed/posts?limit=15`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (cancelled) return;
        const seen = new Set();
        const out = [];
        for (const p of (d.items || [])) {
          const a = p.author;
          if (!a?.id || seen.has(a.id)) continue;
          seen.add(a.id);
          out.push({ id: a.id, name: a.name, headline: a.headline || 'Miembro', picture: a.picture });
          if (out.length >= 5) break;
        }
        setPeople(out);
      })
      .catch(() => setPeople([]));
    return () => { cancelled = true; };
  }, []);

  // Re-render when a new SSE notification arrives (a friendly signal that
  // there's activity — presence dots auto-refresh on their own too).
  useEffect(() => subscribe('notification', () => { /* just triggers presence update */ }), [subscribe]);

  if (!people || people.length === 0) return null;
  return (
    <Widget title="Personas sugeridas" icon="community">
      {people.map((u) => (
        <div key={u.id} data-testid={`suggested-person-${u.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.65rem',
            padding: '0.55rem 0.85rem', borderTop: '1px solid rgba(11,31,58,0.05)',
          }}>
          <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
            {u.picture ? (
              <img src={u.picture} alt={u.name} referrerPolicy="no-referrer"
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.85rem',
              }}>{(u.name || 'M').charAt(0).toUpperCase()}</div>
            )}
            <PresenceDot userId={u.id} size={9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.name}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.headline}
            </div>
          </div>
          <button style={{
            padding: '0.3rem 0.65rem', borderRadius: 100,
            background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.4)',
            color: '#00A277', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
          }}>+ Seguir</button>
        </div>
      ))}
    </Widget>
  );
};
