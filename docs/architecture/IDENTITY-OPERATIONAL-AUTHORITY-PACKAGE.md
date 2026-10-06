# Identity Operational Authority Package

**Fecha:** 2026-10-03
**Estado:** Paquete de decisión; no habilita escrituras ni cambios de runtime.
**Resultado:** **BLOCKED — NOT READY** para materialización automática.

Este documento consolida una recomendación y las decisiones que aún requieren
aprobación. No declara una autoridad operativa como ya seleccionada ni altera
las decisiones previas de ownership lógico.

## 1. Estado actual

### Dónde vive la implementación

- `backend/services/system_identity.py` implementa generación, validación,
  creación, vinculación y resolución de identidades.
- La colección `system_identities` y sus índices están en la base Mongo
  configurada por One. En la medición local del 2026-10-03 se observaron
  índices únicos sobre `entity_id` y sobre
  `(profiles.source, profiles.external_id)`.
- `backend/routes/access_bridge_routes.py` lee la identidad canónica para el
  Access Bridge; no solicita creación (`create_missing=False` por omisión) y
  falla cerrado si no hay `entity_id` válido.
- No se encontró un flujo productivo que garantice materialización al registrar
  o iniciar sesión. La existencia de funciones capaces de escribir no prueba
  que exista un escritor operativo autorizado ni que se invoquen en el alta
  normal.

### Quién debería gobernar

La propuesta documentada asigna a **System Core** la autoridad lógica sobre
`entity_id`, sus asociaciones canónicas y las reglas de namespace. Esta
decisión conceptual no convierte al código/base actuales de One en una
autoridad System desplegada. One conserva autoridad sobre sus cuentas y
`users.id`; Legal Core conserva sus identificadores y datos de dominio legal.

### Autoridad lógica vs operativa

| Dimensión | Estado |
| --- | --- |
| **Autoridad lógica** | System Core es la autoridad propuesta para decidir reglas de identidad transversal. |
| **Implementación actual** | Backend, servicio, colección y resolución del Bridge residen en la implementación/base de One. |
| **Autoridad operativa actual** | No formalizada. No se verificó un owner de servicio, escritor único impuesto por credenciales, separación de permisos ni proceso operacional de adjudicación/auditoría. |
| **Autoridad operativa futura** | **DECISIÓN PENDIENTE.** Debe asignarse expresamente antes de cualquier materialización automática. |

La topología no se deduce de nombres de módulos, tokens ni documentación de
ownership lógico.

## 2. Decisión pendiente principal: ¿quién es el Identity Authority operativo?

Las opciones siguientes describen topologías/ownership operativo posibles. En
las tres debe existir una sola autoridad lógica y un solo escritor efectivo;
varios lectores no son varios emisores.

