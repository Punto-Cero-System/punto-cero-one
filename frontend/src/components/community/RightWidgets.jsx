import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import AppIcon from './AppIcon';
import {
  MarketsWidget, AIOfTheDayWidget, PollWidget,
  CoursesWidget, LaunchesWidget, MarketplaceWidget,
} from './Widgets';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';

/**
 * RightWidgets — LinkedIc/Facebook-style widgets column.
 * News, trends, events, videos, companies, courses, tools, AI.
 */
const RightWidgets = () => {
  return (
    <aside data-testid="community-right-widgets" style={{
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      {/* Noticias */}
      <Widget title="Noticias del ecosistema" icon="news">
        <NewsRow title="Punto Cero Legal LIVE en producción" hint="Primer vertical operativo" />
        <NewsRow title="Founding team consolidado" hint="Darwin y Jonathan lideran el ecosistema" />
        <NewsRow title="Roadmap 2026 publicado" hint="Ver en Capital · Roadmap" />
      </Widget>

      {/* Tendencias */}
      <Widget title="Tendencias" icon="ai">
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
      <MarketsWidget />
      <AIOfTheDayWidget />
      <PollWidget />
      <LaunchesWidget />
      <CoursesWidget />
      <MarketplaceWidget />

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
