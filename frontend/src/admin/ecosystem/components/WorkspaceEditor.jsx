import React, { useState } from 'react';

const WorkspaceEditor = ({ workspace, onSave, onCancel }) => {
  const [name, setName] = useState(workspace?.name || '');

  if (!workspace) return null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name: name.trim() });
      }}
      data-testid="workspace-editor"
      style={{ background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 14, display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: 14 }}
    >
      <div style={{ flex: '1 1 240px' }}>
        <label htmlFor="workspace-name" style={{ color: 'rgba(255,255,255,0.55)', display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>
          NOMBRE DEL WORKSPACE
        </label>
        <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} style={{ background: 'rgba(7,21,39,0.7)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#FFFFFF', fontFamily: 'inherit', padding: '0.6rem 0.7rem', width: '100%' }} />
      </div>
      <div style={{ alignItems: 'flex-end', display: 'flex', gap: 8 }}>
        <button type="submit" style={{ background: '#00C896', border: 0, borderRadius: 8, color: '#071527', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, padding: '0.65rem 0.9rem' }}>
          Guardar
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', padding: '0.65rem 0.9rem' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default WorkspaceEditor;
