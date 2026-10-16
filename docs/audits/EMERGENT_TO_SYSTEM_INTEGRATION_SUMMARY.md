# EMERGENT_TO_SYSTEM_INTEGRATION_SUMMARY.md
**Fecha:** 2026-08-08 · **Modo:** SOLO LECTURA (sin cambios de código, componentes, refactor, build, deploy ni commit)
**Propósito:** resumen ejecutivo de lo que este proyecto (Emergent) conoce y necesita aportar a la fusión con **Punto Cero System** (Core definitivo, VS Code).
**Rol de este repo tras la fusión:** Landing pública, Punto Cero One, Comunidad, Feed, Empleos, Eventos, Marketing.

---

## 1. Login Social — qué datos guarda exactamente cada registro

Todos los métodos crean/usan **un solo documento en la colección `users`** (merge idempotente por `email` — nunca duplica). La sesión vive en **`user_sessions`** y en la cookie httpOnly `session_token` (Secure, SameSite=None, 7 días).

### 1.1. Google (vía relay gestionado Emergent)
| Campo en `users` | Valor |
|---|---|
| `id` | `user_<hex12>` (generado) |
| `email` | Email de Google (lowercase, único) |
| `name` | Nombre de la cuenta Google |
| `picture` | URL del avatar de Google |
| `role` | `"member"` |
| `country`, `language`, `headline` | `null` |
| `auth_providers[]` | `{provider: "google", provider_user_id: <id de Google>, linked_at}` |
| `email_verified` | `true` (Google ya lo verificó) |
| `created_at`, `last_login_at` | timestamps ISO |

**Sesión:** `user_sessions` ← `{session_token: "cs_<hex>" (o el token que emita el relay), user_id, provider: "google", expires_at (7 días), created_at}`.
**Otras colecciones:** ninguna (el relay no usa `oauth_states`).

### 1.2. Facebook (OAuth2 Authorization Code)
Mismo documento de `users`, con `auth_providers[]` ← `{provider: "facebook", provider_user_id: <Facebook id>, linked_at}`, `picture` de Graph API, `email_verified: true`.
**Adicional:** `oauth_states` ← `{state, provider: "facebook", redirect_uri, created_at, expires_at (10 min)}` (anti-CSRF, se borra al usarse). Sesión `cs_<hex>` propia en `user_sessions`.

### 1.3. LinkedIn (OIDC)
Mismo documento de `users`, con `auth_providers[]` ← `{provider: "linkedin", provider_user_id: <sub OIDC>, linked_at}`, nombre desde `given_name/family_name`, `email_verified: true`.
**Adicional:** `oauth_states` igual que Facebook. Sesión propia en `user_sessions`.

### 1.4. Correo + contraseña
| Campo en `users` | Valor |
|---|---|
| `email`, `name` | Del formulario (name por defecto = parte local del email) |
| `password_hash` | bcrypt (nunca se expone) |
| `picture` | `null` |
| `email_verified` | `false` hasta confirmar el correo |
| `auth_providers[]` | `{provider: "password", provider_user_id: <email>, linked_at}` |

**Colecciones adicionales:**
- `email_verifications` ← `{token, user_id, email, created_at, expires_at (24 h), used}` (TTL index)
- `password_reset_tokens` ← `{token, user_id, email, created_at, expires_at (60 min), used}` (TTL index)
- `login_attempts` ← `{identifier: "ip:email", count, last_attempt, locked_until}` (bloqueo 5 intentos → 15 min)
- `invite_redemptions` ← `{invited_user_id, invited_email, referrer_id, code, created_at}` (si vino con código de invitación)

**Nota para la fusión:** no se guardan access/refresh tokens de Google/Facebook/LinkedIn — solo identidad normalizada. El Core puede re-vincular a los mismos usuarios sociales por `provider_user_id` + `email` sin pedirles nada.

---

## 2. Mi Espacio — composición actual y qué permanece

**Hoy lo forman:**
- **Backend:** colección `user_workspaces` (1 doc por usuario: `panels{left[],center[],right[]}`, `widgets{enabled,collapsed,size}`, `theme`, `layout_version`) + rutas `/api/workspace/me` (GET/PUT/PATCH/reset).
- **Frontend:** `HomePage.jsx` (3 columnas), `WorkspaceContext.jsx`, `workspaceRegistry.jsx` (catálogo de widgets), `workspacePresets.js`, `MiEspacioConfigPage.jsx`.
- **Widgets activos por defecto (9):** izquierda: `profile-card`, `activity`, `quick-links` · centro: `welcome-band`, `feed`, `inline-stats` · derecha: `rss-news`, `events`, `suggested-people`.
- **Widgets disponibles adicionales:** `messages`, `trending`, `companies`, `ai-tools`, `weather-live`, `calendar-mini`, `podcast-mini`, `nuestra-historia`.

