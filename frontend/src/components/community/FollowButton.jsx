import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Loader2 } from 'lucide-react';
import { followsService } from '../../services/followsService';
import { useCommunityAuth } from '../../contexts/CommunityAuthContext';

const EMERALD = '#00C896';
const NAVY = '#0B1F3A';

/**
 * FollowButton — universal follow/unfollow for any Social Graph entity.
 *
 * Props:
 *   entityType  — 'user' | 'company' | 'hashtag' | 'country' | 'vertical' | 'event'
 *   entityId    — the raw entity id (case-insensitive for hashtag/country/vertical)
 *   initialFollowing — optional boolean to skip the first status check
 *   size        — 'sm' | 'md' | 'lg'
 *   testid      — data-testid override
 *   onChange    — (nextState: boolean, count: number) => void
 */
const FollowButton = ({
  entityType, entityId,
  initialFollowing, size = 'md', testid,
  onChange,
}) => {
  const { user } = useCommunityAuth();
  const [following, setFollowing] = useState(!!initialFollowing);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(initialFollowing !== undefined);

  // Prime state via bulk-status if the caller didn't pass initial.
  useEffect(() => {
    if (!user || !entityId || initialFollowing !== undefined) { setReady(true); return; }
    let cancelled = false;
    followsService.bulkStatus(entityType, [entityId])
      .then((d) => { if (!cancelled) setFollowing(!!d.following?.[entityId.toLowerCase().replace(/^#/, '')]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [user?.id, entityType, entityId, initialFollowing]);

  const toggle = async (e) => {
    e?.stopPropagation();
    if (!user || busy) return;
    setBusy(true);
    const optimistic = !following;
    setFollowing(optimistic);
    try {
      const fn = optimistic ? followsService.follow : followsService.unfollow;
      const res = await fn(entityType, entityId);
      setFollowing(!!res.my_following);
      if (onChange) onChange(!!res.my_following, res.count || 0);
    } catch {
      setFollowing(!optimistic); // rollback
    } finally { setBusy(false); }
  };

  if (!user) return null;

  const dims = SIZES[size] || SIZES.md;
  const followingStyle = {
    background: '#FFFFFF', color: NAVY, border: '1px solid rgba(11,31,58,0.15)',
  };
  const notFollowingStyle = {
    background: EMERALD, color: '#FFFFFF', border: `1px solid ${EMERALD}`,
    boxShadow: `0 6px 16px ${EMERALD}33`,
  };

  return (
    <motion.button
      onClick={toggle}
      disabled={busy || !ready}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      data-testid={testid || `follow-${entityType}-${entityId}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: dims.padding, borderRadius: 100,
        fontSize: dims.fontSize, fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer',
        transition: 'all 0.25s ease',
        opacity: ready ? 1 : 0.6,
        ...(following ? followingStyle : notFollowingStyle),
      }}>
      {busy ? <Loader2 size={dims.icon} className="pcone-spin" /> :
        following ? <Check size={dims.icon} /> : <Plus size={dims.icon} />}
      {following ? 'Siguiendo' : 'Seguir'}
      <style>{`.pcone-spin { animation: pcSpin 1s linear infinite; }
        @keyframes pcSpin { to { transform: rotate(360deg); } }`}</style>
    </motion.button>
  );
};

const SIZES = {
  sm: { padding: '0.3rem 0.7rem', fontSize: '0.68rem', icon: 11 },
  md: { padding: '0.45rem 1rem',  fontSize: '0.78rem', icon: 13 },
  lg: { padding: '0.6rem 1.35rem', fontSize: '0.85rem', icon: 15 },
};

export default FollowButton;
