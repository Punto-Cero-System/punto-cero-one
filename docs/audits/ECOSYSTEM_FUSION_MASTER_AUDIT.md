# ECOSYSTEM_FUSION_MASTER_AUDIT.md
**Fecha:** 2026-08-08
**Tipo:** Auditoría estática de solo lectura — **sin cambios en código, auth, JWT, MongoDB, OAuth, tests, workspaces ni deploy**
**Alcance:** Consolidar en UN SOLO documento el inventario del Proyecto B (este repo, Emergent), las duplicidades con el Proyecto A (Core en VS Code), el flujo de usuario completo, el análisis del login social, el header global por rol, la arquitectura definitiva y el roadmap real de fusión.
**Este documento reemplaza/consolida:** `CORE_FUSION_AUDIT.md` y `ONE_CORE_FUSION_AUDIT.md` (mantienen valor histórico; en caso de conflicto, manda este).

---

## 0. Definición de los dos proyectos

| | **Proyecto A — Core** (canónico, VS Code) | **Proyecto B — Este repo** (Emergent) |
|---|---|---|
| Contenido | Identity Core, JWT, Auth, MongoDB, Universal Launcher, Workspaces (Professional, Firm, Medical, Legal), Admin, Agents, Darwin IA, Billing, Vertical Registry | Landing, comunidad, feed, noticias, networking, perfiles, empleos, login social (Google, Facebook, LinkedIn), mensajería, notificaciones, object storage |
| Rol en el ecosistema | **Cerebro:** identidad única, verticales de negocio, facturación | **Rostro y plaza pública:** adquisición, contenido, comunidad |
| Estado | Externo a este entorno (no accesible desde aquí) | En producción (`puntoceromultiservicios.com`) + preview Emergent |

---

## 1. INVENTARIO COMPLETO DEL PROYECTO B (este proyecto)

### 1.1. Autenticación — coexisten TRES mecanismos

| # | Mecanismo | Archivos | Token | Almacén | Uso real |
|---|---|---|---|---|---|
| 1 | **Admin JWT legacy** | `backend/auth.py`, `backend/routes/auth_routes.py`, `frontend/src/contexts/AuthContext.jsx` | JWT HS256 (`JWT_SECRET`), TTL 8h, `Authorization: Bearer` | `localStorage["pcs_admin_token"]` | Solo panel `/admin/*` y portal de inversores |
| 2 | **Comunidad — cookie de sesión** | `backend/routes/community_auth_routes.py`, `backend/services/community_auth.py`, `frontend/src/contexts/CommunityAuthContext.jsx` | Token opaco `cs_<hex>` en cookie `session_token` (httpOnly, Secure, SameSite=None, TTL 7 días) | Colección `user_sessions` | Todo el flujo social: registro, login, feed, perfil |
| 3 | **OAuth social** (dentro del mecanismo 2) | `services/community_auth.py` (registry de providers) | El provider emite `code`/`session_id`; One lo canjea y crea sesión propia | `oauth_states` (state anti-CSRF, TTL 10 min) | Google, LinkedIn, Facebook (+ Microsoft y GitHub cableados pero ocultos) |

**Detalle de providers OAuth registrados** (`ProviderRegistry`):
- **Google**: vía relay gestionado de Emergent (`EMERGENT_AUTH_URL` / `EMERGENT_AUTH_SESSION_URL`) — sin client secret propio. Flujo: redirect → `#session_id=...` → `POST /api/community/auth/session`.
- **LinkedIn**: OIDC (`openid profile email`), envs `LINKEDIN_CLIENT_ID/SECRET`, callback `/api/community/auth/oauth/linkedin/callback`. ✅ Configurado (envs presentes); pendiente whitelisting de URL de producción en el dashboard de LinkedIn (acción del usuario).
- **Facebook**: OAuth v18 (`email public_profile`), envs `FACEBOOK_APP_ID/SECRET`. ✅ Configurado; igual pendiente de URLs en dashboard de Meta.
- **Microsoft / GitHub**: clases implementadas pero sin envs y ocultos del listado al cliente (`_v1_visible = {"linkedin", "facebook"}`).
- **Email + password**: bcrypt, min 8 chars, lockout brute-force (5 intentos → 15 min por ip+email, colección `login_attempts`), verificación de email (`email_verifications`, TTL 24h), reset de password (`password_reset_tokens`, TTL 60 min), invitaciones virales (`invite_redemptions`, código derivado determinista del user id).

**Endpoints de auth activos:**
`/api/community/auth/providers` · `/session` · `/me` · `/logout` · `/me/region` · `/register` · `/login` · `/password/forgot` · `/password/reset` · `/verify/send` · `/verify/confirm` · `/oauth/{provider}/start` · `/oauth/{provider}/callback` · `/me/invite` — más el legacy `/api/auth/login` · `/me` · `/logout` (JWT admin).

### 1.2. Perfiles — campos del usuario

La colección **`users` es la única fuente de verdad** (no hay colección de perfiles separada). Documento completo posible:

- **Identidad:** `id`, `email` (único, lowercase), `name`, `picture`, `cover_url`, `role` (`member`|`admin`|`investor`), `headline`, `bio`
- **Región:** `country`, `city`, `country_source` (`manual`|`auto`), `language`, `languages[]`
- **Profesional:** `current_company`, `current_title`, `skills[]`, `specialties[]`, `interests[]`, `verticals[]`, `experience[]` (company/title/start/end/description), `certifications[]` (name/issuer/year/url), `portfolio_url`, `social{website,linkedin,twitter,github,instagram,youtube,facebook}`
- **Auth:** `auth_providers[]` ({provider, provider_user_id, linked_at}), `password_hash` (bcrypt, nunca expuesto), `email_verified`, `email_verified_at`, `invitation_token` (solo inversores)
- **Personalización UI:** `ui_preferences{theme, primary_color, secondary_color, accent_color, button_color, gradient, background_url}`
- **Contadores:** `posts_count`, `followers_count`, `following_count`
- **Meta:** `created_at`, `updated_at`, `last_login_at`

Modelos Pydantic: `models_profile.py` (`ProfileUpdate`, `ProfilePublic`, `ProfileExperience`, `ProfileCertification`, `ProfileSocialLinks`, `UIPreferences`). Endpoints: `GET/PATCH /api/profiles/me`, `GET /api/profiles/{user_id}` (público), más subida de foto/portada en `profile_media_routes.py`.

**Distribución real de roles (Mongo, hoy):** `member`: 802 · `investor`: 2 · `admin`: 1. **No existe rol `professional` ni `company` a nivel usuario** — la pertenencia a empresa se modela en `companies.owner_id` + `companies.team[]` con roles `owner`/`member` (computado como `my_role` en cada respuesta).

### 1.3. Campos generados por el registro social (alta vía OAuth)

Cuando un usuario entra por primera vez con Google/LinkedIn/Facebook, `_upsert_user_from_identity()` crea **exactamente** este documento:

```json
{
  "id": "user_<hex12>",
  "email": "<email del provider, lowercase>",
  "name": "<nombre del provider | parte local del email>",
  "role": "member",
  "picture": "<avatar del provider | null>",
  "country": null,
  "language": null,
  "headline": null,
  "auth_providers": [{"provider": "google|linkedin|facebook", "provider_user_id": "<sub/id>", "linked_at": "<iso>"}],
  "email_verified": true,
  "email_verified_at": "<iso>",
  "created_at": "<iso>",
  "last_login_at": "<iso>"
}
```

Reglas de merge (idempotente): si el email ya existe, **no duplica** — añade el provider a `auth_providers[]` (si no estaba), refresca `name`/`picture` solo si estaban vacíos y actualiza `last_login_at`. El registro con email/password posterior sobre cuenta social **vincula** la contraseña a la misma cuenta (no crea otra). Efecto secundario: dispara email de bienvenida (soft-fail si el proveedor de email no está configurado).

⚠️ **Hallazgo de inconsistencia de IDs:** coexisten dos formatos de `users.id` — `user_<hex12>` (alta comunitaria) y `uuid4` (admin sembrado por `seed_admin`), y dos formatos de `session_token` — `cs_<hex>` (actual) y `sess_<timestamp>` (legacy, aún hay 1003 sesiones en Mongo). Relevante para la migración de identidad (§7, Fase 3).

### 1.4. Colecciones MongoDB (49) — inventario real con conteos

| Dominio | Colección | Docs | Propósito |
|---|---|---|---|
| **Identidad/Auth** | `users` | 805 | Usuarios (miembros, admin, inversores) |
| | `user_sessions` | 1003 | Sesiones cookie (`session_token`, `user_id`, `provider`, `expires_at`) |
| | `oauth_states` | 12 | States anti-CSRF de OAuth (TTL 10 min) |
| | `login_attempts` | 59 | Contadores brute-force |
| | `password_reset_tokens` | 0 | Reset de contraseña (TTL index) |
| | `email_verifications` | 0 | Verificación de email (TTL index) |
| | `invite_redemptions` | 7 | Invitaciones virales cobradas |
| **Comunidad/Social** | `posts` | 267 | Publicaciones del feed |
| | `post_comments` | 2 | Comentarios |
| | `post_reactions` | 3 | Reacciones |
| | `post_saves` | 1 | Guardados |
| | `post_shares` | 6 | Compartidos |
| | `post_reports` | 4 | Reportes de moderación |
| | `post_views` | 3403 | Vistas (dedupe por sesión) |
| | `follows` | 53 | Grafo social unificado (user/company/group) |
| | `hashtags` | 14 | Taxonomía de hashtags |
| | `groups` | 44 | Grupos/comunidades |
| | `group_members` | 76 | Membresías de grupos |
| | `group_posts` | 22 | Posts dentro de grupos |
| **Contenido/Editorial** | `growth_items` | 11107 | Items ingeridos (noticias regionales) |
| | `growth_runs` | 43 | Ejecuciones del scheduler de ingesta |
| | `growth_sources` | 0 | Fuentes del growth engine |
| | `growth_status` | 1 | Estado del scheduler |
| | `sources` | 111 | Fuentes curadas (Sources Center) |
| | `source_syncs` | 3836 | Historial de sincronización |
| | `categories` | 19 | Taxonomía de categorías/verticales de contenido |
| **Business** | `companies` | 49 | Empresas (incluye seeds públicos de discovery) |
| | `company_follows` | 46 | Follows a empresas (legacy, coexiste con `follows`) |
| | `jobs` | 43 | Ofertas de empleo |
| | `job_applications` | 1 | Postulaciones |
| | `job_saves` | 0 | Empleos guardados |
| | `events` | 1 | Eventos |
| | `event_rsvps` | 2 | Confirmaciones de asistencia |
| **Mensajería/Notif.** | `conversations` | 0 | ⚠️ Construido pero sin uso real |
| | `chat_messages` | 0 | ⚠️ Ídem |
| | `notifications` | 188 | Notificaciones in-app |
| | `notification_preferences` | 0 | Preferencias por usuario |
| **Admin/Inversores** | `investor_requests` | 6 | Solicitudes de acceso de inversores |
| | `investor_access_log` | 12 | Log de accesos al portal |
| | `pitch_deck_events` | 75 | Tracking del pitch deck |
| | `pitch_deck_downloads` | 31 | Descargas |
| | `documents` | 12 | Documentos legales (fuente de verdad de archivos) |
| | `document_signed_links` | 0 | Links firmados temporales |
| **Espacios personales** | `user_workspaces` | 1 | Layout "Mi Espacio" por usuario |
| | `widget_cache` | 0 | Caché de widgets externos (TTL) |
| **Analytics/Sistema** | `analytics_events` | 259 | Eventos |
| | `analytics_counters` | 85 | Contadores diarios |
| | `github_repos` | 1359 | Datos de widgets GitHub |

