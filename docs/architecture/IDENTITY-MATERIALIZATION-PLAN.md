# Identity Materialization Plan

**Estado:** Plan de diseño; no autoriza ejecución ni escritura.  
**Relación:** subordinado a [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md)
y [IDENTITY-OWNERSHIP-OPERATING-MODEL.md](./IDENTITY-OWNERSHIP-OPERATING-MODEL.md).

## Propósito

Describir las fases que serían necesarias para materializar `entity_id` sin
cambiar el login de One, JWT, sesiones, autorización, referencias existentes ni
datos del Legal Core. No se crean escritores, migraciones, backfills, APIs o
eventos en esta fase.

## Prerrequisitos antes de activar identidad

No iniciar escritura productiva hasta satisfacer todos los puntos:

1. **Ownership operativo aprobado:** autoridad lógica y operativa única; store,
   servicio, credenciales, entornos y responsabilidad de incidentes definidos.
   System Core sigue siendo la autoridad objetivo.
2. **Namespace ratificado:** quién emite `external_id`, aprobación de
   `punto_cero_system`, source tokens permitidos, formatos, no reutilización y
   política de versionado.
3. **Eligibility por fuente:** umbral verificable para registro One,
   verificaciones de proveedor, invitaciones y vínculo Legal. Un registro
   provisional no debe resolverse como persona probada por defecto.
4. **Contrato de API/evento interno:** request/response/error, autenticación de
   origen, idempotency key, correlación, límites, timeout, ownership de reintento
   y privacidad. No debe coexistir un segundo escritor directo a Mongo.
5. **Estados y transiciones:** aprobación de estados Identity/Profile Link,
   semantics de pending/conflicted/suspended/revoked, y separación de `users.status`,
   Workspace lifecycle y policy.
6. **Índices/integridad comprobados:** restricciones únicas sobre `entity_id`
   y `(source, external_id)` verificadas en el almacén que se declara
   autoritativo. Startup warning no equivale a garantía.
7. **Auditoría disponible:** append-only, acceso separado, redacción de PII,
   actor de sistema, retención y comportamiento si la auditoría no puede
   registrarse.
8. **Cobertura por entorno:** universo, entorno y timestamp documentados;
   clasificar usuarios huérfanos, perfiles duplicados, empresas/owners y
   registros de prueba/seed. No proyectar el 4/4 local a producción.
9. **Legal separado:** owner y prueba de `legal_user_id` aprobados por Legal;
   mapping no se ejecuta hasta permitir `source` y acordar su lifecycle.
10. **Rollback y soporte:** feature flag/kill switch, dashboards, runbook,
    límites de reintento y responsable de revisar conflictos.
11. **Aprobaciones de seguridad/privacidad:** minimización de campos, control
    de acceso entre fuentes, threat model, retención, exportación/borrado y
    procesos de derechos del titular.

Cada elemento pendiente constituye **DECISIÓN PENDIENTE DE
PRODUCTO/ARQUITECTURA**; ningún paso más abajo los resuelve automáticamente.

## Fases futuras propuestas

### Fase 0 — Especificación cerrada

- Ratificar el ownership operativo y namespace.
- Definir contratos de origen, estados, evidencia y conflictos.
- Inventariar consumidores que requieren `entity_id` y qué comportamiento
  actual deben conservar.
- Definir medición reproducible y aprobar cómo se informan discrepancias.

**Salida:** contrato versionado, límites de confianza, test plan y go/no-go
firmado. Sin escritura.

### Fase 1 — Read-only discovery por entorno

- Ejecutar medición de `users` y `system_identities` por entorno con credenciales
  de solo lectura.
- Clasificar: 0/1/múltiples identidades por usuario, IDs canónicos inválidos,
  perfiles huérfanos, perfiles duplicados, referencias source desconocidas,
  y colisiones de email solo como señal estadística (no merge).
- Muestrear relaciones de organizaciones/profesionales/agentes por IDs, sin
  copiar datos a Identity System.
- No consultar Legal salvo autorización y ventana acordada.

**Salida:** reporte agregado reproducible, linaje/owners y lista de excepciones
sin PII innecesaria.

### Fase 2 — Shadow resolution

- En un entorno aislado o modo no autoritativo, comparar resolución propuesta
  con IDs fuente existentes.
- No alterar los resultados actuales del Access Bridge ni emitir acceso.
- Medir no-resueltos, múltiples resultados, latencia, errores e impacto de
  caída.
- No crear ni enlazar identidades durante shadow-read salvo prueba separada
  explícitamente autorizada; la fase de auditoría no habilita escrituras.

**Salida:** diferencias explicadas y criterios de seguridad/latencia cumplidos.

### Fase 3 — Materialización controlada

Solo después de aprobación explícita:

- Habilitar un único productor/orquestador bajo la Identity Authority.
- Crear o recuperar mappings idempotentes para cohortes autorizadas.
- Mantener inalterados `users.id`, auth providers, JWT, cookies, foreign keys y
  Legal IDs.
- No derivar memberships ni entitlements de la materialización.
- Registrar cada éxito, rechazo, conflicto y reintento.
- Pausar automáticamente la cohorte ante integridad o auditoría degradadas.

**Salida:** cobertura y error budget dentro de umbrales aprobados, conflictos
aislados y reconciliación documentada.

