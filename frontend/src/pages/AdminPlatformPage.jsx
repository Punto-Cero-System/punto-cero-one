import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Building2, MessagesSquare, Briefcase, Calendar, Flag, Activity, BarChart3, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminPlatformService } from '../services/coreServices';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

const TABS = [
  { key: 'summary',   label: 'Resumen',        icon: BarChart3 },
  { key: 'users',     label: 'Usuarios',       icon: Users },
  { key: 'companies', label: 'Empresas',       icon: Building2 },
  { key: 'posts',     label: 'Publicaciones',  icon: MessagesSquare },
  { key: 'jobs',      label: 'Empleos',        icon: Briefcase },
  { key: 'events',    label: 'Eventos',        icon: Calendar },
  { key: 'reports',   label: 'Reportes',       icon: Flag },
  { key: 'activity',  label: 'Activity Log',   icon: Activity },
];

const AdminPlatformPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('summary');
  const [data, setData] = useState({});

  const load = useCallback(async () => {
    try {
      if (tab === 'summary') setData(await adminPlatformService.summary());
      else if (tab === 'users') setData(await adminPlatformService.users({ limit: 100 }));
      else if (tab === 'companies') setData(await adminPlatformService.companies({ limit: 100 }));
      else if (tab === 'posts') setData(await adminPlatformService.posts({ limit: 100 }));
      else if (tab === 'jobs') setData(await adminPlatformService.jobs({ limit: 100 }));
      else if (tab === 'events') setData(await adminPlatformService.events({ limit: 100 }));
      else if (tab === 'reports') setData(await adminPlatformService.reports({ resolved: false }));
      else if (tab === 'activity') setData(await adminPlatformService.activity({ limit: 200 }));
    } catch (e) { setData({ error: e.message }); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="admin-platform-page" style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)', color: '#FFFFFF' }}>
      <header style={{ background: 'rgba(11,31,58,0.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/admin" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Volver
          </Link>
          <div style={{ height: 18, width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.8rem', borderRadius: 100, background: `${GOLD}18`, border: `1px solid ${GOLD}55` }}>
            <ShieldAlert size={12} color={GOLD} />
            <span style={{ fontSize: '0.7rem', color: GOLD, fontWeight: 700, letterSpacing: '0.2em' }}>UNIFIED ADMIN PLATFORM</span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>{user?.email}</span>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
        <nav data-testid="admin-tabs" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignSelf: 'flex-start' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} data-testid={`admin-tab-${t.key}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.85rem', borderRadius: 10,
                         background: active ? `${EMERALD}18` : 'transparent', border: active ? `1px solid ${EMERALD}55` : '1px solid transparent',
                         color: active ? EMERALD : 'rgba(255,255,255,0.75)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: active ? 700 : 500 }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>
        <main data-testid={`admin-tab-content-${tab}`} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          {tab === 'summary' && data.totals && (
            <div>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem', margin: '0 0 1rem' }}>Métricas globales</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {Object.entries(data.totals).map(([k, v]) => (
                  <div key={k} data-testid={`admin-metric-${k}`} style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{k.toUpperCase()}</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: 4, fontFamily: '"Space Grotesk", sans-serif' }}>{v}</div>
                  </div>
                ))}
                <div style={{ padding: '1rem', background: `${EMERALD}18`, borderRadius: 12, border: `1px solid ${EMERALD}55` }}>
                  <div style={{ fontSize: '0.62rem', letterSpacing: '0.18em', color: EMERALD, fontWeight: 700 }}>ACTIVE 30D</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: 4, fontFamily: '"Space Grotesk", sans-serif' }}>{data.active_users_30d}</div>
                </div>
              </div>
            </div>
          )}
          {(tab === 'users' || tab === 'companies' || tab === 'posts' || tab === 'jobs' || tab === 'events' || tab === 'reports' || tab === 'activity') && Array.isArray(data) && (
            <ResourceTable rows={data} tab={tab} />
          )}
          {data.error && <div style={{ color: '#ff9a9a', fontSize: '0.85rem' }}>{data.error}</div>}
        </main>
      </div>
    </div>
  );
};

const ResourceTable = ({ rows, tab }) => {
  if (rows.length === 0) return <div style={{ color: 'rgba(255,255,255,0.5)' }}>Sin registros.</div>;
  const keys = Object.keys(rows[0]).slice(0, 6);
  return (
    <div data-testid={`admin-table-${tab}`} style={{ overflow: 'auto' }}>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{rows.length} registros</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead>
          <tr>{keys.map((k) => <th key={k} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', fontWeight: 700, fontSize: '0.65rem' }}>{k.toUpperCase()}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || r._id || i} data-testid={`admin-row-${tab}-${i}`}>
              {keys.map((k) => (
                <td key={k} style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof r[k] === 'object' ? JSON.stringify(r[k]).slice(0, 60) : String(r[k] ?? '—').slice(0, 80)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPlatformPage;