### 1.5. Sesiones

- **Emisión:** tras login social, OAuth callback, email/password, verificación de email o reset — siempre `_issue_session_cookie()` → doc en `user_sessions` + cookie httpOnly.
- **Validación:** cada request autenticado lee cookie `session_token` (o `Bearer` como fallback) → busca en `user_sessions` → verifica `expires_at` → carga `users` sin `password_hash`.
- **TTL:** `COMMUNITY_SESSION_TTL_DAYS` (7 por defecto). No hay refresh token ni revocación masiva (logout borra solo la sesión actual).
- **Índices:** `session_token` único, `user_id`, `expires_at`. ⚠️ No hay TTL index en `user_sessions` — las sesiones expiradas no se purgan solas (1003 acumuladas).
- **Compatibilidad SSO futura:** el diseño cookie-based con `SameSite=None; Secure` ya es compatible con un cambio a `Domain=.puntocerosystem.com`; el backend valida token opaco, por lo que puede sustituirse la validación local por una llamada al Core sin tocar al cliente.

### 1.6. Espacios personales — "Mi Espacio"

- Colección `user_workspaces` (índice único por `user_id`): `{panels: {left[], center[], right[]}, widgets: {wid: {enabled, collapsed, size}}, theme, layout_version}`.
- Endpoints: `GET/PUT/PATCH /api/workspace/me`, `POST /api/workspace/me/reset`.
- El **catálogo de widgets vive en el frontend** (`workspaceRegistry.jsx`); el backend solo persiste preferencias (desacoplado, sin migraciones al añadir widgets).
- Default actual (post-optimización): 3 widgets izquierda (profile-card, activity, quick-links), 3 centro (welcome-band, feed, inline-stats), 3 derecha (rss-news, events, suggested-people).
- Frontend asociado: `HomePage.jsx`, `WorkspaceContext.jsx`, `MiEspacioConfigPage.jsx`, `workspacePresets.js`, `widgetsService.js`.
- ⚠️ **Solapa conceptualmente con los Workspaces del Core** (Professional/Firm/Medical/Legal): el de One es un dashboard de widgets de comunidad; los del Core son espacios de trabajo por vertical. Son cosas distintas con el mismo nombre — riesgo de confusión que la fusión debe resolver (ver §2, módulo 10).

### 1.7. Mapa funcional del frontend

- **Landing/marketing:** `HeroSection`, `ManifestoSection`, `EcosystemSection`, `OrbitalEcosystem`, `LatinAmericaSection`, `FoundersSection`, `PressSection`, `NuestraHistoriaPage`, `LegalPages`, `CapitalHubPage`, `ExecutiveSummaryPage`, `InvestorPitchDeckPage`, `InvestorRoomPreview`, etc.
- **App autenticada:** `HomePage` (Mi Espacio), `CommunityPage`, `NewsPage`, `VideosPage`, `JobsPage`, `CompaniesPage`, `CompanyProfilePage`, `EventsPage`, `AiPage`, `MarketplacePage`, `HashtagPage`, `ProfilePage`, `PublicProfilePage`, `ProfileCustomizePage`, `MessagesPage`, `NotificationsPage`, `JoinPage`, `ResetPasswordPage`, `VerifyEmailPage`.
- **Admin/inversores:** `AdminLoginPage`, `AdminDashboardPage`, `AdminDocumentsPage`, `AdminPlatformPage`, `AdminSourcesTab`, `InvestorPortalPage`, `InvestorSetupPage`, `InvestorRequestPage` (guardas: `ProtectedAdminRoute` JWT, `ProtectedInvestorRoute`).
- **Contextos:** `CommunityAuthContext` (cookie, comunidad) y `AuthContext` (JWT, admin) — **dos contextos de auth paralelos en el mismo frontend**.

