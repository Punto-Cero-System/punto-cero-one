# CORE_FUSION_AUDIT.md
**Fecha:** 2026-08-07
**Auditor:** Arquitecto senior (auditoría estática, sin cambios en código)
**Contexto:** Este repo (Emergent) es la **landing pública** de Punto Cero System. Existe un **Core separado** (React + FastAPI + MongoDB + JWT) con Identity Universal, Punto Cero One, Universal Launcher, Workspaces y verticales (Legal, Medical, Empresa, Profesional, Agentes, Administración) que **no debe tocarse**.
**Alcance:** determinar el rol de este repo dentro del ecosistema, qué se reutiliza, qué se elimina, qué se conecta al Core.

---

## 1. AUDITORÍA ACTUAL

| # | Componente / archivo | Función real hoy | Reutilizable | Cambios necesarios |
|---|---|---|:---:|---|
| **Frontend público (landing)** | | | | |
| 1 | `pages/HomePage.jsx` + `WorkspaceContext` | Home "Mi Espacio" con feed + widgets + workspace editable | ⚠️ Parcial | Simplificar a **landing pública sin auth**; el Home real vive en Core One |
| 2 | `pages/JoinPage.jsx` | Registro + login (email/pwd, Google, LinkedIn, Facebook) | ⚠️ Parcial | Redirigir a **Login Universal del Core** (SSO), no procesar credenciales aquí |
| 3 | `pages/ProfilePage.jsx`, `PublicProfilePage.jsx` | Edición y vista pública de perfil | ⚠️ Parcial | Vista pública OK; edición debe delegar al **Identity Core** |
| 4 | `pages/InvestorRoomPreview.jsx`, `CapitalHubPage.jsx`, `CapitalStrategyPage.jsx`, `ExecutiveSummaryPage.jsx`, `InvestorPitchDeckPage.jsx`, `InvestorSetupPage.jsx`, `InvestorRequestPage.jsx` | Sección Capital / Inversores | ✅ Sí | Se mantienen tal cual como marketing de inversión |
| 5 | `pages/NuestraHistoriaPage.jsx`, `LegalPages.jsx` (privacidad/cookies/términos/acuerdo) | Contenido institucional | ✅ Sí | Sin cambios |
| 6 | `pages/CommunityPage.jsx`, `NewsPage.jsx`, `EventsPage.jsx`, `JobsPage.jsx`, `CompaniesPage.jsx`, `CompanyProfilePage.jsx`, `VideosPage.jsx`, `AiPage.jsx`, `MarketplacePage.jsx`, `HashtagPage.jsx` | Módulos de Punto Cero One replicados dentro del landing | ❌ No | **Eliminar del landing** — viven en Core One |
| 7 | `pages/MessagesPage.jsx`, `NotificationsPage.jsx` | Mensajería y notificaciones | ❌ No | Fuera del scope de una landing pública; viven en Core One |
| 8 | `pages/ProfileCustomizePage.jsx`, `MiEspacioConfigPage.jsx`, `AdminDocumentsPage.jsx`, `AdminLoginPage.jsx` | Configuración perfil, workspace y admin | ❌ No | Duplican Identity/Workspaces del Core |
| 9 | `pages/VerifyEmailPage.jsx`, `ResetPasswordPage.jsx` | Flujos de verificación de email y reset de password | ❌ No | Los emite y valida el Core |
| 10 | `components/Header.jsx` | Header con nav, search, notificaciones, avatar | ✅ Sí | Mantener; ajustar CTAs para redirigir al Core cuando el usuario tenga sesión |
| 11 | `components/Footer.jsx` | Footer | ✅ Sí | Sin cambios |
| 12 | `components/CustomCursor.jsx`, `SlideCarousel.jsx`, `LatinAmericaBlock.jsx`, `EcosystemSection.jsx`, `OrbitalEcosystem.jsx` | Piezas visuales de la landing | ✅ Sí | Ideales para storytelling de marca |
| 13 | `components/community/*` (IntelligentFeed, LiveFeed, FeedComposer, FeedPostCard, PreviewCard, NotificationsBell, LeftSidebar, RightWidgets, MobileBottomNav, WelcomeModal, LiveWidgets, FollowButton, cards/*, workspace/*) | Toda la maquinaria social de Punto Cero One | ❌ No | **Eliminar** — el Core ya tiene su propia versión canónica |
| 14 | `contexts/CommunityAuthContext.jsx` | Estado global de sesión (usuario, login, logout) | ⚠️ Parcial | Reemplazar por lector de sesión del Core (cookie/JWT compartido) |
| 15 | `contexts/AuthContext.jsx` | Auth JWT del admin | ❌ No | El Core tiene su propio admin |
| 16 | `contexts/WorkspaceContext.jsx`, `RealtimeContext.jsx` | Workspaces + SSE | ❌ No | Duplican Workspaces y Realtime del Core |
| 17 | `services/*` (feedService, profileService, followsService, workspacePresets, mockData, workspaceRegistry) | Clientes HTTP y datos mock | ❌ No | Todos pertenecen al Core |
| 18 | `hooks/useCommunityStats.js` | Hook stats | ⚠️ Parcial | Si la landing muestra contadores globales, apuntar al endpoint público del Core |
| **Backend (FastAPI)** | | | | |
| 19 | `backend/routes/community_auth_routes.py` + `services/community_auth.py` | Login email/pwd + OAuth (Google/LinkedIn/Facebook) | ❌ No | **Eliminar del landing** — vive en Core |
| 20 | `backend/routes/auth_routes.py` + `auth.py` | Auth JWT admin | ❌ No | Vive en Core |
| 21 | `backend/routes/feed_routes.py`, `content_sources_routes.py`, `groups_routes.py`, `follows_routes.py`, `notification_routes.py`, `messaging_routes.py`, `realtime_routes.py`, `profile_routes.py`, `profile_media_routes.py`, `workspace_routes.py`, `widget_routes.py`, `discovery_routes.py`, `company_routes.py`, `company_media_routes.py`, `event_routes.py`, `job_routes.py`, `document_routes.py`, `search_routes.py`, `analytics_routes.py`, `admin_platform_routes.py`, `growth_routes.py`, `sources_admin_routes.py`, `category_routes.py`, `investor_routes.py`, `pitch_deck_routes.py`, `email_routes.py` | Toda la lógica social + admin + workflows | ❌ No | Duplican el Core; **eliminar** o dejar únicamente en modo legacy read-only si aporta contenido a la landing |
| 22 | `backend/routes/seo_routes.py` (robots.txt, sitemap.xml) | SEO técnico | ✅ Sí | Mantener; landing sí necesita sus propios SEO endpoints |
| 23 | `backend/routes/community_stats_routes.py` | Contadores públicos de plataforma | ✅ Sí (o consumir del Core) | Landing puede necesitar `total_members`, `total_posts` para storytelling |
| 24 | `backend/services/object_storage.py` | Storage local | ❌ No | El Core gestiona storage; landing sólo consume URLs |

### Métrica
- Total archivos backend: **28 routes + ~15 services**. Sólo `seo_routes.py` y `community_stats_routes.py` sobreviven claramente.
- Total archivos frontend: **~40 páginas + ~80 componentes**. **~65 %** son duplicados del Core; **~35 %** son landing legítima (marketing, capital, legal, historia, ecosistema visual).

---

## 2. FLUJO DE USUARIO ACTUAL

### 2.1. Recorrido completo (hoy, en este repo)

```
1. Visitante llega a puntocerosystem.com
     └─→ HomePage.jsx renderiza feed + workspace + widgets (¡pesado!)
2. Click "Únete" en el header
     └─→ /join
3. JoinPage muestra 4 opciones:
     • Email + password → POST /api/community/auth/register  → cookie session_token
     • Google OIDC     → /api/community/auth/oauth/google/callback
     • LinkedIn OIDC   → /api/community/auth/oauth/linkedin/callback
     • Facebook OAuth  → /api/community/auth/oauth/facebook/callback
4. Éxito → armWelcome(user_id) en localStorage
5. Redirect a "/"
     └─→ WelcomeModal se dispara → confetti + CTA
6. Usuario navega Mi Espacio, feed, comunidad, perfil…
     └─→ todo servido por este mismo backend, sin llamar al Core
```

### 2.2. Puntos fuertes

- Flujo de registro/login **funcional y probado** (30/30 tests verdes).
- OAuth con 3 proveedores + email/password, con brute-force protection y verificación de email.
- Sesión persistente por cookie httponly.
- UX pulida (WelcomeModal, feed social-first, imágenes con lazy loading, "Ver más").

### 2.3. Limitaciones

- El landing **hace demasiado**: es a la vez marketing y aplicación completa.
- **Todos los datos (usuarios, posts, follows, notificaciones, mensajes) viven en esta Mongo**, no en la del Core → **fragmentación de identidad**.
- Un usuario registrado aquí **no existe en el Core**. Y viceversa.
- Verticales (Legal, Medical, Empresa, Agentes, Administración) **no existen** en el landing.
- Universal Launcher, Workspaces del Core, Firm OS → nada de esto está conectado.

### 2.4. Duplicidades detectadas

| Concepto | En este repo (Emergent) | En el Core (JWT/FastAPI) |
|---|---|---|
| Colección `users` | ✅ propia | ✅ propia (canonical) |
| Login email/pwd | ✅ `community_auth_routes` | ✅ (canonical) |
| OAuth providers | ✅ Google/LinkedIn/Facebook | ✅ (canonical) |
| Feed / posts | ✅ `feed_routes` | ✅ Punto Cero One |
| Follows / grafo social | ✅ `follows_routes` | ✅ Core |
| Notificaciones | ✅ `notification_routes` | ✅ Core |
| Mensajería | ✅ `messaging_routes` | ✅ Core |
| Workspaces | ✅ `workspace_routes` | ✅ Core Workspaces |
| Object storage | ✅ propio | ✅ Core |
| Admin | ✅ `admin_platform_routes` | ✅ Core Administración |

**Consecuencia:** el usuario final vive en dos universos paralelos con datos incompatibles. La landing debe volverse un **cliente** del Core, no un sistema alternativo.

---

## 3. COMPARACIÓN CON ARQUITECTURA OBJETIVO

**Arquitectura objetivo:**
```
Landing → Login Universal → Identity Core → Punto Cero One → Universal Launcher → Verticales (Legal, Medical, Empresa, Agentes, …)
```

| Nodo | En este repo | En el Core | Acción |
|---|---|---|---|
| Landing pública | ✅ completo (Home, Nuestra Historia, Capital, Ecosistema, Legal-compliance, Executive Summary, Pitch Deck, Investor Room) | — | **Mantener y potenciar** |
| Login Universal | ⚠️ implementado pero **aislado** | ✅ canonical (JWT + MongoDB) | **Eliminar aquí, delegar al Core**. La landing sólo abre un modal / redirige a Core-login |
| Identity Core | ❌ no existe (hay copia local) | ✅ canonical | **Conectar por API**. La landing lee `/api/identity/me` del Core con el token |
| Punto Cero One | ⚠️ hay copia funcional aquí | ✅ canonical | **Eliminar copia; enlazar al Core**. Botón "Entrar a Mi Espacio" redirige a `one.puntocerosystem.com` (o path del Core) |
| Universal Launcher | ❌ no existe | ✅ canonical | Añadir un componente simple en la landing que muestre el launcher del Core tras login (o redirigir) |
| Vertical **Legal** | ❌ no existe (solo /legal/*compliance) | ✅ canonical | **Conectar**. Botón en Ecosistema redirige a `legal.puntocerosystem.com` |
| Vertical **Medical** | ❌ no existe (solo marketing) | ✅ canonical (medical.puntocerosystem.com) | **Conectar** vía Universal Launcher |
| Vertical **Empresa** | ⚠️ hay `CompaniesPage`/`CompanyProfilePage` locales | ✅ canonical | Eliminar local; enlazar al Core |
| Vertical **Profesional** | ⚠️ hay `ProfilePage` local | ✅ canonical | Vista pública puede quedarse como preview SEO; edición al Core |
| Vertical **Agentes (IA)** | ⚠️ hay `AiPage` local | ✅ canonical | Eliminar local; enlazar al Core |
| Vertical **Administración** | ⚠️ hay `AdminLoginPage`, `AdminDocumentsPage` locales | ✅ canonical | Eliminar local; enlazar al Core |

### Resumen

- **Ya existe:** landing visual (marketing + storytelling + capital + legal-compliance) + un backend de auth completo pero redundante.
- **Falta:** conectividad. La landing hoy es un producto autónomo; debe convertirse en fachada del Core.
- **Conectar:** login → Core, launcher → Core, CTAs de verticales → subdominios del Core.
- **Eliminar:** todas las páginas y endpoints que duplican el Core (feed, mensajería, notificaciones, follows, workspace, admin, media, etc.).

---

## 4. AUDITORÍA DE AUTH

### 4.1. Estado hoy

**Sí, la landing tiene auth propia.** Con detalles:

| Aspecto | Detalle |
|---|---|
| Base de usuarios | Colección Mongo `users` local a este repo |
| Métodos | Email + password (bcrypt), Google OIDC, LinkedIn OIDC, Facebook OAuth |
| Sesión | Cookie `session_token` httponly + colección `user_sessions` |
| JWT | Existe en `auth_routes.py` pero **sólo se usa para el admin** (`/admin/login`) |
| Roles | `member` · `admin` · `investor` (colección `users.role`) |
| Verticales | Campo `verticals: list[str]` (freetext), sin enum |
| Rate limiting | `login_attempts` con ventana de 15 min y 5 intentos |
| Verificación email | Colección `email_verifications` + endpoint dedicado |
| Reset password | Colección `password_reset_tokens` con TTL |
| Invitaciones | Colección `invite_redemptions` |

### 4.2. Veredicto

**Debe convertirse en capa visual únicamente.** Razones:

1. La identidad canonical vive en el Core (JWT + MongoDB dedicada). Mantener otra crea inconsistencias imposibles de reconciliar.
2. Los subdominios de las verticales ya consumen sesión del Core; una segunda base de identidades **impide SSO real**.
3. Mantener OAuth aquí implica registrar dos veces cada Redirect URI en Google/LinkedIn/Facebook — riesgo operativo permanente.

### 4.3. Modelo recomendado

- **Frontend landing:** un componente `<CoreAuthGate>` lee un cookie `pcs_id_token` (emitido por el Core con `Domain=.puntocerosystem.com`) y llama al endpoint público del Core `GET /api/identity/me` (o el nombre que use el Core) para hidratar el usuario.
- **Backend landing:** casi todo el bloque `community_auth_routes.py`, `auth_routes.py`, `follows_routes.py`, `feed_routes.py`, `messaging_routes.py`, `notification_routes.py`, `profile_routes.py`, `workspace_routes.py`, `discovery_routes.py`, `admin_platform_routes.py`, `analytics_routes.py`, `email_routes.py`, `groups_routes.py`, `growth_routes.py`, `sources_admin_routes.py`, `investor_routes.py`, `pitch_deck_routes.py`, `event_routes.py`, `job_routes.py`, `company_routes.py`, `document_routes.py`, `search_routes.py` **desaparece o queda como proxy read-only al Core**.
- **JWT propio:** eliminarlo. Sólo se acepta el JWT emitido por Identity Core.
- **Sesión propia:** eliminarla. Sólo la cookie `pcs_id_token` del Core.
- **Botón "Entrar":** redirige a `https://identity.puntocerosystem.com/login?redirect=https://puntocerosystem.com/` (o URL equivalente del Core).

### 4.4. ¿Y los datos existentes?

Los usuarios que se hayan registrado en este landing tienen su cuenta **sólo aquí**. Antes de eliminar el auth local:

1. **Exportar** `users`, `posts`, `follows`, `notifications`, `messages` de esta Mongo.
2. **Migrar** al Core con conciliación por email (marca `origin: "emergent-landing"` para trazabilidad).
3. **Redirigir** el intento de login antiguo hacia el Core con mensaje explicativo.
4. **Congelar** este backend en modo lectura durante la ventana de migración.

---

## 5. PROPUESTA DE FUSIÓN

### 5.1. Capas

```
┌──────────────────────────────────────────────────────────────┐
│  CAPA 1 · Emergent Landing (este repo)                       │
│  · Marketing / storytelling / Capital / Legal-compliance     │
│  · SEO, Open Graph, sitemaps                                 │
│  · Hero + "Únete" → CTA de login al Core                    │
│  · Cero datos privados. Cero auth. Cero base de usuarios.    │
└──────────────────────────────────────────────────────────────┘
                              │  HTTP (público)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  CAPA 2 · Gateway / Ingress                                  │
│  · TLS terminación (wildcard *.puntocerosystem.com)          │
│  · Rate limit por IP                                         │
│  · CORS con whitelist de dominios propios                   │
│  · Ruteo por hostname:                                       │
│     puntocerosystem.com          → landing (este repo)       │
│     identity.puntocerosystem.com → Core Identity             │
│     one.puntocerosystem.com      → Core Punto Cero One       │
│     legal.puntocerosystem.com    → Core Legal                │
│     medical.puntocerosystem.com  → Core Medical              │
│     empresa.puntocerosystem.com  → Core Empresa              │
│     agentes.puntocerosystem.com  → Core Agentes              │
│     admin.puntocerosystem.com    → Core Administración       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  CAPA 3 · Identity Core (JWT/FastAPI/Mongo)                  │
│  · Login universal · OAuth · sesiones · roles                │
│  · Emite cookie pcs_id_token (Domain=.puntocerosystem.com)   │
│  · Endpoint público /api/identity/me                        │
└──────────────────────────────────────────────────────────────┘
                              │  cookie SSO
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  CAPA 4 · Punto Cero One (Core)                              │
│  · Feed, comunidad, mensajería, notificaciones               │
│  · Perfil profesional                                         │
│  · Consume Identity Core                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  CAPA 5 · Workspaces (Core)                                  │
│  · Layout y widgets por usuario                              │
│  · Cross-vertical                                             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  CAPA 6 · Universal Launcher (Core)                          │
│  · Menú global de apps para el usuario logado                │
│  · Lanza a la vertical adecuada según profession_key         │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌────────┬────────┬───┴────┬────────┬────────┐
        ▼        ▼        ▼        ▼        ▼        ▼
┌────────────┐┌───────┐┌───────┐┌───────┐┌───────┐┌──────────────┐
│CAPA 7      ││Medical││Empresa││Profe- ││Agentes││Administración│
│Legal (Firm ││       ││       ││sional ││(IA)   ││              │
│OS)         ││       ││       ││       ││       ││              │
└────────────┘└───────┘└───────┘└───────┘└───────┘└──────────────┘
```

### 5.2. Qué queda en cada capa

- **Capa 1 (Emergent):** SÓLO React estático + un backend mínimo con `seo_routes.py` + `community_stats_routes.py` (llamando al Core para agregar cifras). Sin base de datos propia, o con una Mongo mínima solo para leads de marketing.
- **Capa 2 (Gateway):** Ingress Kubernetes / Cloudflare / equivalente Emergent. Sin lógica de negocio.
- **Capa 3 (Identity Core):** propietario del token, del ciclo de vida de la sesión y de los proveedores OAuth. Punto único de verdad para "¿quién es el usuario?".
- **Capa 4 (One):** propietario del feed social, mensajería, notificaciones, follows, grupos.
- **Capa 5 (Workspaces):** propietario del layout de widgets por usuario. Puede exportar un widget "landing preview" para embed.
- **Capa 6 (Launcher):** propietario del catálogo de apps y del enrutado post-login. La landing muestra un botón "Abrir mi Launcher" que apunta al Core.
- **Capa 7 (Verticales):** cada uno gestiona su dominio de negocio, consume Identity + Launcher, publica CTAs propios.

### 5.3. Contratos entre capas

Todas las comunicaciones entre capas son **HTTP JSON con cookie SSO**. Endpoints públicos mínimos que el Core debe exponer al landing:

| Endpoint | Uso |
|---|---|
| `GET /api/identity/me` | Hidratar sesión en la landing |
| `GET /api/identity/whoami` (público) | Sin auth, retorna capacidades del ecosistema (proveedores OAuth disponibles) |
| `GET /api/stats/public` | Contadores agregados para storytelling (miembros, posts, empresas) |
| `POST /api/identity/logout` | Cerrar sesión desde la landing |
| `GET /api/launcher/apps` | Catálogo de verticales visibles al usuario, para el botón "Explorar mi ecosistema" |

Contratos secundarios (opcionales, si la landing muestra un preview real de contenido):

| Endpoint | Uso |
|---|---|
| `GET /api/feed/preview` | 3-5 posts destacados no personalizados (para landing anónima) |
| `GET /api/community/highlights` | Ejemplos de casos de éxito para storytelling |

---

## 6. ROADMAP POR FASES

### Fase 1 — Auditoría *(esta fase, sin código)*
- ✅ Documento actual generado.
- ✅ Inventario de componentes reutilizables vs. duplicados.
- ✅ Contratos preliminares con el Core.
- **Entregable:** este archivo + firma del arquitecto senior + confirmación con el equipo Core de los endpoints públicos requeridos.
- **Duración estimada:** 1-2 días.

### Fase 2 — Conectar Login Universal al Core
1. El Core expone `pcs_id_token` como cookie con `Domain=.puntocerosystem.com`.
2. Este repo reemplaza el flujo de `JoinPage.jsx` por un botón "Ingresar / Registrarme" que **redirige** a `https://identity.puntocerosystem.com/login?redirect_uri=...`.
3. `CommunityAuthContext.jsx` se reemplaza por `CoreIdentityContext.jsx` que lee `GET /api/identity/me` con la cookie SSO.
4. Se elimina `community_auth_routes.py`, `auth_routes.py`, `services/community_auth.py` **una vez validado** el nuevo flujo.
5. Regresión: verificar que la landing NO tenga endpoints `/api/community/auth/*` operativos tras Fase 2.
- **Entregable:** landing con SSO activo contra Core.
- **Duración estimada:** 1 semana.

### Fase 3 — Conectar Punto Cero One
1. Todos los CTAs de "Explorar comunidad", "Ver feed", "Publicar", etc. redirigen a `one.puntocerosystem.com`.
2. Se elimina/archiva el código local de feed (`IntelligentFeed`, `LiveFeed`, `FeedComposer`, `feed_routes.py`, etc.).
3. `HomePage.jsx` deja de ser Mi Espacio; pasa a ser una **landing conversional**: hero + storytelling + testimonios + preview de estadísticas + CTA principal "Ingresa a Mi Espacio".
4. Si la landing quiere mostrar un preview de posts, consume `GET /api/feed/preview` del Core.
- **Entregable:** landing sin duplicidad con One.
- **Duración estimada:** 1 semana.

### Fase 4 — Universal Launcher
1. Cuando el usuario está autenticado (`pcs_id_token` presente), la landing muestra un componente `<LauncherEntrypoint>` que llama a `GET /api/launcher/apps` del Core.
2. El launcher lista las verticales accesibles según `profession_key` del usuario y ofrece navegación directa.
3. Este componente NO renderiza contenido de las verticales — solo tarjetas de entrada.
- **Entregable:** header autenticado con menú de "Explorar mi ecosistema".
- **Duración estimada:** 3-4 días.

### Fase 5 — Verticales enlazadas
1. En `EcosystemSection.jsx` y `OrbitalEcosystem.jsx`, cada vertical se convierte en link real hacia su subdominio:
   - Legal → `https://legal.puntocerosystem.com/`
   - Medical → `https://medical.puntocerosystem.com/`
   - Empresa → `https://empresa.puntocerosystem.com/`
   - Agentes → `https://agentes.puntocerosystem.com/`
   - Administración → `https://admin.puntocerosystem.com/` (con gating)
2. Se elimina cualquier página local que finja ser una vertical (`AiPage`, `CompaniesPage`, `CompanyProfilePage`, `AdminLoginPage`, `AdminDocumentsPage`, `MessagesPage`, `NotificationsPage`, `CommunityPage`, `JobsPage`, `EventsPage`, `NewsPage`, `VideosPage`, `MarketplacePage`, `HashtagPage`, `ProfilePage`, `ProfileCustomizePage`, `MiEspacioConfigPage`).
- **Entregable:** ecosistema navegable con SSO end-to-end.
- **Duración estimada:** 1 semana.

### Fase 6 — Producción
1. Certificado wildcard `*.puntocerosystem.com` aprovisionado.
2. DNS records apuntando al ingress correcto por subdominio.
3. Migración de datos existentes de este landing al Core (usuarios, posts si aplica).
4. Redirect 301 permanente de las rutas eliminadas hacia el Core (`/comunidad → https://one.puntocerosystem.com/comunidad`, etc.).
5. Regresión completa vía `testing_agent`.
6. Anuncio público.
- **Entregable:** ecosistema en producción, tráfico redirigido, monitorización activa.
- **Duración estimada:** 1-2 semanas.

### Total estimado
**5-7 semanas** con un equipo dedicado + coordinación con el equipo Core.

---

## 7. Módulos NO tocar (recordatorio operativo)

Estos módulos son **canonical en el Core** y en ningún caso deben modificarse **desde este repo**. Cualquier bug o mejora debe reportarse al equipo Core:

- **Backend Core:** `Identity`, `Users`, `Roles`, `JWT`, `MongoDB` del Core.
- **Workspaces del Core.**
- **Vertical Legal (Firm OS).**
- **Vertical Medical.**
- **Vertical Empresa.**
- **Vertical Agentes.**
- **Vertical Administración.**

En este repo (Emergent) tampoco tocar hasta la Fase 2:
- Feed (`IntelligentFeed`, `FeedPostCard`, `FeedComposer`, `content_sources_routes`) — funcionando y con 30/30 tests verdes.
- Object storage (`profile_media_routes` con whitelist `users/`, `posts/`, `groups/`).
- Notificaciones (`notification_routes`, `NotificationsBell`).
- Mensajería (`messaging_routes`, `MessagesPage`).
- Tests de regresión (`test_editorial_composer.py`, `test_wave12_photo_fix.py`, `test_wave12_content_sources.py`, `test_iter34_feed_filter.py`).

Esos módulos se **eliminarán** cuando el Core esté conectado, no se modificarán durante la fusión.

---

*Auditoría completada sin realizar cambios en el código. Este documento debe firmarse por el arquitecto senior y consensuarse con el equipo Core antes de iniciar la Fase 2.*
