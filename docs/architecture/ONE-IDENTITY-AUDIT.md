# One Identity Audit

## Scope and method

This is a read-only inventory of the identity, profile, organization, group,
workspace-access, and frontend-authentication surfaces currently present in
this repository. It does not change runtime behavior, authentication, policy,
Legal Core, or stored user data.

## Current model

### User and authentication

The One backend's persistent user record is `users`, keyed by the unique
`id`; `email` is also indexed uniquely. Both the JWT authentication routes
(`POST /api/auth/login`, `GET /api/auth/me`) and community authentication
(`backend/routes/community_auth_routes.py`) read and write this collection.
Community email/password and social-provider credentials are stored on the
same user record (`password_hash` and `auth_providers[]`), and social-provider
linking uses `(provider, provider_user_id)` rather than treating email alone
as proof of identity. The community flow creates `user_<random>` IDs; other
One users include UUID-shaped IDs. `user_sessions` stores cookie sessions by
`user_id` and `session_token`; JWTs use the same `users.id` as `sub`.

Consequently, the two One login surfaces can resolve to the same stored user
when their sessions point to the same `users.id`. They are distinct session
mechanisms, not two separate One user collections. When both sessions are
present, `/api/auth/system-context` compares their raw IDs and returns a
conflict (HTTP 409) if they differ; it does not merge accounts.

### Identity and profile

The `users` document is the current One identity record and also holds many
community profile attributes. `models_profile.py` describes profile fields,
while `/api/community/users/me` reads and updates the same `users` document;
there is no separate One profile collection in this flow.

The backend also contains a `system_identities` service and `Identity
Registry`. The service models a stable `entity_id` with references to source
profiles (`profiles[].source`, `profiles[].external_id`) and enforces
uniqueness of a source/external-ID pair through its index setup. This is a
canonical-identity foundation, not evidence that every existing user has
already been migrated or linked. `project_user_identity()` is read-only by
default and only creates a record when explicitly called with
`create_missing=True`. The production Access Bridge calls
`resolve_system_identity()` in read-only mode and fails closed when no valid
canonical identity is resolved. Do not assume the `system_identities`
collection is fully populated.

The implementation currently lives in this repository: the Access Bridge
routes resolve `system_identities` through the One backend's configured
database. `server.py` also invokes `system_identity.ensure_indexes()` during
startup. This creates/requests indexes only; it does not materialize identity
records. The ownership ADR now proposes System Core as the logical authority
and treats current local storage as transitional; physical ownership,
deployment, and service interface remain pending. Migration must establish
that operational boundary without silently changing the Bridge's fail-closed
behavior. See [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md).

`identity_core.resolve_identity()` is a separate read-only context projection:
it compares session `users.id` values, derives account type and verticals, and
resolves companies. It does not create a global identity or universal
membership. The Access Bridge combines that context with the canonical
`entity_id` lookup for its subject.

### Roles and authorization

`users.role` is a technical account/platform role (`member`, `admin`,
`investor`, and others in `models.py`); the entitlement service explicitly
does not grant workspace access from that role. Workspace entitlements are
derived from user verticals, resolved company organizations, account status,
and the applicable policy. The Access Bridge validates the canonical
`entity_id`, and `policy_can` evaluates the resulting subject and permission.
Authentication, profile role, organization role, and workspace authorization
are therefore separate concerns.

### Organizations and memberships

The current business organization-like entity is `companies`. A company has
an `owner_id` and a team array whose members can carry `user_id` and a
company-scoped `role`; `TeamMember.user_id` is optional in the model. Company
routes enforce owner/admin checks and identify a user's company relation by
those fields. `identity_core.resolve_organizations()` projects these records
as organizations for a user. This is an organization relationship, not a
general workspace-membership table.

Community groups use a separate `group_members` collection with `group_id`,
`user_id`, `role`, and `joined_at`; its roles and permissions are scoped to
group participation and moderation.

The `user_workspaces` collection is not membership: it persists a user's
personal “Mi Espacio” layout (panels, widgets, theme) and has a unique
`user_id` index. It does not record which product workspaces the user belongs
to. No universal `WorkspaceMembership` persistence model was found.

### Workspace access and subscriptions

The Workspace Registry defines workspace lifecycle and permission keys.
`identity_core` derives navigation context; the entitlement service derives
`workspace.open.<key>` rights; the Access Bridge and policy consume them.
Membership, lifecycle/availability, LaunchMode, location, and authorization
must remain distinct.

No One backend subscription or billing model/route was found in the reviewed
current backend. Billing is documented as an external Core capability in
`ONE-SYSTEM-BOUNDARY.md`; it is not represented here as a local membership.

