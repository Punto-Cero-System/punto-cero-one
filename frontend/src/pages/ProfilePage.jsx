import React from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Globe2, Award } from 'lucide-react';
import CategoryPage, { NAVY } from '../components/CategoryPage';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

/**
 * ProfilePage — displays the authenticated user's One Profile.
 * Currently read-only; edit hooks are ready to plug in once the community
 * backend exposes a PATCH /api/community/users/me endpoint.
 */
const ProfilePage = () => {
  const { user } = useCommunityAuth();

  if (user === undefined) {
    return (
      <CategoryPage
        icon="community"
        eyebrow="Perfil"
        title="Cargando tu perfil…"
        subtitle="Un momento mientras verificamos tu sesión."
        testid="profile-loading"
      >
        <div style={{
          background: '#FFFFFF', borderRadius: 16, padding: '2rem',
          textAlign: 'center', color: 'rgba(11,31,58,0.5)',
        }}>Cargando…</div>
      </CategoryPage>
    );
  }

  if (!user) return <Navigate to="/join" replace />;

  return (
    <CategoryPage
      icon="community"
      eyebrow="Perfil"
      title={user.name}
      subtitle={user.headline || `${user.email} · Miembro de Punto Cero One`}
      testid="profile-page"
    >
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(11,31,58,0.06)',
          boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        }}
      >
        <div style={{
          height: 120,
          background: 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 80%, #EC4899 100%)',
        }} />
        <div style={{ padding: '0 1.5rem 1.5rem', marginTop: -60 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            {user.picture ? (
              <img
                src={user.picture} alt={user.name} referrerPolicy="no-referrer"
                data-testid="profile-avatar"
                style={{
                  width: 120, height: 120, borderRadius: '50%', objectFit: 'cover',
                  border: '4px solid #FFFFFF', boxShadow: '0 8px 24px rgba(11,31,58,0.15)',
                }}
              />
            ) : (
              <div style={{
                width: 120, height: 120, borderRadius: '50%',
                background: '#0A0F1C', border: '4px solid #FFFFFF',
                boxShadow: '0 8px 24px rgba(11,31,58,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '3rem', color: '#FFFFFF',
              }}>{(user.name || user.email || '0').charAt(0).toUpperCase()}</div>
            )}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: '0.35rem' }}>
              <h2 data-testid="profile-name" style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.02em',
                color: NAVY, margin: 0,
              }}>{user.name}</h2>
              <div data-testid="profile-email" style={{ fontSize: '0.85rem', color: 'rgba(11,31,58,0.65)', marginTop: '0.15rem' }}>
                <Mail size={12} style={{ verticalAlign: -1, marginRight: 4 }} />{user.email}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                <ProfileChip icon={<Award size={11} />} label={`Rol · ${user.role}`} />
                {user.providers?.length > 0 && (
                  <ProfileChip icon={<Globe2 size={11} />} label={`Ingreso · ${user.providers.join(', ')}`} />
                )}
                {user.country && <ProfileChip icon={<Globe2 size={11} />} label={user.country} />}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '1.35rem', padding: '1rem 1.15rem',
            borderRadius: 12, background: '#F4F6FB',
            border: '1px solid rgba(11,31,58,0.06)',
          }}>
            <div style={{
              fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700,
              color: 'rgba(11,31,58,0.5)', marginBottom: '0.5rem',
            }}>ACERCA DE</div>
            <p style={{ fontSize: '0.88rem', color: 'rgba(11,31,58,0.72)', margin: 0, lineHeight: 1.55 }}>
              Aún no has escrito una bio. Muy pronto podrás completar tu perfil con headline, país, idioma y experiencia — todo desde aquí.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        style={{
          background: '#FFFFFF', borderRadius: 16, padding: '1.15rem 1.25rem',
          border: '1px solid rgba(11,31,58,0.06)',
          boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
        }}
      >
        <div style={{
          fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700,
          color: 'rgba(11,31,58,0.5)', marginBottom: '0.8rem',
        }}>ACTIVIDAD</div>
        <ActivityRow label="Publicaciones" value="—" />
        <ActivityRow label="Impresiones" value="—" />
        <ActivityRow label="Conexiones" value="—" />
        <ActivityRow label="Grupos" value="—" />
      </motion.section>
    </CategoryPage>
  );
};

const ProfileChip = ({ icon, label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.25rem 0.6rem', borderRadius: 100,
    background: 'rgba(11,31,58,0.05)', color: NAVY,
    fontSize: '0.7rem', fontWeight: 600,
  }}>{icon}{label}</span>
);

const ActivityRow = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '0.5rem 0', fontSize: '0.87rem',
    borderBottom: '1px solid rgba(11,31,58,0.05)',
  }}>
    <span style={{ color: 'rgba(11,31,58,0.7)' }}>{label}</span>
    <span style={{ color: NAVY, fontWeight: 700 }}>{value}</span>
  </div>
);

export default ProfilePage;
