# ADR: Ownership, namespace y contrato de identidad canónica

- **Estado:** Aceptada como decisión arquitectónica objetivo; no activada en runtime.
- **Fecha:** 2026-10-03
- **Alcance:** autoridad de `entity_id`, namespace, ciclo de vida y compatibilidad
  entre Punto Cero One, System Core y Legal Core.
- **No alcance:** migraciones, backfill, cambios a Mongo/JWT/login, sincronización
  real, autorización o integración de Legal.

## Contexto

One conserva usuarios en `users`, con `users.id` referenciado por JWT,
sesiones, perfiles y otras entidades propias. La colección `system_identities`
y el servicio que la opera existen en este repositorio; el Access Bridge
consulta esa colección en modo lectura y requiere `entity_id` válido.

La separación arquitectónica declara que System posee la identidad canónica,
pero el código actual carga el servicio, acceso a la colección e índices en el
backend de One. Además, `identity_registry` declara `punto_cero_system` dueño
del namespace de `external_id`, aunque los flujos One generan los `users.id`
que se enlazan. Hace falta separar autoridad lógica, propiedad de datos y
ubicación física.

`entity_id` identifica una persona a través de sistemas. No es un ID de
organización, empresa, firma, workspace, proveedor de autenticación ni
membership. Legal Core conserva su propio usuario, organizaciones, tenants y
datos jurídicos.

## Decisión

### A. Autoridad y evaluación de opciones

| Opción | Ventajas | Riesgos / costes | Evaluación |
| --- | --- | --- | --- |
| **1. Punto Cero System Core** | Alinea identidad transversal con la autoridad que gobierna namespaces, Workspace, entitlements y permisos. Los futuros verticales pueden compartir el mismo contrato. | Si One aloja físicamente el almacén, persiste el desacople lógico/operativo actual. Requiere una frontera de servicio y disponibilidad definida antes de delegar autoridad real. | **Elegida como autoridad lógica objetivo.** |
| **2. Punto Cero One** | El registro actual y la autenticación One ya producen `users.id`; materialización cercana al alta sería directa. | Haría de un producto una autoridad de identidad de todos los verticales y Legal; acopla identidad global a despliegue y ciclo de One y contradice la frontera de datos documentada. | Rechazada como dueño de `entity_id`. One sí es dueño de sus cuentas y de `users.id`. |
| **3. Punto Cero Identity Service independiente** | Aísla identidad y permite gobernanza/escala independiente del System Core o del producto; puede servir a múltiples sistemas. | Añade un servicio y una frontera operacional que hoy no están demostrados; riesgo de crear una tercera autoridad y dependencia distribuida prematura. | **No se crea en esta fase.** Puede evaluarse como implementación física posterior, siempre bajo gobernanza de System Core. |

**Decisión adoptada:** Punto Cero System Core es el propietario lógico y
autoridad de `entity_id`, de su asignación y del mapa de referencias canónicas
de perfiles externos. One es dueño de `users`, credenciales, sesiones y perfil
One, y conserva `users.id` como su identificador nativo externo. System Core no
se convierte en dueño de datos de perfil o dominio de One/Legal.

La autoridad lógica no obliga a mantener `system_identities` en una base
específica. Su ubicación actual en el backend/base de One se considera
**implementación transitoria no certificada**, no una transferencia de
ownership. La topología objetivo (System-owned store o servicio independiente
operado bajo System) queda pendiente de diseño de despliegue. Hasta resolverla,
no se autoriza un segundo escritor de identidades.

### B. Namespace

#### Identificador canónico

- Forma conceptual vigente: `pc_usr_<ULID Crockford>` (prefijo más 26
  caracteres), como implementa hoy `system_identity.py`.
- El identificador es opaco, global dentro del namespace gobernado, inmutable
  y no derivado de email, nombre, rol, workspace ni ID de organización.
- Una identidad revocada no libera el valor; un `entity_id` nunca se recicla.
- El prefijo/formato observado es una compatibilidad técnica actual; cualquier
  cambio futuro necesita versionado y coexistencia sin cambiar IDs existentes.

#### Facultades

| Operación | Regla objetivo |
| --- | --- |
| Crear `entity_id` | Solo el servicio/operación autorizada por Identity System bajo System Core. El origen suministra su par `source` + `external_id`; no escoge ni construye el canónico. |
| Leer/resolver | Consumidores autenticados y autorizados según propósito mínimo. El Bridge recibe la referencia canónica necesaria para policy; no se infiere acceso de la mera capacidad de lectura. |
| Vincular perfil externo | Solo autoridad de identidad, tras validar que el origen está registrado y que el vínculo cuenta con evidencia aceptable. Email coincidente por sí solo no prueba identidad. |
| Suspender | Autoridad de System Identity bajo una acción auditada. Suspensión conserva ID y vínculos; no equivale a revocación de un perfil fuente ni cambia por sí misma datos de dominio. |
| Revocar | Solo proceso explícito de gobernanza/seguridad autorizado por System. Es una transición terminal lógica: conserva tombstone/auditoría, no elimina ni reutiliza el ID. El efecto en accesos lo debe consumir policy por su contrato propio; esta ADR no modifica policy. |

