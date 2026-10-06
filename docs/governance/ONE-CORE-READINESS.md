# ONE → CORE READINESS

**Auditoría de preparación de Punto Cero One como puerta de entrada universal al System Core.**

| | |
|---|---|
| **Fase** | Diagnóstico. Sin implementación. |
| **Fecha** | 2026-10-03 |
| **Base analizada** | `punto_cero_local` (MongoDB local) + código del repo |
| **Veredicto** | 🟡 **Parcialmente preparado** |

> **Regla de lectura.** Todo lo afirmado aquí fue verificado en código o consultado en la base de datos. Donde no se comprobó, se dice explícitamente. Ninguna cifra es estimada.

---

## 1. Estado actual

### 1.1 Qué existe y dónde

| Capa | Ubicación | Estado verificado |
|---|---|---|
| Backend | `backend/` · FastAPI · 33 routers · 23 servicios | 🟢 Operativo |
| Frontend | `frontend/src/` · React (CRA) | 🟢 Operativo |
| **Identidad canónica** | `backend/services/system_identity.py` (22 KB) | 🟢 **Construida y poblada** |
| **Registro de Sistemas** | `backend/services/identity_registry.py` (11 KB) | 🟢 Construido (ADR-IDENT-002) |
| **Puente de acceso** | `backend/services/access_bridge.py` | 🟡 Preparado, **sin exchange real** |
| Workspace Registry | `backend/services/workspace_registry.py` | 🟢 Autoridad única (10 espacios) |
| Política | `backend/services/policy_can.py` | 🟢 Fail-closed |
| Community auth | `backend/routes/community_auth_routes.py` (49 KB) | 🟢 Google OAuth + correo |
| Sistema (JWT) | `backend/routes/auth_routes.py` + `auth.py` | 🟢 Operativo |

### 1.2 El dato decisivo

Consulta directa a `punto_cero_local`:

```
users               = 4
system_identities   = 4
SIN proyectar       = []   ← 0
Huerfanas           = []   ← 0
entity_id válidos   = 4/4  (prefijo pc_usr_)
```

**Cobertura de identidad: 100 %.** La correspondencia `users.id → system_identities.profiles[].external_id → entity_id` ya existe y funciona.

```json
{
  "entity_id": "pc_usr_01M3JEKXKMKAZPDQRCTCRC749A",
  "profiles": [{
    "source": "punto_cero_system",
    "external_id": "cff8c1b6-1470-4475-876f-3783ac368acf",
    "email": "admin@puntocerosystem.com",
    "role": "admin",
    "verified": true
  }],
  "attributes": {}, "providers": [], "workspaces": []
}
```

### 1.3 Corrección a una suposición previa

`docs/architecture/ONE-SYSTEM-BOUNDARY.md` §8 y `SYSTEM-CORE-MAP.md` §2.5 declaran que `SPACE_CATALOG` "es un espejo del frontend" y que "el test de contrato **sigue sin escribirse**".

**Esa segunda parte ya no es cierta.** El test existe (`backend/tests/test_workspace_registry_contract.py`, 56 tests, verde) y el cuarto catálogo quedó congelado. La deuda §2.bis está cerrada técnicamente en ese punto; lo que sigue abierto son las **divergencias de dato** entre catálogos, no su detección.
---

## 2. Capacidades existentes

### 2.1 Identidad universal — ✅ resuelta

`system_identity.py` implementa el modelo canónico completo:

- **`entity_id` `pc_usr_<ULID Crockford>`** — global, inmutable, independiente del email y de la vertical.
- **Perfiles `(source, external_id)`** — plural. Un usuario puede tener N perfiles de N Sistemas en un solo `entity_id`. Índice único garantiza 1:1.
- **`identity_registry`** — autoridad del vocabulario `source` (ADR-IDENT-002). Distingue "existe" de "puede emitir" (`can_emit`). Bloquea emisión a `community` y `workspace` por ser *canales*, no Sistemas.
- **`build_identity_contract`** — proyecta `available_spaces`.
- **Estados de conflicto**: `none` / `linked` / `split` / `mixed`.

> **Esta es la pieza que más se pidió y ya existe.** One **puede** entregar una identidad consumible por el Core: ya lo hace vía `resolve_system_identity`.

### 2.2 Autenticación — ✅ dos vías deliberadamente coexistentes

| Vía | Mecanismo | Almacén |
|---|---|---|
| **JWT (System)** | `POST /api/auth/login` → `create_access_token(id, email, role)` | Stateless, TTL 8 h |
| **Cookie (Comunidad)** | Google OAuth (`/session`, `/callback`) + correo | `user_sessions` (22 sesiones) |

