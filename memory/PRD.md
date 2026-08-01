# Punto Cero System — PRD

## Original Problem Statement
Transformar el sitio de Punto Cero System en una experiencia tecnológica premium, cinematográfica e institucional para Latinoamérica. Debe transmitir la visión de una holding tecnológica en etapa temprana con:
- Landing corporativo estricto de 8 bloques narrativos.
- Diseño orgánico/circular/orbital (evitar cards SaaS cuadradas).
- Mapa interactivo multi-país (18 países LatAm).
- **Backend foundation del Investor Room** (esta fase): autenticación admin, persistencia de solicitudes de acceso en MongoDB, panel de revisión administrativa. Arquitectura escalable para el Investor Room privado en la próxima fase.
- Investor Pitch Deck interactivo de 12 secciones completamente conectado.

**Idioma:** Todo el contenido UI y las respuestas al usuario en **Español**.

## Personas
- Inversionistas early-stage (envían solicitudes vía `/request-access`)
- Administradores autorizados (revisan y actualizan solicitudes vía `/admin`)
- Aliados estratégicos y ecosistema
- Profesionales, emprendedores y empresas en LatAm

## Core Requirements
- Paleta: Navy `#0B1F3A`, Emerald `#00C896`, Gold `#D4AF37`.
- Motion: Framer Motion + Lenis smooth scroll.
- Sin branding "Emergent" en UI/metadata.
- Punto Cero Legal siempre enlaza externamente a `puntocerolegal.com`.
- No inventar datos financieros, KPIs, tracción, ni inversionistas.

## Arquitectura de Rutas (React Router)
- **Público (comunidad + landing)**
  - `/` — HomePage 3-column community (LinkedIn-style)
  - `/join` — Fast registration + social login (Google activo, MS/LinkedIn/Apple/FB "PRONTO")
  - `/noticias`, `/videos`, `/empleos`, `/empresas`, `/eventos`, `/ia`, `/comunidad` — verticales visuales con mock data
  - `/perfil` — perfil unificado (requiere community auth; redirige a /join si no hay sesión)
  - `/capital` — Capital Hub (Investor Center público)
  - `/executive-summary`, `/investor-pitch-deck`, `/capital-strategy`
  - `/investor-room` — InvestorRoomPreview (arquitectura, mockup)
  - `/request-access` — Formulario público → POST `/api/investor-requests`
  - `/investor-pitch-deck` — Pitch Deck 12-slide
- **Administrativo**
  - `/admin/login` — AdminLoginPage
  - `/admin` — AdminDashboardPage (protegido, requiere rol `admin`)

## Backend Architecture
```
/app/backend/
├── server.py                    # FastAPI entry, startup seeds admin + indexes + storage
├── auth.py                      # bcrypt + JWT + FastAPI dependencies
├── models.py                    # Pydantic models (User, InvestorRequest, ...)
├── routes/
│   ├── auth_routes.py           # /api/auth/{login,me,logout} + brute-force
│   ├── investor_routes.py       # public POST + admin CRUD/workflow
│   ├── pitch_deck_routes.py     # analytics + PDF download
│   ├── community_auth_routes.py # NEW /api/community/auth/* (cookie-based)
│   └── document_routes.py       # NEW /api/documents/* (object storage)
├── services/
│   ├── community_auth.py        # NEW provider abstraction (Emergent Google today; MS/LinkedIn/Apple/FB ready)
│   └── object_storage.py        # NEW pluggable storage (Local | Emergent)
└── .env                         # JWT_SECRET, ADMIN_*, MONGO_URL, DB_NAME,
                                 # EMERGENT_AUTH_*, OBJECT_STORAGE_*, EMERGENT_LLM_KEY
```

### API Endpoints
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | — | Health + DB ping |
| POST | `/api/auth/login` | — | `{email,password}` → `{access_token,user}` (admin/investor) |
| GET | `/api/auth/me` | Bearer | Devuelve usuario autenticado |
| POST | `/api/auth/logout` | Bearer | Logout stateless |
| GET | `/api/community/auth/providers` | — | Lista de proveedores sociales habilitados |
| POST | `/api/community/auth/session` | — | Exchange `session_id` → cookie httpOnly |
| GET | `/api/community/auth/me` | Cookie/Bearer | Perfil comunidad autenticado |
| POST | `/api/community/auth/logout` | Cookie/Bearer | Cierra sesión y limpia cookie |
| POST | `/api/investor-requests` | — | Envío público de solicitud |
| GET/PATCH/POST | `/api/admin/investor-requests/*` | Admin | Panel de solicitudes + invitaciones |
| POST | `/api/documents/upload` | Admin | Multipart upload (category, vertical) |
| GET | `/api/documents` | Admin/Investor | Lista (admin ve todo; investor solo vertical='investor') |
| GET | `/api/documents/{id}/download` | Admin/Investor | Descarga bytes con Content-Disposition |
| DELETE | `/api/documents/{id}` | Admin | Soft delete |

### Data Model — InvestorRequest
```
id (uuid), fullName, email, company, role, focus, country, message,
status ∈ {pending, under_review, approved, rejected},
admin_notes, submitted_at, updated_at, reviewed_by (admin id)
```

### Seguridad
- bcrypt password hashing.
- JWT (HS256) Bearer, TTL 8h.
- Brute-force lockout: 5 fallos por `(ip+email)` → 15 min bloqueo (colección `login_attempts`).
- Admin seeding idempotente en startup; refresca hash si cambia `ADMIN_PASSWORD` en `.env`.
- Índices únicos + secundarios creados en startup.

## Frontend Architecture
```
/app/frontend/src/
├── App.js                             # Router + AuthProvider
├── contexts/AuthContext.jsx           # login/logout, authFetch, token en localStorage
├── components/
│   ├── ProtectedAdminRoute.jsx        # Guard de rol admin
│   ├── Header.jsx, Footer.jsx
│   ├── HeroSection.jsx, VisionSection.jsx
│   ├── CircularCore.jsx, OrbitalEcosystem.jsx
│   ├── LatinAmericaBlock.jsx
│   ├── PeopleSection.jsx
│   ├── InvestorContactBlock.jsx
│   └── PitchDeckPreview.jsx
└── pages/
    ├── HomePage.jsx
    ├── InvestorRoomPreview.jsx
    ├── InvestorRequestPage.jsx        # POST real a /api/investor-requests
    ├── InvestorPitchDeckPage.jsx
    ├── AdminLoginPage.jsx             # Login con JWT
    └── AdminDashboardPage.jsx         # Stats orbitales + tabla + drawer detalle
```

## Implementado
### FASE 0 — Landing público (2026-01/02)
- ✅ Landing 8 bloques con diseño circular/orbital.
- ✅ Mapa interactivo 18 países LatAm.
- ✅ Lenis smooth scroll + Framer Motion.
- ✅ Investor Room preview (UI mockup).
- ✅ Investor Pitch Deck 12 slides conectado.
- ✅ Fotografía editorial (Unsplash).

### FASE 1 — Backend foundation Investor Room (2026-02)
- ✅ Autenticación admin JWT + bcrypt.
- ✅ Persistencia real de solicitudes en MongoDB.
- ✅ Panel admin (`/admin`): stats orbitales, tabla, filtros por estado, búsqueda case-insensitive, drawer de detalle con actualización de estado + notas internas.
- ✅ Brute-force lockout.
- ✅ Formulario público `/request-access` conectado al backend.
- ✅ **Testing agent: 33/33 backend tests passing (100%)**.

### FASE 5 — Investor Portal privado + motor de simulación 36m (2026-02)
**Parte A · Simulador ejecutable en `/capital-strategy`**
- ✅ Motor `runProjection()` que corre 36 meses con:
  - Multiplicadores por escenario (Conservador · Base · Acelerado) — revenue × {0.6, 1.0, 1.5}, opex × {1.1, 1.0, 1.15}, growth {3%, 6%, 10%}/mes.
  - Capital distribuido en tranches (60% m1, 30% m4, 10% m7).
  - Crecimiento compuesto de revenue y opex.
- ✅ Botón dorado **"Ejecutar proyección 36m"** dentro del Cash Flow con switcher de escenarios.
- ✅ Output: 6 KPIs (escenario, balance final, break-even mes, runway meses, revenue 36m, opex 36m), chart SVG del balance mensual + tabla desplegable de 36 filas.
- ✅ Persistencia del resultado en localStorage.

**Parte B · Investor Portal privado con rol `investor`**
- ✅ **Backend** (extensiones a `models.py` + `investor_routes.py`):
  - `POST /api/admin/investor-requests/{id}/invite` — genera usuario investor + token único (secrets.token_urlsafe(32)) + expira en 168h. Idempotente: reutiliza usuario existente si aplica. Marca solicitud como `approved` y liga `investor_user_id`.
  - `POST /api/auth/accept-invitation` — público, consume el token, setea password (bcrypt), remueve el token de la BD.
  - `GET /api/investor/room` — protegido (rol=investor), devuelve catálogo curado + registra `room_visit` en access log.
  - `POST /api/investor/access-log` — protegido, registra visita/descarga por documento.
  - `GET /api/admin/investors` — lista de investors invitados con contadores (total/activos/pendientes).
  - `GET /api/admin/access-log` — auditoría de accesos (filtrable por user_id).
  - Nueva colección `investor_access_log` con índices en `user_id`, `created_at`.
  - Índice parcial único en `users.invitation_token`.
- ✅ **Frontend**:
  - `/investor/setup?token=...` — página de activación con setup de contraseña + auto-login → auto-redirect al portal.
  - `/investor-portal` — protegido con `ProtectedInvestorRoute`; hero personalizado con nombre del inversionista, badge "INVESTOR ROOM" en oro, catálogo curado de 5 recursos (Executive Summary · Pitch Deck 12 slides · Pitch Deck PDF · Capital Strategy · Punto Cero Legal), cada uno registra access log al hacer clic.
  - **Botón "Generar invitación"** añadido en el drawer de admin → muestra URL copiable y link "Abrir" con expiración visible.
  - `AdminLoginPage` ahora rutea correctamente por rol (admin→/admin, investor→/investor-portal).
