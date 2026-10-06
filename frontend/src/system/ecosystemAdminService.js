import {
  disableWorkspace as managerDisableWorkspace,
  enableWorkspace as managerEnableWorkspace,
} from './workspaceRegistryManager';
import {
  getWorkspace as serviceGetWorkspace,
  listRegistry as serviceListRegistry,
  listStates as serviceListStates,
  listVerticals as serviceListVerticals,
  registerWorkspace,
  removeWorkspace,
  updateWorkspace,
} from './workspaceRegistryService';

export function listRegistry() {
  return serviceListRegistry();
}

export function getWorkspace(workspaceKey) {
  return serviceGetWorkspace(workspaceKey);
}

export function createWorkspace(workspace) {
  return registerWorkspace(workspace);
}

export function editWorkspace(workspaceKey, changes) {
  return updateWorkspace(workspaceKey, changes);
}

export function deleteWorkspace(workspaceKey) {
  return removeWorkspace(workspaceKey);
}

export function activateWorkspace(workspaceKey) {
  return managerEnableWorkspace(workspaceKey);
}

export function deactivateWorkspace(workspaceKey) {
  return managerDisableWorkspace(workspaceKey);
}

export function listVerticals() {
  return serviceListVerticals();
}

export function listStates() {
  return serviceListStates();
}

export default {
  listRegistry,
  getWorkspace,
  createWorkspace,
  editWorkspace,
  deleteWorkspace,
  activateWorkspace,
  deactivateWorkspace,
  listVerticals,
  listStates,
};
