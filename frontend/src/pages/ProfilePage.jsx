import React, { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Globe2, Award, Edit3, Save, X, Plus, Trash2 } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { profileService } from '../services/platformService';

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
        <ProfileView profile={full} onEdit={() => setEditing(true)} />
      )}
    </CategoryPage>
  );
};

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
const ProfileView = ({ profile, onEdit }) => (
  <>
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      data-testid="profile-view"
      style={{ background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(11,31,58,0.06)', boxShadow: '0 4px 20px rgba(11,31,58,0.04)' }}>
      <div style={{ height: 120, background: 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 80%, #EC4899 100%)' }} />
      <div style={{ padding: '0 1.5rem 1.5rem', marginTop: -60 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          {profile.picture ? (
            <img src={profile.picture} alt={profile.name} referrerPolicy="no-referrer" data-testid="profile-avatar"
              style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FFFFFF', boxShadow: '0 8px 24px rgba(11,31,58,0.15)' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#0A0F1C', border: '4px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '3rem', color: '#FFFFFF' }}>
              {(profile.name || profile.email || '0').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: '0.35rem' }}>
            <h2 data-testid="profile-name" style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.02em', color: NAVY, margin: 0 }}>{profile.name}</h2>
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
        {profile.bio && (
          <div style={{ marginTop: '1.35rem', padding: '1rem 1.15rem', borderRadius: 12, background: '#F4F6FB', border: '1px solid rgba(11,31,58,0.06)' }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: 'rgba(11,31,58,0.5)', marginBottom: '0.5rem' }}>ACERCA DE</div>
            <p data-testid="profile-bio" style={{ fontSize: '0.88rem', color: 'rgba(11,31,58,0.78)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>
          </div>
        )}
      </div>
    </motion.section>

    <TagBlock title="Skills"       tags={profile.skills}       testid="profile-skills" />
    <TagBlock title="Especialidades" tags={profile.specialties} testid="profile-specialties" />
    <TagBlock title="Verticales activas" tags={profile.verticals} testid="profile-verticals" />
    <TagBlock title="Idiomas"      tags={profile.languages}    testid="profile-languages" />
    <TagBlock title="Intereses"    tags={profile.interests}    testid="profile-interests" />
  </>
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
// Editor
// ---------------------------------------------------------------------------
const ProfileEditor = ({ initial, onCancel, onSaved }) => {
  const [form, setForm] = useState({
    name: initial.name || '',
    headline: initial.headline || '',
    bio: initial.bio || '',
    country: initial.country || '',
    city: initial.city || '',
    current_company: initial.current_company || '',
    current_title: initial.current_title || '',
    portfolio_url: initial.portfolio_url || '',
    skills: (initial.skills || []).join(', '),
    specialties: (initial.specialties || []).join(', '),
    verticals: (initial.verticals || []).join(', '),
    languages: (initial.languages || []).join(', '),
    interests: (initial.interests || []).join(', '),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toList = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);

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
        portfolio_url: form.portfolio_url.trim() || undefined,
        skills: toList(form.skills),
        specialties: toList(form.specialties),
        verticals: toList(form.verticals),
        languages: toList(form.languages),
        interests: toList(form.interests),
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
        <Field label="Titular / Headline"><input value={form.headline} onChange={(e) => set('headline', e.target.value)} data-testid="profile-editor-headline" style={inp} /></Field>
      </div>

      <Field label="Bio">
        <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={3} data-testid="profile-editor-bio" style={{ ...inp, resize: 'vertical' }} />
      </Field>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="País"><input value={form.country} onChange={(e) => set('country', e.target.value)} data-testid="profile-editor-country" style={inp} /></Field>
        <Field label="Ciudad"><input value={form.city} onChange={(e) => set('city', e.target.value)} data-testid="profile-editor-city" style={inp} /></Field>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Cargo actual"><input value={form.current_title} onChange={(e) => set('current_title', e.target.value)} data-testid="profile-editor-title" style={inp} /></Field>
        <Field label="Empresa actual"><input value={form.current_company} onChange={(e) => set('current_company', e.target.value)} data-testid="profile-editor-company" style={inp} /></Field>
      </div>

      <Field label="Portafolio (URL)"><input value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} data-testid="profile-editor-portfolio" style={inp} placeholder="https://…" /></Field>

      <Field label="Skills · separados por coma"><input value={form.skills} onChange={(e) => set('skills', e.target.value)} data-testid="profile-editor-skills" style={inp} /></Field>
      <Field label="Especialidades · separadas por coma"><input value={form.specialties} onChange={(e) => set('specialties', e.target.value)} data-testid="profile-editor-specialties" style={inp} /></Field>
      <Field label="Verticales activas · legal, ia, capital, …"><input value={form.verticals} onChange={(e) => set('verticals', e.target.value)} data-testid="profile-editor-verticals" style={inp} /></Field>
      <Field label="Idiomas"><input value={form.languages} onChange={(e) => set('languages', e.target.value)} data-testid="profile-editor-languages" style={inp} /></Field>
      <Field label="Intereses"><input value={form.interests} onChange={(e) => set('interests', e.target.value)} data-testid="profile-editor-interests" style={inp} /></Field>

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
