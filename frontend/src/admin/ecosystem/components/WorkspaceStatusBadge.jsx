import React from 'react';

const STATUS_META = {
  live: ['LIVE', '#00C896', 'rgba(0,200,150,0.14)'],
  preview: ['PREVIEW', '#7CC4FF', 'rgba(124,196,255,0.14)'],
  declared: ['DECLARED', '#D4AF37', 'rgba(212,175,55,0.14)'],
  deprecated: ['DEPRECATED', '#FF9A9A', 'rgba(255,154,154,0.14)'],
  disabled: ['DISABLED', '#FF9A9A', 'rgba(255,154,154,0.14)'],
  maintenance: ['MAINTENANCE', '#F6A85B', 'rgba(246,168,91,0.14)'],
};

const WorkspaceStatusBadge = ({ status = 'declared' }) => {
  const [label, color, background] = STATUS_META[String(status).toLowerCase()] || [String(status).toUpperCase(), '#FFFFFF', 'rgba(255,255,255,0.1)'];
  return (
    <span data-testid="workspace-status-badge" style={{ background, border: `1px solid ${color}55`, borderRadius: 999, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '0.25rem 0.55rem' }}>
      {label}
    </span>
  );
};

export default WorkspaceStatusBadge;
