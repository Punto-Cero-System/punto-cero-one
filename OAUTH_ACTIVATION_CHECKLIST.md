# OAUTH ACTIVATION CHECKLIST — PUNTO CERO ONE

> Documento de solo lectura. No modifica código, no ejecuta despliegues.
> Fecha de revisión: 2026-08-03 · Preview: `https://future-core-5.preview.emergentagent.com` · Producción: `https://puntoceromultiservicios.com`

---

## Tabla resumen

| Proveedor | Estado | Código listo | Variables | Redirect URI | Sólo configuración | Requiere código |
|-----------|:------:|:------------:|:---------:|:------------:|:------------------:|:---------------:|
| **Google** | ✅ Funcional | ✅ | ✅ (managed) | ✅ (managed) | ✅ | ❌ |
| **LinkedIn** | 🟡 Implementado — falta credenciales | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Microsoft** | 🟡 Implementado — falta credenciales | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Facebook** | ❌ No implementado | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Apple** | ❌ No implementado | ❌ | ❌ | ❌ | ❌ | ✅ |
| **X (Twitter)** | ❌ No implementado | ❌ | ❌ | ❌ | ❌ | ✅ |

Convenciones:
- ✅ Funcional → activo hoy en producción.
- 🟡 Implementado pero requiere configuración → basta con setear variables de entorno + registrar redirect URI en el proveedor.
- ❌ No implementado → requiere desarrollo adicional (nueva subclase de `OAuth2AuthorizationCodeProvider` o flow específico para Apple/X).

---

## 1. Google

**1. Estado actual** · ✅ Funcional (Emergent-managed).

**2. Archivos donde está implementado**
- `backend/services/community_auth.py:71-128` → `EmergentAuthProvider`
- `backend/routes/community_auth_routes.py:222-255` → `POST /api/community/auth/session`
- `frontend/src/services/authService.js:115-124` → `AUTH_PROVIDERS.google`

**3. Endpoints existentes**
- `POST /api/community/auth/session` (recibe `session_id` retornado por el relé Emergent en `window.location.hash#session_id=...`)
- `GET  /api/community/auth/providers` (expone `google` como habilitado)

**4. Variables de entorno necesarias**
- `EMERGENT_AUTH_URL` (opcional, default `https://auth.emergentagent.com`)
- `EMERGENT_AUTH_SESSION_URL` (opcional, default `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`)
- `EMERGENT_AUTH_TIMEOUT_SEC` (opcional, default `15`)

**5. Redirect URI exacta**
- Gestionada por Emergent · el front-end recibe la respuesta en `${PUBLIC_APP_URL}/#session_id=...` y la reenvía al backend.

**6. Scopes utilizados** · `openid email profile` (gestionados por el relé de Emergent).

**7. Permisos adicionales** · Ninguno · el relé Emergent ya está aprobado.

**8. Qué falta exactamente** · Nada. Activo.

**9. Prueba de activación** · Ya validado en preview y producción. En `/join` → botón "Google" → redirige al consent → vuelve al sitio autenticado.

**10. Riesgos** · Dependencia externa del relé `auth.emergentagent.com` / `demobackend.emergentagent.com`. Si Emergent cambia el endpoint, actualizar las env vars anteriores.

---

## 2. LinkedIn

**1. Estado actual** · 🟡 Implementado — sólo faltan credenciales oficiales.

**2. Archivos donde está implementado**
- `backend/services/community_auth.py:216-234` → `LinkedInAuthProvider`
- `backend/services/community_auth.py:284` → `registry.register(LinkedInAuthProvider())`
- `backend/routes/community_auth_routes.py:710-784` → `oauth_start` / `oauth_callback` genéricos
- `frontend/src/services/authService.js:125-129` → `AUTH_PROVIDERS.linkedin`

**3. Endpoints existentes**
- `GET /api/community/auth/oauth/linkedin/start`
- `GET /api/community/auth/oauth/linkedin/callback`
- Con `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` en `.env`, el provider entra a `enabled_list()` automáticamente y `/providers` lo lista como activo.

**4. Variables de entorno necesarias**
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `PUBLIC_APP_URL` (ya presente; usada para construir la Redirect URI)

**5. Redirect URI exacta**
- Preview: `https://future-core-5.preview.emergentagent.com/api/community/auth/oauth/linkedin/callback`
- Producción: `https://puntoceromultiservicios.com/api/community/auth/oauth/linkedin/callback`