La unicidad se protege mediante IDs generados con entropía suficiente y
restricciones únicas para `entity_id` y `(source, external_id)` en el almacén
autoritativo. La creación es idempotente por referencia externa. Colisión de
generación, error de índice o resultado ambiguo no se trata como éxito:
detener, investigar y auditar. Un índice local que no se haya confirmado no es
prueba suficiente de unicidad.

### C. Ciclo de vida de identidad personal

La identidad personal nace cuando existe un principal durable en el sistema de
origen y Identity System registra explícitamente su referencia externa. El
momento exacto de elegibilidad de un principal One es **DECISIÓN PENDIENTE**:
cuenta creada, correo verificado, proveedor verificado o invitación aceptada.
Hasta decidirlo, el contrato prohíbe inferir materialización o membresía a
partir de un evento cercano.

| Evento de negocio | Regla contractual propuesta |
| --- | --- |
| Registro inicial One | Puede solicitar creación después de persistir el principal One y alcanzar el umbral de verificación aprobado. Debe ser idempotente; no concede workspace access. |
| Invitación profesional | La invitación pendiente no crea una identidad persona por sí sola. Tras aceptación/verificación se resuelve si crea una nueva identidad o se vincula a la ya autenticada. Nunca fusionar por email sin prueba explícita. |
| Creación de empresa | Crea una entidad de organización en su dominio/autoridad correspondiente, no un `entity_id` personal. La persona propietaria mantiene su identidad propia; el vínculo de owner es una relación. |
| Alta de agente | El rol/perfil de agente no crea identidad independiente. El agente persona debe ser un User canónico; la habilitación profesional/operativa es un vínculo/rol de dominio separado. |
| Vinculación Legal | No crea otra persona canónica si se ha probado que la persona ya existe; registra el ID nativo Legal como perfil externo bajo reglas aprobadas. Sin evidencia suficiente, el vínculo queda pendiente/conflictivo. Legal mantiene autoridad sobre sus cuentas y datos. |
| Migración futura | Se procesa por referencia externa estable, idempotente y auditable. No cambia `users.id`, JWT, foreign keys ni IDs Legal en la fase inicial. Conflictos quedan aislados; no usar email como merge key. |

Los eventos anteriores son un contrato de intención, no productores activos.
Esta ADR no implementa ni publica eventos.

### D. Relación de IDs con Legal Core y organizaciones

```text
Punto Cero One                    System Identity                 Legal Core
users.id ──(source, external_id)──> entity_id <──(source, external_id)── legal_user_id
                                      │
                                      └── relaciones a sistemas externos verificadas

companies.id / organización ── relación de negocio ── User(entity_id)
Legal organization_id / firm_id / tenant_id: IDs de entidades y dominio Legal
```

| Identificador | Dueño / significado | Restricción |
| --- | --- | --- |
| `users.id` | One; identifica su documento de usuario y sigue siendo referencia de JWT/sesiones y datos existentes. | No se reemplaza por `entity_id` en esta decisión. |
| `entity_id` | System Identity; ID global de una persona. | No representa empresa, firma, tenant, membership o workspace. |
| `legal_user_id` / `user_id_core` | Legal Core; referencia nativa de cuenta Legal. | Se conserva en Legal; solo se enlaza como perfil externo después de verificación y de definir un `source` permitido. |
| `organization_id`, `firm_id`, `tenant_id` | Dueño del dominio que los emite; identifican organizaciones/tenants, no personas. | No se guardan ni resuelven como `entity_id` personal. Su relación con usuarios se modela aparte. |

Legal Core sigue siendo autoridad sobre casos, clientes, documentos,
autorización y registros jurídicos. System Identity mantiene la identidad
transversal y, si se aprueba, una referencia mínima al ID Legal. No replica ni
reescribe las entidades Legal. No se crea una conexión ni un crosswalk en esta
fase.

### E. Conflictos y fallos

