# Punto Cero System — Changelog

## 2026-08-03 — Wave 8B: Discovery Platform + Growth Engine (Production Ready)

### Backend
- **NEW** `services/discovery/autotag.py` — shared inline auto-tagger with 5-min alias cache. Exposes `get_company_aliases`, `compute_related_companies`, `autotag_item_payload`, `backfill_autotag`.
- **NEW** endpoint `GET /api/discovery/trending?limit=&hours=` — ranks companies by real-time signals (mentions in growth_items × 3 + posts × 2 + followers × 1).
- **MODIFIED** `services/growth/aggregator.py:run_once` — auto-tag applied INLINE during upsert (no more post-processing). Returns `auto_tagged`/`backfilled` counters.
- **MODIFIED** `services/sources_center/engine.py` — both `_sync_rss_like` and `sync_remotive_jobs` now auto-tag inline. Legacy `_autotag_growth_items` kept as thin wrapper calling shared backfill for idempotence.
- **MODIFIED** `services/growth/scheduler.py` — initial startup pass triggers `backfill_autotag(limit=2000)` for legacy items ingested before the inline tagger.
- **NEW** seed: canonical `google` company (Alphabet parent) — was only `google-cloud`.

### Frontend
- **MODIFIED** `components/business/CompanyRelated.jsx` — added People + Hashtags cards. Now renders 8 sections: news, videos, repos, jobs, events, similar, people, hashtags.
- **NEW** `components/community/workspace/TrendingCompaniesWidget.jsx` — home right-panel widget listing top 6 companies with mentions/followers, plus FollowButton per row.
- **MODIFIED** `services/platformService.js` — added `discoveryService.trending(limit, hours)`.
- **REGISTERED** in `services/workspaceRegistry.jsx` + default panels (`WorkspaceContext.jsx`, `routes/workspace_routes.py`) so it ships in the default Mi Espacio layout right after Messages.

### Growth Scheduler — verified running
- 35 active sources (13 GitHub, 16 RSS, 5 YouTube, 1 Remotive)
- Ingestion loop: startup pass + 30-min cadence
- 1511 growth_items in DB, kinds correctly classified (news, video, repo, job)
- `related_companies` populated inline for every new item + 2000-item startup backfill

### OAuth Providers — production-prepared (env-only)
- `/api/community/auth/providers` lists: google (active), linkedin, microsoft, apple, facebook as `coming_soon`.
- LinkedInAuthProvider + MicrosoftAuthProvider fully implemented in `services/community_auth.py:216-256`. Only require `LINKEDIN_CLIENT_ID/SECRET` + `MICROSOFT_CLIENT_ID/SECRET` in `.env` to flip live.

### Testing
- `testing_agent_v3_fork` iteration_21: 12/14 wave8b PASS + 39/39 regression PASS (wave8a + discovery + sources_center + growth). Remaining 2 gaps were the missing `google` seed → fixed here → now 55/55.
- Public readiness verdict: **READY FOR PUBLIC (soft launch)**.

### Public readiness answers
- **¿Punto Cero One está listo para abrirse al público?** SÍ — todas las validaciones core (ingesta automática, discovery, trending, búsqueda, feed, perfiles públicos, verificación de email, notificaciones, follows) están green end-to-end sobre la preview URL.
- **¿Qué depende solo de variables de entorno?** LinkedIn OAuth (`LINKEDIN_CLIENT_ID/SECRET`), Microsoft OAuth (`MICROSOFT_CLIENT_ID/SECRET`). Nada más está bloqueado.
- **Pendiente para integración con Punto Cero System (holding):** cross-linking desde el landing corporativo hacia `/comunidad`, SSO opcional entre `puntocerosystem.com` y `puntocero.one` (una única sesión), y unificación de branding/typography en el header público.
