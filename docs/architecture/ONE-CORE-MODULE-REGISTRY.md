# One Core Module Registry

**Estado:** Inventario arquitectónico basado en lectura estática de frontend
`frontend/src` y backend `backend/routes`, `backend/services`, modelos y
composición en `server.py`. No es un registro runtime ni cambia ownership.

## Criterios

- **Owner:** ownership observado/propuesto; `pendiente` significa que el código
  no demuestra al responsable operativo final.
- **Reutilizable:** posibilidad de contrato cross-vertical sin compartir
  semántica de dominio.
- **Acoplado:** dependencias en stores, contextos, catálogos o producto que
  impiden tratarlo como módulo independiente ahora.
- **Experimental:** parcial, espejo, placeholder, transición o integración no
  verificada; no implica que se deba borrar.
- **Reemplazable:** podría sustituirse detrás de contrato, no recomendación
  inmediata de reescritura.
- Los paths listados son ejemplos representativos auditados, no enumeración de
  cada import/caller.

## Registro de módulos

| Módulo | Owner | Dominio | Dependencias observadas | Reutilizable | Acoplado | Experimental / incompleto | Reemplazable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API composition / app bootstrap | One backend | Plataforma/app | FastAPI, routers, Mongo app state, startup indexes/seeds | Parcial | Alto: monolito y DB compartidos | No es servicio Core independiente | Sí, por módulos/servicios solo con contratos y rollout |
| One account/auth | One | Auth/account | `users`, password/provider, email, sessions, JWT/cookie, backend auth | La autenticación es de One; el patrón no es identidad universal | Alto: rutas, DB, providers, contexts | Dual JWT y cookie/session contracts | Reemplazable por provider manteniendo `users.id`/compatibilidad; no en esta fase |
| Frontend AuthContext | One frontend | Sesión JWT, system/access context | `/api/auth/me`, `/api/auth/system-context`, Access Bridge | Parcial (contrato a componer) | Alto: env vars/localStorage/API shape | Opcional contexts tolerantes a fallo | Sí como implementación, no fusionar auth |
| CommunityAuthContext | One frontend | Sesión community | Cookie, community auth service | Community reutilizable como producto | Alto: providers y cookie context | Convive con JWT AuthContext | Sí, tras decisión de auth; fuera de scope |
| Identity Core (context resolver) | One backend actual; autoridad operativa pendiente | Contexto One / sesiones | `users`, cookie/JWT, companies, mirrors workspace | Parcial como resolver read-only | Alto: consulta DB One y catálogos espejo | Deriva verticales y org context | Sí detrás de contexto versionado; no mover ahora |
| System Identity / Identity Registry | Lógico: System Core propuesto; operacional: pendiente; implementación: One | Identidad transversal | Mongo `system_identities`, source registry, Access Bridge | Sí como capability cross-system objetivo | Muy alto hoy: implementación y DB One | Writer functions existen; auto-materialización no encontrada, readiness blocked | Servicio/topología puede cambiar; IDs/mappings no reemplazar/borrar |
| Access Bridge / Policy | Policy owner de permisos; API implementada en One backend | Workspace access / intents | `entity_id` resolution, entitlements, policy, Workspace Registry, DB | Contrato reusable | Alto: route tiene I/O DB; bridge service mantiene intents | Bridge route y service tienen fronteras de IO distintas | Sí con API estable y staged migration; no en fase actual |
| Workspace Registry backend | System/Workspace governance, operación owner pendiente | Workspace config/lifecycle | Registry data, Policy, Access Bridge, projection generator | Alto como contrato transversal | Medio: consumers frontend mirrors | Frontend lifecycle drift; projection no conectada | Sí, consumers migrables gradualmente |
| Workspace frontend mirrors/catalogs | One frontend; fuente backend es autoridad efectiva | Navegación, lifecycle, launch, UI | `workspaceRegistry`, `workspaceCatalog`, `workspaceSpaces`, orchestrator, tests | Parcial | Alto: múltiples mirrors/semánticas | Drift backend Medical declared vs frontend preview/enabled | Sí después de migración consumer-by-consumer |
| Workspace user preferences | One | Layout/widgets/preferences | `/api/workspace/me`, Mongo user key, presets/localStorage | Reusable como preference capability | Medio: community cookie and One layout presets | “identity” de layout es UI preference | Sí como storage implementation, no como access membership |
| User Context composition | One frontend/backend consumers; future owner TBD | User / workspace / vertical context | Auth, system context, bridge, Legal adapter, preferences | Alto como contract | Alto en estado actual (split contexts) | Envelope conceptual; no unified DTO | Sí, compositor substituible; never replace domain owners |
| Preferences | One | UI appearance, workspace layout | `UIPreferencesContext`, profileService, WorkspaceContext/service | Alto solo para presentation prefs | Medio: two separate stores/scopes | No single preference model | Sí por adapters/storage, preserving scope |
| Profile / professional profile | One for One profile; vertical owner for verified credentials | Account/profile | `users`, profile routes/service, media | Partial; references reusable, profile data not globally | Alto: One fields drive heuristics | Signals not professional registry | Reemplazable only by domain service; keep One profile ownership |
| Organization / company | One owns current `companies`; Legal owns Legal orgs/tenants | Organization domain | `companies`, owner/team `user_id`, auth | Relationship pattern reusable | Alto: DB One and local user IDs | Local measured owner references unresolved against small cohort | Implementation replaceable; domain ownership stays scoped |
| Agent context | Owner TBD | Agent/operations | `agent` role and placeholder `/agent`; systemEntryRules | Potentially | High, no standalone entity/workspace found | Incomplete / placeholder | Likely replaceable after requirement, not delete now |
| Feed / social stream | One | Community/content product | feed routes/engine, visibility, Mongo posts/users, content sources | Partial patterns; not universal dependency | High: One data/visibility/community | Multiple feed/source components | Replaceable behind feed contracts |
| Community / groups / follows | One | Social/community | user sessions, groups, follows, profile, notifications, realtime | Optional product capability | High: One-specific graph and semantics | none asserted for product | Replaceable per service; not move to mandatory Core |
| Search / discovery / directory | One product; record owners vary | Search/discovery | search routes, discovery resolver/seeds, content sources, profile/company data | Gateway/transport reusable | High: indices/source shapes/domain visibility | Discovery has seed/source pipelines; not universal entity directory | Replaceable with per-domain adapters |
| Files / media / documents | One routes/service; underlying storage provider owner TBD | Files/content | object storage, PDF, company/profile media, document routes | Storage gateway reusable | Medium/high: One paths and ACL | external storage config not established as common platform | Replaceable by storage adapter; metadata/ACL remain domain-owned |
| Notifications | One | Notifications/delivery | notification routes/service, fanout consumers, realtime, user records | High as channel infrastructure | Medium: community user IDs, payload schemas | Cross-domain notification contract not demonstrated | Replaceable behind delivery contract |
| Messaging / realtime / presence | One community | Communications | messaging routes, realtime routes/service, `RealtimeContext`, session | Transport may be reused | High: One session, membership and DB | No cross-vertical authorization contract | Replaceable behind transport; conversation ownership stays domain |
| Calendar / events / jobs | One product/domain owners | Events/scheduling/jobs | event/job routes, user/company, UI pages | Calendar transport optional | High: product event/job schemas | No common calendar abstraction confirmed | Replaceable; preserve domain schemas |
| Audit / activity | One platform/feature today; shared governance TBD | Events/audit/activity | analytics, `activities`, `identity_audit`, activity consumers/reader, Mongo | Event envelope reusable | High: multiple event vocabularies/stores | Identity audit tests/service exist; no unified audit spine proven | Replaceable only with event/data migration contracts |
| Feature flags | Owner TBD | Platform config | No general user-context flag service located in audited source surfaces | Potentially reusable | N/A | Future / no verified module | Implement behind separate design only |
| Settings | One for account/UI; verticals for domain | Configuration | UI preferences, Workspace layout, profile settings | Partial by scope | High if flattened | No global settings service | Replaceable by scoped adapters |
| Billing | Billing Core owner external / integration not located | Subscription/payment | No Billing route/service consumer confirmed in audit | Gateway optional | Not integrated in audited runtime | Future / not verified | Gateway replaceable; payment ledger remains Billing owner |
| Darwin IA Gateway | Darwin Core external; gateway owner pending | AI access/policy | No dedicated Darwin gateway found in audited source surfaces | Potentially reusable optional gateway | Not integrated/contracted here | Future | Replaceable connector; models/data policy stay Darwin/domain owners |
| Analytics / admin | One platform admin | Operations/metrics | analytics routes/service, admin routes/pages, DB One | Selective | High: privileged One/admin user model | Analytics source coverage may vary | Replaceable; admin grants not a vertical API |
| Growth / source connectors | One product | Content ingestion/discovery | growth services, RSS/content sources, schedulers | Connector patterns reusable | High: provider-specific config and One content model | Source freshness/connector health varies | Replaceable per provider adapter |
| UI design system / widgets | One frontend | Presentation/layout | shared UI components, widget registry/context | UI primitives reusable | Low for primitives; high for One widgets | Widget catalog is not Workspace Registry | Replaceable per component; widget registry must not be conflated with Workspace |