- ✅ **Testing**: 14 flujos backend verificados con curl (login → request → invite → accept → login investor → portal → access log → role isolation 403). E2E frontend verificado con screenshots (admin → invita → setup → auto-login → portal con 5 recursos visibles).

### FASE 4 — Capital Strategy · Projection · Cash Flow · Feasibility (2026-02)
- ✅ Ruta unificada `/capital-strategy` con **15 secciones** en una sola experiencia:
  1. Hero (órbitas expansivas, título gradient)
  2. Contexto estratégico + cadena de valor 6-pasos
  3. Flujo de capital (10 estados encadenados)
  4. Tres escenarios de capital (Mínimo · Validación · Aceleración) con tabs y tarjetas
  5. Uso del capital — editor interactivo con 8 categorías (%, cálculo de $ en vivo, aviso si ≠ 100%)
  6. Marco de proyección 36m (3 fases · 7 métricas · todas marcadas "POR VALIDAR")
  7. Revenue Model editable (Clientes · ARPU · Growth → cálculo MRR/ARR)
  8. OpEx Model editable (11 categorías → cálculo mensual, anual, 36m, burn)
  9. Cash Flow Simulator con datos actuales/supuestos/proyectados/escenarios etiquetados
  10. Tres escenarios financieros (Conservador · Base · Acelerado) con switcher animado
  11. 11 KPIs preparados con "PENDIENTE"
  12. Feasibility Study en 5 dimensiones (Técnica · Comercial · Financiera · Operativa · Expansión)
  13. Milestones (8 etapas conectadas por línea gradient · etapa actual en emerald)
  14. Readiness Summary (7 cards honestas)
  15. Disclaimer institucional
- ✅ **Nav investor-center unificado**: `InvestorCenterNav` con tabs Executive Summary · Pitch Deck · Capital Strategy (tab activo en gold) + back home + link externo a Punto Cero Legal.
- ✅ **Persistencia**: valores editados en localStorage (capital total, allocation %, revenue/opex/cash-flow inputs, escenario activo) — sólo primitivos, nunca componentes React.
- ✅ **Cero invención de datos**: todos los campos numéricos por defecto muestran "Pendiente"; etiquetas DATO REAL / SUPUESTO / PROYECCIÓN / ESCENARIO distinguen naturaleza de cada valor.
- ✅ Cross-links: CTA "Capital Strategy" añadido en PitchDeckPreview (home) y en el FinalCTA de Executive Summary.
- ✅ **Testing agent: 100% frontend flows passing (0 issues)**. Regresión de rutas anteriores intacta.

### FASE 3 — Investor Pitch Deck avanzado (2026-02)
- ✅ **Descarga PDF institucional** (`GET /api/pitch-deck/download`, público) — generado en tiempo real con reportlab, 58KB, 13 páginas (12 slides + cierre), paleta navy/emerald/gold, órbitas decorativas, footer branded. Botón dorado "Descargar PDF" en el nav del deck.
- ✅ **Analytics por slide** — hook `usePitchDeckAnalytics()` con IntersectionObserver (threshold 0.35) mide dwell time por slide y hace beacon POST a `/api/pitch-deck/events` al salir del viewport (mínimo 400ms). Session ID persistente en `sessionStorage`.
- ✅ **Endpoints**:
  - Público: `POST /api/pitch-deck/events`, `GET /api/pitch-deck/download`
  - Admin: `GET /api/admin/pitch-deck/analytics` (views · sesiones únicas · dwell medio por slide), `GET /api/admin/pitch-deck/downloads`
- ✅ **Panel admin extendido**: `PitchDeckAnalyticsPanel` con 4 KPI orbes (Eventos totales, Sesiones únicas, Tiempo total, Descargas PDF) + tabla per-slide con barra emerald→gold proporcional al máximo.
- ✅ Nuevos índices Mongo: `pitch_deck_events.session_id`, `.slide_number`, `.created_at`.
- ✅ **Testing agent: 59/59 backend (100%, 14 nuevos + 45 regresión) + 5/5 frontend flows (100%)**.

### FASE 2 — Executive Summary Experience (2026-02)
- ✅ Ruta `/executive-summary` — experiencia cinematográfica de 13 secciones en scroll único.
  1. Hero (dark, órbitas expansivas, gradient PUNTO CERO SYSTEM)
  2. Origen (Punto Fijo, Falcón, filosofía de transformación, timeline radial)
  3. Problema (América Latina fragmentada, animación fragmentación→conexión)
  4. Oportunidad (18 países como visión de expansión, sin claim de operación actual)
  5. Visión (Esto no es una aplicación. Es una plataforma. — jerarquía en pills apiladas)
  6. Shared Technology Core (9 capacidades + diagrama de arquitectura + 3 columnas de claridad)
  7. Punto Cero Legal (LIVE en producción — primer vertical comercial + CTA externo)
  8. Ecosistema (15 verticales en órbita, Legal='LIVE', resto='Visión futura')
  9. Comunidad (tecnología + personas + conocimiento + oportunidades)
  10. Etapa Actual (transparencia institucional, sin inventar tracción)
  11. Próxima Etapa (flujo horizontal + capital habilitante)
  12. Visión Largo Plazo (cadena de 9 pasos hacia el ecosistema LatAm)
  13. Conversación Estratégica (form con contactType + source)
- ✅ Backend: modelo `InvestorRequest` extendido con `contactType` (Literal 7 tipos) + `source`.
- ✅ Admin dashboard muestra `Tipo de contacto` y `Origen del envío` localizados en el drawer.
- ✅ CTA "Executive Summary" añadido en el home (PitchDeckPreview).
- ✅ Side dot nav + top progress bar + IntersectionObserver para navegación activa.
- ✅ **Testing agent: 45/45 backend (100%) + 13/13 frontend flows (100%)**.

## Roadmap / Backlog

### P1 — FASE 6: Investor Room documental (Object Storage)
- Repositorio de documentos privados con Emergent Object Storage (Pitch Deck PDF versionado, modelo financiero .xlsx, feasibility .pdf, roadmap, KPIs, arquitectura técnica, corporate docs).
- Upload/preview/download desde `/admin` con permisos granulares por documento.
- Audit log extendido: descargas de archivos con path + tamaño.

### P2
- Notificaciones email cuando se genera una invitación (Resend playbook).
- Persistencia opcional de inputs financieros de FASE 4 en backend para versionar supuestos.
- Panel admin: lista completa de investors con re-generación de invitación / revocación.
- Panel admin: vista rica del access log con filtros por usuario/fecha/recurso.
- Refresh-token flow + rotación.
- CORS explícito (hoy `*`).

### P2 — Investor Room privado (autenticado)
- Rol `investor` diferenciado de `admin`.
- Flujo "solicitud aprobada → invitación → creación de usuario investor".
- Repositorio de documentos privados (Emergent Object Storage vía integration playbook).
- Permisos granulares por documento/carpeta.
- Historial de accesos y descargas.

### P2 — Notificaciones
- Email al submitter cuando cambia el estado (Resend playbook).
- Notificación al admin de nueva solicitud.

### P3
- Localización EN/PT del panel admin.
- Exportación CSV de solicitudes.
- Migrar a FastAPI lifespan API (deprecar `@app.on_event`).
- Refresh-token flow + panel multi-admin.
- Audit log de cambios administrativos.
- CORS explícito (hoy `*`).

## Integraciones actuales
- MongoDB (motor) — persistencia.
- Unsplash — imágenes públicas.
- WhatsApp deep link — contacto directo.

## Notas Técnicas Críticas
- **Directiva de usuario**: "Ejecutar directamente, sin preguntas adicionales."
- **No inventar datos** de inversionistas, tracción, financieros, clientes ni KPIs.
- **Diseño**: círculos, órbitas, whitespace generoso, sin cards SaaS cuadradas.
- **Enlaces externos**: `puntocerolegal.com` siempre externo.
- Todo texto UI en español.

## Narrativa Estratégica (2026-02 · Reposicionamiento)
- **Punto Cero Legal**: nunca "80% desarrollado", "en construcción" o "por completar". Siempre **"LIVE en producción"**, **"primer vertical comercial LIVE"** del ecosistema.
- **Ask de capital**: no financia la finalización de un producto — financia **crecimiento comercial, validación de mercado y expansión del ecosistema**.
- **Milestones**: 1) Technology Foundation ✓ · 2) Legal LIVE ✓ · 3) Commercial Traction (current) · 4) First Paying Customers · 5) Commercial Validation · 6) Recurring Revenue · 7) Expansion · 8) New Vertical.
- **Aplicado en**: `CapitalStrategyPage.jsx`, `ExecutiveSummaryPage.jsx` (§7 + §9), `InvestorPitchDeckPage.jsx` (slide 05 + slide de etapa actual), `pdf_service.py` (slides 05, 08, 09, 11), `investor_routes.py` (DOCUMENT_CATALOG), homepage `PuntoCeroLegalSection.jsx` (ya mostraba LIVE).