| Opción | Ventajas | Riesgos | Impacto | Migración futura |
| --- | --- | --- | --- | --- |
| **A) System Core independiente** | Alinea operación y gobierno lógico; mantiene la identidad transversal fuera del ciclo de release de One; permite una frontera explícita para Legal y futuros verticales. | Requiere despliegue, disponibilidad, seguridad, personal operativo, contrato entre servicios, observabilidad y recuperación que hoy no están demostrados. Dependencia de red puede afectar resolución Bridge. | System Core asume el ownership del servicio, store, SLO, credenciales, auditoría e incidentes. One y Legal actúan como fuentes/consumidores autenticados. | Extraer servicio y datos actuales con reconciliación e idempotencia; durante transición debe existir una autoridad de escritura única, sin doble escritura ni resolver desde stores divergentes. |
| **B) One como autoridad temporal** | Menor cambio inmediato; código y datos ya están en One; evita introducción inmediata de llamada remota y puede facilitar observación sobre la base actual. | Consolida autoridad transversal en un producto y contradice el límite lógico propuesto si no es explícitamente una delegación temporal. Riesgo de acoplar ID canónico a login, releases y permisos de One; ambigüedad renovada del token `punto_cero_system`. | Exige mandato temporal por escrito, alcance, prohibiciones, auditoría, owner técnico, fecha/criterio de expiración y garantía de que One no decide identidad de Legal por sí solo. No debe confundirse hospedaje actual con delegación aprobada. | Reasignar operación al System Core/Identity Service mediante transferencia controlada de responsabilidad y store; preservar `entity_id` y links, verificar constraints y detener al escritor antiguo antes de habilitar al nuevo. |
| **C) Servicio Identity dedicado** | Separa ciclo de vida, permisos y disponibilidad de los productos; proporciona una frontera API para múltiples sistemas; facilita que el escritor único sea verificable y auditable. | Más componentes y superficie operacional que mantener dentro de Core; añade latencia, dependencia de red, SLO, autenticación entre sistemas y plan de contingencia. Puede crear una “tercera autoridad” si no queda bajo gobierno explícito de System Core. | El servicio dedicado opera Identity Authority bajo mandato de System Core; Systems fuente presentan referencias verificables y consumidores solo leen/resuelven según permisos. | Migrar store/código local a servicio con cutover controlado, contratos versionados, reconciliación read-only previa, pausa del escritor anterior y rollback sin borrar/reasignar IDs. |

### Recomendación para decisión

**Recomendación de arquitectura:** opción **C**, servicio Identity dedicado
como implementación operativa bajo la autoridad lógica y el gobierno de System
Core. El servicio dedicado sería el ejecutor/operador de esa autoridad, no un
dueño de política separado. Esta opción hace explícita la frontera para One,
Legal y nuevos verticales y permite aplicar el principio de escritor único.

La recomendación **no está aprobada ni implementada**. Requiere una decisión
formal de producto/arquitectura y análisis de costo, disponibilidad, seguridad
y SLO. Hasta entonces, la única conclusión válida es que el owner operativo
sigue sin definirse. La opción B no queda aprobada por el hecho de que la
implementación actual esté alojada por One.

## 3. Modelo recomendado

- **Un escritor:** una Identity Authority gobernada por System Core es el único
  componente autorizado para crear `entity_id`, modificar metadata canónica,
  vincular perfiles o suspender/revocar una identidad. Debe haber enforcement
  operativo de esta exclusividad; una convención de código no basta.
- **Lectores múltiples:** One, Legal (cuando se apruebe), Access Bridge y otros
  Systems pueden solicitar resolución dentro de sus permisos, recibir solo los
  atributos mínimos y manejar errores/estados explícitos. Leer no implica
  escribir.
- **Auditoría obligatoria:** cada solicitud y transición registra actor,
  `source`, referencia de origen, resultado, motivo/evidencia referenciada,
  timestamp, correlación y estado antes/después. Registro append-only,
  minimizado y auditable; no guardar credenciales, tokens ni PII innecesaria.
- **Separación identidad/autorización:** `entity_id` prueba o referencia una
  persona canónica; no crea usuario, sesión, workspace membership, entitlement
  ni permiso. Authentication, policy, entitlements y autorización permanecen
  en sus dominios actuales.
- **Sin deduplicación heurística:** email, nombre, empresa o perfil profesional
  pueden ser señales; no habilitan automáticamente vinculación, merge o split.
- **Fail closed para ambigüedad:** referencias desconocidas, duplicadas o en
  conflicto no devuelven una identidad elegida arbitrariamente ni se sustituyen
  por `users.id`/email donde el consumidor exige `entity_id`.

## 4. Contrato conceptual de creación

### CREATE IDENTITY

**Entrada mínima conceptual**

- `source` registrada y autenticada;
- `external_id` estable emitido por ese `source`;
- evidencia o referencia verificable de que el sistema fuente controla ese ID
  y de que la cuenta es elegible;
- clave de idempotencia y correlación;
- actor/servicio y motivo de la solicitud.

El email puede incluirse como dato secundario únicamente si la política de
privacidad lo autoriza; no es la llave de idempotencia ni prueba suficiente de
identidad. No debe enviarse metadata fuera de la allowlist aprobada.

