# IDENTITY CORE — ARCHITECTURE V1
## Punto Cero System · FASE 13.0 (diseño, sin implementación)

> **Documento de diseño. NO contiene cambios de código.**
> Fecha: 2026-09-17
> Base: `IDENTITY_CORE_AUDIT.md` (FASE 1, commit `fa92cdf`) + verificación de código del 17/09.
> Estado: **PROPUESTA PENDIENTE DE APROBACIÓN**
> Rama base: `conflict_160926_0918` @ `f474372` (limpia, sincronizada).

---

## 1. Estado actual (verificado en código)

### 1.1 Modelo de usuario

Fuente única: colección `db.users` (sin colecciones de identidad separadas).

**Campos existentes** (comprobados en `models.py`, `models_profile.py`, `routes/community_auth_routes.py`):

| Grupo | Campos |
|---|---|
| Base | `id, email, name, role, password_hash, created_at, last_login_at, email_verified` |
| Auth | `auth_providers[] {provider, provider_id, email}`, `must_change_password` |
| Perfil (`ProfilePublic/ProfileUpdate`) | `headline, bio, cover_url, picture, country, city, language(s), interests[], skills[], specialties[], verticals[], current_company, current_title, experience[], certifications[], portfolio_url, social{}, ui_preferences{}` |
| Social/community | `posts_count, followers_count, following_count` |
| JWT (Sistema A) | claims `sub, email, role (admin|investor), type=access`, TTL 8 h, stateless |

**Campos faltantes** para el objetivo "identidad única":

- `account_type` explícito (Personal / Profesional / Empresa) — hoy solo inferible de `role` + `verticals`.
- `organizations[]` o membresía usuario↔empresa canónica (solo existe `companies.owner_id` y `companies.team[] {user_id, role}`).
- `available_spaces[]` / permisos por espacio.
- `workspace_recommendation` o señal de espacio por defecto.

### 1.2 Relaciones actuales

| Relación | Estado | Evidencia |
|---|---|---|
| Usuario → Perfil | **Embebida** en el mismo doc `users` (perfil enriquecido) | `ProfilePublic` leído por `profile_routes.py` sobre `users` |
| Usuario → Empresa | **Indirecta**: `companies.owner_id` (dueño) y `companies.team[] {user_id, role}` (miembros). Sin índice inverso ni endpoint "mis empresas" | `models_business.py`, `company_routes.py` |
| Usuario → Vertical | **Débil**: `users.verticals[]` (texto libre) y `companies.vertical` (filtro `?vertical=`). Sin normalización compartida | `profile_routes.py`, `company_routes.py` |
| Usuario → Workspace | **Exclusiva del Sistema B**: `workspaces` ligado a `user_sessions` (cookie comunidad), NO al JWT | `workspace_routes.py:185` `Depends(require_current_user)` |

### 1.3 Mapa de identidad actual

```
FLUJO JWT (Sistema A)                     FLUJO COMUNIDAD (Sistema B)
Usuario                                   Usuario
  ↓ /login (LoginPage → AuthContext)        ↓ /join, social Google, register/login
POST /api/auth/login                      POST /api/community/auth/session|register|login
  ↓                                        ↓
JWT HS256 (stateless, 8h)                 cookie httpOnly session_token + db.user_sessions
  ↓ localStorage['pcs_admin_token']        ↓ GET /api/community/auth/me (credentials:include)
GET /api/auth/me → user                   CommunityAuthContext.user
  ↓                                        ↓
AuthContext.user                          WorkspaceContext → /api/workspace/me (GET/PUT/PATCH)
  ↓                                        ↓
Gateway /workspace (solo lectura visual)  Persistencia real del workspace
```

**Diferencias clave:**

| Dimensión | Sistema A (JWT) | Sistema B (Comunidad) |
|---|---|---|
| Transporte | `Authorization: Bearer` | cookie httpOnly (+ fallback Bearer) |
| Estado servidor | Stateless | `db.user_sessions` |
| Semántica de `user` | `null` = verificando | `undefined` = cargando, `null` = no auth |
| Logout | Solo cliente (endpoint stateless) | Borra sesión server-side |
| Refresh | No | No |
| Endpoints | 3 (`/api/auth/*`) | 14 (`/api/community/auth/*`) |

**Solapamientos:** misma colección `users`; mismos conceptos email/name/role; ambos alimentan UI de sesión.

**Riesgos confirmados por código:**