## Changelog reciente
- **2026-02 · Punto Cero One refinamiento (iteration_8 · 100% pass)**: Rediseño total del Slider Principal — nuevo `PrimarySlides.jsx` con 6 slides handcrafted (Slide1Community, Slide2Vision, Slide3Ecosystem, Slide4Legal, Slide5Latam, Slide6Evolution), fondos limpios sin gutters negros, autoplay 12s con pausa on hover, indicadores con progress bar. Nuevo módulo `Widgets.jsx` con 10 widgets pequeños (WeatherWidget, MarketsWidget, AIOfTheDayWidget, PollWidget, CalendarWidget, PodcastWidget, CoursesWidget, LaunchesWidget, MarketplaceWidget, CompaniesShoutout) + `InlineWidgetStrip` que rellena espacios muertos entre feed items + `ComingSoon` placeholder elegante. Nueva página `/join` con auth social simple (Google, LinkedIn, Facebook, Apple, Microsoft) + email fallback, mensaje de perfil auto-creado sin formularios largos. LeftSidebar y RightWidgets extendidos con los widgets nuevos y removido sticky para llenar toda la columna con contenido dinámico. SlideCarousel keyboard scoping fix (arrow keys sólo actúan sobre el carousel hovered).
- **2026-02 · Punto Cero One transformation (Fase 2+3+4)**: Community platform LinkedIn-style · SlideCarousel · BrandMark · AppIcon family de 18 iconos · CommunityLayout · CapitalHubPage · Design System documentado.
- **2026-02 · Responsive audit**: overflow-x: clip global, media queries defensivas, 100% pass en 10 breakpoints.
- **2026-02 · Founding Team Integration**: Darwin & Jonathan en homepage + Executive Summary §09 + Pitch Deck slide 11.
- **2026-02 · Narrative Overhaul**: reposicionamiento completo de Punto Cero Legal a "LIVE en producción".

- **2026-07 · Task 1 · Community Google Auth (iteration_10 · 100% pass)**: New `/api/community/auth/*` cookie-based flow using Emergent-managed Google OAuth. Provider abstraction (`services/community_auth.py`) ready for Microsoft, LinkedIn, Apple, Facebook (UI shows "PRONTO" badge for each). Unified `users` collection with `auth_providers[]` array. Header shows profile menu + logout when authed; "Unirse" CTA otherwise. LeftSidebar reflects real user name/avatar. AuthCallback exchanges `#session_id=…` server-side. No hardcoded redirect URLs — portable to VS Code / any host.
- **2026-07 · Task 2 · Visual layer complete with mock data (iteration_11)**: 7 new content verticals `/noticias`, `/videos`, `/empleos`, `/empresas`, `/eventos`, `/ia`, `/comunidad` + `/perfil` (auth-gated). Shared `services/mockData.js` with API-shaped functions for drop-in real-API swap later. Reusable `CategoryPage` layout preserving 3-column community shell. Header nav switched to `<Link>` with active-route highlight.
- **2026-07 · Task 3 · Object Storage repository (iteration_11 · 100% pass)**: Pluggable `services/object_storage.py` with `LocalObjectStorage` (default; writes to `/app/data/uploads`) and `EmergentObjectStorage` (opt-in via env). New `/api/documents/*` endpoints (upload, list, download, soft-delete) with role-based access (admin sees all; investor sees vertical='investor'). New `/admin/documents` UI + Investor Portal renders `portal-documents-section` for uploaded assets. 10/10 backend pytest tests pass. Reusable across future verticals (Legal, Medicina, Contabilidad, Educación).

- **2026-07 · Wave 1 GO LIVE — Feed + Categories + Docs counters (iteration_12 · 23/23 pytest pass)**:
  - **Feed backend real** en MongoDB (`posts`, `post_comments`, `post_reactions`, `post_saves`, `post_shares`, `post_views`, `post_reports`, `hashtags`). Endpoints `/api/feed/*` con posts, reactions toggle multi-kind (5 tipos), comments, saves toggle, shares con destino, view dedupe por session, hashtags parseados automáticamente, trending 7-day rolling, cursor pagination, moderación admin, reportes anónimos.
  - **Sistema de categorías dinámicas**: colección `categories` con seed idempotente de 13 verticales + 6 países. API `/api/categories` público read + admin CRUD. Frontend fetch al iniciar → chips se renderizan sin cambios de código al agregar nuevas categorías.
  - **HomePage feed real**: `LiveFeed.jsx` + `FeedPostCard.jsx` reemplazan los mocks. Composer bloqueado para anónimos con CTA a `/join`. Autenticados publican, reaccionan, comentan, guardan, comparten. Chips filtran por `category_key`. Right widget "Tendencias" LIVE vía `/api/feed/trending`.
  - **Documents counters + signed download**: `download_count`, `view_count`, `last_download_at` por documento. `POST /api/documents/{id}/download-link` genera URL corta one-shot (TTL 15 min); `GET /api/documents/signed/{token}` descarga sin auth y consume el token (410 en reuse/expiración).
  - Todo el código sigue siendo 100% portable (VS Code / cualquier host). Sin dependencias exclusivas de Emergent. Suite pytest en `/app/backend/tests/test_feed_categories.py`.

## Wave 2 — Backlog priorizado (siguiente iteración)
- **Empresas**: modelo `companies` (perfil, logo via object_storage, servicios, publish, owner=user_id). Endpoints `/api/companies/*` + edición de perfil + integración en `/empresas`.
- **Empleos**: modelo `jobs` (creado por empresa, aplicaciones, estado). Endpoints `/api/jobs/*` + `/api/jobs/{id}/applications` + panel de empresa.
- **Eventos**: modelo `events` (registro, asistentes, RSVP, virtual/presencial). Endpoints `/api/events/*` + `/api/events/{id}/rsvp` + calendario visual.

## Wave 3 — Integraciones externas
- YouTube (embeds + last N videos) · RSS proxy (LegalTech/IA/Startups/Tech) · OpenWeather (clima por ciudad) · CoinGecko (BTC + altcoins) · FX USD/COP (Alpha Vantage o fuente free) · Google Calendar (embeds) · Google Maps (ubicación de eventos).
- Arquitectura: cada integración es un módulo bajo `services/integrations/*` activable via env; endpoints públicos cacheados en `/api/integrations/{provider}`.

## Wave 4 — Admin unificado + Multi-provider Auth (fase 2)
- Panel admin único (Usuarios, Empresas, Publicaciones, Eventos, Empleos, Noticias, Videos, Investor Center, Documentos, Integraciones).
- Activar Microsoft/LinkedIn/Apple/Facebook (arquitectura ya lista en `services/community_auth.py`).

- **2026-07 · Wave 2 GO LIVE — Core Social & Business Platform (iteration_13 · 35/35 pytest pass)**:
  - **Empresas (P1)**: modelo genérico multi-tenant + endpoints `/api/companies/*` (create, list con filtros, get by id/slug, patch, delete, follow toggle, admin verification). Reusable por CUALQUIER vertical (Legal, Salud, Contabilidad, Turismo, Seguros, IA). Cada empresa tiene logo/banner/servicios/team/vertical/país/ciudad/redes.
  - **Empleos (P2)**: `/api/jobs/*` cuelgan de una company. Solo owner/team pueden publicar. Aplicaciones con cover letter + CV (referencia a documents), estados (submitted→hired), panel de aplicaciones para la empresa, `/api/me/applications` para candidatos. Guardar empleo toggle.
  - **Eventos (P3)**: `/api/events/*` presencial/virtual/híbrido. RSVP toggle-and-switch (going/interested/cancelled) con contadores atómicos. Lista de asistentes solo para organizadores.
  - **Perfiles Profesionales (P10)**: `/api/community/users/me` GET/PATCH extendido con headline, bio, país, ciudad, cargo, empresa, skills, especialidades, verticales, idiomas, portafolio, redes sociales, experiencia, certificaciones. `/api/community/users/{id}` público.
  - **Analytics core (P5)**: `services/analytics.py:record_event` centralizado (cada endpoint que crea/actúa lo dispara). Colecciones `analytics_events` + `analytics_counters` (por día, por vertical, por país). `/api/analytics/summary` (admin) devuelve totals de 12 recursos + active_users_30d + signups_by_country. `/api/analytics/timeseries?name=X&days=N`.
  - **Feed Infinite Scroll**: reemplazado el botón "Cargar más" por IntersectionObserver + skeleton loaders + rootMargin de 400px. Composer bloqueado (`feed-composer-locked`) para anónimos. Autenticados publican con optimistic UI. Todo en `LiveFeed.jsx`.
  - **Portabilidad**: cero dependencias exclusivas de Emergent. Todo compatible con MongoDB Atlas + Vercel + Render + GitHub. Suite pytest reproducible.

## Wave 3 — Backlog priorizado (siguiente iteración)
- SSO Platform Login (`/api/platform/auth/*`) compartido entre One / Legal / Health / etc.
- Push (web push) via service worker + notification.channels.push=true
- Real-time typing indicators + salas colaborativas (fase 2)
- Trending y "Para Ti" con embeddings + learn-to-rank cuando haya volumen
- YouTube + OpenWeather con API keys reales
- Atlas Search / Meilisearch swap para el search engine cuando escale


