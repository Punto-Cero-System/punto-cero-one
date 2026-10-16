# SYSTEM_ARCHITECTURE_PLAN.md
**Fecha:** 2026-08-07
**Autor:** Arquitecto senior (auditoría estática, sin cambios en código)
**Objetivo:** Convertir el proyecto actual en un ecosistema **multi-dominio** con un backend único, sesión universal y verticales especializadas.

---

## 1. Visión

```
                          ┌───────────────────────────────────────────┐
                          │            puntocerosystem.com            │
                          │  (raíz — landing + Punto Cero One shell)  │
                          └───────────────────────────────────────────┘
                                            │
                          ┌─────────────────┼─────────────────────────┐
                          │                 │                         │
              ┌───────────▼───────┐ ┌───────▼─────────┐ ┌─────────────▼──────────┐
              │  Punto Cero One   │ │ Punto Cero      │ │  Verticales futuras    │
              │  (comunidad,      │ │ Medical         │ │  legal.puntocero...    │
              │   feed, empresas, │ │ (medicina,      │ │  commerce.puntocero... │
              │   empleos,        │ │  enfermería,    │ │  ...                   │
              │   marketplace,    │ │  odontología,   │ │                        │
              │   IA, mensajería, │ │  psicología)    │ │                        │
              │   perfil)         │ │                 │ │                        │
              └───────────────────┘ └─────────────────┘ └────────────────────────┘
                          ▲                 ▲                         ▲
                          │                 │                         │
                          └───────┐         │         ┌───────────────┘
                                  │         │         │
                          ┌───────▼─────────▼─────────▼──────────┐
                          │      Un único backend FastAPI        │
                          │  (auth · feed · users · content ·    │
                          │   media · realtime · notifications)  │
                          │           Mongo compartida           │
                          └──────────────────────────────────────┘
```

**Principio maestro:** un solo *repo*, un solo build de React, un solo backend, una sola BD. La distinción entre productos vive únicamente en 3 planos:
- **Frontend** — `SubdomainRouter` selecciona el shell (`AppOne` / `AppMedical`).
- **Datos** — nuevos campos `vertical` y `profession_key` en `users`, `posts`, `groups`.
- **Contenido** — endpoints existentes aceptan `?vertical=medical` para filtrar.

---

## 2. Frontend: SubdomainRouter

### 2.1. Comportamiento
```
window.location.hostname
├── puntocerosystem.com          → AppOne shell (rutas actuales)
├── www.puntocerosystem.com      → AppOne shell (rutas actuales)
├── medical.puntocerosystem.com  → AppMedical shell (nuevas rutas)
├── future-core-5.preview...     → AppOne (fallback dev)
└── localhost / 127.0.0.1        → AppOne (fallback dev)
```

El wrapper vive **por encima** de `<BrowserRouter>`, no lo reemplaza:

```
<BrandProvider>              // resuelve vertical + tokens
  <SubdomainRouter>
    <BrowserRouter>
      <Routes> … </Routes>   // rutas específicas del shell activo
    </BrowserRouter>
  </SubdomainRouter>
</BrandProvider>
```

`BrandProvider` expone `{ vertical, hostname, brand }` a toda la app vía `useBrand()`. Componentes compartidos (Header, Footer, colores, logos, CTAs) consultan `useBrand()` para pintarse acorde al dominio.

### 2.2. AppOne shell (dominio raíz)
- Mantiene TODAS las rutas actuales de `App.js` sin cambios.
- Añade un badge sutil “Punto Cero One” en el logo.

### 2.3. AppMedical shell (nuevo)
Rutas mínimas del shell Medical:
- `/` — landing Medical
- `/medicina` `/enfermeria` `/odontologia` `/psicologia` — perfil de cada disciplina
- `/comunidad` — reutiliza `CommunityPage` filtrado por `vertical=medical`
- `/feed` — reutiliza `IntelligentFeed` filtrado por `vertical=medical`
- `/perfil` `/mensajes` `/notificaciones` — reutilizados **sin cambios** (identidad universal)
- `/join` `/reset-password` — comparten flujos existentes (misma sesión)