1. **R1 — Sesión partida:** login por `/login` (JWT) no crea sesión One → `GET /api/workspace/me` responde anónimo o con **otro usuario** si existe cookie One previa.
2. **R2 — Sin autorización por espacio:** cualquier JWT válido ve todos los espacios; `coming_soon` es solo visual.
3. **R3 — Roles insuficientes:** `role ∈ {admin, investor, member}` no codifica Personal/Profesional/Empresa ni vertical.
4. **R4 — Sesiones contradictorias:** JWT de A + cookie de B pueden referir a usuarios distintos en la misma navegación.
5. **R5 — Logout asimétrico:** "Cerrar sesión" del Gateway borra token A pero deja viva la cookie B (y viceversa).

---

## 2. Arquitectura propuesta — Identity Core V1

**Principio rector (del documento FASE 1):** unificar **lectura**, no sustituir los dos sistemas. `CommunityAuthContext` y `LoginCardOne` se conservan.

```
                    Usuario Punto Cero System (db.users, doc único)
                                    |
                       +------------+-------------+
                 Sesión A (JWT)             Sesión B (cookie comunidad)
                       |                            |
                 auth_adapter_A              auth_adapter_B
                       +------------+-------------+
                                    ↓
                          IDENTITY CORE (capa de resolución)
                                    ↓
                          GET /api/auth/system-context
                                    ↓
        { user, account_type, verticals, organizations,
          available_spaces, recommended_space }
                                    ↓
                 Gateway + Workspace consumen el MISMO contexto
```

### 2.1 Dimensiones de identidad (modelo conceptual)

1. **Identidad personal** — cuenta base: `id, email, name, picture`. Siempre existe.
2. **Identidad profesional** — `headline, specialties, skills, experience, certifications, current_title, portfolio_url` (ya existen en `users`).
3. **Identidad empresarial** — derivada de `companies` donde `owner_id == user.id` o `user.id ∈ team[].user_id`.
4. **Verticales** — normalización de `users.verticals[]` + `companies.vertical` al enum canónico `one | legal | medical | empresa` (mismo vocabulario de `workspaceSpaces.js`).
5. **Espacios disponibles** — función de (account_type, verticales, membresías): **calculado** por el Identity Core, no almacenado.

**`account_type` (derivado en fase 1; almacenado opcional en fase posterior):**

| Señales | account_type |
|---|---|
| Sin verticals ni empresas | `personal` |
| `verticals` incluye legal/medical o specialties profesionales | `profesional` (+ vertical principal) |
| Owner o miembro de `companies` | `empresa` (+ organización principal) |

### 2.2 SYSTEM CONTEXT (diseño del contrato — NO crear el endpoint aún)

`GET /api/auth/system-context` (autenticado con **cualquiera** de las dos sesiones):

```json
{
  "user": { "id": "...", "email": "...", "name": "...", "picture": "..." },
  "session": { "sources": ["jwt", "community"], "unified": true },
  "identity": {
    "account_type": "profesional",
    "primary_vertical": "legal",
    "verticals": ["legal"],
    "profile_ref": "/api/profile/me"
  },
  "organizations": [
    { "company_id": "...", "name": "...", "vertical": "legal", "relation": "owner", "role": "owner" }
  ],
  "workspaces": {
    "available": ["one", "legal"],
    "coming_soon": ["medical", "empresa"],
    "recommended": "legal",
    "recommended_reason": "verticals"
  }
}
```

**Reglas del contrato:**

- Resuelve identidad: si ambas sesiones existen → validar que apunten al **mismo `users.id`**; si difieren → `409 identity_conflict` (detección explícita de R1/R4, no silencio).
- Si solo hay JWT → identidad A; si solo cookie → identidad B. `session.sources` lo declara.
- `workspaces.available` se calcula del catálogo compartido (misma fuente que `workspaceSpaces.js`), no hardcodeado.
- **No** emite tokens nuevos, **no** muta sesiones: lectura pura.

### 2.3 Reglas de acceso futuras (diseño, sin implementar)

| account_type | Espacio destino | Guard propuesto (backend) |
|---|---|---|
| `personal` | Punto Cero One (`/one` o `/join` hoy) | sesión válida (A o B) |
| `profesional` + vertical `legal` | Punto Cero Legal Workspace | `require_space_access('legal')`: sesión válida + (vertical legal o membresía empresa legal) |
| `profesional` + vertical `medical` | Punto Cero Medical Workspace | `require_space_access('medical')` — bloqueado hasta que exista el módulo |
| `empresa` | Organization Workspace (por empresa) | sesión válida + `relation ∈ {owner, member}` sobre esa `company_id` |

- El **Gateway deja de adivinar**: `getRecommendedSpace` (FASE 8, heurística textual) se sustituye por `workspaces.recommended` del system-context; la heurística queda como fallback offline.
- Los guards por espacio son **aditivos**: ningún endpoint existente cambia de depend; se agregan en rutas nuevas primero.

---

## 3. Impacto técnico

### A) Cambios backend necesarios

