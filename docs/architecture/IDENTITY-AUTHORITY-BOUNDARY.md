# Identity Authority Boundary

**Fecha:** 2026-10-03
**Estado:** Contrato de frontera propuesto; no habilita integración ni
materialización.

## Propósito y principios

Este documento define las responsabilidades objetivo para Identity, One y
Legal Core y explicita los límites de `entity_id`. La propuesta de gobierno
lógico corresponde a System Core; la autoridad operativa aún no está asignada
ni desplegada de forma independiente.

- Una persona transversal, una identidad canónica cuando la evidencia y la
  política aprobadas lo permiten.
- Los sistemas fuente conservan sus propios IDs y datos de dominio.
- Identidad no equivale a cuenta, sesión, membresía, rol, permiso o entitlement.
- Un vínculo representa una asociación verificada, no una fusión de bases.
- Lectura y resolución no conceden autorización.
- La frontera no modifica contratos runtime existentes.

## Propiedad por dominio

| Dominio | Propiedad/responsabilidad | No es propietario de |
| --- | --- | --- |
| **Identity System** | `entity_id` de persona; mapping canónico y mínimo de `(source, external_id)`; estado de identidad/link, procedencia y auditoría conforme al contrato futuro. System Core conserva gobierno lógico de políticas y namespace propuestos. | Login o credenciales; sesiones; perfiles completos; empresas/organizaciones como identidades de persona; datos jurídicos; permisos, membresías o entitlements. |
| **Punto Cero One** | Cuenta One (`users`), `users.id`, credenciales, sesiones, perfil, relaciones de producto y datos de One. One acredita la existencia/ownership de su ID nativo como fuente. | `entity_id` transversal, referencias de Legal, deduplicación automática de personas o permisos globales. |
| **Legal Core** | IDs y cuentas propios de Legal, firmas, organizaciones, tenants, casos, clientes y datos/procesos jurídicos según sus contratos. Legal es autoridad de evidencia para referencias de su propio dominio. | Asignación unilateral de `entity_id`; datos de cuenta/perfil One; autorización transversal fuera de su contrato. |
| **Workspace / Verticales** | Sus claves, perfiles de dominio, relaciones y permisos. Cada vertical responde por evidencia y validez de sus perfiles especializados. | Identidad personal canónica; asumir que poseer `entity_id` implica acceso, rol profesional o afiliación. |
| **Access Bridge / policy** | Resolución/consumo conforme a contratos actuales y validación para la operación autorizada. El Bridge actual falla cerrado si no resuelve un `entity_id` válido. | Crear, vincular, suspender o adjudicar identidades; reemplazar la autoridad de identidad; conceder privilegios solo por existencia de `entity_id`. |

## Qué nunca debe representar `entity_id`

`entity_id` es exclusivamente una identidad de **persona**. Nunca debe ser:

- `users.id`, ID de login o subject JWT;
- email, teléfono, nombre, documento nacional, credencial o atributo derivado;
- empresa, organización, firma, tenant, workspace, vertical o grupo;
- membership, rol, permiso, entitlement, licencia profesional o estado de
  cuenta;
- ID de caso, cliente, paciente, proveedor, pago o recurso de dominio;
- evidencia de verificación, consentimiento, elegibilidad o autorización.

Aunque sea opaco y use el prefijo técnico `pc_usr_*`, no debe considerarse
anónimo ni exento de controles de datos personales: puede correlacionar
referencias de una persona entre sistemas.

## Flujo futuro de referencia

La secuencia conceptual solicitada se representa así:

```text
Usuario
   │
   ▼
Identity Authority ── resuelve/crea el mapping de persona
   │                         ▲
   │ mapping autorizado      │ referencia y evidencia verificable
   ▼                         │
One ── cuenta, perfil, users.id ┘
   │
   ├── Verticales ── perfiles y datos propios; no reciben grants por identity
   │
   └── Legal Core ── integración separada, solo con source/evidencia y
                      autorización contractual aprobadas por Legal
```

