# PRODUCTION_READINESS_CHECKLIST.md
**Fecha:** 2026-08-07
**Autor:** Arquitecto senior
**Objetivo:** Orden operativo, dependencias, riesgos y guarda-raíles para llevar a producción el ecosistema multi-dominio sin regresiones.

---

## 1. Orden de implementación

Cada fase depende de la anterior. Cada fase debe validarse antes de pasar a la siguiente.

### Fase 0 — Preparación de infraestructura *(sin código)*
| # | Acción | Dependencia | Riesgo |
|---|---|---|---|
| 0.1 | Contratar/verificar dominio `puntocerosystem.com` en Hostinger. | — | Bajo |
| 0.2 | Solicitar a Emergent Support: certificado wildcard `*.puntocerosystem.com` + SAN raíz. | 0.1 | **Medio** — SLA Emergent (típicamente 24-48h) |
| 0.3 | Publicar registro DNS `medical CNAME puntocerosystem.com`. TTL 3600. | 0.1 | Bajo (propagación 15 min – 24 h) |
| 0.4 | Ampliar ingress Emergent para aceptar `medical.puntocerosystem.com`. | 0.2 | **Alto** — mal ingress = downtime en raíz también |
| 0.5 | Verificar `dig` + `openssl s_client` + `curl -sI` sobre ambos dominios (§4.3 DOMAIN_ROUTING_PLAN). | 0.2, 0.3, 0.4 | Bloqueante |

### Fase 1 — Auth cross-dominio *(cambio mínimo backend)*
| # | Acción | Dependencia | Riesgo |
|---|---|---|---|
| 1.1 | Añadir env var `COOKIE_DOMAIN=.puntocerosystem.com` en producción **y sólo en producción**. | 0.5 | **Alto** — mal valor invalida todas las sesiones |
| 1.2 | Reemplazar `CORS_ORIGINS="*"` por whitelist explícita (raíz + www + medical). | 1.1 | Medio — cualquier subdominio fuera de la lista rompe |
| 1.3 | Confirmar `allow_credentials=True` en `CORSMiddleware`. | 1.2 | Bajo |
| 1.4 | En LinkedIn, Google, Facebook developer consoles: registrar Redirect URIs por dominio (§3.3 DOMAIN_ROUTING_PLAN). | 1.1 | Medio — provider bloquea si no coincide |
| 1.5 | Smoke test: login en raíz → visitar medical.* → `/api/community/auth/me` debe devolver el mismo user. | 1.1–1.4 | Bloqueante |
| 1.6 | Rollback plan: quitar `COOKIE_DOMAIN` → cookie vuelve a ser específica del host. Los usuarios necesitan re-login. | 1.5 | — |

### Fase 2 — SubdomainRouter en frontend *(cambio aditivo)*
| # | Acción | Dependencia | Riesgo |
|---|---|---|---|
| 2.1 | Crear `config/brand.js` con `resolveBrand(hostname)`. | 1.5 | Bajo |
| 2.2 | Crear `contexts/BrandContext.jsx` + `useBrand()`. | 2.1 | Bajo |
| 2.3 | Extraer contenido actual de `App.js` a `apps/AppOne.jsx` (import por referencia). | 2.2 | **Alto** — es la raíz del árbol React |
| 2.4 | Crear `apps/AppMedical.jsx` (shell mínimo). | 2.3 | Medio |
| 2.5 | Refactor `App.js` para: `<BrandProvider><SubdomainRouter/></BrandProvider>`. | 2.3, 2.4 | **Alto** — punto único de fallo |
| 2.6 | Regresión completa con `testing_agent`. | 2.5 | Bloqueante |

### Fase 3 — Modelo multi-vertical *(datos)*
| # | Acción | Dependencia | Riesgo |
|---|---|---|---|
| 3.1 | Añadir 6 campos opcionales al schema `UserProfile` (§4.2 SYSTEM_ARCHITECTURE_PLAN). | Fase 2 | Bajo (opt-in) |
| 3.2 | Extender endpoints con query param opcional `?vertical=`. Sin él, comportamiento actual intacto. | 3.1 | Medio |
| 3.3 | Interceptor fetch en frontend anexa `?vertical=` según `useBrand()`. | 3.2 | Bajo |
| 3.4 | Job idempotente `backfill_vertical.py` marca usuarios/posts existentes como `vertical="one"`. | 3.1 | Bajo |
| 3.5 | Cobertura pytest: tests que verifiquen que `?vertical=` filtra y que su ausencia no rompe nada. | 3.2 | Bloqueante |

