# IDENTITY CORE — AUDITORÍA TÉCNICA
## Punto Cero System · FASE 1

> **Documento de auditoría. NO contiene implementación de código.**
> Fecha: 2026-09-16
> Estado: **PENDIENTE DE APROBACIÓN**
> Alcance auditado: frontend auth · backend auth · protected routes · router · workspaces · verticales

---

## 0. Resumen ejecutivo

### Baseline verificado (antes de tocar nada)

| Métrica | Valor |
|---|---|
| Frontend tests | **27 passed / 27**, 6 suites |
| Backend | **0 cambios** |
| Gateway Fase 1+2 | Completada (`/login`, `/workspace`, `/workspace/{legal,medical,empresa}`) |
| Routers backend montados | 35 |

### Hallazgo principal

El ecosistema tiene **DOS sistemas de autenticación completos, paralelos y NO interoperables**:

<!-- Recuento estático: archivos de producción que contienen el hook, incluyendo su definición. -->
| | Sistema A — Admin JWT | Sistema B — Comunidad |
|---|---|---|
| Contexto | `AuthContext.jsx` | `CommunityAuthContext.jsx` |
| Transporte | `Authorization: Bearer` + `localStorage['pcs_admin_token']` | cookie httpOnly `session_token` (+ Bearer fallback) |
| Endpoints | `/api/auth/*` (3) | `/api/community/auth/*` (**14**) |
| Colección de sesión | *ninguna* (stateless) | `db.user_sessions` |
| Estado de `user` | `null`=verificando, `false`=no auth, `object`=auth | `undefined`=cargando, `null`=no auth, `object`=auth |
| Archivos con el hook (incluye definición) | 11 | 32 |
| Refresh token | NO existe | NO existe |

**Comparten una única colección `db.users`** — esa es la base sobre la que se puede fusionar.

### 🚨 Hallazgo crítico (bloqueante para el objetivo del proyecto)

**`/api/workspace/*` se autentica con el Sistema B (Comunidad), NO con el JWT de admin.**

Evidencia verificada:
- `backend/routes/workspace_routes.py:185` → `user=Depends(require_current_user)`
- `backend/services/community_deps.py:47` → `require_current_user` resuelve contra `db.user_sessions` (cookie de comunidad), no contra el JWT admin
- `frontend/src/contexts/WorkspaceContext.jsx:25,37` → `import { useCommunityAuth }` / `const { user } = useCommunityAuth()`
- `frontend/src/services/workspaceService.js:16` → `fetch(`${API}/api/workspace/me`, { credentials: 'include' })`

**Consecuencia:** iniciar sesión por `/login` no crea una sesión One. Sin cookie One válida, el motor permanece anónimo; si ya existe una cookie One, puede cargar otro usuario. El JWT no determina la identidad del motor.

👉 El objetivo "UN SOLO LOGIN para todas las verticales" **hoy NO se cumple de punta a punta**. Este es exactamente el problema que el Identity Core debe resolver.

---

## 1. Estado actual

### 1.1 Inventario backend (verificado por lectura de código)

| Capa | Archivo | Endpoints | Prefijo |
|---|---|---|---|
| **Admin JWT** | `backend/routes/auth_routes.py` | **3** | `/api/auth` |
| **Comunidad** | `backend/routes/community_auth_routes.py` | **14** | `/api/community/auth` |
| **Workspace** | `backend/routes/workspace_routes.py` | **4** | `/api/workspace` |
| Routers totales montados | `backend/server.py` | **35** | — |

**Admin JWT — los 3 únicos endpoints** (`auth_routes.py`):
```
L66   POST /api/auth/login   → LoginResponse
L97   GET  /api/auth/me      → UserPublic   (Depends(get_current_user))
L108  POST /api/auth/logout                 (Depends(get_current_user))
```

**Workspace — los 4 endpoints** (`workspace_routes.py`), todos con `Depends(require_current_user)`:
```
L184  GET    /api/workspace/me
L191  PUT    /api/workspace/me
L199  PATCH  /api/workspace/me          ← NO consumido por el frontend (ver §3)
L221  POST   /api/workspace/me/reset
```

**Comunidad — 14 endpoints** (login, register, session, me, logout, providers, password/forgot, password/reset, verify/send, verify/confirm, OAuth callbacks…).