Este diagrama expresa un flujo de vinculación lógico, no orden de creación de
cuenta ni una API existente. En la realidad técnica futura, One crea primero
su principal nativo y es dueño de `users.id`; una Identity Authority aprobada
solo puede resolver/vincular después de recibir una referencia y evidencia
verificables. Identity no sustituye el registro/login de One. Las verticales y
Legal consumen únicamente el mapping mínimo que necesitan; Legal no se habilita
por defecto ni hereda permisos de One.

## Matriz conceptual de permisos

La tabla describe límites de una arquitectura futura. **“Puede escribir”**
indica la autoridad sobre el registro o relación del dominio, no autorización
para modificar runtime hoy. La opción operativa de Identity sigue pendiente;
no hay actor productivo designado para ejercer esas operaciones.

| Operación | Autoridad | Puede escribir | Puede leer | Auditoría requerida |
| --- | --- | --- | --- | --- |
| Crear identidad persona (`entity_id`) | Identity Authority bajo gobierno de System Core | Solo writer único de Identity, después de validar source, evidencia, elegibilidad, idempotencia y unicidad. One/Legal/verticales presentan solicitud; no eligen `entity_id`. | Identity; consumidor autenticado recibe resultado mínimo. | Obligatoria: actor/source, referencia, evidencia referenciada, idempotency/correlation, resultado y timestamp. |
| Vincular cuenta/usuario One | Identity gobierna el mapping; One gobierna su cuenta e ID | One puede escribir `users` y acreditar su `users.id`; solo Identity writer puede escribir el link canónico `source=One` ↔ `entity_id`. | One e Identity según permisos; Bridge solo resuelve conforme al contrato vigente. | Obligatoria para solicitud y link; no registrar credenciales ni usar email como llave. |
| Vincular perfil profesional | Identity gobierna mapping de persona; vertical/entidad profesional gobierna perfil y credencial | La vertical puede escribir su perfil; Identity writer solo añade/revoca la referencia verificada. Identity no escribe licencia, historial ni atributos profesionales. | Identity y vertical según finalidad; atributos de perfil se leen del dominio fuente. | Obligatoria para referencia y prueba de control/validez; cambios en perfil quedan auditados por su sistema fuente. |
| Vincular empresa | One/dominio organizacional gobierna empresa y owner; Identity gobierna solo identidad de persona | One puede escribir empresa y relación `owner_id` de su dominio. Identity writer **no** vincula la empresa como si fuera persona ni asigna `entity_id` de persona a empresa. Un link de owner persona exige mapping de persona separado y evidencia/permiso aprobados. | One y consumidores autorizados; Identity no necesita leer empresa completa. | Obligatoria para cambios de owner/relación en One; si se consulta un mapping de persona, auditar la resolución y finalidad. |
| Vincular Legal | Legal gobierna su ID y evidencia; Identity gobierna el mapping transversal | Legal puede acreditar su principal y solicitar link; solo Identity writer podría persistir el mapping tras aprobación expresa de Legal y de la política Identity. **Bloqueado hasta habilitar source/evidencia.** | Legal e Identity bajo contrato; One no obtiene acceso por el vínculo por sí solo. | Obligatoria y reforzada: actor de ambos dominios, evidencia, finalidad, decisión y cambios; minimización/retención según Legal. |
| Suspender identidad | Identity Authority bajo gobierno System Core | Solo operador/writer Identity explícitamente autorizado puede suspender el estado canónico. One o Legal suspenden sus propias cuentas según sus contratos, no la identidad global. | Identity y consumidores autorizados leen estado mínimo. | Obligatoria: actor distinto cuando sea posible, razón, evidencia, estado previo/nuevo y revisión. |
| Recuperar/reactivar identidad o vínculo | Identity Authority; fuente acredita propiedad de su referencia | Writer Identity tras prueba de control, revisión de conflicto y política de recuperación aprobada. La fuente puede restaurar su cuenta, pero no reactivar globalmente el mapping unilateralmente. | Identity y sistemas involucrados con mínimo privilegio. | Obligatoria, con evidencia nueva, aprobación, historial preservado y razón de recuperación. |
| Merge de identidades | Adjudicación excepcional bajo gobierno System Core y política de dos-personas si se aprueba | Ningún sistema fuente ni automatismo. Writer especializado Identity solo tras adjudicación documentada; no existe hoy ese proceso. | Adjudicadores/auditor y fuentes afectadas según necesidad. | Obligatoria reforzada: evidencia, doble control, referencias antes/después, impacto downstream, reversibilidad conceptual y aprobación. |
| Split de identidad | Adjudicación excepcional bajo gobierno System Core, con fuentes afectadas | Ningún sistema fuente ni automatismo. Writer Identity solo tras probar separación de perfiles y plan de impacto. | Adjudicadores/auditor y fuentes afectadas según necesidad. | Obligatoria reforzada: evidencia por perfil, razón, mappings antes/después, invalidación controlada y revisión independiente. |

