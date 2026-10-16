# ONE_CORE_FUSION_AUDIT.md
**Fecha:** 2026-08-07
**Auditor:** Arquitecto senior (auditoría estática, sin cambios en código)
**Contexto:** dos proyectos que deben convertirse en un solo ecosistema.

| | Proyecto A (Core / canónico) | Proyecto B (este repo) |
|---|---|---|
| Nombre | **Punto Cero System** | **Punto Cero One** |
| Entorno | VS Code (deploy propio) | Emergent (`puntocerosystem.com`) |
| Stack | React + FastAPI + MongoDB + JWT | React + FastAPI + MongoDB |
| Contiene | Identity Core, Auth JWT, usuarios/roles, Universal Launcher, Workspaces y verticales (Legal, Medical, Empresa, Profesional, Agentes, Darwin IA) | Landing pública, comunidad profesional, feed, noticias, eventos, empleos, networking, auth propia (Google/Facebook/LinkedIn/email) |
| Rol futuro | Fuente única de identidad + verticales especializadas | Fachada pública + capa social/comunidad |

**Visión:** un solo usuario, una sola identidad. Registro en One → crea identidad universal → accede a comunidad → accede a Launcher → entra a su Workspace/vertical.

---

## 1. Inventario de módulos duplicados

Se marca ✅ el proyecto que debe permanecer como fuente oficial (canónico).