### Fase 4 — Habilitar Medical *(cuando producto lo pida)*
| # | Acción | Dependencia | Riesgo |
|---|---|---|---|
| 4.1 | Diseñar rutas y páginas Medical (medicina, enfermería, odontología, psicología). | Fase 3 | — |
| 4.2 | Cargar fuentes editoriales `growth_items` marcadas como `verticals: ["medical"]`. | 4.1 | Bajo |
| 4.3 | Verificación regulatoria (matrícula profesional) — flujo separado. | 4.1 | Medio |
| 4.4 | Anunciar públicamente subdominio Medical + campañas SEO. | 4.3 | — |

---

## 2. Checklist de seguridad

### 2.1. Secretos y credenciales

- [ ] `SECRET_KEY` / `JWT_SECRET` **rotado** al pasar a producción (no reutilizar el de preview).
- [ ] `LINKEDIN_CLIENT_SECRET`, `FACEBOOK_APP_SECRET` **son de la app de producción**, no de la de preview.
- [ ] `MONGO_URL` de producción usa credenciales dedicadas con permisos mínimos (no root).
- [ ] `.env` **NO** está en git (verificado en `.gitignore`).
- [ ] Todos los `os.environ.get(...)` críticos fallan explícitamente si falta la variable (no defaults silenciosos).
- [ ] `EMERGENT_LLM_KEY` con presupuesto configurado; auto-topup activado si el flujo lo requiere.
- [ ] No hay secretos hardcodeados en `frontend/src/*` (regla: los únicos strings sensibles permitidos son `REACT_APP_*`).

### 2.2. CORS

- [ ] `CORS_ORIGINS` **NO es `"*"`** en producción.
- [ ] Lista contiene sólo dominios propios: `https://puntocerosystem.com`, `https://www.puntocerosystem.com`, `https://medical.puntocerosystem.com`.
- [ ] `allow_credentials=True` (necesario para cookie compartida).
- [ ] `allow_methods` limitado a los verbos usados (`GET, POST, PUT, DELETE, PATCH, OPTIONS`).
- [ ] `allow_headers` incluye `Authorization`, `Content-Type`, `Accept-Language`, `X-User-Country`.
- [ ] `expose_headers` incluye lo mínimo (idealmente vacío).

### 2.3. Cookies

- [ ] `httponly=True` — la sesión no es accesible por JS.
- [ ] `secure=True` — sólo por HTTPS.
- [ ] `samesite="none"` — necesario para cross-subdomain con `credentials`.
- [ ] `domain=".puntocerosystem.com"` — con el punto inicial para incluir subdominios.
- [ ] TTL configurado (`COMMUNITY_SESSION_TTL_DAYS`) — actualmente ok.
- [ ] Endpoint de logout borra la cookie con los mismos flags con que se emitió.
- [ ] Rotación de sesión al hacer login (invalida sesiones antiguas del mismo user si se requiere).

### 2.4. OAuth

- [ ] Redirect URIs registrados en cada provider **coinciden exactamente** con lo que emite el backend (protocol + host + path).
- [ ] `state` con nonce validado en el callback (protección CSRF).
- [ ] Alcances mínimos: LinkedIn `openid profile email`, Google `openid email profile`, Facebook `email public_profile`.
- [ ] `id_token` verificado con la JWKS del proveedor cuando aplica.
- [ ] Emails devueltos por el proveedor **verificados** antes de crear la cuenta.
- [ ] Rate limit en `/api/community/auth/*` (evitar brute force en password reset).

### 2.5. Datos