### 1.2 Inventario frontend

| Elemento | Archivo | Transporte | Consumidores |
|---|---|---|---|
| `AuthContext` | `contexts/AuthContext.jsx` | `Bearer` + `localStorage['pcs_admin_token']` | **10 archivos** |
| `CommunityAuthContext` | `contexts/CommunityAuthContext.jsx` | cookie httpOnly (vía `authService`) | **29 archivos** |
| `WorkspaceContext` | `contexts/WorkspaceContext.jsx` | `credentials:'include'` (cookie) | HomePage, MiEspacioConfigPage |
| `authService` | `services/authService.js` | cookie → `/api/community/auth/*` | AuthCallback, CommunityAuthContext, JoinPage, ResetPasswordPage, VerifyEmailPage |
| `workspaceService` | `services/workspaceService.js` | cookie → `/api/workspace/*` | **solo** `WorkspaceContext` |
| `workspacePresets` | `services/workspacePresets.js` | — | `workspaceRegistry`, `WorkspaceContext` |
| `workspaceRegistry` | `services/workspaceRegistry.jsx` | — | WorkspaceDndProvider, WorkspacePanel, MiEspacioConfigPage |

**Anidamiento de providers** (`App.js:86-100`) — evidencia de la dependencia:
```
<AuthProvider>                    ← Sistema A (JWT admin)
  <CommunityAuthProvider>         ← Sistema B (cookie)
    <UIPreferencesProvider>
      <RealtimeProvider>
        <WorkspaceProvider>       ← consume CommunityAuth (user)
```
> `WorkspaceProvider` está **dentro** de `CommunityAuthProvider` porque `WorkspaceContext.jsx:25,37` hace `useCommunityAuth()`. Esto **confirma** que el Workspace Engine depende hoy del Sistema B.

**Rutas protegidas** (`App.js`):

| Ruta | Guard | Página |
|---|---|---|
| `/admin` | `ProtectedAdminRoute` | `AdminDashboardPage` |
| `/admin/documents` | `ProtectedAdminRoute` | `AdminDocumentsPage` |
| `/admin/platform` | `ProtectedAdminRoute` | `AdminPlatformPage` |
| `/investor-portal` | `ProtectedInvestorRoute` | `InvestorPortalPage` |
| `/admin/login` | — (pública) | `AdminLoginPage` |
| `/login` | — (pública) | `LoginPage` ← Gateway |
| `/workspace` | — (pública) | `WorkspaceGatewayPage` ← Gateway |
| `/join` | — (pública) | `JoinPage` 🔒 intocable |

### 1.3 JWT — anatomía (Sistema A)

- Firmado en `backend/auth.py`; `LoginResponse` en `models.py`.
- Modelo de rol: `UserRole = Literal["admin", "investor"]` (`models.py:11`).
- **Stateless**: no existe colección de sesiones; **no existe refresh token** en ninguno de los dos sistemas.
- `get_current_user` valida el `Bearer` contra `db.users`.

### 1.4 Hallazgo crítico (resumen del §0)

`/api/workspace/*` valida con `require_current_user` → resuelve contra `db.user_sessions` (**cookie de comunidad**, `community_deps.py:47`). El frontend refuerza el acoplamiento: `workspaceService` envía `credentials:'include'` y `WorkspaceContext` lee `useCommunityAuth()`.

**Resultado:** el JWT admin emitido por `/login` **no habilita** el Workspace. El objetivo "un solo login" no se cumple end-to-end.

---

## 2. Componentes reutilizables

Todo lo listado aquí **ya existe y funciona**; el Identity Core debe construirse *sobre* ello, no al lado.

### 2.1 Reutilizable — Backend