`identity_core.resolve_identity()` las reconcilia en los 5 casos de negocio, incluido **409 por conflicto** (`jwt_user_id ≠ community_user_id`).

Proveedores release: **Google, LinkedIn, Facebook**. Microsoft/Apple/GitHub/Twitter implementados pero ocultos (`_V1_HIDDEN`).

### 2.3 Autorización — ✅ fail-closed y derivada

`entitlement_service.get_entitlements()` concede **únicamente** por:

1. `verticals` declaradas → espacio
2. `organizations` → `workspace.open.empresa`
3. Sujeto autenticado + `status: activo` → `workspace.open.comunidad` (**la puerta universal**)

`role` **no concede acceso** — `_ROLE_TO_SPACES` fue eliminado (D2). `status != activo` corta **todo** (D1).

### 2.4 Puertas de entrada al Core — 🟡 wrappers completos, sin exchange

| Endpoint | Estado |
|---|---|
| `GET /api/auth/system-context` | 🟢 Dual-sesión, calcula account_type/verticales/organizaciones |
| `GET /api/access/spaces` | 🟢 Registry completo |
| `GET /api/access/entitlements` | 🟢 Deriva permisos desde `entity_id` |
| `POST /api/access/intent` | 🟡 Emite intent, **nunca se canjea** |

---

## 3. Gaps

| # | Gap | Impacto | Evidencia |
|---|---|---|---|
| **G1** | **No hay token exchange con ninguna vertical** | 🔴 Crítico | `access_bridge.py`: *"FASE 7 (token exchange real con Legal) queda EXPLÍCITAMENTE FUERA"* |
| **G2** | `consume_intent()` **nadie lo invoca** | 🔴 Crítico | El intent se emite y expira a los 300 s sin usarse |
| **G3** | Sin `tenancy` — `organizations` = 0 docs | 🔴 Crítico | `organizations` es la **única** vía de `workspace.open.empresa` |
| **G4** | `system_identities.attributes` = `{}` | 🟠 Alto | No hay atributos de perfil canónicos |
| **G5** | `system_identities.providers` = `[]` | 🟠 Alto | Google/LinkedIn/Facebook **no** se propagan al Core |
| **G6** | `system_identities.workspaces` = `[]` | 🟠 Alto | El campo existe y nunca se puebla |
| **G7** | Sin perfil Universal (Personal/Profesional/Empresa) | 🟠 Alto | `account_type` se **calcula, no se persiste** |
| **G8** | Colecciones sociales vacías | 🟡 Medio | `posts` 0 · `groups` 0 · `follows` 0 · `user_workspaces` 0 |
| **G9** | Sin soporte multi-vertical | 🟡 Medio | `users` tiene `vertical` (singular) **y** `verticals` (array) |
| **G10** | Legal no tiene EEA propia | 🟠 Alto | `legal` y `medical` quedan **fuera** de `ALLOWED_SOURCES` |

---

## 4. Mapa One → System Core

| Elemento One | Equivalente Core | Estado | Verificado en |
|---|---|---|---|
| Usuario (`users.id`, UUID v4) | **Identity** (`entity_id` `pc_usr_*`) | 🟢 **Listo** | 4/4 proyectados |
| Sesión (JWT + cookie duales) | **Security** | 🟢 **Listo** | `identity_core`, 5 casos |
| Perfil (`name`, `headline`, `verticals`) | **Directory** | 🟡 **Parcial** | `attributes: {}` |
| Empresa (`companies` = 41) | **Tenancy** | 🔴 **Inexistente** | `organizations`: 0 docs |
| Espacio trabajo (`user_workspaces`) | **Workspace** | 🔴 **Inexistente** | colección vacía |
| Suscripción (planes, suscripciones) | **Commerce** | 🟡 **Parcial** | solo en cliente (`workspaceEnrollment`) |
| Permisos (`workspace.open.*`) | **Authorization** | 🟢 **Listo** | `policy_can`, fail-closed |

**Resumen: 3 listos · 2 parciales · 2 inexistentes.**

> ⚠️ **Hallazgo crítico**: `companies` tiene **41 documentos** pero `organizations` tiene **0**. Existen empresas en One y **ninguna es una tenancy del Core**. Eso es G3, y explica por qué `workspace.open.empresa` es hoy inalcanzable.

---

## 5. Arquitectura de conexión

### 5.1 Lo que YA funciona

