# Auditoría de cobertura y ownership de One Identity

**Fecha:** 2026-10-03
**Alcance:** auditoría de código y métricas locales agregadas, solo lectura.
**Cambios de runtime/datos:** ninguno.

## 1. Resumen ejecutivo

- El servicio que implementa la creación y resolución de `system_identities`
  está físicamente en `backend/services/system_identity.py`, dentro del backend
  de One. El Access Bridge consulta esa colección en la misma base Mongo
  configurada por One.
- La frontera documentada asigna la propiedad de `system_identities` a System.
  La recomendación es que la autoridad de identidad sea **Identity System /
  System Core**, no el producto One ni una API backend genérica. One debe ser
  dueño de sus cuentas/perfiles y origen de una referencia externa estable.
  Hoy esa separación es arquitectónica, no una frontera de despliegue
  demostrada.
- En la base **local** `punto_cero_local`, consultada en modo lectura el
  2026-10-03, hay 4 documentos `users` y 4 `system_identities`. Los 4 usuarios
  se enlazan a exactamente una identidad válida (`4/4`, **100%**). No se
  observaron perfiles huérfanos, identidades múltiples para el mismo ID
  externo, IDs canónicos duplicados ni emails duplicados tras normalización.
- Ese 100% describe únicamente esta base local de cuatro usuarios. No demuestra
  cobertura de producción, de otros entornos, de todos los usuarios históricos
  ni de usuarios del Legal Core.
- Los flujos de registro, invitación, login y perfil no materializan
  `entity_id`. El servicio permite crearlo con `create_missing=True`, pero las
  rutas productivas encontradas resuelven en modo lectura. Los índices sí se
  solicitan durante el startup: indexar no crea documentos de identidad.
- Hay 41 `companies` en la misma base local; ningún `owner_id` de esos 41
  documentos corresponde a los 4 `users` actuales y no hay `team[].user_id`.
  Esto es una discrepancia de referencias observada en este snapshot, no prueba
  por sí sola que los documentos de empresa sean inválidos: pueden ser
  entidades sembradas o pertenecer a otra cohorte de usuarios.
- No se encontró un modelo/colección de One para organizaciones, profesionales,
  agentes o firmas. Los profesionales son atributos del perfil `users`; Legal
  expone referencias en un contexto adaptado, pero no se consultó su base ni se
  encontró un vínculo persistido con `entity_id`.

## 2. Arquitectura actual

```text
JWT / cookie / perfil / invitación
              │
              ▼
       One backend: users.id
              │
              │ referencia externa (source, external_id)
              ▼
 backend/services/system_identity.py
        system_identities
              │
              ▼
 access_bridge_routes → resolve_system_identity (solo lectura)
              │
              ├── identity_core (contexto, organizaciones/verticales)
              └── entitlement_service → policy_can
```

### Implementación y lecturas observadas

1. `system_identity.py` define `COLLECTION = "system_identities"`, el formato
   `pc_usr_*`, el Registry de fuentes, la creación (`create_system_identity`),
   el enlace (`link_profile`) y la resolución.
2. Un perfil se referencia mediante `(source, external_id)`; el servicio
   declara un índice único compuesto sobre esos campos y otro único para
   `entity_id`. `identity_registry.py` declara
   `punto_cero_system` como propietario del namespace y no permite emitir
   perfiles nuevos desde los tokens históricos `community` o `workspace`.
3. `server.py` invoca `ensure_system_identity_indexes()` durante el startup.
   Si falla, registra una advertencia y continúa. Esta llamada solicita
   índices; no llama a `create_system_identity` ni proyecta usuarios.
4. `routes/access_bridge_routes.py` llama a `resolve_system_identity()` sin
   `create_missing=True`; si no obtiene un `entity_id` válido, devuelve
   `403 identity_unresolved`. El fallo cerrado hace visible una cobertura
   incompleta, pero no la repara.
5. `identity_core.resolve_identity()` es una proyección distinta y de solo
   lectura: compara los `users.id` de las sesiones, calcula contexto y resuelve
   organizaciones. No crea `entity_id`.

### Ownership: autoridad vs implementación

