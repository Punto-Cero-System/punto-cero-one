# Identity Governance Contract

**Fecha:** 2026-10-03
**Estado:** Contrato propuesto; no habilita escrituras ni cambia runtime.
**Alcance:** gobernanza de `entity_id` y de vínculos entre identidad y perfiles
externos. No altera login, JWT, autorización, datos de One ni Legal Core.

## 1. Principios y límites

- `entity_id` identifica una persona de forma transversal; no es un usuario de
  producto, una organización, un tenant, un workspace, una firma ni una
  membresía.
- Identity System mantiene la asociación canónica entre la persona y sus IDs
  nativos. Los sistemas fuente conservan sus cuentas, perfiles, IDs y datos.
- Resolver o verificar identidad no concede permisos, membresías ni
  entitlements.
- Email, nombre, pertenencia a empresa y perfil profesional no son por sí solos
  una clave de identidad ni una autorización para fusionar perfiles.
- El presente contrato define autoridad objetivo y evidencia admisible; no crea
  un escritor, endpoint, evento, migración, sincronizador ni proceso de
  materialización.

## 2. Autoridad emisora: Authority vs Implementation

### Authority propuesta

**System Core**, a través de una única capacidad gobernada de Identity System,
es la autoridad lógica propuesta para asignar y gobernar `entity_id` y sus
vínculos canónicos. La autoridad es una responsabilidad de decisión y política;
no afirma que exista hoy una instancia remota desplegada.

| Operación | Quién puede decidir / aprobar (Authority) | Ejecutor operativo futuro | Restricción |
| --- | --- | --- | --- |
| Crear `entity_id` | Identity Authority bajo System Core | Un único escritor autorizado, aún no desplegado/operacionalmente asignado | Solo después de validar fuente, referencia estable, elegibilidad y evidencia. El origen no elige el ID canónico. |
| Modificar metadata | Identity Authority bajo System Core | Escritor de la autoridad; origen puede proponer solo atributos que posee | Cambios mínimos, con procedencia y audit trail. `entity_id` es inmutable; metadata no se usa para deduplicar. |
| Vincular perfiles | Identity Authority bajo System Core | Escritor único; el sistema fuente acredita el ID que posee | Verificar control y unicidad de `(source, external_id)`; sin linking por email o por similitud. |
| Suspender una identidad | Identity Authority bajo System Core, con motivo y actor autorizados | Operador/servicio con permiso explícito y separado del solicitante | No equivale a suspender una cuenta One, cerrar un workspace o cambiar un permiso. Debe definirse revisión y reactivación. |
| Auditar cambios | Política de auditoría aprobada por System Core | Registro append-only con acceso restringido; revisión independiente cuando corresponda | Toda transición y rechazo relevante queda atribuible, con minimización de PII. Auditoría no modifica el estado por sí sola. |

One puede autenticar y gestionar sus cuentas, emitir `users.id` y confirmar
hechos de su propio dominio. No debe asignar `entity_id` transversal ni
adjudicar vínculos a Legal u otros sistemas. Legal Core conserva sus IDs, datos
legales y autoridad de verificación de su dominio. Access Bridge y policy
consumen y validan para su operación; no son escritores de identidad.

### Implementation observada

| Aspecto | Estado observado |
| --- | --- |
| Ubicación del servicio | `backend/services/system_identity.py` en este repositorio/backend One. |
| Persistencia | Colección `system_identities` de la base configurada por One. |
| Capacidad de escritura | Funciones `create_system_identity()` y `link_profile()`; `resolve_system_identity()` solo escribe si se solicita expresamente `create_missing=True`. |
| Uso productivo localizado | Las rutas Access Bridge resuelven con `create_missing=False` por omisión; no se encontró materialización garantizada en registro/login. |
| Lectores | Access Bridge y funciones internas que reciben el objeto DB. |
| Frontera operativa | No hay prueba en el código revisado de un servicio remoto independiente, permisos de base limitados a un solo escritor o separación de credenciales por rol. |

Por tanto:

- **Authority lógica:** System Core (propuesta en los ADR/documentos previos).
- **Implementation/operación actual:** backend y base Mongo de One.
- **Owner operativo futuro:** **DECISIÓN PENDIENTE**. No se debe inferir que el
  owner operativo ya sea System Core por la autoridad lógica documentada, ni
  que One sea dueño lógico por alojar hoy el código y los datos.
- **Riesgo:** conceder a múltiples procesos acceso directo al store permitiría
  escritores paralelos sin enforcement de la gobernanza propuesta.

## 3. Namespace