```
One User (users.id)
      │
      ▼  project_user_identity()  ← 4/4 funcionando
System Identity (pc_usr_<ULID>)
      │
      ▼  resolve_system_identity()
Bridge → resolve_identity() → policy_can.can()
      │
      ▼
Entitlements → Verticales
```

### 5.2 El hueco: el canje nunca ocurre

```
                    ✅ EXISTE                    ❌ FALTA
  One ──────────► entity_id ──────────► entitlement
                                                    │
                                                    ▼
                                        intent_code (TTL 300s)
                                                    │
                                                    ╳  ← G1/G2: nadie lo canjea
                                                    ▼
                                        Token vertical
```

`intent_code` es hoy un **callejón sin salida**: se emite, expira a los 300 s y se descarta. `consume_intent()` existe, está probada, y **ningún endpoint la invoca**.

### 5.3 Las 5 preguntas del punto crítico

**1. ¿Existe un identificador compatible?**
**Sí.** `pc_usr_<ULID>` es global e inmutable y ya viaja por el Bridge como `subject_id`.

**2. ¿Existe `user_id_core`?**
**Sí, con otro nombre — y está bien así.** No hay columna `user_id_core` en `users`, y **no debería haberla**: One no replica identidad, solo la referencia (ADR-IDENT-001 L2). La correspondencia vive en `system_identities.profiles[].external_id`. Esa separación es deliberada y correcta.

**3. ¿Cómo se resolvería la identidad?**
**Ya resuelto.** `resolve_system_identity(db, jwt_user, community_user)` devuelve `entity_id` o lanza `IdentityConflictError`. La reconciliación de sesiones duales está implementada y testeada.

**4. ¿Qué conflicto existe con usuarios actuales de Legal?**
`identity_registry` **bloquea** `legal` como `source`:

```python
# system_identity.py:45-46
# Fuentes permitidas en esta fase. `legal` y `medical` quedan deliberadamente
# fuera: cada vertical declarará su propio origen en su propia capa.
```

Un usuario de Legal necesitará su propio registro en el Registry y **no puede** enlazarse hoy. No es un bug: es una frontera deliberada.

**5. ¿Qué migración haría falta?**
**Ninguna para los 4 usuarios actuales** (ya proyectados al 100 %). Para Legal haría falta **registro de su EEA en el Registry + emisión canónica**, no un backfill de datos.

---

## 6. Ruta recomendada

| Fase | Objetivo | Dependencias | Riesgo | Esfuerzo |
|---|---|---|---|---|
| **A** | Cerrar el circuito: canje `intent_code` → token de vertical | G1, G2 | 🟢 **Bajo** | **S** — una ruta que llame a `consume_intent()` |
| **B** | Propagar identidad: poblar `attributes`/`providers`/`workspaces`, definir perfil Universal | G4–G7 · decisión sobre persistir `account_type` | 🔴 **Alto** — hoy se *calcula*; persistirlo introduce estado que puede quedar obsoleto | M |
| **C** | Tenancy: `organizations` reales → habilita `workspace.open.empresa` | G3, modelo de tenancy del Core | 🔴 **Alto** — sin organizaciones ese espacio es inalcanzable | L |
| **D** | Migración progresiva: Legal y Medical declaran su EEA | A, B · **decisión del dueño del Core** | 🟠 Medio-alto — coordinación entre equipos | L |

> **Fase A es la única sin bloqueos.** Cierra un circuito ya construido, sin tocar modelos ni datos, y hace que todo lo demás sea verificable de extremo a extremo.

---

## 7. Relación con Legal

**Debe pasar al Core:** identidad canónica (`entity_id`) · Registro de Sistemas y sus estados · derivación de entitlements · política fail-closed · Workspace Registry.

**Debe permanecer en Legal:** datos jurídicos, expedientes, documentos · reglas del dominio legal · UI y experiencia de la vertical.

```
HOY (deseado por la arquitectura)      REALIDAD VERIFICADA

  One ──► Core ──► Legal               One ──► [nada]
  ─────────────  vertical             Legal no recibe nada
```

**Legal no tiene EEA, no consume intents y no existe como `source` válido.** Todo el andamiaje de Core está construido *hacia adelante*, y Legal es el primer cliente que falta.

---

## 8. Bloqueos

### Técnicos
| Bloqueo | Impacto | Responsable |
|---|---|---|
| **G1** Sin exchange con verticales | 🔴 Crítico | Equipo One |
| **G2** `consume_intent()` muerto | 🔴 Crítico | Equipo One |
| **G3** `organizations` vacío (empresas sin tenancy) | 🔴 Crítico | One + Core |
| **G8** Colecciones sociales vacías | 🟡 Medio | Producto |

