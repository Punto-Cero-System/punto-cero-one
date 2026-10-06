# One Core Readiness

**Fecha:** 2026-10-03

**Estado global:** **PARTIAL** — base funcional de producto One existente;
contratos, ownership y separación para Core transversal todavía incompletos.

**Identity materialization:** **BLOCKED — NOT READY**.

**Esta tabla no declara verticales activadas ni cambios de lifecycle.**

## Estados

- **READY:** capability/contrato ya demostrado para el scope descrito; no
  significa que toda la arquitectura target esté cerrada.
- **PARTIAL:** existe una implementación o contrato parcial con gaps/deuda.
- **BLOCKED:** no avanzar al uso descrito hasta resolver dependencia explícita.
- **DEPRECATED:** existe señal de legacy/mirror no recomendado; no retirar sin
  migrar callers.
- **FUTURE:** no se ubicó implementación runtime en el source audit.

## Matriz de módulos y dependencias

| Módulo | Readiness | Identity | Workspace | Billing | Darwin | Legal | Medical | Evidencia / bloqueo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cuenta/auth One | **READY** para cuenta local existente | No para auth One; sí para linking cross-system | Indirecta para navegación | No | No | No | No | One tiene user/session flows. Cambios a login/JWT fuera del Core Evolution. |
| Identity Reference / Identity Authority | **BLOCKED** | Core capability misma | Access Bridge consumidor | No | No | Sí para link futuro | Sí para link futuro | Authority lógica propuesta System Core, owner operativo sin decisión; no materializar. |
| Workspace Registry backend | **READY** como Registry/contract actual; integración global PARTIAL | No para metadata, sí Bridge subject actual | Propio | No | No | Sí para workspace access | Sí, pero status unchanged | Registry y contratos existen; frontend mirror drift y no proyección conectada. |
| Workspace Projection consumers | **BLOCKED** para conexión runtime | No | Propio | No | No | Indirecto | Indirecto | Snapshot contract existe, pero expresamente no se conecta al runtime en esta fase. |
| User Context composite | **PARTIAL** | Nullable ref depende de Identity | Sí | Suscripción futura | Gateway flags IA opcional | Adapter actual parcial | Aún no integrado | Context fields distribuidos en Auth/Community/Bridge/Preferences/Core Legal. |
| AuthContext / CommunityAuthContext | **PARTIAL** | No para login; access context sí | Sí para selector/context | No confirmado | No | Core Legal context fetch | No | Dos contextos/sesiones de auth distintos; no fusionar sin decision de auth. |
| Preferences | **PARTIAL** | No | Workspace layout prefs | No | No | No | No | UIPreferences y WorkspaceContext guardan scopes diferentes. |
| Notifications | **PARTIAL** | No para envío local; cross-system recipient ID puede depender | Indirecta | No | No | Posible consumer | Posible consumer | Routes/service/fanout existen en One; universal visibility contract no identificado. |
| Feed | **READY** para producto One existente; **FUTURE** como servicio universal | No local; identity para federation/dedupe | Hosted in community Workspace | No | No | No | No | Feed routes/engine exist; audience and data are One-specific. |
| Community / groups / follows | **READY** como feature One; no universal Core | No para local operation | UI shell/workspace prefs | No | No | No | No | Routes/context/models exist; not a mandatory Core capability. |
| Search | **PARTIAL** para One product | Identity for cross-domain person dedupe | May navigate workspaces | No | No | Search permissions required | Search permissions required | Search routes and UI exist; federation/privacy per-source missing. |
| Directory | **PARTIAL** | Yes for cross-system canonical people only | Indirect | No | No | Legal record owner | Medical professional owner | Company/profiles discovery exists; no unified authorized directory contract. |
| Files / media / documents | **PARTIAL** | No local | Indirect | No | No | Domain ACL/retention | Clinical ACL/retention | Object storage/media/document routes exist; universal gateway/retention contract absent. |
| Calendar / Events | **PARTIAL** for One events; **FUTURE** as common calendar | No local | May be workspace feature | No | No | Legal calendar domain | Clinical appointment domain | Event routes/UI exist, but no shared calendar abstraction. |
| Messaging / realtime | **PARTIAL** for Community | Identity only if federation | Workspace placement only | No | No | Own permissions if consumed | Own permissions if consumed | Messaging/realtime routes and frontend context exist; domain graph is One-specific. |
| Activity Stream | **PARTIAL** | Identity audit separate | Indirect | No | No | Event source could publish | Event source could publish | activities, reader, consumers exist; no unified cross-domain visibility spine proven. |
| Audit | **PARTIAL** | Identity audit contract/service exists, authority/ops incomplete | Workspace audit not unified | Billing audit external | AI audit external | Legal retains audit | Medical retains audit | Several event/audit systems; no common append-only platform owner proven. |
| Feature Flags | **FUTURE** | No | No; must not replace lifecycle | No | Could gate service, not grants | No | No | No general feature flag service located. |
| Settings | **PARTIAL** per One scopes | No | User layout settings separate | Billing settings external | Darwin settings external | Vertical settings owned by Legal | Vertical settings owned by Medical | UI/profile preferences exist; domain settings remain separate. |
| Billing Gateway | **FUTURE / BLOCKED** for live integration | Identity only if account correlation required | May expose products, not access policy | Required owner | No | Per-domain mapping | Per-domain mapping | No Billing runtime/API found in audited One source. |
| Darwin IA Gateway | **FUTURE / BLOCKED** for live integration | Optional | No | No | Required owner/contract | May be optional | May be optional | No dedicated Darwin gateway found; external Core reference is not integration. |
| Workspace User/Vertical Contracts | **READY** as design docs; **PARTIAL** as runtime | Nullable only | Yes | Optional ref unbound | Optional gateway unbound | Bridge adapter partial | No vertical context integration | Conceptual contracts created; not DTOs/runtime. |
| Professional / Organization / Agent context | **PARTIAL** (Agent **FUTURE**) | Cross-domain profiles require Identity | Registry currently does not define separate canonical workspaces for these types | No | No | Legal owns firms/roles | Vertical owns credential | One signals/heuristics and companies exist; standalone universal context incomplete. |
| Analytics / admin platform | **PARTIAL** | Usually no | Admin workspace not user access source | No | No | Not delegated | Not delegated | Admin/analytics routes exist; privileged One operation, not reusable vertical Core. |

