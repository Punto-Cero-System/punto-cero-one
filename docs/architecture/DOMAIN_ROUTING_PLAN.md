# DOMAIN_ROUTING_PLAN.md
**Fecha:** 2026-08-07
**Autor:** Arquitecto senior (plan sin implementación)
**Objetivo:** Detallar los archivos, envs e infraestructura DNS necesarios para servir `puntocerosystem.com` y `medical.puntocerosystem.com` con un solo repo.

---

## 1. Archivos frontend a modificar

Todos los cambios son **aditivos** — no se elimina código existente.

| Archivo | Cambio | Riesgo |
|---|---|---|
| `frontend/src/config/brand.js` **(nuevo)** | Tabla `HOSTNAME → { vertical, brand, theme, title }`. Función `resolveBrand(hostname)`. | Bajo |
| `frontend/src/contexts/BrandContext.jsx` **(nuevo)** | Provider + `useBrand()`. Resuelve una vez en el mount inicial (no re-renderiza). | Bajo |
| `frontend/src/components/SubdomainRouter.jsx` **(nuevo)** | Componente wrapper que lee `useBrand().vertical` y renderiza `<AppOne />` o `<AppMedical />`. | Bajo |
| `frontend/src/apps/AppOne.jsx` **(nuevo)** | Contiene el `<BrowserRouter>` y las 39 rutas actuales, movidas desde `App.js` **por referencia** (sólo un import + un JSX pass-through). | Medio (renombrado de fuente principal) |
| `frontend/src/apps/AppMedical.jsx` **(nuevo)** | `<BrowserRouter>` con rutas Medical mínimas (`/`, `/medicina`, `/enfermeria`, `/odontologia`, `/psicologia`, y reutilización de `/perfil`, `/mensajes`, `/notificaciones`, `/join`). | Bajo |
| `frontend/src/App.js` | Un solo cambio: envolver el árbol actual dentro de `<BrandProvider><SubdomainRouter/></BrandProvider>`. Preservar todos los providers ya existentes. | Alto — es el archivo raíz. Requiere testing agent tras el cambio. |
| `frontend/src/components/Header.jsx` | Añadir un solo hook `useBrand()` para pintar el badge del vertical (One / Medical) sin cambiar layout. | Bajo |
| `frontend/src/services/feedService.js` (y análogos) | Interceptor que anexa `?vertical=medical` a las llamadas cuando `useBrand().vertical === 'medical'`. | Medio |
| `frontend/public/index.html` | `<title>` dinámico via JS o SSR-lite (title cambia según hostname en `App.js`). | Bajo |
| `frontend/public/robots.txt` | Añadir sitemap por vertical si Medical se lanza. | Bajo |

### Convenciones (no romper)
- **NO** tocar `frontend/src/components/community/IntelligentFeed.jsx`, `FeedPostCard.jsx`, `FeedComposer.jsx`, `LiveFeed.jsx` — están calientes.
- **NO** tocar `frontend/src/contexts/CommunityAuthContext.jsx`, `RealtimeContext.jsx`, `WorkspaceContext.jsx` — sólo consumirlos.
- **NO** duplicar rutas: `/perfil`, `/mensajes`, `/notificaciones`, `/u/:userId`, `/join`, `/reset-password`, `/verify-email` **se importan por referencia** en `AppMedical.jsx`; no se re-implementan.

---

## 2. Archivos backend a modificar

| Archivo | Cambio | Riesgo |
|---|---|---|
| `backend/routes/community_auth_routes.py` | En `_cookie_flags()` leer `os.environ.get("COOKIE_DOMAIN")` y, si existe, añadir `"domain": <valor>` al dict devuelto. Un solo `if`. | Bajo (opt-in por env) |
| `backend/server.py` | Cambiar `CORSMiddleware(allow_origins=["*"])` a whitelist desde env + `allow_credentials=True`. Compatible con lista existente. | Medio |
| `backend/routes/feed_routes.py` `content_sources_routes.py` `groups_routes.py` `discovery_routes.py` `company_routes.py` `job_routes.py` `event_routes.py` | Añadir query param **opcional** `vertical: Optional[str] = None` que filtra `posts/groups/…` cuando venga. Sin él, comportamiento actual intacto. | Medio |
| `backend/models_profile.py` | Añadir 6 campos opcionales al schema `UserProfile` (`tenant`, `vertical`, `profession_key`, `sub_specialties`, `credentials`, `verified_at`). Todos `Optional[...] = None`. | Bajo |
| `backend/services/migrations/backfill_vertical.py` **(nuevo)** | Job one-shot: setea `vertical="one"` a todos los users/posts/groups que no lo tengan. Idempotente. | Bajo |
| `backend/routes/community_auth_routes.py::_to_public` | Añadir `available_verticals` en el response. Deriva de `user.get("verticals_joined", [])`. | Bajo |

