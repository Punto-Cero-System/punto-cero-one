import React from 'react';

const LIFECYCLE_META = {
  live: ['PRODUCTION', '#00C896'],
  production: ['PRODUCTION', '#00C896'],
  preview: ['BETA', '#7CC4FF'],
  beta: ['BETA', '#7CC4FF'],
  declared: ['ALPHA', '#D4AF37'],
  alpha: ['ALPHA', '#D4AF37'],
  internal: ['INTERNAL', '#C6A8FF'],
  deprecated: ['DEPRECATED', '#FF9A9A'],
};

const WorkspaceLifecycleBadge = ({ lifecycle = 'internal' }) => {
  const [label, color] = LIFECYCLE_META[String(lifecycle).toLowerCase()] || [String(lifecycle).toUpperCase(), '#FFFFFF'];
  return (
    <span data-testid="workspace-lifecycle-badge" style={{ border: `1px solid ${color}55`, borderRadius: 999, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '0.25rem 0.55rem' }}>
      {label}
    </span>
  );
};

export default WorkspaceLifecycleBadge;
