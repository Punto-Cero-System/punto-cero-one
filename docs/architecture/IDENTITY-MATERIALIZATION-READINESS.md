# Identity Materialization Readiness

**Fecha:** 2026-10-03
**Estado global:** **BLOCKED — NOT READY**
**Alcance:** evaluación documental para materialización automática de
identidades; no activa escritores ni modifica datos/runtime.

## Decisión

**No estamos listos para crear identidades automáticamente.**

La muestra **LOCAL** observada tiene 4/4 usuarios con un `entity_id` válido y
los dos índices únicos presentes en esa base. Esto acredita únicamente un
snapshot local pequeño. Staging y producción son **DESCONOCIDOS**, no medidos.
Una medición local limpia no resuelve los bloqueos de ownership, namespace,
evidencia, permisos y auditoría.

## Clasificación por dominio

| Dominio | Estado | Evidencia / razón |
| --- | --- | --- |
| **LOCAL — integridad del snapshot** | **READY (limitado a observación)** | 4 usuarios, 4 identidades válidas, sin conflictos visibles; índices únicos de `entity_id` y `(source, external_id)` presentes al observar. Solo conteo de cuatro; no valida producción ni un proceso de escritura seguro. |
| **STAGING** | **BLOCKED / DESCONOCIDO** | Sin acceso ni medición; no hay universo ni validación de constraints. |
| **PRODUCCIÓN** | **BLOCKED / DESCONOCIDO** | Sin acceso ni medición; no hay universo ni validación de constraints. |
| **Autoridad operativa** | **BLOCKED** | System Core es autoridad lógica propuesta, pero servicio/store y lecturas siguen localmente en One; no se demostró escritor único, ownership operacional ni separación de credenciales. |
| **Namespace/emisor** | **BLOCKED** | Registry autoriza `punto_cero_system`, pero los flujos One producen `users.id` usados como `external_id`. Owner técnico, custodia y acreditación de One no están reconciliados. |
| **Evidencia de identidad** | **BLOCKED** | Falta definir umbrales y procedimientos por origen. Email, ownership de empresa y perfil profesional no bastan para vincular personas automáticamente; Legal no está habilitado como fuente de emisión. |
| **Permisos y segregación** | **BLOCKED** | No hay contrato implementado que pruebe quién puede crear, vincular, modificar, suspender y revisar/auditar; no se verificó aislamiento de writers por credenciales. |
| **Auditoría** | **BLOCKED** | La política append-only, retención, acceso, evidencia y tratamiento de fallo no está operada como garantía del ciclo de vida de identidad. |
| **Conflictos y rollback** | **BLOCKED** | No hay proceso autorizado de adjudicación, merge/split, disponibilidad/reintento y rollback para escrituras materializadas. |
| **Ownership empresarial** | **NOT READY** | 41/41 `owner_id` no coinciden con los cuatro usuarios del snapshot local; sin linaje ni cohorte no se pueden clasificar como owners inválidos ni usar para vincular. |

El estado global es BLOCKED porque varios requisitos previos indispensables
no están definidos/implementados y dos entornos críticos son desconocidos. El
resultado local no es aprobación para activar escritura automática.

## Gate para iniciar implementación futura

No pasar a implementación hasta cerrar y verificar todos los puntos:

- [ ] Authority operativa única aprobada, desplegable y responsable de
  incidentes.
- [ ] Owner técnico y semántica de `punto_cero_system` ratificados; flujo por
  el que One prueba control de `users.id` acordado, con compatibilidad
  versionada.
- [ ] Política de evidencia/eligibilidad aprobada por cada fuente; Legal
  separado y no habilitado por inferencia.
- [ ] Identidad autenticada de servicios, permisos mínimos y roles separados
  para solicitante, escritor, adjudicador y auditor.
- [ ] Restricciones e índices verificados en los stores autoritativos de todos
  los entornos; duplicados/conflictos existentes clasificados.
- [ ] Estado de Identity/Profile Link y comportamiento fail-closed aprobados;
  ninguna conversión a permisos/membership implícita.
- [ ] Auditoría append-only probada, privacidad/retención y revisión
  independiente definidas.
- [ ] Staging y producción medidos con universo/fecha/limitaciones explícitos;
  referencias de empresas clasificadas con sus responsables, sin autofix.
- [ ] Idempotencia, concurrencia, reintentos, timeout, disponibilidad,
  observabilidad, kill switch y rollback ensayados en entorno no productivo.
- [ ] Pruebas unitarias, integración, contrato y regresión aprobadas sin
  cambiar login, JWT, Access Bridge, policy, entitlements o Legal Core.

## Riesgos bloqueantes

1. Un mapping escrito por un backend alojado en One sin autoridad operativa
   formal permitiría decisiones canónicas fuera del dueño lógico propuesto.
2. El nombre `punto_cero_system` puede producir una falsa impresión de que
   System emite operacionalmente IDs que hoy son generados en flujos One.
3. Los 41 owners de empresa no resolubles en la cohorte local pueden ocultar
   seed data, usuarios históricos o población ausente; cualquier reparación
   automática arriesga reasignación incorrecta.
4. No hay evidencia sobre producción, staging, usuarios Legal ni identidades
   existentes fuera de la base local consultada.
5. Que índices únicos estén presentes en LOCAL no garantiza su presencia,
   salud o enforcement en los demás entornos ni writer único.

## Próxima fase recomendada

Realizar reconciliación read-only con dueños de datos para clasificar los
`companies.owner_id` repetidos/no resueltos y obtener mediciones autorizadas de
staging y producción. En paralelo, decidir formalmente quién representa
operativamente `punto_cero_system` y quién acredita `users.id`. Cuando ambos
bloqueos se cierren, aprobar política de evidencia, permisos y auditoría y
actualizar este gate antes de diseñar un piloto de escritura. No iniciar
materialización ni backfill en la fase de descubrimiento.

## Documento de evidencia

Consultar [IDENTITY-ENVIRONMENT-RECONCILIATION.md](./IDENTITY-ENVIRONMENT-RECONCILIATION.md)
para métricas locales, controles, referencias de empresas y límites por entorno.