---

## 2. DUPLICIDADES A vs B — módulo por módulo

**Leyenda de acción:** **Reutilizar** (se queda donde está y el otro lo consume) · **Migrar** (mover datos/función al canónico) · **Eliminar** (retirar del no canónico) · **Sincronizar** (mantener en ambos con flujo de datos definido).

| # | Módulo | A (Core) | B (One) | Canónico | Acción | Detalle |
|---|---|:---:|:---:|:---:|---|---|
| 1 | Identidad de usuario (`users`) | ✅ | ✅ (805 docs) | **Core** | **Migrar + Eliminar** | Exportar users de B → Core (`origin:"one-legacy"`), conciliar por email, congelar y eliminar en B |
| 2 | Auth email/password (bcrypt) | ✅ | ✅ | **Core** | **Eliminar** en B | B deja de emitir credenciales |
| 3 | OAuth Google | ✅ | ✅ (relay Emergent) | **Core** | **Eliminar** en B | Redirect URIs de subdominios se registran en el Core |
| 4 | OAuth LinkedIn | ✅ | ✅ | **Core** | **Eliminar** en B | Ídem |
| 5 | OAuth Facebook | ✅ | ✅ | **Core** | **Eliminar** en B | Ídem |
| 6 | Sesiones (`user_sessions` + cookie) | ✅ JWT | ✅ cookie opaca | **Core** | **Eliminar** en B | B pasa a **leer** la cookie/JWT del Core (SSO `Domain=.puntocerosystem.com`) |
| 7 | Roles | ✅ | ✅ (`member/admin/investor`) | **Core** | **Migrar + Sincronizar** | Core amplía enum (professional, firm, medical, legal, admin…); B consume rol vía `/me` |
| 8 | Reset password / verify email / invitaciones | ✅ | ✅ | **Core** | **Eliminar** en B | Un solo flujo confiable |
| 9 | Universal Launcher | ✅ | ❌ | **Core** | **Reutilizar** | B consume `GET /api/launcher/apps` y lo renderiza en el header |
| 10 | Workspaces | ✅ (por vertical) | ✅ (`user_workspaces`, widgets comunidad) | **Core** | **Migrar** layouts + **Renombrar** | Son conceptos distintos: "Mi Espacio" de B = dashboard social; Workspaces del Core = espacio por vertical. Decidir: Mi Espacio se vuelve un "workspace tipo comunidad" del Core |
| 11 | Perfil profesional (edición) | ✅ | ✅ | **Core** | **Eliminar** editor en B | Redirigir a `identity.*/perfil`; B conserva vista pública SEO |
| 12 | Perfil público (`/u/:id`) | ✅ | ✅ | **Core** | **Sincronizar** | B embebe preview SEO consumiendo API del Core |
| 13 | Vertical Legal (Firm) | ✅ | ❌ (solo páginas legales de compliance) | **Core** | **Reutilizar** | B enlaza a `legal.*` (no confundir con `/legal/privacidad` etc., que son páginas de marketing y se quedan) |
| 14 | Vertical Medical | ✅ | ❌ | **Core** | **Reutilizar** | Enlace vía Launcher/subdominio |
| 15 | Empresas | ✅ | ✅ (`companies`, 49 docs) | **Core** | **Migrar + Eliminar** | Mover empresas reales al Core; B puede conservar vitrina pública read-only vía API |
| 16 | Vertical Professional | ✅ | ⚠️ (perfil ampliado) | **Core** | **Migrar** | La edición profesional vive en Core |
| 17 | Agents / Darwin IA | ✅ | ⚠️ (`AiPage` marketing + widget) | **Core** | **Reutilizar** | B enlaza; si necesita IA (recomendaciones de feed), consume la API de Darwin |
| 18 | Billing (Stripe) | ✅ | ❌ | **Core** | **Reutilizar** | B nunca procesa pagos; muestra estados de plan leídos del Core |
| 19 | Vertical Registry | ✅ | ⚠️ (`categories` de contenido) | **Core** | **Sincronizar** | Las `categories` de B (taxonomía editorial, 19) NO son el Vertical Registry; mapear `vertical` de contenido contra el Registry del Core |
| 20 | Admin | ✅ | ✅ (`/admin/*`, `admin_platform_routes`) | **Core** | **Eliminar** en B | Admin unificado en Core |
| 21 | **Comunidad + Feed social** | ⚠️ consumidor | ✅ maduro | **B (One)** ★ | **Reutilizar** | Único dominio donde B es superior; el Core lo consume o lo enlaza |
| 22 | **Grupos** | ⚠️ | ✅ | **B** ★ | **Reutilizar** | Extender con campo `vertical` para segmentar |
| 23 | **Feed regional / content sources / growth engine** | ❌ | ✅ | **B** ★ | **Reutilizar** | Motor editorial de la landing; el Core puede leerlo vía API |
| 24 | **Noticias, Eventos, Empleos, Videos, Marketplace** | ⚠️ | ✅ | **B** ★ | **Reutilizar** | Contenido público; empleos/eventos de empresas se sincronizan con el Core cuando las empresas migren |
| 25 | Mensajería 1:1 | ⚠️ | ✅ (sin uso: 0 conversaciones) | **Pendiente** | **Decidir** | B la tiene construida pero vacía; si el Core tiene una nativa, se migra; si no, B la aporta. No duplicar |
| 26 | Notificaciones | ⚠️ | ✅ (188 docs) | **B → eventos del Core** | **Sincronizar** | B mantiene el centro de notificaciones; el Core publica eventos (`identity.registered`, `subscription.activated`) que B suscribe |
| 27 | Realtime (SSE) | ⚠️ | ✅ | **B** (por ahora) | **Reutilizar + alinear** | Un solo canal SSE por usuario; fuente de eventos compartida a futuro |
| 28 | Object storage | ✅ | ✅ (local + Emergent) | **Core** | **Migrar** | Una sola política de retención; B consume URLs firmadas del Core |
| 29 | Follows / grafo social | ❌ | ✅ | **B** ★ | **Reutilizar** | Nace del feed; el Core lo consulta vía API si lo necesita |
| 30 | Search | ⚠️ | ✅ | **Pendiente** | **Sincronizar** | A futuro índice unificado en Core que incluya contenido de B |
| 31 | Analytics | ⚠️ | ✅ | **Pendiente** | **Sincronizar** | Un solo pipeline; B emite eventos al colector del Core |
| 32 | SEO (sitemap/robots) | — | ✅ | **B** | **Reutilizar** | La landing es SEO-first |
| 33 | Páginas institucionales/capital | — | ✅ | **B** | **Reutilizar** | Marketing e inversores se quedan en B |
| 34 | Email transaccional | ⚠️ | ⚠️ (soft-fail, `services/email.py`, `EMAIL_ENABLED`) | **Core** | **Migrar** | Bienvenida/verificación/reset los emite el Core (Resend ya planeado en B se traslada) |

