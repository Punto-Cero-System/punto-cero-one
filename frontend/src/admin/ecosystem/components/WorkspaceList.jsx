import React from 'react';
import WorkspaceLifecycleBadge from './WorkspaceLifecycleBadge';
import WorkspaceLaunchModeBadge from './WorkspaceLaunchModeBadge';
import WorkspaceStatusBadge from './WorkspaceStatusBadge';
import workspaceRegistry, { isWorkspaceLaunchModeAllowed } from '../../../system/workspaceRegistry';

const lifecycleOptions = ['live', 'preview', 'declared', 'deprecated', 'production', 'beta', 'alpha', 'internal'];
const stateOptions = ['enabled', 'disabled', 'maintenance'];

const selectStyle = { background: '#071527', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 7, color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit', fontSize: 11, padding: '0.38rem 0.45rem' };

const WorkspaceList = ({ workspaces, onEdit, onActivate, onDeactivate, onStateChange, onLifecycleChange, onLaunchModeChange }) => (
  <div data-testid="workspace-list" style={{ display: 'grid', gap: 10 }}>
    {workspaces.length === 0 && <div style={{ color: 'rgba(255,255,255,0.5)', padding: '2rem 0' }}>No hay workspaces registrados en esta vertical.</div>}
    {workspaces.map((workspace) => {
      const status = workspace.enabled === false || workspace.state === 'disabled' ? 'disabled' : workspace.state === 'maintenance' ? 'maintenance' : workspace.status;
      const launchModeOptions = workspaceRegistry.launchModes.filter((launchMode) => (
        isWorkspaceLaunchModeAllowed(workspace.status, launchMode)
      ));
      const selectedLaunchMode = launchModeOptions.includes(workspace.launchMode)
        ? workspace.launchMode
        : '';
      return (
        <article key={workspace.key} data-testid={`workspace-row-${workspace.key}`} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16 }}>
          <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>{workspace.name || workspace.key}</h3>
                <WorkspaceStatusBadge status={status} />
                <WorkspaceLifecycleBadge lifecycle={workspace.lifecycle || workspace.status} />
                <WorkspaceLaunchModeBadge launchMode={workspace.launchMode} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'monospace', fontSize: 11, marginTop: 7 }}>{workspace.key}</div>
            </div>
            <button type="button" onClick={() => onEdit(workspace)} data-testid={`workspace-edit-${workspace.key}`} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 7, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: '0.45rem 0.65rem' }}>
              Editar
            </button>
          </div>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => (workspace.enabled === false ? onActivate(workspace.key) : onDeactivate(workspace.key))} data-testid={`workspace-toggle-${workspace.key}`} style={{ background: workspace.enabled === false ? 'rgba(0,200,150,0.13)' : 'rgba(255,154,154,0.1)', border: `1px solid ${workspace.enabled === false ? 'rgba(0,200,150,0.4)' : 'rgba(255,154,154,0.35)'}`, borderRadius: 7, color: workspace.enabled === false ? '#00C896' : '#FF9A9A', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, padding: '0.42rem 0.65rem' }}>
              {workspace.enabled === false ? 'Activar' : 'Desactivar'}
            </button>
            <select aria-label={`Estado ${workspace.key}`} value={workspace.state || 'enabled'} onChange={(event) => onStateChange(workspace.key, event.target.value)} style={selectStyle}>
              {stateOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select aria-label={`Lifecycle ${workspace.key}`} value={workspace.lifecycle || workspace.status || 'internal'} onChange={(event) => onLifecycleChange(workspace.key, event.target.value)} style={selectStyle}>
              {lifecycleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select aria-label={`Launch mode ${workspace.key}`} value={selectedLaunchMode} disabled={launchModeOptions.length === 0} onChange={(event) => onLaunchModeChange(workspace.key, event.target.value)} style={selectStyle}>
              <option value="" disabled>Sin configurar</option>
              {launchModeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </article>
      );
    })}
  </div>
);

export default WorkspaceList;
