# Workspace Location Contract

## Decision

Workspace location is a first-class, explicitly declared field in
`backend/services/workspace_registry.py` (`WORKSPACE_REGISTRY[].location`).
Location is not inferred from lifecycle, route shape, or `entry_url`.

The canonical representation is the string enum:

- `internal`: lives within the Punto Cero Workspace/System experience.
- `external`: lives outside that workspace experience; current navigation enters
  the Punto Cero One community through `/join`.

The field describes logical product location, not whether a URL is syntactically
absolute or hosted on a separate domain. Therefore, the legal workspace has an
external HTTPS `entry_url` but is still logically `internal`. Conversely,
`comunidad` is `external` even though the backend Registry has `route: "/"` and
no `entry_url`.

## Independent axes

| Axis | Answers | Authority / behavior |
| --- | --- | --- |
| Lifecycle | What stage is this workspace in? | Registry `status`: `live`, `preview`, `declared`, `deprecated`. |
| Availability | Is this lifecycle open? | Derived from lifecycle; never stored as location. |
| LaunchMode | How does entry into this workspace work? | Declared and validated under `WORKSPACE-LAUNCHMODE-CONTRACT.md`. |
| Location | Where does this experience live? | Explicit Registry `location`: `internal` or `external`. |

`live` does not imply `internal`; `external` does not imply closed; `preview`
does not imply external. Location is not an authorization signal and does not
change launch eligibility.

## Evidence and declared values

The backend Registry now declares `location` for every workspace. Existing
workspace statuses, routes, entry URLs, enabled states, and launch modes remain
unchanged.

| Workspace | Location | Evidence |
| --- | --- | --- |
| `legal` | `internal` | Workspace route `/workspace/legal`; navigation status is `available`. |
| `medical` | `internal` | Workspace route `/workspace/medical`; navigation status is `coming_soon`. |
| `empresa` | `internal` | Workspace route `/workspace/empresa`; no `entry_url`, but it is not marked external. |
| `comunidad` | `external` | `workspaceSpaces.js` explicitly declares `status: external`, labels it Comunidad Punto Cero One, and routes navigation to `/join`. |
| `odontologia`, `psicologia`, `enfermeria`, `finance`, `accounting`, `inmobiliaria` | `internal` | Backend routes use `/workspace/<key>`; there is no evidence declaring these as external destinations. |

The existing backend `comunidad.route` value `/` differs from frontend
navigation's `/join`. This contract records location only and intentionally
does not reconcile or change either route.

## Audit: declaration, consumers, authorization and launch

| Field / surface | Current source | Consumers | Risk |
| --- | --- | --- | --- |
| `external` navigation status | `frontend/src/config/workspaceSpaces.js` (`SPACE_STATUS.EXTERNAL`; `comunidad`) | `SpaceSelector`, login flow and space lookup use the navigation catalog's path/status; `comunidad` goes to `/join`. | The current `external` value belongs to a navigation-status vocabulary, not a typed Workspace location contract. Reusing it directly would mix lifecycle/navigation state with location. |
| `entry_url` | Backend Workspace Registry; consumed by frontend `sessionManager.js` | `selectLaunchableSpace`, `isLaunchable`, and `requestVertical` use `entry_url` to construct an external launch URL. | It controls whether this launch path has a URL; it does not say where the workspace logically lives. `legal` has a URL and remains internal; `empresa` has none and remains internal. |
| Backend `route` | Backend Workspace Registry; Access Bridge returns it in the intent response | `access_bridge.create_access_intent`; `/api/access` route handler; backend callers receive the route. | Backend `comunidad.route` is `/`, unlike frontend `/join`. Do not treat route alone as an external discriminator or silently change routing. |
| Frontend `path` | `workspaceSpaces.js` | Navigation selector, placeholder route, and login selection. | Path is a navigation target, not access control or a complete location declaration. |
| Workspace `location` | Backend Registry (new explicit declaration) | Canonical projection snapshot and contract tests only in this phase; no production runtime consumer is connected. | If omitted or unknown, projection generation fails closed. |

The inspected `identity_core.py` mirror uses navigation status `external` for
`comunidad`; it does not define Workspace `location`. The inspected
`access_bridge.py` looks up workspace identity, permission, lifecycle policy
and route, but does not read `entry_url` or `external`. Neither module is
changed. Workspace location does not alter authorization.

`sessionManager.isLaunchable` requires `entry_url`, permission, and `status:
live`; it does not inspect `external` or `location`. No launch behavior is
changed in this phase.

## Projection

The frontend-safe `workspace_projection.snapshot.json` and
`workspace_projection.contract.json` include `location` alongside `key`,
`status`, `label`, and `route`. Location is an explicit field in the
projection, not a derived value. This snapshot is not connected to runtime
consumers and does not include `external` as a boolean, `availability`,
`launchMode`, permission, or visual metadata.

The separate, pre-existing `workspace_projection.json` artifact used by the
broader D2.2 Registry contract also carries location; it continues to carry its
pre-existing permission and derived availability fields and is not the safe
frontend projection contract.

Regenerate from the backend with:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\scripts\generate_workspace_projection.py
```

Missing/unknown location, duplicate keys, invalid lifecycle, or a manually
altered snapshot fails validation.

## Deferred work for Punto Cero One

- Reconcile the backend route `/` and frontend navigation path `/join` in a
  separately scoped routing decision.
- Decide which consumer should read projected `location`; keep the current
  navigation catalog and runtime behavior unchanged until that migration is
  explicitly planned.
- Do not use location for permissions, lifecycle/availability, enrollment, or
  LaunchMode.
- This contract prepares a complete workspace record for future Punto Cero One
  evolution; it does not start that development.