### `entity_id`

- **Propietario lógico propuesto:** System Core / Identity Authority.
- **Propietario operativo actual:** infraestructura y backend configurados por
  One; el responsable de operación independiente no está identificado.
- **Formato compatible observado:** `pc_usr_<ULID Crockford>` con bloque ULID
  de 26 caracteres según el validador del servicio actual.
- **Semántica:** clave opaca, estable, inmutable y global dentro del dominio de
  identidad de persona. No codifica atributos ni claves de negocio.
- **Unicidad:** un `entity_id` identifica una sola entidad persona. La
  restricción debe aplicarse en el almacén autoritativo y probarse antes de
  operación; error de índice no puede tratarse como garantía.
- **No reutilización:** IDs retirados quedan reservados/tombstone conforme a
  política aprobada; nunca se reasignan a otra persona.

### `source` y `external_id`

- `source` identifica el sistema dueño del `external_id`; no es proveedor de
  login, vertical, workspace ni canal de sesión.
- `external_id` es una referencia opaca y estable emitida por ese sistema. Su
  interpretación y ciclo de vida pertenecen a la fuente.
- Un par `(source, external_id)` puede vincularse como máximo a una identidad
  canónica. Una identidad puede tener varios perfiles externos solo tras
  verificar cada fuente y vínculo.
- Los IDs no se transforman ni se reemplazan por email, nombre o un ID de
  organización.

### Evaluación de `punto_cero_system`

El Registry actual declara `punto_cero_system` como `OWNER_TOKEN`, permite
emisión bajo ese token y conserva `community` y `workspace` como tokens de
compatibilidad. La resolución del servicio usa dicho owner token para buscar
perfiles de `users.id`. A la vez, los flujos One emiten los `users.id` usados
como `external_id`. El token, por tanto, nombra actualmente el namespace de
System, pero el código no demuestra que la autoridad emisora de esos IDs sea
operada por System Core ni que exista una frontera operacional con One.

**Propuesta de gobernanza:** mantener la cadena `punto_cero_system` como
**namespace reservado y estable** para las referencias ya almacenadas, y no
cambiarla ni reasignar su significado de forma retroactiva. No considerar que
esa reserva resuelva el ownership operativo. Antes de permitir nuevas
emisiones productivas, se debe ratificar quién representa y autentica al owner
del namespace y cómo One presenta su `users.id` como perfil externo. Si se
decide que la semántica actual es incorrecta, cambiarla requerirá decisión
versionada y plan de compatibilidad; no una sustitución silenciosa del token.

**DECISIÓN PENDIENTE:** identidad del principal operativo autorizado para
emitir referencias bajo `punto_cero_system`, custodia de credenciales y si el
token representa System Core, el System One o un principal técnico delegado.
Este contrato no modifica `identity_registry.py` ni `system_identities`.

## 4. Evidencia de identidad

La fuerza de evidencia depende de la afirmación. Una fuente puede ser primaria
para su propio ID y secundaria para correlacionar dos sistemas.

| Fuente / dato | Clasificación | Uso admisible | No demuestra |
| --- | --- | --- | --- |
| `users.id` persistido en One | **Primaria para identificar una cuenta/principal One** (la fuente autoritativa es One) | Referencia externa de One; una autoridad autenticada de One puede acreditar que el ID existe y está bajo su control | Que dos cuentas One, o una cuenta One y una Legal, pertenecen a la misma persona física |
| Email verificado | **Secundaria** | Canal de contacto y corroboración temporal bajo política; puede señalar colisión para revisión | Identidad estable, unicidad de persona, propiedad de IDs de terceros o autorización para link/merge |
| Legal identity / `user_id_core` | **Primaria dentro del dominio Legal** si Legal Core verifica y confirma su propio principal | Referencia externa solo tras aprobar source, prueba de control y contrato de linking con Legal | Equivalencia automática con `users.id` o un `entity_id`; Legal no está habilitado por el Registry revisado |
| Ownership de empresa (`owner_id`) | **Secundaria / relación de dominio** | Evidencia de que un registro de empresa declara una relación con una cuenta fuente; requiere validación por el dominio propietario | Identidad canónica, vigencia del owner, control actual de la cuenta o equivalencia entre persona y empresa |
| Perfil profesional (rol, especialidad, headline, licencia declarada) | **Dato informativo**, salvo verificación explícita por autoridad profesional competente | Contexto de perfil; una credencial verificada puede ser evidencia secundaria específica con emisor y vigencia | Persona única, identidad Legal, empleo/afiliación vigente o autoridad para fusionar |
| `entity_id` ya vinculado y válido | **Primaria como clave canónica solo tras resolución de la autoridad** | Correlacionar perfiles ya verificados | Permiso, autenticación de sesión, cuenta activa o relación de organización |
| Nombre, teléfono, empresa compartida, workspace o grupo | **Dato informativo** | Presentación/ayuda a revisión con minimización | Prueba de identidad o base automatizada de deduplicación |

