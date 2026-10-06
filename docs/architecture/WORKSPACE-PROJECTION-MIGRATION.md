# Workspace projection migration audit

## Scope and boundary

This is an inventory and preparation step only. The projection snapshot is
generated from `backend/services/workspace_registry.py` and is not connected to
frontend runtime consumers. No frontend catalog or runtime behavior is changed
by this phase.

The projection contract is intentionally limited to `key`, `status`, `label`,
and `route`. Lifecycle remains distinct from derived availability; the
projection carries no availability and does not settle launch mode, external
launch, presentation metadata, or permissions.

## Current consumer map

| Current source | Consumers | Current responsibility and source |
| --- | --- | --- |
| `frontend/src/system/workspaceCatalog.js` | `workspaceActivation.js`, `workspaceProvisioning.js`, `workspaceOrchestrator.js`, `workspaceRegistryService.js`, `workspaceEnrollment.js`, and `ecosystemEngine.js`; also its catalog and launch contract tests | Supplies the frontend's manually maintained catalog, lifecycle vocabulary, status lookup, and lifecycle-to-availability derivation. Runtime consumers use status/availability checks for activation, provisioning, orchestration, enrollment, and ecosystem filtering. |
| `frontend/src/system/workspaceRegistry.js` | `ecosystemEngine.js` and `workspaceRegistryService.js`; also registry, catalog, and launch contract tests | Supplies frontend vertical/workspace records, including lifecycle/status and workspace configuration. It is a separate catalog from the backend authority. |
| `frontend/src/config/workspaceSpaces.js` | `SpaceSelector.jsx`, `LoginCardOne.jsx`, and `WorkspaceSpacePlaceholderPage.jsx`; also the access-context test | Supplies navigation-facing key, label, route, and the local `available` / `coming_soon` / `external` state. Selector and placeholder surfaces use these values for display/navigation. |
| `frontend/src/services/workspaceRegistry.jsx` | `WorkspacePanel.jsx`, `WorkspaceDndProvider.jsx`, and `MiEspacioConfigPage.jsx` | Widget/module registry, not workspace lifecycle authority; not a migration target for this projection. |
| `backend/services/workspace_registry.py` (`WORKSPACE_REGISTRY`) | Backend workspace routes/access bridge, policy and identity services/tests; the existing contract generator and tests | Effective authority for workspace identity and lifecycle. The backend-derived projection is the future source for consumers of the safe shared fields. |

### Direct status and availability usage

- Lifecycle status is declared independently in the frontend catalog and
  registry. `workspaceCatalog.js` owns the frontend status lookup and derives
  open/closed availability; its consumers include activation, provisioning,
  orchestration, enrollment, ecosystem filtering, and registry service logic.
- `workspaceRegistry.js` consumers directly inspect workspace/vertical
  `status` for filtering or routing. `sessionManager.js` also checks
  `space.status === 'live'` for launchability, a distinct rule that must not be
  conflated with lifecycle availability.
- `workspaceSpaces.js` declares navigation statuses (`available`,
  `coming_soon`, `external`), which are not backend lifecycle values.
- The current catalogs do not store an `availability` property. The frontend
  derives it from lifecycle via `workspaceCatalog.js`; `workspaceSpaces.js`
  separately stores navigation state, not lifecycle availability.
- Backend `workspace_registry.py` derives availability from lifecycle; the new
  projection deliberately excludes that derived value.

## Current and future sources

| Concern | Current source | Future source after a separately approved migration |
| --- | --- | --- |
| Shared workspace key, lifecycle status, label, and route | Backend registry is the effective authority, but frontend `workspaceCatalog.js`, `workspaceRegistry.js`, and `workspaceSpaces.js` contain manually maintained overlaps | Generated snapshot conforming to `workspace_projection.contract.json`, regenerated from the backend registry |
| Availability/open-close behavior | Derived independently by backend and frontend from lifecycle | Continue deriving it at the consumer from `status`; do not persist it in the projection |
| Launchability / `launchMode` | Frontend launch/session/orchestrator surfaces, with pending product decisions | Out of this projection; requires a separate decision and contract |
| External destinations and presentation fields | Navigation catalog and UI | Out of this projection; do not infer or migrate them here |
| Permissions | Backend registry and authorization policy | Remain backend authorization data; never project them to this frontend contract |

## Migration risks

1. Frontend sources have differing key sets and statuses (for example,
   navigation-only entries and legacy entries). Replacing them wholesale could
   silently remove routes or change visibility.
2. The meanings and consumers of lifecycle, availability, launchability, and
   navigation state differ. Treating them as interchangeable can open or hide
   workspaces incorrectly.
3. `sessionManager.js` has a stricter `live` launchability check; the projection
   status does not authorize a launch or represent that decision.
4. Labels and routes are not currently identical across every catalog. A
   consumer migration must choose the shared field source without silently
   changing UX or route behavior.
5. The snapshot is a build-time contract artifact only in this phase. Runtime
   wiring, delivery/caching, and stale-snapshot handling remain to be designed
   before any consumer is switched.
6. Medical, empresa, comunidad, legacy, launch mode, external launch, billing,
   and One Core decisions remain out of scope and must not be resolved by
   projecting catalog data.

## Safe next step

Review and approve a consumer-by-consumer migration plan, including treatment
of non-shared navigation and launch fields. Until then, keep current consumers
unchanged and regenerate only the contract snapshot when the authoritative
registry changes.
