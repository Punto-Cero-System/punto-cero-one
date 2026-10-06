import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Trash2, Download, FileText, RefreshCcw, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

const CATEGORIES = [
  { key: 'pitch_deck', label: 'Pitch Deck' },
  { key: 'financial_model', label: 'Modelo Financiero' },
  { key: 'legal', label: 'Documento Legal' },
  { key: 'executive_summary', label: 'Executive Summary' },
  { key: 'other', label: 'Otro' },
];

const VERTICALS = [
  { key: 'investor', label: 'Investor Center' },
  { key: 'legal', label: 'Legal' },
  { key: 'medicina', label: 'Medicina' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'educacion', label: 'Educación' },
  { key: 'shared', label: 'Compartido' },
];

const fmtBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};

const AdminDocumentsPage = () => {
  const { user, token, authFetch } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [filterVertical, setFilterVertical] = useState('');
  const [category, setCategory] = useState('pitch_deck');
  const [vertical, setVertical] = useState('investor');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = filterVertical ? `/api/documents?vertical=${filterVertical}` : '/api/documents';
      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Error cargando documentos');
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterVertical, authFetch]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Selecciona un archivo primero.'); return; }

    setUploading(true);
    setError('');
    setNotice('');
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('vertical', vertical);

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Error al subir');
      setNotice(`Documento «${data.original_filename}» subido correctamente.`);
      fileRef.current.value = '';
      await load();
      setTimeout(() => setNotice(''), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este documento? Esta acción no se puede deshacer visualmente.')) return;
    const res = await authFetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  };

  const handleDownload = async (doc) => {
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError('No se pudo descargar el archivo.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="admin-documents-page" style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)', color: '#FFFFFF' }}>
      <header style={{ background: 'rgba(11,31,58,0.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/admin" data-testid="admin-back" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Volver al panel
          </Link>
          <div style={{ height: 18, width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.8rem', background: `${GOLD}1a`, border: `1px solid ${GOLD}55`, borderRadius: 100 }}>
            <Shield size={12} color={GOLD} />
            <span style={{ fontSize: '0.7rem', color: GOLD, fontWeight: 700, letterSpacing: '0.2em' }}>DOCUMENT REPOSITORY</span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>{user?.email}</span>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: EMERALD, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.5rem' }}>
            REPOSITORIO DE DOCUMENTOS
          </div>
          <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', fontWeight: 300, letterSpacing: '-0.03em', margin: 0 }}>
            Documentos <span style={{ fontWeight: 700 }}>del ecosistema</span>
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', maxWidth: 720 }}>
            Repositorio compartido con abstracción de almacenamiento (local + Emergent). Reutilizable por todas las verticales.
          </p>
        </div>

        {/* Upload form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleUpload}
          data-testid="documents-upload-form"
          style={{
            padding: '1.5rem', borderRadius: 20,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'grid', gap: '0.85rem',
            gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, auto) minmax(180px, auto) auto',
            alignItems: 'end', marginBottom: '2rem',
          }}
        >
          <div>
            <label htmlFor="doc-file" style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.4rem' }}>
              ARCHIVO
            </label>
            <input
              id="doc-file" ref={fileRef} type="file"
              data-testid="documents-upload-file"
              style={{
                width: '100%', padding: '0.55rem 0.75rem',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#FFFFFF', fontSize: '0.82rem',
              }}
            />
          </div>
          <div>
            <label htmlFor="doc-category" style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.4rem' }}>
              CATEGORÍA
            </label>
            <select id="doc-category" data-testid="documents-upload-category" value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key} style={{ background: NAVY, color: '#FFF' }}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-vertical" style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.4rem' }}>
              VERTICAL
            </label>
            <select id="doc-vertical" data-testid="documents-upload-vertical" value={vertical} onChange={(e) => setVertical(e.target.value)} style={selectStyle}>
              {VERTICALS.map((v) => <option key={v.key} value={v.key} style={{ background: NAVY, color: '#FFF' }}>{v.label}</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={uploading}
            data-testid="documents-upload-submit"
            style={{
              padding: '0.7rem 1.2rem', borderRadius: 100, border: 'none',
              background: uploading ? 'rgba(0,200,150,0.3)' : `linear-gradient(135deg, ${EMERALD}, #06B6D4)`,
              color: NAVY, fontWeight: 700, fontSize: '0.82rem',
              cursor: uploading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            <Upload size={14} /> {uploading ? 'Subiendo…' : 'Subir'}
          </button>
        </motion.form>

        <AnimatePresence>
          {notice && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="documents-notice"
              style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 10, color: EMERALD, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle size={14} /> {notice}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="documents-error"
              style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,90,90,0.1)', border: '1px solid rgba(255,90,90,0.3)', borderRadius: 10, color: '#ff9a9a', fontSize: '0.85rem' }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter + list */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', fontWeight: 700 }}>FILTRAR VERTICAL:</span>
          <FilterChip active={!filterVertical} onClick={() => setFilterVertical('')} label="Todos" testid="filter-vertical-all" />
          {VERTICALS.map((v) => (
            <FilterChip key={v.key} active={filterVertical === v.key} onClick={() => setFilterVertical(v.key)} label={v.label} testid={`filter-vertical-${v.key}`} />
          ))}
          <button
            onClick={load} disabled={loading}
            data-testid="documents-refresh"
            style={{ marginLeft: 'auto', padding: '0.45rem 0.85rem', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCcw size={12} className={loading ? 'spin' : ''} /> Refrescar
          </button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden' }} data-testid="documents-list">
          {items.length === 0 && !loading && (
            <div data-testid="documents-empty" style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>
              Aún no hay documentos. Sube el primero desde el formulario superior.
            </div>
          )}
          {items.map((d) => (
            <div key={d.id} data-testid={`document-row-${d.id}`} style={{
              display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 1fr auto',
              gap: '1rem', alignItems: 'center',
              padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(212,175,55,0.12)', border: `1px solid ${GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} color={GOLD} />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.original_filename}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>{d.content_type} · {fmtBytes(d.size_bytes)}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{CATEGORIES.find(c => c.key === d.category)?.label || d.category}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{VERTICALS.find(v => v.key === d.vertical)?.label || d.vertical}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{new Date(d.created_at).toLocaleDateString('es-CO')}</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => handleDownload(d)} data-testid={`document-download-${d.id}`} aria-label="Descargar documento"
                  style={iconBtn}>
                  <Download size={14} />
                </button>
                <button onClick={() => handleDelete(d.id)} data-testid={`document-delete-${d.id}`} aria-label="Eliminar documento"
                  style={{ ...iconBtn, color: '#ff9a9a', borderColor: 'rgba(255,90,90,0.3)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const selectStyle = {
  width: '100%', padding: '0.55rem 0.75rem',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: '#FFFFFF', fontSize: '0.82rem', outline: 'none',
  fontFamily: 'inherit',
};

const iconBtn = {
  width: 32, height: 32, borderRadius: 8,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#FFFFFF', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const FilterChip = ({ active, onClick, label, testid }) => (
  <button
    onClick={onClick} data-testid={testid}
    style={{
      padding: '0.35rem 0.85rem', borderRadius: 100, cursor: 'pointer',
      background: active ? `${EMERALD}22` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${active ? EMERALD : 'rgba(255,255,255,0.1)'}`,
      color: active ? EMERALD : 'rgba(255,255,255,0.7)',
      fontSize: '0.74rem', fontWeight: 600, fontFamily: 'inherit',
    }}
  >{label}</button>
);

export default AdminDocumentsPage;
