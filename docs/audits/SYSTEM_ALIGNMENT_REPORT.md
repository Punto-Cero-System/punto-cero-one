# SYSTEM_ALIGNMENT_REPORT.md
**Fecha:** 2026-08-07
**Auditor:** E1 · lectura estática, sin modificar código
**Alcance:** ¿Puede este frontend + backend convertirse en el frontend oficial del ecosistema **Punto Cero System** (dominio raíz `puntocerosystem.com`, subdominio `medical.puntocerosystem.com`)?

---

## 0. Resumen ejecutivo

| Bloque | Estado |
|---|---|
| Frontend base React 19 + Tailwind | ✅ Listo |
| Backend FastAPI + MongoDB | ✅ Listo |
| Autenticación email/password + OAuth (Google, LinkedIn, Facebook) | ✅ Listo |
| Sesión por cookie httponly | ✅ Listo |
| **Punto Cero One** (Feed, Comunidad, Workspace, Perfil, Empresas, Empleos, Noticias, Eventos, Videos, IA, Marketplace, Legal, Mensajería, Notificaciones) | ✅ Listo |
| Login universal cross-dominio (`puntocerosystem.com` + subdominios) | ⚠️ Requiere ajustes de cookie/CORS |
| Multi-dominio en front (routing por host) | ❌ No implementado |
| **Punto Cero Medical** (Medicina, Enfermería, Odontología, Psicología) | ❌ Sólo mencionado en marketing (`OrbitalEcosystem`, `LatinAmericaBlock`, `ExecutiveSummaryPage`); no hay módulo funcional |
| **Verticales futuras** (Dental, Commerce, Accounting, Real Estate, …) | ❌ Sólo mencionadas en pitch |
| Modelo de datos preparado para verticales | 🟡 Parcial (`verticals: list[str]` en perfil, pero no hay `profession_key` ni `vertical` como partición de contenido) |

---

## 1. Estructura actual de rutas (frontend)

**39 rutas** definidas en `frontend/src/App.js`. Todas viven dentro de un único `<BrowserRouter>` sin partición por host.

### Rutas núcleo (Punto Cero One)
- `/` · `/mi-espacio` · `/mi-espacio/configuracion` — **Mi Espacio** (Home + configurador de widgets)
- `/comunidad` — Community landing
- `/perfil` · `/perfil/personalizar` — Perfil profesional del usuario autenticado
- `/u/:userId` — Perfil público
- `/mensajes` — Mensajería 1-a-1
- `/notificaciones` — Centro de notificaciones
- `/h/:tag` — Hashtag stream

### Rutas verticales existentes
- `/noticias` `/empleos` `/empresas` `/empresas/:id` `/eventos` `/videos` `/ia` `/marketplace/:code`

### Rutas de identidad
- `/join` · `/reset-password` · `/verify-email`
- `/admin/login` — panel administrativo

### Rutas de inversión / marketing
- `/capital` `/capital-strategy` `/investor-room` `/executive-summary` `/investor-pitch-deck` `/request-access` `/investor/setup`

### Rutas legales
- `/legal/privacidad` `/legal/cookies` `/legal/terminos` `/legal/acuerdo-profesional` · `/nuestra-historia`

### 🚫 Rutas de Medical / Legal como vertical especializada
No existen. No hay `/medical`, `/medicina`, `/enfermeria`, `/odontologia`, `/psicologia`, `/legal-vertical`.

---

## 2. Sistema de autenticación

**Módulo:** `backend/routes/community_auth_routes.py` + `backend/services/community_auth.py`
**Contexto React:** `frontend/src/contexts/CommunityAuthContext.jsx`

### Proveedores soportados
| Proveedor | Estado | Notas |
|---|---|---|
| Email + password | ✅ | bcrypt · login_attempts (brute-force) · verify-email |
| Google OIDC | ✅ | env vars en `backend/.env` |
| LinkedIn OIDC | ✅ | `LINKEDIN_CLIENT_ID/SECRET` presentes |
| Facebook OAuth | ✅ | `FACEBOOK_APP_ID/SECRET` presentes |
| Password reset por email | ✅ | tokens con TTL |
| Invitación por token | ✅ | `invite_redemptions` collection |

### Sesión
- Cookie única: `session_token` (`httponly`, `Secure`, `SameSite=None` por defecto).
- Persistencia: colección Mongo `user_sessions`.
- Configurable vía env: `COOKIE_SAMESITE`, `COOKIE_SECURE`, `SESSION_TTL_DAYS`.

### Estado global de auth (frontend)
- `CommunityAuthContext` — expone `user`, `signin`, `signout`, `refresh`.
- `AuthProvider` (legacy `AuthContext.jsx`) — usado por `/admin/*` con JWT.