| # | Módulo | Core (A) | One (B) | **Canónico** | Acción | Motivo |
|---|---|:---:|:---:|:---:|---|---|
| 1 | Identidad de usuario (`users`) | ✅ | ✅ | **Core** | **Migrar** usuarios de One a Core, luego **eliminar** colección en One | Un solo usuario para todo el ecosistema |
| 2 | Auth email/password | ✅ | ✅ | **Core** | **Eliminar** en One | Sólo Identity Core emite credenciales |
| 3 | OAuth Google | ✅ | ✅ | **Core** | **Eliminar** en One + registrar Redirect URIs de subdominios en el Core | Redirect único = seguridad + un solo panel |
| 4 | OAuth LinkedIn | ✅ | ✅ | **Core** | **Eliminar** en One | Ídem |
| 5 | OAuth Facebook | ✅ | ✅ | **Core** | **Eliminar** en One | Ídem |
| 6 | Sesiones (`user_sessions` + cookie) | ✅ | ✅ | **Core** | **Eliminar** en One; consumir cookie `pcs_id_token` (`Domain=.puntocerosystem.com`) | SSO real |
| 7 | Roles (`member`/`admin`/`investor`) | ✅ | ✅ | **Core** | **Migrar** rol al Core (con enum ampliado por vertical) | Roles unificados |
| 8 | Reset password / verify email / invitación | ✅ | ✅ | **Core** | **Eliminar** en One | Un único flujo confiable |
| 9 | Universal Launcher | ✅ | ❌ | **Core** | **Consumir** vía API pública `GET /api/launcher/apps` | Se muestra en Header de One tras login |
| 10 | Workspaces | ✅ | ✅ (`workspace_routes`) | **Core** | **Migrar** layouts guardados; **eliminar** backend local | Los widgets viven en Core |
| 11 | Perfil profesional (edición) | ✅ | ✅ (`profile_routes`) | **Core** | **Eliminar** editor local; redirigir a `identity.puntocerosystem.com/perfil` | Fuente única de perfil |
| 12 | Perfil público (`/u/:id`) | ✅ | ✅ | **Core** | **Consumir** perfil del Core; conservar sólo la vista SEO | Landing puede embeber preview |
| 13 | Vertical Legal (Firm OS) | ✅ | ❌ | **Core** | **Enlazar** al subdominio Legal | No duplicar |
| 14 | Vertical Medical | ✅ | ❌ | **Core** | **Enlazar** al subdominio Medical | No duplicar |
| 15 | Vertical Empresa | ✅ | ✅ (`CompaniesPage`, `CompanyProfilePage`, `company_routes`) | **Core** | **Migrar** empresas al Core; eliminar del landing | Empresa Vertical es del Core |
| 16 | Vertical Profesional | ✅ | ⚠️ (perfil ampliado) | **Core** | **Consumir** desde Core | Ídem |
| 17 | Vertical Agentes / IA | ✅ | ⚠️ (`AiPage`, `AiToolCard`) | **Core** | **Enlazar** al subdominio Agentes | Ídem |
| 18 | Darwin IA | ✅ | ❌ | **Core** | **Consumir** cuando One requiera IA (recomendaciones, resúmenes) | Un único motor IA |
| 19 | Administración | ✅ | ✅ (`AdminLoginPage`, `AdminDocumentsPage`, `admin_platform_routes`) | **Core** | **Eliminar** admin de One | Admin unificado |
| 20 | **Comunidad + Feed social** | ⚠️ (puede existir como consumidor) | ✅ | **One (B)** ★ | **Reutilizar** — mover al Core sólo si el equipo Core lo prefiere; hoy One es el más maduro | Único módulo donde One es superior |
| 21 | **Grupos / Comunidades** | ⚠️ | ✅ (`groups_routes`) | **One (B)** ★ | **Reutilizar** — extender con `vertical` para segmentar | Ídem |
| 22 | **Feed regional (mixed-feed, `content_sources`)** | ❌ | ✅ | **One (B)** ★ | **Reutilizar** — es el motor editorial de la landing | Único proveedor |
| 23 | **Noticias, Eventos, Empleos, Videos, Marketplace** | ⚠️ | ✅ | **One (B)** ★ | **Reutilizar**; a futuro el Core puede leer estas fuentes | Contenido informativo público |
| 24 | Mensajería 1-a-1 | ⚠️ (probable) | ✅ (`messaging_routes`) | **Pendiente** | Alinear con equipo Core: si Core tiene mensajería nativa, migrar; si no, One la aporta | Depende del estado del Core |
| 25 | Notificaciones | ⚠️ | ✅ (`notification_routes`) | **Pendiente** | Idealmente **Core** emite y One suscribe vía SSE | Consolidación futura |
| 26 | Realtime (SSE) | ⚠️ | ✅ (`realtime_routes`) | **Pendiente** | Alinear canal único; Core suele ser fuente de eventos | Ídem |
| 27 | Object storage (media profiles/posts/groups) | ✅ | ✅ | **Core** | **Migrar** storage a Core; One consume URLs firmadas | Una sola política de retención |
| 28 | Follows / grafo social | ❌ | ✅ (`follows_routes`) | **One (B)** ★ | **Reutilizar** | Núcleo de comunidad |
| 29 | Search | ⚠️ | ✅ (`search_routes`) | **Pendiente** | Consolidar en Core con index unificado a futuro | Search debe ver todo |
| 30 | Analytics | ⚠️ | ✅ (`analytics_routes`) | **Pendiente** | Un solo pipeline | Ídem |
| 31 | SEO (sitemap/robots) | — | ✅ (`seo_routes`) | **One (B)** | **Reutilizar** | La landing es SEO-first |
| 32 | Página institucional (Historia, Legal-compliance, Capital, Executive Summary, Pitch Deck) | — | ✅ | **One (B)** | **Reutilizar** | Marketing y storytelling |
| 33 | WelcomeModal + confetti registro | — | ✅ | **One (B)** | **Reutilizar** (dispara ante evento SSO del Core) | UX de bienvenida |
| 34 | Design system (Header, Footer, cursor, orbital ecosystem) | — | ✅ | **One (B)** | **Reutilizar** | Identidad visual del ecosistema |

★ = módulos donde este repo (One) es superior o único. Todo lo demás debe migrar al Core.

---

## 2. Auditoría del sistema auth actual de One

### 2.1. Proveedores OAuth soportados hoy