| Componente | Archivo | Por qué es reutilizable |
|---|---|---|
| **Colección `db.users`** | compartida por ambos sistemas | 🔑 **La pieza clave.** Ambos sistemas ya leen/escriben el mismo documento de usuario. Es el punto natural de fusión: no hay migración de datos. |
| `db.user_sessions` | `community_auth.py` | Infraestructura de sesión con TTL (`SESSION_TTL_DAYS=7`) ya resuelta. Sirve como único store de sesiones. |
| `ProviderRegistry` | `community_auth.py` | Registro de identidad multi-proveedor ya implementado y desacoplado (`BaseAuthProvider` → `exchange_session`). Añadir un proveedor = `registry.register(...)`. |
| `get_current_user` | `auth.py` | Validador JWT funcional contra `db.users`. |
| `require_current_user` | `community_deps.py` | Resolutor de sesión (cookie/Bearer). |
| `UserPublic` / `LoginResponse` | `models.py` | Contratos Pydantic ya estables y consumidos por el frontend. |
| `Company.vertical` | `models_business.py` | Eje multi-tenant **ya documentado como tal** y con filtro operativo (`GET /api/companies?vertical=`). |
| `ProfilePublic.verticals[]` | `models_profile.py` | Ya modela "verticales activas del usuario" → base para `context.verticals`. |
| `my_role` (team de empresa) | `models_business.py:142` | Base para `context.permissions` / `organizations`. |

**Proveedores OAuth ya registrados** (`community_auth.py:327-333`): Emergent, **LinkedIn**, **Microsoft**, **GitHub**, **Facebook**.
> ⚠️ No hay proveedor **Google** registrado — dato relevante para el diseño multi-vertical (el flujo corporativo suele esperar Google/Workspace SSO).

### 2.2 Reutilizable — Frontend

| Componente | Archivo | Por qué es reutilizable |
|---|---|---|
| `WorkspaceContext` + `applyPreset()` | `contexts/WorkspaceContext.jsx` | 🔑 Engine completo: persiste layout, aplica presets, ya incluye rama anónima. **Solo hay que cambiarle la fuente de identidad**, no reescribirlo. |
| `workspacePresets` — **7 presets** | `services/workspacePresets.js` | `legal`, `health`, `contabilidad`, `empresa`, `fundador`, `empleos`, `capital`. Cubre ya Legal/Medical/Empresa. |
| `workspaceRegistry` — widgets | `services/workspaceRegistry.jsx` | `WORKSPACE_WIDGETS` + `WORKSPACE_REGISTRY` congelado + `getWidget()`/`workspaceCategories()`. Sistema de widgets ya maduro. |
| `workspaceService` | `services/workspaceService.js` | Cliente de `/api/workspace/*` (get/update/reset). |
| `workspaceSpaces` | `config/workspaceSpaces.js` | **Creado en Fase 1** — catálogo del selector universal (4 espacios). |
| `LoginCardOne` (vista pura) | `components/LoginCardOne.jsx` | 🔒 Intocable por regla. Ya expone API portable (`onSubmitCredentials`, `onEnter`, `redirectTo`) → sirve como UI del Identity Core **sin modificarlo**. |
| `WorkspaceGatewayPage` | `pages/` | **Creado en Fase 1+2** — el "Workspace Router" visual del diagrama objetivo. |

### 2.3 Auditoría de verticales (FASE 4)

El catálogo de demostración no acredita el estado de producción de productos externos.

| Vertical | Evidencia local | Reutilización potencial | Pendiente |
|---|---|---|---|
| Legal | Mock `LIVE`, preset `legal`, placeholder | Directorio, perfiles y motor de workspace | Auditar implementación externa, auth y módulos jurídicos |
| Medical | Mock `Roadmap 2026`, preset `health`, placeholder | Mismos servicios comunes candidatos | Contrato clínico, habilitaciones y nomenclatura Medical/Salud/Health |
| Empresa | Preset `empresa`, Company y equipo, placeholder | Directorio de empresas y membresías | Lanzamiento y módulos ERP no acreditados |
| Comunidad One | Rutas, auth cookie, perfiles y servicios locales | Base de identidad y servicios existentes | Preservar contratos durante integración |

Servicios comunes locales: feed, empresas, perfiles, notificaciones, realtime, preferencias, widgets y presets. No se ha demostrado que Legal externo los consuma. Expedientes jurídicos, historias clínicas y procesos ERP quedan fuera del Identity Core. La consolidación de identidad tiene impacto alto y requiere pruebas de integración.

### 2.4 Mapa de dependencias (quién depende de quién)

```
                 db.users  <---- AMBOS SISTEMAS ESCRIBEN AQUI
                    ^
        +-----------+------------+
   AuthContext              CommunityAuthContext
   (Bearer/JWT)               (cookie)
        |                          |
   +----+-----+              +-----+------+
   | 10 files |              | 29 files   |  <-- JoinPage (INTOCABLE) incluida
   +----------+              +-----+------+
                                   |
                            WorkspaceContext ---> Workspace Engine
                             (applyPreset)        (registry + presets)
```

