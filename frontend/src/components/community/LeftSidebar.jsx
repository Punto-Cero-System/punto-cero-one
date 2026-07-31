import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import AppIcon from './AppIcon';
import { WeatherWidget, CalendarWidget, PodcastWidget, CompaniesShoutout } from './Widgets';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';

/**
 * LeftSidebar — LinkedIn-style compact profile + activity + groups + quick access.
 * Sticky on desktop, hidden on mobile (< 900px handled by CommunityLayout).
 */
const LeftSidebar = () => {
  const { user } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  return (
    <aside data-testid="community-left-sidebar" style={{
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      {/* PREMIUM · Nuestra Historia — must feel as important as Investor Room / Capital */}
      <Link
        to="/nuestra-historia"
        data-testid="left-sidebar-nuestra-historia"
        style={{
          display: 'block', textDecoration: 'none', color: '#FFFFFF',
          position: 'relative', overflow: 'hidden',
          borderRadius: 18,
          background: `linear-gradient(135deg, ${NAVY} 0%, #1E1B4B 55%, #4C1D95 100%)`,
          padding: '1rem 1.1rem',
          boxShadow: `0 10px 30px rgba(11,31,58,0.18), 0 0 0 1px ${EMERALD}33`,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', top: -60, right: -60, width: 160, height: 160,
            borderRadius: '50%', border: `1px dashed ${EMERALD}44`, pointerEvents: 'none',
          }} />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', bottom: -40, right: -20, width: 90, height: 90,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${GOLD}44 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: '0.6rem',
          fontSize: '0.6rem', letterSpacing: '0.24em', fontWeight: 700,
          color: EMERALD, marginBottom: '0.55rem',
        }}>
          <Sparkles size={11} /> CONOCE PUNTO CERO
        </div>
        <div style={{
          position: 'relative', fontFamily: '"Space Grotesk", sans-serif',
          fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2,
          letterSpacing: '-0.015em', marginBottom: '0.35rem',
        }}>
          Nuestra Historia
        </div>
        <div style={{
          position: 'relative', fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)',
          marginBottom: '0.75rem', fontWeight: 300, lineHeight: 1.45,
        }}>
          Visión, misión y las personas detrás del ecosistema.
        </div>
        <motion.div
          whileHover={{ x: 2 }}
          style={{
            position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.7rem', fontWeight: 700, color: GOLD, letterSpacing: '0.05em',
          }}>
          Explorar la historia <ArrowRight size={12} />
        </motion.div>
      </Link>

      {/* Profile card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(11,31,58,0.06)',
        boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
      }}>
        <div style={{
          height: 56,
          background: 'linear-gradient(120deg, #0B1F3A 0%, #1E3A8A 40%, #7C3AED 80%, #EC4899 100%)',
        }} />
        <div style={{ padding: '0 1rem 1.15rem', textAlign: 'center', marginTop: -30 }}>
          {isAuthed && user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              data-testid="left-sidebar-avatar"
              style={{
                width: 60, height: 60, borderRadius: '50%',
                border: '3px solid #FFFFFF', objectFit: 'cover',
                boxShadow: '0 4px 12px rgba(11,31,58,0.15)',
              }}
            />
          ) : (
            <div data-testid="left-sidebar-avatar-fallback" style={{
              width: 60, height: 60, borderRadius: '50%',
              background: '#0A0F1C', margin: '0 auto',
              border: '3px solid #FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: '"Space Grotesk", sans-serif',
              color: '#FFFFFF', fontWeight: 700, fontSize: '1.35rem',
              letterSpacing: '-0.02em',
            }}>{isAuthed ? (user.name || user.email || '0').charAt(0).toUpperCase() : '0'}</div>
          )}
          <div data-testid="left-sidebar-name" style={{ marginTop: '0.6rem', fontWeight: 700, fontSize: '0.95rem', color: NAVY }}>
            {isAuthed ? user.name : 'Bienvenido a Punto Cero One'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(11,31,58,0.55)', marginTop: '0.15rem' }}>
            {isAuthed ? (user.headline || user.email) : 'Todo empieza aquí'}
          </div>
          {!isAuthed && (
            <Link
              to="/join"
              data-testid="left-sidebar-join"
              style={{
                display: 'block', marginTop: '0.9rem',
                padding: '0.55rem 0.9rem',
                background: NAVY, color: '#FFFFFF',
                borderRadius: 100, fontSize: '0.78rem', fontWeight: 600,
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              Unirse a la comunidad
            </Link>
          )}
        </div>
      </div>

      {/* Actividad */}
      <SidebarBlock title="Actividad">
        <ActivityRow label="Publicaciones" value="—" />
        <ActivityRow label="Impresiones" value="—" />
        <ActivityRow label="Conexiones" value="—" />
      </SidebarBlock>

      {/* Grupos */}
      <SidebarBlock title="Grupos">
        <GroupRow icon="legal" label="Legal Latam" hint="1.2k activos" />
        <GroupRow icon="capital" label="Fundadores & inversión" hint="Comunidad privada" />
        <GroupRow icon="ai" label="IA aplicada" hint="Nuevo · abierto" />
      </SidebarBlock>

      {/* Accesos rápidos */}
      <SidebarBlock title="Accesos rápidos">
        <QuickLink icon="home" label="Inicio" href="#top" />
        <QuickLink icon="community" label="Comunidad" href="#feed" />
        <QuickLink icon="capital" label="Capital" to="/capital" />
        <QuickLink icon="legal" label="Punto Cero Legal" href="https://puntocerolegal.com" external />
      </SidebarBlock>

      {/* Fill remaining vertical space with small integrated widgets */}
      <WeatherWidget />
      <CalendarWidget />
      <PodcastWidget />
      <CompaniesShoutout />
    </aside>
  );
};

const SidebarBlock = ({ title, children }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 16,
    border: '1px solid rgba(11,31,58,0.06)',
    padding: '1rem 1rem 0.75rem',
    boxShadow: '0 4px 20px rgba(11,31,58,0.04)',
  }}>
    <div style={{
      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
      color: 'rgba(11,31,58,0.5)', marginBottom: '0.7rem',
    }}>{title.toUpperCase()}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingBottom: '0.25rem' }}>
      {children}
    </div>
  </div>
);

const ActivityRow = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '0.35rem 0', fontSize: '0.82rem',
  }}>
    <span style={{ color: 'rgba(11,31,58,0.7)' }}>{label}</span>
    <span style={{ color: NAVY, fontWeight: 700 }}>{value}</span>
  </div>
);

const GroupRow = ({ icon, label, hint }) => (
  <motion.a whileHover={{ x: 2 }} href="#groups" style={{
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    padding: '0.45rem 0', textDecoration: 'none',
    color: NAVY,
  }}>
    <AppIcon name={icon} size={22} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.68rem', color: 'rgba(11,31,58,0.5)' }}>{hint}</span>
    </div>
  </motion.a>
);

const QuickLink = ({ icon, label, href, to, external }) => {
  const Comp = to ? Link : 'a';
  const props = to ? { to } : { href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) };
  return (
    <Comp {...props} style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: '0.4rem 0', textDecoration: 'none',
      color: NAVY, fontSize: '0.85rem', fontWeight: 500,
    }}>
      <AppIcon name={icon} size={20} />
      <span>{label}</span>
    </Comp>
  );
};

export default LeftSidebar;