### Fase 4 — Consumo explícito

- Integrar consumidores uno por uno bajo contrato versionado.
- Mantener resolución actual/fallback solo cuando esté explícitamente aprobada;
  para operaciones que requieran identidad canónica, continuar fail-closed.
- No hacer cambio masivo de `subject_id`, claims o política.
- Legal se integra en una fase separada tras su propia aprobación y pruebas.

**Salida:** cada consumidor tiene pruebas de compatibilidad, rollback y
observabilidad antes de ampliar cohortes.

## Validaciones obligatorias antes/durante la activación

### Integridad

- `entity_id` tiene formato válido, no es nulo y es único.
- Cada `(source, external_id)` aceptado apunta a una sola entidad.
- Las fuentes están registradas y tienen permiso de emisión.
- Cada identity activa cumple el proof threshold; cada link resoluble está
  verificado.
- No hay escritura cruzada a identidad de persona desde IDs de organización,
  tenant, workspace, firma o provider.
- La idempotencia se verifica bajo reintentos, concurrencia y timeout ambiguo.
- Error de índice/constraint bloquea escritura; no se oculta como warning
  exitoso.

### Compatibilidad

- JWT continúa usando `users.id`; tokens existentes siguen siendo válidos.
- Login JWT/cookie y su conflicto 409 no cambian.
- `system-context`, Access Bridge HTTP y contratos frontend permanecen iguales
  durante materialización inicial.
- Access Bridge no genera identidad ni cae a email/`users.id` como sujeto
  canónico.
- `entity_id` no añade grants; `policy_can` y entitlements no cambian.
- Relaciones empresariales, groups y `user_workspaces` conservan significado.
- Legal conserva IDs, autorización, datos, sesiones y tenancy.

### Operación y auditoría

- Actor de origen autenticado y autorizado para el `source`.
- Correlation/idempotency key estable y no sensible.
- Audit log append-only captura requested/accepted/rejected/conflict,
  transición y actor sin tokens/secretos.
- Alertas de fallo de índices, duplicidad, perfil huérfano, retry exhaustion,
  servicio no disponible y mismatch de resolución.
- Timeout y circuit breaking no alteran la autenticación ni producen resultado
  de éxito falso.
- Reconciliación/retención y acceso a reportes definidos.

## Pruebas necesarias

Sin implementación en esta fase; al activar, cubrir al menos:

1. Pruebas unitarias: formato/estabilidad, source allowlist, estados, unique
   mapping, email repetido no fusiona, idempotencia y rechazo fail-closed.
2. Pruebas de concurrencia: misma referencia externa simultánea, generación
   de ID, escritura al mismo `entity_id`, restricción única en despliegue real.
3. Contratos de API/evento: auth del caller, esquema versionado, errores
   transitorios/permanentes, correlation e idempotency key.
4. Integración One: registro elegible/no elegible, invitation pending/accepted,
   proveedor social y colisión, sin alterar JWT/cookie ni datos de usuario.
5. Integración organización: empresa con owner existente/ausente; confirmar que
   organización no recibe `entity_id` persona y no se repara automáticamente.
6. Integración Legal, en plan separado: Legal user ID existente, conflicto y
   ausencia de evidencia; verificar que no se reescriben IDs/datos/claims.
7. Bridge/policy: canónico válido, no resuelto, suspendido/revocado y fuente no
   disponible; no cambiar autorización sin fase aprobada.
8. Auditoría: append-only, payload redacted, persistencia antes de success,
   auditoría fallida no devuelve transición exitosa.
9. End-to-end y regresión: login JWT, login comunidad, dual-session same/diff,
   Access Bridge, context, frontend selector y Core Legal bridge sin cambio.
10. Ensayo de rollback y restauración en staging con datos sintéticos, nunca
    deduciendo rollback de borrado de identidades emitidas.

## Estrategia de rollback conceptual

- Deshabilitar el productor y detener nuevos writes; no abrir escritores locales
  alternativos.
- Mantener `entity_id` y los links ya creados, con estado/audit trail, sin
  borrarlos ni reciclarlos.
- Desactivar por separado cualquier consumidor nuevo y volver a comportamiento
  previo únicamente donde sea seguro y probado. Si un consumidor exige el
  canónico, la falta de resolución mantiene su fail-closed vigente.
- No revertir JWT, `users.id`, claves foráneas, Legal IDs, policy ni grants:
  la primera materialización no debe haberlos modificado.
- No revertir merge/split automáticamente; son adjudicaciones manuales, no
  rollback de release.
- Reintentos tras restauración deben ser idempotentes y reconciliar el estado
  antes de continuar.
- Verificar métricas, integridad, auditoría y contratos previos antes de
  reactivar.

## Bloqueos reales antes de implementación

- Definir dónde vive la autoridad operacional y cómo accede el Bridge.
- Resolver quién es propietario/emisor del `external_id` representado hoy por
  `users.id` frente a `source=punto_cero_system`.
- Establecer verificación/eligibility para registro One, invitaciones y Legal.
- Definir disponibilidad y comportamiento del consumidor cuando la autoridad
  esté caída.
- Clasificar referencias de empresa no resueltas por entorno sin asumir que
  toda fila representa usuario vigente.
- Aprobar estados, audit retention y proceso de merge/split.
