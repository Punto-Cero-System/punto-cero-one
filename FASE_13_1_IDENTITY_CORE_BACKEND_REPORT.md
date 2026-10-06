# FASE 13.1 — IDENTITY CORE BACKEND (READ ONLY) — INFORME FINAL

Fecha: 2026-09-17 · Rama: `conflict_160926_0918` @ `f474372` · **Sin commit ni push (esperando revisión)**

## 1. Archivos creados

| Archivo | Contenido |
|---|---|
| `backend/services/identity_core.py` | Servicio de solo lectura: `resolve_identity()` (casos 1–5), `IdentityConflictError`, cálculo de `account_type` (derivado, no almacenado), verticales normalizadas, `organizations` desde `companies.owner_id`/`team`, `workspaces` (available/coming_soon/recommended). No escribe en MongoDB. |
| `backend/tests/test_identity_core.py` | 9 pruebas de integración contra servidor vivo (patrón conftest existente): JWT solo, community solo, unificada mismo usuario, conflicto 409 dos usuarios, 401 sin sesión, verticals→espacios, organizaciones→espacios, default `personal`. |
| `IDENTITY_CORE_ARCHITECTURE_V1.md` | (F13.0) Diseño completo, 230 líneas. |

## 2. Archivos modificados

- `backend/routes/auth_routes.py` — **único archivo modificado** (+~51 líneas, 0 eliminadas, al final del archivo):
  - imports añadidos: `bearer_scheme`, `decode_token`, `current_user_or_none`, `resolve_identity`, `IdentityConflictError`
  - helper `_optional_jwt_user()` (JWT opcional, no rompe deps existentes)
  - endpoint **`GET /api/auth/system-context`** con la respuesta `{user, session, identity, organizations, workspaces}` y `409 identity_conflict` en caso 4, `401` en caso 5.

**No modificados (confirmado con git status/diff):** `auth.py`, `community_deps.py`, `community_auth_routes.py`, `workspace_routes.py`, `models*.py`, `server.py`, y todo el frontend (`AuthContext.jsx`, `CommunityAuthContext.jsx`, `LoginCardOne.jsx`, Gateway, Workspace).

## 3. Rutas nuevas

- `GET /api/auth/system-context` → **191 rutas totales** (190 previas + 1). Verificado por introspección de la app tras `import server`.

## 4. Tests ejecutados

- **Suite Identity Core: 9/9 passed** (incluida en corrida combinada `22 passed`).
- **Regresión adyacente: 39/42** — los 3 fallos (`test_workspace_returns_defaults_when_empty`, `test_session_disabled_provider_returns_400`, `test_ui_preferences_and_media`) se reprodujeron **idénticos contra servidor baseline sin mis cambios** (verificado con stash temporal `f131-temp-verify` + pop limpio) → **preexistentes, no causados por F13.1**.
- **Hallazgo contractual preexistente detectado:** `UserPublic.role: Literal["admin","investor"]` hace que `/api/auth/login` responda 500 para usuarios con `role="member"` (sembrados por otros tests). Es un contrato preexistente del JWT admin, ajeno a F13.1; los tests nuevos siembran `role="admin"` para login JWT. Recomendado ampliar el `Literal` en una fase futura.
- Backend: inicia OK, `GET /api/health → {"status":"ok","db":"connected"}` (BD dedicada `punto_cero_f131`), `system-context` sin sesión → **HTTP 401** (caso 5 correcto). Servidor dejado corriendo (PID 26880) para revisión.

## 5. Riesgos encontrados

1. **Preexistente:** login JWT 500 con `role="member"` (restricción `Literal` en `UserPublic`). No tocado en F13.1 por diseño.
2. **Preexistente:** 3 fallos de regresión clasificados con baseline (ver arriba).
3. **Del nuevo código:** `system-context` es solo lectura y no emite tokens; el conflicto (caso 4) responde 409 explícito — la UI aún no lo consume (será F13.2).
4. Logs temporales de debug eliminados; BD temporal `punto_cero_f131` sigue poblada con datos de test (eliminable sin riesgo).

## 6. Confirmación: auth existente NO fue reemplazada

- `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `accept-invitation` y todo `community_auth` **intactos** (diff muestra solo adiciones al final del archivo).
- Sin cambios en modelos, migraciones, dependencias ni frontend. Los 5 casos del enunciado cubiertos por tests.

## 7. Estado Git (sin commit, según instrucción)

```text
 M backend/routes/auth_routes.py      ← F13.1 (endpoint)
?? IDENTITY_CORE_ARCHITECTURE_V1.md   ← F13.0 (diseño)
?? backend/services/identity_core.py  ← F13.1 (servicio)
?? backend/tests/test_identity_core.py← F13.1 (tests)
```

**Pendiente de decisión:** revisión del código y autorización de commit/push.

---

## FASE 13.1.1 — Ajustes de diseño aplicados y validados

**Corrección de semántica `account_type`** (`backend/services/identity_core.py`):

- Prioridad profesional: vertical profesional activa → `account_type="profesional"` (aunque exista membresía en organizaciones).
- La organización solo determina `account_type="empresa"` cuando **no existe** vertical profesional.
- Fallback: `account_type="personal"`.

**Corrección de recomendación de workspace** (`compute_workspaces`): prioridad `verticals → organizations → default_personal`.

**Caso validado (test nuevo `test_professional_with_firm_membership_recommends_legal`):** profesional perteneciente a una firma → `account_type="profesional"`, `recommended="legal"`, y `organizations[]` conserva la relación (`relation="owner"` / `"member"`). También ajustados: `test_team_member_relation` y `test_organizations_owner_recommendation`.

**SPACE_CATALOG:** documentado en el código como **fuente canónica transitoria V1**; queda anotada la evaluación de migración completa del catálogo al backend en F13.2 y un futuro test de contrato frontend/backend (comparación contra `frontend/src/config/workspaceSpaces.js`, verificado manualmente: keys/estados idénticos, solo labels de display difieren).

**Documentación alineada:** `IDENTITY_CORE_ARCHITECTURE_V1.md` refleja el formato real implementado — `available` y `coming_soon` usan `[{key, label}]`.

**Validación F13.1.1:** `py_compile` OK · pytest Identity Core **9/9 passed** (5.28s) · `system-context` sin sesión 401 · `login` 200 · `/me` 200 · `system-context` con JWT 200 (`user, session, identity, organizations, workspaces`; admin sin señales → `personal/comunidad/default_personal`) · `auth_routes.py` **sin cambios** en F13.1.1 · frontend sin cambios.
