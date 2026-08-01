import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, Globe2, Plus, Check, MapPin, ShieldCheck, ImagePlus, X } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { companyService } from '../services/platformService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import CompanyCreateModal from '../components/business/CompanyCreateModal';
import CompanyMediaManager from '../components/business/CompanyMediaManager';

const CompaniesPage = () => {
  const { user } = useCommunityAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [vertical, setVertical] = useState('');
  const [editMediaFor, setEditMediaFor] = useState(null); // company being edited
  const isAuthed = !!user && typeof user === 'object';

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const data = await companyService.list({
        limit: 20,
        cursor: reset ? undefined : cursor,
        vertical: vertical || undefined,
      });
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch (e) { /* silent */ } finally { setLoading(false); }
  }, [cursor, vertical]);

  useEffect(() => { setCursor(null); setHasMore(true); load(true); /* eslint-disable-next-line */ }, [vertical]);

  const onFollow = async (id) => {
    const r = await companyService.follow(id);
    setItems((prev) => prev.map((c) =>
      c.id === id ? { ...c, my_following: r.following, followers_count: c.followers_count + (r.following ? 1 : -1) } : c
    ));
    // Notify LiveFeed / Recommendations to refresh so the ranking picks up the
    // change immediately without a manual reload.
    try {
      window.dispatchEvent(new CustomEvent('pc:follow-change', {
        detail: { entityType: 'company', entityId: id, following: !!r.following },
      }));
    } catch { /* no-op */ }
  };

  const onCreated = (c) => setItems((prev) => [c, ...prev]);

  return (
    <CategoryPage
      icon="companies"
      eyebrow="Empresas del ecosistema"
      title="Las empresas que construyen el futuro"
      subtitle="Cada empresa comparte la misma base tecnológica One. Encuentra proveedores, aliados y equipos."
      testid="companies-page"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {['', 'legal', 'ia', 'salud', 'contabilidad', 'empresas'].map((v) => (
            <button key={v || 'all'} onClick={() => setVertical(v)}
              data-testid={`companies-filter-${v || 'all'}`}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: 100, cursor: 'pointer',
                background: vertical === v ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${vertical === v ? '#00C896' : 'rgba(11,31,58,0.1)'}`,
                color: vertical === v ? '#00A277' : 'rgba(11,31,58,0.7)',
                fontSize: '0.75rem', fontWeight: 700,
              }}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Todas'}</button>
          ))}
        </div>
        {isAuthed && (
          <button onClick={() => setShowCreate(true)} data-testid="companies-create-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0.55rem 1rem', borderRadius: 100,
              background: NAVY, color: '#FFFFFF', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem',
            }}><Plus size={14} /> Nueva empresa</button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        {items.map((c, idx) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: idx * 0.03 }}
            data-testid={`company-card-${c.id}`}
            style={{
              background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(11,31,58,0.06)',
              boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ height: 68, background: c.banner_url
                ? `url(${c.banner_url}) center/cover`
                : 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 100%)' }} />
            <div style={{ padding: '0.9rem 1.15rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: -22 }}>
              <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-end' }}>
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} style={{ width: 46, height: 46, borderRadius: 10, border: '3px solid #FFFFFF', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 46, height: 46, borderRadius: 10, border: '3px solid #FFFFFF',
                    background: NAVY, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1.2rem',
                  }}>{c.name.charAt(0).toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1rem', fontWeight: 700, color: NAVY, margin: 0, letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Link to={`/empresas/${c.id}`} data-testid={`company-link-${c.id}`}
                      style={{ color: NAVY, textDecoration: 'none' }}>{c.name}</Link>
                    {c.verification === 'verified' && <ShieldCheck size={14} color="#00C896" />}
                  </h2>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>
                    {c.vertical} {c.country && `· ${c.country}`}
                  </div>
                </div>
              </div>
              {c.tagline && (
                <p style={{ fontSize: '0.85rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.5 }}>{c.tagline}</p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', alignItems: 'center' }}>
                <span data-testid={`company-followers-${c.id}`}>{c.followers_count} seguidor{c.followers_count === 1 ? '' : 'es'}</span>
                <span>· {c.jobs_count} empleos</span>
                <span>· {c.events_count} eventos</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                {isAuthed && (
                  <button onClick={() => onFollow(c.id)} data-testid={`company-follow-${c.id}`}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 100, cursor: 'pointer',
                      border: `1px solid ${c.my_following ? '#00C896' : 'rgba(11,31,58,0.12)'}`,
                      background: c.my_following ? 'rgba(0,200,150,0.12)' : '#FFFFFF',
                      color: c.my_following ? '#00A277' : NAVY,
                      fontSize: '0.72rem', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                    {c.my_following ? <><Check size={11} /> Siguiendo</> : '+ Seguir'}
                  </button>
                )}
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer"
                    data-testid={`company-website-${c.id}`}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 100,
                      background: 'transparent', border: '1px solid rgba(11,31,58,0.12)',
                      color: NAVY, textDecoration: 'none', fontSize: '0.72rem', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>Visitar <ExternalLink size={10} /></a>
                )}
                {isAuthed && (c.owner_id === user?.id || user?.role === 'admin') && (
                  <button onClick={() => setEditMediaFor(c)}
                    data-testid={`company-edit-media-${c.id}`}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 100,
                      background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.4)',
                      color: '#00A277', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                    <ImagePlus size={11} /> Editar media
                  </button>
                )}
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>
      )}
      {!loading && items.length === 0 && (
        <div data-testid="companies-empty" style={{
          padding: '2rem', textAlign: 'center', borderRadius: 16, background: '#FFFFFF',
          border: '1px dashed rgba(11,31,58,0.12)', color: 'rgba(11,31,58,0.6)', fontSize: '0.9rem',
        }}>
          Aún no hay empresas registradas{vertical ? ' en esta vertical' : ''}. {isAuthed ? '¡Sé la primera!' : 'Únete y publica tu empresa.'}
        </div>
      )}
      {hasMore && !loading && (
        <button data-testid="companies-load-more" onClick={() => load(false)}
          style={{ padding: '0.7rem 1rem', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.08)', color: NAVY, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
          Cargar más
        </button>
      )}

      {showCreate && (
        <CompanyCreateModal onClose={() => setShowCreate(false)} onCreated={(c) => { onCreated(c); setShowCreate(false); }} />
      )}

      {editMediaFor && (
        <MediaEditModal
          company={editMediaFor}
          onClose={() => setEditMediaFor(null)}
          onUpdated={async () => {
            try {
              const fresh = await companyService.get(editMediaFor.id);
              setItems((prev) => prev.map((c) => (c.id === fresh.id ? { ...c, ...fresh } : c)));
              setEditMediaFor(fresh);
            } catch { /* noop */ }
          }}
        />
      )}
    </CategoryPage>
  );
};

const MediaEditModal = ({ company, onClose, onUpdated }) => (
  <div data-testid="company-media-modal" style={{
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(10,15,28,0.78)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '3rem 1.5rem', overflowY: 'auto',
  }} onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#F7F8FC', borderRadius: 22,
        width: '100%', maxWidth: 960, padding: '1.75rem 1.75rem 2.25rem',
        boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '1.25rem', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 700,
                        color: '#00A277', marginBottom: 4 }}>GESTIÓN DE MEDIA</div>
          <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.2rem',
                        fontWeight: 700, color: NAVY }}>{company.name}</div>
        </div>
        <button onClick={onClose} data-testid="company-media-modal-close"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: 'none', background: 'rgba(11,31,58,0.06)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: NAVY,
          }}><X size={16} /></button>
      </div>
      <CompanyMediaManager company={company} onUpdated={onUpdated} canEdit />
    </motion.div>
  </div>
);

export default CompaniesPage;