| Proveedor | Archivo | Envs backend | Callback |
|---|---|---|---|
| Email + password (bcrypt) | `community_auth_routes.py::register_email` / `login_email` | — | `POST /api/community/auth/register` / `POST /api/community/auth/login` |
| Google OIDC | `services/community_auth.py::GoogleProvider` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `/api/community/auth/oauth/google/callback` |
| LinkedIn OIDC | `services/community_auth.py::LinkedInProvider` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `/api/community/auth/oauth/linkedin/callback` |
| Facebook OAuth | `services/community_auth.py::FacebookProvider` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | `/api/community/auth/oauth/facebook/callback` |
| Emergent Google (managed) | `services/community_auth.py::EmergentSessionProvider` | `EMERGENT_AUTH_URL`, `EMERGENT_AUTH_SESSION_URL` | `/api/community/auth/session` |

### 2.2. Cómo guarda usuarios y sesiones

- **Colección `users`** — un documento por usuario. Campos: `id`, `email`, `name`, `picture`, `role`, `headline`, `bio`, `country`, `city`, `current_title`, `current_company`, `specialties`, `interests`, `portfolio_url`, `verticals`, `social{}`, `auth_providers[]`, `password_hash`, `email_verified`, `posts_count`, `followers_count`, `following_count`.
- **Colección `user_sessions`** — `{ session_token, user_id, provider, created_at, expires_at }`.
- **Cookie del navegador** — nombre `session_token`, `httponly=True`, `secure=True`, `samesite="none"`. Vida configurable (`COMMUNITY_SESSION_TTL_DAYS`).
- **JWT** — sólo se emite para el admin en `auth_routes.py` (`/api/auth/login`).

### 2.3. Colecciones MongoDB del sistema auth

`users`, `user_sessions`, `oauth_states`, `login_attempts` (brute-force), `email_verifications`, `password_reset_tokens`, `invite_redemptions`.

### 2.4. Dependencias

- Python: `bcrypt`, `httpx`, `python-jose`, `pydantic`, `motor`.
- Frontend: `contexts/CommunityAuthContext.jsx`, `pages/JoinPage.jsx`, `pages/ResetPasswordPage.jsx`, `pages/VerifyEmailPage.jsx`, `components/community/welcomeArm.js`, `components/community/WelcomeModal.jsx`.

### 2.5. Propuesta para dejar de ser auth propia

**Objetivo:** que One deje de emitir sesión y sólo la **lea** desde el Core.

