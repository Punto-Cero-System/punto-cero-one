# One Core Migration Plan

**Estado:** Plan maestro conceptual; no autoriza runtime migration, consumer
migration, projection wiring ni vertical activation.

## Principios

- Versionar contratos antes de extraer código.
- Seguir owner de cada dato/permiso; no convertir “Core” en owner de todo.
- Migrar consumidor por consumidor y conservar behavior/rollback.
- No modificar login/JWT, Identity, Billing, Legal, Medical, Registry lifecycle
  o LaunchMode mientras no esté aprobado por su carril.
- No duplicar writers o sources of truth durante extracción.
- No aceptar una fase como cerrada sin evidence de parity y rollback.

## Fase 1 — Congelar Core

**Objetivo**

- Acordar definición mínima: User Context, Workspace contract, referencias,
  preferencias, access boundary y extensiones opcionales.
- Confirmar clasificación Core permanente/opcional/vertical.
- Asignar owner actual y propuesto, soporte, versioning y lifecycle de cada
  módulo registrado.
- Resolver como decision/documentation los conceptos ambiguos; mantener
  bloqueado cualquier módulo sin owner.

**Riesgos**

- “Congelar” puede codificar decisiones de Identity/Billing/Legal pendientes.
- Envelope monolítico puede juntar PII, permisos y perfil vertical.
- Contratos existentes de Registry/frontend difieren, particularmente Medical.

**Rollback**

- La fase es documental: retirar/revisar ADR/contract draft versionados; no
  hay runtime/data rollback.

**Criterios de aceptación**

- Arquitectura, module registry y boundaries aprobados por domain owners.
- Cada campo tiene source, audience, purpose, optionality y error semantics.
- Matriz explícita de capacidades bloqueadas/futuras.
- Sin decisión tácita de owner operativo Identity o activación vertical.

## Fase 2 — Extraer módulos reutilizables

**Objetivo**

- Seleccionar un módulo low-risk y vertical-neutral por piloto (preferencias
  UI/configuración read-only u otro aprobado).
- Definir interface/adapter y boundaries antes de mover código.
- Mantener providers, store y API existentes durante shadow/compatibility.

**Riesgos**

- Tight coupling a Mongo/app state, env config y user session.
- Semantics/ACL implícitas se pierden al extraer.
- Cambios de latencia/disponibilidad o error que afectan login/UX.

**Rollback**

- Feature flag/caller switch de vuelta al implementation anterior.
- Mantener data model/IDs compatibles; no dual write salvo mecanismo
  explícitamente diseñado y reconciliable.

**Criterios de aceptación**

- API contract tests, parity tests y failure-mode tests verdes.
- Dependencias/domain data no cruzan boundary no aprobada.
- Metrics, owner, on-call/SLO and rollback rehearsal definidos antes rollout.

## Fase 3 — Eliminar duplicaciones

**Objetivo**

- Identificar duplicated registries, permission derivations, auth context
  projections y event vocabularies con evidencia de todos los callers.
- Seleccionar source of truth por campo; migrar users antes de retirar mirror.
- Mantener widgets registry distinto del Workspace Registry.

**Riesgos**

- Drift silencioso de status, route, `available_spaces` o permisos.
- Retirar mirrors todavía usados por rutas legacy o external verticals.
- Confundir duplicate representation con separación deliberada de domains
  (JWT vs cookie sessions; UI prefs vs workspace layout).

**Rollback**

- Volver consumer al mirror/API anterior mediante flag/versioned artifact.
- Retener old code/data hasta pasar deprecation window; no borrar preferencias
  ni rewrite IDs.

**Criterios de aceptación**

- Import/caller inventory completo y deprecation sign-off.
- Contract tests prueban parity entre canonical source y migrated consumer.
- Negative tests prueban que frontend/context no crea permissions.
- No cambia lifecycle/launchMode/Location ni Auth/Identity behavior fuera de
  scope.

## Fase 4 — Registrar módulos oficiales

**Objetivo**

- Publicar One Core Module Registry con owner, contract version, support tier,
  consumers, data classification, SLO, lifecycle y replacement path.
- Marcar explícitamente `official`, `optional`, `vertical-owned`, `future` o
  `deprecated`; readiness técnico separado de status de producto.
- Establecer onboarding review para nuevas capacidades y verticals.

**Riesgos**

- Registro se vuelve catálogo nominal sin operación/SLAs.
- “Oficial” se interpreta como permiso de uso o soporte sin owner.
- Dependencias opcionales se convierten en mandatory.

**Rollback**

- Revocar/retirar versión de module registry y regresar caller a contrato
  soportado; mantener compatibility period.

**Criterios de aceptación**

- Cada entry tiene owner aceptado, scope, contract/test, data/access boundary,
  status y deprecation policy.
- Módulos sin evidencia quedan `FUTURE`/`BLOCKED`, no “core” por ubicación.

## Fase 5 — Activar nuevas verticales

**Objetivo**

- Integrar Legal/Medical y futuras verticales por owner, una a la vez, usando
  módulos Core aprobados y manteniendo sus modelos y policy.
- Validar primero contratos/sandbox/shadow; activar solo con decision
  independiente de lifecycle y producto.

**Riesgos**

- Cross-domain leakage, incorrect membership/entitlement, credentials
  unverified, data locality and country-specific compliance failures.
- Frontend Registry drift activa UI con backend lifecycle distinto.
- Identity o Billing no disponibles afectan vertical flow.

**Rollback**

- Disable integration/workspace entry using approved owner-controlled switch;
  revert consumer to previous route/contract.
- Preserve vertical data, native IDs and audit; no delete/re-map/revoke
  automatically.

**Criterios de aceptación**

- Domain owner, data classification, authorization, privacy/security and
  country review approved.
- Contract/negative tests, operational readiness, observability and rollback
  rehearsal complete.
- Identity links only if separate Identity readiness gate is `READY`.
- Billing/Darwin gateways only if their owners/contracts/SLO are ready.

## Gates transversales

1. No shared Core capability without named owner and consumer contract.
2. No source-of-truth replacement without inventory and parity period.
3. No auth/permission decisions in presentation-only contexts.
4. No data copied across domains merely to simplify user context.
5. No activation from labels, route or frontend mirrors alone.
6. No Identity materialization while its operational authority remains
   **BLOCKED — NOT READY**.

## Carril recomendado ahora

Cerrar **Fase 1 documental** con revisión de owners y aceptación del Core
mínimo. Después seleccionar un piloto de extracción de bajo riesgo basado en
evidencia. No empezar extracción ni consumer migration hasta decidir
operational ownership, contratos de fallos, permission authority y el
tratamiento del drift del Registry.

## Referencias

- [ONE-CORE-ARCHITECTURE.md](./ONE-CORE-ARCHITECTURE.md)
- [ONE-CORE-MODULE-REGISTRY.md](./ONE-CORE-MODULE-REGISTRY.md)
- [ONE-CORE-BOUNDARIES.md](./ONE-CORE-BOUNDARIES.md)
- [ONE-CORE-READINESS.md](./ONE-CORE-READINESS.md)
- [ONE-EVOLUTION-MIGRATION-ROADMAP.md](./ONE-EVOLUTION-MIGRATION-ROADMAP.md)
