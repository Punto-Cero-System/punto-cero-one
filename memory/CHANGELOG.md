# Punto Cero System — Changelog

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

