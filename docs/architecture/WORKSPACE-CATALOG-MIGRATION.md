# Workspace Catalog migration audit

## Scope and current outcome

This phase audits whether `workspaceCatalog` can be switched to
`workspace_projection.snapshot.json` without changing its public behavior. The
switch is currently blocked by differences between the checked-in snapshot and
the existing frontend catalog. The catalog and its consumers therefore remain
unchanged; this avoids silently changing workspace availability or visible
keys.

## Current API

`frontend/src/system/workspaceCatalog.js` exports:

- `WORKSPACE_STATUSES`
- `deriveAvailability(status)` (`open` / `closed`)
- `isWorkspaceStatusOpen(status)`
- `WORKSPACE_CATALOG` and the default export
- `getWorkspace(key)`
- `getWorkspaceStatus(key)`
- `isWorkspaceAvailable(key)`
- `canLaunchWorkspace(key)`

`findWorkspace` is an internal helper of
`frontend/src/system/workspaceRegistryService.js`, not a public catalog export.
`getSpace` belongs to `frontend/src/config/workspaceSpaces.js`, not
`workspaceCatalog`.

## Consumers and compatibility required

- `workspaceActivation.js`, `workspaceOrchestrator.js`,
  `workspaceProvisioning.js`, `workspaceEnrollment.js`, `ecosystemEngine.js`,
  and `workspaceRegistryService.js` use catalog exports, particularly
  `isWorkspaceStatusOpen`; `workspaceRegistryService.js` also uses
  `WORKSPACE_STATUSES`.
- `workspaceCatalog.test.js` and `workspaceLaunchContract.test.js` protect
  availability, status, and launch behavior.
- Existing public catalog keys are `legal`, `medical`, `odontologia`,
  `psicologia`, `enfermeria`, and `legacy`.
- Existing public lookup records expose `key`, `name`, and `status`. The
  projection instead calls its display-name field `label` and additionally has
  `route`; consumers may depend on the existing record shape.
- The future implementation must retain every export and its synchronous
  behavior. `live` and `preview` remain open; `declared` and `deprecated`
  remain closed. A missing workspace remains unavailable.

## Future API

Once the projection snapshot and existing catalog have compatible keys,
lifecycle values, and public record shape, the catalog's shared identity fields
can be loaded from a validated projection module while retaining its current
exports. `deriveAvailability` and `isWorkspaceStatusOpen` remain lifecycle
derivations in `workspaceCatalog`; availability is not persisted in the
projection.

The snapshot fields are `key`, `status`, `label`, `route`, and the explicitly
declared `location` from `WORKSPACE-LOCATION-CONTRACT.md`. No `launchMode`,
`external` boolean, `availability`, `permission`, or presentation metadata is
included.

## Current incompatibilities and risks

The current backend-generated snapshot does not represent the existing
`workspaceCatalog`:

| Workspace | Existing catalog | Projection snapshot | Compatibility |
| --- | --- | --- | --- |
| `medical` | `preview` | `declared` | Status change would close a currently open workspace. |
| `legacy` | `deprecated` | Missing | Removing it changes lookup and availability behavior. |
| `empresa` | Missing | `preview` | Adding it changes the publicly available key set. |
| `comunidad` | Missing | `live` | Adding it changes the publicly available key set and crosses into external navigation concerns. |
| `finance`, `accounting`, `inmobiliaria` | Missing | `declared` | Adding these changes the publicly available key set. |

Additionally, projected `label` does not preserve the catalog's `name` field.
The consumer/API compatibility cannot be achieved by directly replacing the
catalog array with projection rows.

Resolving this requires an explicit authoritative snapshot that preserves the
existing `workspaceCatalog` key/status contract (including the deliberate
`medical` and `legacy` cases), or a separately approved behavior change. This
phase does neither. It does not add compatibility overlays, translations,
adapters, or a second catalog.

## Migration recommendation

Keep the existing catalog and its consumers unchanged until the projection
generator can produce a snapshot compatible with this API and the frontend
bundle can load that generated artifact without a manually maintained copy.
Then migrate behind the same synchronous public API and rerun the catalog,
projection, and launch contract suites before switching any additional
consumer.
