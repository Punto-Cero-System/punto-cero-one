import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, LogOut, Shield, Sparkles, FileText, Rocket, Loader, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const EMERALD = '#00C896';
const GOLD = '#D4AF37';

const KIND_META = {
  experience: { icon: Sparkles, label: 'Experiencia', color: EMERALD },
  document: { icon: FileText, label: 'Documento', color: GOLD },
  product: { icon: Rocket, label: 'Producto', color: '#7CC4FF' },
};

const InvestorPortalPage = () => {
  const { user, logout, authFetch, token } = useAuth();
  const [data, setData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRes, docsRes] = await Promise.all([
        authFetch('/api/investor/room'),
        authFetch('/api/documents?vertical=investor'),
      ]);
      if (!roomRes.ok) throw new Error('No se pudo cargar el portal');
      setData(await roomRes.json());
      if (docsRes.ok) {
        const dd = await docsRes.json();
        setDocuments(dd.items || []);
      }
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const downloadDocument = async (doc) => {
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
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

  const logAccess = (docId, action = 'view') => {
    authFetch('/api/investor/access-log', {
      method: 'POST',
      body: JSON.stringify({ document_id: docId, action }),
    }).catch(() => {});
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)', color: '#FFFFFF', fontFamily: '"Space Grotesk", sans-serif' }} data-testid="investor-portal">
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(11,31,58,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}>
            PUNTO CERO <span style={{ color: EMERALD }}>SYSTEM</span>
          </Link>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.35rem 0.9rem', background: 'rgba(212,175,55,0.1)',
            border: `1px solid ${GOLD}55`, borderRadius: '100px',
          }}>
            <Shield size={11} color={GOLD} />
            <span style={{ fontSize: '0.68rem', color: GOLD, fontWeight: 700, letterSpacing: '0.25em' }}>INVESTOR ROOM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }} data-testid="investor-email">
              {user?.email}
            </span>
            <button onClick={logout} data-testid="investor-logout" className="interactive" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '100px',
              color: '#FFFFFF', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <LogOut size={12} /> Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div style={{ fontSize: '0.7rem', color: EMERALD, letterSpacing: '0.3em', fontWeight: 700, marginBottom: '1rem' }}>
            PORTAL PRIVADO DEL INVERSIONISTA
          </div>
          <h1 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', fontWeight: 300,
            letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1rem',
          }}>
            Bienvenido, <span style={{ fontWeight: 700, color: GOLD }}>{user?.name || 'Inversionista'}</span>.
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)', maxWidth: '640px', fontWeight: 300, lineHeight: 1.6 }}>
            Este es tu espacio privado con acceso curado al ecosistema de Punto Cero System.
            Cada visita queda registrada de forma segura.
          </p>
        </motion.div>

        {/* Loading / error */}
        {loading && (
          <div data-testid="portal-loading" style={{ marginTop: '3rem', color: 'rgba(255,255,255,0.5)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Loader size={14} className="spin" /> Cargando catálogo…
          </div>
        )}
        {error && (
          <div data-testid="portal-error" style={{ marginTop: '3rem', color: '#ff9a9a' }}>{error}</div>
        )}

        {/* Documents catalog */}
        {data && (
          <section style={{ marginTop: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.5rem' }}>
                  CATÁLOGO CURADO
                </div>
                <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.6rem', fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
                  Documentos y experiencias
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }} data-testid="portal-doc-count">
                {data.documents.length} recursos disponibles
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {data.documents.map((doc, i) => {
                const meta = KIND_META[doc.kind] || KIND_META.experience;
                const Icon = meta.icon;
                const isExternal = doc.external || String(doc.path).startsWith('http') || String(doc.path).startsWith('/api/');
                const onOpen = () => logAccess(doc.id, isExternal ? 'download' : 'view');

                const inner = (
                  <motion.div
                    whileHover={{ y: -4 }}
                    data-testid={`portal-doc-${doc.id}`}
                    className="interactive"
                    style={{
                      padding: '1.75rem', background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${meta.color}44`, borderRadius: '20px',
                      display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        background: meta.color + '18', border: `1px solid ${meta.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={meta.color} />
                      </div>
                      <span style={{
                        padding: '0.22rem 0.65rem',
                        background: meta.color + '18', border: `1px solid ${meta.color}44`,
                        borderRadius: '100px', fontSize: '0.6rem',
                        color: meta.color, fontWeight: 700, letterSpacing: '0.15em',
                      }}>{meta.label.toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>{doc.title}</div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{doc.description}</div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: meta.color, fontSize: '0.78rem', fontWeight: 700 }}>
                      {isExternal ? 'Abrir recurso' : 'Ver experiencia'} {isExternal ? <ExternalLink size={12} /> : <ArrowRight size={12} />}
                    </div>
                  </motion.div>
                );

                return isExternal ? (
                  <a key={doc.id} href={doc.path} target="_blank" rel="noreferrer" onClick={onOpen} style={{ textDecoration: 'none' }}>
                    {inner}
                  </a>
                ) : (
                  <Link key={doc.id} to={doc.path} onClick={onOpen} style={{ textDecoration: 'none' }}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Uploaded documents section — pulls from /api/documents (Investor Center vertical) */}
        {documents.length > 0 && (
          <section data-testid="portal-documents-section" style={{ marginTop: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: GOLD, letterSpacing: '0.25em', fontWeight: 700, marginBottom: '0.5rem' }}>
                  REPOSITORIO INSTITUCIONAL
                </div>
                <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.6rem', fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
                  Documentos privados
                </h2>
              </div>
              <span data-testid="portal-documents-count" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                {documents.length} documento{documents.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {documents.map((d) => (
                <motion.button
                  key={d.id}
                  whileHover={{ y: -3 }}
                  onClick={() => downloadDocument(d)}
                  data-testid={`portal-document-${d.id}`}
                  style={{
                    padding: '1.15rem 1.25rem', borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(212,175,55,0.35)',
                    color: '#FFFFFF', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '0.55rem',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: `${GOLD}18`, border: `1px solid ${GOLD}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><FileText size={16} color={GOLD} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>{d.original_filename}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                        {d.category.replace('_', ' ')} · {(d.size_bytes / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: GOLD, fontWeight: 700 }}>
                    <Download size={12} /> Descargar
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Footer bridge */}
        <footer style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
          <div>© Punto Cero System · Investor Room · Acceso privado</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href="https://puntocerolegal.com" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Punto Cero Legal</a>
          </div>
        </footer>
      </main>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default InvestorPortalPage;
