# One Identity Contract

## Status

Conceptual target contract for Punto Cero One. This document does not define
database migrations, HTTP changes, new runtime models, or authorization
behavior. Existing login, JWT/cookie sessions, Legal Core, memberships, and
workspace access remain unchanged until separately scoped.

## Core relationship

```text
User ──< WorkspaceMembership >── Workspace
  │
  └── has one or more Profiles / authentication identities

Organization is a separate domain entity.
Roles are scoped to a relationship or domain.
Entitlements and policy decide authorization.
```

## Conceptual entities

### User

The person-level identity within Punto Cero One. The target identifier is a
stable, immutable canonical `entity_id`, independent of email, login provider,
workspace, and organization. A person exists once even when they use several
workspaces.

During compatibility, existing `users.id` values remain stable references to
One-owned records. They are not to be replaced by `entity_id` without an
explicit migration plan. Email is a contact/verification attribute, not a
cross-system identity key or automatic account-merge proof.

### Profile and authentication identity

A profile holds attributes needed by an owning product or domain. Credentials
and provider identities prove how a session was authenticated; they are not
the user identity itself. Multiple verified authentication profiles may refer
to one User only through an explicit, auditable linking flow. A conflicting
or unproven link must remain unresolved rather than being merged by email.

One currently stores community profile fields and authentication-provider
references in the `users` record. Keeping those fields together is a
compatibility fact, not a requirement that future profiles or credentials be
stored there.

### Workspace

A product space identified by a stable Registry key. Workspace lifecycle,
availability, LaunchMode, and location describe the workspace contract; none
of these fields identifies a person or by itself proves a user's membership.

### WorkspaceMembership

An explicit relationship between one User and one Workspace. It is distinct
from:

- user profile or login credentials;
- organization ownership or organization membership;
- community group membership;
- personal dashboard layout preferences;
- workspace lifecycle/availability;
- entitlement and authorization decisions.

A membership may carry relationship-scoped attributes such as an assigned
workspace role and relationship state, subject to a later approved schema.
This contract does not prescribe their persisted field names or values. A
membership's existence must not grant access unless a separately defined
policy explicitly uses that relationship as an authorization input.

The conceptual cardinality is many-to-many: one User may have memberships in
multiple Workspaces, and a Workspace may relate to multiple Users.

### Organization

A business or legal entity with its own stable identifier and lifecycle.
Organization ownership/team relations are organization-scoped and are not
workspace memberships. A user can relate to multiple organizations; an
organization can have multiple users. A policy may later use a specific
organization relation to derive an entitlement, but the organization role
must not be treated as a global User role.

### Role

A capability/assignment scoped to its owning domain (for example platform,
organization, group, workspace, or Legal Core). Roles are not global identity
attributes and do not automatically grant a workspace. Existing backend
policy already excludes the One `users.role` value as a direct source of
workspace access.

### Entitlement and authorization

An entitlement is a policy input or granted right; authorization is the
decision to perform an action. Both remain separate from identity and
membership. The existing Access Bridge/Policy path remains authoritative for
workspace access; this conceptual contract does not change it.

## Guarantees expected of a future implementation

1. One person has at most one canonical User identity within the governed
   identity namespace.
2. One User can have multiple explicitly represented WorkspaceMemberships.
3. Authentication/provider profiles can be linked to a User only through
   verified, auditable rules; email equality alone is insufficient.
4. Organization membership, group membership, and workspace membership are
   distinct relationships with domain-scoped roles.
5. Workspace key and canonical person ID are stable references; display name,
   email, and role are not identity keys.
6. A missing, ambiguous, or conflicting identity link fails closed at the
   relevant bridge; it is never silently converted into a new identity or
   access grant.
7. Existing `users.id`, JWT claims, cookie sessions, Core Legal IDs, and
   domain-record foreign keys remain compatible until a separately planned
   migration.
8. Membership alone does not change lifecycle, availability, LaunchMode,
   location, entitlement, or permission outcomes.

## Compatibility with the current repository

| Current construct | Contract interpretation | Compatibility requirement |
| --- | --- | --- |
| `users.id` | Existing One-native user/profile identifier | Preserve as the key used by current sessions and One records during transition. |
| `system_identities.entity_id` | Canonical identity foundation | Keep distinct from `users.id`; projection and population require an explicit lifecycle. |
| `users.auth_providers[]`, `password_hash` | Authentication profiles/credentials | Keep existing login and linking behavior; do not treat provider IDs as workspace membership. |
| `companies.owner_id`, `companies.team[]` | Organization relation | Preserve company ownership/team semantics and their scoped roles. |
| `group_members` | Community group membership | Preserve group-scoped access/moderation semantics. |
| `user_workspaces` | Personal layout/preferences | Never reinterpret it as a WorkspaceMembership store. |
| `workspace.open.<key>` and Access Bridge | Authorization/entitlement path | Keep the current backend policy as the access authority. |
| Legal Core `user_id_core`, tenant/firm/org IDs | External Legal-owned identifiers | Preserve Core ownership and IDs; do not merge, rewrite, or copy Legal records into One as part of this contract. |

## Legal Core compatibility

Punto Cero Legal remains the first vertical expected to interoperate with One,
not the owner of One's universal identity schema. The existing frontend bridge
reuses the current token and adapts Legal context for presentation/routing.
That is not a durable person-link contract.

A later integration must establish a separately auditable mapping from the
canonical User to the Legal Core's native user reference, preserve Legal
authorization and tenant boundaries, and leave cases, clients, billing, and
other Legal-owned records in Legal Core. No Core identifier should be inferred
from email, role, workspace key, or organization label.

## Decisions intentionally deferred

- How existing One users are projected/backfilled into canonical identities,
  including how to handle unprojected users and any duplicate/conflicting
  records.
- How a verified Legal Core identity is linked to a One User and who owns that
  mapping.
- Which organization relationships, if any, can create a workspace
  entitlement.
- Whether any paid subscription creates or changes a membership; billing is
  not modeled in the current One backend.
- The persisted membership fields, relationship states, invitation flow, and
  lifecycle.
- Whether current company/group membership records are later represented as
  links to the same canonical User.

These questions must be resolved before migration or authorization behavior
changes. They do not block the conceptual separation defined here.