## Ready scope

- Continue One-local feed, community, profile, company and preference work under
  existing contracts/permissions.
- Continue architecture/contract design of User Context and Workspace
  consumers; do not wire projection or create membership.
- Use current Legal adapter for its existing frontend-context normalization
  only; no entity link or Legal Core changes.
- Treat registry, routes and services as existing One/System implementation,
  not proof that a reusable hosted Core service already exists.

## Blocked scope

- Automatic `entity_id` creation, federation, dedupe, and universal
  user↔workspace membership.
- Runtime use of frontend Workspace Projection before consumer migration
  approval; also activation decisions while Medical drift remains unresolved.
- Live Billing/Darwin gateway integration without owner and contracts.
- Global notifications, messaging, audit, files, search or directory exposing
  cross-domain data absent visibility and data-owner approvals.
- Enabling new verticals from frontend mirrors or generic account types.

## Readiness conclusion

One has a **PARTIAL Core foundation**, not yet a fully reusable multi-vertical
Core. Reusable building blocks exist, but several are One-coupled, duplicated
or only conceptual. The safe next phase is to freeze the minimum Core contract,
assign owners per module and run consumer-by-consumer design; do not extract,
connect, activate or migrate runtime in this phase.

## References

- [ONE-CORE-ARCHITECTURE.md](./ONE-CORE-ARCHITECTURE.md)
- [ONE-CORE-MODULE-REGISTRY.md](./ONE-CORE-MODULE-REGISTRY.md)
- [ONE-CORE-BOUNDARIES.md](./ONE-CORE-BOUNDARIES.md)
- [ONE-EVOLUTION-MIGRATION-ROADMAP.md](./ONE-EVOLUTION-MIGRATION-ROADMAP.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