- **2026-07 · Wave 3 GO LIVE — Ecosystem Live (iteration_15 · 36/36 pytest pass, 5 bloques ejecutados estrictamente por prioridad con test tras cada bloque)**:

  ### P0 · Real-Time SSE Architecture
  - `services/realtime.py`: RealtimeBroker in-process con asyncio.Queue por tab, presencia ONLINE/AWAY/OFFLINE por timestamps, portable (no depende de Redis, listo para swap).
  - `routes/realtime_routes.py`: `/api/realtime/stream` (SSE con X-Accel-Buffering:no, keep-alive comments cada 20s), `/heartbeat`, `/presence?ids=`, `/stats`.
  - Hooks en `services/notifications.dispatch()` y `messaging_routes.send_message` → `emit_notification` / `emit_message`. Soft-fail garantizado (write en DB nunca se rompe por realtime).
  - Frontend `RealtimeContext.jsx`: EventSource con reconexión exponencial, `subscribe(eventType, fn)` API, presencia via fetch.
  - `NotificationsBell` sin polling — vive del SSE. `MessagesPage` recibe mensajes en vivo con `messages-realtime-status` indicator.

  ### P1 · External Integrations desacopladas
  - `services/integrations/{base,crypto,weather,fx,rss,youtube}.py` — cada provider retorna un `WidgetResponse{status, source, data, updated_at, error?}`.
  - Estados garantizados: ACTIVE / MOCK / CONFIG_PENDING / ERROR. Cache Mongo (`widget_cache`) con TTL index (5-15 min según provider) + snapshot in-memory para CoinGecko (evita 429 del free tier).
  - `routes/widget_routes.py`: `/api/widgets/{crypto,weather,fx,rss,youtube,all}`.
  - Activo hoy: CoinGecko free (BTC/ETH), FX USD/COP/MXN/ARS/CLP (open.er-api), RSS BBC Mundo (config vía `RSS_FEEDS` JSON env).
  - Config-pending: OpenWeather (`OPENWEATHER_API_KEY`), YouTube (`YOUTUBE_API_KEY`, `YOUTUBE_DEFAULT_CHANNEL_ID`). Devuelven mock coherente.
  - Frontend `LiveWidgets.jsx` con `StatusBadge` (LIVE/DEMO/CONFIG/ERROR) integrado en el sidebar.

  ### P1 · Company Media
  - Extendido `models_business.py` con `cover_url` + `gallery: [str]`.
  - `routes/company_media_routes.py`: `PUT /api/companies/{id}/media/{slot}` (slot ∈ logo|banner|cover), `POST/DELETE /gallery`, `GET /media/{path}` público (con guard de namespace).
  - Whitelist MIME (png/jpeg/webp/gif/svg), max 10MB (`MAX_COMPANY_MEDIA_BYTES`), max 20 items galería (`MAX_COMPANY_GALLERY_ITEMS`).
  - Reutiliza `services/object_storage` — funciona con backend local o Emergent-managed sin cambios.

  ### P1 · Email (Emergent-managed Resend, arquitectura desacoplada)
  - `services/email.py`: `EmailProvider` singleton con estado ACTIVE/CONFIG_PENDING/DISABLED/FAILED, jinja-lite HTML template inline, helpers `send_welcome`, `send_invitation`, `send_password_reset`, `send_confirmation`.
  - `routes/email_routes.py`: `/api/email/status` (público) + `/api/admin/email/test` (admin JWT).
  - Hooks activos: welcome en creación de user vía `_upsert_user_from_identity`; invitation email en `/api/admin/investor-requests/{id}/invite`.
  - Preparado (no hookeado aún): mentions, digest, activity summaries — la infraestructura ya soporta cualquier trigger, solo requiere llamar `send_confirmation`.
  - Sin `EMERGENT_EMAIL_KEY` → todo funciona en modo "dry-run" retornando ok=true con status=CONFIG_PENDING. Nada rompe.

  ### P2 · "Para Ti" Feed — Recommendation Engine
  - `services/feed_engine/{base,providers,engine}.py`: 6 providers componibles (Follow, Category, Hashtag, Interaction, Recency, Trending) con scoring numérico + reasons humanas.
  - Signals cargadas UNA VEZ por request desde: `company_follows`, `verticals`/`interests` del perfil, reacciones/saves/comments últimos 90 días (author affinity + hashtag affinity).
  - `GET /api/feed/for-you` retorna `{items[with for_you.score, for_you.reasons], mode, signals_summary}`. Estados: CHRONOLOGICAL / FOLLOW_BASED / TRENDING / AI_RECOMMENDED (futuro).
  - Frontend `LiveFeed` con toggle "Últimos / Para Ti" + `ModeBadge` que revela el modo activo.
  - Anónimos degradan graciosamente a CHRONOLOGICAL (misma UX que /api/feed/posts).

  ### Env vars nuevos (todos opcionales, defaults sanos):
  - `RSS_FEEDS='{"noticias":"...","tecnologia":"..."}'` (JSON string map)
  - `OPENWEATHER_API_KEY`, `YOUTUBE_API_KEY`, `YOUTUBE_DEFAULT_CHANNEL_ID`
  - `EMAIL_ENABLED`, `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`
  - `REALTIME_AWAY_AFTER_SECONDS`, `REALTIME_OFFLINE_AFTER_SECONDS`, `REALTIME_KEEPALIVE_SECONDS`
  - `MAX_COMPANY_MEDIA_BYTES`, `MAX_COMPANY_GALLERY_ITEMS`

  ### Testing:
  - `/app/backend/tests/test_wave3_realtime.py` (7 pass) — SSE stream, presencia, fan-out end-to-end
  - `/app/backend/tests/test_wave3_integrations.py` (13 pass) — shape, ACTIVE/CONFIG_PENDING/mock, cache
  - `/app/backend/tests/test_wave3_media.py` (6 pass) — upload, ACL, MIME whitelist, galería, path guard
  - `/app/backend/tests/test_wave3_email.py` (5 pass) — status envelope, admin guard, helpers soft-fail
  - `/app/backend/tests/test_wave3_foryou.py` (5 pass) — anon fallback, ranking correcto, signals summary
  - Frontend smoke test: `feed-tabs`, `live-widget-{crypto,fx,weather,rss,youtube}`, badges de status todos presentes.
  - **Portabilidad**: 100% portable a Render/Vercel/VS Code/MongoDB Atlas. Cero lock-in Emergent.

## Wave 4+ — Backlog priorizado
- SSO Platform (`/api/platform/auth/*`) compartido entre verticales


- **2026-07 · Wave 3.5 — Punto Cero One Experience & Branding (frontend-only, arquitectura intacta)**:

  ### Rebrand a "PUNTO CERO ONE"
  - `Footer.jsx` reescrito: 4 columnas (Plataforma / Ecosistema / Empresa / Legal), redes SOLO iconos con tooltip (Email, WhatsApp, LinkedIn, Instagram, Facebook, X, TikTok, YouTube). URLs originales preservadas.
  - Sección "Contacto" con texto eliminada; email y WhatsApp ahora son iconos.
  - "Hecho en Latinoamérica 🌎" con globe rotate + emoji bounce.
  - Columna Ecosistema: Punto Cero Legal (LIVE badge), Health/Contabilidad/Viajes/IA (PRONTO).

  ### Página institucional `/nuestra-historia`
  - Nueva `NuestraHistoriaPage.jsx`: Hero cinematográfico → 3 pillars (Historia · Visión · Misión) → **FoundersSection reutilizado** (Darwin Gómez + Jonathan Cetina, sin cambios) → Cronología 2023-2027 con línea vertical animada → Valores (6 cards oscuros) → Roadmap Q3'26 → Q2'27.
  - **Botón premium "Nuestra Historia"** en LeftSidebar con eyebrow "CONOCE PUNTO CERO", gradient navy→violet→purple, ring emerald, glow dorado. Se lee tan importante como Investor Room / Capital.
  - **FoundersSection removida del feed** (antes iba embebida como slider secundario debajo del composer — rompía el flujo del feed).

  ### Slider principal renovado
  - Slide 1 "Una comunidad. Un ecosistema" → imagen de personas felices en comunidad.
  - Slide 2 "De un punto a un ecosistema" → imagen satelital **Punto Fijo, Falcón, Venezuela** que subió el usuario.
  - Slide 4 "Punto Cero Legal LIVE" → SIN logo verde. Card premium con `puntocerolegal.com` + badge animado "LIVE EN PRODUCCIÓN" con pulse.
  - Slide 5 "Latam" → **mapa interactivo con 20 países**, hover glow, tooltip dinámico "MÉXICO · MARKETPLACE PRÓXIMAMENTE" y colores per-country.
  - Slide 6 nuevo: **CTA "Únete al ecosistema"** con 5 beneficios en pills + gradient rainbow en "ecosistema".

  ### Páginas legales
  - `/legal/privacidad` — Política de Privacidad (7 secciones)
  - `/legal/cookies` — Política de Cookies (4 secciones)
  - `/legal/terminos` — Términos y Condiciones (7 secciones)
  - `/legal/acuerdo-profesional` — Acuerdo Profesional (6 secciones)
  - Layout compartido en `LegalPages.jsx` con hero navy → card blanca + CTA a soporte.

  ### Explicabilidad del "Para Ti"
  - Cada `FeedPostCard` muestra chip "Porque {reason}" (data-testid `feed-post-why-{id}`) usando `post.for_you.reasons` del backend. Tooltip nativo con todas las razones.

  ### Archivos tocados (solo frontend)
  - Nuevos: `pages/NuestraHistoriaPage.jsx`, `pages/LegalPages.jsx`
  - Reescritos: `components/Footer.jsx`
  - Modificados: `App.js` (6 rutas nuevas), `pages/HomePage.jsx`, `components/community/LeftSidebar.jsx`, `components/PrimarySlides.jsx`, `components/community/FeedPostCard.jsx`
  - **CERO cambios a backend**, APIs, autenticación, modelos, real-time, multi-tenant. 36/36 tests Wave 3 siguen pasando.


