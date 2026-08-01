import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, Image as ImageIcon, Trash2, UploadCloud, Palette, Moon, Sun, Monitor,
  RotateCcw, CheckCircle2, Loader2, Sparkles,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { profileService } from '../services/profileService';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';
import { useUIPreferences } from '../contexts/UIPreferencesContext';

const NAVY = '#0B1F3A';
const API = process.env.REACT_APP_BACKEND_URL;

const GRADIENTS = [
  { label: 'Emerald · Cyan', value: 'linear-gradient(135deg, #00C896 0%, #06B6D4 100%)' },
  { label: 'Sunset', value: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)' },
  { label: 'Aurora', value: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' },
  { label: 'Deep Navy', value: 'linear-gradient(135deg, #0B1F3A 0%, #4C1D95 100%)' },
  { label: 'Gold Rush', value: 'linear-gradient(135deg, #F59E0B 0%, #D4AF37 100%)' },
  { label: 'Forest', value: 'linear-gradient(135deg, #059669 0%, #065F46 100%)' },
];

const asAbsoluteMedia = (url) => {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  return `${API}${url}`;
};

/**
 * ProfileCustomizePage — self-service profile & UI customization.
 *
 * Sections:
 *   1. Profile picture (upload · replace · remove)
 *   2. Cover image (upload · replace · remove)
 *   3. Theme (light / dark / auto)
 *   4. Colors (primary, secondary, accent, button)
 *   5. Gradient presets + custom
 *   6. Custom background image (optional)
 */
const ProfileCustomizePage = () => {
  const navigate = useNavigate();
  const { user } = useCommunityAuth();
  const { prefs, update, reset, DEFAULTS } = useUIPreferences();
  const [me, setMe] = useState(null);
  const [busySlot, setBusySlot] = useState(null); // 'picture' | 'cover' | null
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user === null) navigate('/join', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    profileService.me().then(setMe).catch(() => setMe(null));
  }, [user]);

  const notify = (msg) => { setFlash(msg); setError(''); setTimeout(() => setFlash(''), 2500); };
  const notifyErr = (msg) => { setError(msg); setFlash(''); setTimeout(() => setError(''), 4000); };

  const handleUpload = async (slot, file) => {
    if (!file) return;
    setBusySlot(slot); setError('');
    try {
      const r = await profileService.uploadMedia(slot, file);
      setMe((prev) => ({ ...prev, [slot === 'picture' ? 'picture' : 'cover_url']: r.url }));
      notify(slot === 'picture' ? 'Foto actualizada' : 'Portada actualizada');
    } catch (e) {
      notifyErr(e.message || 'No se pudo subir la imagen');
    } finally { setBusySlot(null); }
  };

  const handleDelete = async (slot) => {
    setBusySlot(slot); setError('');
    try {
      await profileService.deleteMedia(slot);
      setMe((prev) => ({ ...prev, [slot === 'picture' ? 'picture' : 'cover_url']: null }));
      notify('Imagen eliminada');
    } catch (e) {
      notifyErr(e.message || 'No se pudo eliminar');
    } finally { setBusySlot(null); }
  };

  if (!user || typeof user !== 'object') {
    return (
      <main style={{ minHeight: '100vh', background: '#F4F6FB' }}>
        <Header />
      </main>
    );
  }

  return (
    <>
      <Header />
      <main data-testid="profile-customize-page" style={{
        paddingTop: 82, background: '#F4F6FB', minHeight: '100vh',
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', padding: '1rem clamp(0.75rem, 2vw, 2rem) 4rem',
          display: 'flex', flexDirection: 'column', gap: '1.15rem',
        }}>
          <PageTitle />

          {/* Live preview strip */}
          <PreviewBanner me={me} prefs={prefs} />

          {/* Section: Profile picture */}
          <SectionCard title="Foto de perfil" icon={<Camera size={16} />}
            description="Se muestra en tus publicaciones, comentarios y perfil.">
            <MediaSlot
              slot="picture"
              currentUrl={me?.picture}
              busy={busySlot === 'picture'}
              onUpload={(f) => handleUpload('picture', f)}
              onDelete={() => handleDelete('picture')}
              accept="image/png,image/jpeg,image/webp,image/gif"
              shape="circle"
              testid="profile-media-picture"
            />
          </SectionCard>

          {/* Section: Cover */}
          <SectionCard title="Portada" icon={<ImageIcon size={16} />}
            description="Imagen destacada en la cabecera de tu perfil.">
            <MediaSlot
              slot="cover"
              currentUrl={me?.cover_url}
              busy={busySlot === 'cover'}
              onUpload={(f) => handleUpload('cover', f)}
              onDelete={() => handleDelete('cover')}
              accept="image/png,image/jpeg,image/webp,image/gif"
              shape="banner"
              testid="profile-media-cover"
            />
          </SectionCard>

          {/* Section: Theme */}
          <SectionCard title="Tema" icon={<Palette size={16} />}
            description="Ajusta la apariencia general de la interfaz.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ThemeChip active={prefs.theme === 'light'} onClick={() => update({ theme: 'light' })}
                icon={<Sun size={14} />} label="Claro" testid="theme-light" />
              <ThemeChip active={prefs.theme === 'dark'} onClick={() => update({ theme: 'dark' })}
                icon={<Moon size={14} />} label="Oscuro" testid="theme-dark" />
              <ThemeChip active={prefs.theme === 'auto' || !prefs.theme} onClick={() => update({ theme: 'auto' })}
                icon={<Monitor size={14} />} label="Automático" testid="theme-auto" />
            </div>
          </SectionCard>

          {/* Section: Colors */}
          <SectionCard title="Colores" icon={<Palette size={16} />}
            description="Personaliza los colores clave que se usan en botones y detalles.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <ColorPicker label="Color principal" value={prefs.primary_color}
                onChange={(v) => update({ primary_color: v })} testid="color-primary" />
              <ColorPicker label="Color secundario" value={prefs.secondary_color}
                onChange={(v) => update({ secondary_color: v })} testid="color-secondary" />
              <ColorPicker label="Color de acento" value={prefs.accent_color}
                onChange={(v) => update({ accent_color: v })} testid="color-accent" />
              <ColorPicker label="Color de botones" value={prefs.button_color}
                onChange={(v) => update({ button_color: v })} testid="color-button" />
            </div>
          </SectionCard>

          {/* Section: Gradient */}
          <SectionCard title="Gradiente" icon={<Sparkles size={16} />}
            description="Usado en botones destacados, banners y CTAs importantes.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {GRADIENTS.map((g) => (
                <button key={g.value}
                  onClick={() => update({ gradient: g.value })}
                  data-testid={`gradient-${g.label.split(' ')[0].toLowerCase()}`}
                  style={{
                    padding: '0.9rem 1rem', borderRadius: 12,
                    background: g.value, color: '#FFFFFF',
                    border: prefs.gradient === g.value ? '2px solid #0B1F3A' : '2px solid transparent',
                    fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(11,31,58,0.12)',
                    textAlign: 'left',
                  }}>
                  {prefs.gradient === g.value && (
                    <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  )}
                  {g.label}
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Section: Background */}
          <SectionCard title="Fondo personalizado (opcional)" icon={<ImageIcon size={16} />}
            description="Pega la URL de una imagen para usarla como fondo de tu experiencia.">
            <input
              value={prefs.background_url || ''}
              onChange={(e) => update({ background_url: e.target.value.trim() || null })}
              placeholder="https://images.unsplash.com/..."
              data-testid="background-url-input"
              style={{
                width: '100%', height: 46, padding: '0 1rem',
                borderRadius: 12, border: '1px solid rgba(11,31,58,0.12)',
                background: '#FFFFFF', color: NAVY, fontSize: '0.9rem', outline: 'none',
                boxSizing: 'border-box',
              }} />
          </SectionCard>

          {/* Reset */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={reset} data-testid="profile-reset-preferences"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '0.6rem 1.1rem', borderRadius: 100,
                background: '#FFFFFF', border: '1px solid rgba(11,31,58,0.15)',
                color: NAVY, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              }}>
              <RotateCcw size={13} /> Restaurar valores por defecto
            </button>
          </div>

          {/* Toast */}
          {(flash || error) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              data-testid={error ? 'profile-error-toast' : 'profile-flash-toast'}
              style={{
                position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                padding: '0.75rem 1.1rem', borderRadius: 100,
                background: error ? '#B91C1C' : NAVY, color: '#FFFFFF',
                fontSize: '0.85rem', fontWeight: 700,
                boxShadow: '0 10px 40px rgba(11,31,58,0.25)', zIndex: 60,
              }}>
              {error || flash}
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

const PageTitle = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12, padding: '0.5rem 0',
  }}>
    <div>
      <div style={{
        fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 800,
        color: 'rgba(11,31,58,0.55)',
      }}>PERSONALIZAR</div>
      <h1 style={{
        margin: 0, fontFamily: '"Space Grotesk", sans-serif',
        fontSize: 'clamp(1.6rem, 3vw, 2rem)', color: NAVY, letterSpacing: '-0.02em',
      }}>Perfil y apariencia</h1>
    </div>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '0.4rem 0.85rem', borderRadius: 100,
      background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.25)',
      color: '#00825E', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
    }}>
      <CheckCircle2 size={12} /> Autoguardado
    </span>
  </div>
);