---

## 3. Manejo de usuarios

**Modelo:** `backend/models_profile.py` + colección Mongo `users`.

Campos actuales:
- Identidad: `id`, `email`, `name`, `picture`, `role` (`member` · `admin` · `investor`)
- Profesional: `headline`, `bio`, `country`, `city`, `current_title`, `current_company`, `specialties`, `interests`, `portfolio_url`, `verticals`
- Social: `social.{website, linkedin, twitter, github, instagram, youtube, facebook}`
- Auth: `auth_providers` (array), `password_hash` (opcional), `email_verified`
- Métricas: `posts_count`, `followers_count`, `following_count`

### 🟡 Falta para verticales especializadas
- `profession_key` (p. ej. `medicina | enfermeria | odontologia | psicologia | derecho`) — hoy sólo hay `verticals: list[str]` en perfil, sin taxonomía cerrada.
- Sin campos regulatorios de salud (matrícula, colegiatura, nº profesional).
- Sin flags de habilitación por vertical (`medical_verified`, `legal_verified`).

---

## 4. Compatibilidad con login universal

### Lo que YA existe
1. Sesión por **cookie httponly** — el servidor puede emitirla con `Domain=.puntocerosystem.com`.
2. `_cookie_flags()` en `community_auth_routes.py` acepta env vars → agregar `COOKIE_DOMAIN` sería un cambio mínimo.
3. Un único backend + un único user store → un login para todo el ecosistema.
4. OAuth callback centralizado (`/api/community/auth/oauth/{provider}/callback`).

### Lo que FALTA
- **`COOKIE_DOMAIN` no está expuesto**: hoy la cookie se emite sólo para el dominio actual del backend. Para que `puntocerosystem.com` y `medical.puntocerosystem.com` compartan sesión, hay que emitir la cookie con `Domain=.puntocerosystem.com`.
- **CORS**: hoy `CORS_ORIGINS="*"` (permisivo pero incompatible con `credentials`). En producción hay que enumerar los orígenes: `https://puntocerosystem.com,https://medical.puntocerosystem.com,https://www.puntocerosystem.com`.
- **OAuth Redirect URIs** — hoy se construyen con `PUBLIC_APP_URL` (una única URL). Necesitan expandirse a las 2+ URLs de cada dominio y estar dadas de alta en los paneles de Google/LinkedIn/Facebook.
- No hay un endpoint tipo `/api/auth/whoami` público sin credenciales — sí existe `GET /api/community/auth/me` para consumir la sesión.

**Veredicto:** el login universal es alcanzable con configuración de infraestructura + 3 cambios menores en `_cookie_flags`. **No es un rediseño.**

---

## 5. Compatibilidad con múltiples dominios

### Frontend
- Un único build sirve todas las rutas — **no discrimina por `window.location.host`**.
- `REACT_APP_BACKEND_URL` apunta a UN backend (`future-core-5.preview.emergentagent.com` en preview).
- No hay lógica para renderizar `medical.puntocerosystem.com` distinto de `puntocerosystem.com`.

### Backend
- Un único FastAPI en Kubernetes con ingress apuntando a un dominio.
- Rutas `/api/*` sin partición por host.
- Todas las colecciones Mongo son globales (`users`, `posts`, `companies`, `growth_items`, …) — perfectas para un SSO común, pero no separan contenido por vertical.

### 🚧 Estrategias posibles (sin implementar aquí)
- **A · Un frontend, dos hosts** — mismo React build, un `SubdomainRouter` de nivel superior mira `window.location.host` y monta `AppOne` o `AppMedical`. Backend único.
- **B · Dos frontends independientes, un backend** — un repo `punto-cero-medical` que consume el mismo API (`https://api.puntocerosystem.com`). Mayor separación visual, más código.
- **C · Reverse-proxy con rewrite** — Ingress dirige `medical.*` a `/medical/*` internamente. Barato en infra, complica el routing React.

---

## 6. Inventario de módulos actuales

