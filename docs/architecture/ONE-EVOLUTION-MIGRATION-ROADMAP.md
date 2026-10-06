# One Evolution — Migration Roadmap

**Estado:** plan de evolución; no autoriza migraciones automáticas ni cambios
funcionales.

## Reglas del roadmap

- Migración consumer-by-consumer; ninguna sustitución masiva de catálogos,
  sesión o permisos.
- Conservar `users.id`, login, JWT, sesiones, Access Bridge, policy, Billing y
  contratos Legal/Medical existentes salvo aprobación propia por fase.
- Construir primero contexto/contratos; Identity y sus escrituras permanecen
  fuera de este roadmap hasta aprobación operativa independiente.
- No abrir workspaces/verticales ni cambiar status por espejo frontend.
- Mantener un camino de rollback probado y métricas antes de cada cutover.

## Fase 1 — Centralizar el contrato y la composición de contexto

**Objetivo:** definir un envelope tipado y owners por campo, no consolidar datos
ni crear un servicio monolítico.

**Trabajo futuro**

- Acordar `WorkspaceUserContext` y `VerticalRequestContext` versionados,
  estados `loading/ready/partial/error` y semantics de absent/null.
- Mapear cada campo a fuente/owner, namespace, finalidad y audiencia.
- Crear un compositor read-only que consume fuentes existentes, solo después
  de aprobar el diseño; mantener autenticación por sus providers actuales.
- Distinguir cuenta/contexto Legal, Bridge entitlements, navegación, prefs y
  perfiles de dominio.
- Resolver contractualmente drift backend/frontend del Workspace Registry sin
  modificar status hasta decisión autorizada.

**Riesgo:** envelope con demasiados campos, mezcla de permisos con UI o
exposición de IDs/datos entre dominios.
**Dependencias:** aprobación de tipos/owners, contracts de workspace, error/cache
semantics y revisión de privacidad.
**Rollback:** feature flag/desconexión del compositor; consumers vuelven a
lecturas previas sin cambiar login/JWT/store.
**Aceptación:** source-of-truth por campo documentada; contratos prueban
namespaces y no grants implícitos; error de fuente opcional no invalida auth;
pruebas de compatibilidad de AuthContext, Bridge y Legal adapter pasan.

## Fase 2 — Migrar consumidores gradualmente

**Objetivo:** migrar primero consumidores de presentación y luego los que
requieren autorización, con owner y medición para cada uno.

**Orden sugerido**

1. Selector/navigation display, header, user/profile shell y preferencias no
   sensibles.
2. Workspace access selector usando entitlements/Registry, nunca
   `systemEntryRules` como fuente de grants.
3. Organization/professional context, preservando IDs namespaced y autoridad
   de dominio.
4. Bridge/vertical intents solo mediante Access Bridge actual; no introducir
   `entity_reference` ni cambiar subject.
5. Legal/Medical consumidores productivos solo con aprobación y contrato de
   cada owner.

**Riesgo:** fallback, ruta, visibilidad o status drift puede alterar UX/access;
doble lectura puede mostrar contextos incompatibles.
**Dependencias:** fase 1 aceptada, tests específicos del consumer, workspace
drift reconciliado, aprobación Legal/Medical donde aplique.
**Rollback:** flag por consumer y retorno a lectura anterior; no efectuar
escrituras de mapping ni borrar estados locales. Para cambios de acceso,
restaurar la llamada de Bridge/Policy anterior, no permisos cacheados.
**Aceptación:** consumer usa contrato versionado; no amplia permisos; métricas
de null/error/drift dentro de umbrales; comparativa old/new sin PII; pruebas
de paridad y fail-closed pasan.

## Fase 3 — Eliminar duplicaciones y retirar fuentes legadas

**Objetivo:** retirar solo duplicaciones confirmadas después de migración
completa de callers.

**Candidatos sujetos a auditoría**

- Catálogos manuales duplicados de keys/status/route/lifecycle.
- `frontend/src/system/entitlements.js` si se confirma que su derivación no
  concede ni decide acceso y todos los callers se migran a autoridad backend.
- Shapes duplicados en contexts/adapters, conservando compatibilidad y source.
- No candidato: `workspaceRegistry.jsx` del registry de widgets; no es
  Workspace lifecycle. Tampoco renombrar la identidad visual de Mi Espacio
  como identidad canónica.

**Riesgo:** retirar funcionalidad que aún tenga callers, especialmente legacy
routes, navegación o tests.
**Dependencias:** consumer inventory actualizado, usage evidence/telemetría,
paridad de contrato, plan de deprecación.
**Rollback:** recuperar módulo/catalog artifact versionado y revertir flag de
consumo; evitar borrar datos de preferencias o route definitions.
**Aceptación:** búsqueda completa de imports/callers sin referencias; contract
tests impiden reintroducir campos de auth en catalog; UX y authorization
regression pasan; no queda consumer con fallback silencioso.

