/**
 * AdminSourcesTab — Centro de Fuentes dentro del Admin Global.
 *
 * Todo el módulo vive en una única pantalla. Reutiliza el chrome existente
 * de AdminPlatformPage (tab layout, colores, tabla) y consume el nuevo
 * módulo backend `/api/admin/sources`. No crea páginas nuevas.
 *
 * Funciones expuestas:
 *   • Lista paginada + filtros (kind, país, idioma, vertical, estado, search)
 *   • CRUD completo (create, edit, delete)
 *   • Sync ahora · Toggle activo/pausado · Test (dry-run)
 *   • Historial de sincronizaciones por fuente
 *   • Importación masiva (JSON/CSV) y exportación (JSON descargable)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, RefreshCw, Play, Pause, Trash2, Download, Upload, Filter,
  Loader, X, CheckCircle2, XCircle, FlaskConical, ScrollText,
} from 'lucide-react';
import { adminSourcesService } from '../services/coreServices';

const NAVY = '#0B1F3A';

const KIND_LABELS = {
  rss: 'RSS/Atom',
  github_org: 'GitHub Org',
  youtube_channel: 'YouTube Channel',
  entity_seed: 'Entidad Semilla',
  jobs_feed: 'Feed de Empleos',
  events_feed: 'Feed de Eventos',
  api: 'API pública',
};

const FREQ_LABELS = {
  realtime: 'Tiempo real', '5m': '5 min', '15m': '15 min', '30m': '30 min',
  '1h': '1 hora', '6h': '6 horas', '24h': '24 horas', manual: 'Manual',
};

const EMPTY_FORM = {
  name: '', kind: 'rss', category: '', country: '', language: 'es',
  vertical: '', description: '', url: '', api_key: '',
  frequency: '1h', status: 'active', config: '{}',
};

const AdminSourcesTab = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    kind: '', country: '', language: '', vertical: '', status: '', search: '',
  });
  const [openForm, setOpenForm] = useState(null); // null | {mode:'create'} | {mode:'edit', source}
  const [logsFor, setLogsFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState(null);

  const flash = (kind, msg) => {
    setBanner({ kind, msg });
    setTimeout(() => setBanner(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clean = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) clean[k] = v; });
      const d = await adminSourcesService.list({ ...clean, limit: 200 });
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { flash('error', e.message || 'No se pudo cargar'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const withBusy = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      const r = await fn();
      if (okMsg) flash('success', okMsg);
      return r;
    } catch (e) { flash('error', e.message || 'Falló la operación'); }
    finally { setBusyId(null); load(); }
  };

  const onExport = async () => {
    const d = await adminSourcesService.exportJson();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `punto-cero-sources-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await adminSourcesService.importFile(file);
      flash('success', `Importadas ${r.upserted} · actualizadas ${r.updated}`);
      load();
    } catch (err) { flash('error', err.message || 'Falló la importación'); }
    e.target.value = '';
  };

  return (
    <div data-testid="admin-sources-tab" style={{ color: '#FFFFFF' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontFamily: '"Space Grotesk", sans-serif' }}>
          Centro de Fuentes
        </h2>
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
          {total} fuentes registradas
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <ToolBtn onClick={() => setOpenForm({ mode: 'create' })} testid="sources-new" icon={<Plus size={14} />} tone="primary">
            Nueva fuente
          </ToolBtn>
          <ToolBtn onClick={load} testid="sources-refresh" icon={<RefreshCw size={14} />}>
            Refrescar
          </ToolBtn>
          <label style={btnStyle('default')} data-testid="sources-import">
            <Upload size={14} /> Importar
            <input type="file" accept=".json,.csv" onChange={onImport} style={{ display: 'none' }} />
          </label>
          <ToolBtn onClick={onExport} testid="sources-export" icon={<Download size={14} />}>
            Exportar
          </ToolBtn>
        </div>
      </div>

      {banner && (
        <div data-testid="sources-banner" style={{
          padding: '0.6rem 0.85rem', borderRadius: 10, marginBottom: '0.85rem',
          background: banner.kind === 'error' ? 'rgba(220,38,38,0.15)' : 'rgba(0,200,150,0.15)',
          border: `1px solid ${banner.kind === 'error' ? 'rgba(220,38,38,0.35)' : 'rgba(0,200,150,0.35)'}`,
          color: banner.kind === 'error' ? '#FCA5A5' : '#6EE7B7',
          fontSize: '0.82rem',
        }}>{banner.msg}</div>
      )}

      <FiltersBar filters={filters} onChange={setFilters} />

      <div data-testid="sources-table" style={{
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={headerRowStyle}>
          <div>Nombre</div>
          <div>Tipo</div>
          <div>País</div>
          <div>Estado</div>
          <div>Frecuencia</div>
          <div style={{ textAlign: 'right' }}>Importados</div>
          <div>Último sync</div>
          <div style={{ textAlign: 'right' }}>Acciones</div>
        </div>
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
            <Loader size={16} className="pc-spin" /> Cargando…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>
            No hay fuentes que coincidan. Registra una nueva desde el botón superior.
          </div>
        )}
        {items.map((s) => (
          <div key={s.id} style={rowStyle} data-testid={`sources-row-${s.id}`}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.url}
              </div>
            </div>
            <div>{KIND_LABELS[s.kind] || s.kind}</div>
            <div>{s.country || '—'}</div>
            <div>
              <StatusPill status={s.status} lastStatus={s.last_sync_status} />
            </div>
            <div style={{ fontSize: '0.8rem' }}>{FREQ_LABELS[s.frequency] || s.frequency}</div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.imported_count || 0}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
              {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : '—'}
              {s.last_sync_error && <div style={{ color: '#F87171', marginTop: 2 }}>{s.last_sync_error.slice(0, 60)}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem', flexWrap: 'wrap' }}>
              <IconBtn testid={`sources-sync-${s.id}`}
                title="Sincronizar ahora" disabled={busyId === s.id}
                onClick={() => withBusy(s.id, () => adminSourcesService.sync(s.id), 'Sincronización lanzada')}>
                {busyId === s.id ? <Loader size={13} className="pc-spin" /> : <RefreshCw size={13} />}
              </IconBtn>
              <IconBtn testid={`sources-test-${s.id}`}
                title="Probar conexión (dry-run)" disabled={busyId === s.id}
                onClick={async () => {
                  const r = await adminSourcesService.test(s.id);
                  if (r.errors?.length) flash('error', r.errors[0]);
                  else flash('success', `Test OK · ${r.ingested + r.updated} items disponibles`);
                }}>
                <FlaskConical size={13} />
              </IconBtn>
              <IconBtn testid={`sources-toggle-${s.id}`}
                title={s.status === 'active' ? 'Pausar' : 'Activar'}
                onClick={() => withBusy(s.id, () => adminSourcesService.toggle(s.id))}>
                {s.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
              </IconBtn>
              <IconBtn testid={`sources-logs-${s.id}`} title="Ver historial"
                onClick={() => setLogsFor(s)}>
                <ScrollText size={13} />
              </IconBtn>
              <IconBtn testid={`sources-edit-${s.id}`} title="Editar"
                onClick={() => setOpenForm({ mode: 'edit', source: s })}>
                <Filter size={13} style={{ transform: 'rotate(90deg)' }} />
              </IconBtn>
              <IconBtn testid={`sources-delete-${s.id}`} title="Eliminar" danger
                onClick={async () => {
                  if (!window.confirm(`¿Eliminar "${s.name}"? Esta acción es reversible desde MongoDB.`)) return;
                  await withBusy(s.id, () => adminSourcesService.remove(s.id), 'Fuente eliminada');
                }}>
                <Trash2 size={13} />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>

      {openForm && (
        <SourceFormModal
          mode={openForm.mode}
          initial={openForm.mode === 'edit' ? openForm.source : EMPTY_FORM}
          onClose={() => setOpenForm(null)}
          onSaved={() => { setOpenForm(null); flash('success', 'Guardado'); load(); }}
          onError={(m) => flash('error', m)}
        />
      )}
      {logsFor && (
        <LogsModal source={logsFor} onClose={() => setLogsFor(null)} />
      )}

      <style>{`
        @keyframes pc-spin { to { transform: rotate(360deg); } }
        .pc-spin { animation: pc-spin 1s linear infinite; display: inline-block; }
      `}</style>
    </div>
  );
};

/* ---------- Filters ---------- */