Un vínculo entre sistemas exige prueba de control de cada referencia por su
respectivo owner, origen autenticado y un procedimiento de vinculación
aprobado. El umbral concreto (por fuente, invitación o cuenta) queda como
**DECISIÓN PENDIENTE**. Una señal informativa no se eleva a evidencia primaria
por aparecer en varios registros.

## 5. Política de conflictos

| Conflicto | Resultado contractual | Resolución prohibida |
| --- | --- | --- |
| Dos `entity_id` candidatos para la misma persona/perfil | Estado no resoluble/conflicto; congelar el vínculo afectado, preservar ambas referencias y abrir revisión con evidencia y actor autorizado | Elegir por fecha, primer registro, email o mayoría de campos; fusionar automáticamente |
| Mismo email en usuarios distintos | Mantener cuentas e identidades independientes; registrar la colisión como señal si la operación lo requiere | Usar email como llave única transversal, vincular por coincidencia o cambiar JWT/session subject |
| Identidad sin perfil | Mantener no resoluble para consumidores que requieran un perfil verificado; revisar si es pending, huérfana o tombstone | Inventar perfil, reactivar, borrar o reasignar el `entity_id` automáticamente |
| Perfil sin identidad | Mantener como referencia fuente no reconciliada; comprobarlo con su sistema owner en una fase autorizada | Crear una identidad a partir de email/datos personales durante una lectura o asignar al candidato más cercano |
| Organización sin owner válido | Tratar como conflicto de relación de organización; dejar identidad de personas intacta y derivar al owner del dominio organizacional | Crear usuario/identidad, reasignar empresa o convertir la organización en identidad persona |

Adjudicaciones futuras de merge/split, recuperación, suspensión o revocación
requieren política separada de elegibilidad, doble control cuando corresponda,
razón, evidencia, efecto sobre links, conservación de historial y auditoría
append-only. Mientras se resuelve un conflicto, no se debe devolver un
resultado ambiguo como éxito ni degradar a `users.id`/email; cada consumidor
mantiene su contrato actual y falla cerrado donde ya lo requiere.

## 6. Auditoría y acceso

La futura auditoría debe poder responder quién solicitó y quién decidió cada
cambio, qué fuente y referencia participaron, qué evidencia se verificó,
estado antes/después, timestamp, correlación, resultado y motivo. Registrar el
mínimo necesario; nunca credenciales, tokens o contenido de sesión. Separar
solicitante, autoridad que adjudica y lector auditor. Retención, acceso,
integridad append-only y obligaciones de privacidad son **DECISIONES
PENDIENTES**.

## 7. Bloqueos para materialización

1. Asignar owner operativo, infraestructura, credenciales y store bajo una
   autoridad única.
2. Ratificar `punto_cero_system` como principal técnico reservado y su
   relación con IDs emitidos por One.
3. Aprobar qué constituye cuenta One elegible, evidencia de email y
   vinculación de invitaciones.
4. Aprobar pruebas de control para Legal Core y sus IDs, sin habilitarlo por
   inferencia.
5. Verificar las restricciones únicas reales en el almacén operativo; el
   servicio actual puede continuar el startup si la creación de índices falla.
6. Definir estados de identidad/link, auditoría, acceso, suspensión,
   revocación, merge/split y fallos de disponibilidad.
7. Definir métricas y universo por entorno; las mediciones locales no describen
   staging o producción.

## Fuentes relacionadas

- [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md)
- [IDENTITY-LIFECYCLE-CONTRACT.md](./IDENTITY-LIFECYCLE-CONTRACT.md)
- [IDENTITY-OWNERSHIP-OPERATING-MODEL.md](./IDENTITY-OWNERSHIP-OPERATING-MODEL.md)
- [IDENTITY-MATERIALIZATION-PLAN.md](./IDENTITY-MATERIALIZATION-PLAN.md)
- [ONE-IDENTITY-COVERAGE-AUDIT.md](./ONE-IDENTITY-COVERAGE-AUDIT.md)
- [ONE-SYSTEM-BOUNDARY.md](./ONE-SYSTEM-BOUNDARY.md)