| Aspecto | Hallazgo |
| --- | --- |
| Autoridad declarada | `ONE-SYSTEM-BOUNDARY.md` asigna `system_identities` a System y a One las colecciones `users`, `companies` y demás datos del producto. |
| Código que crea la identidad | `backend/services/system_identity.py`, incluido en este repositorio. |
| Base que lee el Bridge | La base `db` configurada por One en `server.py`; allí también se solicitan los índices. |
| Productor de la referencia externa | Los flujos de One generan `users.id`; sin embargo, `identity_registry.py` nombra a `punto_cero_system` como propietario del namespace que se usa como `source`. |
| Decisión recomendada | Identity System / System Core debe ser autoridad y propietario lógico de `entity_id` y de los vínculos canónicos. One conserva `users.id` como ID propio y publica una referencia externa estable. El punto de despliegue/almacenamiento debe resolverse explícitamente antes de separar servicios. |
| Ciclo de importación | No se encontró una dependencia circular de Python: `system_identity` depende de `identity_registry`; `policy_can` y Access Bridge consumen validación/resolución. Sí hay acoplamiento operativo: Bridge, política y startup dependen de una implementación local y de la misma base Mongo. |

Hay una inconsistencia de frontera que debe resolverse: el nombre del token
propietario (`punto_cero_system`) y la documentación dicen que System posee el
namespace, mientras que los IDs que se enlazan (`users.id`) los emiten los
flujos de One. La convención actual hace funcionar la clave de referencia,
pero el código revisado no prueba por sí solo cuál servicio tiene autoridad
organizacional sobre ese namespace.

**Corrección respecto de la auditoría inicial:** la nota anterior decía que
`ensure_indexes()` no estaba conectado al startup. La lectura actual de
`server.py` muestra lo contrario: se solicita durante `ensure_indexes()` del
servidor. Esa corrección ya se aplicó en
`ONE-IDENTITY-AUDIT.md`. No se encontró materialización de identidades en el
startup.

## 3. Tabla de cobertura

Las métricas con denominador corresponden solo al snapshot de Mongo local
`punto_cero_local` del 2026-10-03. Los conteos son agregados; no se leyeron ni
incluyeron valores personales en este documento.

| Entidad / cohorte | Tiene `entity_id` | Fuente / evidencia | Riesgo |
| --- | --- | --- | --- |
| Usuarios One (`users`) | **4/4 (100%)**, exactamente una identidad válida cada uno | `profiles[].source = punto_cero_system`, `external_id = users.id`; validación con `is_valid_entity_id` | Bajo en este snapshot, pero muestra pequeña y local; no generalizar a otros entornos. |
| Perfil/credenciales en el dominio de comunidad | No hay una colección separada que permita contarla independientemente; los 4 documentos `users` tienen identidad | `auth_providers[]` y atributos de perfil viven en `users`; la cookie `user_sessions.user_id` apunta a `users.id` | El 4/4 mide cobertura de documentos `users`, no demuestra que los 4 usuarios tengan actividad o perfil comunitario completo. |
| Perfiles profesionales | **3/3 usuarios con señal de perfil profesional** enlazados | Campos de perfil como `verticals`, `specialties`, `skills`, `headline`, `current_title` o `legal_role`; schemas en `models_profile.py` y almacenamiento en `users` | Es una señal por campos, no un padrón de profesionales verificados ni un conteo exhaustivo de profesión. |
| Organizaciones | **No hay `organizations`** en la base local; no hay cobertura canónica organizacional definida | `companies` es el modelo de organización más cercano; no tiene `entity_id` | No existe identidad organizacional/tenancy unificada; no asignar el `entity_id` de una persona a una empresa. |
| Empresas (`companies`) | Sin `entity_id` propio; **0/41 `owner_id`** coinciden con los 4 IDs de usuario actuales | `CompanyPublic.owner_id`, `TeamMember.user_id`; 41 documentos, 0 vínculos de equipo con `user_id` en el snapshot | Referencias no resueltas contra esta pequeña cohorte; puede ser población semilla o usuarios de otra fuente. Requiere clasificar antes de reconciliar. |
| Agentes | **No medible como entidad**; colección `agents` ausente y 0 usuarios con `role=agent` en este snapshot | No se encontró ruta/modelo de onboarding de agentes; `agent` existe como valor de rol tipado | El rol no constituye una entidad ni prueba una identidad, afiliación o acceso. |
| Firmas | **No hay modelo/colección local de `firms`** | Los nombres `firm_id`/`organization_id` aparecen en el contexto adaptado desde Legal Core | IDs y cobertura pertenecen a otra frontera; no hay crosswalk local verificable. |
| Usuarios Legal Core | **No medible**; no se consultó la base Legal y no hay vínculo persistido identificado | `coreLegalContext.js` recibe `user_id_core`; el adaptador de datos normaliza respuestas de Legal. No hay perfiles con `source=legal` en la base local | La ausencia local no prueba ausencia en Legal. El token `legal` no es una fuente emisora habilitada por el Registry actual. |
| Membresías de grupos | No son identidades canónicas | `group_members` enlaza `user_id` y `group_id`, con rol de grupo | Relación de dominio, no `WorkspaceMembership`; no inferir `entity_id` ni autorización universal. |
| `user_workspaces` | No es población de miembros ni entidad persona | Guarda layout, widgets y preferencias por `user_id` | El nombre puede confundirse con membresía de Workspace; no usarlo para calcular cobertura. |