- **2026-07 · Wave 3.6 — Experience Polish & Social Ecosystem (frontend-only)**:

  ### P0 · Company Media Upload UI
  - `components/business/CompanyMediaManager.jsx`: drag-and-drop premium para logo (crop `contain`), banner (16:6), cover (16:9) y galería (hasta 20 imágenes).
  - Progress bar animado con `XMLHttpRequest.upload.onprogress`, validación MIME + tamaño en cliente, error inline, reemplazar/eliminar por slot.
  - Integrado en `CompaniesPage.jsx` con botón "Editar media" (solo dueño/admin) que abre `MediaEditModal` — full backdrop, cierre con click fuera, refetch automático del company doc tras cada mutación.
  - Usa 100% los endpoints Wave 3 (`PUT /api/companies/{id}/media/{slot}`, `POST/DELETE /gallery`, `GET /media/{path}`).

  ### P0 · News Experience
  - `NewsPage.jsx` reescrito en estilo Google Discover / Microsoft Start: hero card grande + grid magazine (auto-fill 320px), category chips, timestamps humanizados, botones Guardar/Compartir/Leer más.
  - Feed picker (`Todo` / `Tecnología`) sobre `/api/widgets/rss?feed_key=`. Fallback graceful cuando el feed viene vacío.
  - Skeleton loaders animados, imágenes hero de `picsum.photos` como fallback cuando el RSS no trae imagen.
  - `stripHtml()` + `formatTime()` helpers locales.

  ### P0 · Marketplace por País
  - `MarketplacePage.jsx` nueva ruta `/marketplace/:code` con 20 países registrados (name, flag emoji, tone, apiCountry). Fallback 404-friendly si el código no existe.
  - Hero con bandera enorme + gradient teñido por país + 4 tabs (`Empresas · Profesionales · Vacantes · Eventos`) con contadores.
  - Contenido cargado en paralelo desde `/api/companies?country=`, `/api/jobs?country=`, `/api/events?country=` (endpoints ya existentes). Cards con hover (`y: -3` + shadow) y placeholder image por país.
  - Empty state con cohete cuando no hay contenido; skeleton grid mientras carga.
  - **Mapa interactivo de Slide 5 ahora enlaza** a `/marketplace/{code}` (cambié `motion.button` a `motion.a href`). El tooltip pasó de "MARKETPLACE PRÓXIMAMENTE" a "ABRIR MARKETPLACE →".

  ### P1 · Presence Avatars
  - `components/community/PresenceDot.jsx`: hook `useRealtime().presenceOf([userId])` para primar el estado, dot con colores ONLINE emerald / AWAY amber / OFFLINE gray, glow ring solo cuando ONLINE.
  - Integrado en:
    - `FeedPostCard.jsx` (junto al avatar del autor)
    - `RightWidgets.jsx > SuggestedPeople` (junto a cada persona sugerida)
  - Preparado para inyectar en comments y messages en la siguiente iteración con solo `<PresenceDot userId={x} />`.

  ### P1 · Feed más social
  - `FeedPostMenu` (dropdown) añadido en cada `FeedPostCard` con: Copiar enlace (con feedback "¡Enlace copiado!"), Compartir, Guardar/Quitar, Ver empresa, Seguir autor, Reportar.
  - Auto-cierre al click fuera. Estilos hover on-brand. Solo Reportar/Seguir/Guardar visibles si el user está autenticado.

  ### P1 · Right Sidebar como dashboard vivo
  - `SuggestedPeople` widget nuevo en `RightWidgets.jsx`: consume `/api/feed/posts?limit=15`, dedupe por autor, muestra top 5 con avatar + presence dot + botón "+ Seguir".
  - Se conecta al SSE stream (`subscribe('notification')`) para reaccionar cuando hay actividad — las presencias se auto-refrescan.

  ### Archivos tocados (solo frontend)
  - Nuevos: `pages/MarketplacePage.jsx`, `components/business/CompanyMediaManager.jsx`, `components/community/PresenceDot.jsx`
  - Reescritos: `pages/NewsPage.jsx`
  - Modificados: `App.js` (ruta `/marketplace/:code`), `pages/CompaniesPage.jsx` (botón editar media + MediaEditModal), `components/community/FeedPostCard.jsx` (PresenceDot + FeedPostMenu dropdown), `components/community/RightWidgets.jsx` (SuggestedPeople), `components/PrimarySlides.jsx` (map buttons → anchor links a marketplace).
  - **CERO cambios a backend**. 36/36 tests Wave 3 siguen pasando.


- **2026-07 · Wave 3.7 — Social Experience Polish (frontend-only)**:

  ### P0 · Company Profile Experience (LinkedIn/Facebook style)
  - Nueva ruta `/empresas/:id` → `CompanyProfilePage.jsx`.
  - Breadcrumbs: `Inicio › Empresas › {name}`.
  - Hero banner + logo card grande (130px) con fallback a gradient + inicial.
  - Sección "Sobre nosotros" con `EditableText` — click en botón lápiz para editar inline, textarea multiline, Guardar/Cancelar con animaciones. Solo owner/admin ve el botón.
  - Sección "Media" con `CompanyMediaManager` embebido directamente (sin modal, edición 100% in-page) para owners.
  - Sección "Galería" (solo lectura) para visitantes cuando hay imágenes.
  - Sección "Enlaces" con `EditableSocials` — inputs por red (website + linkedin + instagram + facebook + twitter/x + youtube + tiktok), previews como iconos círculares con hover.
  - Sección "Ubicación" con LabelValue pairs (país, ciudad, vertical).
  - Botón Follow/Unfollow para no-owners que refetch el doc completo tras cada acción.
  - Skeleton loader mientras carga; empty-state 404 friendly.
  - Grid responsive: 2fr/1fr → 1 col en < 900px.

  ### P0 · Marketplace deep links
  - Cards del `MarketplacePage` ahora son `<motion.a>` que navegan a `/empresas/:id` y `/empleos?id=:id`.
  - Cards de `CompaniesPage` con `<Link to="/empresas/:id">` en el título de la empresa.
  - CTA "Ver" en cada card con color per-country.

  ### P0 · Messaging modernization
  - Conversaciones ahora muestran: avatar 44px con `PresenceDot`, nombre, tiempo relativo (ahora / 5 min / 2 h / ayer / fecha), preview del último mensaje con negrita si hay unread, badge rojo con contador de no leídos.
  - Header del chat: avatar del peer con presence dot grande + label ("En línea / Ausente / Desconectado") con dot inline pequeño.
  - Sin polling — todo via SSE + `RealtimeContext.presenceOf`.

  ### P1 · UserHoverCard (LinkedIn-style)
  - `UserHoverCard.jsx` con hover-in delay 350ms → fetch `/api/profiles/{id}` + fallback a datos del post → popover con foto + headline + empresa + país + follower count + 3 botones (Seguir, Mensaje, Ver perfil).
  - PresenceDot integrado. Auto-close on mouse leave con delay de 200ms para permitir hover al popover.
  - Envolviendo el nombre del autor en cada `FeedPostCard`.

  ### Archivos tocados
  - Nuevos: `pages/CompanyProfilePage.jsx`, `components/community/UserHoverCard.jsx`
  - Modificados: `App.js` (ruta `/empresas/:id`), `pages/MarketplacePage.jsx` (cards → anchor), `pages/CompaniesPage.jsx` (Link al profile), `pages/MessagesPage.jsx` (presence + tiempo relativo + preview), `components/community/FeedPostCard.jsx` (UserHoverCard sobre el nombre).
  - **CERO cambios a backend**. 36/36 tests Wave 3 siguen pasando.


- **2026-07 · Wave 4A — Social Graph & Content Integration**:

  ### Backend · Unified Social Graph (aditivo, no rompe nada existente)
  - Nueva colección `follows` con shape `{user_id, entity_type, entity_id, created_at}` + índice unique compuesto.
  - Nuevo router `/api/follows/*`:
    - `POST /:type/:id` — follow (entity_type ∈ user | company | hashtag | country | vertical | event). Idempotente. Bloquea auto-follow. Bridge automático a `company_follows` cuando el tipo es `company`, preservando 100% la lógica Wave 2.
    - `DELETE /:type/:id` — unfollow.
    - `GET /status?type=x&ids=a,b,c` — bulk check.
    - `GET /me` — todos los follows del usuario, agrupados por tipo.
    - `GET /:type/:id/count` — contador (fusiona legacy `company_follows`).
  - Normalización case-insensitive para hashtag/country/vertical (`#Legal` → `legal`, `CO` → `co`).
  - **Feed engine actualizado** — `load_user_signals()` lee `follows` y alimenta `followed_user_ids`, `followed_hashtags` (fusionados a `interaction_hashtags`), y verticales seguidos. `FollowProvider` ya boosteaba `followed_user_ids` → cero cambio en providers.

  ### Frontend · Universal Follow Button
  - `followsService.js` con API completa (follow/unfollow/bulkStatus/me/count).
  - `FollowButton.jsx` universal — cualquier `entityType + entityId`, tamaños sm/md/lg, animaciones tap/hover, spinner en busy, rollback en error.
  - Integrado en: `UserHoverCard`, `CompanyProfilePage`, `MarketplacePage` (seguir país), `HashtagPage`.

  ### Frontend · Nueva página `/h/:tag`
  - `HashtagPage.jsx` con hero navy→purple, ícono `#` en emerald, contadores, botón Follow prominent, listado de posts.

  ### Testing
  - `/app/backend/tests/test_wave4_follows.py` — 11/11 pass.
  - **Test end-to-end del Social Graph**: usuario A sigue a B → posts de B suben en `/api/feed/for-you` de A con reason "empresa/persona seguida".
  - **47/47 tests (Wave 3 + Wave 4A) pasan en regresión completa**.

  ### Archivos tocados
  - Nuevos: `backend/routes/follows_routes.py`, `backend/tests/test_wave4_follows.py`, `frontend/src/services/followsService.js`, `frontend/src/components/community/FollowButton.jsx`, `frontend/src/pages/HashtagPage.jsx`
  - Modificados: `backend/server.py`, `backend/services/feed_engine/engine.py`, `frontend/src/App.js`, `frontend/src/pages/MarketplacePage.jsx`, `frontend/src/pages/CompanyProfilePage.jsx`, `frontend/src/components/community/UserHoverCard.jsx`.


