import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Boxes, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as ecosystemAdminService from '../../system/ecosystemAdminService';
import VerticalList from './components/VerticalList';
import WorkspaceEditor from './components/WorkspaceEditor';
import WorkspaceList from './components/WorkspaceList';

const EcosystemManager = () => {
  const [verticals, setVerticals] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [notice, setNotice] = useState('');

  const loadRegistry = useCallback(() => {
    const nextVerticals = ecosystemAdminService.listVerticals();
    setVerticals(nextVerticals);
    setRegistry(ecosystemAdminService.listRegistry());
    setSelectedKey((current) => current || nextVerticals[0]?.key || '');
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const selectedVertical = verticals.find((vertical) => vertical.key === selectedKey);
  const workspaces = useMemo(
    () => registry.filter((workspace) => workspace.verticalKey === selectedKey),
    [registry, selectedKey],
  );

  const showResult = (result, message) => {
    if (result) {
      setNotice(`${message}: ${result.name || result.key || 'operación completada'}`);
      loadRegistry();
    }
  };

  const runWorkspaceAction = (action, message) => {
    const result = action();
    showResult(result, message);
  };

  return (
    <div data-testid="ecosystem-manager" style={{ background: 'linear-gradient(180deg, #071527 0%, #0B1F3A 100%)', color: '#FFFFFF', minHeight: '100vh' }}>
      <header style={{ background: 'rgba(11,31,58,0.88)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 14, justifyContent: 'space-between', margin: '0 auto', maxWidth: 1400, padding: '1rem 2rem' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
            <Link to="/admin" style={{ alignItems: 'center', color: 'rgba(255,255,255,0.7)', display: 'inline-flex', fontSize: 13, gap: 5, textDecoration: 'none' }}><ArrowLeft size={14} /> Admin</Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ alignItems: 'center', color: '#D4AF37', display: 'inline-flex', fontSize: 11, fontWeight: 700, gap: 6, letterSpacing: '0.16em' }}><Shield size={13} /> ECOSYSTEM MANAGER</span>
          </div>
          <button type="button" onClick={loadRegistry} data-testid="ecosystem-refresh" style={{ alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 999, color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', fontFamily: 'inherit', fontSize: 12, gap: 6, padding: '0.5rem 0.8rem' }}><RefreshCw size={13} /> Refrescar</button>
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: 1400, padding: '2.5rem 2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ color: '#00C896', fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', marginBottom: 10 }}>REGISTRY MANAGEMENT CORE</div>
          <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, letterSpacing: '-0.04em', margin: 0 }}>Ecosystem <strong style={{ fontWeight: 700 }}>Manager</strong></h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0.75rem 0 0', maxWidth: 620 }}>Administra el estado operativo de las verticales y sus workspaces desde una única vista del ecosistema.</p>
        </div>

        {notice && <div data-testid="ecosystem-notice" style={{ alignItems: 'center', background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 10, color: '#00C896', display: 'flex', fontSize: 13, gap: 8, marginBottom: 18, padding: '0.7rem 0.9rem' }}><CheckCircle2 size={15} /> {notice}</div>}

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(210px, 0.28fr) minmax(0, 1fr)' }}>
          <VerticalList verticals={verticals} selectedKey={selectedKey} onSelect={setSelectedKey} />
          <section>
            <div style={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em' }}>WORKSPACES</div>
                <h2 style={{ alignItems: 'center', display: 'flex', fontSize: 22, gap: 8, margin: '0.4rem 0 0' }}><Boxes size={19} color="#00C896" /> {selectedVertical?.name || 'Selecciona una vertical'}</h2>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'monospace', fontSize: 11 }}>{workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}</span>
            </div>
            <WorkspaceEditor workspace={editingWorkspace} onCancel={() => setEditingWorkspace(null)} onSave={(changes) => { runWorkspaceAction(() => ecosystemAdminService.editWorkspace(editingWorkspace.key, changes), 'Workspace actualizado'); setEditingWorkspace(null); }} />
            <WorkspaceList
              workspaces={workspaces}
              onEdit={setEditingWorkspace}
              onActivate={(key) => runWorkspaceAction(() => ecosystemAdminService.activateWorkspace(key), 'Workspace activado')}
              onDeactivate={(key) => runWorkspaceAction(() => ecosystemAdminService.deactivateWorkspace(key), 'Workspace desactivado')}
              onStateChange={(key, state) => runWorkspaceAction(() => ecosystemAdminService.editWorkspace(key, { state }), 'Estado actualizado')}
              onLifecycleChange={(key, lifecycle) => runWorkspaceAction(() => ecosystemAdminService.editWorkspace(key, { lifecycle }), 'Lifecycle actualizado')}
              onLaunchModeChange={(key, launchMode) => runWorkspaceAction(() => ecosystemAdminService.editWorkspace(key, { launchMode }), 'Launch mode actualizado')}
            />
          </section>
        </div>
      </main>
    </div>
  );
};

export default EcosystemManager;
