# Identity Ownership Operating Model

**Fecha:** 2026-10-03  
**Estado:** Propuesta operativa; no habilitada en runtime.  
**Alcance:** autoridad, escritura, validación, IDs y gestión de conflictos de
`entity_id`. No modifica autenticación, autorización, persistencia ni Legal Core.

## 1. Resumen

La propuesta conserva a **Punto Cero System Core** como autoridad lógica de la
identidad persona y recomienda que una única capacidad Identity Authority
operada bajo ese Core sea el escritor de `system_identities`. One sigue siendo
propietario de sus usuarios y emite/retiene `users.id`; los verticales aportan
referencias externas verificables. Legal Core retiene sus IDs y sus datos.

La autoridad lógica no resuelve por sí sola el despliegue: hoy el código de
`system_identity.py`, la lectura del Access Bridge y los índices residen en el
backend/base configurada por One. La opción de servicio físicamente separado,
la ubicación de almacenamiento y el transporte son **DECISIONES PENDIENTES DE
PRODUCTO/ARQUITECTURA**. Hasta resolverlas, no se debe crear un segundo escritor
ni tratar el almacén local actual como prueba de una autoridad remota.

## A. Ownership lógico vs ownership operativo

### Estado actual observado

| Pregunta | Hallazgo |
| --- | --- |
| ¿Quién escribe `system_identities` en las rutas de producto actuales? | Ninguna ruta productiva encontrada llama a `create_system_identity()` ni a `project_user_identity(..., create_missing=True)`. La creación existe como función en `backend/services/system_identity.py`; pruebas y llamadas explícitas pueden usarla, pero el alta normal no materializa `entity_id`. |
| ¿Quién puede escribir técnicamente? | Código importable del backend One que llama a `create_system_identity()`, `link_profile()` o a los resolvers con `create_missing=True`. No hay una frontera API que impida a cualquier otro caller del proceso escribir si obtiene acceso al objeto DB. |
| ¿Quién lee? | `routes/access_bridge_routes.py` llama a `resolve_system_identity()` en modo lectura sobre `request.app.state.db`; no crea identidad. `auth_routes.py` usa otro resolver de contexto, `identity_core.resolve_identity()`, que compara `users.id` y no lee `entity_id`. |
| ¿Quién crea IDs actualmente? | `system_identity.py` genera el valor `pc_usr_*` al crear una identidad; las funciones de creación aceptan la base y los datos del perfil externo. |
| ¿Quién indexa? | `server.py` llama a `ensure_system_identity_indexes()` durante startup. La llamada a índices no equivale a crear identidades; los errores se registran y el startup continúa. |
| ¿Quién valida? | `system_identity.py` valida formato y fuente contra `identity_registry`; `access_bridge_routes.py` comprueba que el ID resuelto sea válido; `policy_can` también valida `entity_id` antes de autorizar. La validación de formato no prueba ownership de cuenta, titularidad de perfil ni estado operativo de despliegue. |

### Autoridad futura propuesta

Separar los roles de autoridad, sin duplicar escritores:

| Rol | Responsable objetivo | Permiso / límite |
| --- | --- | --- |
| **Creador** | Identity Authority operada bajo System Core | Único escritor de `entity_id` y de vínculos canónicos. Crea idempotentemente a partir de `(source, external_id)` registrado; nunca recibe el `entity_id` elegido por el origen. |
| **Lector / resolver** | Identity Authority; expone resolución autorizada a consumidores aprobados | Devuelve mínimo dato necesario y estado de resolución. No expone perfiles o PII por defecto ni concede acceso. |
| **Validador** | Identity Authority valida namespace, formato, pertenencia única y estado; cada consumidor valida además el contrato aplicable a su operación | `policy_can` conserva validación de sujeto/permiso. El Access Bridge no crea ni modifica identidad. |
| **Auditor** | Servicio de auditoría de System Identity o autoridad append-only aprobada por System Core | Registra creación, verificación, link, conflicto, suspensión, revocación y adjudicación; separado del actor que solicita la acción. |
| **Consumidor** | Access Bridge y futuros verticales autenticados | Consume ID/resultado de resolución para la finalidad declarada. Un `entity_id` válido no es entitlement ni autorización. |
| **Origen de perfil** | One, Legal u otro System registrado | Emite y mantiene su ID nativo; demuestra la evidencia exigida y solicita la operación permitida. No crea `entity_id` ni enlaza IDs de terceros unilateralmente. |

**DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** si la Identity Authority se
despliega como componente dentro de System Core o como servicio independiente
con operación y SLO propios. Un servicio separado puede ser opción de hosting,
no una autoridad adicional.

### ¿Qué componente debería escribir y validar?

