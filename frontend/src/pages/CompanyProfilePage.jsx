import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Globe, MapPin, Building2, ExternalLink, Check, Plus,
  Edit3, Save, X, Linkedin, Instagram, Facebook, Twitter, Youtube, Music,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CompanyMediaManager from '../components/business/CompanyMediaManager';
import CompanyRelated from '../components/business/CompanyRelated';
import FollowButton from '../components/community/FollowButton';
import { companyService } from '../services/platformService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const API = process.env.REACT_APP_BACKEND_URL;

const SOCIAL_ICONS = {
  website:   { Icon: Globe,     label: 'Sitio web' },
  linkedin:  { Icon: Linkedin,  label: 'LinkedIn' },
  twitter:   { Icon: Twitter,   label: 'X' },
  x:         { Icon: Twitter,   label: 'X' },
  instagram: { Icon: Instagram, label: 'Instagram' },
  facebook:  { Icon: Facebook,  label: 'Facebook' },
  youtube:   { Icon: Youtube,   label: 'YouTube' },
  github:    { Icon: ExternalLink, label: 'GitHub' },
  tiktok:    { Icon: Music,     label: 'TikTok' },
  rss:       { Icon: ExternalLink, label: 'RSS' },
};

/**
 * CompanyProfilePage — LinkedIn/Facebook style profile at /empresas/:id.
 * Inline editing for owners (no modal). Media manager, description, socials,
 * website — all editable in place with progress, previews and skeletons.
 */
const CompanyProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useCommunityAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followBusy, setFollowBusy] = useState(false);

  const refetch = useCallback(async () => {
    try { setCompany(await companyService.get(id)); }
    catch (e) { setError('No se pudo cargar la empresa'); }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  const isOwner = !!company && !!user && (company.owner_id === user.id || user.role === 'admin');

  const patch = async (payload) => {
    try {
      const updated = await companyService.update(company.id, payload);
      setCompany((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      // Fallback: refetch full doc
      refetch();
    }
  };

  const toggleFollow = async () => {
    if (!user || followBusy) return;
    setFollowBusy(true);
    try {
      const method = company.my_following ? 'DELETE' : 'POST';
      const res = await fetch(`${API}/api/companies/${company.id}/follow`, {
        method, credentials: 'include',
      });
      if (res.ok) refetch();
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 58, background: '#F7F8FC', minHeight: '100vh' }}>
          <SkeletonCompany />
        </main>
        <Footer />
      </>
    );
  }

  if (error || !company) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 58, minHeight: '100vh', background: '#F7F8FC',
                       display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Building2 size={40} color="rgba(11,31,58,0.3)" />
            <h1 style={{ color: NAVY, margin: '1rem 0' }}>Empresa no encontrada</h1>
            <button onClick={() => navigate('/empresas')} style={backBtn}>Ver todas las empresas</button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const bannerUrl = company.banner_url ? (company.banner_url.startsWith('http') ? company.banner_url : `${API}${company.banner_url}`) : null;
  const logoUrl = company.logo_url ? (company.logo_url.startsWith('http') ? company.logo_url : `${API}${company.logo_url}`) : null;

  return (
    <>
      <Header />
      <main data-testid="company-profile-page" style={{ paddingTop: 58, background: '#F7F8FC', minHeight: '100vh' }}>
        {/* Breadcrumbs */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.25rem 2rem 0.25rem' }}>
          <nav style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)',
                        display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link to="/" style={crumb}>Inicio</Link>
            <span>›</span>
            <Link to="/empresas" style={crumb}>Empresas</Link>
            <span>›</span>
            <span style={{ color: NAVY, fontWeight: 600 }}>{company.name}</span>
          </nav>
        </div>

        {/* Hero banner + logo */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0.75rem 2rem 0' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 22, overflow: 'hidden',
            border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 6px 30px rgba(11,31,58,0.05)',
          }}>
            <div style={{
              height: 220,
              background: bannerUrl
                ? `linear-gradient(180deg, transparent 40%, rgba(11,31,58,0.35) 100%), url(${bannerUrl}) center/cover`
                : `linear-gradient(135deg, ${NAVY}, #4C1D95)`,
              position: 'relative',
            }} />
            <div style={{ padding: '0 2rem 1.5rem', display: 'flex', gap: '1.5rem',
                          alignItems: 'flex-end', marginTop: -60, flexWrap: 'wrap' }}>
              <div style={{
                width: 130, height: 130, borderRadius: 22, background: '#FFFFFF',
                border: '4px solid #FFFFFF', boxShadow: '0 12px 40px rgba(11,31,58,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {logoUrl ? (
                  <img src={logoUrl} alt={company.name} referrerPolicy="no-referrer" loading="lazy"
                    onError={(e) => {
                      const fb = e.target.nextSibling;
                      e.target.style.display = 'none';
                      if (fb) fb.style.display = 'flex';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
                <span style={{
                  display: logoUrl ? 'none' : 'flex',
                  width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.4rem',
                  fontWeight: 700, color: NAVY,
                }}>
                  {(company.name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 260, paddingTop: '1rem' }}>
                <h1 style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700,
                  color: NAVY, margin: 0, letterSpacing: '-0.02em',
                }}>{company.name}</h1>
                {company.tagline && (
                  <div style={{ fontSize: '0.95rem', color: 'rgba(11,31,58,0.65)', marginTop: 4 }}>
                    {company.tagline}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.6rem',
                              fontSize: '0.78rem', color: 'rgba(11,31,58,0.55)', flexWrap: 'wrap' }}>
                  {company.vertical && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={12} /> {company.vertical}
                    </span>
                  )}
                  {(company.city || company.country) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} /> {[company.city, company.country].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {company.follower_count > 0 && (
                    <span>{company.follower_count} seguidores</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '1rem' }}>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                    Visitar <ExternalLink size={12} />
                  </a>
                )}
                {user && !isOwner && (
                  <FollowButton entityType="company" entityId={company.id}
                    initialFollowing={company.my_following}
                    testid="company-profile-follow" size="md"
                    onChange={() => refetch()} />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Grid: main col + side col */}
        <section style={{
          maxWidth: 1180, margin: '0 auto', padding: '1.5rem 2rem 4rem',
          display: 'grid', gap: '1.25rem',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        }} className="pcone-profile-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
            {/* Description */}
            <SectionCard title="Sobre nosotros" testid="company-description-card">
              <EditableText
                value={company.description}
                placeholder="Describe la empresa en 1-3 párrafos: qué hacen, para quién y qué los diferencia."
                canEdit={isOwner}
                onSave={(v) => patch({ description: v })}
                multiline
              />
            </SectionCard>

            {/* Media manager (owner-only interactive; visitors see previews via banner+logo above) */}
            {isOwner && (
              <SectionCard title="Media" testid="company-media-section">
                <CompanyMediaManager company={company} onUpdated={refetch} canEdit={isOwner} />
              </SectionCard>
            )}

            {/* Gallery preview for visitors */}
            {!isOwner && (company.gallery || []).length > 0 && (
              <SectionCard title="Galería" testid="company-gallery-view">
                <div style={{
                  display: 'grid', gap: '0.55rem',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                }}>
                  {(company.gallery || []).map((rel, i) => {
                    const src = rel.startsWith('http') ? rel : `${API}${rel}`;
                    return (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                         data-testid={`gallery-view-${i}`}
                         style={{
                          display: 'block', aspectRatio: '1 / 1', borderRadius: 10,
                          background: `url(${src}) center/cover`,
                          border: '1px solid rgba(11,31,58,0.08)',
                         }} />
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
            {/* Website + socials */}
            <SectionCard title="Enlaces" testid="company-links-card">
              <EditableSocials company={company} canEdit={isOwner} onSave={(payload) => patch(payload)} />
            </SectionCard>

            {/* Contact info */}
            <SectionCard title="Ubicación" testid="company-location-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
                <LabelValue label="País" value={company.country} />
                <LabelValue label="Ciudad" value={company.city} />
                <LabelValue label="Vertical" value={company.vertical} />
              </div>
            </SectionCard>

            {/* Discovery — reuses public sources: news, videos, repos, jobs, events, similar */}
            <CompanyRelated slug={company.slug} />
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        @media (max-width: 900px) {
          .pcone-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
};

/* ---------- Small pieces ---------- */
const SectionCard = ({ title, children, testid }) => (
  <div data-testid={testid} style={{
    background: '#FFFFFF', borderRadius: 18, padding: '1.35rem 1.5rem 1.15rem',
    border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      fontSize: '0.65rem', letterSpacing: '0.22em', fontWeight: 700,
      color: EMERALD, marginBottom: '0.85rem',
    }}>{title.toUpperCase()}</div>
    {children}
  </div>
);

const EditableText = ({ value, placeholder, canEdit, onSave, multiline }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  if (editing) {
    return (
      <div>
        {multiline ? (
          <textarea data-testid="editable-textarea"
            value={text} onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%', minHeight: 130, padding: '0.75rem',
              border: '1px solid rgba(11,31,58,0.15)', borderRadius: 10,
              fontFamily: 'inherit', fontSize: '0.92rem', resize: 'vertical',
            }} />
        ) : (
          <input data-testid="editable-input" value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%', padding: '0.55rem 0.75rem',
              border: '1px solid rgba(11,31,58,0.15)', borderRadius: 10,
              fontFamily: 'inherit', fontSize: '0.92rem',
            }} />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button data-testid="editable-save" onClick={() => { onSave(text); setEditing(false); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.4rem 0.85rem', borderRadius: 100,
              background: EMERALD, color: '#FFFFFF', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 700,
            }}><Save size={12} /> Guardar</button>
          <button onClick={() => { setText(value || ''); setEditing(false); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.4rem 0.85rem', borderRadius: 100,
              background: 'transparent', color: 'rgba(11,31,58,0.7)',
              border: '1px solid rgba(11,31,58,0.15)', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 600,
            }}><X size={12} /> Cancelar</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', paddingRight: canEdit ? 32 : 0 }}>
      {value ? (
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.95rem',
                    lineHeight: 1.65, color: NAVY }}>{value}</p>
      ) : (
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(11,31,58,0.5)',
                    fontStyle: 'italic' }}>{placeholder}</p>
      )}
      {canEdit && (
        <button onClick={() => setEditing(true)} data-testid="editable-edit-btn"
          aria-label="Editar"
          style={{
            position: 'absolute', top: 0, right: 0,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(11,31,58,0.06)', border: 'none', cursor: 'pointer',
            color: 'rgba(11,31,58,0.7)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}><Edit3 size={13} /></button>
      )}
    </div>
  );
};

const EditableSocials = ({ company, canEdit, onSave }) => {
  const social = company.social || {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ website: company.website || '', ...social });

  useEffect(() => {
    setForm({ website: company.website || '', ...(company.social || {}) });
  }, [company.website, company.social]);

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(SOCIAL_ICONS).map(([k, { Icon, label }]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(11,31,58,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(11,31,58,0.7)' }}>
              <Icon size={14} />
            </div>
            <input data-testid={`social-input-${k}`}
              value={form[k] || ''} placeholder={label}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: 8,
                       border: '1px solid rgba(11,31,58,0.12)', fontSize: '0.85rem' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button data-testid="socials-save" onClick={() => {
            const { website, ...rest } = form;
            onSave({ website, social: rest });
            setEditing(false);
          }} style={saveBtn}><Save size={12} /> Guardar</button>
          <button onClick={() => setEditing(false)} style={cancelBtn}><X size={12} /> Cancelar</button>
        </div>
      </div>
    );
  }

  const entries = Object.entries(SOCIAL_ICONS).filter(([k]) => (k === 'website' ? company.website : (social || {})[k]));

  return (
    <div style={{ position: 'relative', paddingRight: canEdit ? 32 : 0 }}>
      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(11,31,58,0.5)', fontStyle: 'italic' }}>
          Aún no hay enlaces configurados.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entries.map(([k, { Icon, label }]) => {
            const url = k === 'website' ? company.website : (social || {})[k];
            return (
              <a key={k} href={url} target="_blank" rel="noopener noreferrer"
                data-testid={`social-link-${k}`}
                title={label}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#F5F6FA', color: NAVY, textDecoration: 'none',
                  border: '1px solid rgba(11,31,58,0.08)',
                }}>
                <Icon size={14} />
              </a>
            );
          })}
        </div>
      )}
      {canEdit && (
        <button onClick={() => setEditing(true)} data-testid="socials-edit-btn"
          style={{ position: 'absolute', top: 0, right: 0,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(11,31,58,0.06)', border: 'none', cursor: 'pointer',
            color: 'rgba(11,31,58,0.7)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Edit3 size={13} />
        </button>
      )}
    </div>
  );
};

const LabelValue = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(11,31,58,0.05)', paddingBottom: 6 }}>
    <span style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.55)', fontWeight: 600,
                   letterSpacing: '0.06em' }}>{label.toUpperCase()}</span>
    <span style={{ fontSize: '0.85rem', color: NAVY, fontWeight: 600 }}>{value || '—'}</span>
  </div>
);

