# Identity Lifecycle Contract

## Status and scope

Conceptual contract for the future System Identity lifecycle. It is subordinate
to [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md) and does not
introduce runtime states, database fields, events, API changes, or policy
behavior. Existing account `status`, Workspace lifecycle, LaunchMode, and
authorization are independent axes and remain unchanged.

## Identity versus profile link

An **Identity** represents one person and owns one immutable `entity_id`.
A **Profile Link** associates an identity with an external system's native
identifier:

```text
Identity(entity_id, lifecycle state)
  └── ProfileLink(source, external_id, link state, evidence reference)
```

Organization IDs, workspace keys, provider IDs, authentication channels, and
emails are not person identities. A company/firm owner relationship is modeled
as a separate domain relationship, not as an identity profile.

## Conceptual identity states

These are proposed states for System Identity only. They are not currently
persisted and must not be confused with `users.status`, Workspace lifecycle,
or `identity_registry` System states.

| State | Meaning | Permitted transition |
| --- | --- | --- |
| `pending` | Identity creation or required evidence is incomplete; no definitive person resolution is available. | `active`, `conflicted`, or `revoked` by authorized action. |
| `active` | Canonical identity is valid and resolvable; does not itself grant any access. | `suspended`, `conflicted`, or `revoked`. |
| `suspended` | Identity resolution is temporarily blocked pending review or security action. ID and links remain preserved. | `active`, `conflicted`, or `revoked`, with audited reason. |
| `conflicted` | Multiple possible identities/links or integrity inconsistency requires adjudication. No automatic merge. | `active` after explicit resolution, or `revoked` if invalid. |
| `revoked` | Identity has been permanently retired from new resolution/association. Terminal; preserve ID as a tombstone and never reuse it. | None. |

**Availability/authorization boundary:** `active` means the identity record
can be resolved according to this contract; it does not mean the account is
active, a workspace is available, a membership exists, or access is allowed.
Consumers must continue to use their existing account and authorization
contracts.

## Profile-link states

Links have their own state so that a single conflicting external profile does
not redefine or silently merge people:

- `pending`: source/profile evidence has been received but not accepted.
- `verified`: authoritative link has been validated and is resolvable.
- `conflicted`: the same `(source, external_id)` is claimed by multiple
  identities or verification is contradictory.
- `revoked`: the link is no longer valid for new resolution; preserve its
  audit history.

The exact values and persistence schema remain conceptual until separately
approved. A verified link must be unique per `(source, external_id)`.

## Creation

1. The source system first persists its own native principal and stable
   external ID.
2. An authorized request to Identity System carries the registered `source`
   and `external_id`, with only the minimal metadata needed for audit.
3. Identity System idempotently returns the existing identity for an already
   verified source reference, or creates an identity with `pending` state
   while evidence/eligibility remains unresolved.
4. After the source-specific proof threshold is met, the identity/link may
   transition to `active`/`verified`.
5. Creation of an identity or profile link never creates a workspace
   membership or entitlement by implication.

The proof threshold for One registrations, unverified email accounts, social
accounts, and unaccepted invitations is a **DECISIÓN PENDIENTE**. No such
event is implemented under this contract.

## Linking and conflict handling

- A new source profile may be linked only after the source is registered and
  the identity proof is sufficient.
- Email equality is a collision signal at most; it is never standalone
  evidence for linking or merging.
- If a source profile is already verified for the same identity, retries are
  idempotent.
- If it is claimed by another identity, mark/route to conflict handling; do
  not move it, merge identities, or select the first result automatically.
- Merge/split requires an explicitly authorized adjudication with evidence,
  reason, actor, and before/after references. It is not defined as a normal
  lifecycle transition here.

## Suspension and revocation

- Suspension preserves `entity_id` and all historical links but blocks
  canonical resolution according to a future consumer contract. It is
  reversible only through an authorized, audited decision.
- Revocation is terminal. Preserve a tombstone sufficient to prevent ID reuse
  and to explain prior links; minimize retained personal data according to a
  separately approved retention policy.
- Neither transition rewrites source-system user IDs, JWTs, Legal records,
  organizations, or workspace lifecycle.
- This proposal does not change the existing Bridge's identity validation or
  any policy decision. A future implementation must explicitly specify which
  service reports a suspended/revoked state and how callers behave.

## Audit requirements

Every attempted state transition or profile-link change should have an
append-only audit record containing:

- operation and outcome (`created`, `already_linked`, `pending`, `conflict`,
  `suspended`, `revoked`, `rejected`);
- source system and a protected/reference form of `external_id`;
- actor/service identity and correlation/idempotency key;
- timestamp, reason/evidence reference, and prior/next states;
- canonical IDs affected, without using email as an identity key.

Audit records must not expose credentials, access tokens, or unnecessary
personal data. Failure to write the required audit record must not be returned
as a success-shaped identity transition.

## Rollback (conceptual)

- Roll back activation by disabling the new producer/consumer path and
  returning consumers to their pre-activation behavior where that behavior is
  still safe and explicitly supported.
- Never delete/recycle an issued `entity_id` as a rollback mechanism. Preserve
  created IDs and links for reconciliation and audit.
- Do not reverse a completed identity merge automatically; merge/split is an
  adjudicated identity operation, not deployment rollback.
- Keep login, JWT, source user IDs, Legal records, authorization and stored
  relationships unchanged during a first materialization rollout.
- A failed or partial synchronization is reported as unresolved/pending and
  retried idempotently. No email, `users.id`, or random fallback may be
  presented as the canonical ID.

## Decisions intentionally pending

- Eligibility/proof point for each source, including new One registration and
  invitations.
- Physical service/store ownership boundary, transport, availability, and
  outbox/retry mechanism.
- Whether suspension/revocation are needed in the first implementation and
  their operational actors.
- Retention and privacy rules for revoked links and audit evidence.
- How Legal Core establishes proof and registers a source without changing its
  own identity or authorization.
- Whether identity adjudication supports merge/split and its approval
  authority.
