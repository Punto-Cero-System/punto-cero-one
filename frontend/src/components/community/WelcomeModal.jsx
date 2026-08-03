/**
 * WelcomeModal — shown ONCE the first time a new member enters the platform
 * after registration.
 *
 * Trigger contract
 * ----------------
 * The JoinPage sets `localStorage.pcone_welcome_pending = userId` on successful
 * registration. As soon as the user lands on any page with the modal mounted
 * (HomePage / Mi Espacio) and the CommunityAuthContext user matches, the
 * modal opens, drops confetti and clears the flag so it never fires again.
 *
 * Reuses:
 *   • CommunityAuthContext (existing) to know who just landed
 *   • useCommunityStats (existing) to inject the real member count
 *   • canvas-confetti (light dep) for the celebratory effect
 *
 * NO new UI framework. Follows the same navy/emerald palette as the rest
 * of Mi Espacio.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import useCommunityStats, { formatCount } from '../../hooks/useCommunityStats';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const NAVY = '#0B1F3A';
const EMERALD = '#00C896';
const GOLD = '#D4AF37';
const STORAGE_KEY = 'pcone_welcome_pending';

const runConfetti = () => {
  const duration = 3400;
  const end = Date.now() + duration;
  const colors = [EMERALD, GOLD, '#7C3AED', '#F59E0B', '#0B1F3A'];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      startVelocity: 55,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      startVelocity: 55,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const WelcomeModal = () => {
  const { user } = useCommunityAuth();
  const navigate = useNavigate();
  const { stats } = useCommunityStats(60000);
  const [open, setOpen] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !user?.id) return;
    let pending = null;
    try { pending = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (pending && pending === user.id) {
      firedRef.current = true;
      // Small delay so the layout is stable
      const t = setTimeout(() => {
        setOpen(true);
        runConfetti();
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      }, 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [user?.id]);

  const close = () => {
    setOpen(false);
    // Navigate the user to the feed / Mi Espacio after closing.
    setTimeout(() => navigate('/'), 220);
  };

  if (!open) return null;

  const memberCount = stats?.total_members ?? null;

  return (
    <AnimatePresence>
      <motion.div
        key="pcone-welcome-backdrop"
        data-testid="welcome-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(3, 8, 22, 0.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <motion.div
          key="pcone-welcome-card"
          data-testid="welcome-modal"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(560px, 100%)',
            maxHeight: '92dvh',
            overflowY: 'auto',
            borderRadius: 22,
            background: '#FFFFFF',
            boxShadow: '0 30px 80px rgba(3,8,22,0.35), 0 0 0 1px rgba(11,31,58,0.06)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Cinematic top band */}
          <div style={{
            position: 'relative',
            padding: '1.75rem 1.5rem 1.4rem',
            background: `linear-gradient(135deg, ${NAVY} 0%, #1E1B4B 55%, #4C1D95 100%)`,
            color: '#FFFFFF',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', top: -80, right: -80, width: 220, height: 220,
                borderRadius: '50%', border: `1px dashed ${EMERALD}55`, pointerEvents: 'none',
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', bottom: -60, right: -30, width: 130, height: 130,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${GOLD}55 0%, transparent 60%)`,
                pointerEvents: 'none',
              }}
            />
            <button
              onClick={close}
              data-testid="welcome-modal-close"
              aria-label="Cerrar"
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 36, height: 36, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#FFFFFF', cursor: 'pointer',
              }}
            ><X size={16} /></button>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.62rem', letterSpacing: '0.24em', fontWeight: 700,
              color: EMERALD, marginBottom: '0.85rem',
            }}>
              <Sparkles size={11} /> PUNTO CERO ONE
            </div>
            <div style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 'clamp(1.2rem, 4vw, 1.7rem)',
              fontWeight: 700, lineHeight: 1.2,
              marginBottom: '0.5rem',
            }}>
              🎉 ¡Bienvenido a la comunidad Punto Cero One!
            </div>
            <div style={{
              fontSize: 'clamp(0.82rem, 3vw, 0.95rem)',
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.78)',
            }}>
              Gracias por unirte.<br />
              Ahora formas parte de una comunidad profesional que conecta personas,
              empresas y oportunidades en toda Latinoamérica.
            </div>
          </div>

          {/* Live counter + CTA */}
          <div style={{ padding: '1.35rem 1.5rem 1.55rem' }}>
            <div data-testid="welcome-modal-counter" style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderRadius: 14,
              background: 'linear-gradient(120deg, rgba(0,200,150,0.08), rgba(212,175,55,0.08))',
              border: '1px solid rgba(0,200,150,0.22)',
            }}>
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: EMERALD, flexShrink: 0,
                  boxShadow: `0 0 0 4px ${EMERALD}22`,
                }}
              />
              <div style={{
                fontSize: 'clamp(0.82rem, 3vw, 0.9rem)',
                color: NAVY, fontWeight: 500,
              }}>
                Ahora somos{' '}
                <span style={{ fontWeight: 800, color: '#00825E' }}>
                  {memberCount == null ? '…' : formatCount(memberCount)}
                </span>{' '}
                miembros creciendo juntos cada día.
              </div>
            </div>

            <button
              onClick={close}
              data-testid="welcome-modal-cta"
              style={{
                marginTop: '1.15rem',
                width: '100%',
                padding: '0.85rem 1rem',
                background: NAVY, color: '#FFFFFF',
                borderRadius: 100, border: 'none',
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 'clamp(0.85rem, 3vw, 0.95rem)',
                fontWeight: 700, letterSpacing: '0.02em',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              Comenzar a explorar <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Fire this from JoinPage right after a successful registration to arm
 *  the welcome trigger for the resulting session. */
export const armWelcome = (userId) => {
  if (!userId) return;
  try { localStorage.setItem(STORAGE_KEY, userId); } catch { /* ignore */ }
};

export default WelcomeModal;