const SkeletonCompany = () => (
  <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem 2rem' }}>
    <div className="pc-skel" style={{ height: 32, width: 260, borderRadius: 6, marginBottom: 20 }} />
    <div style={{ background: '#FFFFFF', borderRadius: 22, height: 340, marginBottom: 20,
                  border: '1px solid rgba(11,31,58,0.06)', overflow: 'hidden' }}>
      <div className="pc-skel" style={{ height: 220 }} />
    </div>
    <div style={{ background: '#FFFFFF', borderRadius: 18, padding: 20, height: 180 }} />
    <style>{`.pc-skel { background: linear-gradient(90deg,#eef1f7 0%,#f8f9fc 50%,#eef1f7 100%);
      background-size: 200% 100%; animation: pcSkel 1.4s ease-in-out infinite; }
      @keyframes pcSkel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '0.55rem 1.05rem', borderRadius: 100, cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 700,
};
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none',
  padding: '0.55rem 1.05rem', borderRadius: 100,
  background: 'transparent', color: NAVY,
  border: '1px solid rgba(11,31,58,0.12)', fontSize: '0.78rem', fontWeight: 600,
};
const saveBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '0.4rem 0.85rem', borderRadius: 100,
  background: EMERALD, color: '#FFFFFF', border: 'none', cursor: 'pointer',
  fontSize: '0.75rem', fontWeight: 700,
};
const cancelBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '0.4rem 0.85rem', borderRadius: 100,
  background: 'transparent', color: 'rgba(11,31,58,0.7)',
  border: '1px solid rgba(11,31,58,0.15)', cursor: 'pointer',
  fontSize: '0.75rem', fontWeight: 600,
};
const crumb = { color: 'rgba(11,31,58,0.55)', textDecoration: 'none' };
const backBtn = {
  display: 'inline-flex', padding: '0.65rem 1.1rem',
  borderRadius: 100, background: NAVY, color: '#FFFFFF',
  border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
};

export default CompanyProfilePage;