const PreviewBanner = ({ me, prefs }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    data-testid="profile-preview-banner"
    style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: prefs.background_url
        ? `${prefs.gradient}, url("${prefs.background_url}") center/cover no-repeat`
        : prefs.gradient,
      minHeight: 140,
    }}>
    {me?.cover_url && (
      <img src={asAbsoluteMedia(me.cover_url)} alt="Portada"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: 0.9,
        }} />
    )}
    <div style={{
      position: 'relative', padding: '1.25rem 1.5rem', display: 'flex',
      alignItems: 'center', gap: '1rem',
    }}>
      <div style={{
        width: 74, height: 74, borderRadius: '50%', overflow: 'hidden',
        border: '3px solid #FFFFFF', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        background: '#FFFFFF', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {me?.picture ? (
          <img src={asAbsoluteMedia(me.picture)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 26, color: NAVY, fontWeight: 800 }}>{(me?.name || '?')[0]}</span>
        )}
      </div>
      <div style={{ color: '#FFFFFF', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{me?.name || 'Miembro'}</div>
        <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{me?.headline || 'Ecosistema Punto Cero'}</div>
      </div>
    </div>
  </motion.div>
);

const SectionCard = ({ title, description, icon, children }) => (
  <section style={{
    background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem',
    border: '1px solid rgba(11,31,58,0.06)',
    boxShadow: '0 4px 20px rgba(11,31,58,0.03)',
  }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: 'rgba(11,31,58,0.06)', color: NAVY,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: NAVY }}>{title}</div>
        {description && (
          <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)' }}>{description}</div>
        )}
      </div>
    </header>
    {children}
  </section>
);