Debe escribir la autoridad canónica de Identity System bajo System Core, no
One ni cada vertical. Debe validar tanto que `source` esté habilitado como que
el perfil externo pertenezca a una sola identidad, y que cualquier verificación
esté sustentada por el sistema dueño del ID fuente. Los consumidores validan
su propio uso (por ejemplo, sujeto de policy), no sustituyen la verificación de
identidad.

## B. Namespace de `entity_id`

### Propuesta

- **Formato compatible observado:** `pc_usr_<ULID Crockford>`; prefijo más 26
  caracteres según el validador actual.
- **Semántica:** identificador opaco, inmutable y global de una persona dentro
  del namespace gobernado por System Identity. No incorpora email, ID de
  vertical, workspace, tenant ni datos de organización.
- **Unicidad:** cada identidad recibe exactamente un `entity_id`; cada par
  `(source, external_id)` verificado apunta como máximo a un `entity_id`.
  Reintentar la misma operación produce el vínculo existente, no otra persona.
- **Colisiones:** generador con entropía suficiente más restricción única en el
  almacén autoritativo. Una colisión o fallo del índice es error/investigación,
  nunca éxito alternativo ni reasignación silenciosa.
- **Alcance global:** transversal entre One, Legal y futuros Sistemas solo
  después de registrar y verificar cada fuente. “Global” no implica exponer el
  identificador sin autorización ni que todos los IDs externos estén
  automáticamente reconciliados.
- **Retiro:** no reutilizar ni reciclar un ID suspendido o revocado. Mantener un
  tombstone conforme a política de privacidad/retención pendiente.
- **Namespace organizacional:** si se requieren IDs de organización, deben tener
  tipo y autoridad separados. No usar `pc_usr_*` para organizaciones.

`entity_id` representa únicamente a una persona; no debe representar:

- empresa;
- tenant;
- workspace;
- firma jurídica;
- vertical;
- grupo comunitario, cuenta de proveedor ni membership.

### Fuentes y extensibilidad multi-vertical

`source` nombra el Sistema dueño del `external_id`, no el canal de login, el
proveedor social, la vertical o el workspace. La implementación actual declara
`punto_cero_system` como único owner token emisor; `community` y `workspace`
son tokens históricos de compatibilidad y no emiten identidades nuevas.
Legal y otras verticales no deben incorporarse como fuentes hasta que su
owner, prueba de control del ID y ciclo de retiro sean aprobados en Registry.

## C. Relación de IDs

| Sistema | ID | Propietario | Uso |
| --- | --- | --- | --- |
| Punto Cero One | `users.id` | One | Clave nativa del usuario One; referencias actuales desde JWT `sub`, `user_sessions`, perfil, relaciones de producto y empresas. No es el ID canónico transversal. |
| Identity System | `entity_id` (`pc_usr_*`) | System Core lógico; actualmente implementación/almacenamiento local no separado | Identidad canónica de una persona, compartible entre fuentes tras vínculo verificado. |
| Organización | `organization_id` / `companies.id` | Dominio que crea la organización; One para `companies.id` actual | Identifica empresa/organización, no persona. `owner_id`/team son relaciones a usuarios, no identidad de organización en System Identity. |
| Tenant | `tenant_id` | Tenant Core / sistema propietario | Límite de tenancy/datos; no es persona, organización necesariamente equivalente ni workspace. La equivalencia exacta tenant↔organización está pendiente de diseño. |
| Punto Cero Legal | `legal_id` / `user_id_core` | Legal Core | ID nativo de usuario Legal. Puede ser una referencia externa futura en un link verificado; no se reescribe ni se infiere por email. “legal_id” no está demostrado como nombre canónico único del contrato actual. |
| Workspace Registry | `workspace_id` / `space_key` | Workspace Registry (System) | Identifica un espacio/producto. `space_key` es la referencia observada en contratos; `workspace_id` puede ser vocabulario de Core Legal y no debe asumirse idéntico sin contrato. No es persona ni membership. |

**DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** normalizar nombres y
crosswalks de `legal_id`, `user_id_core`, `organization_id`, `tenant_id`,
`firm_id`, `workspace_id` y `space_key`. Esta tabla preserva la semántica
verificada, no declara equivalencias implícitas.

## D. Momento de creación: alternativas