- [ ] Índices Mongo en campos filtrables por vertical: `users.email`, `users.vertical`, `posts.author_id + created_at`, `posts.vertical + created_at`, `groups.vertical`, `follows.user_id + entity_id`.
- [ ] Backups automáticos configurados (Emergent Support).
- [ ] `MAX_UPLOAD_BYTES` razonable (5-10 MB para imágenes).
- [ ] `OBJECT_STORAGE_BACKEND` en producción **no** es local disk sin backup.

### 2.6. Observabilidad

- [ ] Logs backend a stdout (Emergent los recoge).
- [ ] Métricas de latencia y error rate por endpoint.
- [ ] Sentry o equivalente para excepciones no controladas (opcional, recomendable).
- [ ] Dashboard de uso: DAU, requests/min, storage growth.

---

## 3. Módulos intocables

**Estos módulos están validados por `testing_agent` y con tests pytest verdes.** Cualquier cambio requiere una regresión completa antes del merge.

### 3.1. Feed
- `backend/routes/feed_routes.py` — CRUD de posts, reactions, comments, saves, shares.
- `backend/routes/content_sources_routes.py` — mixed-feed + editorial composer + filtros regionales.
- `frontend/src/components/community/IntelligentFeed.jsx` — botón "Ver más publicaciones" + scroll restore.
- `frontend/src/components/community/FeedPostCard.jsx` — React.memo con firma de comparación afinada.
- `frontend/src/components/community/FeedComposer.jsx` — upload de imágenes con optimistic update.
- `frontend/src/components/community/LiveFeed.jsx` — tabs Descubrir / Últimos / Para Ti.
- `frontend/src/components/community/cards/*` — PreviewCard, ContentCard y todas las tarjetas de tipo.

### 3.2. Workspace
- `backend/routes/workspace_routes.py` — `default_workspace()` está simplificado a 6 widgets (Fase de Optimización). No revertir.
- `frontend/src/contexts/WorkspaceContext.jsx` — hidratación + persistencia por usuario.
- `frontend/src/services/workspaceRegistry.jsx` — registro central de widgets.
- `frontend/src/components/community/workspace/WorkspacePanel.jsx` — drag-and-drop y edit mode.

### 3.3. Autenticación
- `backend/services/community_auth.py` — flujos OAuth (Google, LinkedIn, Facebook) + password.
- `backend/routes/community_auth_routes.py` — login, register, verify email, reset, brute-force protection.
  - **Excepción autorizada:** añadir soporte `COOKIE_DOMAIN` en `_cookie_flags()` (§Fase 1). Ese cambio SÍ está permitido, pero debe ser el único.
- `frontend/src/contexts/CommunityAuthContext.jsx` — estado global de sesión.
- `frontend/src/pages/JoinPage.jsx` — flujo de registro con `armWelcome`.
- `frontend/src/components/community/WelcomeModal.jsx` — modal + confetti tras registro.

### 3.4. Mensajería
- `backend/routes/messaging_routes.py` — endpoints 1-a-1.
- `frontend/src/pages/MessagesPage.jsx` — auto-grow textarea + scroll interno (recién arreglados).
- `frontend/src/components/community/workspace/MessagesWidget.jsx` — widget del sidebar.

### 3.5. Notificaciones
- `backend/routes/notification_routes.py` — CRUD + read/unread.
- `backend/services/notifications.py` — emisión de eventos (group_post, follow, mention, …).
- `frontend/src/components/community/NotificationsBell.jsx` — dropdown + realtime.
- `backend/services/realtime.py` — SSE.

### 3.6. Object storage
- `backend/routes/profile_media_routes.py` — streaming de imágenes de perfiles, posts y grupos. **Whitelist recién arreglada** (`users/`, `posts/`, `groups/`).
- `backend/routes/company_media_routes.py` — media de empresas.
- `backend/services/object_storage.py` — abstracción sobre disk/S3.
- `backend/routes/feed_routes.py::media_upload` — upload endpoint con path canonical.

### 3.7. Tests (regresión mínima)
- `backend/tests/test_editorial_composer.py`
- `backend/tests/test_wave12_photo_fix.py`
- `backend/tests/test_wave12_content_sources.py`
- `backend/tests/test_iter34_feed_filter.py`

