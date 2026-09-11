# Punto Cero System — Changelog

## 2026-08-04 — Wave 12 Fase 6: Editorial Composer (fix del feed aleatorio)

### Problema
El usuario reportó que el Intelligent Mixed Feed se veía aleatorio, sin criterio editorial (a veces 3 noticias seguidas, a veces salto brusco). Se pedía transformar la experiencia en algo tipo "revista profesional" con jerarquía visual y orden de bloques predecible.

### Fix: `_compose_editorial`
- Nuevo `EDITORIAL_TEMPLATE` de 20 slots en `backend/routes/content_sources_routes.py` que define kind + layout por bloque: news(hero), job(medium), event(medium), user_post(large), news(medium), company(medium), marketplace(medium), video(medium), job(medium), community(small), news(medium), user_post(large), event(medium), company(medium), job(medium), news(medium), marketplace(medium), video(medium), podcast(small), repo(small). Distribución: news 20%, job 15%, event 10%, user_post 10%, company 10%, marketplace 10%, video 10%, community 5%, podcast 5%, repo 5%.
- Reemplazado el `_interleave` aleatorio por `_compose_editorial` determinístico:
  - Múltiples pases sobre el template.
  - Slots con pool vacío se OMITEN (no se sustituyen aleatoriamente → nunca "3 noticias seguidas").
  - Nunca dos items consecutivos con el mismo kind.
  - Solo 1 hero por respuesta.
  - Layouts `hero` y `large` sólo en el primer pase; segundo pase downgraded a `medium` (previene duplicados detectados por testing agent en iteration_29).
- Endpoint `/api/content-sources/mixed-feed` ahora responde con `layout_distribution` y `editorial_template_size` adicionales para observabilidad.
- Pool `community` incluido en `pools` (bug encontrado por testing agent — slot 10 siempre vacío antes).

### Jerarquía visual en frontend
- `IntelligentFeed.jsx` — el grid ahora lee `item.layout` del backend. `hero` y `large` → `grid-column: 1 / -1`. `medium`/`small` → 1 columna. En móvil (<720px) todos colapsan a 1 columna.
- `ContentCard.jsx` pasa `layout` al card específico.
- `NewsCard.jsx` — cuando `layout='hero'`: imagen 420px de alto, título 1.4rem, badge de categoría flotante sobre el gradient overlay.

### Verificación
- **testing_agent iteration_30: 57/57 tests verde**, `retest_needed=false`. Bugs de iteration_29 confirmados como fixed. FIX 1 (single hero), FIX 2 (community pool), FIX 3-5 (anti-repetición + downgrade + orden del template) todos validados.
- Distribución real observada en producción: `{hero: 1, medium: 15, large: 2, small: 2}` con secuencia editorial exacta (blocks 1→20, luego segundo pase downgraded).

### Files changed (Fase 6)
- Backend: `routes/content_sources_routes.py` (EDITORIAL_TEMPLATE + _compose_editorial + community_pool), `tests/test_wave12_content_sources.py` (aserciones actualizadas), `tests/test_editorial_composer.py` (NUEVO por testing_agent con 13 tests específicos del composer).
- Frontend: `components/community/IntelligentFeed.jsx` (grid con layout-aware spans), `components/community/cards/ContentCard.jsx` (props.layout), `components/community/cards/NewsCard.jsx` (hero layout XL).

---


## 2026-08-04 — Wave 12 Fase 5: Feed visual + Composer simplificado + Conoce en sidebar

### Content Sources System — rediseño visual
- **NewsCard**: hero image de 280px con overlay degradado; badge de categoría dinámico (usa `item.category`); meta con fuente en color + fecha (formatter es-CO) + autor + ubicación; botón "Leer noticia".
- **JobCard**: HeroBand degradado morado con logo overlap; muestra salario destacado en verde; tags como pills; botón "Aplicar".
- **EventCard**: HeroBand ámbar con overlay; fecha formateada al idioma es; categoría en pill; botón "Registrarse".
- **CompanyCard**: HeroBand azul + logo circular overlap; muestra seguidores cuando existan; botón "Ver empresa".
- **CommunityCard**: HeroBand verde con overlay decorativo; avatar circular overlap; muestra miembros; botón "Unirse".
- **MarketplaceCard**: imagen principal de 176px con precio flotante en pill oscuro; botón "Ver producto".
- **VideoCard**: miniatura 16:9 con overlay 20%, play button 56px, badge de duración; botón "Ver en YouTube".
- Backend `content_sources_routes._shape_growth_item` — nueva helper `_clean_html` que decodifica entities y strippea tags para que las descripciones se rendericen limpias (elimina el `&lt;p&gt;` que aparecía en algunos feeds).

### Feed dinámico — ritmo visual
- `IntelligentFeed` rediseñado a grid de 2 columnas con `gridAutoFlow: dense`. El primer item con imagen y las noticias/user_posts periódicas ocupan ancho completo → efecto "magazine".
- Media query embebida: en < 720px colapsa a 1 columna automáticamente.

### Composer simplificado
- Eliminados los 7 botones "próximamente" (Video/Documento/Encuesta/Marketplace/Evento/Empleo/IA). Solo queda **Foto** — 100% funcional (upload real).
- Imports depurados; `chipStub` eliminado.

### Menú "Conoce" reubicado al Sidebar
- Retirado del Header (`ConoceMenu` eliminado + imports limpios).
- **NEW** `ConoceSidebarBlock` en `LeftSidebar.jsx`: bloque accordion con los 8 items (Nuestra Historia, Fundadores, Capital, Inversionistas, Investor Center, Punto Cero Legal, Comunidad, Simulador). Toggle expandible con `AnimatePresence`, `data-testid` por item. Siempre visible en la columna izquierda.

### Tests
- Todos los tests siguen en verde: **39/39** en la suite Wave 12 (content-sources + UX + final + groups-ext).

### Files changed (Fase 5)
- Backend: `routes/content_sources_routes.py` (_clean_html + _shape_growth_item con clean).
- Frontend:
  - `components/community/cards/NewsCard.jsx`, `JobCard.jsx`, `EventCard.jsx`, `CompanyCard.jsx`, `CommunityCard.jsx`, `MarketplaceCard.jsx`, `VideoCard.jsx` (rewrites con hero + logos)
  - `components/community/IntelligentFeed.jsx` (grid dinámico + responsive)
  - `components/community/FeedComposer.jsx` (solo Foto)
  - `components/community/LeftSidebar.jsx` (ConoceSidebarBlock)
  - `components/Header.jsx` (ConoceMenu removido)

---


## 2026-08-04 — Wave 12 Fase 4: Group Notifications + Group Covers + Final Validation