const FiltersBar = ({ filters, onChange }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.4rem', marginBottom: '0.85rem',
  }}>
    <input placeholder="Buscar" value={filters.search}
      onChange={(e) => onChange({ ...filters, search: e.target.value })}
      data-testid="sources-filter-search" style={inputStyle} />
    <select value={filters.kind} onChange={(e) => onChange({ ...filters, kind: e.target.value })}
      data-testid="sources-filter-kind" style={inputStyle}>
      <option value="">Todos los tipos</option>
      {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
    <input placeholder="País (ISO)" value={filters.country}
      onChange={(e) => onChange({ ...filters, country: e.target.value.toUpperCase() })}
      data-testid="sources-filter-country" style={inputStyle} />
    <input placeholder="Idioma" value={filters.language}
      onChange={(e) => onChange({ ...filters, language: e.target.value })}
      style={inputStyle} />
    <input placeholder="Vertical" value={filters.vertical}
      onChange={(e) => onChange({ ...filters, vertical: e.target.value })}
      style={inputStyle} />
    <select value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}
      data-testid="sources-filter-status" style={inputStyle}>
      <option value="">Todos los estados</option>
      <option value="active">Activas</option>
      <option value="paused">Pausadas</option>
      <option value="error">Con error</option>
    </select>
  </div>
);