**Salida conceptual**

- `entity_id` generado por la autoridad, o un resultado explícito
  `already_linked`, `pending`, `conflict` o `rejected`;
- estado de resolución y referencia de auditoría;
- no devolver éxito si auditoría o persistencia obligatoria falló.

### Condiciones

1. Validar autenticación/autorización del origen, registro/estado de `source`,
   elegibilidad y evidencia de control antes de emitir.
2. Verificar unicidad de `entity_id` y `(source, external_id)` en el store
   autoritativo. Resolver carreras mediante constraint e idempotencia, no
   mediante éxito alternativo.
3. Repetir el mismo request idempotente devuelve el mapping existente; no
   crea otra identidad.
4. Toda decisión queda auditada y puede reconstruirse sin exponer secretos.
5. Un conflicto bloquea esa resolución y requiere revisión autorizada; no se
   fusiona automáticamente.
6. Rollback futuro detiene nuevos writes y/o consumidores de forma controlada,
   conserva IDs ya emitidos como tombstones/mappings auditables y nunca cambia
   los IDs nativos de One/Legal. No se revierte borrando identidades ni
   reciclando IDs.

Este contrato es conceptual; no es una API, evento, writer ni autorización de
materialización.

## 5. Relación One / Identity / Legal

| Dominio | Propietario y responsabilidad | Fuera de alcance |
| --- | --- | --- |
| **One** | Cuenta One, credenciales, sesiones, perfil y `users.id`. Acredita a Identity Authority los IDs que emite y conserva su lifecycle de cuenta. | No decide identidad transversal ni adjudica vínculos a Legal. `users.id` no se reemplaza por `entity_id` en login/JWT como parte de este paquete. |
| **Identity System** | Persona transversal, `entity_id`, referencias verificadas por source, estados/vínculos canónicos y audit trail, bajo gobierno propuesto de System Core. | No es cuenta de login, perfil completo de producto, entidad empresarial ni sistema de permisos. |
| **Legal Core** | Usuarios/IDs legales, firmas, organizaciones, tenants y datos/procesos jurídicos según contratos propios. Legal valida y conserva su ID nativo. | No se habilita ni modifica en esta fase. Un futuro vínculo a Legal requiere fuente/owner, evidencia y aprobación separados; no se deduce por email o contexto. |

El Access Bridge consume la resolución disponible y falla cerrado cuando no
obtiene el sujeto canónico requerido. No es autoridad ni escritor.

## 6. Criterios para desbloquear materialización

Todos los criterios deben estar cerrados y verificados antes de autorizar
escrituras automáticas:

- [ ] Owner operativo definido y aceptado; servicio/store, responsable,
  credenciales, deployment e incidentes asignados.
- [ ] Namespace aprobado; semántica de `punto_cero_system`, emisor de
  `users.id`, fuentes permitidas, unicidad, versionado y no reutilización
  formalizados.
- [ ] Auditoría definida e implementada/probada como append-only, con actor,
  evidencia, retención, acceso y política ante fallo.
- [ ] Evidencia definida por fuente y por estado de cuenta/invitación; email,
  empresa y perfil informativo no se usan como prueba automática.
- [ ] Permisos mínimos y segregación de solicitante, escritor, adjudicador,
  lector y auditor aprobados.
- [ ] Rollback, idempotencia, retry, timeout, kill switch, fail-closed y
  reconciliación ensayados sin borrar ni reasignar IDs.
- [ ] Staging medido con universo, fecha, checks de integridad y limitaciones.
- [ ] Producción medida con autorización read-only, universo, fecha y
  limitaciones; sus métricas no se extrapolan de local.
- [ ] Índices/constraints verificados en cada store autoritativo y writer único
  impuesto.
- [ ] Conflictos de identidad y `companies.owner_id` clasificados con sus data
  owners, sin autofix ni linkage heurístico.
