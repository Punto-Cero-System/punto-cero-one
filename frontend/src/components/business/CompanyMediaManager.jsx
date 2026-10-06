import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Trash2, ImagePlus, Loader2, AlertCircle } from 'lucide-react';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const API = process.env.REACT_APP_BACKEND_URL;

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * CompanyMediaManager — drag-and-drop UI for company logo/banner/cover/gallery.
 * Uses ONLY the existing backend endpoints (Wave 3 P1). No API changes.
 *
 * Props:
 *   company   — { id, logo_url, banner_url, cover_url, gallery }
 *   onUpdated — called with the fresh company object after every mutation
 *   canEdit   — boolean; when false, the manager is read-only (previews only)
 */
const CompanyMediaManager = ({ company, onUpdated, canEdit = true }) => {
  return (
    <div data-testid="company-media-manager" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        display: 'grid', gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        <MediaSlot slot="logo"   label="Logo"           aspect="1 / 1"  crop
          hint="PNG/SVG con fondo transparente, cuadrado. Máx 10MB."
          company={company} onUpdated={onUpdated} canEdit={canEdit} />
        <MediaSlot slot="banner" label="Banner principal" aspect="16 / 6"
          hint="Ideal 1600×600 · se muestra en la parte superior del perfil."
          company={company} onUpdated={onUpdated} canEdit={canEdit} />
        <MediaSlot slot="cover"  label="Imagen de portada" aspect="16 / 9"
          hint="Ideal 1600×900 · aparece al compartir la empresa."
          company={company} onUpdated={onUpdated} canEdit={canEdit} />
      </div>

      <GalleryPanel company={company} onUpdated={onUpdated} canEdit={canEdit} />
    </div>
  );
};

/* ============================================================================
   Single-slot uploader (logo, banner, cover)
   ========================================================================== */
