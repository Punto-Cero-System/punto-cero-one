import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LogOut, Filter, Search, RefreshCcw, Shield, Users, ArrowRight,
  Clock, Loader, CheckCircle, XCircle, ChevronRight, ExternalLink, Mail, Building2, Globe2,
  Sparkles, BarChart3, Presentation, Download, Eye, Timer,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CONTACT_TYPE_LABELS = {
  investor: 'Inversionista',
  strategic_partner: 'Aliado estratégico',
  technology_partner: 'Aliado tecnológico',
  professional: 'Profesional',
  entrepreneur: 'Emprendedor',
  company: 'Empresa',
  other: 'Otro',
};

const SOURCE_LABELS = {
  executive_summary: 'Executive Summary',
  investor_pitch_deck: 'Investor Pitch Deck',
  request_access: 'Formulario de acceso',
};

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

        {/* Pitch Deck Analytics */}
        <PitchDeckAnalyticsPanel />
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
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState(request.admin_notes || '');
  const [saving, setSaving] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(request.admin_notes || '');
    setInvitation(null);
    setInviteError('');
    setCopied(false);
  }, [request.id, request.admin_notes]);

  const handleChangeStatus = async (status) => {
    setSaving(status);
    await onUpdate(request.id, status, notes);
    setSaving(null);
  };

  const handleInvite = async () => {
    setInviteError('');
    setInviting(true);
    try {
      const res = await authFetch(`/api/admin/investor-requests/${request.id}/invite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'No se pudo generar la invitación.');
      setInvitation(data);
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!invitation?.invitation_url) return;
    try {
      await navigator.clipboard.writeText(invitation.invitation_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
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
      {request.contactType && (
        <InfoRow icon={Users} label="Tipo de contacto" value={CONTACT_TYPE_LABELS[request.contactType] || request.contactType} />
      )}
      {request.source && (
        <InfoRow icon={Sparkles} label="Origen del envío" value={SOURCE_LABELS[request.source] || request.source} />
      )}
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

      {/* Investor invitation (FASE 5) */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
        <div style={{ fontSize: '0.68rem', color: '#D4AF37', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={12} /> INVITAR AL INVESTOR ROOM
        </div>

        {!invitation && (
          <>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: '0.9rem' }}>
              Genera una invitación de un solo uso. Se creará un usuario con rol <b>investor</b> y expirará en 7 días.
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting}
              data-testid="invite-investor-btn"
              className="interactive"
              style={{
                padding: '0.75rem 1.4rem',
                background: inviting ? 'rgba(212,175,55,0.35)' : 'linear-gradient(135deg, #D4AF37, #b8942d)',
                color: '#0B1F3A', border: 'none', borderRadius: '100px',
                fontSize: '0.82rem', fontWeight: 700, cursor: inviting ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit',
              }}
            >
              {inviting ? 'Generando…' : (<>Generar invitación <ArrowRight size={13} /></>)}
            </button>
            {inviteError && (
              <div data-testid="invite-error" style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.3)', borderRadius: '10px', color: '#ff9a9a', fontSize: '0.8rem' }}>
                {inviteError}
              </div>
            )}
          </>
        )}

        {invitation && (
          <div data-testid="invite-result" style={{
            padding: '1.15rem', background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.35)', borderRadius: '14px',
          }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#D4AF37', fontWeight: 700, marginBottom: '0.5rem' }}>
              INVITACIÓN GENERADA · CADUCA {new Date(invitation.expires_at).toLocaleDateString('es-CO')}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#FFFFFF', wordBreak: 'break-all', marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', fontFamily: 'monospace' }} data-testid="invite-url">
              {invitation.invitation_url}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={copyLink} data-testid="invite-copy" className="interactive" style={{
                padding: '0.5rem 1rem', background: '#FFFFFF', color: '#0B1F3A',
                border: 'none', borderRadius: '100px', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{copied ? '✓ Copiado' : 'Copiar enlace'}</button>
              <a href={invitation.invitation_url} target="_blank" rel="noreferrer" data-testid="invite-open" style={{
                padding: '0.5rem 1rem', background: 'transparent', color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px',
                fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              }}>Abrir <ExternalLink size={11} /></a>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
              Comparte este enlace con el inversionista para que configure su contraseña.
            </div>
          </div>
        )}
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

// ============================================================================
// PITCH DECK ANALYTICS PANEL
// ============================================================================
const fmtMs = (ms) => {
  if (!ms || ms < 1000) return `${Math.round(ms || 0)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r}s`;
};

const PitchDeckAnalyticsPanel = () => {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [downloads, setDownloads] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, dRes] = await Promise.all([
        authFetch('/api/admin/pitch-deck/analytics'),
        authFetch('/api/admin/pitch-deck/downloads'),
      ]);
      if (aRes.ok) setData(await aRes.json());
      if (dRes.ok) setDownloads(await dRes.json());
    } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const maxViews = Math.max(1, ...(data?.slides || []).map((s) => s.views));

  return (
    <section
      data-testid="pitch-analytics-panel"
      style={{
        marginTop: '4rem', padding: '2rem',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px', color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#D4AF37', letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.6rem' }}>
            <Presentation size={12} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            PITCH DECK · ENGAGEMENT
          </div>
          <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.65rem', fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
            Analítica por slide
          </h3>
        </div>
        <button
          onClick={load} disabled={loading}
          data-testid="pitch-analytics-refresh"
          className="interactive"
          style={{
            padding: '0.55rem 1rem', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '100px',
            color: '#FFFFFF', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <RefreshCcw size={12} className={loading ? 'spin' : ''} /> {loading ? 'Cargando…' : 'Refrescar'}
        </button>
      </div>

      {/* KPI orbs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        <AnalyticsKPI icon={Eye} label="Eventos totales" value={data?.total_events ?? '—'} testid="kpi-total-events" />
        <AnalyticsKPI icon={Users} label="Sesiones únicas" value={data?.total_sessions ?? '—'} color="#00C896" testid="kpi-total-sessions" />
        <AnalyticsKPI icon={Timer} label="Tiempo total" value={data ? fmtMs((data.slides || []).reduce((a, s) => a + s.total_ms, 0)) : '—'} testid="kpi-total-time" />
        <AnalyticsKPI icon={Download} label="Descargas PDF" value={downloads?.total_downloads ?? '—'} color="#D4AF37" testid="kpi-downloads" />
      </div>

      {/* Per-slide bars */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1.6fr 1fr 1fr 1fr', gap: '1rem', padding: '0 1rem', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: '0.75rem' }} className="analytics-header-grid">
          <div>SLIDE</div>
          <div>TÍTULO</div>
          <div>VISTAS</div>
          <div>SESIONES</div>
          <div>DWELL MEDIO</div>
        </div>

        {(!data || data.slides.length === 0) && !loading && (
          <div data-testid="pitch-analytics-empty" style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>
            Aún no hay datos de engagement. Los eventos se registrarán a medida que los usuarios recorran el Pitch Deck.
          </div>
        )}

        {(data?.slides || []).map((s) => (
          <div
            key={s.slide_number}
            data-testid={`pitch-slide-row-${s.slide_number}`}
            style={{
              display: 'grid', gridTemplateColumns: '60px 1.6fr 1fr 1fr 1fr',
              gap: '1rem', alignItems: 'center', padding: '0.9rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
            className="analytics-row"
          >
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 700, color: '#D4AF37',
            }}>
              {String(s.slide_number).padStart(2, '0')}
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#FFFFFF', fontWeight: 600, marginBottom: '0.4rem' }}>
                {s.slide_title || `Slide ${s.slide_number}`}
              </div>
              {/* Views bar */}
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(s.views / maxViews) * 100}%`,
                  background: 'linear-gradient(90deg, #00C896, #D4AF37)',
                  transition: 'width .4s',
                }} />
              </div>
            </div>
            <div style={{ fontSize: '0.95rem', color: '#FFFFFF', fontWeight: 600 }}>{s.views}</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)' }}>{s.unique_sessions}</div>
            <div style={{ fontSize: '0.9rem', color: '#00C896', fontFamily: 'monospace' }}>{fmtMs(s.avg_ms)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Los eventos se envían al abandonar cada slide (mínimo 400ms de permanencia). La sesión persiste sólo en la pestaña.
      </div>

      <style>{`
        @media (max-width: 900px) {
          .analytics-header-grid { display: none !important; }
          .analytics-row { grid-template-columns: 40px 1fr !important; gap: 0.75rem !important; }
          .analytics-row > div:nth-child(3),
          .analytics-row > div:nth-child(4),
          .analytics-row > div:nth-child(5) { display: none; }
        }
      `}</style>
    </section>
  );
};

const AnalyticsKPI = ({ icon: Icon, label, value, color = '#FFFFFF', testid }) => (
  <div
    data-testid={testid}
    style={{
      position: 'relative', padding: '1.5rem',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', overflow: 'hidden',
    }}
  >
    <div style={{
      position: 'absolute', top: '-24px', right: '-24px', width: '90px', height: '90px',
      borderRadius: '50%', border: `1px dashed ${color}33`,
    }} />
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
      <Icon size={13} />
      <span style={{ fontSize: '0.63rem', letterSpacing: '0.25em', fontWeight: 700 }}>{label.toUpperCase()}</span>
    </div>
    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '2rem', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
      {value}
    </div>
  </div>
);

export default AdminDashboardPage;
