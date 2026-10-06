# Punto Cero One Evolution — Readiness

**Estado:** Evaluación de arquitectura basada en código/documentación observados;
no es aprobación de release ni cambio de lifecycle.

**Identity readiness:** **BLOCKED — NOT READY** para materialización automática.

## Matriz

| Funcionalidad | Estado actual observado | Depende de Identity | Puede avanzar ahora |
| --- | --- | --- | --- |
| **Feed** | Funcionalidad comunitaria y rutas de feed existen en One; usan usuario/contexto One y reglas locales del feed. | **No** para desarrollo/funcionamiento dentro de One; sí para una correlación transversal futura que no debe alterar el sujeto de auth. | **Sí**, con `users.id`, controles actuales y sin compartir perfiles o datos entre verticales. |
| **Comunidad** | Sesión/cuenta, comunidad y superficies de contenido existen; Access Bridge es integración separada. | **No** para experiencia y relaciones de comunidad locales. Sí si un consumidor requiere un `entity_id` canónico, caso en que se conserva el comportamiento fail-closed existente. | **Sí**, sin hacer que identidad sea requisito nuevo del login. |
| **Directorio** | Búsqueda/directorio y superficies de discovery existen en la aplicación; población/datos permanecen en los dominios actuales. | **No** para directorios locales; **sí** para una búsqueda federada de personas entre One/Legal/Medical que deduplique perfiles. | **Sí**, limitado al dominio autorizado de One; federación queda bloqueada. |
| **Empresas** | `companies`, rutas CRUD, `owner_id` y `team` embebido existen en One. Medición local previa observó 41 companies y 0 owner matches contra los cuatro users del snapshot. | **No** para CRUD local autenticado; sí para propietario transversal/reconciliación entre dominios. | **Sí**, sin corregir owners ni asignar `entity_id` a empresa. Clasificar referencias locales primero si afectan esa población. |
| **Profesionales** | Hay señales/campos profesionales dentro de perfiles One y resolución contextual por verticales. No se encontró un workspace/entidad persistente separada `professionals`. | **No** para edición/presentación del perfil One; **sí** para verificación o vínculo transversal a Legal, Medical u organizaciones. | **Sí** para perfil One; credenciales verificadas, licencias y federación requieren contratos del dominio. |
| **Workspace** | Backend Registry define keys, lifecycle, availability derivada, launchMode y location; Bridge/Policy exponen/validan acceso. Frontend aún mantiene mirrors/catálogos. | **No** para diseño, contratos, selector y migración del Registry. **Sí** para Access Bridge productivo cuando no hay identidad canónica: hoy falla cerrado. | **Sí**: consumer-by-consumer design, reconciliación de drift y UX sin conectar proyección al runtime hasta aprobación. |
| **Billing** | No se identificó una ruta/servicio de Billing dentro del alcance consultado; los documentos de arquitectura anteriores sitúan Billing Core fuera de One. | No para analizar separación de dominio; **sí** si Billing requiere correlación persona transversal o entitlement global. | **Parcial**: contratos de integración y límites pueden diseñarse; transacciones, subscripciones y ownership no deben implementarse por inferencia. |
| **Darwin IA** | Se identificó referencia/documentación de Darwin Core como core externo, pero no se encontró en las superficies revisadas un cliente/ruta de integración de Darwin en One. | **No** para planificar un consumidor aislado; **sí** si necesita identidad/correlación transversal o política por persona. | **Parcial**: especificar límites, privacidad y autorización; integración real bloqueada hasta contrato/servicio y autorización de datos. |
| **Punto Cero Legal** | Core Legal mantiene contrato/contexto propio; `coreLegalContext.js` adapta roles/verticales/workspace/path para One. No se cambia Legal Core. | **No** para conservar el bridge/contexto actual. **Sí** para un mapping de persona One↔Legal o identidad federada. | **Sí**, mantener/adaptar solo presentación/contratos existentes dentro del alcance aprobado; linking canónico sigue bloqueado y requiere aprobación Legal. |
| **Punto Cero Medical** | Medical y especialidades aparecen en Workspace Registry y espejo frontend, pero con discrepancia: backend `declared`, frontend Medical `preview`/enabled; subverticales están `declared`. No se concluye despliegue clínico desde el catálogo. | **No** para diseño del workspace/contrato; **sí** para usuario transversal entre One y Medical, si se aprueba. | **Sí** en análisis de contrato y reconciliación del lifecycle; activar, abrir o conectar datos clínicos queda bloqueado. |
| **Odontología, Psicología, Enfermería** | Claves existen como subverticales/workspaces declarados; no se verificó experiencia clínica completa en las superficies consultadas. | **No** para diseño; **sí** para vincular persona/profesional entre dominios. | **Sí** para contratos y límites. Implementar acceso clínico/credenciales/datos requiere decisiones de vertical y autorizaciones propias. |
| **Workspace Organization / Agent / Professional** | `systemEntryRules.js` reconoce `organizacion`, `agente` y `profesional` como tipos de cuenta/contexto; no hay entradas canónicas separadas para organization/agent/professional en el Workspace Registry revisado. `/agent` apunta a un placeholder legal. | **No** para especificar estos conceptos; **sí** para convertirlos en relación universal persona/profile si así se aprueba. | **Sí** para designar límites conceptuales; implementación de workspaces independientes/memberships requiere definición funcional y contratos propios. |