1. Módulo `services/identity_core.py`: resolución de identidad dual (A/B), detección de conflicto, cálculo de `account_type`, verticales y organizaciones.
2. Endpoint `GET /api/auth/system-context` en `auth_routes.py` (o router propio `/api/identity/*`), con un dep nuevo `current_identity` que acepte JWT **o** cookie.
3. Guards `require_space_access(space_key)` (fase posterior).
4. Índice sugerido: `companies.team.user_id` (lookup inverso "mis empresas").
5. Normalizador de verticales compartido (enum canónico).

### B) Cambios frontend necesarios

1. Hook único `useSystemContext()` (cache en memoria, revalidado al montar) consumido por Gateway, Workspace y Mi Espacio.
2. Gateway: badge de sesión unificada; reemplazo progresivo de `getRecommendedSpace` por `workspaces.recommended`.
3. Delegación de sesión: al iniciar por `/login` (JWT), ofrecer **vincular/crear** sesión comunidad para el mismo usuario (endpoint puente, fase 2) — resuelve R1 sin tocar `CommunityAuthContext`.
4. Logout coordinado (A + B) — resuelve R5.

### C) Migraciones posibles (opcional, fase posterior — solo con aprobación)

- Backfill `account_type` derivado sobre `users` (campo nuevo, no destructivo, reversible).
- Normalizar `verticals[]` al enum canónico (conservando texto original en `verticals_raw[]`).
- **No** se requieren cambios de esquema de `db.users` ni de `workspaces` para la fase 1 (todo calculado).

### D) Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper consumidores de `CommunityAuthContext` (32 archivos) | Identity Core es **solo lectura sobre ambos**; cero cambios en contexts existentes en fase 1 |
| Conflictos de identidad (A distinto de B) | Detección explícita `409` + UI de resolución; nunca elegir en silencio |
| Verticales textuales ambiguos | Enum canónico + fallback a heurística actual |
| Seguridad: exponer organizations | Solo id/name/vertical/relation; sin datos privados de empresa |
| Gateway ya publicado (F5-11) | Cambios 100% compatibles: system-context amplía, no reemplaza |

### E) Orden recomendado de implementación

1. **F13.1** — `identity_core.py` + `GET /api/auth/system-context` (solo lectura, dual-session) + tests backend.
2. **F13.2** — Frontend `useSystemContext()`; Gateway muestra contexto real (recomendación del servidor; heurística como fallback).
3. **F13.3** — Puente de sesiones A→B (endpoint de vinculación) + logout coordinado.
4. **F13.4** — Guards `require_space_access` en rutas nuevas + enforcement real de `coming_soon`.
5. **F13.5** — (Opcional) backfill `account_type` + normalización de verticales.
6. **F13.6** — One/Legal: entrada real por espacio (fuera de alcance inmediato; requiere contratos externos según FASE 1).

---

## 4. Criterios de validación (por fase)

- F13.1: con JWT → 200 contexto con `sources:["jwt"]`; con cookie → 200 `["community"]`; ambas del mismo user → `unified:true`; de users distintos → `409`; sin sesión → 401. Backend intacto: 190 rutas + 1 = 191.
- F13.2: Gateway renderiza recomendación del servidor; heurística solo si contexto falla; tests Gateway existentes (20/20) siguen verdes.
- F13.3: login JWT → workspace persiste sin cookie previa; logout cierra ambas sesiones.
- F13.4: usuario sin vertical legal recibe 403 en espacio legal protegido; owner/member sí accede.
- Transversal: cero cambios en `AuthContext.jsx`, `CommunityAuthContext.jsx`, `LoginCardOne.jsx`; suite completa verde; build sin warnings nuevos.

---

## 5. Resumen ejecutivo y siguiente fase

**Resumen:** Punto Cero System tiene una sola colección de usuarios pero **dos identidades operativas** que no interoperan; el Gateway (JWT) y la persistencia de Workspace (cookie comunidad) pueden referir usuarios distintos. Identity Core V1 resuelve esto **sin reemplazar ningún sistema**: una capa de lectura que unifica ambas sesiones bajo un contrato único (`system-context`), con detección explícita de conflictos y espacios calculados, no almacenados.

**Hallazgos críticos:** R1 (sesión partida JWT/comunidad), R4 (conflicto de usuarios en doble sesión), R5 (logout asimétrico) — los tres eliminables en F13.1-F13.3 sin tocar auth existente.

**Recomendación de siguiente fase:** aprobar este diseño y ejecutar **F13.1** (Identity Core backend de solo lectura + `GET /api/auth/system-context` + tests), con criterio de éxito: 191 rutas, suite verde y cero modificaciones en los dos contexts ni en `LoginCardOne`.