### Group notifications (services/notifications)
- `NotificationKind` ampliado con `group_post`, `group_join`, `group_activity`.
- `groups_routes.join_group` → dispatch `group_join` al admin del grupo con actor + subject_url.
- `groups_routes.create_group_post` → fan-out `group_post` a todos los miembros (cap 500) menos el autor. Título con nombre del grupo, body con excerpt (120 chars) del post.

### Group covers (portada de grupos)
- Modelo `groups` — nuevo campo `cover_url` (nullable).
- **NEW** `PUT /api/groups/{id}/cover` (admin-only, 8 MB max, image/* validado) — sube al object storage, `groups/{group_id}/cover_<uuid>.<ext>`, persiste en `cover_url`.
- **NEW** `DELETE /api/groups/{id}/cover` (admin-only) — limpia.
- Frontend `CommunityPage.jsx`:
  - Tarjetas de grupo en la grilla ahora muestran una franja de portada de 96px + avatar overlap (misma estética que perfiles).
  - `GroupCoverStrip` en el modal Detalle con botones "Subir/Cambiar portada" + "Quitar" (solo visibles si `is_admin=true`).

### Validación final con testing agent (usuario real)
- **testing_agent iteration 28**: ejecutó 55 tests pytest + 13 endpoints live smoke contra URL público. **100% verde**. Sin backend issues, sin frontend issues reportados.
- Confirmaciones:
  - Registro básico funciona.
  - OAuth providers = solo Google/LinkedIn/Facebook (Apple/Microsoft/GitHub/X ausentes).
  - Mixed feed variedad OK (7 kinds distintos en muestra de 20, max streak = 1).
  - Perfil media (foto + portada) OK.
  - Composer upload real OK.
  - Grupos CRUD + notificaciones + portadas OK.
  - Buscador con meta enriquecido OK.

### Tests
- **NEW** `tests/test_wave12_groups_ext.py` — 4 tests: join notifica admin, post notifica miembros (no autor), cover admin-only + delete + non-image reject, cover auth required.
- Suite verde: **55/55** en Wave 12 completa (16 growth + 7 content-sources + 6 UX + 21 final + 4 groups-ext + 1 shared).

### Files changed (Fase 4)
- Backend: `services/notifications.py`, `routes/groups_routes.py`, `tests/test_wave12_groups_ext.py` (NEW).
- Frontend: `pages/CommunityPage.jsx` (tarjetas de grupo con portada + GroupCoverStrip en detalle).

---


## 2026-08-04 — Wave 12 Fase 3: Composer Upload Real + Grupos + Production Readiness

### P1 — Composer Upload Real
- **NEW** `POST /api/feed/media/upload` (auth) — recibe imagen, la persiste vía `object_storage` en `{app_prefix}/posts/{user_id}/<uuid>.<ext>` y devuelve `{ok, url}`. Rechaza no-imágenes (415) y archivos > 8 MB (413).
- Modelo `PostCreate` + `PostPublic` amplíados con campo `image_url` opcional.
- `feed_routes.create_post` persiste `image_url`; `_serialize_post` lo emite.
- `FeedComposer.jsx` — upload real (no más nombre falso): al seleccionar imagen sube al backend, muestra preview con botón "X" para descartar, badge "Subiendo…" mientras avanza. El submit acepta texto y/o imagen, y adjunta la URL persistida en la publicación.
- `FeedPostCard.jsx` — renderiza `image_url` con link a versión completa, `data-testid=feed-post-image-{id}`.
- `LiveFeed.jsx` — `onNewPost` propaga `imageUrl` al backend.

### P2 — Comunidades básicas (Grupos)
- **NEW** módulo `/api/groups`:
  - `GET  /api/groups/categories`     — 10 categorías (Marketing, Empleo, Empresas, Tecnología, Legal, Salud, Educación, Marketplace, Contabilidad, Emprendimiento).
  - `POST /api/groups`                — crear (auth). Admin se auto-une.
  - `GET  /api/groups?category=…`     — listar con filtro.
  - `GET  /api/groups/{id}`           — detalle (marca `is_member`, `is_admin`).
  - `POST /api/groups/{id}/join`      — unirse (idempotente).
  - `POST /api/groups/{id}/leave`     — salir.
  - `GET  /api/groups/{id}/members`   — listar miembros con foto/headline.
  - `POST /api/groups/{id}/posts`     — publicar (solo miembros → 403 si no).
  - `GET  /api/groups/{id}/posts`     — timeline del grupo (público).
- Colecciones nuevas: `groups`, `group_members`, `group_posts` (nombres flat, sin ObjectId).
- **Rewrite `/comunidad`**: `CommunityPage.jsx` ahora consume el backend real. Filtros de categoría en pills, botón "+ Crear grupo" abre `GroupCreator` (nombre/descripción/categoría/privacidad/normas), tarjetas de grupo abren `GroupDetail` con lista de miembros, publicaciones y composer inline.

### P3 — Responsive & UX
- La rejilla `CommunityLayout` ya usa breakpoints en 1400 / 1200 / 900 / 480 (verified). Community page adopta el layout de 3 columnas de la app.

### P4 — Production readiness
- **NEW** `tests/test_wave12_final.py` — 21 tests:
  - 4 tests P1 (upload, auth-guard, formato inválido, flujo end-to-end post con imagen)
  - 3 tests P2 (categorías, ciclo completo create→join→post→leave con permisos, filtro por categoría)
  - 14 smoke tests P4 (health, auth providers, community stats, feed posts, feed trending, content-sources types/mixed-feed/ai-tools, growth feed/connectors, groups, seo sitemap, search).
- **Full suite verde: 51/51** (16 growth + 7 content-sources + 6 UX + 21 final + 1 shared).

### Files changed (Fase 3)
- Backend: `models_feed.py`, `routes/feed_routes.py`, `routes/groups_routes.py` (NEW), `server.py`, `tests/test_wave12_final.py` (NEW).
- Frontend: `components/community/FeedComposer.jsx`, `components/community/FeedPostCard.jsx`, `components/community/LiveFeed.jsx`, `pages/CommunityPage.jsx` (rewrite), `services/feedService.js` (+groupsService).

---


## 2026-08-04 — Wave 12 Fase 2: Perfil Profesional + UX Consolidation

### Perfil profesional estilo LinkedIn (Parte 1)
- `pages/ProfilePage.jsx` — nueva `CoverBand` con imagen de portada editable + botones "Subir/Cambiar" y "Eliminar portada" (usa `PUT /api/community/users/me/media/cover` y `DELETE`).
- `AvatarWithUpload` — foto circular con FAB de cámara + botón rojo de borrado; endpoint `/media/picture`.
- `ProfessionalStructureRow` — 4 chips visuales para estructura futura (Verificación, Insignias, Nivel, Ranking) sin activar monetización. Badge "VERIFICADO" cuando `email_verified=true`.
- Backend `profile_media_routes.py` reutilizado sin cambios (ya existía).

### "Personaliza Mi Espacio" retirado del landing (Parte 2)
- `ProfileCardWidget.jsx` — CTA "Personalizar Mi Espacio" reemplazado por "Completar mi perfil" (más alineado con la prioridad de identidad).
- `WelcomeBandWidget.jsx` — copia actualizada: "Descubre, conecta y publica. La comunidad LATAM en un solo lugar."
- La opción "Configuración · Mi Espacio" sigue disponible desde el menú de Perfil del header.

### Caja de publicación funcional (Parte 3)
- `FeedComposer.jsx` — botón "Foto" ahora abre file picker real (input hidden, `accept="image/*"`); adjunta nombre al body como referencia (upload endpoint pendiente).

### Buscador enriquecido (Parte 4)
- `HeaderSearchBar.jsx` — resultados ampliados:
  - Ancho 40px avatar (circular para personas, redondeado para el resto).
  - Badge TYPE (EMPRESA/EMPLEO/VIDEO/REPOSITORIO/…) verde en cada resultado.
  - Subtitle + meta línea (headline, empresa, ubicación).
  - Tags/intereses en píldoras pequeñas.
- Backend `search_routes.py` — endpoint `/api/search` para `people` ahora devuelve `meta: {headline, company, location, tags, profile_type}` (ampliado desde `title/subtitle/image/url` básicos).

### Iconos duplicados eliminados (Parte 5)
- `Header.jsx` — eliminado `IconAction Bell` duplicado (quedaba junto a `NotificationsBell`). Ahora hay una sola campana funcional.
- `IconAction MessageCircle` reemplazado por `<Link to="/mensajes">` para que el ícono lleve a la página de mensajes en lugar de ser cosmético.

### Mega-menú "Conoce" (Parte 6)
- `Header.jsx` — nuevo componente `ConoceMenu` con dropdown grid 2×4 unificando: Nuestra Historia, Fundadores, Capital, Inversionistas, Investor Center, Punto Cero Legal, Comunidad, Simulador. Un solo punto de entrada; elimina tarjetas repetidas por la home.

### Tests (Fase 2)
- **NEW** `tests/test_wave12_ux.py` — 6 tests: avatar upload/delete, cover upload, auth-guarded media endpoints, non-image rejection, people-search rich meta, OAuth cleanup regression.
- Suite full green: 30/30 (`test_wave7_growth.py` 16 + `test_wave12_content_sources.py` 7 + `test_wave12_ux.py` 6 + 1 shared).

### Files changed (Fase 2)
- Backend: `routes/search_routes.py`, `tests/test_wave12_ux.py`.
- Frontend: `components/Header.jsx`, `components/community/HeaderSearchBar.jsx`, `components/community/FeedComposer.jsx`, `components/community/workspace/ProfileCardWidget.jsx`, `components/community/workspace/WelcomeBandWidget.jsx`, `pages/ProfilePage.jsx`.

---


## 2026-08-04 — Wave 12 Fase 1: Intelligent Mixed Feed + Content Sources System

### Content Sources System (NEW backend module)
- **NEW** `/app/backend/data/countries_sources.json` — catálogo curado por país de recursos externos: empleos (Computrabajo/Bumeran/Laborum/Catho/OCC), eventos (Eventbrite/Meetup/Sympla), noticias, videos (YouTube channels), comunidades LATAM, herramientas IA. 18+ países LATAM cubiertos, cero scraping, cero API keys.
- **NEW** `services/content_sources/__init__.py` — registry loader con `@lru_cache`. Normaliza toda entrada al schema universal `ContentSource {id, kind, title, description, image, category, location, country, source, external_url, metadata}`.
- **NEW** `routes/content_sources_routes.py` con endpoints:
  - `GET /api/content-sources/types` — tipos y países soportados.
  - `GET /api/content-sources/ai-tools` — 8 herramientas IA (Gemini, ChatGPT, Claude, Copilot, Perplexity, Canva AI, NotebookLM, Midjourney) con casos de uso.
  - `GET /api/content-sources/videos` — canales YouTube curados por categoría.
  - `GET /api/content-sources/by-type/{jobs|events|news|videos|ai_tools}?country=CO` — priorización hiperlocal (Ciudad→País→LATAM→Global).
  - `GET /api/content-sources/mixed-feed` — **el corazón del Wave 12**: mezcla ponderada de 10 tipos (news/job/event/video/user_post/company/marketplace/podcast/repo/dataset) con anti-repetición (nunca 4+ del mismo kind consecutivos) y distribución 20/15/10/10/10/10/10/5/5/5.

### Intelligent Mixed Feed (frontend)
- **NEW** `components/community/cards/` — 10 componentes visuales dedicados:
  - `BaseCard.jsx` — primitiva compartida con accent color, badge, media, meta, CTA principal y ghost CTAs.
  - `NewsCard`, `JobCard`, `EventCard`, `VideoCard`, `CompanyCard`, `CommunityCard`, `MarketplaceCard`, `RepoCard`, `DatasetCard`, `AiToolCard`.
  - `ContentCard.jsx` — dispatcher que renderiza el card correcto según `item.kind`. `user_post` delega en `FeedPostCard` existente.
- **NEW** `components/community/IntelligentFeed.jsx` — consumidor de `/api/content-sources/mixed-feed`. Badge "FEED INTELIGENTE", indicador de región y botón Actualizar.
- **NEW** `components/community/ExternalSourcesSection.jsx` — sección reusable que surface el catálogo curado en páginas verticales.
- `LiveFeed.jsx` — nueva pestaña **"Descubrir"** (default) al lado de "Últimos" y "Para Ti". Rutea a `IntelligentFeed` cuando activa.
- `contentSourcesService` agregado a `services/feedService.js`.

### Composer (caja de publicaciones)
- `FeedComposer.jsx` — botones ahora todos funcionales: Foto/Video/Documento/Encuesta/Marketplace/Evento/Empleo muestran toast "Disponible próximamente"; IA navega a `/ia`. Ya no hay botones muertos.

### Empty-state elimination
- `JobsPage`, `EventsPage`, `VideosPage`, `AiPage` — todas incorporan `ExternalSourcesSection` (o rewrite completo en el caso de Videos/IA) → ninguna sección aparece vacía.
- `AiPage` — rewrite completo: filtros por caso de uso (IA para productividad / profesionales / programación / …), 8 tarjetas iniciales.
- `VideosPage` — rewrite mínimo: canales YouTube curados.

### Welcome flow (Parte 2)
- `WelcomeModal.jsx` — agregado botón secundario **"Completar mi perfil"** → navega a `/perfil/personalizar`. El botón primario "Comenzar a explorar" ya existía.

### Backend tests (Wave 11 legacy fix + Wave 12)
- `tests/test_wave7_growth.py` — 2 tests OAuth desfasados actualizados (LinkedIn ahora acepta 307/302; providers ahora valida contrato "solo Google+LinkedIn+Facebook visible").
- **NEW** `tests/test_wave12_content_sources.py` — 7 tests: types, ai-tools, videos, by-type paramétrico (jobs/events/news), mixed-feed anti-repetición, distribution report.
- Suite full green: `test_wave7_growth.py` 16/16 + `test_wave12_content_sources.py` 7/7.

### Files changed
- Backend: `data/countries_sources.json`, `services/content_sources/__init__.py`, `routes/content_sources_routes.py`, `server.py` (register router), `tests/test_wave7_growth.py`, `tests/test_wave12_content_sources.py`.
- Frontend: `components/community/cards/*.jsx` (11 archivos), `components/community/IntelligentFeed.jsx`, `components/community/ExternalSourcesSection.jsx`, `components/community/LiveFeed.jsx`, `components/community/FeedComposer.jsx`, `components/community/WelcomeModal.jsx`, `pages/AiPage.jsx`, `pages/VideosPage.jsx`, `pages/JobsPage.jsx`, `pages/EventsPage.jsx`, `services/feedService.js`.

---


## 2026-08-04 — Wave 11.1: Growth Activation (OAuth + Share + Invitations + SEO)

### OAuth — GitHub + Facebook (backend wired, activables por env)
- **NEW** `GitHubAuthProvider` en `services/community_auth.py` — subclase de `OAuth2AuthorizationCodeProvider`. Scopes `read:user user:email`. Se activa con `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`.
- **NEW** `FacebookAuthProvider` — Graph API v18. Scopes `email public_profile`. Se activa con `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET`.
- Ambos reutilizan **el mismo flujo** que LinkedIn/Microsoft (JWT, refresh, user profile, roles) — cero autenticación paralela.
- `/api/community/auth/providers` ahora lista `linkedin, microsoft, github, facebook, apple, twitter` en `coming_soon` hasta que sus env vars aparezcan.

### Compartir contenido — ShareButton universal
- **NEW** `components/community/ShareButton.jsx` — botón + popover con URLs oficiales:
  - LinkedIn: `linkedin.com/sharing/share-offsite/`
  - Facebook: `facebook.com/sharer/sharer.php`
  - X (Twitter): `twitter.com/intent/tweet`
  - WhatsApp: `api.whatsapp.com/send`
  - Telegram: `t.me/share/url`
  - Copiar link (clipboard API)
- Usa `navigator.share()` (Web Share API) cuando está disponible; fallback al popover.
- Data-testids: `share-button-{id}`, `share-menu-{id}`, `share-menu-{network}-{id}`.

### Invitaciones (viral loop)
- **NEW** `GET /api/community/auth/me/invite` — devuelve `{code, url, invited_registered, share_message}`. Código deterministic: SHA-256(user.id) truncado a 8 hex uppercase → **sin escritura extra en DB**, idempotente.
- **NEW** `POST /api/community/auth/register` acepta `invite_code` opcional. Al registrarse con código válido, `db.invite_redemptions` guarda `{invited_user_id, referrer_id, code}` (upsert idempotente por `invited_user_id`).
- **NEW** `InviteBlock` dentro de `ProfileCardWidget` (Mi Espacio) — muestra código + contador de invitados + botón Copiar + ShareButton. Cero pantalla nueva.
- `JoinPage` lee `?invite=CODE` de la URL y lo pasa a `registerEmail`.

### SEO / OpenGraph / Sitemap
- **NEW** `routes/seo_routes.py`:
  - `GET /api/seo/sitemap.xml` — sitemap dinámico con empresas seeded (≥15 URLs).
  - `GET /api/seo/robots.txt` — enlaza al sitemap.
  - `GET /api/seo/og/company/{slug}` — HTML con OpenGraph + Twitter Card + JSON-LD `Organization` schema.org + canonical + `<meta http-equiv=refresh>` para que usuarios reales rebotan al SPA.
- Todo bajo `/api/seo/*` para que la infraestructura Kubernetes existente (que rutea `/api/*` al backend) los sirva sin cambios de config.

### Funcionalidades implementadas (checklist P0)
| Item | Estado |
|---|---|
| LinkedIn OAuth wired | ✅ desde Wave 8B, coming_soon |
| Microsoft OAuth wired | ✅ desde Wave 8B, coming_soon |
| Facebook OAuth wired | ✅ Wave 11.1, coming_soon |
| GitHub OAuth wired | ✅ Wave 11.1, coming_soon |
| Compartir a LinkedIn/FB/X/WhatsApp/Telegram/Copy | ✅ oficial URLs, sin SDK |
| OpenGraph + Twitter Cards + JSON-LD | ✅ `/api/seo/og/company/{slug}` |
| Sitemap + robots | ✅ dinámicos |
| Invitaciones (código + URL + contador) | ✅ perfil |
| Métricas de invitación registradas | ✅ `db.invite_redemptions` |

### Variables de entorno para activación producción
```
# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Facebook OAuth
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# LinkedIn (ya listo desde Wave 8B)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Microsoft (ya listo desde Wave 8B)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

Redirect URIs a registrar en cada portal (misma pauta que Wave 8B):
- `https://puntoceromultiservicios.com/api/community/auth/oauth/{provider}/callback`
- `https://future-core-5.preview.emergentagent.com/api/community/auth/oauth/{provider}/callback`

### Testing
- `testing_agent_v3_fork` iteración 27 — **0 bugs**.
- Backend: **11/11 wave 11.1** verde + **58/58 regresión** (wave6/7/8a/8b/9/9.1/9.2/11 sin cambios).
- Frontend: invite block renderizado, código de 8 caracteres, copy button escribe URL correcta al clipboard, share menu con las 6 opciones oficiales, `window.open` invoca con las URLs de deep-link exactas del brief.

### Errores corregidos
- El endpoint `/providers` no listaba `github` en `coming_soon` — corregido.
- El label helper `_label` centralizado — cambio compacto sin duplicación.

### Estado final
- Cero módulos nuevos fuera de los 2 archivos SEO + 1 share component.
- Cero pantallas nuevas · Cero refactor · Cero regresiones.
- LinkedIn/Microsoft/GitHub/Facebook OAuth quedan listos con **solo activar env vars** en producción.
- Viral loop operacional end-to-end: link único por usuario → contador se actualiza automáticamente cada registro nuevo con ese código.
- SEO discoverable: sitemap.xml + OG tags por empresa + JSON-LD schema.org.

---

## 2026-08-04 — Wave 11: LATAM Public Data Platform (18 países)

### Framework de conectores (nuevo, reutilizable)
- **NEW** `services/growth/connectors/__init__.py` — `PublicDataConnector` con interfaz común: `health()`, `sync()`, `normalize()`, `validate()`, `cache_key()`, `schedule()`. Circuit breaker automático tras 5 fallos consecutivos (cooldown exponencial hasta 1h). Timeout 45s por conector. Logs receipts en `db.source_syncs` (misma tabla que usa el Sources Center para su dashboard).
- **NEW** `services/growth/connectors/ckan.py` — `CKANConnector` parametrizado. Un solo código cubre 11 portales CKAN LATAM (AR, CL, PE, EC, PA, UY, CR, DO, BO, PY + próximo).
- **NEW** `services/growth/connectors/registry.py` — 42 conectores en 18 países + GLOBAL. `build_registry()` y `refresh()` reutilizables.

### Conectores implementados

| Estado | Cantidad | Detalle |
|---|---|---|
| ✅ **Operativos** | 8 | AR/CL(×2)/PE/PA(×2)/UY/DO — CKAN activo, 25 datasets por portal por tick |
| 🟡 **Requiere credenciales** | 26 | Stubs preparados, se activan con env vars |
| 🔴 **Error transitorio** | 8 | MX/EC (SSL certificate expired), CR/SV/HN (DNS/portal offline), BO (403), PY (302), CO (Socrata) — circuit breaker activo |

### Estado por país (operativo / requiere credenciales / no disponible)

| País | CKAN datos abiertos | APIs oficiales stub |
|---|---|---|
| 🇦🇷 Argentina | ✅ operativo | 🟡 SAIJ (`AR_SAIJ_API_KEY`) |
| 🇧🇴 Bolivia | 🔴 portal bloquea bots | 🟡 SEPREC (`BO_SEPREC_API_KEY`) |
| 🇧🇷 Brasil | 🟡 requiere `BR_DADOSGOV_TOKEN` | 🟡 Open Finance (`BR_OPENFINANCE_CLIENT_ID/SECRET`) |
| 🇨🇱 Chile | ✅ operativo | 🟡 ChileCompra (`CHILE_MERCADOPUBLICO_TICKET`) + CORFO |
| 🇨🇴 Colombia | 🟡 datos.gov.co es Socrata (`CO_SOCRATA_APP_TOKEN`) | 🟡 SECOP/RUES/SPE |
| 🇨🇷 Costa Rica | 🔴 dominio pausado | 🟡 SICOP (`CR_SICOP_API_KEY`) |
| 🇩🇴 R. Dominicana | ✅ operativo | 🟡 DGII (`DO_DGII_API_KEY`) |
| 🇪🇨 Ecuador | 🔴 SSL cert expirado | 🟡 SRI + SERCOP |
| 🇪🇸 España | 🟡 requiere `ES_APIDATA_TOKEN` | 🟡 SEPE (`ES_SEPE_API_KEY`) |
| 🇬🇹 Guatemala | — | 🟡 Guatecompras (`GT_GUATECOMPRAS_API_KEY`) |
| 🇭🇳 Honduras | 🟡 requiere `HN_DATOS_TOKEN` | 🟡 HonduCompras |
| 🇲🇽 México | 🔴 SSL cert issuer | 🟡 DENUE (`INEGI_DENUE_TOKEN`) |
| 🇵🇦 Panamá | ✅ operativo + SBP | 🟡 PanamáCompra |
| 🇵🇪 Perú | ✅ operativo | 🟡 SUNAT + SUNARP |
| 🇵🇾 Paraguay | 🔴 302 loop | 🟡 DNCP |
| 🇸🇻 El Salvador | 🟡 requiere `SV_DATOS_TOKEN` | — |
| 🇺🇾 Uruguay | ✅ operativo | 🟡 DGI |
| 🇻🇪 Venezuela | — | (sin fuentes públicas oficiales disponibles) |
| 🌎 GLOBAL | — | 🟡 Mercado Libre, Shopify, Belvo, Prometeo |

### Endpoints reutilizados / evolucionados
- `GET /api/growth/connectors` **(nuevo)** — matriz completa: por conector + agregado por país.
- `POST /api/growth/connectors/{id}/sync` **(nuevo, admin)** — force sync individual.
- El **Growth Scheduler existente** (Wave 8B) invoca `_process_connectors(db)` en el tick inicial + cada 30 min. Sin scheduler paralelo.
- Los items ingresados usan `growth_items` (mismo schema). Discovery, Search, Trending, Feed **los consumen automáticamente** — sin código nuevo.

### Datos consumidos (primer tick, real)
- **≥125 datasets públicos oficiales** ingestados en `growth_items` (kind=`public_dataset`) desde 5 portales CKAN: AR, CL, PE, PA, UY, DO.
- Autotagging inline los relaciona con empresas seeded al vuelo.

### Variables de entorno necesarias (opcionales — activan más países)

```
# Colombia
CO_SOCRATA_APP_TOKEN=          # datos.gov.co (Socrata)
COLOMBIA_SECOP_API_KEY=
COLOMBIA_RUES_API_KEY=
COLOMBIA_SPE_API_KEY=

# México
INEGI_DENUE_TOKEN=

# Argentina
AR_SAIJ_API_KEY=

# Chile
CHILE_MERCADOPUBLICO_TICKET=

# Perú
PE_SUNAT_TOKEN=
PE_SUNARP_API_KEY=

# Brasil
BR_DADOSGOV_TOKEN=
BR_OPENFINANCE_CLIENT_ID=
BR_OPENFINANCE_CLIENT_SECRET=

# Ecuador, Panamá, Uruguay, Costa Rica, Dominicana,
# Guatemala, Honduras, Bolivia, Paraguay, España:
EC_SRI_API_KEY=  EC_SERCOP_API_KEY=
PA_PANAMACOMPRA_API_KEY=
UY_DGI_API_KEY=
CR_SICOP_API_KEY=
DO_DGII_API_KEY=
GT_GUATECOMPRAS_API_KEY=
HN_HONDUCOMPRAS_API_KEY=  HN_DATOS_TOKEN=
BO_SEPREC_API_KEY=
PY_DNCP_API_KEY=
ES_APIDATA_TOKEN=  ES_SEPE_API_KEY=
SV_DATOS_TOKEN=

# Global
MERCADOLIBRE_CLIENT_ID=  MERCADOLIBRE_CLIENT_SECRET=
SHOPIFY_ACCESS_TOKEN=
BELVO_SECRET_ID=  BELVO_SECRET_PASSWORD=
PROMETEO_API_KEY=
```

### Testing
- `testing_agent_v3_fork` iteración 26 — **0 bugs**.
- Backend: **15/15 wave 11** + **58/58 regresión** = **73/73 pytest verde**.
- Endpoint matrix + framework + circuit breaker + admin force sync + scheduler integration verificados end-to-end.

### Confirmación
- ✅ Framework de conectores implementado, reutilizable, con interfaz común de 6 métodos.
- ✅ 18 países LATAM + ES + GLOBAL registrados; 8 operativos hoy sin credenciales.
- ✅ Cero módulos nuevos fuera del framework · cero pantallas nuevas · cero cambios de rutas.
- ✅ Scheduler / Sources Center / Discovery / Search / Trending / OAuth / Punto Cero System — todos intactos.
- ✅ Toda ingesta pasa por `growth_items` y el autotagger inline; se consume automáticamente por Discovery/Search/Trending/Feed.

---

## 2026-08-04 — Wave 9.2: Hyperlocal Discovery Engine

### Backend
- **EXTENDED** `services/discovery/regional.py` — nueva función `hyperlocal_tier(item_country, item_city, user_country, user_city)` con tier `'city'` de máxima prioridad; `region_score()` y `regional_sort()` ahora aceptan `user_city` opcional (case-insensitive). Orden: **CITY → COUNTRY → LATAM → GLOBAL**. Estable — preserva orden upstream dentro de cada tier. Cuando `user_city=None`, comportamiento idéntico a Wave 9.
- **EXTENDED** `services/discovery/resolver.py:gather(db, entity, user_country, user_city)` — aplica sort hiperlocal a news/videos/jobs/events/similar/**people**. `similar_entities()` ahora proyecta `city`. Response añade `user_city`.
- **EXTENDED** `routes/discovery_routes.py` — `_resolve_user_context()` devuelve `(country, city)` desde cadena de prioridad (query `?city=` → users.city → `X-Region-City` header). `entity_related` acepta `?city=` y header.
- **EXTENDED** `routes/search_routes.py` — hereda automáticamente el header `X-Region-City` (regional_sort ya lo consume).
- **NEW** seeds `services/discovery/seeds.py` — 4 instituciones oficiales CO: `sena`, `mintic`, `camara-comercio-bogota`, `u-antioquia`. Todas con `city`.
- **NEW** `city` field en 6 empresas CO existentes: `bancolombia`, `grupo-sura`, `grupo-nutresa` → Medellín; `ecopetrol`, `avianca` → Bogotá; `alpina` → Sopó.
- **NEW** 9 RSS oficiales agregadas a `services/growth/sources.py`:
  - Argentina: `ar-boletinoficial` (Boletín Oficial), `ar-bcra` (BCRA)
  - Brasil: `br-receita` (Receita Federal)
  - Chile: `cl-bcentral` (Banco Central)
  - Colombia: `co-banrep` (Banco de la República), `co-superfinanciera` (Superfinanciera)
  - México: `mx-banxico` (Banxico)
  - Perú: `pe-bcrp` (BCRP)
  - España: `es-bde` (Banco de España)

### Frontend
- **EXTENDED** `hooks/useUserRegion.js` — persiste `localStorage['pcone_city']` en paralelo a `pcone_country`; expone `region.city`.
- **EXTENDED** `services/platformService.js` + `services/feedService.js` — cada fetch inyecta `X-Region-City` cuando localStorage tiene el valor.
- **EXTENDED** `components/community/workspace/ProfileCardWidget.jsx` — chip regional muestra pill con la ciudad detectada (`data-testid="workspace-region-city"`).

### APIs oficiales integradas por país (Wave 9.2 base)
| País | Fuentes públicas oficiales |
|---|---|
| Argentina | Boletín Oficial, BCRA |
| Brasil | Receita Federal |
| Chile | Banco Central de Chile |
| Colombia | Banco de la República, Superfinanciera, MinTIC, SuperSociedades, CCB, El Tiempo, La República, Portafolio, Semana |
| España | BOE, Banco de España, El País, El Mundo |
| México | Banxico, El Universal, La Jornada |
| Perú | BCRP, El Comercio |
| + 12 más | Prensa nacional + tier internacional (Wave 8A/9) |

### Países soportados hoy
21 códigos ISO — AR, BO, BR, CL, CO, CR, CU, DO, EC, SV, GT, HN, MX, NI, PA, PY, PE, UY, VE + ES + US. Todos aceptados por `PATCH /me/region`. Los que aún no tienen RSS oficial dedicado usan la prensa nacional Wave 8A.

### Testing
- `testing_agent_v3_fork` iteración 25 — **0 bugs**.
- Backend: **26/26 wave 9.2** verde (helper unit, discovery con city Medellín/Bogotá/sin ciudad, seeds nuevas, sources nuevas, PATCH region con city, detect propaga city, e2e cookie session infiere city automática).
- Regresión: **58/58 pytest** verde (wave6/7/8a/8b/9 sin cambios).
- Frontend: chip regional con pill ciudad visible; `localStorage['pcone_city']` persistido; Trending y Feed sin errores.

### Confirmación
El Discovery Engine ahora prioriza **CITY → COUNTRY → LATAM → GLOBAL** de forma automática. El usuario en Medellín ve primero contenido de Medellín, luego Colombia, luego LATAM, luego global. El usuario en Bogotá ve primero Bogotá, luego Colombia, etc. **No se crearon módulos nuevos, no se rompió ninguna funcionalidad existente, no se cambió el layout ni la autenticación.**

---

## 2026-08-04 — Wave 9.1: Detección Automática de País y Región

### Backend
- **NEW** `GET /api/community/region/detect` (dentro del router `community_stats`, sin nuevos módulos):
  - Extrae IP real del visitante via `CF-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For` → `request.client.host`.
  - Consulta **ipapi.co** (free tier, sin API key, ~1 000 req/día/IP).
  - Devuelve `{ip, method, country, country_name, region, city, timezone, latitude, longitude, persisted, default_country}` con `method ∈ {ip|language|timezone|default}`.
  - **Caché in-memory 6 h por IP** para no quemar la cuota gratis.
  - Fallback: `Accept-Language` → env `REGION_DEFAULT_COUNTRY` (default `CO`).
  - **Persistencia inteligente**: si el visitante tiene sesión activa y `users.country_source` **no es `manual`**, guarda `country`, `country_source=<método>`, `city`, `timezone` en el perfil. NUNCA sobrescribe una selección manual previa.
- **MODIFIED** `PATCH /api/community/auth/me/region` — marca `country_source="manual"` en el update, bloqueando futuras auto-detecciones para ese usuario.

### Frontend
- **MODIFIED** `hooks/useUserRegion.js` — cadena de auto-detección al primer mount:
  1. `GET /api/community/region/detect` (IP + ipapi.co)
  2. `navigator.language` map a ISO
  3. `Intl.DateTimeFormat().resolvedOptions().timeZone` map (24 zonas horarias LATAM)
  4. Default `'CO'`
  - Expone `method` (`'ip'|'language'|'timezone'|'default'|'manual'`) para que la UI muestre badge AUTO/manual.
  - `setRegion()` marca `method='manual'` y hace PATCH al backend (bloqueo permanente).
- **MODIFIED** `components/community/workspace/ProfileCardWidget.jsx` — el chip ya no muestra "Elige tu país":
  - Muestra directamente el país detectado con bandera + label.
  - Añade badge `data-testid="workspace-region-method"` con texto **`AUTO`** cuando la detección fue automática.
  - El picker sigue accesible tras el chevron para cambiar manualmente.
- **NO** modal ni wizard de selección al ingreso — cumple estrictamente el requisito.

### Servicios / proveedor reutilizados
- Proveedor: **ipapi.co** (público, gratuito, sin API key, endpoint sobreescribible por `REGION_LOOKUP_URL`).
- HTTP client: `httpx.AsyncClient` (ya en `requirements.txt` para Wave 8A).
- Sin nuevos módulos, sin nuevas pantallas, sin nuevos widgets.

### Prioridad de detección aplicada (spec del usuario)
| Orden | Método | Estado |
|---|---|---|
| 1 | IP → ipapi.co (país + región + ciudad + timezone) | ✅ activo |
| 2 | Browser Geolocation API (opt-in) | 🟡 disponible via botón manual (Wave 9 chip) — no bloquea |
| 3 | OAuth provider info | 🟡 heredado de Google/Microsoft cuando entregan `locale` (existente) |
| 4 | `navigator.language` + `Intl.DateTimeFormat.timeZone` | ✅ fallback client-side |
| 5 | Default `CO` | ✅ configurable via `REGION_DEFAULT_COUNTRY` |

### Testing
- `testing_agent_v3_fork` iteración 24 — **0 bugs**.
- Backend 8/8 wave 9.1 verde (endpoint, X-Forwarded-For CO/MX, caché, persistencia autenticado, manual lock, anon, integración con Discovery).
- Regresión 58/58 pytest (wave6/7/8a/8b/9) verde.
- Frontend en estado limpio: no aparece modal/wizard, chip se resuelve en < 1 s, badge AUTO visible, manual override respetado tras reload.
- Responsive: 360/414/768/1440 sin scroll horizontal.

### Confirmación
El usuario **ya NO necesita seleccionar manualmente el país**. Punto Cero One detecta desde el primer ingreso: país, región/departamento, ciudad, zona horaria e idioma — y activa el ranking regional 60/25/15 automáticamente sobre Discovery, Trending, Search y Recommendations. Si el usuario elige país manualmente después, la elección se respeta para siempre.

---

## 2026-08-03 — Wave 9: Regional Discovery Engine LATAM

### Backend
- **NEW** `services/discovery/regional.py` — helper compartido: `LATAM_COUNTRIES` (20 códigos ISO alpha-2 + ES + US), `weights()` (60/25/15 env-tunables `REGIONAL_WEIGHT_COUNTRY/LATAM/GLOBAL`), `region_score()`, `regional_sort()` (stable sort por tier preservando orden upstream), `filter_scope()`.
- **MODIFIED** `services/discovery/resolver.py:gather(db, entity, user_country=None)` — aplica regional_sort a news/videos/jobs/events/similar. Devuelve `user_country` en la respuesta.
- **MODIFIED** `routes/discovery_routes.py`:
  - `_resolve_user_country()` — cadena de prioridad `?country=` → session cookie → `X-Region-Country` header → `Accept-Language`.
  - `GET /api/discovery/entity/{slug}/related` — acepta `?country=`.
  - `GET /api/discovery/trending` — `?scope=country|latam|global|all` (default `all`), retorna `base_score` + `regional_weight` por item.
  - `GET /api/discovery/suggested` — acepta `?country=`, fallback prefiere seeds locales primero.
- **MODIFIED** `routes/search_routes.py` — `GET /api/search` aplica regional_sort a companies/news/videos/jobs/events, expone `user_country` en la respuesta.
- **NEW** `PATCH /api/community/auth/me/region` — 21 códigos ISO permitidos (AR, BO, BR, CL, CO, CR, CU, DO, EC, SV, GT, HN, MX, NI, PA, PY, PE, UY, VE, ES, US); 422 en códigos inválidos.
- **NEW** seeds `services/growth/sources.py` — 6 RSS Colombia adicionales: `co-portafolio`, `co-semana`, `co-dinero`, `co-mintic`, `co-supersociedades`, `co-ccb`.
- **NEW** seeds `services/discovery/seeds.py` — 6 empresas colombianas: `bancolombia`, `grupo-sura`, `grupo-nutresa`, `ecopetrol`, `alpina`, `avianca`.

### Frontend
- **NEW** `hooks/useUserRegion.js` — expone `{country, label, flag, setRegion, supported}`; guess navegador + `localStorage['pcone_country']`; al setear envía PATCH al backend si el usuario está autenticado.
- **MODIFIED** `components/community/workspace/ProfileCardWidget.jsx` — chip regional + picker dropdown (21 países LATAM). Data-testids `workspace-region-chip`, `workspace-region-label`, `workspace-region-picker`, `workspace-region-option-{CODE}`.
- **MODIFIED** `services/platformService.js` + `services/feedService.js` — cada fetch inyecta `X-Region-Country: {code}` desde localStorage, por lo que **anon users también ven contenido regional** en cuanto eligen país.

### Fuentes regionales integradas
- Colombia: 8 RSS públicos (El Tiempo, La República, Portafolio, Semana, Dinero, MinTIC, SuperSociedades, CCB).
- LATAM base ya presente (Wave 8A): MX, AR, CL, PE, EC, UY, BR, VE, BO, PY, CR, PA, DO, VE, SV, GT, HN, NI, cubren las 20 economías del brief.

### Empresas por país
- Colombia: Bancolombia, Grupo SURA, Grupo Nutresa, Ecopetrol, Alpina, Avianca, Rappi, Universidad Nacional, Universidad de los Andes.
- Ranking automático: si el visitante es CO, `similar[]` en cualquier ficha (ej. `/empresas/microsoft`) empieza con las empresas CO antes de las US/GLOBAL.

### Datos reales consumidos
- Cero mocks. Cero datos simulados. Todo el ranking corre sobre `growth_items` reales (ingesta RSS activa cada 30 min) y `companies` seeded.

### Testing
- `testing_agent_v3_fork` iteración 23 — **0 bugs**.
- Backend 28/28 wave9 + **77/77 regresión** (wave6/7/8a/8b/discovery/sources_center/growth).
- Frontend: chip regional visible en 360/414/768/1440, sin scroll horizontal. Persistencia validada en localStorage y en `users.country`.

### Confirmación
El Discovery Engine ahora **adapta automáticamente el contenido según el país del usuario** (detectado por `Accept-Language`, `X-Region-Country`, cookie de sesión o preferencia guardada). Cero módulos nuevos, cero pantallas nuevas, cero cambios de rutas.

---

## 2026-08-03 — Wave UX: Bienvenida Dinámica + Responsive Baseline

### Backend
- **NEW** `routes/community_stats_routes.py` — public `GET /api/community/stats` → `{total_members, total_companies, total_posts, generated_at}`. Excludes admin role.
- **WIRED** in `server.py:34,114`.

### Frontend
- **NEW** `hooks/useCommunityStats.js` — polling every 45 s (revalidates on `visibilitychange`, `refetch()` exposed for imperative refresh).
- **NEW** `components/community/WelcomeModal.jsx` — one-shot modal with confetti (`canvas-confetti`), navy/emerald palette, `armWelcome(userId)` helper, `localStorage['pcone_welcome_pending']` trigger, CTA + backdrop close → navigates to `/`.
- **MODIFIED** `components/community/workspace/ProfileCardWidget.jsx` — circle now shows real formatted member count when anon; new always-on pulse chip "N miembros creciendo" for both anon & authed users.
- **MODIFIED** `pages/JoinPage.jsx` — after successful `registerEmail` arms welcome flag with returned user id.
- **MOUNTED** `<WelcomeModal />` globally in `App.js` inside `WorkspaceProvider`.
- **DEP** `canvas-confetti@1.9.4` (12 KB gzip).

### Responsive Baseline
- Verified zero horizontal scroll at **360 · 390 · 414 · 768 · 1024 · 1280 · 1440 · 1920** on `/`, `/join`, `/empresas/microsoft`, `/noticias`.
- Modal uses `clamp()` typography, `max-height:92dvh`, and `overflowY:auto` so it never clips on the smallest viewport.

### Testing
- `testing_agent_v3_fork` iteration_22 — **0 bugs**. Backend 3/3 new pytest + regression endpoints green. Frontend welcome flow validated end-to-end (register → modal → confetti → CTA → feed) and reload does NOT retrigger. Counter live-refreshed after new registration (151→152→…154).

---

## 2026-08-03 — Wave 8B: Discovery Platform + Growth Engine (Production Ready)

### Backend
- **NEW** `services/discovery/autotag.py` — shared inline auto-tagger with 5-min alias cache.
- **NEW** endpoint `GET /api/discovery/trending?limit=&hours=` — real-time ranking by mentions × 3 + posts × 2 + followers × 1.
- **MODIFIED** `services/growth/aggregator.py:run_once` — inline auto-tag during upsert.
- **MODIFIED** `services/sources_center/engine.py` — inline auto-tag in `_sync_rss_like` + `sync_remotive_jobs`.
- **MODIFIED** `services/growth/scheduler.py` — startup pass runs `backfill_autotag(2000)`.
- **NEW** seed: canonical `google` company (in addition to `google-cloud`).

### Frontend
- **MODIFIED** `components/business/CompanyRelated.jsx` — 8 sections including People + Hashtags.
- **NEW** `components/community/workspace/TrendingCompaniesWidget.jsx` — right-panel widget.
- **REGISTERED** in workspaceRegistry + default panel (WorkspaceContext + workspace_routes).

### OAuth Providers — production-prepared (env-only)
- LinkedIn + Microsoft implementations complete. Only `LINKEDIN_CLIENT_ID/SECRET` + `MICROSOFT_CLIENT_ID/SECRET` needed in `.env`.

### Testing
- `testing_agent_v3_fork` iteration_21: 12/14 wave8b PASS + 39/39 regression (fixed google seed → 55/55).
- Public readiness verdict: **READY FOR PUBLIC (soft launch)**.


---

## 2026-08-05 — Wave 12 Fase 7: LinkedIn-Style Infinite Feed + Critical Image Fix

### Backend
- **FIXED** `routes/profile_media_routes.py::stream_profile_media` — endpoint whitelisted `{prefix}/users/` only, returning **403** for post images stored under `{prefix}/posts/…`. Root cause of the "publicación aparece sin la fotografía" bug. Now accepts `users/`, `posts/`, `groups/` prefixes.
- **NEW** `routes/content_sources_routes.py::mixed_feed` — accepts `offset` param (0-1000). All pool helpers (`_pool_growth`, `_pool_user_posts`, `_pool_companies`) accept `skip=`. Response now returns `offset` + `next_offset` for infinite scroll pagination (`next_offset=None` signals EOF).

### Frontend
- **REWRITTEN** `components/community/IntelligentFeed.jsx` — LinkedIn-style infinite scroll with `IntersectionObserver` sentinel (600px rootMargin), sessionStorage cache (`pc_intelligent_feed_cache_v1`, 10 min TTL), robust scroll-position restoration on back navigation (click-capture snapshot + freeze pattern to survive React Router DOM shrinkage), page-size 15 items.
- **MODIFIED** `components/community/cards/*.jsx` — added `loading="lazy" decoding="async"` to 8 card image tags (AiTool, Community, Company, Job, Marketplace, News, Preview, Video) to reduce first-paint cost during infinite scroll.
- **MODIFIED** `pages/HomePage.jsx` — removed `<Footer />` so feed never surfaces a page-footer inside the infinite scroll.
- **MODIFIED** `services/feedService.js` — `contentSourcesService.mixedFeed({ offset })`.

### Tests
- **REWRITTEN** `tests/test_editorial_composer.py` — 13 tests aligned with Social-First template (user_post→large, everything else→preview, no hero) + pagination offset advance test.
- All 22 Wave 12 pytest tests green.
- `testing_agent_v3_fork` iteration_32: backend 100%, frontend ~95% (initial), scroll-restore now validated via smoke test PASS.

### UX Directive
- User explicitly froze new feature/refactor work — focus on stability, bug fixes and UX polish through end of Wave 12.



---

## 2026-08-08 — Auditoría Maestra de Fusión Ecosistema (sin cambios de código)

### Entregable
- **NEW** `/app/ECOSYSTEM_FUSION_MASTER_AUDIT.md` — documento único que consolida y reemplaza a `CORE_FUSION_AUDIT.md` + `ONE_CORE_FUSION_AUDIT.md`. Contiene: inventario completo del Proyecto B (3 mecanismos de auth, campos de perfil, campos generados por registro social, las 49 colecciones MongoDB con conteos reales, sesiones, Mi Espacio), tabla de duplicidades A vs B por módulo (canónico + reutilizar/migrar/eliminar/sincronizar), flujo de usuario Landing → Registro → Comunidad → Perfil → Launcher → Vertical → Workspace, análisis del login social y su consumo por el Core sin duplicar usuarios, matriz de header global por rol (visitante/member/profesional/empresa/admin), arquitectura definitiva (qué queda en Emergent vs Core vs APIs) y roadmap de fusión en 8 fases (0-7) con prioridades y riesgos.

### Hallazgos registrados (para futuras fases)
- Formatos de id heterogéneos en `users` (`user_<hex12>` vs `uuid4` del seed admin) y de `session_token` (`cs_*` actual vs `sess_*` legacy) — relevante para migración de identidad.
- `user_sessions` (1003 docs) sin TTL index — no se purgan solas.
- Mensajería construida pero sin uso (`conversations`/`chat_messages` en 0) — decisión pendiente con equipo Core.
- Sin código modificado: solo el fix de lint previo en `backend/tests/test_auth_wave2.py` (F811, 9/9 tests verdes).