Ambas deben registrarse en el LinkedIn Developer Portal → App → Auth → "Authorized redirect URLs".

**6. Scopes utilizados** · `openid profile email` (OIDC público desde 2024, ya no requiere permisos legacy).

**7. Permisos adicionales necesarios**
- Cuenta LinkedIn Developer (gratuita).
- Crear una App LinkedIn asociada a una Page corporativa (obligatorio).
- Activar el producto **"Sign In with LinkedIn using OpenID Connect"** dentro de la App.
- Verificación de la Page/empresa NO es requisito para OIDC básico.

**8. Qué falta exactamente**
- Crear la App en LinkedIn Developer.
- Copiar `Client ID` + `Client Secret` a las variables de entorno de producción.
- Registrar las dos Redirect URIs (preview + producción).
- Redeploy para que el backend recargue las variables.

**9. Prueba de activación**
- `GET /api/community/auth/providers` debe listar `linkedin` en `enabled` (ya no en `coming_soon`).
- En `/join` → botón "LinkedIn" deja de mostrar "PRONTO" y redirige a `linkedin.com/oauth/v2/authorization?...`.
- Tras consentir, LinkedIn vuelve a `/api/community/auth/oauth/linkedin/callback?code=…&state=…` y el backend redirige a `/` con la cookie de sesión establecida.
- `GET /api/community/auth/me` devuelve el usuario con `auth_providers[].provider === 'linkedin'`.

**10. Riesgos**
- LinkedIn requiere HTTPS obligatorio en la Redirect URI (ya cubierto por `PUBLIC_APP_URL`).
- Si la Company Page usada para asociar la App queda "unpublished", el Client Secret se invalida.

---

## 3. Microsoft

**1. Estado actual** · 🟡 Implementado — sólo faltan credenciales oficiales.

**2. Archivos donde está implementado**
- `backend/services/community_auth.py:237-255` → `MicrosoftAuthProvider`
- `backend/services/community_auth.py:285` → `registry.register(MicrosoftAuthProvider())`
- `backend/routes/community_auth_routes.py:710-784` → `oauth_start` / `oauth_callback`
- `frontend/src/services/authService.js:131-135` → `AUTH_PROVIDERS.microsoft`

**3. Endpoints existentes**
- `GET /api/community/auth/oauth/microsoft/start`
- `GET /api/community/auth/oauth/microsoft/callback`
- El tenant configurado es `common` → acepta cuentas personales (Outlook/Xbox/Hotmail) + Azure AD (empresa/escuela).

**4. Variables de entorno necesarias**
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `PUBLIC_APP_URL`

**5. Redirect URI exacta**
- Preview: `https://future-core-5.preview.emergentagent.com/api/community/auth/oauth/microsoft/callback`
- Producción: `https://puntoceromultiservicios.com/api/community/auth/oauth/microsoft/callback`

Registrar en Azure Portal → App registrations → tu app → Authentication → Platform "Web" → Redirect URIs.

**6. Scopes utilizados** · `openid profile email User.Read`

**7. Permisos adicionales necesarios**
- Cuenta Microsoft Entra ID (ex Azure AD) — gratuita.
- Crear una App Registration.
- En "Supported account types" seleccionar "Accounts in any organizational directory and personal Microsoft accounts" (equivalente a tenant `common`).
- Generar un `Client Secret` con vigencia (recomendado 24 meses).
- Publisher verification NO requerida para OIDC básico con < 10 000 usuarios/mes.

**8. Qué falta exactamente**
- Registrar la App en Azure Portal.
- Copiar `Application (client) ID` + `Client secret value` a `.env` de producción.
- Registrar las dos Redirect URIs.
- Redeploy.

**9. Prueba de activación**
- `GET /api/community/auth/providers` debe listar `microsoft` en `enabled`.
- Botón "Microsoft" en `/join` deja de mostrar "PRONTO" y redirige a `login.microsoftonline.com/common/oauth2/v2.0/authorize?...`.
- Callback termina en `/` con sesión activa.

**10. Riesgos**
- El `Client Secret` **expira** (24 meses máx). Documentar recordatorio de rotación.
- Cuentas personales sólo entregan email si el usuario lo consiente explícitamente; el código ya tiene fallback a `preferred_username`.

---

## 4. Facebook

**1. Estado actual** · ❌ No implementado (sólo listado en `coming_soon`).

