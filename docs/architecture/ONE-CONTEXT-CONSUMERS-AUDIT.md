# One Context Consumers Audit

**Fecha:** 2026-10-03
**Método:** lectura estática de consumidores frontend/backend. No se modificó
runtime. La clasificación se refiere a alineación con una futura fuente
contextual común; no es una evaluación de calidad general del componente.

## 1. Resumen

One aún no tiene un `WorkspaceUserContext` único. La sesión/cuenta se expone por
dos contextos con contratos distintos (`AuthContext` JWT y
`CommunityAuthContext` cookie); el contexto de destino (`systemContext`), el
contexto de acceso (`accessContext`), preferencias UI, layout de workspace y
perfil se cargan por servicios/providers independientes.

Esta separación es parcialmente deliberada: administra credenciales y dominios
distintos, y el login preserva la sesión si fallan contextos opcionales. No
debe eliminarse simplemente agregando todos los campos a un contexto
monolítico. Sí es candidata a centralizarse la **composición de lecturas y
tipos/semánticas**, manteniendo stores y owners separados.

## 2. Clasificación

Categorías:

- **correcto:** responsabilidad limitada y fuente reconocible para su dominio;
- **duplicado:** el mismo concepto/cálculo se mantiene en más de un sitio;
- **parcial:** soporta parte del contexto, pero falta contrato o cobertura;
- **obsoleto:** código/ruta sin uso de producto confirmado o que no corresponde
  al modelo objetivo; no borrar sin prueba adicional;
- **dependiente de Identity:** necesita vínculo/resolución transversal de
  `entity_id`;
- **dependiente de Billing:** necesita fuente de suscripción/pago/entitlement
  de Billing.

La categoría “dependiente” puede coexistir conceptualmente con el estado
parcial. Para que la matriz sea tabular, se marca en su propia columna.