### Integridad del snapshot local

| Comprobación | Resultado |
| --- | ---: |
| Usuarios con exactamente una identidad canónica | 4/4 |
| Usuarios sin identidad canónica | 0 |
| Usuarios ligados a más de un `entity_id` | 0 |
| `entity_id` válido según el validador del servicio | 4/4 |
| `entity_id` duplicados | 0 |
| Mismo perfil `punto_cero_system` en varios documentos de identidad | 0 |
| Perfiles de propietario sin `external_id` | 0 |
| Documentos de identidad sin perfiles | 0 |
| Perfiles cuyo `external_id` no corresponde a usuario actual | 0 |
| Emails duplicados después de trim/lowercase | 0 |
| Perfiles con `source=legal` | 0 en esta base local; no es una consulta a Legal Core |

## 4. Flujos auditados y nacimiento de identidad

| Flujo | Efecto observado hoy | ¿Crea `entity_id`? |
| --- | --- | --- |
| Registro comunitario con proveedor | Crea un documento `users` con `user_<random>` y `auth_providers[]`, o enlaza credencial al usuario que ya existe tras los controles establecidos. | **No** |
| Registro comunitario por email/contraseña | Crea un documento `users` y emite cookie de sesión. | **No** |
| Login por cookie o JWT | Busca el usuario y crea/actualiza estado de sesión/login; el JWT lleva `users.id` como `sub`. | **No** |
| Invitación de inversionista | Crea un usuario provisional o actualiza uno existente; la aceptación configura contraseña y consume invitación. | **No** |
| Edición/creación de perfil profesional | Actualiza atributos ricos en el mismo `users`; no hay colección o ruta de alta profesional separada localizada. | **No** |
| Creación de empresa | Crea un documento `companies` con `owner_id = users.id` del solicitante; equipo embebido es opcional. | **No** |
| Alta de agente | No se encontró flujo/entidad dedicada; `agent` solo aparece en vocabulario de roles. | **No hay flujo encontrado** |
| Alta de usuario administrador | `server.seed_admin()` inserta el usuario si no existe. | **No** |
| Startup | Solicita índices de `system_identities` y continúa si hay error de índice. | **No** |
| Llamada directa de proyección | `project_user_identity(..., create_missing=True)` puede crear el documento; `resolve_system_identity(..., create_missing=True)` también puede hacerlo. | **Sí, si se invoca explícitamente** |
| Rutas productivas del Bridge | `resolve_system_identity()` se invoca sin activar creación y falla cerrado si no hay vínculo. | **No; solo lectura** |

Por tanto, en los flujos de producto revisados no hay un evento productivo
demostrado que haga nacer la identidad canónica. El servicio de creación
dispone de esa capacidad, pero la cobertura encontrada en la base local no
permite atribuir quién ni cuándo creó esas cuatro identidades. `generate_entity_id()`
en scripts de simulación puede producir IDs de vista previa, pero no es una
materialización persistida.

## 5. Conflictos y consistencia entre dominios

### Observados en la base local

- No se encontraron usuarios de la base local sin identidad ni una referencia
  `punto_cero_system` que apunte a más de una identidad.
- No se encontraron documentos de identidad sin perfil, IDs canónicos
  duplicados o perfiles del propietario sin `external_id`.
- No se encontraron duplicados de email normalizado entre los cuatro usuarios.
- Los 41 `companies` no referencian como owner a ninguno de los cuatro usuarios
  actuales y no incluyen referencias `team[].user_id`. La evidencia no permite
  determinar si son semillas públicas, registros históricos o referencias a
  una cohorte no presente.

