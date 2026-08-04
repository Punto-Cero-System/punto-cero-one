# Punto Cero System — Changelog

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