- **2026-07 · Wave 4B — Mi Espacio (Workspace personalizable)**:

  ### Filosofía
  - `Inicio` evolucionó a **Mi Espacio** — escritorio profesional del usuario. NO es una página nueva, es la misma HomePage extendida con arquitectura basada en widgets.
  - Cero duplicación: cada bloque de la UI existente (LeftSidebar + RightWidgets + LiveFeed + LiveWidgets + Widgets) ahora es addressable por ID en el **Widget Registry** (`services/workspaceRegistry.jsx`).
  - Nada se rompe: usuarios anónimos ven exactamente la misma experiencia que antes (template default cargado sin llamadas al backend).

  ### Backend
  - `routes/workspace_routes.py` — endpoints `/api/workspace/me` (GET/PUT/PATCH) y `/reset`.
  - Colección nueva `user_workspaces` con índice unique en `user_id`.
  - Persistencia total en MongoDB, cero localStorage.
  - Validación: dedupe IDs, sanitiza panels, coerce `theme` a `auto|light|dark`, garantiza layout_version.

  ### Frontend · Arquitectura
  - `services/workspaceRegistry.jsx` — catálogo canónico de ~28 widgets con id/title/category/defaultPanel/defaultOrder. Fuente única de verdad, agregar un widget = una línea.
  - `services/workspaceService.js` — cliente REST (getMine/save/patch/reset).
  - `contexts/WorkspaceContext.jsx` — estado global, autosave debounced 500ms, exponencial de helpers (toggleWidget, moveWidget, reorderPanel, resetWorkspace).
  - `components/community/workspace/WorkspacePanel.jsx` — renderer de un panel a partir de la lista de IDs, integrado con edit-mode.
  - `components/community/workspace/WorkspaceWidgetShell.jsx` — chrome de edición (colapsar / ocultar) que aparece solo cuando el usuario entra en modo edición.
  - `components/community/workspace/MobileWorkspaceDrawer.jsx` — drawer deslizante que muestra left/right panel en viewport ≤ 1200px (una única base de código, sin componentes duplicados).
  - `components/community/MobileBottomNav.jsx` — bottom navigation en < 900px, reutilizando los NAV_ITEMS del Header.
  - `pages/MiEspacioConfigPage.jsx` — sección Configuración › Mi Espacio con:
    - Vista por panel (left/center/right) con acciones subir/bajar/colapsar/ocultar/mover.
    - Catálogo por categoría (navigation, productivity, media, finance, community, capital) para agregar widgets no colocados.
    - Botón "Restaurar por defecto" que hace POST /reset.

  ### Widgets modularizados (reutilizan componentes existentes)
  - Left: ProfileCard, NuestraHistoria, Activity, Groups, QuickLinks, Weather-mini, Calendar-mini, Podcast-mini.
  - Center: WelcomeBand, Feed (LiveFeed intacto), InlineStats.
  - Right: RssLive, TrendingLive, TrendingEditorial, Events, Companies, InvestorCenter, AiTools, CryptoLive, FxLive, WeatherLive, YoutubeLive, Markets, AIOfTheDay, Poll, Launches, Courses, Marketplace, SuggestedPeople, CapitalCta.

  ### Responsive · una sola base de código
  - Desktop (≥ 1280px): 3 columnas completas.
  - Laptop (1024–1279px): 3 columnas más compactas.
  - Tablet (900–1200px): 2 columnas (left+center) + drawer para panel derecho.
  - Mobile (< 900px): 1 columna (center) + drawer para ambos paneles + bottom nav fijo.
  - MobileWorkspaceDrawer es sticky para autenticados con opción "Editar" y acceso a Config.

  ### Rutas nuevas
  - `/` → HomePage (Mi Espacio)
  - `/mi-espacio` (alias) → HomePage
  - `/mi-espacio/configuracion` → MiEspacioConfigPage
  - Header: primer nav item ahora se llama "Mi Espacio". Nuevo item en el profile dropdown: "Configuración · Mi Espacio".

  ### Testing
  - `/app/backend/tests/test_wave4_workspace.py` — 7/7 pass (auth, defaults, PUT/PATCH persistence, dedupe, reset, validation).
  - Regresión completa Wave 3 + Wave 4A + Wave 4B: 54/54 pass.
  - Build de producción (`yarn build`) exitoso, 281kB gzipped.

  ### Archivos tocados
  - Nuevos:
    - `backend/routes/workspace_routes.py`
    - `backend/tests/test_wave4_workspace.py`
    - `frontend/src/services/workspaceService.js`
    - `frontend/src/services/workspaceRegistry.jsx`
    - `frontend/src/contexts/WorkspaceContext.jsx`
    - `frontend/src/pages/MiEspacioConfigPage.jsx`
    - `frontend/src/components/community/MobileBottomNav.jsx`
    - `frontend/src/components/community/workspace/` (10 archivos: WorkspacePanel, WorkspaceWidgetShell, MobileWorkspaceDrawer, ProfileCardWidget, NuestraHistoriaWidget, ActivityWidget, GroupsWidget, QuickLinksWidget, WelcomeBandWidget, FeedWidget, TrendingWidget, TrendingEditorialWidget, EventsWidget, CompaniesWidget, InvestorCenterWidget, AiToolsWidget, SuggestedPeopleWidget, CapitalCtaWidget, blocks.jsx, rightBlocks.jsx)
  - Modificados: `backend/server.py`, `frontend/src/App.js`, `frontend/src/pages/HomePage.jsx`, `frontend/src/components/Header.jsx`, `frontend/src/components/community/CommunityLayout.jsx`.
  - **CERO cambios a los widgets subyacentes** (LiveFeed, LiveWidgets, Widgets, RightWidgets, LeftSidebar quedan intactos).


- **2026-07 · Wave 4B.1 — Mi Espacio: Mensajes + Drag & Drop + Presets**:

  ### P0 · Widget de Mensajes Directos
  - Nuevo widget `messages` en el registry, insertado como primer widget del panel derecho por defecto.
  - Reutiliza EL sistema de mensajería existente (`messagingService.listConversations`, `/api/messages/*`, `RealtimeContext` SSE `message` event).
  - Muestra: top-5 conversaciones con avatar + `PresenceDot` (online), nombre, hora relativa, preview del último mensaje, contador de no leídos individual + total.
  - Al hacer clic: navega a `/mensajes` con `state.conversationId` para auto-abrir la conversación en la pantalla existente. **CERO** interfaces nuevas de chat.
  - Se actualiza automáticamente con el SSE `message` event (mismo canal que ya usaba MessagesPage y NotificationsBell).
  - Anónimos: no se renderiza (retorna null).

  ### P1 · Drag & Drop de Widgets
  - Instalado `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` (compatible React 19).
  - `WorkspaceDndProvider.jsx` — DndContext único que engloba los tres paneles; permite drag WITHIN + BETWEEN paneles.
  - `WorkspacePanel.jsx` upgraded — cada widget es sortable con handle propio (`GripVertical`, `data-testid="drag-handle-{id}"`), panel-level droppable, activación con distance:6px (mouse) y delay:200ms (touch) para no robar clicks al widget cuando no se está editando.
  - Overlay animado durante el drag con el nombre del widget.
  - Persistencia: cada drop dispara `reorderPanel` o `moveWidget` → autosave debounced 500ms → PUT `/api/workspace/me`. **Cero localStorage**.
  - Responsive: en desktop drag con puntero, en móvil con long-press (touch sensor). Si el usuario no está en modo edición, el DndContext se salta completo (cero overhead).

  ### P1 · Presets del Ecosistema Punto Cero
  - `services/workspacePresets.js` con 7 presets EXCLUSIVOS del ecosistema Punto Cero:
    - ⚖ Punto Cero Legal · 🏥 Punto Cero Health · 📊 Punto Cero Contabilidad · 🏢 Empresa · 🚀 Fundador · 💼 Empleos · 💰 Capital.
  - Cada preset define su propia composición de widgets por panel (feed + verticales + integraciones LIVE relevantes).
  - `WorkspacePresetBar.jsx` — bar horizontal en modo edición del home con todos los presets como chips clickables (color-coded por preset).
  - Sección "PRESETS · PUNTO CERO" en `/mi-espacio/configuracion` con cards descriptivos por preset.
  - `applyPreset(id)` en `WorkspaceContext` — reemplaza los paneles preservando las preferencias por widget del usuario. Autosave persiste el cambio.

  ### Archivos tocados
  - Nuevos: `frontend/src/components/community/workspace/{MessagesWidget,WorkspaceDndProvider,WorkspacePresetBar}.jsx`, `frontend/src/services/workspacePresets.js`.
  - Modificados: `backend/routes/workspace_routes.py` (default `messages` en right), `backend/tests/test_wave4_workspace.py` (nuevo assert), `frontend/src/services/workspaceRegistry.jsx` (registro `messages`), `frontend/src/contexts/WorkspaceContext.jsx` (`applyPreset` + fallback anon con `messages`), `frontend/src/components/community/workspace/WorkspacePanel.jsx` (sortable + droppable), `frontend/src/pages/HomePage.jsx` (envuelve en DndProvider + PresetBar), `frontend/src/pages/MiEspacioConfigPage.jsx` (sección Presets), `frontend/src/pages/MessagesPage.jsx` (deep-link `state.conversationId`).
  - Dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (única librería instalada, ligera).

  ### Testing
  - `test_wave4_workspace.py` — 7/7 pass (nuevo assert: `messages` en defaults del panel derecho).
  - `yarn build` producción exitoso: 302 kB gzip (incluye dnd-kit).


