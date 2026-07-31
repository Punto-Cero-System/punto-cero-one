import React, { useEffect, useState } from 'react';
import { useRealtime } from '../../contexts/RealtimeContext';

const COLORS = {
  ONLINE:  { dot: '#00C896', ring: '#00C896', label: 'En línea' },
  AWAY:    { dot: '#F59E0B', ring: '#F59E0B', label: 'Ausente' },
  OFFLINE: { dot: '#9CA3AF', ring: 'transparent', label: 'Desconectado' },
};

/**
 * PresenceDot — small pulse indicator surfaced next to an avatar / name.
 * Uses the SSE presence snapshot the backend already exposes. No polling —
 * the RealtimeContext already keeps a live stream open, so we only hit
 * /api/realtime/presence once per mount to prime the dot.
 *
 * Props:
 *   userId — user to look up
 *   size   — visible dot diameter in px (default 10)
 *   inline — when true, renders inline; when false, absolute-positioned so it
 *            can be dropped on top of an avatar via a relative parent.
 */
const PresenceDot = ({ userId, size = 10, inline = false, showLabel = false }) => {
  const { presenceOf } = useRealtime();
  const [status, setStatus] = useState('OFFLINE');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    presenceOf([userId]).then((map) => {
      if (!cancelled) setStatus(map?.[userId]?.status || 'OFFLINE');
    });
    return () => { cancelled = true; };
  }, [userId, presenceOf]);

  const c = COLORS[status] || COLORS.OFFLINE;

  const dot = (
    <span
      data-testid={`presence-dot-${userId}-${status}`}
      title={c.label}
      style={{
        display: 'inline-block',
        width: size, height: size, borderRadius: '50%',
        background: c.dot,
        boxShadow: status === 'ONLINE' ? `0 0 0 2px #FFFFFF, 0 0 10px ${c.ring}` : '0 0 0 2px #FFFFFF',
        transition: 'all 0.3s ease',
      }} />
  );

  if (inline) {
    return showLabel ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                     fontSize: '0.7rem', color: 'rgba(11,31,58,0.65)', fontWeight: 500 }}>
        {dot} <span>{c.label}</span>
      </span>
    ) : dot;
  }

  // Absolute overlay — parent must be position:relative
  return (
    <span style={{
      position: 'absolute', bottom: 0, right: 0,
      pointerEvents: 'none',
    }}>{dot}</span>
  );
};

export default PresenceDot;