**Cuando el Core tome el control:**
| Permanece en Emergent | Pasa al Core |
|---|---|
| El catálogo y render de widgets de **comunidad** (feed, profile-card, suggested-people, rss-news, events, inline-stats, activity, quick-links) | La **persistencia de layouts** (`user_workspaces` → Workspaces API del Core) |
| La página Home como "workspace de comunidad" | La configuración de espacios (`MiEspacioConfigPage` se elimina; el Core gestiona Workspaces) |
| — | Los widgets de marketing (`nuestra-historia`) salen del workspace y vuelven a la landing |

---

## 3. Comunidad — módulos que la forman hoy

1. **Feed social** — posts, comentarios, reacciones, guardados, compartidos, vistas, reportes, hashtags, trending, "Para ti", feed mixto regional
2. **Perfiles** — edición propia, perfil público `/u/:id`, foto/portada (object storage)
3. **Noticias** — motor de ingesta regional (11 107 items, 111 fuentes curadas, scheduler)
4. **Empleos** — ofertas, postulaciones, guardados
5. **Eventos** — eventos + RSVP
6. **Empresas** — perfiles de empresa, follows, verificación
7. **Grupos** — grupos, membresías, posts de grupo
8. **Mensajería 1:1** — construida pero **sin uso** (0 conversaciones)
9. **Notificaciones** — centro in-app + preferencias
10. **Grafo social** — follows unificado (personas/empresas/grupos)
11. **Transversales** — búsqueda, discovery regional, analytics, realtime (SSE), invitaciones virales, stats públicas

---

## 4. Integración con el Core — componentes de Emergent que deben conectarse

Solo enumeración (sin implementación):

1. **Lector de sesión/identidad** (`CommunityAuthContext` + endpoint `/me`) → Identity Core
2. **Perfil profesional** (edición y vista pública) → Identity Core
3. **Header global + Universal Launcher** → API de Launcher del Core
4. **Roles y badges de plan** → Core (roles + Billing)
5. **Persistencia de Mi Espacio** (`user_workspaces`) → Workspaces API del Core
6. **Empresas** (registro, edición, verificación) → Vertical Empresa del Core
7. **Empleos y eventos publicados por empresas** → sincronización con el Core
8. **Centro de notificaciones** → eventos del Core (registro, suscripción, vertical)
9. **Object storage** (avatares, portadas, imágenes de posts/grupos, documentos) → storage central del Core
10. **Emails transaccionales** (bienvenida, verificación, reset) → servicio de email del Core
11. **Panel admin** (`/admin/*`) → Consola Admin del Core
12. **Taxonomía `vertical` de posts/grupos/noticias** → Vertical Registry del Core
13. **Analytics** → pipeline unificado del Core
14. **Mensajería** → decisión pendiente: aportarla al Core o consumir la suya

---

## 5. Riesgos — los 5 más importantes de la fusión

| # | Riesgo | Impacto | Mitigación clave |
|---|---|:---:|---|
| 1 | **Colisión de identidades al fusionar `users`** (mismo email en ambos sistemas; IDs heterogéneos en Emergent: `user_<hex>` vs `uuid4`) | Alto | Conciliación por email + `legacy_one_id` + grace period de doble cookie (30 días) |
| 2 | **Cookie SSO mal configurada** (`Domain=.puntocerosystem.com`, SameSite, Secure) rompe la sesión de todos los usuarios a la vez | Alto | Probar en staging, doble cookie durante la transición, rollback trivial |
| 3 | **El Core no expone a tiempo los contratos** (`/identity/me`, `/launcher/apps`, eventos) — bloquea las fases 1-3 | Alto | Firmar contratos (Fase 0) antes de escribir código; Emergent puede avanzar con mocks |
| 4 | **Funcionalidad duplicada diverge** (mensajería, notificaciones, workspaces, empresas evolucionan distinto en ambos repos durante la transición) | Medio | Congelar features duplicadas en Emergent desde el día 1 de la fusión |
| 5 | **Dominio canónico y SEO** (hoy Emergent vive en `puntoceromultiservicios.com`; la arquitectura asume `puntocerosystem.com`; retirar rutas rompe enlaces indexados) | Medio | Decidir dominio canónico antes de Fase 1 + redirects 301 permanentes |

---

*Documento generado en modo estrictamente read-only. Ningún archivo de código, configuración, test ni dato fue creado, modificado o eliminado en el proyecto.*