## Reglas de frontera

1. `entity_id` válido no crea ni demuestra autenticación, autorización,
   pertenencia a workspace, ownership empresarial, licencia profesional o
   elegibilidad legal.
2. Los IDs nativos permanecen en sus dominios: `users.id` en One y los IDs
   jurídicos en Legal. No reemplazarlos ni reutilizarlos como `entity_id`.
3. `source` identifica al sistema dueño de `external_id`, no al canal de login
   ni a la vertical.
4. Toda lectura cross-system debe tener finalidad y permiso; emitir menos
   atributos antes que replicar perfiles completos.
5. Conflicto, fuente desconocida o evidencia insuficiente produce un resultado
   explícito no resoluble; no se elige candidato por email/nombre.
6. Esta frontera es objetivo de diseño; no certifica que la infraestructura o
   permisos operativos estén implementados.

## Contradicciones y diferencias actuales (registradas, no corregidas)

1. **`punto_cero_system` vs emisor de `users.id`:** Identity Registry lo declara
   owner token y única fuente emisora permitida; los flujos de One crean los
   `users.id` que se almacenan como `external_id`. No está aclarado si el token
   representa System Core, One o un principal técnico delegado.
2. **Generación de `users.id`:** está en código de One y pertenece al namespace
   de cuenta One; esto no equivale a emitir `entity_id`. La autoridad
   transversal propuesta para `entity_id` es System Core.
3. **Ubicación de `system_identities`:** la colección y el servicio están en
   backend/base configurados por One, aunque los documentos arquitectónicos
   asignan ownership lógico a System. Hospedaje actual no constituye una
   delegación formal ni prueba separación de permisos.
4. **Lectura del Access Bridge:** la ruta resuelve desde la DB de la app y falla
   cerrado; no existe en el flujo revisado un consumidor de un servicio remoto
   System independiente. Esta lectura no vuelve al Bridge propietario ni
   escritor.
5. **Servicio System independiente:** no se ha verificado una instancia,
   endpoint, store, equipo operador ni SLO independiente. La recomendación de
   Identity Service dedicado no es evidencia de que el servicio exista.
6. **Capacidad local de escritura:** existen funciones de creación y link en el
   módulo actual. Que el alta normal no materialice automáticamente no elimina
   la capacidad técnica de llamadas explícitas; el límite de writer único no
   está demostrado operacionalmente.

No se cambian los tokens, IDs, rutas, colecciones ni policy como parte de esta
revisión.

## Estado

La opción C y esta frontera son **propuestas**, no decisiones aprobadas. Hasta
que se asigne un Identity Authority operativo y se cierren evidencias,
permisos, auditoría, privacidad, operación y rollback, la materialización
permanece **BLOCKED — NOT READY**.

## Referencias

- [ADR-IDENTITY-AUTHORITY-DECISION.md](./ADR-IDENTITY-AUTHORITY-DECISION.md)
- [IDENTITY-GOVERNANCE-CONTRACT.md](./IDENTITY-GOVERNANCE-CONTRACT.md)
- [IDENTITY-OPERATIONAL-AUTHORITY-PACKAGE.md](./IDENTITY-OPERATIONAL-AUTHORITY-PACKAGE.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
- [ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md)