### ✅ Punto Cero One (100 % implementado)
| Módulo | Frontend | Backend |
|---|---|---|
| Home (Mi Espacio) | `pages/HomePage.jsx` + `WorkspaceContext` | `routes/workspace_routes.py` |
| Feed / Publicaciones | `IntelligentFeed`, `LiveFeed`, `FeedComposer`, `FeedPostCard` | `feed_routes.py` (posts, reactions, comments, saves, shares) |
| Content Sources (mixed-feed regional) | `feedService.contentSourcesService` | `content_sources_routes.py` + `services/content_sources/` |
| Comunidad | `pages/CommunityPage.jsx` | `groups_routes.py`, `follows_routes.py` |
| Identidad / Perfil | `pages/ProfilePage.jsx`, `PublicProfilePage.jsx` | `profile_routes.py`, `profile_media_routes.py`, `models_profile.py` |
| Workspace widgets | `services/workspaceRegistry.jsx` (30+ widgets) | `widget_routes.py` |
| Empresas | `pages/CompaniesPage.jsx`, `CompanyProfilePage.jsx` | `company_routes.py`, `company_media_routes.py` |
| Empleos | `pages/JobsPage.jsx` | `job_routes.py` |
| Eventos | `pages/EventsPage.jsx` | `event_routes.py` |
| Noticias | `pages/NewsPage.jsx` | fuente vía `growth_routes.py` |
| Videos | `pages/VideosPage.jsx` | `content_sources_routes.py::/videos` |
| Marketplace | `pages/MarketplacePage.jsx` | (mock/preview) |
| IA hub | `pages/AiPage.jsx` | `content_sources_routes.py::/ai-tools` |
| Mensajería 1-a-1 | `pages/MessagesPage.jsx` | `messaging_routes.py` |
| Notificaciones | `pages/NotificationsPage.jsx` + `NotificationsBell` | `notification_routes.py`, `services/notifications.py` |
| Realtime (SSE) | `contexts/RealtimeContext.jsx` | `realtime_routes.py`, `services/realtime.py` |
| Admin platform | `pages/AdminLoginPage.jsx`, `AdminDocumentsPage.jsx` | `admin_platform_routes.py` |
| Búsqueda | `HeaderSearchBar` | `search_routes.py` |
| Documentos | (admin) | `document_routes.py` |
| Discovery | `SuggestedPeopleWidget` | `discovery_routes.py` |
| Analytics | (interno) | `analytics_routes.py` |
| SEO | `robots.txt`, `sitemap.xml` | `seo_routes.py` |
| Legal (compliance UI) | `LegalPages.jsx`, `ProfessionalAgreementPage.jsx` | — |

### ✅ Roles profesionales (parcial)
- Backend acepta `role`: `member | admin | investor`.
- Perfil tiene `verticals: list[str]` (freetext) e `interests: list[str]` (dropdown chips).
- **NO existe** un enum de profesión cerrado ni un routing por profesión.

### ❌ Punto Cero Medical
- **No hay ningún módulo funcional de Medical.** Sólo referencias de marketing:
  - `components/OrbitalEcosystem.jsx` — grafica “Medical” con `status: 'development'`.
  - `components/LatinAmericaBlock.jsx` — “Medical y Dental en desarrollo”.
  - `pages/ExecutiveSummaryPage.jsx` — “Verticales Especializadas: Legal · Medical · Commerce · Accounting · +”.
  - `services/pdf_service.py` — la pitch-deck menciona “Medical · Dental · Commerce · …”.
  - `pages/AdminDocumentsPage.jsx` — hay una vertical `medicina` como taxonomía de documentos únicamente (no perfil ni feed).

### ❌ Vertical “Legal” especializada
- Existe `legal/*` **sólo** como páginas de compliance (privacidad, cookies, términos, acuerdo profesional). **No** existe un módulo Legal Vertical (case-management, contratos, agenda judicial, etc.).

---

## 7. Comparación con la arquitectura oficial

```
Punto Cero System
│
├── Punto Cero One
│
├── Punto Cero Medical
│   ├── Medicina
│   ├── Enfermería
│   ├── Odontología
│   └── Psicología
│
└── Futuras verticales
```

| Nodo del árbol | Frontend | Backend | Datos |
|---|---|---|---|
| Punto Cero System (raíz) | ⚠️ implícito (un solo React) | ✅ un único FastAPI | ✅ una única Mongo |
| Punto Cero One | ✅ | ✅ | ✅ |
| Punto Cero Medical | ❌ | ❌ | ❌ |
| Medicina | ❌ | ❌ | ❌ |
| Enfermería | ❌ | ❌ | ❌ |
| Odontología | ❌ | ❌ | ❌ |
| Psicología | ❌ | ❌ | ❌ |
| Futuras verticales | 🟡 marketing only | ❌ | ❌ |

---

## 8. ¿Qué está listo?

1. **Toda la plataforma social + workspace** (Punto Cero One completo).
2. **Autenticación multi-proveedor** con sesión por cookie httponly.
3. **Modelo de datos común** (Mongo) — la misma colección `users` puede alimentar Medical sin duplicar identidad.
4. **Módulo de contenido regional** (`content_sources`) — reutilizable por Medical con nuevas fuentes.
5. **Object storage local + streaming** para media (perfiles, portadas, posts, grupos).
6. **Realtime (SSE)** genérico, listo para nuevas verticales.
7. **Sistema de notificaciones y mensajería** genérico.

---

## 9. ¿Qué falta para ser el frontend oficial del ecosistema?