const MediaSlot = ({ slot, currentUrl, busy, onUpload, onDelete, accept, shape, testid }) => {
  const inputRef = useRef(null);
  const dim = shape === 'circle' ? { w: 100, h: 100, radius: '50%' } : { w: '100%', h: 160, radius: 14 };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}
      data-testid={testid}>
      <div style={{
        width: dim.w, height: dim.h, borderRadius: dim.radius,
        background: currentUrl ? '#FFFFFF' : 'rgba(11,31,58,0.04)',
        border: '1px solid rgba(11,31,58,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {currentUrl ? (
          <img src={asAbsoluteMedia(currentUrl)} alt="" data-testid={`${testid}-preview`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageIcon size={28} color="rgba(11,31,58,0.3)" />
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }}
          data-testid={`${testid}-input`}
          onChange={(e) => onUpload(e.target.files?.[0])} />
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          data-testid={`${testid}-upload`}
          style={pillBtnStyle(NAVY, '#FFFFFF')}>
          {busy ? <Loader2 size={13} className="pcone-spin" /> : <UploadCloud size={13} />}
          {currentUrl ? 'Reemplazar' : 'Subir imagen'}
        </button>
        {currentUrl && (
          <button onClick={onDelete} disabled={busy}
            data-testid={`${testid}-delete`}
            style={pillBtnStyle('#FFFFFF', '#B91C1C', '#B91C1C33')}>
            <Trash2 size={13} /> Eliminar
          </button>
        )}
      </div>
      <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
        @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const ColorPicker = ({ label, value, onChange, testid }) => (
  <label style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0.55rem 0.7rem', borderRadius: 12,
    background: 'rgba(11,31,58,0.03)',
    border: '1px solid rgba(11,31,58,0.08)',
  }} data-testid={testid}>
    <input type="color" value={value || '#00C896'}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 34, height: 34, border: 'none', borderRadius: 8,
        cursor: 'pointer', background: 'transparent', padding: 0,
      }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: NAVY }}>{label}</div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(11,31,58,0.55)' }}>{value}</div>
    </div>
  </label>
);

const ThemeChip = ({ active, onClick, icon, label, testid }) => (
  <button onClick={onClick} data-testid={testid}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '0.5rem 0.95rem', borderRadius: 100,
      background: active ? NAVY : '#FFFFFF',
      color: active ? '#FFFFFF' : NAVY,
      border: `1px solid ${active ? NAVY : 'rgba(11,31,58,0.15)'}`,
      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
    }}>
    {icon}{label}
  </button>
);

const pillBtnStyle = (bg, color, border) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '0.55rem 1rem', borderRadius: 100,
  background: bg, color, border: `1px solid ${border || (bg === '#FFFFFF' ? 'rgba(11,31,58,0.15)' : bg)}`,
  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
});

export default ProfileCustomizePage;
