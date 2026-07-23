import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LogOut, Filter, Search, RefreshCcw, Shield, Users, ArrowRight,
  Clock, Loader, CheckCircle, XCircle, ChevronRight, ExternalLink, Mail, Building2, Globe2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STATUS_META = {
  pending: { label: 'Pendiente', color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.35)', icon: Clock },
  under_review: { label: 'En revisión', color: '#7CC4FF', bg: 'rgba(124,196,255,0.1)', border: 'rgba(124,196,255,0.3)', icon: Loader },
  approved: { label: 'Aprobada', color: '#00C896', bg: 'rgba(0,200,150,0.12)', border: 'rgba(0,200,150,0.35)', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: '#ff8080', bg: 'rgba(255,128,128,0.1)', border: 'rgba(255,128,128,0.3)', icon: XCircle },
};

const STATUSES = ['pending', 'under_review', 'approved', 'rejected'];

const AdminDashboardPage = () => {
  const { user, logout, authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '100');

      const [listRes, statsRes] = await Promise.all([
        authFetch(`/api/admin/investor-requests?${params.toString()}`),
        authFetch(`/api/admin/investor-requests/stats`),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setItems(data.items);
        setTotal(data.total);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateStatus = async (id, status, admin_notes) => {
    const res = await authFetch(`/api/admin/investor-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_notes }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
      setSelected(updated);
      // refresh stats
      const s = await authFetch(`/api/admin/investor-requests/stats`);
      if (s.ok) setStats(await s.json());
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)', color: '#FFFFFF' }}
      data-testid="admin-dashboard"
    >
      {/* Top bar */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(11,31,58,0.85)', backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 700 }}>PUNTO CERO</span>
              <span style={{ color: '#00C896', fontWeight: 700 }}>SYSTEM</span>
            </Link>
            <div style={{ height: '18px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.8rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '100px' }}>
              <Shield size={12} color="#D4AF37" />
              <span style={{ fontSize: '0.7rem', color: '#D4AF37', fontWeight: 700, letterSpacing: '0.2em' }}>ADMIN CONSOLE</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }} data-testid="admin-user-email">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="interactive"
              data-testid="admin-logout"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.95rem', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '100px',
                color: '#FFFFFF', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <LogOut size={13} /> Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#00C896', letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.75rem' }}>
              INVESTOR ACCESS REQUESTS
            </div>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              Solicitudes de acceso <span style={{ fontWeight: 700 }}>al Investor Room</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: '0.75rem', fontWeight: 300 }}>
              Revisa, filtra y actualiza el estado de cada solicitud.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="interactive"
            data-testid="admin-refresh"
            style={{
              padding: '0.7rem 1.1rem', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px',
              color: '#FFFFFF', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <RefreshCcw size={13} className={loading ? 'spin' : ''} /> {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>

        {/* Stats orbital */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          <StatOrb label="Total" value={stats?.total ?? '—'} color="#FFFFFF" ring="rgba(255,255,255,0.2)" testid="stat-total" />
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            return (
              <StatOrb
                key={s}
                label={meta.label}
                value={stats?.[s] ?? '—'}
                color={meta.color}
                ring={meta.border}
                testid={`stat-${s}`}
              />
            );
          })}
        </div>

        {/* Filters */}
        <div style={{
          padding: '1.25rem', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
          display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.2em', fontWeight: 700 }}>
            <Filter size={12} /> FILTRAR
          </div>
          <FilterChip label="Todos" active={statusFilter === ''} onClick={() => setStatusFilter('')} testid="filter-all" />
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              label={STATUS_META[s].label}
              color={STATUS_META[s].color}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              testid={`filter-${s}`}
            />
          ))}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search
              size={13}
              style={{ position: 'absolute', top: '50%', left: '0.85rem', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}
            />
            <input
              data-testid="admin-search"
              placeholder="Buscar por nombre, email, empresa, país…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadData(); }}
              style={{
                width: '100%', padding: '0.6rem 0.9rem 0.6rem 2.25rem',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '100px', color: '#FFFFFF', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#00C896')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px', overflow: 'hidden',
          }}
          data-testid="admin-requests-table"
        >
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1.4fr 1fr 1.2fr 40px',
            padding: '0.9rem 1.25rem', gap: '1rem',
            background: 'rgba(255,255,255,0.03)',
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.2em', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)',
          }} className="hide-mobile-grid">
            <div>NOMBRE / EMAIL</div>
            <div>EMPRESA · ROL</div>
            <div>PAÍS · ENFOQUE</div>
            <div>ENVIADO</div>
            <div>ESTADO</div>
            <div />
          </div>

          {items.length === 0 && !loading && (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }} data-testid="admin-empty">
              No hay solicitudes que coincidan con los filtros.
            </div>
          )}

          <AnimatePresence initial={false}>
            {items.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelected(req)}
                data-testid={`request-row-${req.id}`}
                className="interactive request-row"
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1.4fr 1fr 1.2fr 40px',
                  gap: '1rem', padding: '1.15rem 1.25rem', alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{req.fullName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{req.email}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>{req.company || '—'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{req.role || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>{req.country || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{req.focus || '—'}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                  {new Date(req.submitted_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div>
                  <StatusBadge status={req.status} />
                </div>
                <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
              </motion.div>
            ))}
          </AnimatePresence>

          <div style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)' }} data-testid="admin-total-line">
            {items.length} de {total} solicitudes
          </div>
        </div>
      </main>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 260 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: '560px', maxWidth: '100%',
                background: '#0B1F3A', borderLeft: '1px solid rgba(255,255,255,0.08)',
                zIndex: 70, overflowY: 'auto',
              }}
              data-testid="request-detail-drawer"
            >
              <DetailPanel
                request={selected}
                onClose={() => setSelected(null)}
                onUpdate={updateStatus}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .request-row:hover { background: rgba(255,255,255,0.03); }
        @media (max-width: 900px) {
          .hide-mobile-grid { display: none !important; }
        }
      `}</style>
    </div>
  );
};

// ------------- sub-components -------------

const StatOrb = ({ label, value, color, ring, testid }) => (
  <div
    data-testid={testid}
    style={{
      position: 'relative', padding: '1.5rem', textAlign: 'left',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px',
      overflow: 'hidden',
    }}
  >
    <div style={{
      position: 'absolute', top: '-30px', right: '-30px',
      width: '110px', height: '110px', borderRadius: '50%',
      border: `1px dashed ${ring}`, opacity: 0.7,
    }} />
    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.75rem' }}>
      {label.toUpperCase()}
    </div>
    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.5rem', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
      {value}
    </div>
  </div>
);

const FilterChip = ({ label, active, onClick, color = '#00C896', testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className="interactive"
    style={{
      padding: '0.45rem 0.95rem',
      background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '100px',
      color: active ? color : 'rgba(255,255,255,0.7)',
      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    }}
  >
    {label}
  </button>
);

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span
      data-testid={`status-badge-${status}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.3rem 0.75rem', background: meta.bg,
        border: `1px solid ${meta.border}`, borderRadius: '100px',
        color: meta.color, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
      }}
    >
      <Icon size={11} /> {meta.label}
    </span>
  );
};

const DetailPanel = ({ request, onClose, onUpdate }) => {
  const [notes, setNotes] = useState(request.admin_notes || '');
  const [saving, setSaving] = useState(null);

  useEffect(() => setNotes(request.admin_notes || ''), [request.id, request.admin_notes]);

  const handleChangeStatus = async (status) => {
    setSaving(status);
    await onUpdate(request.id, status, notes);
    setSaving(null);
  };

  return (
    <div style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <StatusBadge status={request.status} />
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.6rem', fontWeight: 600, marginTop: '0.75rem', letterSpacing: '-0.02em' }}>
            {request.fullName}
          </h2>
          <a
            href={`mailto:${request.email}`}
            style={{ color: '#00C896', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', textDecoration: 'none' }}
            data-testid="detail-email-link"
          >
            <Mail size={13} /> {request.email}
          </a>
        </div>
        <button
          onClick={onClose}
          data-testid="detail-close"
          className="interactive"
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '100px', padding: '0.5rem 0.9rem', color: 'rgba(255,255,255,0.7)',
            fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>

      <InfoRow icon={Building2} label="Empresa · Rol" value={[request.company, request.role].filter(Boolean).join(' · ') || '—'} />
      <InfoRow icon={Globe2} label="País · Enfoque" value={[request.country, request.focus].filter(Boolean).join(' · ') || '—'} />
      <InfoRow icon={Clock} label="Recibida" value={new Date(request.submitted_at).toLocaleString('es-CO')} />
      {request.updated_at && request.updated_at !== request.submitted_at && (
        <InfoRow icon={RefreshCcw} label="Última actualización" value={new Date(request.updated_at).toLocaleString('es-CO')} />
      )}

      <div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.6rem' }}>
          MENSAJE ESTRATÉGICO
        </div>
        <div style={{
          padding: '1.15rem', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px',
          color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', lineHeight: 1.6,
        }}>
          {request.message || <span style={{ color: 'rgba(255,255,255,0.4)' }}>Sin mensaje.</span>}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.6rem' }}>
          NOTAS INTERNAS
        </div>
        <textarea
          data-testid="detail-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas privadas del equipo administrativo…"
          rows={4}
          style={{
            width: '100%', padding: '0.9rem 1rem',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', color: '#FFFFFF', fontSize: '0.9rem',
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#00C896')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>

      <div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.75rem' }}>
          ACTUALIZAR ESTADO
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const isCurrent = request.status === s;
            return (
              <button
                key={s}
                onClick={() => handleChangeStatus(s)}
                disabled={saving !== null}
                data-testid={`update-status-${s}`}
                className="interactive"
                style={{
                  padding: '0.6rem 1.1rem',
                  background: isCurrent ? meta.bg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCurrent ? meta.border : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '100px',
                  color: isCurrent ? meta.color : 'rgba(255,255,255,0.75)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: saving && saving !== s ? 0.5 : 1,
                }}
              >
                {saving === s ? 'Guardando…' : meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%',
      background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={14} color="#00C896" />
    </div>
    <div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.25rem' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)' }}>{value}</div>
    </div>
  </div>
);

export default AdminDashboardPage;
