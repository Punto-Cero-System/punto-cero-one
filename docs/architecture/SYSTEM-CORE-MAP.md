# SYSTEM CORE MAP

> **Documento de auditoría.** Describe el estado observado en el repositorio en
> la fecha de certificación. No prescribe implementación y no introduce código.
> Toda afirmación de "ubicación" es verificable; las de "estado" reflejan lo que
> el código dice de sí mismo, no una expectativa.

## 0. Cómo leer este mapa

Este repositorio (**Punto Cero One**) **no es** el Core. Es el producto
comunidad. El manifiesto de unificación del propio proyecto lo dice sin
ambigüedad:

> «Proyecto A (Core): Identity Core, JWT, Auth, MongoDB, Universal Launcher,
> Workspaces, Admin, Agents, Darwin IA, Billing, Vertical Registry»
> «Proyecto B (este repo): Landing, comunidad, feed, noticias, networking,
> perfiles, empleos, login social, mensajería, notificaciones, object storage»
> — `memory/PRD.md:1042`

Lo que sí existe aquí son **proyecciones de lectura** de varios Cores y la
**infraestructura de frontera** (`/api/access/*`). Eso es lo que documenta este
mapa. El resto son **capacidades declaradas pero ausentes**.

## 1. Inventario de los ocho Cores

| Core | ¿Código aquí? | Ubicación | Estado declarado |
|---|---|---|---|
| **Identity Core** | Sí | `services/identity_core.py` | Activo, solo lectura |
| **System Identity** | Sí | `services/system_identity.py` | Activo, persistido |
| **Identity Registry** | Sí | `services/identity_registry.py` | Activo, en memoria |
| **Identity Audit** | Sí | `services/identity_audit.py` | Activo, persistido |
| **Tenant Core** | **No** | — | **Ausente** |
| **Workspace Core** | Sí | `services/workspace_registry.py` | Activo, en memoria |
| **Entitlement Core** | Sí | `services/entitlement_service.py` | Activo, derivado |
| **Permission Core** | Sí | `services/policy_can.py` | Activo, derivado |
| **Billing Core** | **No** | — | **Ausente** |
| **Darwin Core** | **No** | — | **Ausente** |
| **Communication Core** | **No** | — | **Ausente** (ver §5) |
| **Directory Core** | **No** | — | **Ausente** |

> Verificación: `stripe` figura en `requirements.txt:116` pero **no existe ningún
> módulo que lo importe**. No hay `class Tenant`, `class Billing`, `class Agent`,
> `class Plan` ni función `*darwin*` / `*billing*` / `*tenant*` en `backend/services`
> ni `backend/routes`. «Darwin» solo aparece como nombre de fundador en textos y
> como promesa futura en `ACTIVITIES_LAYER_DESIGN_F0_9_2.md:204`.

## 2. Cores presentes — detalle

### 2.1 Identity Core — `services/identity_core.py`

- **Función**: resuelve la identidad de System unificando **dos** sesiones sin
  modificarlas: JWT de sistema y cookie de comunidad.
- **Contrato declarado**: 5 casos (solo JWT / solo comunidad / ambas mismo id →
  `unified=True` / ambas distintas → `IdentityConflictError` → 409 / ninguna → 401).
- **Restricción dura**: *lectura pura*. No emite tokens, no muta sesiones ni colecciones.
- **Consumidores**: `routes/access_bridge_routes.py`, `routes/auth_routes.py`.
- **Deuda declarada**: `SPACE_CATALOG` es un *espejo* del catálogo del frontend
  (`frontend/src/config/workspaceSpaces.js`). Hay dos catálogos de workspaces y
  nadie detecta el drift entre ellos.

### 2.2 System Identity — `services/system_identity.py`

- **Función**: `entity_id` global (`pc_usr_<ULID>`), inmutable, independiente del
  email y de la vertical. Cada sistema aporta un perfil `(source, external_id)`.
- **Persistencia**: colección `system_identities`, con índice único que garantiza
  que un `(source, external_id)` pertenece como máximo a una `entity_id`.