| Categoría / consumidor | Campos que lee/compone | Fuente actual y observación | Clasificación | Depende de Identity | Depende de Billing |
| --- | --- | --- | --- | --- | --- |
| `AuthContext` | usuario, token, `systemContext`, `accessContext` | `/api/auth/me`, `/api/auth/system-context`, Access Bridge; puede mantener login si fallan los dos contextos | **parcial** | Solo las operaciones que consumen Access Bridge con `entity_id`; no para login | No demostrado |
| `CommunityAuthContext` | usuario cookie, refresh/logout | Cookie/API de comunidad; usuarios de comunidad consumidos por muchas páginas y componentes | **parcial** | No para comunidad local | No |
| `AuthContext` + `CommunityAuthContext` juntos | dos sesiones/representaciones de usuario | JWT y cookie coexistentes; `identity_core` compara IDs y puede emitir 409 si difieren | **duplicado / separación legítima pendiente de decisión** | Sí para su correlación con identidad canónica en Bridge | No |
| `coreLegalContext.js` | usuario Legal, roles, verticales, organization/tenant/firm, workspace/path, permisos | Normaliza contrato de Core Legal hacia shape One; preserva ruta Legal | **parcial** | Sí para linking One↔Legal; adapter actual no usa/crea entity ID | No |
| `accessContext.js` | subject, `entityId`, system/type, `availableSpaces`, entitlements | Cliente frontend de `/api/access/entitlements`; null si Bridge falla | **correcto como cliente / dependiente de Identity** | Sí: backend requiere mapping canónico | No |
| `accessBridgeEntry.js` / `systemEntryRules.js` | workspace disponible, recomendación, verticals, roles, ruta | Decide destino/UI; combina recomendaciones y fallbacks del contexto | **parcial** | No crea identidad; consume shape/contextos que pueden incluir identidad | No |
| `workspaceOrchestrator.js`, `workspaceActivation.js` | workspace Registry, lifecycle/launchMode, acceso | Lee workspace frontend Registry; valida launchMode/entitlements | **duplicado/parcial** por espejos y múltiples ejes | No, salvo que el permiso/consumidor concreto requiera Bridge | No |
| `workspaceCatalog.js` | lifecycle, status y disponibilidad derivada | Catálogo frontend manual; deriva disponibilidad | **duplicado** respecto a autoridad/proyección backend | No | No |
| `workspaceRegistry.js` (frontend) | verticales, workspaces, status, launchMode | Mirror separado del Registry backend; drift Medical preview/enabled vs backend declared | **duplicado** | No | No |
| `workspaceSpaces.js` + `identity_core.SPACE_CATALOG` | key, label, path, estado de navegación, vertical | Catálogos de navegación/mirror; vocabulario available/coming_soon/external no es lifecycle | **duplicado** | No | No |
| `sessionManager.js` / `accessBridgeClient.js` | sesión, entitlements, spaces, `activeVertical`, intent | Mantiene segundo estado de sesión del ecosistema y consulta Bridge; requiere `entry_url`, permission y `status=live` para lanzar | **duplicado/parcial** con AuthContext y orchestrator; reglas de lanzamiento específicas | Sí para intent/entitlement que requiere entity ID | No |
| `WorkspaceContext.jsx` | usuario cookie, layout/widget preferences, identidad visual (`personal/profesional/empresa`) | `/api/workspace/me`, presets, localStorage; la “identity” de Mi Espacio es preferencia UI por browser, no identidad canónica | **parcial; nombre ambiguo** | No | No |
| `UIPreferencesContext.jsx` | usuario cookie, `ui_preferences`, theme/colores | Carga y autosave a `/api/community/users/me`; cache write-through de preferencias | **correcto dentro de UI / parcial como contexto general** | No | No |
| `profileService.js`, `ProfilePage`, `ProfileCustomizePage`, `PublicProfilePage` | perfil/identidad visual/media | API de perfil One; usuario viewer viene de CommunityAuthContext | **parcial** | No para perfil local; sí para federación de perfiles | No |
| `identity_core.resolve_identity()` | usuario JWT/cookie, verticales, organizations, account type, workspaces | Deriva contexto desde `users`, companies/owner/team y heurísticas de perfil; no lee entity ID | **parcial / dependiente de contexto backend** | No para derivar contexto One; no vincula fuentes | No |
| `entitlement_service.py` | subject, verticals, organizations, role/status, Registry | Backend deriva `workspace.open.*` y Policy evalúa | **correcto dentro del backend; vocabulario sujeto a contrato** | Bridge pasa `entity_id` como subject | No |
| `frontend/src/system/entitlements.js` | context verticals/organizations/workspaces y derivación permisos | Recalcula `workspace.open.*` como fallback en frontend pese a que comentario dice que frontend no decide permisos | **duplicado / riesgo obsoleto**; confirmar callers antes de retirar | No para el cálculo en sí | No |
| `Access Bridge` HTTP/routes + `services/access_bridge.py` | identidad canónica, context, entitlements, Registry, route, intent | Ruta hace lecturas Mongo y policy; servicio intent es en memoria; falla cerrado sin entity ID | **correcto para el contrato actual / dependiente de Identity** | Sí | No |
| `identity_registry.py` / `system_identity.py` | source, external_id, entity ID, profiles | Registry define owner token; servicio local One genera/lee/escribe (funciones presentes); no hay materialización automática en alta normal | **parcial / ownership sin reconciliar** | Sí | No |
| Backend `company_routes.py` / `identity_core.resolve_organizations` | user ID, owner ID, team user ID, organization context | One guarda companies y calcula relaciones owner/team; `user_id` de team es opcional | **parcial** por referencias no universales y snapshot local no reconciliado | Sí solo para owner persona transversal | No |
| `systemEntryRules.resolveIdentityType` / workspace placeholder | profile/account type, organizations, verticals, workspace key | Deriva personal/profesional/organización/agente y resuelve rutas; `/agent` apunta a placeholder Legal | **parcial; agente/organización no son workspaces canónicos separados** | No para renderizar tipo; sí para vínculo transversal | No |
| Agent context / routes | rol `agent`, placeholder `/agent` | No se encontró Agent workspace/entidad persistida separada en superficies revisadas | **obsoleto/incompleto** para afirmar un contexto de agente completo; no borrar | Pendiente si necesita principal transversal | No |
| `user_workspaces` / Workspace backend | layout, paneles, widgets, theme por usuario | Preferencia Mi Espacio; no es membership | **correcto como preferencia, potencial naming confusion** | No | No |
| Comunidad UI: feed, mensajes, follow, events, notifications, sidebar | usuario community, IDs locales, profile/preferences | Varios componentes leen directamente `useCommunityAuth()`; lógica por dominio y vista | **parcial / patrón repetido** | No para operación local; sí federación/deduplicación futura | No |
| Empresas UI: `CompaniesPage`, `CompanyProfilePage`, media | user community y owner_id local | CRUD/lectura se apoya en cuenta One y relación `owner_id` | **correcto en dominio local; referencias de datos no resueltas en snapshot** | Solo si se necesita ownership/persona cross-system | No |
| Protected Admin/Investor routes, investor portal/setup | usuario/token/role | Consumen `AuthContext`; roles legacy/product-specific | **parcial**; no son workspace context general | No | Billing no demostrado; investor requests no equivalen subscription |
| Notification surfaces / region hook | community user; ubicación/IP para contenido/region | Consume CommunityAuth o detección regional específica | **duplicado/parcial** según finalidad; región no equivale a country verificado | No | No |
| Billing context / subscriptions | No se encontró consumidor/ruta integrada en las superficies auditadas | Billing Core está documentado fuera de One; no se encontró contrato conectado | **obsoleto/no localizado** como consumer runtime, sujeto a verificar fuera de alcance | Puede depender si correlaciona una persona | **Sí, cualquier suscripción/pago real** |