**2. Archivos donde está implementado**
- `frontend/src/services/authService.js:138` → `AUTH_PROVIDERS.facebook = { available: false }`
- `backend/routes/community_auth_routes.py:212` → aparece en `coming_soon`
- No existe `FacebookAuthProvider` en `services/community_auth.py`.

**3. Endpoints existentes** · Ninguno.

**4. Variables de entorno necesarias**
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

**5. Redirect URI exacta** · No aplica todavía (código pendiente). Sería:
- `https://puntoceromultiservicios.com/api/community/auth/oauth/facebook/callback`

**6. Scopes utilizados** · `email public_profile` (a implementar).

**7. Permisos adicionales necesarios**
- Cuenta Meta for Developers.
- App Facebook Login para producción → **requiere App Review** para pedir email a usuarios fuera del equipo.
- Verificación de dominio (`puntoceromultiservicios.com`).
- Aviso de privacidad y URL de deletion callback obligatorios.

**8. Qué falta exactamente**
- Crear `FacebookAuthProvider(OAuth2AuthorizationCodeProvider)` con:
  - `authorize_url = "https://www.facebook.com/v18.0/dialog/oauth"`
  - `token_url = "https://graph.facebook.com/v18.0/oauth/access_token"`
  - `userinfo_url = "https://graph.facebook.com/me?fields=id,name,email,picture"`
  - `scope = "email public_profile"`
  - `client_id_env = "FACEBOOK_APP_ID"`, `client_secret_env = "FACEBOOK_APP_SECRET"`
  - `_identity_from_userinfo` con mapeo `id → provider_user_id`, `email`, `name`, `picture.data.url`.
- Registrar `registry.register(FacebookAuthProvider())`.
- Reversal: `Data Deletion Callback` endpoint público (requisito Meta).

**9. Prueba de activación** · Repetir procedimiento estándar (`/providers` lo debe listar, botón se activa, callback vuelve autenticado).

**10. Riesgos**
- App Review de Meta puede tardar 1-2 semanas.
- Meta suspende Apps que no cumplan políticas de privacidad — obligatorio agregar URL "Data Deletion" y "Privacy Policy" que vivan en producción.

---

## 5. Apple

**1. Estado actual** · ❌ No implementado.

**2. Archivos donde está implementado**
- `frontend/src/services/authService.js:137` → `AUTH_PROVIDERS.apple = { available: false }`
- `backend/routes/community_auth_routes.py:209` → aparece en `coming_soon`.
- No existe `AppleAuthProvider`.

**3. Endpoints existentes** · Ninguno.

**4. Variables de entorno necesarias**
- `APPLE_CLIENT_ID` (Service ID, no App ID)
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (contenido del `.p8`, multi-línea)

**5. Redirect URI exacta** · A registrar cuando exista código:
- `https://puntoceromultiservicios.com/api/community/auth/oauth/apple/callback`

**6. Scopes utilizados** · `name email` (Apple es muy restrictivo, sólo primera vez).

**7. Permisos adicionales necesarios**
- Apple Developer Program (**US$99/año**, obligatorio).
- Crear un "Services ID" habilitado para "Sign In with Apple".
- Crear una `Sign in with Apple` **Private Key** (`.p8`) desde el portal.
- Verificar el dominio productivo (Apple exige subir un archivo `.well-known/apple-developer-domain-association.txt`).
- Registrar el email `noreply@puntoceromultiservicios.com` como sender configurado (Apple obliga a soportar emails de relé privado).

**8. Qué falta exactamente**
- Implementar `AppleAuthProvider` con la particularidad de que el `client_secret` es un **JWT firmado con ES256** que se debe regenerar cada 15 minutos (no un secreto estático).
- Manejar el `form_post` como response mode (Apple no usa `query`, envía POST al callback).
- Endpoint `POST /api/community/auth/oauth/apple/callback` en vez del `GET` genérico → **requiere refactor del router genérico**.
- Registrar redirect en el Services ID del portal.
- Configurar dominio verificado.

**9. Prueba de activación**
- `/providers` lista `apple` en `enabled`, botón se activa.
- Al primer login Apple envía nombre + email; en logins siguientes sólo un identificador estable.

**10. Riesgos**
- Costo anual del programa Developer.
- Complejidad extra por JWT client_secret + verificación de dominio.
- Apple pide re-verificar el dominio si cambia el DNS o el hosting.

---

## 6. X (Twitter)

**1. Estado actual** · ❌ No implementado.