- **Consumidores**: `routes/access_bridge_routes.py`, `server.py` (índices).
- **Alcance declarado**: *"NO se activa ningún flujo real"*. Es cimiento, no
  camino transitado.
- **Deuda declarada**: es síncrono (pymongo) mientras las rutas son async; el
  propio docstring admite que la integración "NO forma parte de esta fase".

### 2.3 Identity Registry — `services/identity_registry.py`

- **Función**: autoridad del vocabulario `source` (ADR-IDENT-002). No guarda
  identidades: responde *qué Sistemas existen y qué token nombra a cada uno*.
- **Consumidores**: ninguno directo entre rutas; lo consume `system_identity`.
- **Hallazgo de auditoría** (ya está en su docstring): los cuatro escritores de
  `users.id` pertenecen al mismo proceso y namespace, luego **existe UN Sistema,
  no dos**. Los tokens `community` y `workspace` nombraban *superficies*, no
  Sistemas.

### 2.4 Identity Audit — `services/identity_audit.py`

- **Función**: bitácora de cambios de identidad con saneado de PII y truncado
  defensivo de documentos.
- **Consumidor**: `routes/community_auth_routes.py`.
- **Nota de frontera**: `MASTER_IDENTITY_AUDIT_ACCESS_POLICY.md:108` establece que
  **ninguna vertical, ni el frontend, deben leer la auditoría**.

### 2.5 Workspace Core — `services/workspace_registry.py`

- **Función**: fuente única de los 10 espacios del Workspace Universal.
- **Regla congelada**: `CORE_OPERATIVO_UNICO = "punto-cero-legal"`. *Medical,
  odontología, psicología, enfermería, finanzas, contabilidad, inmobiliaria son
  únicamente `workspace_space`. Nunca nuevos Cores.*
- `validate_registry()` lanza si algún espacio apunta a otro Core.
- **Consumidor**: `routes/access_bridge_routes.py`.
- **Sin persistencia**: deliberadamente en memoria y sin Mongo.

### 2.6 Entitlement Core — `services/entitlement_service.py`

- **Función**: deriva `workspace.open.<space_key>` desde la identidad ya resuelta.
  Puro y determinista: mismo input → mismo output, sin I/O.
- **Decisiones duras ya tomadas**:
  - **D2**: `role` es capacidad técnica, **no** acceso. El rol no concede ni
    deniega workspaces.
  - **D1**: `status` gobierna todo el acceso; `pendiente` y `suspendido` cortan
    **todos** los espacios (fail-closed).
  - `comunidad` (One) es **puerta universal solo para usuarios activos**.
- **Deuda declarada y crítica**: D1 está implementado pero **NO aplicado en
  producción** — `access_bridge_routes._access_context` llama a `get_entitlements`
  sin pasar `status`, así que un usuario `suspendido` conserva el acceso. El
  propio docstring lo dice: *"eso es un cambio de una línea, en una fase posterior"*.

### 2.7 Permission Core — `services/policy_can.py`

- **Función**: `can(subject, action, context) → allow | deny`. *"El rol NO decide acceso."*
- **Orden de decisión fail-closed**: `status` → `entity_id` canónico → acción
  conocida → espacio existente → entitlement presente → estado del espacio.
- **Consumidor**: `services/access_bridge.py` (0 imports directos desde rutas).

### 2.8 Access Bridge — `services/access_bridge.py` + `routes/access_bridge_routes.py`

- **Rutas**: `GET /api/access/spaces`, `GET /api/access/entitlements`, `POST /api/access/intent`.
- **Límite declarado**: *no autentica, no emite JWT, no reemplaza auth, no llama
  a ningún Core, no hace HTTP, no persiste en Mongo.*
- **Naturaleza**: prepara **intención de acceso** (código temporal, TTL 300 s) —
  un *assertion preparatorio*, no una concesión.

### 2.9 Capa de frontera en el frontend — `frontend/src/system/` (18 módulos)

El repositorio **también** replica la frontera en cliente, y esta auditoría no
puede omitirlo porque es la cuarta copia del catálogo:

`accessBridgeClient.js`, `accessBridgeEntry.js`, `accessContext.js`,
`entitlements.js`, `sessionManager.js`, `systemEntryRules.js`,
`systemIdentities.js`, `workspaceActivation.js`, `workspaceCatalog.js`,
`workspaceEnrollment.js`, `workspaceOrchestrator.js`,
`workspaceProvisioning.js`, `workspaceRegistry.js`,
`workspaceRegistryManager.js`, `workspaceRegistryService.js`,
`coreLegalContext.js`, `ecosystemAdminService.js`, `ecosystemEngine.js`.

`frontend/src/system/workspaceRegistry.js` vuelve a listar `legal`, `medical`,
`odontologia`… con su propio `status`. Es una fuente más, y **el status no
coincide con el del backend**: el backend declara `medical` como `declared`,
el frontend lo marca `preview`.

## 2.bis El hallazgo estructural: cuatro catálogos de workspaces

Este es el resultado más accionable de la auditoría. El mismo catálogo de
espacios está escrito **cuatro veces**, sin ninguna fuente única ni test que
detecte la divergencia:

| # | Ubicación | Formato | Estado |
|---|---|---|---|
| 1 | `services/workspace_registry.py` | `WORKSPACE_REGISTRY` | 10 espacios · **backend, el más completo** |
| 2 | `services/identity_core.py` | `SPACE_CATALOG` | 4 entradas · espejo del frontend |
| 3 | `frontend/src/config/workspaceSpaces.js` | catálogo | navegación |
| 4 | `frontend/src/system/workspaceRegistry.js` | `verticals[]` | **divergente** |

**Divergencia verificada:** `medical` es `declared` en el backend y `preview` en
`frontend/src/system/`. No es cosmético: `status` decide si un espacio exige
`allow_non_live` en `policy_can.can()`.

`identity_core.py:27-30` ya lo reconoce y propone el arreglo (migrar el catálogo
al backend y añadir un test de contrato que detecte drift). **Ese test sigue sin
escribirse.**

## 3. Grafo de dependencias del núcleo

```
identity_registry ──► system_identity ──► (índices en server.py)
                            │
workspace_registry ────────┼──► entitlement_service ──┐
                            │                            ├──► access_bridge
policy_can ────────────────┼────────────────────────────┘         │
                            │                                       ▼
identity_core ──────────────┴───────────────────────────────► access_bridge_routes
                                                                    │
identity_audit ───────────────────────────────────► community_auth_routes
```

**Observación estructural**: `access_bridge_routes` es el **único** consumidor de
Identity Core, System Identity, Workspace Core, Entitlement Core y Permission
Core a la vez. Es el cuello de botella *de hecho* de todo el núcleo de acceso,
aunque su docstring se describe a sí mismo como "capa de intención".

## 4. Ausencias y su lectura correcta

| Ausente | Lectura | Evidencia |
|---|---|---|
| **Tenant Core** | Pertenece al System y aún no existe en ninguna parte de este ecosistema | Sin `class Tenant` ni `tenant_id` en el código |
| **Billing Core** | Pertenece al System; One **nunca** procesa pagos | `stripe` en requirements, cero imports |
| **Darwin Core** | Pertenece al System; One solo consume IA vía API | Solo menciones como futuro |
| **Agent** | Pertenece al System | Sin código ni entrada en el registry |

El `ECOSYSTEM_FUSION_MASTER_AUDIT.md:183` ya lo establece: *«Billing (Stripe) —
Core — B nunca procesa pagos; muestra estados de plan leídos del Core»*.

## 5. Communication Core: el caso ambiguo

No existe un módulo llamado así, pero sí comunicaciones
(`services/notifications.py`, `realtime.py`, `messaging_routes.py`).
**Esta auditoría no las reclasifica**: son infraestructura de *producto* en One.
Reclasificarlas sin evidencia de que el System las reclame sería inventar
arquitectura. Queda como **pregunta abierta** para el dueño del Core.

---

**Continúa en** [`ONE-SYSTEM-BOUNDARY.md`](./ONE-SYSTEM-BOUNDARY.md)