## 3. Lectura por categoría de datos

### Usuario

- Componentes de login/admin usan `AuthContext`; comunidad, perfil, feed y
  vistas sociales usan `CommunityAuthContext`.
- La duplicidad de contextos refleja sesiones/contratos distintos, no
  necesariamente dos cuentas que deban fusionarse. Centralizar composición no
  significa compartir tokens o eliminar un mecanismo.
- APIs exponen variaciones (`id`, `user_id_core`, roles normalizados,
  `core_role`); deben permanecer namespaced y conservar procedencia.

### Workspace

- El Registry backend define el catálogo efectivo y policy consulta entitlements.
- Frontend usa `workspaceCatalog.js`, `workspaceRegistry.js`,
  `workspaceSpaces.js`, `workspaceIdentity.js`, `sessionManager.js`,
  `workspaceOrchestrator.js` y gestores/widget registry con significados
  diferentes.
- La duplicación más riesgosa es la repetición de keys/status/route/launchMode
  donde los consumers interpretan Lifecycle, Availability, launchability,
  navegación y Location como si fueran intercambiables.
- `WorkspaceContext` no es el catálogo de workspace access: persiste
  preferencias de layout/widgets.

### Organization / Professional / Agent

- `identity_core` deriva verticales a partir de campo directo o señales del
  perfil y obtiene organización desde `companies.owner_id`/team.
- Legal adapter normaliza organization/firm/tenant/workspace de un contexto
  externo; esos IDs no son comparables sin source.
- `professional` existe como tipo/contexto y atributos, pero no hay entidad
  `professionals` separada confirmada.
- `agent` aparece en vocabulario/ruta placeholder, no en una entidad/workspace
  canónica observada. Estado: incompleto, no borrar automáticamente.

### Billing y preferencias

- Preferencias aparecen en dos concerns separados: `UIPreferencesContext`
  (`ui_preferences`) y `WorkspaceContext` (layout/widgets, más identidad
  visual local). No juntarlas en un campo libre sin distinguir scopes.
