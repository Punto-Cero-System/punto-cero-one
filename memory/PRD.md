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
- **Público**
  - `/` — HomePage (8 bloques)
  - `/investor-room` — InvestorRoomPreview (arquitectura, mockup)
  - `/request-access` — Formulario público → POST `/api/investor-requests`
  - `/investor-pitch-deck` — Pitch Deck 12-slide
- **Administrativo**
  - `/admin/login` — AdminLoginPage
  - `/admin` — AdminDashboardPage (protegido, requiere rol `admin`)

## Backend Architecture
```
/app/backend/
├── server.py              # FastAPI entry, startup seeds admin + indexes
├── auth.py                # bcrypt + JWT + FastAPI dependencies
├── models.py              # Pydantic models (User, InvestorRequest, ...)
├── routes/
│   ├── auth_routes.py     # /api/auth/{login,me,logout} + brute-force
│   └── investor_routes.py # public POST + admin CRUD/workflow
└── .env                   # JWT_SECRET, ADMIN_*, MONGO_URL, DB_NAME
```

### API Endpoints
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | — | Health + DB ping |
| POST | `/api/auth/login` | — | `{email,password}` → `{access_token,user}` |
| GET | `/api/auth/me` | Bearer | Devuelve usuario autenticado |
| POST | `/api/auth/logout` | Bearer | Logout stateless |
| POST | `/api/investor-requests` | — | Envío público de solicitud |
| GET | `/api/admin/investor-requests` | Admin | Lista con `status`, `search`, `limit`, `skip` |
| GET | `/api/admin/investor-requests/stats` | Admin | KPIs por estado |
| GET | `/api/admin/investor-requests/{id}` | Admin | Detalle |
| PATCH | `/api/admin/investor-requests/{id}` | Admin | Actualizar `status`, `admin_notes` |

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
- **2026-02 · Narrative Overhaul**: reposicionamiento completo de Punto Cero Legal a "LIVE en producción". Actualizado hero stat, contexto estratégico, escenarios de capital (objetivos y milestones), evidencia de feasibility, readiness summary, 8 milestones, sección 6/7/9 de Executive Summary, slide 05 y slide 11 del pitch deck, PDF backend y descripciones del catálogo del investor room.