**Regla:** cualquier PR que toque los módulos anteriores debe pasar los 37 tests en verde antes de merge.

---

## 4. Matriz de riesgos vs. mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| `COOKIE_DOMAIN` mal escrito → todas las sesiones inválidas | Media | Alto | Testear en staging primero; rollback = quitar env var |
| CORS whitelist deja fuera un subdominio → CORS blocked | Media | Medio | Añadir entrada + redeploy backend (5 min) |
| Wildcard SSL no aprovisionado a tiempo | Media | Alto | Solicitar a Emergent Support con 48-72h de antelación |
| OAuth Redirect URI faltante → login falla en 1 dominio | Media | Medio | Registrar TODOS los URIs antes del anuncio público |
| Job de backfill marca campos incorrectos | Baja | Medio | Corrida dry-run en preview + count verification |
| DNS no propaga a tiempo → sub-dominio 404 | Media | Bajo | Anunciar Medical sólo tras `dig` OK en 3 resolvers distintos |
| Bug en `SubdomainRouter` → todos los usuarios ven AppMedical | Baja | Alto | Fallback a AppOne en `hostname` desconocido; regresión testing_agent obligatoria |
| Fuentes editoriales cross-vertical mal etiquetadas → Medical ve noticias de negocios generales | Alta | Bajo | Aceptable como MVP; refinar al recibir feedback usuario |
| Regressión en botón "Ver más" al reorganizar componentes | Baja | Medio | Los tests test_iter34_feed_filter cubren el shape del endpoint; añadir smoke Playwright del botón |
| Testing agent no cubre subdominios | Alta | Bajo | Añadir 2 checks Playwright: navegar a los 2 hostnames y validar shell correcto |

---

## 5. Métricas de éxito

Un despliegue se considera exitoso cuando **todas** las siguientes métricas se cumplen:

- [ ] **Backend health:** `GET /api/health` retorna `200 OK` en ambos dominios en < 300 ms.
- [ ] **Auth persistente cross-domain:** login en raíz → cookie válida en medical (probado con curl `--cookie-jar` o Playwright).
- [ ] **Feed carga con contenido regional:** `GET /api/content-sources/mixed-feed?limit=12` devuelve ≥ 10 items únicos por título.
- [ ] **Sin artefactos de test visibles:** cero cards con autor `Case\d+`, `MixedFeedCase`, `ListCase` en ninguno de los 2 dominios.
- [ ] **Imágenes de posts renderizan:** `GET /api/community/users/media/{prefix}/posts/…` responde `200 OK` con `Content-Type: image/*`.
- [ ] **Suite pytest verde:** 37/37 tests actuales + los nuevos de vertical (`?vertical=` filter regression).
- [ ] **Bundle inicial ≤ 500 KB gzip** — verificado con `yarn build && ls -lh build/static/js`.
- [ ] **CSP y headers de seguridad:** `curl -sI` muestra `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options` en ambos dominios.
- [ ] **Sentry/logs sin errores nuevos** durante 24 h post-deploy.

---

## 6. Cronograma recomendado

| Semana | Fase | Entregable |
|---|---|---|
| S1 | Fase 0 + 1 (infra + cookie compartida) | Login universal funciona entre raíz y medical (sin AppMedical todavía) |
| S2 | Fase 2 (SubdomainRouter + AppOne extraído) | AppOne sigue funcionando idéntico, envuelto en el nuevo router |
| S3 | Fase 2 (AppMedical shell mínimo) | Landing Medical visible en `medical.puntocerosystem.com` |
| S4 | Fase 3 (multi-vertical data) | Endpoints filtran por `?vertical=`; interceptor frontend activo |
| S5-S6 | Fase 4 (contenido Medical) | Fuentes editoriales, comunidad y feed Medical con datos reales |

**Total estimado:** 5-6 semanas hasta soft-launch de `medical.puntocerosystem.com` con un equipo dedicado.

---

## 7. Salidas del checklist

Antes de anunciar el ecosistema multi-dominio públicamente, imprimir este archivo, marcar cada casilla, y adjuntar al ticket de release. Ninguna casilla debe quedar sin marcar.
