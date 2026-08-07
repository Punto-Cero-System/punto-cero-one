import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Globe2, Award, Edit3, Save, X, Camera, ImageIcon, Trash2, ShieldCheck, TrendingUp, Star, BadgeCheck } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { profileService } from '../services/platformService';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * ProfilePage — expanded professional profile with inline edit.
 *
 * Fields: name, headline, bio, country, city, languages, skills, specialties,
 * verticals, current company + title, portfolio_url, social links.
 * Uses PATCH /api/community/users/me — server persists into the users doc.
 */
const ProfilePage = () => {
  const { user, refresh } = useCommunityAuth();
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFull(await profileService.me()); }
    catch { setFull(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setLoading(false); return; }
    load();
  }, [user, load]);

  if (user === undefined || loading) {
    return (
      <CategoryPage icon="community" eyebrow="Perfil" title="Cargando tu perfil…" subtitle="Un momento mientras verificamos tu sesión." testid="profile-loading">
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '2rem', textAlign: 'center', color: 'rgba(11,31,58,0.5)' }}>Cargando…</div>
      </CategoryPage>
    );
  }
  if (!user) return <Navigate to="/join" replace />;
  if (!full) return null;

  return (
    <CategoryPage icon="community" eyebrow="Perfil profesional" title={full.name} subtitle={full.headline || `${full.email} · Miembro de Punto Cero One`} testid="profile-page">
      {editing ? (
        <ProfileEditor initial={full} onCancel={() => setEditing(false)} onSaved={async (fresh) => {
          setFull(fresh); setEditing(false); await refresh();
        }} />
      ) : (
        <ProfileView profile={full} onEdit={() => setEditing(true)}
          onMediaUpdate={async (patch) => {
            setFull((f) => ({ ...f, ...patch }));
            await refresh();
          }} />
      )}
    </CategoryPage>
  );
};

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
const ProfileView = ({ profile, onEdit, onMediaUpdate }) => (
  <>
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      data-testid="profile-view"
      style={{ background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 4px 20px rgba(11,31,58,0.04)' }}>
      <CoverBand cover={profile.cover_url} onUpdate={onMediaUpdate} />
      <div style={{ padding: '0 1.5rem 1.5rem', marginTop: -60 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <AvatarWithUpload profile={profile} onUpdate={onMediaUpdate} />
          <div style={{ flex: 1, minWidth: 0, paddingBottom: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 data-testid="profile-name" style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.02em', color: NAVY, margin: 0 }}>{profile.name}</h2>
              {profile.email_verified && (
                <span data-testid="profile-verified-badge" title="Email verificado"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '0.2rem 0.55rem', borderRadius: 100,
                    background: 'rgba(0,200,150,0.13)', color: '#00825E',
                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em',
                  }}><BadgeCheck size={11} /> VERIFICADO</span>
              )}
            </div>
            <div data-testid="profile-headline" style={{ fontSize: '0.9rem', color: 'rgba(11,31,58,0.75)', marginTop: '0.15rem' }}>{profile.headline || 'Miembro de Punto Cero One'}</div>
            <div data-testid="profile-email" style={{ fontSize: '0.8rem', color: 'rgba(11,31,58,0.55)', marginTop: '0.1rem' }}>
              <Mail size={11} style={{ verticalAlign: -1, marginRight: 4 }} />{profile.email}
              {(profile.country || profile.city) && <> · <Globe2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />{[profile.city, profile.country].filter(Boolean).join(', ')}</>}
            </div>
            {(profile.current_title || profile.current_company) && (
              <div style={{ fontSize: '0.82rem', color: 'rgba(11,31,58,0.7)', marginTop: '0.4rem' }}>
                <Award size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                {[profile.current_title, profile.current_company].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <button onClick={onEdit} data-testid="profile-edit-btn"
            style={{ padding: '0.55rem 1rem', borderRadius: 100, border: 'none', background: NAVY, color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Edit3 size={13} /> Editar perfil
          </button>
        </div>

        {/* Estructura para el futuro perfil profesional: insignias / ranking / nivel */}
        <ProfessionalStructureRow profile={profile} />

        {profile.bio && (
          <div style={{ marginTop: '1.35rem', padding: '1rem 1.15rem', borderRadius: 12, background: '#F4F6FB', border: '1px solid rgba(11,31,58,0.06)' }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: 'rgba(11,31,58,0.5)', marginBottom: '0.5rem' }}>ACERCA DE</div>
            <p data-testid="profile-bio" style={{ fontSize: '0.88rem', color: 'rgba(11,31,58,0.78)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
          </div>
        )}
      </div>
    </motion.section>

    <TagBlock title="Especialidad" tags={profile.specialties} testid="profile-specialties" />
    <TagBlock title="Intereses"    tags={profile.interests}    testid="profile-interests" />
  </>
);

/**
 * CoverBand — banner superior editable. Muestra la imagen de portada + botón
 * de edición flotante que abre un file picker. Delete opcional.
 */
const CoverBand = ({ cover, onUpdate }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/api/community/users/me/media/cover`, {
        method: 'PUT', body: form, credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'upload_failed');
      const data = await res.json();
      onUpdate?.({ cover_url: data.url });
    } catch { /* toast? */ } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/api/community/users/me/media/cover`, {
        method: 'DELETE', credentials: 'include',
      });
      onUpdate?.({ cover_url: null });
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      position: 'relative', height: 160,
      background: cover
        ? `#0B1F3A center / cover no-repeat url(${cover})`
        : 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 80%, #EC4899 100%)',
    }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={upload}
        data-testid="profile-cover-input" style={{ display: 'none' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        <button onClick={pick} disabled={busy} data-testid="profile-cover-upload"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '0.4rem 0.7rem', borderRadius: 100,
            background: 'rgba(255,255,255,0.9)', border: 'none',
            color: '#0B1F3A', fontSize: '0.7rem', fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}>
          <ImageIcon size={12} /> {cover ? 'Cambiar portada' : 'Subir portada'}
        </button>
        {cover && (
          <button onClick={clear} disabled={busy} data-testid="profile-cover-delete"
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '0.4rem 0.55rem', borderRadius: 100,
              background: 'rgba(11,31,58,0.75)', border: 'none',
              color: '#FFFFFF', fontSize: '0.7rem', fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
            }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * AvatarWithUpload — foto circular + botón flotante para cambiar/borrar.
 */
const AvatarWithUpload = ({ profile, onUpdate }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/api/community/users/me/media/picture`, {
        method: 'PUT', body: form, credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'upload_failed');
      const data = await res.json();
      onUpdate?.({ picture: data.url });
    } finally { setBusy(false); }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/api/community/users/me/media/picture`, {
        method: 'DELETE', credentials: 'include',
      });
      onUpdate?.({ picture: null });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={upload}
        data-testid="profile-picture-input" style={{ display: 'none' }} />
      {profile.picture ? (
        <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer" data-testid="profile-avatar"
          style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 8px 24px rgba(11,31,58,0.15)' }} />
      ) : (
        <div data-testid="profile-avatar-fallback"
          style={{ width: 120, height: 120, borderRadius: '50%', background: '#0A0F1C', border: '4px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '3rem', color: '#FFFFFF' }}>
          {(profile.name || profile.email || '0').charAt(0).toUpperCase()}
        </div>
      )}
      <button onClick={pick} disabled={busy} data-testid="profile-picture-upload"
        style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 34, height: 34, borderRadius: '50%',
          background: NAVY, border: '3px solid #FFFFFF',
          color: '#FFFFFF', cursor: busy ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
        <Camera size={14} />
      </button>
      {profile.picture && (
        <button onClick={clear} disabled={busy} data-testid="profile-picture-delete"
          title="Quitar foto"
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 26, height: 26, borderRadius: '50%',
            background: '#B91C1C', border: '2px solid #FFFFFF',
            color: '#FFFFFF', cursor: busy ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
};

/**
 * ProfessionalStructureRow — placeholders visuales para las próximas capas
 * (insignias, ranking, nivel, verificación profesional). NO activa
 * monetización. Solo comunica que el perfil está listo para evolucionar.
 */
const ProfessionalStructureRow = ({ profile }) => (
  <div data-testid="profile-professional-row" style={{
    marginTop: '1.15rem', display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.55rem',
  }}>
    <StatChip icon={ShieldCheck} label="Verificación" value="Próximamente" color="#0EA5E9"
      testid="profile-stat-verification" />
    <StatChip icon={Star} label="Insignias" value={profile.badges_count || 0} color="#F59E0B"
      testid="profile-stat-badges" />
    <StatChip icon={TrendingUp} label="Nivel" value={profile.level || 'Miembro'} color="#8B5CF6"
      testid="profile-stat-level" />
    <StatChip icon={Award} label="Ranking" value={profile.ranking || '—'} color="#00C896"
      testid="profile-stat-ranking" />
  </div>
);

const StatChip = ({ icon: Icon, label, value, color, testid }) => (
  <div data-testid={testid} style={{
    display: 'flex', alignItems: 'center', gap: '0.55rem',
    padding: '0.55rem 0.75rem', borderRadius: 12,
    background: '#F4F6FB', border: '1px solid rgba(11,31,58,0.05)',
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={14} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.14em', fontWeight: 800, color: 'rgba(11,31,58,0.5)' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: NAVY }}>{value}</div>
    </div>
  </div>
);


const TagBlock = ({ title, tags, testid }) => {
  if (!tags || tags.length === 0) return null;
  return (
    <div data-testid={testid} style={{ background: '#FFFFFF', borderRadius: 16, padding: '1rem 1.15rem', border: '1px solid rgba(11,31,58,0.06)' }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: 'rgba(11,31,58,0.5)', marginBottom: '0.55rem' }}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {tags.map((t) => <span key={t} style={{ padding: '0.28rem 0.7rem', borderRadius: 100, background: 'rgba(11,31,58,0.05)', color: NAVY, fontSize: '0.78rem', fontWeight: 600 }}>{t}</span>)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor — simplified professional identity form (Fase de Optimización)
// ---------------------------------------------------------------------------
const INTEREST_OPTIONS = [
  'Legal', 'IA', 'Capital', 'Empresas', 'Comunidad', 'Eventos',
  'Empleos', 'Marketplace', 'Noticias', 'Videos', 'Medicina',
  'Contabilidad', 'Educación', 'Real Estate', 'Marketing',
  'Tecnología', 'Sostenibilidad', 'Startups', 'Fintech', 'E-commerce',
];

const ProfileEditor = ({ initial, onCancel, onSaved }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    headline: initial.headline || '',           // Profesión
    bio: initial.bio || '',                     // Resumen profesional
    country: initial.country || '',
    city: initial.city || '',
    current_company: initial.current_company || '',
    current_title: initial.current_title || '',
    specialty: (initial.specialties && initial.specialties[0]) || '',
    // Social links live inside `social` in the backend.
    website: initial.social?.website || initial.portfolio_url || '',
    linkedin: initial.social?.linkedin || '',
    facebook: initial.social?.facebook || '',
    instagram: initial.social?.instagram || '',
    // Intereses as an ARRAY (checkbox chips) to feed the multi-select.
    interests: Array.isArray(initial.interests) ? initial.interests : [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleInterest = (opt) => setForm((f) => {
    const has = f.interests.includes(opt);
    return { ...f, interests: has ? f.interests.filter((x) => x !== opt) : [...f.interests, opt] };
  });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const fresh = await profileService.updateMe({
        name: form.name.trim() || undefined,
        headline: form.headline.trim() || undefined,
        bio: form.bio.trim() || undefined,
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        current_company: form.current_company.trim() || undefined,
        current_title: form.current_title.trim() || undefined,
        // Single specialty maps to the existing list (first entry).
        specialties: form.specialty.trim() ? [form.specialty.trim()] : [],
        // Migrate portfolio_url → social.website as canonical field.
        portfolio_url: form.website.trim() || undefined,
        social: {
          website: form.website.trim() || undefined,
          linkedin: form.linkedin.trim() || undefined,
          facebook: form.facebook.trim() || undefined,
          instagram: form.instagram.trim() || undefined,
        },
        interests: form.interests,
      });
      onSaved(fresh);
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally { setBusy(false); }
  };

  return (
    <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit}
      data-testid="profile-editor"
      style={{ background: '#FFFFFF', borderRadius: 16, padding: '1.5rem 1.65rem', border: '1px solid rgba(11,31,58,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#00A277', fontWeight: 700 }}>EDITAR PERFIL</div>
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem', color: NAVY, margin: '0.15rem 0 0' }}>Actualiza tu identidad profesional</h2>
        </div>
        <button type="button" onClick={onCancel} data-testid="profile-editor-cancel"
          style={{ padding: '0.4rem', borderRadius: 8, background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Nombre"><input value={form.name} onChange={(e) => set('name', e.target.value)} data-testid="profile-editor-name" style={inp} /></Field>
        <Field label="Profesión"><input value={form.headline} onChange={(e) => set('headline', e.target.value)} data-testid="profile-editor-headline" style={inp} placeholder="Ej. Abogada corporativa" /></Field>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Cargo"><input value={form.current_title} onChange={(e) => set('current_title', e.target.value)} data-testid="profile-editor-title" style={inp} /></Field>
        <Field label="Empresa"><input value={form.current_company} onChange={(e) => set('current_company', e.target.value)} data-testid="profile-editor-company" style={inp} /></Field>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Ciudad"><input value={form.city} onChange={(e) => set('city', e.target.value)} data-testid="profile-editor-city" style={inp} /></Field>
        <Field label="País"><input value={form.country} onChange={(e) => set('country', e.target.value)} data-testid="profile-editor-country" style={inp} /></Field>
      </div>

      <Field label="Especialidad">
        <input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} data-testid="profile-editor-specialty" style={inp} placeholder="Ej. Derecho societario" />
      </Field>

      <Field label="Resumen profesional">
        <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={4} data-testid="profile-editor-bio" style={{ ...inp, resize: 'vertical' }} placeholder="Cuenta tu trayectoria en pocas líneas…" />
      </Field>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Sitio web"><input value={form.website} onChange={(e) => set('website', e.target.value)} data-testid="profile-editor-website" style={inp} placeholder="https://…" /></Field>
        <Field label="LinkedIn"><input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} data-testid="profile-editor-linkedin" style={inp} placeholder="https://linkedin.com/in/…" /></Field>
      </div>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Facebook"><input value={form.facebook} onChange={(e) => set('facebook', e.target.value)} data-testid="profile-editor-facebook" style={inp} placeholder="https://facebook.com/…" /></Field>
        <Field label="Instagram"><input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} data-testid="profile-editor-instagram" style={inp} placeholder="https://instagram.com/…" /></Field>
      </div>

      <Field label="Intereses">
        <div data-testid="profile-editor-interests"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0.35rem 0', minHeight: 40 }}>
          {INTEREST_OPTIONS.map((opt) => {
            const active = form.interests.includes(opt);
            return (
              <button type="button" key={opt} onClick={() => toggleInterest(opt)}
                data-testid={`profile-editor-interest-${opt.toLowerCase()}`}
                style={{
                  padding: '0.32rem 0.7rem', borderRadius: 100,
                  border: `1px solid ${active ? '#00A277' : 'rgba(11,31,58,0.15)'}`,
                  background: active ? 'rgba(0,200,150,0.14)' : '#FFFFFF',
                  color: active ? '#00A277' : NAVY,
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                }}>
                {opt}
              </button>
            );
          })}
        </div>
      </Field>

      {error && <div data-testid="profile-editor-error" style={{ color: '#B91C1C', fontSize: '0.8rem' }}>{error}</div>}

      <button type="submit" disabled={busy} data-testid="profile-editor-save"
        style={{ marginTop: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: 100, border: 'none', cursor: busy ? 'wait' : 'pointer', background: 'linear-gradient(135deg, #00C896, #06B6D4)', color: NAVY, fontWeight: 800, fontSize: '0.9rem', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Save size={13} /> {busy ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </motion.form>
  );
};

const Field = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: '0.62rem', color: 'rgba(11,31,58,0.5)', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.3rem' }}>{label.toUpperCase()}</div>
    {children}
  </label>
);
const inp = { width: '100%', padding: '0.6rem 0.85rem', borderRadius: 10, border: '1px solid rgba(11,31,58,0.14)', outline: 'none', background: '#FFFFFF', color: NAVY, fontSize: '0.9rem', fontFamily: 'inherit' };

export default ProfilePage;