**Regla de oro derivada:** cualquier cambio en `CommunityAuthContext` impacta **29 archivos** → por eso es intocable y el Identity Core debe ser **envolvente, no sustituto**.

---

## 3. Componentes que deben eliminarse (o desactivarse)

Criterio: candidatos a consolidación, no eliminaciones aprobadas. La ausencia de llamadas locales no prueba ausencia de clientes externos.

| Componente | Hallazgo | Acción propuesta |
|---|---|---|
| `workspaceService.patch()` | Sin llamadas locales identificadas | Evaluar retirada del método tras inventariar clientes; conservar endpoint mientras haya incertidumbre |
| `AdminLoginPage` y `/admin/login` | Segundo formulario, todavía en uso | Comparar funciones y destinos antes de consolidar; preservar contrato mediante alias |
| Rama anónima de WorkspaceContext | Fallback legítimo de One | Conservar; no causa el desacople JWT/cookie |
| Guards admin/investor | Patrón compartido con políticas distintas | Compartir lógica mediante wrappers sin cambiar permisos ni destinos |

> ️ **Nada de esto se toca ahora.** Se documenta para la fase de consolidación posterior a la aprobación.

## 4. Componentes que deben fusionarse

**Propuesta sujeta a aprobación; ninguna fusión se ejecuta ahora.**

| Área | Consolidación incremental | Condición de seguridad y compatibilidad |
|---|---|---|
| Identidad | Reutilizar los validadores JWT y de sesión detrás de un contrato de identidad común | No sustituir CommunityAuthContext ni asumir que dos sesiones del navegador representan al mismo usuario |
| Autorización | Centralizar resolución de principal y políticas; conservar los adaptadores de transporte existentes | Autenticar no equivale a ser admin ni a tener acceso a una empresa; mantener controles por recurso |
| Guards | Compartir la lógica de carga y sesión de ProtectedAdminRoute y ProtectedInvestorRoute | Conservar sus reglas de rol y destinos actuales mediante wrappers; no fusionar permisos |
| Login | Evolucionar la entrada System como puerta canónica | Antes de deprecar otro formulario, comparar cambios de contraseña, invitaciones y destinos por rol |
| Workspace | Conectar WorkspaceContext con identidad verificada, sin cambiar sus IDs ni contratos de persistencia | Actualizar coherentemente transporte frontend y dependencia backend; cambiar solo el provider no resuelve el desacople |

Una fachada frontend puede unificar la lectura de estado, pero **no convierte una cookie en JWT, no crea SSO y no es una autoridad de permisos**. Si JWT y cookie identifican usuarios diferentes, se debe bloquear la selección automática y solicitar resolución explícita; nunca unir sus permisos.

La colección compartida `users` es infraestructura reutilizable, no prueba de un esquema de identidad homogéneo. Hay que revisar IDs, campos requeridos, vinculación de proveedores y duplicados antes de cualquier migración.

## 5. Riesgos, deuda técnica y límites de evidencia

Esta es una auditoría estática del repositorio disponible, no una certificación de producción ni una prueba de intrusión. No se inspeccionaron bases de datos reales, secretos desplegados, proxy, DNS ni el repositorio de Legal.

