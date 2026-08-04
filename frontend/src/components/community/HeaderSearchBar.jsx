import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { searchService } from '../../services/coreServices';

const NAVY = '#0B1F3A';

const TYPE_LABEL = {
  people: 'Persona', companies: 'Empresa', posts: 'Publicación',
  jobs: 'Empleo', events: 'Evento', hashtags: 'Hashtag',
  categories: 'Categoría', documents: 'Documento',
  videos: 'Video', repos: 'Repositorio', news: 'Noticia',
};

/**
 * HeaderSearchBar — single-search across every resource type.
 * Debounced suggest, keyboard-friendly, cross-vertical.
 */
const HeaderSearchBar = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ by_type: {}, total: 0 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults({ by_type: {}, total: 0 });
      return;
    }
    setBusy(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try { setResults(await searchService.search(q.trim(), { limit: 5 })); }
      catch { setResults({ by_type: {}, total: 0 }); }
      finally { setBusy(false); }
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  const flat = Object.entries(results.by_type).flatMap(([type, items]) => (items || []).map((r) => ({ ...r, type })));

  const goto = (r) => {
    setOpen(false); setQ('');
    if (!r.url) return;
    // External resources (github, youtube, source article) open in a new tab.
    if (/^https?:/i.test(r.url)) {
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(r.url);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 100, padding: '0.35rem 0.85rem',
      }}>
        <Search size={13} color="rgba(255,255,255,0.6)" />
        <input
          type="text" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          data-testid="header-search-input"
          placeholder="Buscar personas, empresas, empleos, eventos…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '0.82rem' }}
        />
        {q && (
          <button onClick={() => { setQ(''); setOpen(false); }} data-testid="header-search-clear"
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            data-testid="header-search-dropdown"
            style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#0A0F1C', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, maxHeight: 420, overflow: 'auto', zIndex: 60,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            {busy && flat.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>Buscando…</div>
            )}
            {!busy && flat.length === 0 && (
              <div data-testid="header-search-empty" style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>
                Sin resultados para «{q}»
              </div>
            )}
            {flat.map((r) => (
              <button key={`${r.type}-${r.id}`} onClick={() => goto(r)}
                data-testid={`header-search-result-${r.type}-${r.id}`}
                style={{ width: '100%', padding: '0.7rem 0.9rem', display: 'flex', gap: '0.7rem',
                         background: 'transparent', border: 'none', color: '#FFFFFF', textAlign: 'left', cursor: 'pointer',
                         borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
                {r.image ? (
                  <img src={r.image} alt="" referrerPolicy="no-referrer"
                    style={{ width: 40, height: 40, borderRadius: r.type === 'people' ? '50%' : 10, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: r.type === 'people' ? '50%' : 10, background: 'linear-gradient(135deg, #1E1B4B, #4C1D95)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{(r.title || '·').charAt(0).toUpperCase()}</div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{r.title}</div>
                    <span style={{
                      padding: '0.1rem 0.45rem', borderRadius: 100,
                      background: 'rgba(0,200,150,0.18)', color: '#00C896',
                      fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.1em',
                    }}>{(TYPE_LABEL[r.type] || r.type).toUpperCase()}</span>
                  </div>
                  {r.subtitle && (
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.subtitle}
                    </div>
                  )}
                  {(r.meta?.company || r.meta?.location || r.meta?.headline) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', flexWrap: 'wrap' }}>
                      {r.meta?.headline && <span>{r.meta.headline}</span>}
                      {r.meta?.company && <span>· {r.meta.company}</span>}
                      {r.meta?.location && <span>· {r.meta.location}</span>}
                    </div>
                  )}
                  {r.meta?.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {r.meta.tags.slice(0, 3).map((t) => (
                        <span key={t} style={{
                          padding: '1px 6px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)',
                          fontSize: '0.58rem', fontWeight: 700,
                        }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeaderSearchBar;
