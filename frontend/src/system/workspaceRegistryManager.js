import {
  changeLaunchMode as serviceChangeLaunchMode,
  changeLifecycle as serviceChangeLifecycle,
  changeWorkspaceState as serviceChangeWorkspaceState,
  disableWorkspace as serviceDisableWorkspace,
  enableWorkspace as serviceEnableWorkspace,
  registerWorkspace as serviceRegisterWorkspace,
  removeWorkspace as serviceRemoveWorkspace,
  updateWorkspace as serviceUpdateWorkspace,
} from './workspaceRegistryService';

export function registerWorkspace(workspace) {
  return serviceRegisterWorkspace(workspace);
}

export function updateWorkspace(workspaceKey, changes) {
  return serviceUpdateWorkspace(workspaceKey, changes);
}

export function removeWorkspace(workspaceKey) {
  return serviceRemoveWorkspace(workspaceKey);
}

export function enableWorkspace(workspaceKey) {
  return serviceEnableWorkspace(workspaceKey);
}

export function disableWorkspace(workspaceKey) {
  return serviceDisableWorkspace(workspaceKey);
}

export function changeWorkspaceState(workspaceKey, state) {
  return serviceChangeWorkspaceState(workspaceKey, state);
}

export function changeLaunchMode(workspaceKey, launchMode) {
  return serviceChangeLaunchMode(workspaceKey, launchMode);
}

export function changeLifecycle(workspaceKey, lifecycle) {
  return serviceChangeLifecycle(workspaceKey, lifecycle);
}

export default {
  registerWorkspace,
  updateWorkspace,
  removeWorkspace,
  enableWorkspace,
  disableWorkspace,
  changeWorkspaceState,
  changeLaunchMode,
  changeLifecycle,
};