### Bloque A — Infraestructura de dominio (bajo esfuerzo)
- Exponer env var `COOKIE_DOMAIN` en `community_auth_routes._cookie_flags()` y setearla a `.puntocerosystem.com`.
- Reemplazar `CORS_ORIGINS="*"` por whitelist con `credentials=True`.
- Registrar todos los Redirect URIs (raíz + subdominios) en Google/LinkedIn/Facebook.
- Añadir DNS `medical.puntocerosystem.com` → mismo ingress.

### Bloque B — Routing multi-vertical (medio esfuerzo)
- Wrapper `SubdomainRouter` que lea `window.location.host` y decida:
  - `puntocerosystem.com` → `<AppOne />` (lo actual)
  - `medical.puntocerosystem.com` → `<AppMedical />` (nuevo shell)
- Añadir rutas `/medicina | /enfermeria | /odontologia | /psicologia` dentro del shell Medical.

### Bloque C — Modelo de datos Medical (alto esfuerzo, no crítico para el hosting)
- `profession_key` como enum cerrado en `users` + `groups` + `posts`.
- Colecciones específicas: `medical_records`, `patient_notes`, `medical_categories`, etc. (a definir con el equipo Medical).
- Verificación regulatoria (matrícula profesional).

### Bloque D — Visual identity Medical
- Design tokens y tema separado (paleta clínica).
- Assets iconográficos por especialidad.

---

## 10. ¿Qué debe migrarse?

| Elemento | Destino |
|---|---|
| Frontmatter marketing (Ecosystem, Orbital, LatinAmericaBlock) mencionando Medical/Dental | Actualizar textos a “disponibles en `medical.puntocerosystem.com`” cuando exista |
| `PUBLIC_APP_URL` (backend) | Reemplazar por resolución dinámica basada en `X-Forwarded-Host` o mantener y sumar dominios adicionales |
| `AdminDocumentsPage.jsx` — vertical `medicina` como categoría | Promoverla a `profession_key` en el modelo Medical cuando exista el módulo |
| `models_profile.verticals: list[str]` | Migrar a enum `profession_key` + `sub_specialties` |
| Configuración OAuth callbacks | Añadir URIs de todos los subdominios |
| Widget `SuggestedPeopleWidget` y otros “Descubre” | Segmentar por `profession_key` cuando Medical exista, para no cruzar disciplinas irrelevantes |

---

## 11. ⛔ Qué NO debe tocarse

Estos módulos están estables, con tests verdes y validados en producción — cambiarlos ahora rompe el hosting inmediato:

1. **`backend/routes/feed_routes.py`**, `content_sources_routes.py`, `follows_routes.py`, `groups_routes.py` — feed social-first + paginación con `offset/next_offset`.
2. **`backend/routes/community_auth_routes.py`** — sesión, OAuth, brute-force protection.
3. **`backend/routes/workspace_routes.py`** — layout `default_workspace()` acaba de simplificarse; no revertir.
4. **`frontend/src/components/community/IntelligentFeed.jsx`** — botón “Ver más” + scroll restoration.
5. **`frontend/src/components/community/FeedPostCard.jsx`**, `PreviewCard.jsx` — memoizados; están calientes.
6. **`frontend/src/contexts/CommunityAuthContext.jsx`, `RealtimeContext.jsx`, `WorkspaceContext.jsx`** — bases de la plataforma.
7. **Object storage y streaming** (`profile_media_routes.py`, `company_media_routes.py`) — arreglo crítico de fotos hecho recientemente.
8. **Tests** en `/app/backend/tests/` (`test_editorial_composer.py`, `test_wave12_photo_fix.py`, `test_wave12_content_sources.py`, `test_iter34_feed_filter.py`) — cambiarlos invalida la regresión.

---

## 12. Recomendación final

**Sí, este frontend puede convertirse en el frontend oficial del ecosistema Punto Cero System**, con la condición de:

1. **Fase 0 (1-2 días, sin refactor):** habilitar `COOKIE_DOMAIN=.puntocerosystem.com` + whitelistear CORS + registrar Redirect URIs en providers. Con esto la sesión ya se comparte entre dominios.
2. **Fase 1 (1 semana):** implementar `SubdomainRouter` y un shell Medical mínimo (landing + login redirigiendo al backend común).
3. **Fase 2 (equipos Medical + producto):** definir el modelo de datos y los módulos funcionales de Medicina, Enfermería, Odontología, Psicología.

Nada de lo actual necesita rediseño arquitectónico. La base React + FastAPI + Mongo + Cookie-session + OAuth es la correcta para el ecosistema. Sólo hay que **añadir superficies** (shells verticales) sobre el core existente.

---
*Informe generado sin realizar cambios en el código.*
