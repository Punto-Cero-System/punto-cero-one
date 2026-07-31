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