**2. Archivos donde está implementado**
- `frontend/src/services/authService.js:139` → `AUTH_PROVIDERS.twitter = { available: false }`
- `backend/routes/community_auth_routes.py:213` → aparece en `coming_soon` con key `twitter`.
- No existe `TwitterAuthProvider`.

**3. Endpoints existentes** · Ninguno.

**4. Variables de entorno necesarias**
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`

**5. Redirect URI exacta** · A registrar cuando exista código:
- `https://puntoceromultiservicios.com/api/community/auth/oauth/twitter/callback`

**6. Scopes utilizados** · `users.read tweet.read offline.access` (X OAuth 2.0 con PKCE).

**7. Permisos adicionales necesarios**
- Cuenta X Developer con nivel **Basic (US$100/mes)** como mínimo para OAuth 2.0 estable. El nivel Free existe pero es muy limitado y cambia sin aviso.
- Crear un proyecto y una App dentro del proyecto.
- Habilitar OAuth 2.0 con PKCE en la App.

**8. Qué falta exactamente**
- Implementar `TwitterAuthProvider` — diferente al patrón LinkedIn/Microsoft porque **X requiere PKCE** (`code_challenge` + `code_verifier` almacenados con el `state`).
- Endpoints:
  - `authorize_url = "https://twitter.com/i/oauth2/authorize"`
  - `token_url = "https://api.twitter.com/2/oauth2/token"` (usa Basic Auth con `client_id:client_secret`)
  - `userinfo_url = "https://api.twitter.com/2/users/me?user.fields=name,profile_image_url"`
- Extender `oauth_states` para persistir `code_verifier`.
- X NO devuelve email por default → mostrar mensaje "Completa tu email" tras login.

**9. Prueba de activación**
- `/providers` lista `twitter` como habilitado, botón activa flujo.
- Post-callback, `me` devuelve usuario con `email` opcionalmente null (a completar por el usuario).

**10. Riesgos**
- Costo mensual del plan Basic de X.
- API v2 de X ha tenido cambios frecuentes de precios y rate-limits desde 2023.
- Sin PKCE el token exchange falla — no reutilizable con el flujo genérico actual.

---

## Conclusión

### 1. ¿Qué proveedores pueden activarse HOY MISMO sin escribir una sola línea de código?
- **Google** — ya está activo en producción.

### 2. ¿Qué proveedores requieren únicamente configurar variables de entorno (+ registrar Redirect URI en el portal del proveedor)?
- **LinkedIn** — `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`
- **Microsoft** — `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET`

Ambos se auto-habilitan en cuanto las variables aparecen en el `.env` de producción y se hace redeploy.

### 3. ¿Qué proveedores sí necesitan desarrollo adicional?
- **Facebook** — falta implementar `FacebookAuthProvider` (patrón estándar, ~30 líneas).
- **X (Twitter)** — falta implementar `TwitterAuthProvider` con soporte PKCE (necesita extender `oauth_states`, ~60 líneas).
- **Apple** — falta implementar `AppleAuthProvider` con JWT dinámico como `client_secret` + `form_post` response_mode (~90 líneas, más complejo).

### 4. Orden recomendado de activación para Punto Cero One

| Prioridad | Proveedor | Rationale |
|-----------|-----------|-----------|
| P0 (ya listo) | Google | Activo. |
| P0 | **LinkedIn** | Máximo ROI para audiencia profesional/B2B latinoamericana. Sólo config. |
| P1 | **Microsoft** | Cubre corporativos + estudiantes latinoamericanos con cuentas Office 365 / Outlook. Sólo config. |
| P2 | **Facebook** | Amplía captación mainstream. Requiere App Review de Meta (1-2 semanas). |
| P3 | **X (Twitter)** | Coste mensual justifica sólo cuando la comunidad supere miles de miembros. |
| P4 | **Apple** | Sólo si se lanza una app móvil nativa iOS/App Store (Apple exige "Sign In with Apple" al ofrecer otros logins sociales en la App Store, pero no en la web pura). |

---

## Anexo · configuración de env (producción)

Ejemplo de variables a añadir al `.env` de producción cuando llegue el momento (no aplicar ahora, es sólo referencia):

```
# ya en uso
EMERGENT_AUTH_URL=https://auth.emergentagent.com
EMERGENT_AUTH_SESSION_URL=https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data
PUBLIC_APP_URL=https://puntoceromultiservicios.com

# LinkedIn (pendiente)
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Microsoft (pendiente)
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```