- No se localizó un consumer de Billing Runtime ni subscription context. Evitar
  añadir estado pago a `AuthContext` hasta que el owner de Billing publique
  contrato.

## 4. Qué debería centralizarse

Centralizar en una futura capa de composición/contrato, no necesariamente en un
provider monolítico:

1. Tipos namespaced para user/workspace/vertical/organization/profile
   references, con source y versión de contrato.
2. Normalización de shape y estado de carga/error de contextos existentes,
   manteniendo AuthContext, CommunityAuthContext y owners de cada API.
3. Adaptación explícita del contexto Legal como bridge versionado, sin copiar
   autoridad de `path`, IDs o permisos.
4. Lectura de `available_workspaces`/entitlements desde Bridge donde ya es
   autoridad, con distinción de navegación y lifecycle.
5. Preferencias por scope (account UI vs workspace layout) separadas del
   contexto de autorización.

## 5. Qué debería desaparecer — solo tras prueba y migración

- Derivaciones de `workspace.open.*` en frontend (`system/entitlements.js`)
  para decisiones que afecten autorización; el frontend no debe ampliar
  permisos. Antes de retirar, buscar todos los callers/tests y clasificar
  función como presentación o control real.
- Catálogos frontend duplicados de lifecycle/route/launch configuration una
  vez que cada consumer use projection/runtime contract y se conserve el
  vocabulario de navegación no compartido. No eliminar `workspaceRegistry.jsx`
  de widgets: es otro registry.
- Fallbacks automáticos que conviertan datos de contexto ausentes en grants,
  verticales activas o una relación Organization/Agent asumida.
- Identidad local de Mi Espacio no se debe renombrar/eliminar por parecerse a
  `entity_id`: es una preferencia de layout que sigue siendo útil.

No hay evidencia suficiente en esta auditoría para borrar código marcado
obsoleto/incompleto. Requiere inspección de callers, telemetría y plan de
deprecación.

## 6. Riesgos y pendientes

- AuthContext y CommunityAuthContext pueden divergir; el backend puede responder
  409 cuando ambas sesiones apuntan a distintos IDs.
- Los Mirrors de Workspace tienen drift de lifecycle, incluido Medical
  `preview` frontend frente a `declared` backend.
- El frontend `entitlements.js` deriva permissions pese a existir autoridad
  backend; su uso efectivo requiere confirmación antes de migrar/remover.
- Identity sigue BLOCKED; Access Bridge no puede servir operaciones que exigen
  `entity_id` sin mapping.
- Billing y Darwin IA no tienen contratos de consumer confirmados en la
  superficie revisada.
- Membership universal user↔workspace no se ha demostrado; `user_workspaces`
  es preferencias.
- Datos de Legal/Medical no deben añadirse a One context por conveniencia.

## Fuentes revisadas

- `frontend/src/contexts/AuthContext.jsx`, `CommunityAuthContext.jsx`,
  `WorkspaceContext.jsx`, `UIPreferencesContext.jsx`
- `frontend/src/system/accessContext.js`, `accessBridgeEntry.js`,
  `systemEntryRules.js`, `entitlements.js`
- `frontend/src/system/workspaceCatalog.js`, `workspaceRegistry.js`,
  `workspaceEnrollment.js`, `workspaceOrchestrator.js`,
  `workspaceProvisioning.js`, `sessionManager.js`
- `frontend/src/system/coreLegalContext.js`
- `frontend/src/services/profileService.js`, `workspaceService.js`,
  `workspaceBridge.js`
- Backend: `models.py`, `models_business.py`, `identity_core.py`,
  `entitlement_service.py`, `access_bridge_routes.py`, `company_routes.py`,
  `workspace_registry.py`
- [WORKSPACE-USER-CONTEXT-CONTRACT.md](./WORKSPACE-USER-CONTEXT-CONTRACT.md)
- [ONE-EVOLUTION-READINESS.md](./ONE-EVOLUTION-READINESS.md)
