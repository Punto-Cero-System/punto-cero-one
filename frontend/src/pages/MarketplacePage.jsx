import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, Users, Briefcase, Calendar, MapPin, ExternalLink } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import FollowButton from '../components/community/FollowButton';
import { companyService, jobService, eventService } from '../services/platformService';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

// Country registry — same 20 that the interactive map exposes.
const COUNTRIES = {
  MX: { name: 'México',           tone: '#3B82F6', flag: '🇲🇽', apiCountry: 'mx' },
  GT: { name: 'Guatemala',        tone: '#8B5CF6', flag: '🇬🇹', apiCountry: 'gt' },
  HN: { name: 'Honduras',         tone: '#EC4899', flag: '🇭🇳', apiCountry: 'hn' },
  SV: { name: 'El Salvador',      tone: '#F59E0B', flag: '🇸🇻', apiCountry: 'sv' },
  NI: { name: 'Nicaragua',        tone: '#EC4899', flag: '🇳🇮', apiCountry: 'ni' },
  CR: { name: 'Costa Rica',       tone: EMERALD,   flag: '🇨🇷', apiCountry: 'cr' },
  PA: { name: 'Panamá',           tone: '#3B82F6', flag: '🇵🇦', apiCountry: 'pa' },
  DO: { name: 'República Dominicana', tone: '#8B5CF6', flag: '🇩🇴', apiCountry: 'do' },
  CU: { name: 'Cuba',             tone: '#F59E0B', flag: '🇨🇺', apiCountry: 'cu' },
  VE: { name: 'Venezuela',        tone: EMERALD,   flag: '🇻🇪', apiCountry: 've' },
  CO: { name: 'Colombia',         tone: GOLD,      flag: '🇨🇴', apiCountry: 'co' },
  EC: { name: 'Ecuador',          tone: '#3B82F6', flag: '🇪🇨', apiCountry: 'ec' },
  PE: { name: 'Perú',             tone: '#EC4899', flag: '🇵🇪', apiCountry: 'pe' },
  BO: { name: 'Bolivia',          tone: '#F59E0B', flag: '🇧🇴', apiCountry: 'bo' },
  BR: { name: 'Brasil',           tone: EMERALD,   flag: '🇧🇷', apiCountry: 'br' },
  PY: { name: 'Paraguay',         tone: '#8B5CF6', flag: '🇵🇾', apiCountry: 'py' },
  CL: { name: 'Chile',            tone: '#3B82F6', flag: '🇨🇱', apiCountry: 'cl' },
  AR: { name: 'Argentina',        tone: GOLD,      flag: '🇦🇷', apiCountry: 'ar' },
  UY: { name: 'Uruguay',          tone: '#EC4899', flag: '🇺🇾', apiCountry: 'uy' },
  PR: { name: 'Puerto Rico',      tone: EMERALD,   flag: '🇵🇷', apiCountry: 'pr' },
};

const TABS = [
  { key: 'companies',      label: 'Empresas',        icon: Building2 },
  { key: 'professionals',  label: 'Profesionales',   icon: Users },
  { key: 'jobs',           label: 'Vacantes',        icon: Briefcase },
  { key: 'events',         label: 'Eventos',         icon: Calendar },
];

/**
 * MarketplacePage — /marketplace/:code
 * Aggregates the country-filtered contents of the ecosystem: companies, jobs,
 * events and (placeholder-for-now) professionals. Uses ONLY existing endpoints
 * with `country=` query param. No backend change required.
 */