/* ---------- Form modal ---------- */

const SourceFormModal = ({ mode, initial, onClose, onSaved, onError }) => {
  const [form, setForm] = useState(() => ({
    ...initial,
    config: typeof initial.config === 'string' ? initial.config : JSON.stringify(initial.config || {}, null, 2),
  }));
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    let cfg = {};
    if (form.config?.trim()) {
      try { cfg = JSON.parse(form.config); }
      catch { onError('El campo `config` no es JSON válido'); return; }
    }
    const payload = { ...form, config: cfg };
    ['category','country','language','vertical','description','url','api_key']
      .forEach((k) => { if (!payload[k]) delete payload[k]; });
    setSaving(true);
    try {
      if (mode === 'edit') await adminSourcesService.update(initial.id, payload);
      else await adminSourcesService.create(payload);
      onSaved();
    } catch (err) { onError(err.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title={mode === 'edit' ? 'Editar fuente' : 'Nueva fuente'} testid="sources-form-modal">
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
        <Field label="Nombre">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="sources-form-name" style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Tipo">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
              data-testid="sources-form-kind" style={inputStyle}>
              {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Frecuencia">
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              data-testid="sources-form-frequency" style={inputStyle}>
              {Object.entries(FREQ_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="URL">
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
            data-testid="sources-form-url" style={inputStyle}
            placeholder="https://... (RSS/API/YouTube channel)" />
        </Field>
        <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Field label="País (ISO/LATAM/GLOBAL)">
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              maxLength={8} style={inputStyle} />
          </Field>
          <Field label="Idioma">
            <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
              style={inputStyle} />
          </Field>
          <Field label="Vertical">
            <input value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })}
              style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Categoría">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={inputStyle} />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={inputStyle}>
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
            </select>
          </Field>
        </div>
        <Field label="API Key (opcional)">
          <input type="password" value={form.api_key || ''}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <textarea rows={2} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
        <Field label='Config (JSON) — ej. GitHub org, YouTube channel_id, entity_seed slug/data'>
          <textarea rows={4} value={form.config}
            data-testid="sources-form-config"
            onChange={(e) => setForm({ ...form, config: e.target.value })}
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }} />
        </Field>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
          <button type="button" onClick={onClose} style={btnStyle('default')}>Cancelar</button>
          <button type="submit" disabled={saving} data-testid="sources-form-submit"
            style={btnStyle('primary')}>
            {saving ? <Loader size={13} className="pc-spin" /> : <CheckCircle2 size={13} />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ---------- Logs modal ---------- */

const LogsModal = ({ source, onClose }) => {
  const [items, setItems] = useState(null);
  useEffect(() => {
    adminSourcesService.logs(source.id, 30)
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, [source.id]);
  return (
    <Modal onClose={onClose} title={`Historial · ${source.name}`} testid="sources-logs-modal">
      {items === null && <div style={{ padding: '1rem', color: '#94A3B8' }}>Cargando…</div>}
      {items?.length === 0 && <div style={{ padding: '1rem', color: '#94A3B8' }}>Sin ejecuciones aún.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 400, overflowY: 'auto' }}>
        {(items || []).map((l) => (
          <div key={l.id} data-testid={`sources-log-${l.id}`} style={{
            padding: '0.5rem 0.7rem', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${l.ok ? 'rgba(0,200,150,0.25)' : 'rgba(220,38,38,0.25)'}`,
            fontSize: '0.78rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {l.ok ? <CheckCircle2 size={12} color="#00C896" /> : <XCircle size={12} color="#F87171" />}
                {new Date(l.started_at).toLocaleString()}
              </span>
              <span>ingested={l.ingested} · updated={l.updated}</span>
            </div>
            {l.errors?.length > 0 && (
              <div style={{ color: '#FCA5A5', marginTop: 3, fontSize: '0.72rem' }}>
                {l.errors.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

/* ---------- Small building blocks ---------- */

const Modal = ({ children, title, onClose, testid }) => (
  <div data-testid={testid} style={{
    position: 'fixed', inset: 0, zIndex: 200, padding: '1rem',
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflowY: 'auto',
  }}>
    <div style={{
      background: '#0A0F1C', color: '#FFFFFF',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
      width: 'min(720px, 100%)', padding: '1rem 1.15rem',
      maxHeight: '90vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <h3 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>{title}</h3>
        <button onClick={onClose} data-testid="sources-modal-close" aria-label="Cerrar"
          style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'grid', gap: 4, fontSize: '0.72rem', color: '#CBD5E1' }}>
    <span style={{ letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
    {children}
  </label>
);

const IconBtn = ({ children, onClick, title, disabled, danger, testid }) => (
  <button data-testid={testid} title={title} onClick={onClick} disabled={disabled}
    style={{
      width: 30, height: 30, borderRadius: 8, cursor: disabled ? 'wait' : 'pointer',
      background: danger ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)',
      color: danger ? '#FCA5A5' : '#FFFFFF',
      border: `1px solid ${danger ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.1)'}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.55 : 1,
    }}>{children}</button>
);

const ToolBtn = ({ children, onClick, testid, icon, tone }) => (
  <button data-testid={testid} onClick={onClick} style={btnStyle(tone)}>
    {icon}{children}
  </button>
);

const StatusPill = ({ status, lastStatus }) => {
  const map = {
    active:  { label: 'Activa',  bg: 'rgba(0,200,150,0.15)',    fg: '#6EE7B7', bd: 'rgba(0,200,150,0.35)' },
    paused:  { label: 'Pausada', bg: 'rgba(148,163,184,0.15)',  fg: '#CBD5E1', bd: 'rgba(148,163,184,0.35)' },
    error:   { label: 'Error',   bg: 'rgba(220,38,38,0.15)',    fg: '#FCA5A5', bd: 'rgba(220,38,38,0.35)' },
  };
  const s = map[status] || map.paused;
  const dot = lastStatus === 'error' ? '#F87171' : (lastStatus === 'ok' ? '#00C896' : '#94A3B8');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700,
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {s.label}
    </span>
  );
};

const btnStyle = (tone) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.4rem 0.75rem', borderRadius: 8, cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 700,
  background: tone === 'primary' ? '#00C896' : 'rgba(255,255,255,0.06)',
  color: tone === 'primary' ? NAVY : '#FFFFFF',
  border: `1px solid ${tone === 'primary' ? '#00C896' : 'rgba(255,255,255,0.12)'}`,
});

const inputStyle = {
  background: 'rgba(255,255,255,0.05)', color: '#FFFFFF',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  padding: '0.45rem 0.6rem', fontSize: '0.82rem', width: '100%',
};

const headerRowStyle = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 0.8fr 1fr 1fr 0.8fr 1.2fr 1.4fr',
  gap: '0.55rem',
  padding: '0.55rem 0.75rem',
  background: 'rgba(255,255,255,0.03)',
  fontSize: '0.66rem', letterSpacing: '0.12em', fontWeight: 800,
  color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
};

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 0.8fr 1fr 1fr 0.8fr 1.2fr 1.4fr',
  gap: '0.55rem',
  padding: '0.65rem 0.75rem',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  fontSize: '0.82rem', alignItems: 'center',
};

export default AdminSourcesTab;