### Arquitectura
| Bloqueo | Impacto | Responsable |
|---|---|---|
| **G10** `legal` fuera de `ALLOWED_SOURCES` | 🟠 Alto | **Dueño del Core** |
| `account_type` derivado vs persistido (G7) | 🟠 Alto | Arquitectura One |
| Multi-vertical: `vertical` y `verticals` conviven (G9) | 🟡 Medio | Arquitectura One |

### Datos
| Bloqueo | Impacto | Responsable |
|---|---|---|
| `providers`/`attributes`/`workspaces` vacíos (G4–G6) | 🟠 Alto | Equipo One |
| Sin política de reconciliación por email entre EEA | 🟠 Alto | Core + Legal |

### Gobernanza
| Bloqueo | Impacto | Responsable |
|---|---|---|
| Registro del Core sin EEA `legal`/`medical` | 🔴 **Bloqueante** | **Dueño del Core** |
| Sin dueño declarado para `tenancy` | 🟠 Alto | Core |
| Estado de los catálogos duplicados del frontend | 🟡 Medio | One (ya detectado por contrato) |

---

## 9. Módulos One

| Módulo | Colección | Estado | ¿Puede cumplir su rol? |
|---|---|---|---|
| **Comunidad** | `posts` 0 · `groups` 0 · `follows` 0 | 🔴 Vacía | Sí en diseño (`comunidad` es `live` y es la puerta universal), pero **sin carga** |
| **Marketplace** | — | 🔴 No existe | No hay entidad que conecte usuarios con verticales |
| **Empresas** | `companies` 41 | 🟡 Seed | Hay datos, pero **no son tenancies** (G3) |
| **Profesionales** | `legal_role` en `users` | 🟡 Parcial | Single-role; sin multi-vertical (G9) |
| **Workspace** | `user_workspaces` 0 | 🔴 Vacía | **Debe permanecer en el Core** (ver abajo) |

**Sobre Workspace:** pertenece al Core, no a One. `workspace_registry.py` es la autoridad de espacios y concede permisos; si viviera en One, One pasaría a ser dueño del Core y la frontera de `ONE-SYSTEM-BOUNDARY.md` se rompería.

---

## 10. Veredicto

# 🟡 Parcialmente preparado

### Evidencia a favor
- ✅ `entity_id` canónico existe, es global, inmutable y **funciona** (4/4).
- ✅ Perfiles múltiples `(source, external_id)` — el modelo correcto.
- ✅ Doble autenticación reconciliada con conflictos tipados (409).
- ✅ Autorización fail-closed y derivada, con `role` neutralizado.
- ✅ Puertas de entrada completas y testeadas (56 tests de contrato en verde).

### Evidencia en contra
- ❌ **El circuito termina a medio camino**: se emite `intent_code` y nadie lo canjea. El exchange está explícitamente fuera de alcance *por diseño*.
- ❌ **`tenancy` no existe**: 41 empresas en One, 0 organizaciones en el Core.
- ❌ **El perfil universal no existe**: `account_type` se calcula, no se persiste.
- ❌ **Legal no es cliente del Core**: no tiene EEA, no es `source` válido.
- ⚠️ **4 usuarios y 0 posts/groups/follows**: la identidad funciona, pero no hay carga social que la justifique.

### La frase que resume el estado

> **La identidad está construida y probada; la conexión con las verticales no existe todavía.**
>
> One no es hoy la puerta de entrada *al Core* porque el Core **no tiene puertas**: tiene un puente que preparacea la apertura y no la ejecuta.
>
> La buena noticia es que **el 80 % del trabajo difícil ya está hecho** — modelo de identidad, perfiles múltiples, política fail-closed, contratos. Lo que falta es la última milla (`consume_intent`) y tres decisiones de gobernanza que **no pertenecen a One**.

### Recomendación

**Ejecutar la Fase A de inmediato.** Es el único trabajo sin bloqueos, sin decisión de producto y con el mejor ratio valor/riesgo.

Las Fases B, C y D **no deben comenzar** hasta que el dueño del Core responda:

1. ¿Registra `legal` y `medical` como Sistemas? *(desbloquea D)*
2. ¿Quién posee `tenancy`? *(desbloquea C)*
3. ¿`account_type` se persiste o se sigue derivando? *(desbloquea B)*

---

*Auditoría de solo lectura. 0 líneas de código modificadas · 0 endpoints · 0 contratos · 0 migraciones · 0 cambios de modelo.*