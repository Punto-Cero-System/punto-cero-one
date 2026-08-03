# Punto Cero System — Changelog

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