| Prioridad | Hallazgo | Tratamiento requerido antes de unificar |
|---|---|---|
| Alta | JWT System y sesión One pueden representar identidades diferentes en un mismo navegador | No sumar permisos ni elegir silenciosamente una identidad; detectar conflicto y exigir resolución explícita |
| Alta | Workspace utiliza sesión One, no el JWT de System | Adaptar ambos lados del contrato bajo pruebas; no basta cambiar el provider frontend |
| Alta | `users` compartido no garantiza campos compatibles | Inventariar esquemas/IDs y duplicados; el login admin requiere `role`, `name`, `created_at`; no asignar privilegios por defecto |
| Alta | No existe SSO demostrado entre dominios registrables diferentes | Diseño de federación; cookies y localStorage no se comparten entre system.com y legal.com |
| Alta | Roles globales admin/investor no representan membresías ni permisos por vertical | Resolver autorización por usuario, empresa y recurso en backend; denegar por defecto |
| Alta | Logout JWT es stateless; el frontend elimina su token, pero el endpoint no lo revoca | Definir revocación y logout local/global antes de prometer cierre universal |
| Media | JWT HS256, TTL por defecto 8 horas, sin refresh; claims sin issuer/audience | Diseñar ciclo de vida, validación de emisor/destinatario y gestión de claves; no distribuir secreto HS256 a verticales |
| Media | Token JWT en localStorage | Evaluar reducción de exposición a XSS y sesión de servidor; preservar compatibilidad durante transición |
| Media | CORS permite credenciales y tiene origen por defecto `*` en configuración | Validar lista explícita de orígenes por entorno; CORS no sustituye autenticación ni protección CSRF |
| Media | Limitación de login depende de IP/email y de cabeceras del proxy | Verificar cadena de proxies confiables, política de límites y observabilidad; no asumir protección de producción |
| Media | Presets y `Company.vertical` describen presentación/categoría | No utilizarlos como frontera de tenant ni como autorización |
| Media | Pruebas actuales principalmente de UI con mocks | Añadir pruebas de contrato, backend, aislamiento y navegación real antes de migrar |

### Precisiones que sustituyen conclusiones preliminares

- Sin cookie One válida, un login JWT deja el motor en modo anónimo. Si ya existe cookie One, el motor puede cargar ESA identidad: no necesariamente queda anónimo.
- `applyPreset` personaliza y persiste layout; no autentica ni acredita acceso. La rama anónima es un fallback legítimo: el desacople de transportes es la causa, no ese layout.
- El catálogo mock etiqueta Legal como `LIVE`; no demuestra disponibilidad, módulos, autenticación ni compatibilidad de su implementación externa. Empresa no tiene estado real de lanzamiento acreditado por dicho catálogo.
- El campo `vertical` no sustituye comprobar membresía en cada `company_id`. Profesión, especialidades o verticales del perfil tampoco conceden permisos.
- Métodos sin llamadas locales (como `workspaceService.patch`) son candidatos a revisión, no código muerto demostrado para todos los clientes. No eliminar endpoints sin inventario de consumidores externos y telemetría.
- Los guards admin/investor y `/admin/login` están en uso. Reutilizar lógica con wrappers es una opción futura, no una eliminación inmediata.
- Compartir colección no elimina una posible migración. No vincular cuentas automáticamente solo por coincidencia de email.

## 6. Arquitectura propuesta — diseño, no implementación

```text
One / Legal / Medical / Empresa
              |
       Identity Core System
       identidad y sesión central
              |
       Context Service
       membresías y permisos
              |
       Workspace Router
              |
       Workspace Engine compartido
       layouts, widgets, preferencias
              |
       espacio autorizado de cada vertical
```

### 6.1 Identity Service y acceso universal

Reutilizar almacenamiento de usuarios, hashing, proveedores y validadores existentes detrás de un servicio común. Mantener los contratos legados como adaptadores mientras se migra; no crear otra base de credenciales ni otro formulario paralelo.

El flujo conceptual `POST /login → Identity Service → JWT → Context Service → Workspace Router` no implica añadir hoy un endpoint `/login`. El contrato actual es `POST /api/auth/login`; cualquier cambio público se versionará y aprobará por separado.

Para dominios independientes se propone federación estándar OIDC/OAuth con Authorization Code y PKCE, cliente registrado por vertical, redirects exactos permitidos, state/nonce y códigos de un solo uso. Es una capacidad futura, NO un protocolo ya implementado en el repo. Antes de construirla, evaluar infraestructura OIDC existente en el despliegue. El registro actual de proveedores de login no equivale a un servidor OIDC.

La sesión central reside en System. Cada vertical redirige al mismo servicio y obtiene su sesión local mediante el flujo acordado. No pasar JWT por URL, compartir contraseñas, copiar localStorage ni distribuir el secreto HS256. Cada API debe validar identidad y permisos. Si se adopta JWT federado, definir issuer, audience, expiración y rotación de claves verificables antes del despliegue.

Definir explícitamente sesiones expiradas, revocación, renovación y logout local frente a global. No hay refresh token actual que pueda darse por reutilizado. Toda futura renovación debe tener ciclo de vida y revocación propios, sin cambiar de golpe las sesiones One.

### 6.2 Context Service — contrato conceptual, no implementado

