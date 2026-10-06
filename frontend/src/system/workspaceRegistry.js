export const workspaceRegistry = {
  verticals: [
    {
      key: 'legal',
      name: 'Punto Cero Legal',
      status: 'live',
      workspaces: ['legal'],
    },
    {
      key: 'medical',
      name: 'Punto Cero Medical',
      status: 'preview',
      workspaces: ['medical'],
    },
    {
      key: 'odontologia',
      name: 'Punto Cero Odontología',
      status: 'declared',
      workspaces: ['odontologia'],
    },
    {
      key: 'psicologia',
      name: 'Punto Cero Psicología',
      status: 'declared',
      workspaces: ['psicologia'],
    },
    {
      key: 'enfermeria',
      name: 'Punto Cero Enfermería',
      status: 'declared',
      workspaces: ['enfermeria'],
    },
  ],
  workspaces: [
    { key: 'legal', name: 'Punto Cero Legal', verticalKey: 'legal', state: 'enabled', enabled: true, launchMode: 'workspace', lifecycle: 'live', status: 'live' },
    { key: 'medical', name: 'Punto Cero Medical', verticalKey: 'medical', state: 'enabled', enabled: true, launchMode: 'controlled', lifecycle: 'preview', status: 'preview' },
    { key: 'odontologia', name: 'Punto Cero Odontología', verticalKey: 'odontologia', state: 'disabled', enabled: false, launchMode: 'controlled', lifecycle: 'declared', status: 'declared' },
    { key: 'psicologia', name: 'Punto Cero Psicología', verticalKey: 'psicologia', state: 'disabled', enabled: false, launchMode: 'controlled', lifecycle: 'declared', status: 'declared' },
    { key: 'enfermeria', name: 'Punto Cero Enfermería', verticalKey: 'enfermeria', state: 'disabled', enabled: false, launchMode: 'controlled', lifecycle: 'declared', status: 'declared' },
  ],
  states: ['enabled', 'disabled', 'maintenance'],
  lifecycles: ['live', 'preview', 'declared', 'deprecated'],
  launchModes: ['workspace', 'controlled'],
};

export const isWorkspaceLaunchModeAllowed = (status, launchMode) => {
  const lifecycle = String(status ?? '').trim().toLowerCase();
  const mode = String(launchMode ?? '').trim().toLowerCase();

  if (!workspaceRegistry.launchModes.includes(mode)) return false;
  if (lifecycle === 'live') return true;
  return lifecycle === 'preview' && mode === 'controlled';
};

export default workspaceRegistry;