**Regla:** todo lo que sea *identidad* (perfil, login, mensajería, notificaciones) se reutiliza tal cual. Sólo el contenido *editorial* (feed, comunidad, home) se segmenta por vertical.

### 2.4. Selección del shell
- Detección en `hostname` (case-insensitive, sin puertos).
- Fallback: si `hostname` desconocido → AppOne (evita 404 en dominios temporales).
- Override manual para QA: `?vertical=medical` en la URL fuerza el shell (útil en preview).

---

## 3. Login universal

### 3.1. Cookie de sesión con `Domain=.puntocerosystem.com`

Estado actual (`backend/routes/community_auth_routes.py::_cookie_flags`):
- Emite cookie sin `Domain` → sólo válida para el host emisor.
- Flags: `httponly=True`, `secure=True`, `samesite=None`.

Cambio propuesto (aditivo, retro-compatible):
- Leer nueva env var **`COOKIE_DOMAIN`**. Si está definida, agregarla al `set_cookie(...)`.
- En preview/dev: sin `COOKIE_DOMAIN` → comportamiento actual.
- En producción: `COOKIE_DOMAIN=.puntocerosystem.com` → sesión válida en todos los subdominios.

**Resultado:** un usuario que hace login en `puntocerosystem.com` queda automáticamente autenticado en `medical.puntocerosystem.com`, sin re-login, sin token exchange.

### 3.2. CORS con `credentials`
Actual: `CORS_ORIGINS="*"` — incompatible con `credentials=True`.

Cambio propuesto: whitelist explícita:
```
CORS_ORIGINS=https://puntocerosystem.com,https://www.puntocerosystem.com,https://medical.puntocerosystem.com
```
Y el middleware CORS con `allow_credentials=True`.

### 3.3. OAuth Redirect URIs
Registrar **en cada proveedor** (Google, LinkedIn, Facebook) los callback URLs por dominio:
- `https://puntocerosystem.com/api/community/auth/oauth/{provider}/callback`
- `https://medical.puntocerosystem.com/api/community/auth/oauth/{provider}/callback`

Todos apuntan al mismo backend (por CNAME o mismo A record). El proveedor devuelve al dominio de origen; el backend emite la cookie con `Domain=.puntocerosystem.com`.

### 3.4. Endpoint `/api/community/auth/me`
Ya existe. Devuelve el usuario autenticado leyendo la cookie. Ambos shells lo consumen igual.

---

## 4. Backend multi-vertical

### 4.1. Modelo `users` actual
Colección Mongo `users` (analizada en `backend/models_profile.py` + `community_auth_routes.py`):
- Identidad: `id`, `email`, `name`, `picture`, `role` (`member|admin|investor`)
- Profesional: `headline`, `bio`, `country`, `city`, `current_title`, `current_company`, `specialties`, `interests`, `portfolio_url`, `verticals: list[str]`
- Auth: `auth_providers`, `password_hash`, `email_verified`
- Métricas: `posts_count`, `followers_count`, `following_count`
- Social: objeto `social` con `linkedin`, `facebook`, `instagram`, `website`, …

### 4.2. Campos nuevos propuestos (aditivos, opcionales)

| Campo | Tipo | Default | Propósito |
|---|---|---|---|
| `tenant` | `str` | `"puntocero"` | Reservado para futuras marcas white-label |
| `vertical` | `str \| None` | `None` (⇒ implícito `one`) | En qué vertical vive el usuario: `one`, `medical`, `legal`, … |
| `profession_key` | `str \| None` | `None` | Enum cerrado dentro de una vertical: en Medical → `medicina`, `enfermeria`, `odontologia`, `psicologia`. En One → libre (`abogacia`, `contabilidad`, …). |
| `sub_specialties` | `list[str]` | `[]` | Detalle libre dentro de `profession_key` |
| `credentials` | `object` | `{}` | Datos regulatorios (matrícula, colegio, número, país emisor) — sólo Medical/Legal |
| `verified_at` | `datetime \| None` | `None` | Timestamp de verificación regulatoria |
| `verticals_joined` | `list[str]` | `[]` | Historial de verticales a las que ha accedido (para analytics) |