★ = B es canónico. **Resumen: B aporta comunidad/feed/contenido/grafo social/SEO/marketing; el Core aporta identidad/auth/verticales/launcher/billing/admin/storage.**

---

## 3. FLUJO COMPLETO DEL USUARIO

### 3.1. Flujo ACTUAL (hoy, todo dentro de B)

```
Visitante → puntocerosystem.com (landing + Mi Espacio mezclados)
  → "Unirse" → /join
  → [Google relay | LinkedIn OAuth | Facebook OAuth | email+password]
  → POST /api/community/auth/session|register|login (o callback OAuth)
  → upsert en users (B) + cookie session_token
  → WelcomeModal (confetti) → Home (Mi Espacio)
  → Feed / Comunidad / Perfil / Empresas / Empleos... (todo en B)
  ✗ No hay Launcher, no hay verticales, no hay Core: callejón sin salida del ecosistema
  ✗ El usuario NO existe en el Core
```

### 3.2. Flujo OBJETIVO (post-fusión)

```
1. LANDING (B, público)
   Visitante llega a puntocerosystem.com → hero, ecosistema, feed público,
   noticias regionales, capital/inversores. Sin auth obligatoria.
        ↓ click "Únete / Entrar"
2. REGISTRO (Core, SSO)
   Redirect a identity.puntocerosystem.com/login?redirect=<origen>
   → Core crea/valida usuario canónico (email/pwd u OAuth Google/LinkedIn/Facebook)
   → Core emite cookie pcs_id_token (Domain=.puntocerosystem.com, HttpOnly, Secure)
   → Redirect de vuelta a B → WelcomeModal (disparado por primera sesión detectada)
        ↓
3. COMUNIDAD (B, autenticado por SSO)
   B lee pcs_id_token → GET Core /api/identity/me (cache 60 s) → hidrata usuario
   → Feed personalizado por país + profession_key + intereses
   → Publica, comenta, sigue, se une a grupos (datos en B, identidad del Core)
        ↓
4. PERFIL (Core como fuente, B como vitrina)
   "Completa tu perfil" → editor en identity.*/perfil (Core)
   Perfil público /u/:id en B → consume API del Core (SEO + preview social)
        ↓
5. LAUNCHER (Core, visible en B)
   Header de B incorpora Universal Launcher → GET Core /api/launcher/apps
   → Muestra: One (comunidad) ✓ + verticales habilitadas según rol/profession_key
        ↓
6. VERTICAL (Core, subdominios)
   Click "Legal" → legal.puntocerosystem.com → cookie SSO válida → sin re-login
   (Ídem Medical, Empresa, Agents/Darwin)
        ↓
7. WORKSPACE (Core)
   Dentro de la vertical, Core Workspaces carga el layout personal del usuario
   (Professional / Firm / Medical / Legal). Billing (Stripe) gobierna el acceso.
   Notificaciones de la vertical fluyen de vuelta al centro de B vía eventos.
```

**Principio rector:** el usuario nunca ve dos logins, dos perfiles ni dos identidades. B es la puerta y la plaza; el Core es la casa; las verticales son las habitaciones.

---

## 4. ANÁLISIS DEL LOGIN SOCIAL ACTUAL

### 4.1. Cómo funciona