- **2026-07 · Wave 4C — Growth Engine (Feed Inteligente Regional)**:

  ### Filosofía
  - El Feed nunca se ve vacío: se alimenta automáticamente con contenido público (RSS oficial) clasificado por país, vertical, ciudad, idioma.
  - NUNCA se almacena el artículo completo: solo `title`, `summary (<=400)`, `image_url`, `author`, `source`, `country`, `city`, `vertical`, `published_at`, `url`.
  - Cada item enlaza directo a la fuente original — respeto absoluto por licencias, sin scraping.

  ### Arquitectura backend (paquete `services/growth/`)
  - `sources.py` — catálogo canónico de fuentes RSS con soporte para los 18 mercados objetivo (AR, BO, BR, CL, CO, CR, CU, DO, EC, SV, GT, HN, MX, NI, PA, PY, PE, UY, VE, ES) + LATAM + GLOBAL. Cada entrada define country/vertical/language/category/enabled.
  - `providers.py` — abstracción `RSSProvider` con `fetch(source)` async + fan-out con `asyncio.Semaphore(6)`. Extensible a otros tipos (JSON API, HTML metadata) sin tocar el núcleo.
  - `normalizer.py` — RSS entry → `GrowthItem` (limpia HTML, extrae imagen de media_thumbnail / enclosure / links, calcula id estable `sha1(source::guid|link|title)`, resume a 400 chars, título a 240).
  - `classifier.py` — detección heurística: verticales por keywords, ciudad por diccionario por país, priority score determinista.
  - `aggregator.py` — orquesta fetch → normalize → upsert (idempotente por `id`). Métricas por corrida (`sources`, `ingested`, `updated`).
  - `scheduler.py` — asyncio task attach al app lifecycle. Run inmediato al startup + interval configurable (`GROWTH_INTERVAL_SECONDS`, default 30 min). Graceful shutdown.
  - `recommender.py` — ranking por país (+40) / vertical (+25) / LATAM fallback (+15) / recency 24h (+8) / language (+2) / classifier priority.

  ### Endpoints nuevos
  - `GET  /api/growth/feed` — items proyectados como Posts (renderizados por `FeedPostCard` existente). Query: `country`, `vertical`, `limit`. Resolución de país: `?country=` → usuario autenticado → `Accept-Language` / `CF-IPCountry` / `X-User-Country` → LATAM.
  - `GET  /api/growth/sources` — catálogo + estado (público, solo URLs públicas).
  - `POST /api/growth/refresh` — dispara run manual (admin).
  - `POST /api/growth/sources/{id}?enabled=bool` — toggle on/off por fuente (admin).

  ### Colecciones nuevas
  - `growth_items` — índices en `id` unique, `country+published_at`, `vertical+published_at`, `source_id`.
  - `growth_sources` — overrides on/off por deployment, índice unique en `source_id`.

  ### Integración frontend (cero pantallas nuevas)
  - `services/feedService.js` — nuevo namespace `growthService.feed({limit, country, vertical})`.
  - `components/community/LiveFeed.jsx` — carga growth en paralelo al feed, hace merge intercalando 1 growth cada 3 posts (`mergeFeedAndGrowth`), muestra chip "FEED REGIONAL · {país}" cuando el backend resolvió una región.
  - `components/community/FeedPostCard.jsx` — extendido para renderizar items growth con: badge "FUENTE PÚBLICA", avatar RSS estilizado (sin PresenceDot), imagen destacada, y footer de acciones simplificado (Leer en la fuente + Compartir). Reacciones/comentarios ocultos porque no aplican a items externos.

  ### Fuentes iniciales activas (ingesta ya funcionando)
  - Real-time en preview con 279 items ingeridos al primer run: ES (54), CO (40), GLOBAL (30), LATAM (30), BR (30), MX (30), GT (30), BO (25), CU (10), + fuentes con feed roto quedan skipped (loggeados).

  ### Tests
  - `tests/test_growth.py` — 8/8 pass: proyección Post-shape, filtro country, fallback LATAM/GLOBAL, catálogo público, admin-only refresh, normalizador robusto, recommender prioriza país.
  - `test_wave4_workspace.py` — 7/7 pass (regression).
  - `yarn build` producción: 303 kB gzip.

  ### Archivos tocados
  - Nuevos: `backend/services/growth/{__init__,sources,providers,normalizer,classifier,aggregator,scheduler,recommender}.py`, `backend/routes/growth_routes.py`, `backend/tests/test_growth.py`.
  - Modificados: `backend/server.py` (router + scheduler + índices), `frontend/src/services/feedService.js` (growthService), `frontend/src/components/community/LiveFeed.jsx` (merge + hint regional), `frontend/src/components/community/FeedPostCard.jsx` (renderer growth-aware, share sin API para growth).
  - **CERO cambios** al layout, sidebars, Mi Espacio, MessagesWidget, Header ni cualquier otro componente.


- **2026-08 · Wave 4D — Discovery Platform (Ecosistema de Entidades)**:

  ### Filosofía
  - Punto Cero One deja de verse vacío incluso sin usuarios: todo gira alrededor de ENTIDADES (empresas, orgs, universidades, comunidades, LegalTech, canales, etc.).
  - Cero pantallas nuevas · cero cambios de diseño · cero módulos duplicados.
  - Reutilizamos: `companies` collection, `/api/companies`, `/api/search`, `/api/follows`, `CompanyProfilePage.jsx`, `FollowButton`, growth engine, workspace widgets.

  ### Backend — nuevo paquete `services/discovery/`
  - `seeds.py` — catálogo curado de 30+ entidades públicas reales:
    - Big Tech (Microsoft, GitHub, OpenAI, AWS, Google Cloud, NVIDIA, Vercel, Cloudflare, Hugging Face)
    - Consumer/FMCG (Coca-Cola, PepsiCo, Nestlé, Unilever, Mondelēz)
    - LegalTech (vLex, LexisNexis, Clio, Harvey AI, Casetext)
    - Universidades (Harvard, MIT, Stanford, Universidad Nacional de Colombia, Uniandes, UNAM)
    - Consultoras (McKinsey, BCG)
    - LatAm champions (Mercado Libre, Rappi, Nubank)
    Cada entrada trae: descripción oficial, website, socials (linkedin/twitter/instagram/youtube/github/tiktok), hashtags, tags, `related_ids` para el motor de recomendaciones.
  - `seeder.py` — upsert idempotente en `companies` collection al startup con `is_public_seed: true`, `verification: verified`, logo desde `logo.clearbit.com` por dominio.
  - `resolver.py` — recolector de contenido relacionado desacoplado:
    - `related_news(entity)` → filtra `growth_items` por tags/keywords/name (reuso 100% del Growth Engine)
    - `related_repos(entity)` → GitHub REST API pública (`api.github.com/orgs/{org}/repos`, sin auth)
    - `related_videos(entity)` → YouTube channel RSS público
    - `related_jobs(entity)` → filtro sobre `jobs` collection existente
    - `related_events(entity)` → filtro sobre `events` collection existente
    - `similar_entities(entity)` → curated `related_ids` + fallback por vertical
    - `gather(entity)` → asyncio.gather() → todo en paralelo, respuesta única
  - Extensión `SocialLinks` (models_business): añadidos `github`, `tiktok`, `rss` (retro-compatible, campos opcionales).

  ### Endpoints nuevos
  - `GET /api/discovery/entity/{slug}` — ficha pública (reusa companies collection).
  - `GET /api/discovery/entity/{slug}/related` — bundle: `{ entity, news, repos, videos, jobs, events, similar, generated_at }`.
  - `GET /api/discovery/suggested?limit=N` — recomendaciones basadas en follows del usuario; fallback a seeds populares para anónimos.

  ### Extensión de contratos existentes (retro-compatible)
  - `/api/search` — extendido para matchear también por `tags` y `hashtags`. Devuelve `verified` + `is_public` flags. Ahora "LegalTech" devuelve vLex, Clio, Harvey AI, Casetext y LexisNexis (además de acme-legaltech creada por miembros).
  - `/api/companies/{slug}` — sin cambios: ya funciona porque los seeds se insertan como companies normales.
  - `/api/follows/company/{id}` — sin cambios: seguir Microsoft/Pepsi/Harvard funciona como seguir cualquier otra empresa.

  ### Frontend (cero pantallas nuevas)
  - `services/platformService.js` — `discoveryService.related(slug)` y `discoveryService.suggested(limit)`.
  - `components/business/CompanyRelated.jsx` — se renderiza dentro de `CompanyProfilePage` (columna derecha, debajo de "Ubicación"). Muestra tarjetas widget-style para: Noticias · Videos oficiales · Repositorios GitHub (estrellas/forks/lenguaje reales) · Empleos · Eventos · Entidades relacionadas.
  - `components/community/workspace/DiscoverEntitiesWidget.jsx` — nuevo widget de Mi Espacio (panel derecho, posición 45). Lista 6 entidades sugeridas con `FollowButton` inline; agregado al preset "Fundador".
  - `pages/CompanyProfilePage.jsx` — solo se agregó el import + una línea `<CompanyRelated slug={company.slug} />` y se completó el mapa `SOCIAL_ICONS` con github/tiktok/rss. **Ningún estilo modificado.**

  ### Fuentes públicas integradas
  - RSS (ya en Growth Engine) · GitHub REST API pública · YouTube channel RSS · logo.clearbit.com · No scraping, no APIs privadas, respeto absoluto por licencias.

  ### Tests
  - `tests/test_discovery.py` — 7/7 pass: seed auto, search por nombre/tag/hashtag, ficha, related bundle, suggested fallback, 404.
  - Regresión: `test_growth.py` 8/8 · `test_wave4_workspace.py` 7/7 · `test_wave4_follows.py` 11/11 = **33/33 PASS**.
  - `yarn build` producción: 305.22 kB gzip.

  ### Ejemplo end-to-end
  El usuario escribe "Microsoft" en la barra de búsqueda → `/api/search` devuelve la entidad → click abre `/empresas/microsoft` → `CompanyProfilePage` renderiza header + socials (con GitHub) + botón Seguir → `CompanyRelated` llama `/api/discovery/entity/microsoft/related` → muestra 6 repos reales (DCVC, vcpkg 27k★, markitdown 170k★, etc.) + Amazon Web Services / GitHub / Google Cloud / OpenAI como entidades relacionadas. Al seguir Microsoft, aparece en Mi Espacio y sus noticias empiezan a interlear en el feed vía Growth Engine.

  ### Archivos tocados
  - Nuevos: `backend/services/discovery/{__init__,seeds,seeder,resolver}.py`, `backend/routes/discovery_routes.py`, `backend/tests/test_discovery.py`, `frontend/src/components/business/CompanyRelated.jsx`, `frontend/src/components/community/workspace/DiscoverEntitiesWidget.jsx`.
  - Modificados: `backend/server.py` (router + seed en startup + índices), `backend/models_business.py` (SocialLinks +github/tiktok/rss), `backend/routes/search_routes.py` (match por tags/hashtags), `backend/routes/workspace_routes.py` (default incluye discover-entities), `frontend/src/services/platformService.js` (discoveryService), `frontend/src/services/workspaceRegistry.jsx` (registro), `frontend/src/services/workspacePresets.js` (fundador incluye discover), `frontend/src/contexts/WorkspaceContext.jsx` (fallback anon), `frontend/src/pages/CompanyProfilePage.jsx` (renderiza `CompanyRelated`).