**Migración segura:**
- Todos los campos son **opcionales**.
- Los usuarios existentes NO se tocan. Cuando lean su perfil, faltan los campos → el servidor los devuelve como `None`/`[]`/`"puntocero"` (defaults).
- Un job idempotente `services/migrations/backfill_vertical.py` puede correr en background y marcar `vertical="one"` a todo usuario preexistente.

### 4.3. Impacto en otras colecciones

| Colección | Campo a añadir | Comportamiento |
|---|---|---|
| `posts` | `vertical`, `profession_key` | Feed puede filtrar por vertical; retro-compat: si no está, es `one`. |
| `groups` | `vertical`, `profession_key` | Grupos privados por vertical. |
| `notifications` | `vertical` | Silenciar notifs cross-vertical si el usuario opta. |
| `growth_items` (fuentes editoriales) | `verticals: list[str]` | Una noticia médica se marca como `[medical]`; una general como `[one]` o vacía (== ambas). |
| `follows` | — | No requiere cambio (grafo social es universal). |
| `messages` | — | No requiere cambio (mensajería universal). |
| `companies` | `vertical` (opcional) | Marcar empresas como *medical-focused* para el catálogo Medical. |

### 4.4. Endpoints con filtro por vertical
Todos los endpoints ya existentes reciben query param opcional `?vertical=medical`. Sin ese param, se comportan igual que hoy (retro-compat 100 %). Endpoints afectados (sin refactor, solo un `.filter()` extra):
- `GET /api/feed/posts`
- `GET /api/content-sources/mixed-feed`
- `GET /api/community/groups`
- `GET /api/companies`
- `GET /api/jobs`
- `GET /api/events`
- `GET /api/discovery/suggested`
- `GET /api/search`

El frontend inyecta el `vertical` automáticamente vía `useBrand()` → interceptor axios / fetch → añade el query param.

### 4.5. Autorización por vertical
- El endpoint `/api/community/auth/me` devuelve además `available_verticals: [ "one", "medical" ]` según qué haya declarado el usuario.
- Un usuario `one`-only puede entrar a `medical.puntocerosystem.com` pero verá un onboarding que le pide confirmar `profession_key`.
- Un admin puede navegar todas las verticales sin restricción.

---

## 5. Compatibilidad con lo que ya existe

**Cero rupturas.** Los datos existentes:
- No tienen `vertical` → se resuelve como `one` en el backend.
- No tienen `profession_key` → sigue siendo opcional.
- Sus posts, grupos, follows funcionan sin cambios.

**Cero migraciones bloqueantes.** El backfill puede correr después del deploy, sin ventana de mantenimiento.

**Cero código nuevo obligatorio en producción antes de habilitar Medical.** Las envs solas (COOKIE_DOMAIN + CORS_ORIGINS) ya permiten SSO cross-dominio con el shell actual. AppMedical se incorpora cuando el equipo de producto tenga las especificaciones.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Deploy con `COOKIE_DOMAIN` mal escrito rompe la sesión | Testear en preview con dominio de staging antes de producción; rollback = quitar la env var |
| CORS whitelist deja fuera un subdominio | Configurar wildcards permitidos si Emergent Support lo soporta; alternativamente listar explícito |
| Usuarios existentes ven doble login por cambio de cookie | Grace period: nuevo backend acepta cookies antiguas por 30 días; forzar re-login controlado |
| Fuentes editoriales sin `verticals` aparecen en Medical | Backfill: marcar todo `growth_items` con `verticals=["one"]` antes de habilitar Medical |
| SEO: `medical.puntocerosystem.com` no indexado | `seo_routes.py` ya sirve `sitemap.xml`; añadir sub-sitemap por vertical al habilitar Medical |
| Conflictos de estilo entre shells | `BrandProvider` centraliza tokens; los shells NO comparten CSS global agresivo |

---

## 7. Beneficios estratégicos

- **Un solo usuario, muchas verticales.** El profesional multi-disciplinar vive en un solo perfil.
- **Costos infra estables.** Un backend, una BD, un CDN. Escalar verticales = añadir shells, no clusters.
- **Marketing coherente.** Cada vertical con su marca visual pero misma auth y datos.
- **Analytics unificado.** Un solo pipeline mide adopción cross-vertical.
- **Time-to-market rápido.** Nueva vertical = nuevo shell + filtros — semanas, no trimestres.