| Provider | Flujo | Validación | Datos obtenidos |
|---|---|---|---|
| Google (relay Emergent) | Redirect a `auth.emergentagent.com` → vuelve con `#session_id` → B llama `demobackend.emergentagent.com/auth/v1/env/oauth/session-data` con `X-Session-ID` | Sesión de un solo uso del relay | `id`, `email`, `name`, `picture`, `session_token` |
| LinkedIn | OAuth2 Authorization Code + state en `oauth_states` (TTL 10 min, one-shot) → token → OIDC `userinfo` | State + redirect_uri exacto + PKCE-less (client secret) | `sub`, `email`, `name`, `picture` |
| Facebook | Ídem (Graph v18, `me?fields=id,name,email,picture`) | Ídem | `id`, `email`, `name`, `picture` |
| Email/password | bcrypt + lockout 5×/15 min + verificación email opcional | Hash + rate limit | `email`, `name` (del form) |

### 4.2. Qué guarda

En `users`: email, name, picture, `auth_providers[]` (provider + provider_user_id + linked_at), `email_verified=true` (social), timestamps. En `user_sessions`: token opaco + user_id + provider + expiración. **No guarda tokens de acceso de los providers** (ni access_token ni refresh_token de Google/LinkedIn/Facebook) — solo la identidad normalizada. Esto es correcto para privacidad y simplifica la migración.

### 4.3. ¿Puede el Core consumir esta identidad SIN duplicar usuarios?

**Sí, con conciliación por email — y el diseño actual de B lo facilita.** Análisis:

✅ **A favor:**
- `auth_providers[]` ya es multi-provider y el merge por email ya está implementado en B — el mismo patrón aplica en el Core.
- Los `provider_user_id` (sub de Google/LinkedIn, id de Facebook) son estables y exportables: el Core puede re-vincular al mismo usuario social sin pedirle nada.
- No hay access tokens de providers que migrar (solo identidad).
- El token de sesión opaco de B es intercambiable: el Core puede exponer `POST /api/identity/exchange` que reciba un `session_token` de B, lo valide contra la Mongo de B (lectura temporal cross-db o endpoint interno) y emita `pcs_id_token`. Migración de sesiones vivas sin logout masivo.

⚠️ **Riesgos a resolver:**
- **Conciliación por email puede colisionar** si el mismo email existe en ambos con datos distintos → resolver con regla "Core gana en identidad, B aporta `origin` y campos sociales faltantes".
- **Formatos de id heterogéneos** en B (`user_<hex>` vs `uuid4`) → en la migración, el Core asigna su id canónico y guarda `legacy_one_id` para re-mapear posts/follows/sessions.
- **805 usuarios reales** ya en B: la migración debe ser con grace period (doble cookie 30 días) y correo "reclama tu identidad" a quienes no tengan password válido.
- **Sesiones legacy `sess_*`:** expirarán solas (7 días TTL), no hace falta migrarlas.

---

## 5. HEADER / MENÚ GLOBAL POR ROL

### 5.1. Estado actual (B)

El `Header.jsx` actual **solo distingue 2 estados**: visitante (botón "Unirse") y autenticado (campanita + menú de perfil: Ver mi perfil / Configuración Mi Espacio / Personalizar perfil / Cerrar sesión). La nav (Mi Espacio, Noticias, Videos, Empleos, Empresas, Eventos, IA, Comunidad) es **idéntica para todos**. El admin entra por una ruta oculta (`/admin/login`) con un contexto JWT separado; el inversor por `/investor-portal`. No hay concepto de empresa ni profesional en el header.

### 5.2. Propuesta — header global del ecosistema por rol

| Elemento | Visitante | Autenticado (member) | Profesional | Empresa | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Logo + búsqueda global | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nav pública (Noticias, Empleos, Eventos, Comunidad) | ✅ | ✅ | ✅ | ✅ | ✅ |
| CTA "Unirse / Entrar" (→ SSO Core) | ✅ | — | — | — | — |
| Mi Espacio (B) | — | ✅ | ✅ | ✅ | ✅ |
| **Universal Launcher** (apps del Core) | — | ✅ (One + registro a verticales) | ✅ (+ vertical de su profession_key) | ✅ (+ Empresa/Firm) | ✅ (todas) |
| "Mi Empresa" (vitrina/panel) | — | — | — | ✅ | ✅ |
| Campanita notificaciones + mensajes | — | ✅ | ✅ | ✅ | ✅ |
| Menú perfil (perfil, ajustes, plan/billing del Core, salir) | — | ✅ | ✅ | ✅ | ✅ |
| Consola Admin (Core) | — | — | — | — | ✅ |
| Badge de plan/rol (Free/Pro/Firm…) | — | ✅ | ✅ | ✅ | ✅ |

**Reglas:** (1) un solo header compartido como componente de diseño (el design system vive en B); (2) el Launcher lo provee el Core vía `GET /api/launcher/apps` filtrado por rol/`profession_key`/suscripción; (3) el rol se lee del `/me` del Core, nunca de estado local; (4) el menú móvil (`MobileBottomNav`) replica la misma matriz.

---

## 6. ARQUITECTURA DEFINITIVA DEL ECOSISTEMA

