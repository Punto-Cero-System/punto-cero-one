import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { companyService } from '../../services/platformService';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';

const VERTICAL_OPTIONS = [
  { key: 'legal', label: 'Legal' },
  { key: 'ia', label: 'IA' },
  { key: 'salud', label: 'Salud / Medicina' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'turismo', label: 'Turismo' },
  { key: 'seguros', label: 'Seguros' },
  { key: 'educacion', label: 'Educación' },
  { key: 'empresas', label: 'General' },
];

const CompanyCreateModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: '', tagline: '', vertical: 'empresas',
    country: '', city: '', website: '', description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const created = await companyService.create({
        name: form.name.trim(),
        tagline: form.tagline.trim() || undefined,
        vertical: form.vertical,
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        website: form.website.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'No se pudo crear la empresa.');
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,15,28,0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1.5rem',
        }}
      >
        <motion.form
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onSubmit={submit}
          data-testid="company-create-modal"
          style={{
            width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto',
            background: '#FFFFFF', borderRadius: 18, padding: '1.5rem 1.75rem',
            boxShadow: '0 20px 60px rgba(11,31,58,0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: EMERALD, letterSpacing: '0.2em', fontWeight: 700 }}>NUEVA EMPRESA</div>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.35rem', fontWeight: 700, color: NAVY, margin: '0.15rem 0 0', letterSpacing: '-0.02em' }}>
                Publica tu empresa en el ecosistema
              </h2>
            </div>
            <button type="button" onClick={onClose} data-testid="company-create-close"
              style={{ background: 'transparent', border: 'none', color: 'rgba(11,31,58,0.5)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <Field label="Nombre *">
              <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                data-testid="company-create-name" style={inputStyle} maxLength={120} />
            </Field>
            <Field label="Tagline (una línea)">
              <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)}
                data-testid="company-create-tagline" style={inputStyle} maxLength={180} />
            </Field>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Vertical">
                <select value={form.vertical} onChange={(e) => set('vertical', e.target.value)}
                  data-testid="company-create-vertical" style={inputStyle}>
                  {VERTICAL_OPTIONS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="País">
                <input value={form.country} onChange={(e) => set('country', e.target.value)}
                  data-testid="company-create-country" style={inputStyle} maxLength={60} />
              </Field>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Ciudad">
                <input value={form.city} onChange={(e) => set('city', e.target.value)}
                  data-testid="company-create-city" style={inputStyle} maxLength={80} />
              </Field>
              <Field label="Sitio web">
                <input value={form.website} onChange={(e) => set('website', e.target.value)}
                  data-testid="company-create-website" style={inputStyle} placeholder="https://…" maxLength={300} />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                data-testid="company-create-description"
                rows={3} style={{ ...inputStyle, resize: 'vertical' }} maxLength={4000} />
            </Field>
            {error && <div data-testid="company-create-error" style={{ color: '#B91C1C', fontSize: '0.8rem' }}>{error}</div>}
            <button type="submit" disabled={busy || !form.name.trim()}
              data-testid="company-create-submit"
              style={{
                padding: '0.75rem 1.25rem', borderRadius: 100, border: 'none', cursor: busy ? 'wait' : 'pointer',
                background: `linear-gradient(135deg, ${EMERALD}, #06B6D4)`, color: NAVY,
                fontWeight: 800, fontSize: '0.9rem', marginTop: '0.35rem',
              }}>
              {busy ? 'Creando…' : 'Crear empresa'}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
};

const Field = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: '0.65rem', color: 'rgba(11,31,58,0.5)', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.3rem' }}>
      {label.toUpperCase()}
    </div>
    {children}
  </label>
);

const inputStyle = {
  width: '100%', padding: '0.6rem 0.85rem', borderRadius: 10,
  border: '1px solid rgba(11,31,58,0.14)', outline: 'none',
  background: '#FFFFFF', color: NAVY, fontSize: '0.9rem', fontFamily: 'inherit',
};

export default CompanyCreateModal;