const MediaSlot = ({ slot, label, aspect, crop, hint, company, onUpdated, canEdit }) => {
  const inputRef = useRef(null);
  const [state, setState] = useState({ busy: false, progress: 0, err: '' });
  const url = company?.[`${slot}_url`];
  const previewUrl = url ? (url.startsWith('http') ? url : `${API}${url}`) : null;

  const uploadFile = useCallback(async (file) => {
    const validate = validateFile(file);
    if (validate) { setState({ busy: false, progress: 0, err: validate }); return; }

    setState({ busy: true, progress: 5, err: '' });
    try {
      await xhrUpload(
        `${API}/api/companies/${company.id}/media/${slot}`, 'PUT', file,
        (pct) => setState((s) => ({ ...s, progress: Math.max(pct, s.progress) })),
      );
      setState({ busy: false, progress: 100, err: '' });
      if (onUpdated) onUpdated();
    } catch (e) {
      setState({ busy: false, progress: 0, err: e.message || 'Error subiendo archivo' });
    }
  }, [company?.id, slot, onUpdated]);

  const removeSlot = useCallback(async () => {
    if (!window.confirm(`¿Eliminar ${label.toLowerCase()}?`)) return;
    setState({ busy: true, progress: 30, err: '' });
    try {
      const r = await fetch(`${API}/api/companies/${company.id}/media/${slot}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error('No se pudo eliminar');
      setState({ busy: false, progress: 0, err: '' });
      if (onUpdated) onUpdated();
    } catch (e) {
      setState({ busy: false, progress: 0, err: e.message });
    }
  }, [company?.id, slot, onUpdated, label]);

  return (
    <DropZone
      testid={`media-slot-${slot}`}
      onFile={canEdit ? uploadFile : null}
      disabled={!canEdit || state.busy}
      style={{ aspectRatio: aspect }}>
      {previewUrl && !state.busy ? (
        <PreviewWithActions img={previewUrl} slot={slot} crop={crop}
          canEdit={canEdit} onReplace={() => inputRef.current?.click()} onRemove={removeSlot} />
      ) : state.busy ? (
        <BusyState progress={state.progress} />
      ) : (
        <EmptyState label={label} hint={hint} icon={ImagePlus}
          onPick={() => canEdit && inputRef.current?.click()} disabled={!canEdit} />
      )}
      {state.err && <ErrorBar msg={state.err} />}
      <input ref={inputRef} type="file" accept={ALLOWED.join(',')} style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        data-testid={`media-input-${slot}`} />
    </DropZone>
  );
};

/* ============================================================================
   Gallery — multi-image with per-item delete
   ========================================================================== */
const GalleryPanel = ({ company, onUpdated, canEdit }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const items = company?.gallery || [];

  const upload = useCallback(async (file) => {
    const v = validateFile(file);
    if (v) { setErr(v); return; }
    setBusy(true); setProgress(5); setErr('');
    try {
      await xhrUpload(`${API}/api/companies/${company.id}/gallery`, 'POST', file,
        (pct) => setProgress((p) => Math.max(pct, p)));
      setBusy(false); setProgress(100);
      if (onUpdated) onUpdated();
    } catch (e) { setBusy(false); setErr(e.message); }
  }, [company?.id, onUpdated]);

  const removeAt = async (idx) => {
    if (!window.confirm('¿Eliminar esta imagen de la galería?')) return;
    try {
      const r = await fetch(`${API}/api/companies/${company.id}/gallery/${idx}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (r.ok && onUpdated) onUpdated();
    } catch { /* noop */ }
  };

  return (
    <div data-testid="media-gallery-panel" style={{
      background: '#FFFFFF', borderRadius: 18, padding: '1.4rem 1.4rem 1.15rem',
      border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '0.85rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.24em', fontWeight: 700,
                        color: EMERALD, marginBottom: 4 }}>GALERÍA</div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(11,31,58,0.65)' }}>
            Hasta 20 imágenes · {items.length}/20
          </div>
        </div>
        {canEdit && (
          <button data-testid="media-gallery-add" onClick={() => inputRef.current?.click()}
            disabled={busy || items.length >= 20}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.55rem 1rem', borderRadius: 100,
              background: EMERALD, color: '#FFFFFF', border: 'none',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              opacity: busy || items.length >= 20 ? 0.5 : 1,
            }}>
            <UploadCloud size={14} /> {busy ? `Subiendo ${progress}%` : 'Añadir imagen'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <DropZone testid="media-gallery-empty" onFile={canEdit ? upload : null}
          disabled={!canEdit || busy}
          style={{ minHeight: 140 }}>
          {busy ? <BusyState progress={progress} /> : (
            <EmptyState label="Añade la primera imagen" hint="Arrastra o haz clic para elegir"
              icon={ImagePlus} onPick={() => canEdit && inputRef.current?.click()} disabled={!canEdit} />
          )}
        </DropZone>
      ) : (
        <div style={{
          display: 'grid', gap: '0.6rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        }}>
          <AnimatePresence>
            {items.map((rel, i) => {
              const src = rel.startsWith('http') ? rel : `${API}${rel}`;
              return (
                <motion.div key={rel + i}
                  layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  data-testid={`gallery-item-${i}`}
                  style={{
                    position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                    background: `url(${src}) center/cover`,
                    border: '1px solid rgba(11,31,58,0.08)',
                  }}>
                  {canEdit && (
                    <button onClick={() => removeAt(i)}
                      data-testid={`gallery-remove-${i}`} aria-label="Quitar imagen"
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(11,31,58,0.72)', color: '#FFFFFF',
                        border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                      }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {err && <ErrorBar msg={err} />}
      <input ref={inputRef} type="file" accept={ALLOWED.join(',')} style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        data-testid="media-gallery-input" />
    </div>
  );
};

/* ============================================================================
   Reusable subcomponents
   ========================================================================== */
const DropZone = ({ children, onFile, disabled, testid, style }) => {
  const [over, setOver] = useState(false);
  const handle = (e, val) => { e.preventDefault(); e.stopPropagation(); setOver(val); };
  const drop = (e) => {
    handle(e, false);
    if (disabled || !onFile) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  };
  return (
    <div data-testid={testid}
      onDragOver={(e) => handle(e, true)}
      onDragEnter={(e) => handle(e, true)}
      onDragLeave={(e) => handle(e, false)}
      onDrop={drop}
      style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: '#FFFFFF',
        border: `2px dashed ${over ? EMERALD : 'rgba(11,31,58,0.15)'}`,
        boxShadow: over ? `0 0 0 4px ${EMERALD}22` : '0 4px 20px rgba(11,31,58,0.04)',
        transition: 'all 0.25s ease',
        ...style,
      }}>
      {children}
    </div>
  );
};

const EmptyState = ({ label, hint, icon: Icon, onPick, disabled }) => (
  <button onClick={onPick} disabled={disabled}
    style={{
      width: '100%', height: '100%', minHeight: 180,
      border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '1rem', color: NAVY,
    }}>
    <div style={{
      width: 46, height: 46, borderRadius: '50%',
      background: `${EMERALD}18`, color: EMERALD,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={20} />
    </div>
    <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)', textAlign: 'center', maxWidth: 240 }}>
      {hint}
    </div>
    <div style={{ marginTop: 6, fontSize: '0.65rem', letterSpacing: '0.18em',
                  color: 'rgba(11,31,58,0.4)', fontWeight: 700 }}>
      Arrastra o haz clic
    </div>
  </button>
);

const PreviewWithActions = ({ img, slot, crop, onReplace, onRemove, canEdit }) => (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <div style={{
      width: '100%', height: '100%',
      background: `${slot === 'logo' ? '#F5F6FA' : 'transparent'} url(${img}) center/${crop ? 'contain' : 'cover'} no-repeat`,
      backgroundSize: crop ? 'contain' : 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    }} />
    {canEdit && (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'flex-end', gap: 6, padding: 10,
        background: 'linear-gradient(180deg, transparent 60%, rgba(11,31,58,0.7) 100%)',
      }}>
        <button onClick={onReplace} data-testid={`media-replace-${slot}`}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 100,
                   background: '#FFFFFF', color: NAVY, border: 'none', cursor: 'pointer',
                   fontSize: '0.7rem', fontWeight: 700 }}>Reemplazar</button>
        <button onClick={onRemove} data-testid={`media-remove-${slot}`} aria-label="Quitar imagen"
          style={{ padding: '0.4rem 0.55rem', borderRadius: 100,
                   background: 'rgba(255,255,255,0.15)', color: '#FFFFFF',
                   border: '1px solid rgba(255,255,255,0.35)', cursor: 'pointer',
                   display: 'inline-flex', alignItems: 'center', gap: 4,
                   fontSize: '0.7rem', fontWeight: 600 }}>
          <Trash2 size={12} />
        </button>
      </div>
    )}
  </div>
);

const BusyState = ({ progress }) => (
  <div style={{
    width: '100%', height: '100%', minHeight: 180,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '1rem',
  }}>
    <Loader2 size={26} color={EMERALD} className="pcone-spin" />
    <div style={{ width: '80%', height: 6, borderRadius: 100, background: 'rgba(11,31,58,0.08)', overflow: 'hidden' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{ height: '100%', background: `linear-gradient(90deg, ${EMERALD}, ${NAVY})` }} />
    </div>
    <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.65)', fontWeight: 600 }}>
      Subiendo {progress}%
    </div>
    <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
      @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ErrorBar = ({ msg }) => (
  <div style={{
    position: 'absolute', bottom: 8, left: 8, right: 8,
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '0.4rem 0.6rem', borderRadius: 8,
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    color: '#B91C1C', fontSize: '0.72rem', fontWeight: 600,
  }}><AlertCircle size={12} /> {msg}</div>
);

/* ============================================================================
   Helpers
   ========================================================================== */
const validateFile = (file) => {
  if (!file) return 'Archivo vacío';
  if (!ALLOWED.includes(file.type)) return 'Formato no permitido';
  if (file.size > MAX_BYTES) return `Archivo supera 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  return null;
};

const xhrUpload = (url, method, file, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.withCredentials = true;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95));
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
    } else {
      let msg = `Error ${xhr.status}`;
      try { const b = JSON.parse(xhr.responseText); msg = b.detail || msg; } catch { /* noop */ }
      reject(new Error(msg));
    }
  };
  xhr.onerror = () => reject(new Error('Error de red'));
  const form = new FormData();
  form.append('file', file);
  xhr.send(form);
});

export default CompanyMediaManager;
