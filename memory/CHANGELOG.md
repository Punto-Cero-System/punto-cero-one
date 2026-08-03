# Punto Cero System — Changelog

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

