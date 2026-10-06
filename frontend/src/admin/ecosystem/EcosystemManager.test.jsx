import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => require('react').createElement('a', { ...props, href: to }, children),
}), { virtual: true });

jest.mock('../../system/ecosystemAdminService', () => ({
  listVerticals: jest.fn(),
  listRegistry: jest.fn(),
  editWorkspace: jest.fn(),
  activateWorkspace: jest.fn(),
  deactivateWorkspace: jest.fn(),
}));

import * as mockService from '../../system/ecosystemAdminService';
import EcosystemManager from './EcosystemManager';

const verticals = [
  { key: 'legal', name: 'Punto Cero Legal' },
  { key: 'medical', name: 'Punto Cero Medical' },
  { key: 'odontologia', name: 'Punto Cero Odontología' },
  { key: 'psicologia', name: 'Punto Cero Psicología' },
  { key: 'enfermeria', name: 'Punto Cero Enfermería' },
];

const workspaces = [
  { key: 'legal', name: 'Punto Cero Legal', verticalKey: 'legal', status: 'live', lifecycle: 'production', launchMode: 'workspace', state: 'enabled', enabled: true },
  { key: 'medical', name: 'Punto Cero Medical', verticalKey: 'medical', status: 'preview', lifecycle: 'beta', launchMode: 'controlled', state: 'enabled', enabled: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockService.listVerticals.mockReturnValue(verticals);
  mockService.listRegistry.mockReturnValue(workspaces);
  mockService.editWorkspace.mockImplementation((key, changes) => ({ key, ...changes }));
  mockService.activateWorkspace.mockImplementation((key) => ({ key, enabled: true }));
  mockService.deactivateWorkspace.mockImplementation((key) => ({ key, enabled: false }));
});

describe('EcosystemManager', () => {
  it('renderiza las verticales y consume el servicio administrativo', async () => {
    render(<EcosystemManager />);

    await waitFor(() => expect(screen.getByTestId('vertical-list')).toBeInTheDocument());
    expect(screen.getAllByText('Punto Cero Legal').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Punto Cero Medical')).toBeInTheDocument();
    expect(mockService.listVerticals).toHaveBeenCalled();
    expect(mockService.listRegistry).toHaveBeenCalled();
  });

  it('renderiza workspace, estado, lifecycle y launch mode', async () => {
    render(<EcosystemManager />);

    expect(await screen.findByTestId('workspace-row-legal')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText('PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
  });

  it('cambia de vertical y muestra sus workspaces', async () => {
    render(<EcosystemManager />);

    fireEvent.click(await screen.findByTestId('vertical-medical'));
    expect(await screen.findByTestId('workspace-row-medical')).toBeInTheDocument();
    expect(screen.getByText('PREVIEW')).toBeInTheDocument();
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText('CONTROLLED')).toBeInTheDocument();
  });

  it('prepara acciones UI mediante ecosystemAdminService', async () => {
    render(<EcosystemManager />);

    fireEvent.click(await screen.findByTestId('workspace-toggle-legal'));
    expect(mockService.deactivateWorkspace).toHaveBeenCalledWith('legal');

    fireEvent.change(screen.getByLabelText('Lifecycle legal'), { target: { value: 'beta' } });
    expect(mockService.editWorkspace).toHaveBeenCalledWith('legal', { lifecycle: 'beta' });
  });

  it('muestra solo launchModes compatibles con el lifecycle', async () => {
    render(<EcosystemManager />);

    const liveOptions = await screen.findByLabelText('Launch mode legal');
    expect(Array.from(liveOptions.options).map((option) => option.value))
      .toEqual(['', 'workspace', 'controlled']);

    fireEvent.click(screen.getByTestId('vertical-medical'));
    const previewOptions = await screen.findByLabelText('Launch mode medical');
    expect(Array.from(previewOptions.options).map((option) => option.value))
      .toEqual(['', 'controlled']);
  });
});
