import React from 'react';

const LAUNCH_MODE_META = {
  workspace: ['WORKSPACE', '#00C896'],
  controlled: ['CONTROLLED', '#7CC4FF'],
};

const WorkspaceLaunchModeBadge = ({ launchMode }) => {
  const normalizedMode = String(launchMode || '').toLowerCase();
  const [label, color] = LAUNCH_MODE_META[normalizedMode] || ['SIN CONFIGURAR', '#FF9A9A'];
  return (
    <span data-testid="workspace-launch-mode-badge" style={{ border: `1px solid ${color}55`, borderRadius: 999, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '0.25rem 0.55rem' }}>
      {label}
    </span>
  );
};

export default WorkspaceLaunchModeBadge;