| Opción | Seguridad | Complejidad | Rollback | Experiencia de usuario |
| --- | --- | --- | --- | --- |
| **1. Crear al registro One** | Requiere verificar unicidad/control del principal y definir qué significa una cuenta email no verificada o social. Riesgo de crear identidades para registros incompletos; no debe fusionar por email. | Acopla el registro a Identity Authority o requiere cola/outbox, idempotencia y recuperación. | Se puede desactivar el productor conservando IDs emitidos; no borrar ni reciclar identidades. | Puede ser transparente y uniforme; un fallo externo no debe cambiar reglas de login actuales. |
| **2. Crear al primer vínculo profesional/Legal** | Puede apoyarse en evidencia más fuerte del flujo profesional/Legal, pero identidad básica queda ausente hasta ese hito. Invitaciones y cuentas previas siguen sin ID canónico. | Menos presión en registro, pero cada vertical necesita disparar la misma operación y resolver carreras. | Desactivar el flujo de enlace; conservar vínculos ya creados. | La primera entrada a vertical puede introducir demora o pedir validación; riesgo de experiencia distinta entre verticales. |
| **3. Crear mediante Identity Service independiente** | Aísla emisión y permite enforcement central; su seguridad depende de autenticación de origen, autorización de fuente y disponibilidad/operación. | Requiere nuevo servicio, contratos de red, SLO, seguridad, observabilidad, reintentos y degradación. | Puede desconectar el consumidor/productor, preservando entidades; la continuidad depende del modo cache/read. | Alta puede ocurrir en segundo plano, pero el fallo de red y latencia necesitan UX. |

### Recomendación operativa

La recomendación arquitectónica es **un solo creador bajo System Core**. La
opción de servicio independiente es una alternativa de despliegue para esa
autoridad, no una selección ya tomada. Para materialización, se recomienda una
primera fase de operación explícita y asíncrona después de que One persista un
principal elegible y exista la prueba de control definida. No bloquear ni
alterar login por fallos de identidad durante la observación inicial; mantener
el comportamiento fail-closed del Bridge cuando una operación requiera
`entity_id`. El umbral exacto entre registro verificado y primer vínculo
profesional/Legal es **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA**.

## E. Modelo futuro de escritura

Flujo conceptual, sin endpoints ni eventos implementados:

```text
One / sistema origen
  └─ create identity request(source, external_id, idempotency key)
       └─ Identity Authority: validate source + evidence + uniqueness
            ├─ create pending identity/link OR return existing mapping
            ├─ verify identity/link using source-owned evidence
            ├─ activate resolution only after verification policy passes
            └─ append audit outcome

Later source:
  └─ link profile(existing entity_id, source, external_id, evidence)
       └─ reject / pending / link verified / conflict; never auto-merge
```

1. **Create identity:** la autoridad valida el Sistema emisor, referencia
   externa estable, clave de idempotencia y elegibilidad. Devuelve un resultado
   tipado; no copia perfil completo ni concede membresías.
2. **Verify identity:** la autoridad contrasta evidencia con el Sistema dueño
   de la referencia. `email` puede indicar colisión, pero no verifica por sí
   solo igualdad de persona. Verificación y estado de cuenta son ejes distintos.
3. **Link profile:** añadir otro par `(source, external_id)` requiere prueba
   controlada del origen y unicidad. El vínculo a Legal requiere aprobación y
   soporte de `source` antes de usarse.
4. **Audit identity:** cada intento y transición registra actor, sistema,
   correlación/idempotencia, resultado, razón/evidencia de referencia,
   timestamps y estados antes/después. Minimizar PII y nunca registrar
   credenciales/tokens.
5. **Consume:** Bridge y policy reciben el sujeto canónico únicamente después
   de la resolución autorizada; ninguna respuesta positiva de identidad se
   convierte por sí sola en permiso.

**DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** campos mínimos del request,
mecanismo de autenticación de sistemas, formato de resultado/error y fuente de
prueba para cada origen. No se definen APIs nuevas en esta fase.

## F. Conflictos

| Condición | Tratamiento futuro |
| --- | --- |
| Identidad duplicada (`entity_id` repetido) | Fallo de integridad; detener operación afectada, preservar evidencia y elevar incidente. No elegir “la primera” ni renumerar referencias automáticamente. |
| Email repetido | Señal de colisión/revisión, nunca clave de fusión. Mantener cuentas/identidades separadas hasta prueba y adjudicación autorizada. |
| Usuario sin `entity_id` | Estado no resuelto; no usar `users.id`, email ni ID aleatorio como sustituto canónico. La experiencia de login se mantiene independiente; operación que requiera identidad sigue el contrato existente y falla cerrado. |
| Perfil huérfano (source/external_id sin identidad resoluble) | Retener como conflicto/pending de reconciliación; verificar existencia en el sistema dueño. No crear usuario fuente ni borrar el perfil automáticamente. |
| Perfil externo ligado a varias identidades | Poner resolución en conflicto; bloquear linking/resolución ambigua. Reconciliación solo con evidencia, aprobador, razón y audit trail. |
| Merge | Operación excepcional de adjudicación; preservar alias/crosswalks históricos y auditar before/after. No se autoriza merge automático por email, nombre, empresa compartida o sesión. Campos, autoridad y tratamiento de datos quedan pendientes. |
| Split | Operación excepcional si una entidad agrupa personas distintas; demostrar propiedad de cada perfil, separar links con referencias trazables y evaluar impactos de downstream. No emitir acceso durante la ambigüedad. |
| Owner de empresa inexistente | No crear `User`/`entity_id` por inferencia ni cambiar la empresa. Clasificar borrado, semilla o cohorte ausente; remediación separada con dueño de datos. |
| Fallo de red/sincronización | Resultado explícito pendiente/no resuelto, reintento idempotente y auditoría. No responder éxito ficticio ni degradar a otro ID. Login no cambia por este contrato. |
| Identity Authority fuera de servicio | No permitir escrituras locales alternas. Comportamiento de lecturas/cache requiere ADR de disponibilidad; mientras tanto, el consumidor aplica su contrato actual (Bridge fail-closed al faltar sujeto). |