```
                    *.puntocerosystem.com  (wildcard SSL + DNS)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
┌───────────────────┐  ┌──────────────────────┐  ┌──────────────────────────┐
│  puntocerosystem  │  │ identity.puntocero…  │  │ legal. / medical. /      │
│  .com  (B,        │  │  + Core app          │  │ empresa. / agentes.      │
│   Emergent)       │  │  (A, VS Code/deploy  │  │ puntocerosystem.com      │
│                   │  │   propio)            │  │ (A, verticales)          │
│ · Landing/SEO     │  │                      │  │                          │
│ · Comunidad/Feed  │  │ · Identity (users,   │  │ · Firm OS / Medical /    │
│ · Grupos/Follows  │  │   roles, JWT, OAuth) │  │   Empresa / Darwin IA    │
│ · Noticias/       │  │ · Universal Launcher │  │ · Workspaces por         │
│   Eventos/Empleos │  │ · Workspaces API     │  │   vertical               │
│ · Mensajería*     │  │ · Billing (Stripe)   │  │ · Casos de negocio       │
│ · Notificaciones  │  │ · Vertical Registry  │  │                          │
│   (centro)        │  │ · Admin consola      │  │                          │
│ · Object storage* │  │ · Object storage ★   │  │                          │
└────────┬──────────┘  └──────────┬───────────┘  └────────────┬─────────────┘
         │                        │                           │
         │   cookie pcs_id_token (Domain=.puntocerosystem.com) │
         └────────────────────────┴───────────────────────────┘
                                  │
              APIs server-to-server (HTTP JSON + service_token):
              · B → A: GET /api/identity/me (cache 60 s)
              · B → A: GET /api/launcher/apps
              · B → A: GET /api/identity/users/{id}/public (perfil público)
              · A → B: GET /api/feed/highlights, /api/stats/public (Core muestra comunidad)
              · Eventos A → B (webhook/pub-sub): identity.registered,
                subscription.activated, user.deactivated, workspace.updated
              · Eventos B → A: post.created (opcional, para actividad del Launcher)
```

\* Mensajería y storage: destino final según §2 (módulos 25 y 28) — storage migra al Core; mensajería se decide con el equipo Core.

### Qué queda en Emergent (B)
Landing + marketing, SEO, comunidad completa (feed, posts, grupos, follows, reacciones), motor editorial regional (content sources, growth engine), noticias/eventos/empleos/videos/marketplace, centro de notificaciones, frontend del header global (design system), WelcomeModal/onboarding UX.

### Qué queda en el Core (A)
Identidad (users, roles, auth, OAuth, sesiones/JWT, verify/reset), Universal Launcher, Workspaces, verticales (Legal/Firm, Medical, Empresa, Professional), Agents/Darwin IA, Billing/Stripe, Vertical Registry, Admin, object storage central, email transaccional.

### Qué se comunica por API
Identidad (`/me`, perfiles públicos), Launcher (apps por rol), highlights de comunidad hacia el Core, eventos de ciclo de vida en ambas direcciones, y (a futuro) search/analytics unificados. **Ningún backend toca la Mongo del otro.**

---

## 7. ROADMAP REAL DE FUSIÓN — fases, prioridades y riesgos

### Fase 0 · Contratos y preparación — 2-3 días — **P0**
- Acordar con el equipo Core los endpoints públicos: `/api/identity/me`, `/api/identity/logout`, `/api/identity/exchange`, `/api/launcher/apps`, `/api/identity/users/{id}/public`, `/api/stats/public`.
- Wildcard SSL `*.puntocerosystem.com` + DNS por subdominio.
- Registrar Redirect URIs de producción en Google/LinkedIn/Facebook (ya pendiente en B para LinkedIn/Facebook — se hace una sola vez apuntando al Core).
- Definir formato de `pcs_id_token` (JWT HS256/RS256, claims: `sub`, `email`, `role`, `profession_key`, `verticals[]`, `exp`).
- **Riesgos:** SLA de verificación de providers OAuth (24-72 h); desalineación de claims entre equipos. **Mitigación:** contrato firmado (schema JSON) antes de escribir código.

### Fase 1 · SSO de lectura en B — 1 semana — **P0**
- B acepta `pcs_id_token` además de su cookie local (doble lectura, sin romper sesiones actuales).
- `GET /api/community/auth/me` se vuelve proxy con cache al `/api/identity/me` del Core.
- `CommunityAuthContext` lee del proxy; botón "Entrar" redirige a `identity.*`.
- **Riesgos:** cookie mal configurada (Domain/SameSite) rompe sesión global → probar primero en subdominio staging; latencia añadida por el proxy → cache 60 s + timeout 2 s con degradación controlada (modo lectura público).
- **Criterio de salida:** un usuario creado en el Core navega B autenticado sin tocar el registro de B.

### Fase 2 · Migración de usuarios B → Core — 1 semana — **P0**
- Export de `users` (805) → import en Core con `origin:"one-legacy"`, `legacy_one_id` y `auth_providers` intactos.
- Conciliación por email; re-mapeo de `posts.author_id`, `follows.user_id`, `group_members`, `user_workspaces` al id canónico del Core (o mantener ids legacy como clave externa estable — decidir en Fase 0).
- Correo "reclama tu identidad" a cuentas sin password (solo sociales).
- Grace period 30 días de doble cookie; luego se apaga la emisión local.
- **Riesgos:** emails duplicados/conflictivos (resolver caso a caso); ids heterogéneos (`user_*` vs `uuid4`); pérdida de `last_login_at`/contadores → migrarlos como metadatos.