### Punto Cero Legal Core boundary

The Legal Core is contacted through the separate workspace bridge, which
reuses the existing `pcl_token` and calls the Core API. The frontend's
`coreLegalContext.js` adapts Core fields such as `user_id_core`,
`workspace_id`, organization/tenant/firm references, role, and path into the
One-facing context shape. That adapter preserves the Core's destination and
IDs; it does not establish a persisted mapping between a Core user and a One
`users.id` or `system_identities.entity_id`.

Legal cases, clients, and other Legal Core records remain owned by that
separate system. This repository does not provide evidence for changing their
IDs, ownership, authorization, sessions, or persistence as part of this
identity foundation.

## Frontend consumers

| Surface | Current source / behavior | Identity implication |
| --- | --- | --- |
| `contexts/AuthContext.jsx` | JWT login, `pcl_token` / `pcl_user` local storage, `/api/auth/me`, system context, and Access Bridge context. | Uses the existing JWT session; does not mint or persist `entity_id` in the JWT. |
| `contexts/CommunityAuthContext.jsx` | Community auth service with the httpOnly cookie; loads the community user independently. | A second session state in the UI; backend can resolve its cookie to the same `users` document. |
| `services/profileService.js` | Cookie-authenticated community profile reads/updates. | Community profile attributes are served from the One user record. |
| `system/accessContext.js`, `accessBridgeEntry.js` | Normalize Bridge entitlements and available spaces; entry decisions consume server-provided access. | Frontend role is not used as an access grant. |
| `system/sessionManager.js` | Fetches Registry spaces and entitlements; requests access intents. | Manages launch/session state, not user-workspace membership. |
| `system/coreLegalContext.js`, `services/workspaceBridge.js` | Adapts Legal Core context and reuses `pcl_token` for Core API calls. | Maintains the boundary; no durable cross-system person link is created here. |
| Workspace/organization/group pages and services | Consume One user profile, company, group, and workspace-layout APIs. | These features use their domain-specific IDs/relationships, not a universal membership record. |

## Current entities and relationships

```text
One users.id
  ├── credentials: password_hash / auth_providers[]
  ├── profile attributes: same users document
  ├── user_sessions.user_id
  ├── companies.owner_id / companies.team[].user_id
  ├── group_members.user_id
  └── user_workspaces.user_id (layout preferences only)

One users.id ──optional, explicit projection──> system_identities.profiles[]
                                              └── entity_id

Legal Core user_id_core / organization / tenant / firm
  └── separate Core-owned identifiers; no persisted One mapping established here
```

## Problems and technical debt

1. **No persisted universal relationship model.** Company teams and group
   members are separate, domain-specific relations; neither means
   `WorkspaceMembership`.
2. **Identity projection coverage is not guaranteed.** The Bridge requires a
   valid `entity_id`, but the resolver used by the route is read-only and does
   not create missing identities. Existing and new users therefore need an
   explicit, safe projection lifecycle before universal access can be assumed.
3. **Two session mechanisms remain.** JWT and cookie sessions can refer to the
   same user but are held independently in the frontend and must not be
   silently reconciled when they point to different IDs.
4. **The canonical ID and local user ID are different concepts.** `users.id`
   remains the owner/reference used across current One collections; the
   `entity_id` is a separate canonical subject. Replacing one with the other
   would affect many references and the Bridge.
5. **Legal identity mapping is not durable here.** The Core adapter translates
   context vocabulary, but does not prove that a Core account and a One user
   are the same person.
6. **Role vocabularies are scoped and inconsistent by domain.** Platform
   roles, company roles, group roles, and Legal roles are not one transferable
   role.
7. **Workspace settings are easy to misinterpret.** `user_workspaces` refers
   to personal dashboard layout, not workspace membership.
8. **Billing is external to this backend.** A subscription-to-membership rule
   cannot be inferred or implemented from the local One domain model.

## Evolution recommendation

Treat the existing `users.id` as a stable One profile/legacy identifier during
transition and use a separately governed, immutable `entity_id` as the future
person-level identity. A person can then have multiple explicit,
workspace-scoped memberships without duplicating the person record. Preserve
company and group relations as distinct domain relationships, and preserve
Legal Core identifiers and data behind the existing bridge until a verified
cross-system link and migration plan exist.

Before runtime migration, inventory the existing identity projection
population and define explicit proof, conflict handling, backfill, rollback,
and ownership rules. Do not use email equality alone to merge identities.
Access must continue to be decided by the authorized entitlement/policy
contract; the existence of a membership or role must not silently become an
authorization grant. Billing-to-membership semantics and Legal Core linking
remain decisions for later phases.