- [ ] Pruebas de contrato, concurrencia, integración, auditoría y regresión
  aprobadas sin cambiar login, JWT, Bridge, policy, entitlements o Legal.

**Estado al 2026-10-03:** checklist incompleto. LOCAL fue medido (4 usuarios,
4 identidades válidas, índices únicos presentes en esa base). STAGING y
PRODUCCIÓN siguen **DESCONOCIDOS**. El owner operativo, namespace operativo,
evidencia, permisos y garantías de auditoría/rollback no están aprobados.

## 7. Decisiones pendientes

### PRODUCTO

- **PENDIENTE:** confirmar si System Core tendrá mandato de identidad
  transversal en One, Legal y futuros verticales.
- **PENDIENTE:** establecer la elegibilidad de una cuenta One (alta, verificación,
  invitación aceptada u otro hito) para crear/vincular identidad.
- **PENDIENTE:** definir fuentes y nivel de evidencia admisible, incluyendo si y
  cuándo Legal puede vincularse.
- **PENDIENTE:** definir la experiencia de usuario ante identidad pendiente,
  conflicto o servicio no disponible sin alterar login actual.

### ARQUITECTURA

- **PENDIENTE:** elegir formalmente A/B/C como owner operativo. Recomendación:
  C, Identity Service dedicado bajo el gobierno de System Core.
- **PENDIENTE:** ratificar `punto_cero_system` como namespace reservado y
  principal técnico; aclarar su relación con `users.id` generado por One.
- **PENDIENTE:** definir modelo de datos/estado de Identity y Profile Link,
  protocolo/contrato de lectores, versionado y topología de store.
- **PENDIENTE:** definir cómo se aplicará el escritor único y se garantizarán
  constraints/consistencia sin escritores duales durante migración futura.

### OPERACIÓN

- **PENDIENTE:** asignar responsable de servicio, SLO/availability, guardias,
  gestión de credenciales, backup/restore y respuesta a incidentes.
- **PENDIENTE:** aprobar auditoría append-only, acceso, revisión independiente,
  retención, privacidad y manejo de fallos.
- **PENDIENTE:** obtener mediciones read-only autorizadas y clasificadas de
  STAGING y PRODUCCIÓN.
- **PENDIENTE:** clasificar los `companies.owner_id` locales no resueltos con
  sus responsables de datos y determinar linaje, sin corregirlos.
- **PENDIENTE:** ensayar rollback, idempotencia, reintentos, conflictos,
  merge/split y continuidad del Bridge antes de cualquier piloto.

## Estado final

**BLOCKED — NOT READY** para materialización automática. La opción C es una
recomendación arquitectónica, no una decisión aprobada. Sin owner operativo
formal, namespace reconciliado, evidencia y permisos establecidos, auditoría
garantizada y mediciones de staging/producción, no debe comenzar un proceso
productivo de creación.

## Siguiente fase recomendada

Celebrar y registrar una decisión de arquitectura/producto/operación que
seleccione A/B/C, confirme el mandato de System Core y asigne el owner
operativo. Si se acepta C, la siguiente fase debe ser exclusivamente de diseño
detallado del Identity Service y de su frontera/controles, seguida de
descubrimiento read-only autorizado en staging y producción. No implementar
writers hasta que el checklist anterior esté completo y el gate de readiness
se actualice con evidencia verificable.

## Referencias

- [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md)
- [IDENTITY-GOVERNANCE-CONTRACT.md](./IDENTITY-GOVERNANCE-CONTRACT.md)
- [IDENTITY-OWNERSHIP-OPERATING-MODEL.md](./IDENTITY-OWNERSHIP-OPERATING-MODEL.md)
- [IDENTITY-MATERIALIZATION-PLAN.md](./IDENTITY-MATERIALIZATION-PLAN.md)
- [IDENTITY-ENVIRONMENT-RECONCILIATION.md](./IDENTITY-ENVIRONMENT-RECONCILIATION.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
- [ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md)