## Hallazgos de auditoría

### Ya soportado por One

- Cuenta de usuario, autenticación existente, perfil, sesión y relaciones de
  producto con `users.id`.
- Comunidad/feed, perfiles profesionales como atributos, compañías/owners y
  preferencias Workspace en el dominio One.
- Contexto de sistema y composición de verticales/organizaciones en
  `identity_core`, más normalización de contexto Legal en frontend.
- Workspace Registry backend y acceso derivado por Bridge/entitlements/policy.
- `AuthContext` carga usuario autenticado y solicita contexto de sistema y
  Access Bridge. Fallos de estos contextos pueden dejar el contexto `null` sin
  invalidar el login.

### Qué falta

- Owner operativo y servicio Identity aprobados; no crear materialización
  durante esta fase.
- Context contract común tipado para `user_id`, perfiles, preferencias,
  workspaces disponibles y verticales habilitadas.
- Consistencia de lifecycle entre backend Registry y mirror frontend.
- Contratos específicos para relaciones professional/organization/agent; hoy
  hay tipos/reglas parciales, no workspaces universales canónicos separados.
- Servicio/contrato autorizado para Billing y Darwin IA, si aplican; su
  presencia no se da por demostrada en el runtime auditado.
- Resolución de disponibilidad, launchability, LaunchMode y Location en cada
  consumidor, sin reutilizar un eje como otro.
- Crosswalks Legal/Medical con evidencia, permisos y owner de cada fuente.

### Qué depende de Identity

- Linking entre una persona One y un principal/perfil Legal, Medical u otra
  vertical.
- Deduplicación/reconciliación de una misma persona entre sistemas.
- Access Bridge para endpoints que exigen el `entity_id`; no resuelve si la
  Identity Authority no tiene mapping y su contrato actual falla cerrado.
- Cualquier membership global basada en persona transversal.

### Qué puede construirse sin Identity

- Desarrollo de comunidad/feed, perfil One, preferencias y empresas dentro del
  namespace One y con las autorizaciones actuales.
- Contratos/schemas de Workspace y migración controlada de consumidores desde
  mirrors, una vez resuelto drift sin alterar lifecycle/LaunchMode/Location.
- UX del selector y separación de conceptos, sin cambiar lo que el backend
  autoriza.
- Diseños y pruebas aisladas de integración de Legal/Medical que usen
  identidades nativas y no escriban mappings canónicos; la conexión productiva
  queda sujeta a la aprobación del dominio y no se incluye aquí.
- Diseño de límites de Billing/Darwin como sistemas externos, sin transacciones
  ni acceso a datos no contratados.

## Bloqueos y cautelas

1. Identity permanece **BLOCKED — NOT READY** para escrituras/materialización.
   La decisión operativa no está aprobada.
2. Backend declara Medical y subverticales `declared`; frontend mirror tiene
   Medical `preview`/enabled. No cambiar el estado por este documento; tratar
   el conflicto como bloqueo para cualquier migración que altere UX/acceso.
3. El workspace `comunidad` y la superficie community de One no son sinónimos
   automáticos de todos los workspaces de verticales.
4. `profile.verticals`, roles o recomendaciones de ruta no otorgan permisos.
5. La presencia de rutas placeholder no prueba un workspace productivo.
6. Billing y Darwin IA requieren confirmación contractual en su propio carril;
   no se infiere producto habilitado a partir de la lista de dominios.

## Próximo carril recomendado

Avanzar con **ONE Evolution — Workspace/User Context design**: acordar el
contrato de contexto y migración consumer-by-consumer del Workspace Registry,
comenzando por una matriz de fuentes y ownership y resolviendo el drift
backend/frontend sin cambiar runtime. Mantener fuera de ese carril la
materialización Identity, el linking Legal/Medical, la activación de verticales
y la implementación de Billing/Darwin hasta contar con sus decisiones y
contratos propietarios.

## Fuentes revisadas

- `backend/services/workspace_registry.py`
- `backend/routes/access_bridge_routes.py`
- `backend/services/identity_core.py`
- `backend/models.py`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/system/workspaceRegistry.js`
- `frontend/src/system/systemEntryRules.js`
- `frontend/src/system/accessContext.js`
- `frontend/src/system/coreLegalContext.js`
- `backend/routes/company_routes.py`
- `backend/models_business.py`
- `backend/routes/feed_routes.py`
- [WORKSPACE-LAUNCH-CONTRACT.md](./WORKSPACE-LAUNCH-CONTRACT.md)
- [WORKSPACE-LOCATION-CONTRACT.md](./WORKSPACE-LOCATION-CONTRACT.md)
- [WORKSPACE-PROJECTION-MIGRATION.md](./WORKSPACE-PROJECTION-MIGRATION.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
