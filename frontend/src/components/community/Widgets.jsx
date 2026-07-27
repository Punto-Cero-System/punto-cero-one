import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CloudSun, TrendingUp, TrendingDown, Play, ArrowUpRight, Sparkles, Calendar } from 'lucide-react';
import AppIcon from './AppIcon';

const NAVY = '#0B1F3A';

/* ---------------------------------------------------------------------------
   Reusable widget shell (LinkedIn-style compact card).
   --------------------------------------------------------------------------- */
export const WidgetCard = ({ title, icon, action, children, tint }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
    padding: '0.9rem 1rem 0.8rem',
    position: 'relative', overflow: 'hidden',
  }}>
    {tint && (
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent, ${tint}, transparent)`,
      }} />
    )}
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      marginBottom: '0.6rem',
    }}>
      {icon && <AppIcon name={icon} size={16} />}
      <span style={{
        fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
        color: 'rgba(11,31,58,0.55)', flex: 1,
      }}>{title.toUpperCase()}</span>
      {action}
    </div>
    <div>{children}</div>
  </div>
);

/* ---------------------------------------------------------------------------
   Placeholder state for widgets awaiting future integration.
   --------------------------------------------------------------------------- */
export const ComingSoon = ({ label = 'Próximamente' }) => (
  <div style={{
    padding: '0.9rem 0.6rem', textAlign: 'center',
    background: 'rgba(11,31,58,0.03)', borderRadius: 10,
    border: '1px dashed rgba(11,31,58,0.1)',
  }}>
    <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ fontSize: '0.6rem', color: 'rgba(11,31,58,0.4)', marginTop: 2, letterSpacing: '0.12em' }}>
      CONECTANDO INTEGRACIÓN…
    </div>
  </div>
);

/* ---------------------------------------------------------------------------
   Individual widgets (each compact — no giant blocks).
   --------------------------------------------------------------------------- */
export const WeatherWidget = () => (
  <WidgetCard title="Clima · LatAm" icon="travel" tint="#06B6D4">
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
      <CloudSun size={30} color="#06B6D4" />
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: NAVY, lineHeight: 1 }}>24°C</div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.55)' }}>Bogotá · Nublado</div>
      </div>
    </div>
  </WidgetCard>
);

export const MarketsWidget = () => {
  const rows = [
    { t: 'BTC', v: '$67,240', d: 2.4 },
    { t: 'USD/COP', v: '$3,910', d: -0.3 },
    { t: 'S&P 500', v: '5,438', d: 0.8 },
  ];
  return (
    <WidgetCard title="Mercados" icon="capital" tint="#D4AF37">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {rows.map((r) => (
          <div key={r.t} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.25rem 0',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: NAVY }}>{r.t}</span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.75)' }}>{r.v}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.68rem', fontWeight: 700,
              color: r.d >= 0 ? '#00C896' : '#EF4444',
            }}>
              {r.d >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(r.d)}%
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export const AIOfTheDayWidget = () => (
  <WidgetCard title="IA del día" icon="ai" tint="#22D3EE">
    <div style={{
      padding: '0.7rem 0.85rem',
      borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(139,92,246,0.06))',
      border: '1px solid rgba(34,211,238,0.2)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700,
        color: '#22D3EE', marginBottom: '0.3rem',
      }}>
        <Sparkles size={11} /> PROMPT DEL DÍA
      </div>
      <div style={{ fontSize: '0.8rem', color: NAVY, fontWeight: 600, lineHeight: 1.35 }}>
        "Explica mi contrato en 3 puntos claros"
      </div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.5)', marginTop: 4 }}>
        Ideal para PC Legal · Prueba con tu texto
      </div>
    </div>
  </WidgetCard>
);

export const PollWidget = () => {
  const opts = [
    { label: 'Legal', pct: 42 },
    { label: 'Salud', pct: 21 },
    { label: 'Empleos', pct: 18 },
    { label: 'Otro', pct: 19 },
  ];
  return (
    <WidgetCard title="Encuesta · Comunidad" icon="community" tint="#14B8A6">
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: NAVY, marginBottom: '0.55rem' }}>
        ¿Qué vertical quieres ver primero después de Legal?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {opts.map((o) => (
          <div key={o.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: NAVY, marginBottom: 2 }}>
              <span>{o.label}</span><span style={{ fontWeight: 700 }}>{o.pct}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(11,31,58,0.06)', borderRadius: 100, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} whileInView={{ width: `${o.pct}%` }}
                viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #14B8A6, #06B6D4)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export const CalendarWidget = () => {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleDateString('es', { month: 'short' }).toUpperCase();
  return (
    <WidgetCard title="Calendario" icon="events" tint="#EC4899">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 10,
          background: 'linear-gradient(135deg, #EC4899, #8B5CF6)',
          color: '#FFFFFF', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.5rem', letterSpacing: '0.14em', fontWeight: 700 }}>{month}</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1 }}>{day}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY }}>2 eventos esta semana</div>
          <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>Roundtable · Legal Tech</div>
        </div>
      </div>
    </WidgetCard>
  );
};

export const PodcastWidget = () => (
  <WidgetCard title="Podcast destacado" icon="podcast" tint="#F472B6">
    <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
      <div style={{
        width: 46, height: 46, borderRadius: 10,
        background: 'linear-gradient(135deg, #F472B6, #A855F7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: NAVY, lineHeight: 1.3 }}>
          Empezar desde cero en LatAm
        </div>
        <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>Ep. 03 · 24 min</div>
      </div>
    </div>
  </WidgetCard>
);

export const CoursesWidget = () => (
  <WidgetCard title="Aprende · Cursos" icon="learn" tint="#A855F7">
    <CourseRow title="IA aplicada a Legal" hint="4h · Gratis" tone="#A855F7" />
    <CourseRow title="Fundraising 101" hint="2h · Introductorio" tone="#D4AF37" />
    <ComingSoon label="Más cursos próximamente" />
  </WidgetCard>
);

const CourseRow = ({ title, hint, tone }) => (
  <div style={{
    display: 'flex', gap: '0.6rem', alignItems: 'center',
    padding: '0.4rem 0', borderBottom: '1px solid rgba(11,31,58,0.05)',
  }}>
    <div style={{
      width: 8, height: 8, borderRadius: '50%', background: tone, flexShrink: 0,
      boxShadow: `0 0 6px ${tone}55`,
    }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: NAVY }}>{title}</div>
      <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>{hint}</div>
    </div>
  </div>
);

export const LaunchesWidget = () => (
  <WidgetCard title="Próximos lanzamientos" icon="home" tint="#38BDF8">
    <LaunchRow when="Q2" label="PC Health · beta cerrada" pct={35} tone="#F87171" />
    <LaunchRow when="Q3" label="PC IA Assistant" pct={55} tone="#22D3EE" />
    <LaunchRow when="Q4" label="PC Marketplace" pct={15} tone="#FB923C" />
  </WidgetCard>
);

const LaunchRow = ({ when, label, pct, tone }) => (
  <div style={{ padding: '0.35rem 0' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: NAVY }}>
        <span style={{ color: tone, marginRight: 6 }}>{when}</span>
        {label}
      </span>
      <span style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)', fontWeight: 700 }}>{pct}%</span>
    </div>
    <div style={{ height: 3, background: 'rgba(11,31,58,0.06)', borderRadius: 100, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }} whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }}
        style={{ height: '100%', background: tone }}
      />
    </div>
  </div>
);

export const MarketplaceWidget = () => (
  <WidgetCard title="Marketplace" icon="marketplace" tint="#FB923C">
    <ComingSoon label="Espacio reservado" />
  </WidgetCard>
);

export const CompaniesShoutout = () => (
  <WidgetCard title="Empresa destacada" icon="companies" tint="#94A3B8">
    <Link to="/capital" style={{ textDecoration: 'none' }}>
      <motion.div whileHover={{ x: 2 }} style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#0A0F1C', color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1rem',
        }}>0</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NAVY }}>Punto Cero Capital</div>
          <div style={{ fontSize: '0.66rem', color: 'rgba(11,31,58,0.55)' }}>Investor Center · Ver</div>
        </div>
        <ArrowUpRight size={16} color="rgba(11,31,58,0.4)" style={{ marginLeft: 'auto' }} />
      </motion.div>
    </Link>
  </WidgetCard>
);

/* ---------------------------------------------------------------------------
   Inline widget strip — horizontal row of 3 tiny widgets rendered
   between feed items (keeps the center column dynamic).
   --------------------------------------------------------------------------- */
export const InlineWidgetStrip = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  }} data-testid="feed-inline-widget-strip">
    <MiniStat icon="jobs" label="Empleos abiertos" value="12" tone="#D4AF37" />
    <MiniStat icon="events" label="Eventos LatAm" value="4" tone="#EC4899" />
    <MiniStat icon="ai" label="Prompts trending" value="27" tone="#22D3EE" />
  </div>
);

const MiniStat = ({ icon, label, value, tone }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.75rem 0.85rem', borderRadius: 14,
    background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.06)',
    boxShadow: '0 4px 14px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 10,
      background: `${tone}18`, border: `1px solid ${tone}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <AppIcon name={icon} size={20} />
    </div>
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '0.66rem', letterSpacing: '0.12em', fontWeight: 700, color: 'rgba(11,31,58,0.55)' }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.15rem', fontWeight: 700, color: NAVY, lineHeight: 1 }}>
        {value}
      </span>
    </div>
  </div>
);