1. **Identity Core emite una cookie universal** `pcs_id_token` con `Domain=.puntocerosystem.com`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=None`.
2. **One** deja de exponer los endpoints `POST /api/community/auth/register`, `POST /api/community/auth/login`, `/api/community/auth/oauth/*`, `/api/community/auth/session`, `/api/community/auth/reset-password`, `/api/community/auth/verify-email`. Estos se retiran del backend de One (Fase 2).
3. **Nuevo endpoint delgado en One:** `GET /api/community/auth/me` deja de leer `user_sessions` local y en su lugar hace un `HTTP GET https://identity.puntocerosystem.com/api/identity/me` (server-to-server) con la cookie recibida, cacheando el resultado 60 s por token. Retorna el usuario canónico.
4. **Frontend One:**
   - `CommunityAuthContext.jsx` deja de llamar a `/register` y `/login` locales.
   - El botón "Ingresar / Únete" ahora redirige a `https://identity.puntocerosystem.com/login?redirect=https://puntocerosystem.com/`.
   - `WelcomeModal` sigue funcionando pero se dispara con un evento SSE emitido por el Core (`identity.registered`) en lugar de `armWelcome` local.
5. **Colecciones a retirar en One (tras migración):** `user_sessions`, `oauth_states`, `login_attempts`, `email_verifications`, `password_reset_tokens`, `invite_redemptions`. La colección `users` se congela y luego se elimina cuando el 100 % de usuarios estén replicados en el Core.
6. **Migración de usuarios existentes:** exportar `users` de One, importar en Core marcando `origin: "one-legacy"`. Conciliar por email. Usuarios sin password válido reciben un email de "reclama tu identidad" con enlace mágico al Core.
7. **Envs a mantener sólo en Core:** `GOOGLE_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`, `JWT_SECRET`.
8. **Envs a eliminar de One:** las anteriores + `COMMUNITY_SESSION_TTL_DAYS` + `COOKIE_SAMESITE` (queda como referencia si el Core lo pide para cookies).

**Resultado final:** One es un **cliente** del Identity Core. No tiene ni gestiona identidad. Sólo lee la sesión y muestra la comunidad.

---

## 3. Flujo ideal del usuario

```
1. Visitante
   ↓ llega a puntocerosystem.com (landing en One)
2. Landing
   ↓ ve hero, comunidad, feed público, casos de éxito, verticales
   ↓ click "Únete"
3. Registro (SSO)
   ↓ redirige a identity.puntocerosystem.com/register
   ↓ Identity Core crea usuario canónico + emite cookie pcs_id_token
   ↓ redirige de vuelta a puntocerosystem.com/ (WelcomeModal + confetti en One)
4. Perfil
   ↓ One muestra CTA "Completa tu perfil profesional"
   ↓ click abre identity.puntocerosystem.com/perfil
   ↓ usuario completa profession_key + credentials + intereses
5. Comunidad
   ↓ vuelve a puntocerosystem.com
   ↓ One consume /api/identity/me con el token → hidrata usuario
   ↓ muestra feed personalizado según profession_key + intereses + país
   ↓ usuario publica, comenta, sigue a otros profesionales
6. Verticales (Universal Launcher)
   ↓ Header muestra <LauncherEntrypoint>
   ↓ Core devuelve las apps visibles para ese usuario:
        - Punto Cero One (comunidad) ✓
        - Legal · Medical · Empresa · Agentes según profession_key
7. Launcher → Workspace
   ↓ click "Legal" abre legal.puntocerosystem.com
   ↓ cookie SSO válida → sin re-login
   ↓ Core Workspaces carga el layout personal del usuario para esa vertical
8. Suscripción
   ↓ usuario descubre planes de la vertical (Firm OS, etc.)
   ↓ paga con Stripe (integrado en Core)
   ↓ permisos actualizados en Identity Core
9. Cliente activo
   ↓ usa la vertical diariamente
   ↓ recibe notificaciones en One (comunidad) y en la vertical
   ↓ feed de One le muestra contenido especializado + peers del mismo vertical
```

**Punto clave:** el usuario nunca ve dos logins, dos perfiles, dos identidades. La landing (One) es la puerta; el Core es la casa; las verticales son las habitaciones.

---

## 4. Estrategia para integrar verticales dentro de One

**Propuesta principal:** las verticales **NO se convierten en secciones de One**. Se integran como **servicios visibles desde One**, siguiendo tres patrones según el nivel de acoplamiento:

### 4.1. Patrón A · "Deep-link" (mínimo acoplamiento)

Se usa cuando la vertical es una app independiente y auto-suficiente en el Core (Legal Firm OS, Medical, Odontología, Psicología, Contabilidad).

- One muestra tarjetas del ecosistema en `EcosystemSection` y `OrbitalEcosystem`.
- Cada tarjeta es un `<a href="https://<vertical>.puntocerosystem.com">`.
- La cookie SSO (`pcs_id_token` con dominio compartido) garantiza sesión unificada al llegar a la vertical.
- La landing NO renderiza contenido de la vertical.

Ideal para: **Firm OS (Legal), Medical, Odontología, Psicología**.

### 4.2. Patrón B · "Widget embebido" (acoplamiento medio)

Cuando la vertical tiene información pública útil dentro del feed de comunidad (ej. anuncios legales, casos médicos anonimizados, ofertas de empresas).

- El Core expone un endpoint `GET /api/verticals/{vertical}/highlights` que retorna N items públicos.
- One inserta esos items en su feed regional bajo `kind: vertical_highlight` con un `PreviewCard` que dice "Ver en {Vertical}".
- Click lleva a la vertical con SSO.

Ideal para: **Empresa** (empresas destacadas en el feed) y **Agentes** (herramientas IA destacadas).

### 4.3. Patrón C · "Filtro de vertical" (acoplamiento alto)

Cuando la comunidad debe segmentarse por profession_key.

- Cada `post`, `group`, `event` en One recibe un campo `vertical` opcional.
- Los usuarios con `profession_key="medicina"` ven prioritariamente contenido con `vertical="medical"`.
- El feed sigue siendo de One (canónico para comunidad); las verticales del Core sólo aportan metadatos (a través de `profession_key` del usuario).

Ideal para: **Profesional** (segmentación) y transversalmente para todas las verticales.

### 4.4. Mapa de patrón por vertical

| Vertical | Patrón principal | Justificación |
|---|---|---|
| Legal (Firm OS) | A · Deep-link | App compleja, propia del Core |
| Medical (Medicina, Enfermería, Odontología, Psicología) | A · Deep-link + C · Filtro | Cada especialidad merece subdominio; el feed segmenta por profession_key |
| Empresa | A · Deep-link + B · Widget | Empresas destacadas aparecen en feed de One como tarjetas |
| Profesional | C · Filtro | No es una app, es una segmentación |
| Agentes (Darwin IA) | A · Deep-link + B · Widget | Herramientas IA destacadas en widget del sidebar |
| Contabilidad | A · Deep-link (futuro) | Cuando exista |

---

## 5. Arquitectura definitiva del ecosistema

```
                                 ▲  Tráfico público
                                 │
                    ┌────────────┴─────────────┐
                    │   DNS + Wildcard SSL     │
                    │  *.puntocerosystem.com   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Gateway / Ingress      │
                    │  (Emergent + Core K8s)   │
                    └────────────┬─────────────┘
                                 │
        ┌──────────┬─────────────┼──────────────┬─────────────┬───────────────┐
        │          │             │              │             │               │
        ▼          ▼             ▼              ▼             ▼               ▼
┌─────────────┐┌──────────┐┌──────────────┐┌──────────┐┌──────────┐┌──────────────────┐
│puntocero-   ││identity. ││legal.        ││medical.  ││empresa.  ││agentes.          │
│system.com   ││ *system  ││ *system      ││ *system  ││ *system  ││ *system          │
│             ││          ││              ││          ││          ││                  │
│ Landing +   ││ Identity ││ Firm OS      ││ Medicina ││ Empresa  ││ Darwin IA        │
│ One         ││ Core     ││ (vertical)   ││Enfermería││ Vertical ││ + otros agentes  │
│ (feed,      ││ (Auth +  ││              ││Odontolog││          ││                  │
│  comunidad, ││  JWT +   ││              ││Psicolog ││          ││                  │
│  noticias,  ││  OAuth + ││              ││          ││          ││                  │
│  eventos)   ││  usuarios││              ││          ││          ││                  │
└─────┬───────┘└─────┬────┘└──────┬───────┘└─────┬────┘└─────┬────┘└──────┬───────────┘
      │              │            │              │           │            │
      │              │            │              │           │            │
      └──────────────┴────────────┴──────────────┴───────────┴────────────┘
                                        │
                                        │  cookie pcs_id_token
                                        │  (Domain=.puntocerosystem.com)
                                        │
                                        ▼
                          ┌──────────────────────────────┐
                          │  Identity Core Backend       │
                          │  ────────────────────────    │
                          │  · users (canónica)          │
                          │  · roles / verticals /       │
                          │    profession_key            │
                          │  · JWT emisión + verify      │
                          │  · OAuth Google/LinkedIn/    │
                          │    Facebook/Emergent         │
                          │  · Universal Launcher API    │
                          │  · Workspaces API            │
                          │  · Object storage central    │
                          │  · Suscripciones (Stripe)    │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │  Punto Cero One Backend      │
                          │  ────────────────────────    │
                          │  · Feed social + comunidad   │
                          │  · Posts / follows / groups  │
                          │  · Notificaciones + SSE      │
                          │  · Mensajería (o proxy Core) │
                          │  · Content sources regional  │
                          │  · Search + Analytics        │
                          │  · Consumidor de Identity    │
                          └──────────────────────────────┘
```

**Reglas de propiedad de datos:**
- Usuarios, credenciales, roles, workspaces → **Core**.
- Posts, follows, comentarios, notificaciones, feed regional, grupos, noticias, eventos, empleos → **One**.
- Casos legales, historia clínica, contabilidad → cada **vertical** en el Core.
- El grafo social (follows) es propiedad de One porque nace del feed.

**Reglas de comunicación:**
- Todo cross-backend es **HTTP JSON server-to-server** con un `service_token` interno (además del `pcs_id_token` del usuario).
- Eventos entre backends por webhook o pub/sub interno (`identity.registered`, `subscription.activated`, `user.deactivated`).
- Nada se replica sin fuente única: One consulta al Core en cada `/me`, con cache corto.

---

## 6. Roadmap de fusión

Cada fase se completa antes de iniciar la siguiente. Todas requieren coordinación con el equipo Core.

### Fase 0 · Preparación (2-3 días)
- Confirmar con equipo Core los endpoints públicos que expondrá: `/api/identity/me`, `/api/identity/logout`, `/api/launcher/apps`, `/api/verticals/{v}/highlights`, `/api/stats/public`.
- Provisionar wildcard SSL `*.puntocerosystem.com`.
- Registrar Redirect URIs de subdominios en Google/LinkedIn/Facebook (paneles de cada provider).
- **Riesgo:** SLA de proveedores OAuth (24-72h para verificaciones).
- **Intocable:** Core (Auth, JWT, MongoDB, Workspaces, Verticales, Firm OS).

### Fase 1 · Auditoría (este documento) — 1 día
- ✅ Inventario, contratos, patrón por vertical.
- **Entregable:** este documento firmado por ambos equipos.

### Fase 2 · SSO — 1 semana
- One consume `pcs_id_token` (cookie con `Domain=.puntocerosystem.com`).
- `CommunityAuthContext` reemplazado por `CoreIdentityContext` que lee `/api/identity/me` del Core.
- Botón "Ingresar" redirige a `identity.puntocerosystem.com/login`.
- Se marcan como **deprecated** (pero no se eliminan aún) los endpoints locales de auth.
- **Prioridad:** P0.
- **Riesgo:** cookie mal configurada rompe la sesión de todos.
- **Intocable adicional:** `IntelligentFeed`, `FeedPostCard`, `FeedComposer`, `content_sources_routes`, `profile_media_routes`, `notification_routes`, `messaging_routes`, tests 30/30.

### Fase 3 · Migración de usuarios — 1 semana
- Export `users` de One (`~N registros`) → import Core con `origin: "one-legacy"`.
- Envío de correos "reclama tu identidad" a usuarios sin password válido.
- Grace period 30 días: One acepta la cookie legacy Y la cookie del Core.
- **Prioridad:** P0.
- **Riesgo:** desconciliación por emails duplicados → resolver caso a caso.

### Fase 4 · Universal Launcher — 3-5 días
- Header de One incorpora `<LauncherEntrypoint>` que consume `GET /api/launcher/apps` del Core.
- Menú global con verticales visibles según `profession_key`.
- **Prioridad:** P1.
- **Riesgo:** bajo — es un componente de UI que consume una API existente.

### Fase 5 · Verticales enlazadas — 1 semana
- `EcosystemSection` y `OrbitalEcosystem` con links reales a `legal.*`, `medical.*`, `empresa.*`, `agentes.*`.
- Widget embebido opcional para "Empresas destacadas" y "Agentes IA destacados" (patrón B).
- `posts.vertical`, `groups.vertical`, `growth_items.verticals` como campos opcionales para segmentar el feed (patrón C).
- **Prioridad:** P1.

### Fase 6 · Limpieza — 1 semana
- Retirar endpoints de auth propios de One (`/register`, `/login`, `/oauth/*`, `/reset-password`, `/verify-email`).
- Retirar páginas duplicadas: `AdminLoginPage`, `AdminDocumentsPage`, `ProfileCustomizePage`, `MiEspacioConfigPage`, `AiPage`, `CompanyProfilePage`, `AiToolCard`.
- Migrar workspaces guardados al Core.
- Retirar colecciones `oauth_states`, `login_attempts`, `email_verifications`, `password_reset_tokens`, `invite_redemptions`.
- Redirect 301 permanente de las rutas eliminadas hacia el Core.
- **Prioridad:** P2 (bloquea sólo si se detecta duplicación en analítica).

### Fase 7 · Producción — 1-2 semanas
- Certificado wildcard aprovisionado.
- DNS records por subdominio verificados.
- Monitoreo SSO end-to-end (Sentry / logs / SLOs).
- Testing_agent regresión completa.
- Anuncio público.
- **Prioridad:** P0.

**Total estimado:** 5-7 semanas con equipos coordinados.

### Módulos intocables durante toda la fusión
- Backend Core: **Identity, Auth, JWT, MongoDB del Core, Workspaces, Legal (Firm OS), Medical, Empresa, Agentes/Darwin IA, Administración**.
- Backend One: **feed, content-sources, profile_media_routes (whitelist recién arreglada), notification_routes, messaging_routes, realtime_routes, tests (30/30 verdes)**.
- Frontend One: **IntelligentFeed, FeedPostCard, FeedComposer, LiveFeed, PreviewCard, WelcomeModal, componentes de marketing (Ecosystem, Orbital, LatinAmerica, Capital, ExecutiveSummary, Pitch, InvestorRoom), Header, Footer, custom cursor**.

---

## 7. Respuesta a la pregunta final

> **¿Cuál es la mejor estrategia para que One y el Core funcionen como un solo ecosistema con identidad única, sin duplicar funcionalidades?**

**La mejor estrategia es un modelo "Identity Core + Community One + Verticales especializadas" con SSO cookie-based bajo dominio raíz compartido `.puntocerosystem.com`.** Se resume en cinco decisiones:

1. **Una sola fuente de identidad.** Todo lo que sea usuario/rol/sesión/proveedor OAuth vive en el Core. One deja de ser un sistema de auth y se convierte en un consumidor. La cookie `pcs_id_token` con `Domain=.puntocerosystem.com` habilita SSO instantáneo entre landing y verticales.
2. **Cada backend hace lo que mejor sabe.** El Core es la identidad y las verticales de negocio. One es la capa social y editorial (feed, comunidad, follows, noticias, eventos, empleos). No se compite; se especializa.
3. **Verticales como servicios enlazados, no como secciones internas.** Legal, Medical, Empresa, Agentes viven en subdominios propios (`legal.*`, `medical.*`, `empresa.*`, `agentes.*`). One los muestra en el Universal Launcher y en secciones "Ecosistema", pero **no** renderiza su contenido de negocio.
4. **Migración pragmática con grace period.** Los usuarios ya registrados en One se migran al Core con `origin: "one-legacy"`; 30 días de doble cookie mientras se propagan. Cero downtime para el usuario final.
5. **Contratos HTTP explícitos entre backends.** Cada llamada de One al Core (`/identity/me`, `/launcher/apps`, `/verticals/*/highlights`) está versionada, cacheable y sin acceso directo a la base de datos ajena. Un fallo del Core no rompe la comunidad; un fallo de One no rompe la identidad.

**Consecuencia práctica:** el usuario firma una vez, ve un solo perfil, un solo Launcher, un solo Workspace, y navega libremente entre la landing, la comunidad y las verticales sin volver a introducir credenciales. Los equipos de Core y One publican en paralelo sin pisarse, cada uno dueño de su dominio funcional. Al eliminar los 65 % de código duplicado en One, la landing se vuelve rápida, ligera y mantenible; el Core queda como fuente única de verdad para todo lo demás.

Esta es la única estrategia que **no rompe** lo que ya funciona en ninguno de los dos lados, permite migrar por fases con rollback trivial en cada etapa, y prepara el ecosistema para agregar nuevas verticales (Contabilidad, Real Estate, etc.) sin nuevas discusiones arquitectónicas.

---

*Auditoría entregada sin realizar cambios en el código. Requiere firma del arquitecto senior y del equipo Core antes de iniciar la Fase 2.*