## Riesgos operativos

- La implementación local y la autoridad lógica propuesta están en fronteras
  distintas; una futura separación sin autoridad única puede producir escritores
  duales o carreras.
- El índice único compuesto existente es garantía solo si está creado y el
  almacén que lo aplica es la autoridad efectiva; el startup actualmente sigue
  tras registrar fallo de índices.
- Un servicio de identidad añade disponibilidad y latencia a flujos críticos;
  el contrato de degradación todavía está pendiente.
- `punto_cero_system` se registra como owner del namespace de `external_id`,
  pero One genera los `users.id` que hoy se guardan con ese `source`. La
  autoridad emisora de IDs externos necesita aclaración.
- Legal no está habilitado actualmente como fuente emisora; no debe usarse el
  modelo de linking propuesto como si esa integración existiese.
- Las métricas de cobertura local son un snapshot pequeño y no dan cobertura
  de producción.

## Revisión de coherencia documental

Se revisaron [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md),
[IDENTITY-LIFECYCLE-CONTRACT.md](./IDENTITY-LIFECYCLE-CONTRACT.md),
[ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md) y el contrato/camino de
Access Bridge. No se detectó una contradicción conceptual no resuelta entre los
documentos: la ADR propone System Core como autoridad lógica, el lifecycle
describe creación/link/verificación conceptual, y la frontera distingue esa
autoridad del backend/base local actuales. Sí permanecen estos desfases:

1. **Ownership lógico vs ubicación operativa:** la propuesta asigna la
   autoridad a System Core, mientras el servicio, colección, índices y lectura
   están hoy en la implementación One. Es una separación aún no materializada,
   no evidencia de un servicio System desplegado.
2. **Owner del namespace externo:** el Registry nombra `punto_cero_system` como
   emisor permitido, mientras el flujo One crea los `users.id` que se usan como
   `external_id`. No se ha reconciliado quién emite y quién gobierna ese ID.
3. **Módulo vs ruta de Access Bridge:** `services/access_bridge.py` prepara
   intents sin I/O de Mongo/red; `routes/access_bridge_routes.py` sí consulta
   Mongo para resolver identidad y construir el contexto. El contrato de
   respuesta (`subject_id` y `identity.entity_id`) fija forma, no ownership,
   almacenamiento ni lifecycle. No cambiar ninguno en esta fase.
4. **Lifecycle todavía conceptual:** sus estados de Identity/Profile Link no
   equivalen a estados de usuario, workspace, membership o permisos y no son
   una descripción del runtime persistido.

Estos puntos quedan abiertos; esta documentación no modifica los contratos
previos ni resuelve topología, operación, elegibilidad o namespaces.

## Decisiones pendientes

- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** System Core embebido vs
  servicio físico independiente bajo esa gobernanza.
- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** almacenamiento canónico,
  credenciales y operación del índice.
- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** cuándo un usuario One es
  elegible para recibir `entity_id`.
- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** naming y ownership operativo
  de `external_id` y fuentes Legal/futuros verticales.
- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** pruebas, actores y proceso
  autorizado de merge/split y revocación.
- **DECISIÓN PENDIENTE DE PRODUCTO/ARQUITECTURA:** disponibilidad, cache,
  timeout, reintento y efecto de servicio caído por consumidor.

## Documentos relacionados

- [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md)
- [IDENTITY-LIFECYCLE-CONTRACT.md](./IDENTITY-LIFECYCLE-CONTRACT.md)
- [IDENTITY-MATERIALIZATION-PLAN.md](./IDENTITY-MATERIALIZATION-PLAN.md)
- [ONE-IDENTITY-COVERAGE-AUDIT.md](./ONE-IDENTITY-COVERAGE-AUDIT.md)
- [ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md)