### No verificables desde este repositorio/entorno

- Cobertura real de producción o de otras bases/entornos: no se consultaron.
- Usuarios, firmas, organizaciones y profesionales persistidos en Legal Core:
  no hay conexión ni modelos de esa base en esta auditoría.
- Si existe una copia externa de `system_identities` además de la colección
  leída por One: el código revisado consulta la base configurada en `server.py`,
  pero no acredita topología de despliegue.
- Duplicados semánticos de personas entre `users` y Legal: un email coincidente
  no fue consultado ni sería prueba suficiente de identidad común.

### Conflictos que el diseño actual puede detectar o bloquear

- `identity_core.resolve_identity()` devuelve conflicto de sesión si JWT y
  cookie apuntan a distintos `users.id`; no fusiona usuarios.
- `system_identity.link_profile()` rechaza enlazar un perfil que ya pertenece
  a otro `entity_id`.
- La unicidad declarada del par `(source, external_id)` y del `entity_id`
  pretende prevenir enlaces duplicados una vez que los índices están creados.
- No existe operación de merge/split de identidades en el alcance auditado.
  La colisión de email en el login social se trata como vínculo de credencial
  sujeto a reglas y confirmación, no como fusión automática de identidades.

## 6. Riesgos

1. **Ownership dividido entre contrato y despliegue.** System se declara dueño,
   pero el backend de One crea/consulta la colección y solicita sus índices
   contra su propia base.
2. **Namespace ambiguo.** Registry declara `punto_cero_system` dueño de los
   IDs externos, aunque los IDs enlazados se generan en rutas de One. Hay que
   decidir qué proceso emite y gobierna ese namespace.
3. **No hay materialización al crear el usuario.** Los registros nuevos pueden
   autenticarse correctamente y aun así carecer de `entity_id`; el Bridge
   entonces deniega identidad no resuelta. El índice de startup no soluciona
   esa brecha.
4. **Métricas pequeñas y no extrapolables.** El 100% observado representa solo
   cuatro usuarios de una base local; un porcentaje sin universo/entorno
   especificado sería engañoso.
5. **Referencias de empresas no explicadas.** El snapshot presenta 41 owners
   no resueltos a los cuatro usuarios actuales. Reconciliarlos automáticamente
   sería inseguro.
6. **No existe identidad de organización en este dominio.** Empresa, firma y
   persona son tipos de entidad distintos; el modelo actual no proporciona un
   `entity_id` organizacional ni una tenancy equivalente.
7. **La frontera Legal no ofrece crosswalk auditable.** Los adaptadores
   normalizan contexto/datos, pero no prueban que `user_id_core` y una
   identidad One correspondan a la misma persona.
8. **Disponibilidad del índice en startup.** Los errores al crear los índices
   se registran como warning y el servidor continúa. La operación puede quedar
   activa aunque la garantía de unicidad prevista no se haya verificado en ese
   arranque.

## 7. Decisiones pendientes

- Confirmar la autoridad organizacional del namespace que emite `users.id` y
  su relación con `source=punto_cero_system`.
- Decidir ownership de datos y operación: colección propiedad de Identity
  System con una interfaz explícita, o almacenamiento transitorio en la misma
  base bajo una frontera contractual/operativa definida. El código actual no
  demuestra un servicio remoto.
- Definir el evento y momento de materialización: alta persistida, verificación
  de email/proveedor o aceptación de invitación. Debe contemplar el usuario
  provisional de invitación sin convertirlo en acceso a workspace.
- Acordar universo y procedimiento de métricas por entorno; no derivar
  producción desde esta base local ni desde un readiness report histórico.
- Clasificar los 41 `companies` y sus `owner_id` sin fusionar por email ni
  reescribir IDs antes de saber qué población representan.
- Definir el vínculo con usuarios/firms de Legal Core, quién lo confirma y qué
  identificador externo puede emitirse para ese origen. `legal` no está
  actualmente habilitado como fuente emisora en `identity_registry`.
- Definir política explícita para perfiles en conflicto, operaciones de merge
  o split, identidad huérfana y recuperación/reintento.

## 8. Contrato técnico propuesto para materialización futura

Sin implementación en esta fase:

