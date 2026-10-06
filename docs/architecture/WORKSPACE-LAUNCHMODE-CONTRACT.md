# Workspace LaunchMode Contract

## Decision

`frontend/src/system/workspaceRegistry.js` is the single declarative source of
truth for frontend workspace `launchMode`. Each workspace record must declare
its mode. The orchestrator reads and forwards that value unchanged; it never
derives a mode from lifecycle. Activation validates the Registry's lifecycle
and declared mode, and does not trust a mode supplied only by a destination
decision.

This contract does not alter authorization, lifecycle values, workspace
availability, or the location field defined separately by
`WORKSPACE-LOCATION-CONTRACT.md`. It does not resolve external launch behavior
or start Punto Cero One development.

## Supported values and lifecycle compatibility

The Registry exposes exactly these launch modes:

- `workspace`
- `controlled`

They remain distinct from lifecycle (`live`, `preview`, `declared`,
`deprecated`) and availability (`open` / `closed`), which continues to be
derived from lifecycle.

| Lifecycle | Allowed declared mode | Runtime behavior |
| --- | --- | --- |
| `live` | `workspace` or `controlled` | Can be resolved and activated, subject to existing checks. |
| `preview` | `controlled` only | Can be resolved and activated in controlled mode. |
| `declared` | None | Cannot launch, regardless of any stored mode. |
| `deprecated` | None | Cannot launch, regardless of any stored mode. |
| Missing or unknown | None | Fail closed. |

An absent, empty, unknown, or lifecycle-incompatible mode fails closed. A
decision object cannot supply a substitute for a missing or incompatible
Registry value.

This pairing does not change the independent `sessionManager.isLaunchable`
rule: its existing public/external launch check still requires `status: live`.
`controlled` is not an authorization bypass.

## Ownership and enforcement

- **Declaration:** workspace entries and the supported values are owned by
  `workspaceRegistry.js`.
- **Orchestration:** `workspaceOrchestrator.js` returns the Registry's
  `launchMode` as-is and sets `controlledAccess` from that declared value.
- **Activation:** `workspaceActivation.js` checks the Registry status and
  Registry `launchMode` as a pair. A mode on the decision alone is not
  authoritative.
- **Administration:** the launch-mode selector shows only Registry-supported
  values compatible with the selected lifecycle. Closed or unknown lifecycle
  entries cannot be edited into a launchable mode. Registry service writes
  reject unsupported or incompatible modes.

## Explicit exclusions

- No authorization policy or permission check is changed.
- No lifecycle or visible workspace record is changed.
- `availability` remains derived and is not stored as launch mode.
- External routing remains separate from the `location` classification.
- `automatic`, `manual`, and `hidden` are not supported launch modes and are
  not active admin options. The former badge labels had no runtime consumers
  beyond the badge display; no runtime behavior depended on them.
- Projection remains disconnected from runtime.

## Regression coverage

Frontend tests cover registry declarations, orchestration without derivation,
the lifecycle/mode compatibility matrix, fail-closed missing values, and
mutations that change a `preview` workspace to `workspace` mode or remove its
declared mode.
