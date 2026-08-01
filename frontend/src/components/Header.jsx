import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Bell, MessageCircle, ChevronDown, LogIn, LogOut } from 'lucide-react';
import BrandMark from './BrandMark';
import AppIcon from './community/AppIcon';
import HeaderSearchBar from './community/HeaderSearchBar';
import NotificationsBell from './community/NotificationsBell';
import { useCommunityAuth } from '../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const GOLD = '#D4AF37';

/**
 * NAV_ITEMS — LinkedIn-style top nav. Categories are natural language
 * (not brand-heavy). Every item uses an AppIcon glyph for family consistency.
 * `to` = react-router path (real destination); `hash` optional legacy fragment
 * kept only for the mobile menu when the item stays on the homepage.
 */
const NAV_ITEMS = [
  { key: 'home', label: 'Mi Espacio', to: '/', icon: 'home' },
  { key: 'news', label: 'Noticias', to: '/noticias', icon: 'news' },
  { key: 'video', label: 'Videos', to: '/videos', icon: 'video' },
  { key: 'jobs', label: 'Empleos', to: '/empleos', icon: 'jobs' },
  { key: 'companies', label: 'Empresas', to: '/empresas', icon: 'companies' },
  { key: 'events', label: 'Eventos', to: '/eventos', icon: 'events' },
  { key: 'ai', label: 'IA', to: '/ia', icon: 'ai' },
  { key: 'community', label: 'Comunidad', to: '/comunidad', icon: 'community' },
];

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useCommunityAuth();
  const isAuthed = !!user && typeof user === 'object';

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    try { await logout(); } catch { /* noop */ }
    navigate('/', { replace: true });
  };

  return (
    <motion.header
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.6, 0.05, 0.01, 0.9] }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 100,
        background: 'rgba(10, 15, 28, 0.86)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0.65rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.85rem',
      }}>
        {/* Brand */}
        <BrandMark size={36} variant="full" showTagline={false} />

        {/* Search — desktop (unified global) */}
        <HeaderSearchBar />

        {/* Primary nav — desktop */}
        <nav className="pc-header-nav" style={{
          display: 'flex', alignItems: 'center', gap: '0.15rem',
          flex: 1, justifyContent: 'center',
        }}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.key} item={item} />
          ))}
        </nav>

        {/* Right cluster */}
        <div className="pc-header-right" style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
          <IconAction icon={<Bell size={18} />} label="Notificaciones" testid="header-notifications" />
          <IconAction icon={<MessageCircle size={18} />} label="Mensajes" testid="header-messages" />

          {/* Capital button */}
          <Link
            to="/capital"
            data-testid="header-capital-btn"
            className="interactive pc-header-capital"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              background: `linear-gradient(135deg, ${GOLD} 0%, #B8942D 100%)`,
              color: NAVY, borderRadius: 100,
              fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.02em',
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(212,175,55,0.25), 0 6px 18px rgba(212,175,55,0.28)',
            }}
          >
            💎 Capital
          </Link>

          {/* Notifications + Profile / Join */}
          <NotificationsBell />
          {isAuthed ? (
            <div style={{ position: 'relative' }}>
              <button
                className="interactive pc-header-profile"
                data-testid="header-profile"
                onClick={() => setProfileMenuOpen((v) => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.55rem 0.35rem 0.4rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 100, color: '#FFFFFF',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0B1F3A, #7C3AED)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '0.75rem',
                  }}>{(user.name || user.email || '0').charAt(0).toUpperCase()}</span>
                )}
                <span data-testid="header-profile-name" className="pc-header-profile-name" style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name?.split(' ')[0] || 'Perfil'}
                </span>
                <ChevronDown size={12} />
              </button>
              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    data-testid="header-profile-menu"
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                      minWidth: 220,
                      background: '#0A0F1C',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                      padding: '0.5rem',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>{user.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>{user.email}</div>
                    </div>
                    <Link
                      to="/perfil"
                      onClick={() => setProfileMenuOpen(false)}
                      data-testid="header-profile-link"
                      style={{
                        marginTop: 4, width: '100%', display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '0.55rem 0.75rem', textDecoration: 'none',
                        color: '#FFFFFF', fontSize: '0.82rem', borderRadius: 8,
                      }}
                    >Ver mi perfil</Link>
                    <Link
                      to="/mi-espacio/configuracion"
                      onClick={() => setProfileMenuOpen(false)}
                      data-testid="header-workspace-config-link"
                      style={{
                        width: '100%', display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '0.55rem 0.75rem', textDecoration: 'none',
                        color: '#FFFFFF', fontSize: '0.82rem', borderRadius: 8,
                      }}
                    >Configuración · Mi Espacio</Link>
                    <Link
                      to="/perfil/personalizar"
                      onClick={() => setProfileMenuOpen(false)}
                      data-testid="header-profile-customize-link"
                      style={{
                        width: '100%', display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '0.55rem 0.75rem', textDecoration: 'none',
                        color: '#FFFFFF', fontSize: '0.82rem', borderRadius: 8,
                      }}
                    >Personalizar perfil</Link>
                    <button
                      onClick={handleLogout}
                      data-testid="header-logout"
                      style={{
                        marginTop: 4, width: '100%', textAlign: 'left',
                        padding: '0.55rem 0.75rem', background: 'transparent',
                        border: 'none', color: '#FFFFFF', cursor: 'pointer',
                        fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 8,
                        borderRadius: 8,
                      }}
                    >
                      <LogOut size={14} /> Cerrar sesión
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/join"
              data-testid="header-join-btn"
              className="interactive pc-header-join"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                background: 'linear-gradient(135deg, #00C896 0%, #06B6D4 100%)',
                color: NAVY, borderRadius: 100,
                fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.02em',
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(0,200,150,0.35)',
              }}
            >
              <LogIn size={14} /> Unirse
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="interactive pc-header-mobile-toggle"
            aria-label="Menú"
            data-testid="header-mobile-toggle"
            style={{
              background: 'transparent', border: 'none', color: '#FFFFFF',
              cursor: 'pointer', padding: '0.35rem', display: 'none',
            }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pc-header-mobile"
            style={{
              overflow: 'hidden',
              background: 'rgba(10,15,28,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ padding: '0.75rem 1rem 1.25rem' }}>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.55)',
                }} />
                <input
                  placeholder="Buscar…"
                  style={{
                    width: '100%', height: 40,
                    padding: '0 0.85rem 0 2.15rem', borderRadius: 100,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#FFFFFF', fontSize: '0.85rem', outline: 'none',
                  }}
                />
              </div>
              {/* Grid of nav items */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.4rem',
              }}>
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="pc-mobile-nav-item"
                    data-testid={`header-mobile-nav-${item.key}`}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                      padding: '0.75rem 0.35rem', textDecoration: 'none',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                      color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <AppIcon name={item.icon} size={22} variant="color" />
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, textAlign: 'center' }}>
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>

              <Link
                to="/capital"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="header-mobile-capital-btn"
                style={{
                  marginTop: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  padding: '0.75rem', borderRadius: 100,
                  background: `linear-gradient(135deg, ${GOLD}, #B8942D)`,
                  color: NAVY, fontWeight: 800, fontSize: '0.85rem',
                  textDecoration: 'none',
                }}
              >
                💎 Capital · Investor Center
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .pc-header-search { display: flex; }
        .pc-header-nav { display: flex; }
        .pc-header-right { display: flex; }
        .pc-header-mobile-toggle { display: none !important; }

        @media (max-width: 1200px) {
          .pc-header-search { display: none; }
        }
        @media (max-width: 1024px) {
          .pc-header-nav .pc-nav-label { display: none; }
        }
        @media (max-width: 900px) {
          .pc-header-nav { display: none !important; }
          .pc-header-profile { display: none !important; }
          .pc-header-mobile-toggle { display: inline-flex !important; }
        }
        @media (max-width: 640px) {
          .pc-header-capital { padding: 0.45rem 0.7rem !important; font-size: 0.72rem !important; }
        }
      `}</style>
    </motion.header>
  );
};

const NavItem = ({ item }) => {
  const location = useLocation();
  const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
  return (
    <Link
      to={item.to}
      className="interactive pc-nav-item"
      data-testid={`header-nav-${item.key}`}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        gap: 2, padding: '0.35rem 0.6rem',
        color: active ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
        textDecoration: 'none',
        fontSize: '0.68rem', fontWeight: 600,
        borderRadius: 8, transition: 'color 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = active ? '#FFFFFF' : 'rgba(255,255,255,0.7)'; if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <AppIcon name={item.icon} size={20} variant="mono-light" />
      <span className="pc-nav-label">{item.label}</span>
    </Link>
  );
};

const IconAction = ({ icon, label, testid }) => (
  <button
    className="interactive"
    aria-label={label}
    data-testid={testid}
    style={{
      width: 38, height: 38, borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#FFFFFF', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.2s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
  >
    {icon}
  </button>
);

export default Header;