1. **Fuente de verdad:** Identity System / System Core es autoridad de
   `entity_id`, su inmutabilidad y el mapa de perfiles externos. One es dueño
   del registro y autenticación One, y conserva `users.id` como referencia
   externa; no debe emitir o reasignar un `entity_id` por cuenta propia.
2. **Evento de creación:** después de que el principal One se haya persistido,
   One publica un evento idempotente con su `source` autorizado y `external_id`
   estable. El servicio propietario crea o recupera el `entity_id`. El
   significado exacto de “principal creado” para email no verificado e
   invitaciones sigue siendo una decisión pendiente. No usar email como clave
   de idempotencia o de fusión.
3. **Consistencia:** el evento debe ser recuperable y reintentable sin emitir
   identidades duplicadas. La identidad canónica y las referencias previas de
   One se mantienen separadas; no cambiar JWT, sesiones ni claves foráneas
   durante el primer despliegue.
4. **Rollback:** detener la emisión/consumidor nuevo y volver a la ruta de
   lectura vigente, sin borrar ni reciclar `entity_id`. Conservar los vínculos
   ya materializados para reconciliación; no hacer rollback mediante
   `users.id` reescrito ni merge inverso automático. Cualquier nueva lectura
   debe habilitarse separadamente y poder desactivarse.
5. **Conflictos:** un perfil externo asociado a más de un `entity_id`, un
   email colisionado o IDs inconsistentes se pone en estado de conflicto y no
   se fusiona automáticamente. Mantener la decisión manual/auditable y fail
   closed donde se necesite resolver el sujeto.
6. **Auditoría:** registrar origen de la solicitud/evento, clave idempotente,
   resultado (`created`, `already_linked`, `conflict`, `rejected`), actor o
   servicio, momento, y referencias antes/después con minimización de PII.
   Las decisiones de vinculación, merge o split requieren razón y evidencia
   verificable.

## 9. Recomendación de siguiente fase

Resolver primero el ownership y el namespace (System vs One), con una ADR que
defina quién emite el ID externo, dónde vive el almacén canónico y qué interfaz
utiliza el Bridge. En paralelo, ejecutar una auditoría de cobertura por entorno
con acceso de solo lectura y universos explícitos; clasificar los `company`
owners y especificar la vinculación Legal sin usar coincidencia de email como
prueba.

Solo después diseñar un evento de materialización idempotente, su manejo de
conflictos y rollback. La implementación debe empezar en modo de observación o
shadow-read, sin cambiar el login, JWT, autorización, sesiones ni datos legales.

## Fuentes consultadas

### Backend y modelos

- `backend/services/system_identity.py`
- `backend/services/identity_registry.py`
- `backend/services/identity_core.py`
- `backend/services/access_bridge.py`
- `backend/services/entitlement_service.py`
- `backend/services/policy_can.py`
- `backend/services/community_deps.py`
- `backend/routes/access_bridge_routes.py`
- `backend/routes/auth_routes.py`
- `backend/routes/community_auth_routes.py`
- `backend/routes/investor_routes.py`
- `backend/routes/profile_routes.py`
- `backend/routes/company_routes.py`
- `backend/routes/groups_routes.py`
- `backend/routes/workspace_routes.py`
- `backend/models.py`
- `backend/models_profile.py`
- `backend/models_business.py`
- `backend/server.py`

### Frontend / Legal Core

- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/contexts/CommunityAuthContext.jsx`
- `frontend/src/services/authService.js`
- `frontend/src/services/profileService.js`
- `frontend/src/services/workspaceBridge.js`
- `frontend/src/services/coreLegalAdapter.js`
- `frontend/src/system/coreLegalContext.js`

### Tests y documentos

- `backend/tests/test_system_identity.py`
- `backend/tests/test_identity_core.py`
- `backend/tests/test_access_bridge_contract.py`
- `backend/tests/test_policy_can_status.py`
- `backend/tests/test_policy_can_derived_actions.py`
- `backend/tests/test_d1_status_enforcement.py`
- `frontend/src/contexts/__tests__/AuthContext.bridge.test.jsx`
- `frontend/src/system/__tests__/coreLegalContext.test.js`
- `docs/architecture/ONE-IDENTITY-AUDIT.md`
- `docs/architecture/ONE-IDENTITY-CONTRACT.md`
- `docs/architecture/ONE-SYSTEM-BOUNDARY.md`
- `docs/governance/ONE-CORE-READINESS.md`