- **2026-08 · Wave 5A — Centro de Fuentes del Ecosistema**:

  ### Filosofía
  - Admin puede registrar/editar/sincronizar cualquier tipo de fuente sin tocar código.
  - CRUD + sync + import/export + logs en una sola pestaña del Admin existente.
  - Cero páginas nuevas · cero cambios visuales.

  ### Backend
  - `models_source.py` — Pydantic (`SourceCreate/Update/Public`, kinds/frequency literales).
  - `services/sources_center/engine.py` — dispatcher por `kind`:
    - `rss` / `jobs_feed` / `events_feed` → RSSProvider + normalizer (reutiliza Growth Engine)
    - `youtube_channel` → RSS de canal (channel_id de URL o config)
    - `github_org` → GitHub REST público → colección `github_repos`
    - `entity_seed` → upsert idempotente en `companies` con `is_public_seed`
    - `api` → JSON API genérica con headers/params/token opcional
  - `routes/sources_admin_routes.py` — CRUD + `/toggle` + `/sync` + `/test` + `/logs` + `/import` (JSON o multipart .json/.csv) + `/export` (JSON/CSV) + `/kinds`. Todo bajo `require_admin`.
  - Colecciones nuevas: `sources` y `source_syncs` con índices.
  - `services/growth/scheduler.py` extendido: cada tick también procesa `due_sources()` → **cualquier fuente registrada en la UI empieza a sincronizarse automáticamente**.
  - Notificación cuando un sync falla (`notifications` con `kind: source_sync_failed`).

  ### Frontend
  - `pages/AdminSourcesTab.jsx` — CRUD table con filtros, modal de formulario, modal de historial, import/export, banner de feedback.
  - `pages/AdminPlatformPage.jsx` — nueva pestaña "Centro de Fuentes" (icon Radio) que renderiza `<AdminSourcesTab />`.
  - `services/coreServices.js` — `adminSourcesService` completo.

  ### Integración automática con el ecosistema
  - `entity_seed` → aparece en `/api/companies` → `CompanyProfilePage` → `/api/search` → seguible → alimenta Mi Espacio/Feed via Growth Engine.
  - `rss/jobs_feed/events_feed` → items en `growth_items` → Feed regional los intercala por país/vertical.
  - `github_org` → `github_repos` colección.
  - `youtube_channel` → items en `growth_items`.

  ### Endpoints creados (12)
  - `GET/POST/PATCH/DELETE /api/admin/sources[/{id}]`
  - `POST /api/admin/sources/{id}/toggle|sync|test`
  - `GET /api/admin/sources/{id}/logs`
  - `POST /api/admin/sources/import` (JSON o multipart)
  - `GET /api/admin/sources/export?fmt=json|csv`
  - `GET /api/admin/sources/kinds`

  ### Tests
  - `tests/test_sources_center.py` — **7/7 PASS** (auth, CRUD, sync real de BBC Mundo, kinds, bulk import, export, sync escribe growth_items).
  - Regresión: sources 7 · discovery 7 · growth 8 · workspace 7 · follows 11 = **40/40 PASS**.
  - `yarn build`: 310.24 kB gzip.

  ### Archivos tocados
  - Nuevos: `backend/models_source.py`, `backend/services/sources_center/{__init__,engine}.py`, `backend/routes/sources_admin_routes.py`, `backend/tests/test_sources_center.py`, `frontend/src/pages/AdminSourcesTab.jsx`.
  - Modificados: `backend/server.py` (router + índices), `backend/services/growth/scheduler.py` (`_process_admin_sources`), `frontend/src/services/coreServices.js` (`adminSourcesService`), `frontend/src/pages/AdminPlatformPage.jsx` (tab).
  - **CERO cambios a Mi Espacio, Feed, Follow, buscador, verticales, dashboards ni autenticación.**


---

## Wave 6 — Auth Email/Password + Profile Customization + Feed UX (01 ago 2026)

### Corrección de bugs P0 reportados por el usuario
1. **Feed sin espacios blancos**: `CommunityLayout.jsx` reescrito con `max-width: 1600px`, padding fluido `clamp(0.75rem, 2vw, 2rem)`, breakpoints 1400/1200/900/480. Feed uniforme en todas las resoluciones tipo LinkedIn/X.
2. **Infinite Scroll real** en "Para Ti": tras la primera página ranked (30 items), cae a paginación cronológica (`/api/feed/posts?cursor=...`) manteniendo el `IntersectionObserver` con `rootMargin: 400px`.
3. **Follow → refresh inmediato**:
   - `FollowButton.jsx` dispara `window.dispatchEvent(new CustomEvent('pc:follow-change', ...))` en cada toggle.
   - `CompaniesPage.jsx` también dispara el evento tras `companyService.follow`.
   - `LiveFeed.jsx` escucha el evento y (con debounce 350ms) resetea items, incrementa `refreshTick` (fuerza refetch de growth) y recarga feed. Sin recarga manual.
4. **Algoritmo mejora**: `load_user_signals` en `feed_engine/engine.py` ahora hereda `hashtags`, `tags`, `vertical` y `country` de las empresas seguidas → siguiendo Microsoft aumenta ranking de posts con esos tags/vertical.

### Auth Email/Password (P0 · LIVE)
- Coexiste con Google Auth existente sobre el mismo `users` collection y `auth_providers[]`.
- Endpoints en `routes/community_auth_routes.py`:
  - `POST /api/community/auth/register` — `{email, password, name?}` → session cookie
  - `POST /api/community/auth/login` — bcrypt verify + brute-force lockout 5 fails / 15 min (por ip+email en `login_attempts`)
  - `POST /api/community/auth/password/forgot` — genera token en `password_reset_tokens` (TTL 60min via Mongo TTL index en `expires_at`), envía email via Resend (`send_password_reset`), retorna 200 genérico (anti-enumeración)
  - `POST /api/community/auth/password/reset` — consume token, cambia password, invalida otros tokens del user, limpia lockout counter, establece sesión
- Providers UI: `providers` endpoint ahora incluye `coming_soon` = [apple, microsoft, linkedin, facebook, twitter/X] + `email_password: true`.

### Personalización de Perfil (P1)
- **Foto de perfil / Portada** — nuevo `routes/profile_media_routes.py`:
  - `PUT /api/community/users/me/media/{slot}` — slot ∈ picture | cover (multipart image)
  - `DELETE /api/community/users/me/media/{slot}` — clear
  - `GET /api/community/users/media/{path}` — public streaming
  - Storage: `services/object_storage.py` local (Emergent-managed compatible)
- **UI Preferences** en `models_profile.py` (UIPreferences submodel):
  - `theme` (light/dark/auto), `primary_color`, `secondary_color`, `accent_color`, `button_color`, `gradient`, `background_url`
  - Aplicadas globalmente vía `UIPreferencesContext` → CSS vars `--pc-primary`, `--pc-secondary`, `--pc-accent`, `--pc-button`, `--pc-gradient`, `--pc-background-url` + `data-theme` en `<html>`.
  - Autoguardado con debounce 700ms en `/api/community/users/me`.

### Frontend nuevo
- `pages/JoinPage.jsx` — completamente reescrita: tabs Social / Correo, modo login/register/forgot, campos password con toggle show, badges "PRONTO" para providers no activos, formulario Email con validación.
- `pages/ResetPasswordPage.jsx` — nueva página en `/reset-password?token=...`, form con confirm password, redirige a `/` tras éxito.
- `pages/ProfileCustomizePage.jsx` — nueva en `/perfil/personalizar`: preview banner en vivo, secciones (Foto, Portada, Tema, Colores, Gradiente, Fondo), autoguardado.
- `contexts/UIPreferencesContext.jsx` — provider global montado en `App.js`, aplica CSS vars al `<html>`.
- `services/profileService.js` — `me`, `patch`, `uploadMedia`, `deleteMedia`.
- `services/authService.js` — `registerEmail`, `loginEmail`, `forgotPassword`, `resetPassword`.
- `Header.jsx` — nuevo link "Personalizar perfil" en profile menu.

### Rutas nuevas
- `/reset-password` — `ResetPasswordPage`
- `/perfil/personalizar` — `ProfileCustomizePage`

### Colecciones nuevas
- `password_reset_tokens` — `{token, user_id, email, created_at, expires_at (TTL), used}`
- `login_attempts` — `{identifier: "ip:email", count, last_attempt, locked_until?}`

### Índices nuevos (server.py)
- `password_reset_tokens.token` (unique), `.user_id`, `.expires_at` (TTL 0s)

### Tests
- `tests/test_wave6_auth_email.py` — **3/3 PASS** (register/login flow, password reset full lifecycle, ui_preferences + profile media upload+public streaming+MIME whitelist).
- Testing agent v3 (iteration_16): **backend 100% (8/8)** + **frontend 95%** (todos data-testids presentes en /join, /reset-password, /perfil/personalizar; 1 gap ya corregido: CompaniesPage ahora dispara pc:follow-change).

### Data-testids clave
- `join-tab-social`, `join-tab-email`, `join-input-email`, `join-input-password`, `join-input-name`, `join-email-submit`, `join-goto-forgot`, `join-goto-register`, `join-goto-login`, `join-toggle-password`, `join-{google,linkedin,microsoft,apple,facebook,twitter}`, `join-{provider}-soon`
- `reset-form`, `reset-input-password`, `reset-input-confirm`, `reset-submit`, `reset-success`, `reset-error`
- `profile-customize-page`, `profile-preview-banner`, `profile-media-{picture,cover}-{upload,delete,input,preview}`, `theme-{light,dark,auto}`, `color-{primary,secondary,accent,button}`, `gradient-*`, `background-url-input`, `profile-reset-preferences`

### Env / Config
- `PASSWORD_RESET_TTL_MINUTES` (default 60) — TTL del token de reset.
- `MAX_PROFILE_MEDIA_BYTES` (default 8MB) — límite de subida.
- `PUBLIC_APP_URL` (opcional) — dominio para el link de reset. Falla a Origin/Referer si no está seteado.

### Preservación
- **CERO regresiones** en Feed engine (tests wave3_foryou 7/7 pass), Follows (11/11), Growth (8/8), Discovery (7/7), Sources (7/7), Workspace (7/7).
- Google Auth flow intacto.




