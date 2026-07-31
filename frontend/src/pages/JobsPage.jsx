import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Briefcase, Send, Check, Bookmark } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { jobService } from '../services/platformService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const JobsPage = () => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(null);
  const [applyLetter, setApplyLetter] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const isAuthed = !!user && typeof user === 'object';

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const data = await jobService.list({ limit: 20, cursor: reset ? undefined : cursor });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.next_cursor); setHasMore(!!data.next_cursor);
    } catch (e) { /* silent */ } finally { setLoading(false); }
  }, [cursor]);

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);

  const toggleSave = async (j) => {
    if (!isAuthed) return;
    const r = await jobService.save(j.id);
    setItems((p) => p.map((x) => x.id === j.id ? { ...x, my_saved: r.saved } : x));
  };

  const submitApply = async (e) => {
    e.preventDefault();
    if (!applyOpen || applyBusy) return;
    setApplyBusy(true);
    try {
      await jobService.apply(applyOpen.id, { cover_letter: applyLetter });
      setItems((p) => p.map((x) => x.id === applyOpen.id ? { ...x, my_applied: true, applications_count: x.applications_count + 1 } : x));
      setApplyOpen(null); setApplyLetter('');
    } catch (err) { alert(err.message || 'No se pudo aplicar'); } finally { setApplyBusy(false); }
  };

  return (
    <CategoryPage
      icon="jobs"
      eyebrow="Empleos del ecosistema"
      title="Encuentra el trabajo que construye tu punto cero"
      subtitle="Vacantes publicadas por empresas del ecosistema. Legal, IA, capital, comunidad y más."
      testid="jobs-page"
    >
      {items.map((j, idx) => (
        <motion.article
          key={j.id}
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, delay: idx * 0.03 }}
          data-testid={`job-card-${j.id}`}
          style={{
            background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem',
            border: '1px solid rgba(11,31,58,0.06)',
            boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
            {j.company_logo ? (
              <img src={j.company_logo} alt={j.company_name} style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: 10, background: 'linear-gradient(135deg, #0B1F3A, #1E3A8A)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={20} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.05rem', fontWeight: 700, color: NAVY, margin: 0, letterSpacing: '-0.01em' }} data-testid={`job-title-${j.id}`}>{j.title}</h2>
              <div style={{ fontSize: '0.8rem', color: 'rgba(11,31,58,0.65)' }}>
                {j.company_name} {j.location && <>· <MapPin size={11} style={{ verticalAlign: -1 }} /> {j.location}</>}
                <span style={{ marginLeft: 8, padding: '0.15rem 0.45rem', borderRadius: 100, background: 'rgba(0,200,150,0.1)', color: '#00A277', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {j.modality.toUpperCase()}
                </span>
                {j.applications_count > 0 && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'rgba(11,31,58,0.5)' }}>· {j.applications_count} postulaciones</span>}
              </div>
              <p style={{ fontSize: '0.87rem', color: 'rgba(11,31,58,0.72)', margin: '0.55rem 0 0.6rem', lineHeight: 1.5 }}>{j.description.slice(0, 320)}{j.description.length > 320 ? '…' : ''}</p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                {(j.tags || []).map((t) => (
                  <span key={t} style={{ padding: '0.2rem 0.55rem', borderRadius: 100, background: 'rgba(11,31,58,0.05)', color: NAVY, fontSize: '0.7rem', fontWeight: 600 }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {j.my_applied ? (
                  <span data-testid={`job-applied-${j.id}`} style={{ padding: '0.5rem 0.95rem', borderRadius: 100, background: 'rgba(0,200,150,0.15)', color: '#00A277', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Check size={12} /> Aplicaste
                  </span>
                ) : (
                  <button onClick={() => (isAuthed ? setApplyOpen(j) : window.location.assign('/join'))}
                    data-testid={`job-apply-${j.id}`}
                    style={{ padding: '0.5rem 0.95rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Send size={12} /> {isAuthed ? 'Postular' : 'Unirse para postular'}
                  </button>
                )}
                {isAuthed && (
                  <button onClick={() => toggleSave(j)} data-testid={`job-save-${j.id}`}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: 100, background: j.my_saved ? 'rgba(0,200,150,0.15)' : 'transparent', border: '1px solid rgba(11,31,58,0.12)', color: j.my_saved ? '#00A277' : NAVY, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Bookmark size={12} /> {j.my_saved ? 'Guardado' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.article>
      ))}

      {loading && items.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>}
      {!loading && items.length === 0 && (
        <div data-testid="jobs-empty" style={{ padding: '2rem', textAlign: 'center', borderRadius: 16, background: '#FFFFFF', border: '1px dashed rgba(11,31,58,0.12)', color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem' }}>
          Aún no hay empleos publicados. Las empresas del ecosistema publicarán oportunidades muy pronto.
        </div>
      )}
      {hasMore && !loading && (
        <button data-testid="jobs-load-more" onClick={() => load(false)}
          style={{ padding: '0.7rem 1rem', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)', color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cargar más</button>
      )}

      {applyOpen && (
        <div onClick={() => setApplyOpen(null)} data-testid="job-apply-modal"
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,28,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitApply}
            style={{ width: 'min(520px, 100%)', background: '#FFFFFF', borderRadius: 16, padding: '1.5rem 1.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#00A277', letterSpacing: '0.2em', fontWeight: 700 }}>POSTULACIÓN</div>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.15rem', color: NAVY, margin: '0.15rem 0 1rem' }}>{applyOpen.title}</h3>
            <label style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)', letterSpacing: '0.14em', fontWeight: 700 }}>CARTA DE PRESENTACIÓN</label>
            <textarea data-testid="job-apply-letter" value={applyLetter} onChange={(e) => setApplyLetter(e.target.value)}
              rows={5} maxLength={4000} placeholder="Cuéntanos por qué eres el/la candidato/a ideal…"
              style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(11,31,58,0.14)', marginTop: 6, fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }} />
            <button type="submit" disabled={applyBusy} data-testid="job-apply-submit"
              style={{ marginTop: '0.85rem', padding: '0.75rem 1.25rem', borderRadius: 100, background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem' }}>
              {applyBusy ? 'Enviando…' : 'Enviar postulación'}
            </button>
          </form>
        </div>
      )}
    </CategoryPage>
  );
};

export default JobsPage;
