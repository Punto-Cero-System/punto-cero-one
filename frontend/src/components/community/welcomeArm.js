/**
 * armWelcome — tiny helper extracted from WelcomeModal so that the
 * JoinPage does NOT have to statically import the whole modal (which
 * pulls in canvas-confetti + framer-motion + useCommunityStats).
 *
 * The modal itself is lazy-loaded from App.js and reads the same
 * localStorage key on mount.
 */
export const WELCOME_STORAGE_KEY = 'pcone_welcome_pending';

export const armWelcome = (userId) => {
  if (!userId) return;
  try { localStorage.setItem(WELCOME_STORAGE_KEY, userId); } catch { /* ignore */ }
};