## Fase 4 — Activar nuevas verticales

**Objetivo:** permitir integración de cada vertical mediante sus contracts y
controles, no activarlas de forma global por pertenecer al roadmap.

**Trabajo por vertical**

- owner de producto/datos, contrato API y namespaces propios;
- Workspace Registry lifecycle/launchMode/location aprobado (sin inferir de
  frontend mirror);
- policy/entitlements, AuthN/AuthZ, datos y privacy/security review;
- profesionales y organizaciones validados por la fuente competente;
- pruebas aisladas, observabilidad, soporte, jurisdicción y plan rollback.

Legal sigue con su contrato y autoridad; Medical y odontología, psicología y
enfermería requieren validación del dominio clínico y el drift del Registry
debe resolverse antes de activar. No crear workspaces profesionales,
organizacionales o de agente sin requerimiento/contrato específico.

**Riesgo:** exponer datos sensibles o activar workspace declared por lectura
de mirror; asumir una licencia/rol profesional no verificado.
**Dependencias:** fases 1–3 según el consumer; decisión por vertical,
compliance/localización y owner readiness.
**Rollback:** desactivar integración/consumer por vertical y restaurar destino
anterior; no borrar datos fuente ni cambiar lifecycle sin decisión de owner.
**Aceptación:** security/privacy sign-off, policy negative tests, contratos de
workspace, prueba de rollback y responsable operativo confirmados por vertical.

## Fase 5 — Integración futura con Identity

**Objetivo:** añadir referencia canónica solo cuando Identity pase su gate
independiente `READY`.

**Prerrequisitos**

- Identity Authority operativa y writer único aprobado; namespace y
  `punto_cero_system` reconciliados.
- evidencia por origen, legal approval, scopes/permissions, auditoría
  append-only, disponibilidad e idempotencia.
- staging y producción medidos; conflictos clasificados por owners.
- merge/split, rollback y pruebas aprobadas.

**Trabajo futuro**

- Introducir `entity_reference` nullable como referencia no autenticadora.
- Integrar fuentes individualmente en shadow/read-only primero, comparando
  sin cambiar decisiones de acceso.
- Separar linking de cuenta One, perfiles profesionales, empresa y Legal.
- Evaluar consumidores de entidad global por finalidad; Identity no genera
  entitlements ni memberships.

**Riesgo:** merge de personas distintas, exposición transversal o conversión
de `entity_id` en sujeto de permiso por conveniencia.
**Dependencias:** readiness y decisiones pendientes de Identity; aprobación de
cada data owner; cumplimiento por país.
**Rollback:** apagar nuevas lecturas/escrituras y preservar mappings/IDs
emitidos; no borrar ni reciclar IDs; volver a comportamiento anterior probado,
manteniendo fail-closed donde ya es contractual.
**Aceptación:** tests de idempotencia/concurrencia, source proof, authorization
separation, auditoría y reversibilidad; sin cambios a login/JWT/Legal durante
la primera materialización.

## Gates transversales

Una fase no se considera cerrada solo porque tests unitarios pasen. Exigir:

1. contrato y owners versionados;
2. revisión de datos/privacidad y autorización;
3. compatibilidad y negative tests;
4. métricas/alertas y runbook;
5. rollout gradual con rollback probado;
6. evidencia de no cambio en Identity/Auth/JWT/Legal fuera de scope.

## Carril de ejecución inmediato

Avanzar únicamente con **Fase 1 de diseño**: cerrar contexto por owners, fuentes,
namespaces, estados y fallos; acordar un inventario final por consumer; definir
un plan para reconciliar el Registry mirror. El código se mantiene intacto
hasta que el contrato tenga aprobación explícita. No comenzar Fase 5 ni
materialización Identity; readiness sigue **BLOCKED — NOT READY**.

## Referencias

- [WORKSPACE-USER-CONTEXT-MODEL.md](./WORKSPACE-USER-CONTEXT-MODEL.md)
- [VERTICAL-CONTEXT-CONTRACT.md](./VERTICAL-CONTEXT-CONTRACT.md)
- [ONE-CONTEXT-CONSUMERS-AUDIT.md](./ONE-CONTEXT-CONSUMERS-AUDIT.md)
- [ONE-EVOLUTION-READINESS.md](./ONE-EVOLUTION-READINESS.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
- [WORKSPACE-PROJECTION-MIGRATION.md](./WORKSPACE-PROJECTION-MIGRATION.md)
