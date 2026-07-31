import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, MessageCircle, ExternalLink, Building2, MapPin } from 'lucide-react';
import PresenceDot from './PresenceDot';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const API = process.env.REACT_APP_BACKEND_URL;

/**
 * UserHoverCard — LinkedIn-style quick profile popover triggered on hover.
 * The trigger is any children element; on hover-in we fetch the profile and
 * render a floating card anchored below-left of the trigger.
 *
 * Zero backend changes — reads /api/profiles/{userId}. If the endpoint isn't
 * available, we degrade gracefully to the minimal author data passed by the parent.
 */
const UserHoverCard = ({ userId, fallback, children }) => {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const enterTimer = useRef(null);
  const leaveTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(enterTimer.current);
    clearTimeout(leaveTimer.current);
  }, []);

  const load = async () => {
    if (profile || !userId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/profiles/${userId}`, { credentials: 'include' });
      if (r.ok) setProfile(await r.json());
      else setProfile({ ...fallback, id: userId });
    } catch {
      setProfile({ ...fallback, id: userId });
    } finally { setLoading(false); }
  };

  const onEnter = () => {
    clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => { setOpen(true); load(); }, 350);
  };
  const onLeave = () => {
    clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const p = profile || fallback || {};
  const name = p.name || 'Miembro';
  const picture = p.picture;
  const headline = p.headline || p.current_role || 'Miembro de Punto Cero One';
  const company = p.current_company;
  const country = p.country;

  return (
    <span ref={wrapRef} onMouseEnter={onEnter} onMouseLeave={onLeave}
          style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            data-testid={`user-hover-card-${userId}`}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60,
              width: 300, background: '#FFFFFF', borderRadius: 16,
              boxShadow: '0 24px 60px rgba(11,31,58,0.18), 0 0 0 1px rgba(11,31,58,0.06)',
              padding: '1rem 1rem 1.1rem',
              cursor: 'default',
            }}
            onMouseEnter={() => clearTimeout(leaveTimer.current)}
            onMouseLeave={onLeave}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                {picture ? (
                  <img src={picture} alt={name} referrerPolicy="no-referrer"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${NAVY}, #7C3AED)`,
                    color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700,
                  }}>{name.charAt(0).toUpperCase()}</div>
                )}
                <PresenceDot userId={userId} size={11} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: '0.95rem',
                              fontWeight: 700, color: NAVY, letterSpacing: '-0.01em',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(11,31,58,0.6)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {headline}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4,
                          fontSize: '0.72rem', color: 'rgba(11,31,58,0.65)', marginBottom: 12 }}>
              {company && <MetaLine icon={Building2} text={company} />}
              {country && <MetaLine icon={MapPin} text={country} />}
              {p.follower_count != null && (
                <MetaLine icon={UserPlus} text={`${p.follower_count} seguidores`} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={primaryBtn} data-testid={`hover-follow-${userId}`}>
                <UserPlus size={12} /> Seguir
              </button>
              <a href={`/mensajes?to=${userId}`} style={ghostBtn}
                data-testid={`hover-message-${userId}`}>
                <MessageCircle size={12} /> Mensaje
              </a>
              <a href={`/perfil/${userId}`} style={{ ...ghostBtn, marginLeft: 'auto' }}
                data-testid={`hover-profile-${userId}`}>
                Ver perfil <ExternalLink size={11} />
              </a>
            </div>
            {loading && (
              <div style={{ marginTop: 8, fontSize: '0.68rem',
                            color: 'rgba(11,31,58,0.4)', textAlign: 'center' }}>Cargando…</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

const MetaLine = ({ icon: Icon, text }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <Icon size={11} /> <span>{text}</span>
  </div>
);

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '0.35rem 0.75rem', borderRadius: 100,
  background: EMERALD, color: '#FFFFFF', border: 'none', cursor: 'pointer',
  fontSize: '0.68rem', fontWeight: 700,
};
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none',
  padding: '0.35rem 0.75rem', borderRadius: 100,
  background: 'rgba(11,31,58,0.05)', color: NAVY,
  border: '1px solid rgba(11,31,58,0.08)', fontSize: '0.68rem', fontWeight: 600,
};

export default UserHoverCard;