## Audit coverage

- **Frontend:** `frontend/src` inventory (267 source files in glob inventory)
  across app/pages, components, contexts, services, system, config, admin,
  hooks, UI and styles. Search covered account/context/workspace/org/profile/
  agent/preferences/notification/feed/search/files/calendar/messaging/
  billing/Darwin concepts. This is a static source audit, not a runtime usage
  telemetry report.
- **Backend:** 33 route files and 24 service files enumerated, plus model and
  app composition surfaces. `server.py` mounts the current routers for auth,
  community, content, company/profile, jobs/events, notifications, messaging,
  search, admin, widgets, workspace, discovery, groups, activities and Access
  Bridge.
- **No use proof:** absence of a dedicated runtime module in these source
  surfaces is reported as “not located/unknown”, not proof that no external
  service exists.

## Ownership decisions that remain open

- Operational owner/deployment of System Identity.
- One Core vs System Core responsibility for the shared context compositor.
- Shared notification/activity audit retention and cross-domain visibility.
- Billing/Darwin gateway owners and supported contracts.
- Organization/professional/agent context owners outside current One data.
- Multi-country LATAM residency, privacy, support and compliance model.

## Related

- [ONE-CORE-ARCHITECTURE.md](./ONE-CORE-ARCHITECTURE.md)
- [ONE-CORE-BOUNDARIES.md](./ONE-CORE-BOUNDARIES.md)
- [ONE-CORE-READINESS.md](./ONE-CORE-READINESS.md)