| Condición futura | Comportamiento contractual |
| --- | --- |
| Usuario sin `entity_id` | Estado no resuelto; no degradar a `users.id`, email o un ID aleatorio como sujeto canónico. El consumidor que requiera identidad rechaza/falla cerrado según su contrato existente. Reintento de materialización solo mediante operación idempotente autorizada. |
| `entity_id` duplicado | Violación de integridad; detener la escritura afectada, no elegir silenciosamente un registro, preservar evidencia y abrir incidente auditable. IDs ya emitidos no se renumeran para “reparar” referencias automáticamente. |
| Un perfil externo ligado a varios IDs | Conflicto de vínculo; bloquear resolución ambigua y no fusionar automáticamente. Reconciliación manual requiere evidencia, actor, motivo y auditoría de before/after. |
| Usuario con múltiples identidades canónicas | Tratar como conflicto de persona, no colapsar por email. Mantener accesos nuevos en fail-closed donde la identidad sea requisito y resolver por proceso explícito. |
| Empresa con owner inexistente | Mantener el registro de empresa intacto; marcar relación no resuelta fuera de una mutación automática. No crear usuario ni identidad para satisfacer `owner_id`; clasificar semillas, borrados o cohorte antes de reparar. |
| Sincronización/servicio fallido | No reportar materialización exitosa ni sustituir el canónico con un fallback. Registrar resultado reintentable e idempotente; la política de disponibilidad del login se mantiene sin cambios por esta ADR. |
| Fuente no registrada/revocada | Rechazar nuevas emisiones/vínculos para esa fuente; mantener referencias históricas legibles según el contrato de Registry y la política de retención aprobada. |

## Consecuencias

- Se conserva compatibilidad con múltiples verticales: cada sistema puede
  aportar su propio perfil externo a una identidad persona común, sin que
  vertical, provider, canal de sesión o rol sean el `source`.
- Organizaciones y workspaces pueden relacionarse con una persona sin
  confundirse con ella.
- El modelo facilita el enlace Legal sin trasladar autoridad ni datos legales.
- La separación lógica exige cerrar la frontera de despliegue y credenciales;
  hasta entonces el backend local permanece como implementación transitoria y
  no puede declararse un System remoto propietario en operación.
- El fail-closed actual del Bridge se mantiene sin cambios. Esta ADR no promete
  cobertura universal ni modifica el momento de creación.

## Contradicciones y límites documentales revisados

1. `ONE-SYSTEM-BOUNDARY.md` describía varios módulos presentes como “Core
   externo” y “solo proyección”, pero `system_identity.py` implementa
   persistencia/creación local y `server.py` solicita sus índices. La frontera
   se actualizó para distinguir autoridad lógica de ubicación actual.
2. El módulo `services/access_bridge.py` declara no persistir ni llamar a Core,
   mientras `routes/access_bridge_routes.py` consulta `system_identities` y
   ejecuta el contexto/entitlement local. No es contradicción de efectos del
   módulo intent, pero sí una diferencia entre nombre/expectativa de frontera
   y el camino de ruta integrado; se registra como deuda de topología. No se
   modifica la ruta.
3. `identity_registry.py` nombra `punto_cero_system` como dueño del namespace
   de `external_id`; los IDs `users.id` enlazados se generan en flujos One. La
   autoridad de `entity_id` queda propuesta aquí; quién emite y gobierna el ID
   externo debe confirmarse operacionalmente.
4. `ONE-IDENTITY-COVERAGE-AUDIT.md` midió 4/4 solo en la base local observada.
   Los documentos `ONE-CORE-READINESS.md` contienen conteos históricos de otras
   fechas/universos; no deben combinarse ni presentarse como cobertura actual
   por entorno sin repetir la auditoría con universo declarado.
5. El contrato del Access Bridge ya transporta `subject_id` y un bloque
   `identity.entity_id`; el contrato existente fija forma de respuesta, pero
   no establece por sí solo autoridad de almacenamiento, lifecycle ni
   materialización. Esta ADR no cambia ese contrato HTTP.

## Decisiones pendientes

- **DECISIÓN PENDIENTE:** umbral de creación One (alta, verificación, login o
  combinación) y semántica para invitaciones pendientes.
- **DECISIÓN PENDIENTE:** ubicación de datos y API/contrato de servicio para
  System Identity; separación física independiente vs servicio operado por
  System Core.
- **DECISIÓN PENDIENTE:** autoridad emisora del namespace `users.id` frente al
  token actual `punto_cero_system`.
- **DECISIÓN PENDIENTE:** onboarding de `legal` como fuente externa: prueba de
  identidad, owner del vínculo, valores/verificación de `source` y reconciliación.
- **DECISIÓN PENDIENTE:** política de suspensión/revocación de identidad y
  cómo cada consumidor la interpreta sin confluir con workspace lifecycle o
  account status.
- **DECISIÓN PENDIENTE:** retención/auditoría de perfiles externos revocados
  y autoridad para merge/split.

## Referencias

- [ONE-IDENTITY-AUDIT.md](./ONE-IDENTITY-AUDIT.md)
- [ONE-IDENTITY-COVERAGE-AUDIT.md](./ONE-IDENTITY-COVERAGE-AUDIT.md)
- [ONE-IDENTITY-CONTRACT.md](./ONE-IDENTITY-CONTRACT.md)
- [ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md)
- [test_access_bridge_contract.py](../../backend/tests/test_access_bridge_contract.py)
- [test_system_identity.py](../../backend/tests/test_system_identity.py)