const MarketplacePage = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const country = useMemo(() => COUNTRIES[(code || '').toUpperCase()], [code]);
  const [tab, setTab] = useState('companies');
  const [buckets, setBuckets] = useState({ companies: null, jobs: null, events: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!country) return;
    setLoading(true);
    Promise.allSettled([
      companyService.list({ country: country.apiCountry, limit: 24 }),
      jobService.list({ country: country.apiCountry, limit: 24 }),
      eventService.list({ country: country.apiCountry, limit: 24 }),
    ]).then((res) => {
      setBuckets({
        companies: res[0].status === 'fulfilled' ? res[0].value : { items: [] },
        jobs:      res[1].status === 'fulfilled' ? res[1].value : { items: [] },
        events:    res[2].status === 'fulfilled' ? res[2].value : { items: [] },
      });
    }).finally(() => setLoading(false));
  }, [country?.apiCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!country) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: '58px', minHeight: '100vh', background: '#F7F8FC',
                       display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: '4rem' }}>🌎</div>
            <h1 style={{ color: NAVY, fontFamily: '"Space Grotesk", sans-serif', margin: '1rem 0' }}>
              País no reconocido
            </h1>
            <button onClick={() => navigate('/')} style={goBackBtn}>Volver al inicio</button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const activeItems = tab === 'professionals' ? [] : (buckets[tab]?.items || []);
  const totalCounts = {
    companies: buckets.companies?.total ?? buckets.companies?.items?.length ?? 0,
    professionals: 0,
    jobs: buckets.jobs?.total ?? buckets.jobs?.items?.length ?? 0,
    events: buckets.events?.total ?? buckets.events?.items?.length ?? 0,
  };

  return (
    <>
      <Header />
      <main data-testid="marketplace-page" style={{ paddingTop: '58px', background: '#F7F8FC', minHeight: '100vh' }}>
        {/* HERO */}
        <section style={{
          position: 'relative', overflow: 'hidden',
          padding: '4rem 2rem 3rem',
          background: `linear-gradient(160deg, ${NAVY} 0%, ${country.tone}22 60%, ${NAVY} 100%)`,
          color: '#FFFFFF',
        }}>
          <motion.div
            animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 6, repeat: Infinity }}
            style={{
              position: 'absolute', top: '-140px', right: '-140px', width: 460, height: 460,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${country.tone}44 0%, transparent 60%)`,
              filter: 'blur(30px)',
            }} />
          <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative' }}>
            <Link to="/" data-testid="marketplace-back" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.8rem',
              marginBottom: '1.75rem', letterSpacing: '0.08em', fontWeight: 500,
            }}><ArrowLeft size={14} /> Volver al ecosistema</Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.35rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '4rem', lineHeight: 1 }}>{country.flag}</div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{
                  fontSize: '0.68rem', letterSpacing: '0.28em', fontWeight: 700,
                  color: country.tone, marginBottom: '0.7rem',
                }}>MARKETPLACE · {country.name.toUpperCase()}</div>
                <h1 style={{
                  fontFamily: '"Space Grotesk", sans-serif', margin: 0,
                  fontSize: 'clamp(2rem, 4.4vw, 3rem)', fontWeight: 300,
                  letterSpacing: '-0.03em', lineHeight: 1.05,
                }}>
                  Todo el ecosistema en <span style={{ fontWeight: 700, color: country.tone }}>{country.name}</span>.
                </h1>
                <p style={{
                  fontSize: '1rem', lineHeight: 1.65, marginTop: '0.85rem',
                  color: 'rgba(255,255,255,0.72)', fontWeight: 300, maxWidth: 620,
                }}>
                  Empresas verificadas, profesionales, vacantes abiertas y eventos activos
                  — filtrados por país para que descubras oportunidades locales sin ruido.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <FollowButton entityType="country" entityId={code}
                    testid="country-follow-btn" size="md" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TABS */}
        <div style={{ position: 'sticky', top: 58, zIndex: 20, background: '#FFFFFF',
                      borderBottom: '1px solid rgba(11,31,58,0.08)' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 2rem',
                        display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = totalCounts[t.key];
              return (
                <button
                  key={t.key} onClick={() => setTab(t.key)}
                  data-testid={`marketplace-tab-${t.key}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '1.05rem 0.4rem', border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    color: active ? NAVY : 'rgba(11,31,58,0.55)',
                    fontWeight: active ? 700 : 500, fontSize: '0.88rem',
                    borderBottom: active ? `2.5px solid ${country.tone}` : '2.5px solid transparent',
                    whiteSpace: 'nowrap',
                  }}>
                  <t.icon size={16} strokeWidth={active ? 2.4 : 2} />
                  {t.label}
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                    padding: '2px 7px', borderRadius: 100,
                    background: active ? `${country.tone}22` : 'rgba(11,31,58,0.06)',
                    color: active ? country.tone : 'rgba(11,31,58,0.6)',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <section style={{ maxWidth: 1240, margin: '0 auto', padding: '2.5rem 2rem 5rem' }}>
          {loading ? (
            <SkeletonGrid />
          ) : tab === 'professionals' ? (
            <EmptyState title="Profesionales pronto"
              body="Estamos preparando el directorio de profesionales verificados por país. Muy pronto podrás explorar perfiles filtrados por ubicación." />
          ) : activeItems.length === 0 ? (
            <EmptyState title={`Aún sin ${TABS.find(x => x.key === tab).label.toLowerCase()} en ${country.name}`}
              body="Sé el primero: crea el contenido y abre la conversación con el ecosistema local." />
          ) : (
            <div style={{
              display: 'grid', gap: '1.25rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}>
              <AnimatePresence>
                {activeItems.map((item) => (
                  <ResultCard key={item.id} item={item} tab={tab} tone={country.tone} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
};

const ResultCard = ({ item, tab, tone }) => {
  const paths = { companies: `/empresas/${item.id}`, jobs: `/empleos?id=${item.id}`, events: `/eventos?id=${item.id}` };
  const url = paths[tab] || '/';
  const title = item.name || item.title || 'Sin título';
  const subtitle = item.tagline || item.description || item.summary || '';
  const image = item.logo_url || item.banner_url || item.cover_url || item.image_url;

  return (
    <motion.a
      href={url}
      layout
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -3, boxShadow: `0 20px 40px rgba(11,31,58,0.12), 0 0 0 1px ${tone}55` }}
      data-testid={`marketplace-card-${item.id}`}
      style={{
        background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 4px 16px rgba(11,31,58,0.04)',
        textDecoration: 'none', color: 'inherit', cursor: 'pointer',
        display: 'block',
      }}>
      <div style={{
        height: 110, background: image
          ? `linear-gradient(180deg, transparent 30%, rgba(11,31,58,0.6) 100%), url(${image}) center/cover`
          : `linear-gradient(135deg, ${NAVY}, ${tone})`,
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 10, left: 12,
                      fontSize: '0.6rem', letterSpacing: '0.22em', fontWeight: 700,
                      padding: '3px 8px', borderRadius: 100,
                      background: 'rgba(255,255,255,0.15)', color: '#FFFFFF',
                      backdropFilter: 'blur(6px)' }}>
          {tab.toUpperCase().slice(0, -1)}
        </div>
      </div>
      <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: NAVY, margin: 0, marginBottom: '0.35rem',
                     fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: '0.82rem', color: 'rgba(11,31,58,0.6)',
                      margin: 0, marginBottom: '0.85rem', lineHeight: 1.45,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {subtitle}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          {item.city && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                           fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)', fontWeight: 500 }}>
              <MapPin size={11} /> {item.city}
            </span>
          )}
          <Link to={url} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.72rem', color: tone, fontWeight: 700,
            textDecoration: 'none', marginLeft: 'auto',
          }}>
            Ver <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </motion.a>
  );
};