### Fase 3 · Retiro de auth propia en B — 3-5 días — **P1**
- Deprecar y retirar: `/register`, `/login`, `/oauth/*`, `/session`, `/password/*`, `/verify/*`, `/me/invite` y las colecciones `user_sessions`, `oauth_states`, `login_attempts`, `password_reset_tokens`, `email_verifications`, `invite_redemptions`.
- Retirar `AuthContext` JWT y `/admin/*` de B (admin unificado en Core); redirects 301.
- **Riesgos:** usuarios con links viejos de reset/verify → redirect a flujos del Core; admin de B pierde acceso si no se migró su rol → checklist de roles antes del retiro.

### Fase 4 · Universal Launcher en el header — 3-5 días — **P1**
- Componente Launcher en `Header.jsx` consumiendo `/api/launcher/apps`.
- Header por rol según la matriz de §5.2 (incluye badge de plan desde Billing).
- **Riesgos:** bajo. Es UI consumiendo API; fallback = launcher oculto si el Core no responde.

### Fase 5 · Verticales enlazadas + segmentación — 1 semana — **P1**
- `EcosystemSection`/`OrbitalEcosystem` con links reales a subdominios de verticales.
- Campo opcional `vertical` en `posts`, `groups`, `growth_items` (mapeado al Vertical Registry del Core) para segmentar el feed por `profession_key`.
- Widget "destacados de verticales" (patrón embebido) si el Core expone `GET /api/verticals/{v}/highlights`.
- **Riesgos:** taxonomía `categories` (19, editorial) vs Vertical Registry (negocio) — mantener ambas con tabla de mapeo, no fusionarlas.

### Fase 6 · Consolidación de servicios compartidos — 1-2 semanas — **P2**
- Migrar object storage al Core (B consume URLs firmadas); mover `documents` y media de perfiles/posts/grupos.
- Email transaccional al Core (Resend), incluida la bienvenida que hoy dispara B.
- Decisión de mensajería (B la aporta o se migra a la del Core) y de analytics/search unificados.
- Eventos Core → B para notificaciones cross-vertical.
- **Riesgos:** migración de archivos con URLs ya publicadas → redirects o reescritura; doble escritura temporal de analytics.

### Fase 7 · Limpieza y producción — 1-2 semanas — **P2**
- Eliminar de B: `CompaniesPage`/`CompanyProfilePage` (tras migrar empresas), `AiPage` (queda vitrina), `ProfileCustomizePage`, `MiEspacioConfigPage` si Mi Espacio se absorbe en Workspaces del Core, mocks y código muerto.
- Monitoreo SSO end-to-end (SLOs, alertas de tasa de error de `/identity/me`), regresión completa, anuncio público.
- **Riesgos:** SEO de rutas retiradas → 301 permanentes; usuarios activos a mitad de limpieza → feature flags por módulo.

**Estimación total:** 6-8 semanas con ambos equipos coordinados. **Bloqueo principal:** la Fase 1-3 requiere que el Core exponga los contratos (Fase 0) — sin eso, B no puede avanzar en SSO.

### Riesgos globales
| Riesgo | Prob. | Impacto | Mitigación |
|---|:---:|:---:|---|
| Core no expone contratos a tiempo | Media | Alto | Fase 0 firmada; B puede empezar Fase 4 con mock del Launcher |
| Cookie SSO mal configurada rompe sesiones | Media | Alto | Staging + doble cookie + rollback = quitar flag |
| Colisiones de identidad por email | Media | Medio | Conciliación manual + `legacy_one_id` |
| Confusión "Mi Espacio" (B) vs "Workspaces" (Core) | Alta | Medio | Renombrar/unificar en Fase 6; decisión de producto requerida |
| Downtime de identidad tira la comunidad | Baja | Alto | Cache + degradación a modo público; circuit breaker |
| Duplicación residual de mensajería/notificaciones | Media | Bajo | Decisión explícita en Fase 6 antes de escribir código |

---

## 8. Decisiones pendientes que requieren al usuario / equipo Core

1. **¿Mi Espacio (B) se absorbe en Workspaces (Core) o coexisten?** (conceptualmente distintos, mismo nombre)
2. **¿La mensajería canónica es la de B (construida, sin uso) o la del Core?**
3. **Formato y claims exactos de `pcs_id_token`** (HS256 compartiendo `JWT_SECRET` vs RS256 con clave pública — recomendado RS256 para no compartir secretos).
4. **Dominio final de la landing** (hoy B vive en `puntoceromultiservicios.com`; la arquitectura asume `puntocerosystem.com` — definir canonical + 301).
5. **¿Empleos/eventos de empresas migran con las empresas al Core o se quedan como contenido público en B?**

---

*Auditoría realizada en modo estrictamente read-only sobre el código y la base de datos de B. Ningún archivo de código, configuración, test ni dato fue modificado. Requiere validación del equipo Core para las Fases 0-3.*