Recibe una identidad verificada, nunca un user_id libre del cliente. Reutiliza usuarios/perfiles, companies y relaciones de equipo. Antes de crear organizations, determinar si Company cubre el modelo: no duplicar almacenamiento por cambiar el nombre.

```json
{
  "user": { "id": "identidad-verificada" },
  "verticals": [],
  "organizations": [],
  "companies": [],
  "roles": [],
  "default_workspace": null,
  "permissions": [],
  "context_version": "version-del-contrato"
}
```

Las listas vacías representan ausencia de acceso, no acceso universal. Cada rol y permiso debe tener alcance e identificador del recurso. Las verticales deben distinguir autorización de disponibilidad comercial.

**Orden de resolución:**
1. Validar principal, sesión y estado de cuenta mediante los adaptadores existentes.
2. Resolver membresías activas y empresas desde relaciones autoritativas, no desde campos de texto del perfil.
3. Resolver roles globales y acotados, sin convertir admin/investor en acceso universal implícito.
4. Derivar permisos y verticales con políticas explícitas; cada API comprueba nuevamente la operación sobre el recurso.
5. Elegir workspace: destino solicitado si autorizado → preferencia guardada si autorizada → único espacio autorizado y disponible → selector /workspace. Validar también el destino de navegación.
6. Si no hay derechos, devolver contexto restringido; si falla la resolución, error recuperable, nunca permisos por fallback.

Invalidar contexto al cambiar usuario, membresía o permisos. No persistir autorización dentro del layout. Los perfiles profesionales describen profesión; una habilitación profesional requiere verificación independiente si el negocio la exige.

### 6.3 Verticales: alcance real comprobable

| Vertical | Infraestructura local reutilizable | Qué falta verificar o desarrollar |
|---|---|---|
| One | Comunidad, perfiles, empresas y servicios compartidos | Compatibilidad de sesiones y contratos durante la transición |
| Legal | Entrada de catálogo, preset y placeholder | Implementación externa, auth, IDs, roles, callbacks y pruebas de staging; no disponibles en esta auditoría |
| Medical | Preset health y placeholder | Producto clínico, habilitaciones, políticas específicas y aislamiento de datos sanitarios |
| Empresa | Company, equipo, preset y placeholder | Procesos empresariales; un preset no acredita un ERP desplegado |

Servicios comunes candidatos: identidad, perfiles, directorio Company, membresías, notificaciones, preferencias y motor de widgets. Su reutilización por productos externos requiere contratos e integración probados. Expedientes jurídicos, historias clínicas y procesos ERP son funcionalidades específicas futuras, no se crean en Identity Core.

## 7. Plan incremental — sujeto a aprobación

| Fase | Alcance | Puerta de salida |
|---|---|---|
| A | Congelar contratos e inventariar despliegues y Legal | Baseline reproducible, esquemas y clientes conocidos |
| B | Diseñar principal común y políticas | Contrato aprobado y conflictos de identidad resueltos conceptualmente |
| C | Resolución común detrás de adaptadores legados | Tests de ambos transportes sin cambiar CommunityAuthContext |
| D | Context Service de lectura | Membresías correctas y denegación por defecto |
| E | Conectar Gateway y motor con contexto validado | Login y persistencia identifican al mismo usuario; layouts conservados |
| F | SSO central y cliente piloto Legal en staging | Pruebas entre dominios y contratos aprobados |
| G | Despliegue gradual | Observabilidad, rollback y no regresión por vertical |
| H | Deprecar duplicaciones tras medir uso | Ningún consumidor activo depende de contratos retirados |

No incorporar dependencias hasta comprobar si el despliegue ya proporciona la capacidad equivalente. No aplicar presets automáticamente ni renombrar IDs persistidos.

## 8. Orden exacto de desarrollo

Solo después de aprobar esta auditoría:

1. Registrar contratos actuales, esquemas de usuario y pruebas de login/logout/me de ambos sistemas. Obtener el repositorio o contrato de autenticación de Legal y un entorno de staging.
2. Acordar identificador canónico, vinculación explícita de cuentas, tratamiento de sesiones contradictorias y modelo de membresías. No vincular por email sin verificación.
3. Definir el principal común y adaptar los resolutores existentes detrás de él, conservando contratos JWT y cookie. Mantener controles por recurso y respuestas legadas.
4. Probar identidad, expiración, cuenta inexistente, roles y aislamiento entre empresas en backend antes de conectar consumidores nuevos.
5. Implementar Context Service de lectura con permisos acotados y denegación por defecto; comprobar que perfiles y presets no conceden acceso.
6. Conectar el Gateway al contexto, sin aplicar presets automáticamente, y alinear la identidad del motor y su transporte con la validación backend. Conservar layouts, IDs, rutas y comportamiento anónimo de One.
7. Verificar infraestructura de federación disponible y definir el contrato SSO, clientes, redirects, claves y ciclo de sesión. Reutilizar una solución equivalente existente antes de introducir otra.
8. Integrar System y Legal en staging mediante el contrato aprobado. Probar inicio desde ambos dominios, retorno autorizado, expiración, logout local/global y conflictos de sesiones.
9. Activar gradualmente con métricas y rollback por cliente. Incorporar Medical y Empresa únicamente cuando existan sus contratos y políticas.
10. Medir uso antes de deprecar formularios, métodos o endpoints. Mantener wrappers y aliases para consumidores activos.

Ningún paso autoriza cambiar CommunityAuthContext. LoginCardOne se conserva; cualquier excepción necesita evidencia y aprobación específica.

## 9. Estimación de impacto

Estimación cualitativa de alcance, no calendario cerrado: faltan contratos de Legal, datos reales y configuración de despliegue.

| Área | Impacto previsto | Motivo |
|---|---|---|
| Documento y diseño actuales | Sin impacto funcional | No cambian contratos ni código ejecutable |
| Gateway visual | Bajo | Consume contexto y catálogo; no concede permisos |
| Identidad común y adaptadores | Alto | Afecta dos transportes y sus consumidores; requiere compatibilidad estricta |
| Context Service | Medio-alto | Debe verificar membresías, roles y permisos por recurso |
| Workspace Engine | Medio-alto | Deben coincidir usuario, transporte y persistencia sin perder layouts |
| SSO multidominio | Alto; pendiente de alcance externo | Requiere clientes, infraestructura y pruebas de Legal |
| Consolidación de guards y formularios | Medio | Hay consumidores activos; preservar destinos y roles |
| Módulos de negocio de verticales | Fuera de alcance | No se crean módulos jurídicos, clínicos ni ERP |

El alcance transversal de CommunityAuthContext impide tratar la unificación como una sustitución simple del provider. Las estimaciones de esfuerzo deberán fijarse después del paso 1, con responsables y pruebas de aceptación.

## 10. Verificación y compatibilidad

### Evidencia disponible

- Resultado guardado de la ejecución de `craco test --watchAll=false`: **6 suites, 27 tests aprobados**. Incluye LoginPage, WorkspaceGatewayPage, WorkspaceSpacePlaceholderPage, LoginCardOne, AuthCallback y WelcomeModal.
- Es una baseline de frontend con mocks; no demuestra SSO, seguridad backend ni funcionamiento del sitio Legal externo. No se afirma un build nuevo ni pruebas end-to-end en esta auditoría.
- En esta fase solo se redactó este documento. Los cambios de Gateway visibles en Git pertenecen a la fase anterior; no son implementación de Identity Core.
- No se modificaron backend, AuthContext, CommunityAuthContext, LoginCardOne ni JoinPage durante esta auditoría.

### Confirmación posible, sin garantías inventadas

**Punto Cero One:** esta entrega documental no altera su comportamiento. La futura integración deberá mantener sus contratos de cookie, login, registro, recuperación, verificación, logout, perfiles y persistencia de workspace. La baseline actual no reemplaza estas pruebas de integración.

**Punto Cero Legal:** no se modifica su implementación en esta entrega. **No se puede certificar su compatibilidad futura** sin auditar su código o contrato y validar staging. La entrada de catálogo no prueba que comparta autenticación ni módulos con One.

Puertas obligatorias para autorizar despliegue: suite existente verde; pruebas de contratos legados; identidad coherente entre login y workspace; aislamiento por empresa/recurso; pruebas de sesiones contradictorias y expiradas; SSO real entre dominios; logout con alcance documentado; rollback probado. Si falla alguna, no desplegar.

**Decisión pendiente:** aprobación del diseño y del alcance de la siguiente fase. No se ha implementado Identity Core ni Context Service.