const SkeletonGrid = () => (
  <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
    {[...Array(6)].map((_, i) => (
      <div key={i} style={{
        background: '#FFFFFF', borderRadius: 18, overflow: 'hidden',
        border: '1px solid rgba(11,31,58,0.06)', height: 260,
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="pc-skel" style={{ height: 110 }} />
        <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pc-skel" style={{ height: 14, width: '75%', borderRadius: 4 }} />
          <div className="pc-skel" style={{ height: 10, width: '95%', borderRadius: 4 }} />
          <div className="pc-skel" style={{ height: 10, width: '85%', borderRadius: 4 }} />
        </div>
      </div>
    ))}
    <style>{`
      .pc-skel { background: linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%);
        background-size: 200% 100%; animation: pcSkel 1.4s ease-in-out infinite; }
      @keyframes pcSkel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    `}</style>
  </div>
);

const EmptyState = ({ title, body }) => (
  <div data-testid="marketplace-empty" style={{
    background: '#FFFFFF', borderRadius: 22, padding: '4rem 2rem', textAlign: 'center',
    border: '1px dashed rgba(11,31,58,0.15)',
  }}>
    <div style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>🚀</div>
    <h3 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif',
                 color: NAVY, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h3>
    <p style={{ maxWidth: 480, margin: '0.75rem auto 0',
                color: 'rgba(11,31,58,0.6)', lineHeight: 1.55, fontSize: '0.95rem' }}>{body}</p>
  </div>
);

const goBackBtn = {
  display: 'inline-flex', padding: '0.65rem 1.1rem',
  borderRadius: 100, background: NAVY, color: '#FFFFFF',
  border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
};

export { COUNTRIES };
export default MarketplacePage;
