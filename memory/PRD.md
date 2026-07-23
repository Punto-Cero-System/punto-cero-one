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

## Roadmap / Backlog

### P1 — FASE 2: Investor Room privado autenticado
- Rol `investor` diferenciado de `admin`.
- Flujo "solicitud aprobada → invitación → creación de usuario investor".
- Repositorio de documentos privados (con Emergent Object Storage vía integration playbook).
- Permisos granulares por documento/carpeta.
- Historial de accesos y descargas.

### P2
- Notificaciones email al submitter cuando cambie el estado (Resend playbook).
- Audit log de cambios administrativos.
- Multi-admin: creación de administradores desde el panel.
- Refresh-token flow + rotación.
- CORS: pasar de `*` a lista explícita.

### P3
- Localización EN/PT del panel admin.
- Exportación CSV de solicitudes.
- Migrar a FastAPI lifespan API (deprecar `@app.on_event`).

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