### Intocables
- `backend/routes/profile_media_routes.py`, `company_media_routes.py` — object storage.
- `backend/routes/workspace_routes.py` — layout default.
- `backend/tests/` — no modificar hasta escribir tests nuevos de vertical.
- `backend/services/community_auth.py` — flujos OAuth completos.

---

## 3. Variables de entorno

### 3.1. Frontend (`frontend/.env`)

| Variable | Preview | Producción raíz | Producción Medical | Notas |
|---|---|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://future-core-5.preview.emergentagent.com` | `https://puntocerosystem.com` | `https://medical.puntocerosystem.com` | El frontend habla siempre al mismo host que sirve — el ingress rutea `/api/*` al backend interno. |
| `REACT_APP_APP_PUBLIC_URL` **(nuevo)** | `https://future-core-5.preview.emergentagent.com` | `https://puntocerosystem.com` | `https://medical.puntocerosystem.com` | URL absoluta del shell para meta tags, OG, canonical. |
| `REACT_APP_DEFAULT_VERTICAL` **(nuevo, opcional)** | `one` | `one` | `medical` | Fallback si `SubdomainRouter` no reconoce el host (útil en preview). |
| `WDS_SOCKET_PORT` | `443` | (no aplica en build) | (no aplica en build) | Sin cambios |

**IMPORTANTE:** el mismo build de React funciona en los 3 casos; sólo cambian estas envs en build time.

### 3.2. Backend (`backend/.env`)

| Variable | Preview | Producción | Notas |
|---|---|---|---|
| `MONGO_URL` | `mongodb://localhost:27017` | (managed) | Sin cambios |
| `DB_NAME` | `test_database` | (managed) | Sin cambios |
| `CORS_ORIGINS` | `*` | `https://puntocerosystem.com,https://www.puntocerosystem.com,https://medical.puntocerosystem.com` | **Cambia**: eliminar wildcard, listar orígenes. Requerido para `credentials=True`. |
| `COOKIE_DOMAIN` **(nuevo)** | *(sin definir)* | `.puntocerosystem.com` | Prefijo con punto = incluye todos los subdominios. |
| `COOKIE_SAMESITE` | `none` | `none` | Sin cambios (cross-site necesita None + Secure). |
| `COOKIE_SECURE` | `1` | `1` | Sin cambios. |
| `PUBLIC_APP_URL` | `https://future-core-5.preview.emergentagent.com` | `https://puntocerosystem.com` | Se usa para OAuth callback. Ver 3.3. |
| `JWT_SECRET` (rebautizar) → **`SECRET_KEY`** *(opcional, alias)* | (valor actual) | Nuevo secret rotado en despliegue | Renombrar en `.env` como alias; retro-compat leyendo ambos. |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | (test app) | (prod app) | Cliente distinto en cada entorno. |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | (test app) | (prod app) | Idem. |
| `EMERGENT_LLM_KEY` | (universal key) | (universal key) | Sin cambios. |
| `EMAIL_FROM_NAME` | `Punto Cero` | `Punto Cero System` | Cosmético. |
| `OBJECT_STORAGE_APP` | `punto-cero-system` | `punto-cero-system` | Sin cambios. |

### 3.3. OAuth callback URL scheme

El backend construye el `redirect_uri` como `{PUBLIC_APP_URL}/api/community/auth/oauth/{provider}/callback`. Con multi-dominio hay dos alternativas:

**Alt A · Callback único (recomendado):** todos los subdominios usan un solo callback `https://puntocerosystem.com/api/community/auth/oauth/{provider}/callback`. Tras el intercambio, el backend redirige al `state.origin` (que sí es específico del subdominio). Ventaja: un solo Redirect URI que registrar por provider. Requiere pequeño cambio en `services/community_auth.py` para leer el origen desde el state.

**Alt B · Callback por dominio:** registrar dos Redirect URIs por provider (raíz + medical). Sin cambios de código. Ventaja: cero código nuevo. Desventaja: hay que registrar por cada nueva vertical.

Decisión sugerida en el plan: **Alt B** (más simple, sin refactor de auth). Alt A queda como optimización futura.

---

## 4. Configuración DNS (Hostinger)

### 4.1. Registros DNS necesarios

Asumiendo que el backend está detrás de un ingress Emergent con IP pública `<EMERGENT_IP>` o CNAME `<EMERGENT_HOST>`:

| Tipo | Nombre | Valor | TTL | Notas |
|---|---|---|---|---|
| A | `@` (raíz `puntocerosystem.com`) | `<EMERGENT_IP>` | 3600 | Si Emergent expone solo CNAME, usar ANAME/ALIAS en Hostinger. |
| A | `www` | `<EMERGENT_IP>` | 3600 | Alternativa: CNAME `www` → `puntocerosystem.com`. |
| CNAME | `medical` | `puntocerosystem.com.` | 3600 | Apunta al mismo host raíz — el ingress diferencia por `Host` header. |
| CNAME | `api` **(opcional)** | `puntocerosystem.com.` | 3600 | Sólo si se decide extraer el backend a un subdominio propio. Recomendado para escala. |
| TXT | `@` | (Google verification si aplica) | 3600 | Para OAuth Google (App verification). |
| TXT | `@` | (DMARC + SPF si se envían emails con Resend) | 3600 | Para email deliverability. |
| MX | `@` | (opcional si se recibe correo) | 3600 | Fuera del alcance del plan. |
| CAA | `@` | `0 issue "letsencrypt.org"` | 3600 | Autorizar sólo Let's Encrypt. |

### 4.2. SSL

**Wildcard vs. per-subdomain:**
- **Recomendado:** solicitar un certificado wildcard `*.puntocerosystem.com` + `puntocerosystem.com` (SAN). Cubre TODAS las verticales sin re-configurar SSL cada vez.
- Emergent normalmente aprovisiona Let's Encrypt automáticamente. Confirmar con Emergent Support que el certificado incluye SAN para subdominios *o* solicitar wildcard.
- Renovación automática cada 60-89 días vía cert-manager en el clúster.

### 4.3. Verificación DNS

Comandos que el equipo de operaciones debe correr **antes** de habilitar el subdominio Medical:
```
dig puntocerosystem.com          A     +short
dig medical.puntocerosystem.com  CNAME +short
dig medical.puntocerosystem.com  A     +short
curl -sI https://puntocerosystem.com | grep -i "server\|strict-transport"
curl -sI https://medical.puntocerosystem.com | grep -i "server\|strict-transport"
openssl s_client -servername medical.puntocerosystem.com -connect medical.puntocerosystem.com:443 </dev/null 2>/dev/null | openssl x509 -noout -text | grep DNS:
```
Todos deben responder OK antes de anunciar el sub-dominio Medical públicamente.

### 4.4. Configuración Ingress en Emergent

Solicitar a Emergent Support:
1. **Añadir `medical.puntocerosystem.com` al Ingress del mismo pod.** Un solo pod atiende ambos dominios.
2. **Asegurar que el `Host` header llega tal cual al backend** (importante para OAuth callback y logging).
3. **HSTS y `Strict-Transport-Security` habilitados** en el edge.
4. **Redirect 301 `http://` → `https://`** en ambos dominios.
5. **Redirect 301 `www.puntocerosystem.com` → `puntocerosystem.com`** (o al revés — decidir canonical).
6. **Timeouts razonables:** 60 s por request (uploads pueden ser lentos).
7. **CORS ya lo controla el backend** con la env whitelist — no duplicar en Ingress.

---

## 5. Envs de build (React)

Como CRA lee `REACT_APP_*` en **build time**, hay dos estrategias:

**Estrategia A · Un solo build, decide en runtime.** El build no sabe qué vertical es; `SubdomainRouter` decide por `hostname`. `REACT_APP_BACKEND_URL` apunta al MISMO host que sirve el shell → el propio dominio (o un `api.puntocerosystem.com`). **Recomendada.**

**Estrategia B · Un build por dominio.** Cada dominio se despliega con su propio `REACT_APP_BACKEND_URL` fijo. Más rígido pero más simple. No recomendada si es un solo repo mono-deploy.

En Estrategia A la env `REACT_APP_BACKEND_URL` puede apuntar a **cadena vacía** o URL relativa (`""`). Los fetch usan URLs relativas (`/api/...`) que van al mismo host. Es la configuración más flexible.

---

## 6. Resumen de cambios operativos

| Layer | Cambios | Tiempo estimado |
|---|---|---|
| Frontend | 4 archivos nuevos, 1 archivo modificado (App.js), 1 interceptor de fetch | 1-2 días |
| Backend | 1 función tocada (`_cookie_flags`), CORS whitelist, 6 endpoints con query param opcional | 1 día |
| DNS + SSL | 3-4 registros DNS + 1 ticket a Emergent Support para ingress | 1 día (bloquea por DNS propagation) |
| OAuth | Registrar 6 Redirect URIs adicionales (3 providers × 2 dominios) | 1 hora |
| Migración datos | Job idempotente + backfill | 2-4 horas (según volumen) |
| Total mínimo viable | | **~1 semana** |
