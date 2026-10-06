# Identity Environment Discovery

**Fecha de medición local:** 2026-10-03
**Método:** consultas Mongo de solo lectura contra la base configurada por
`backend/.env`; salida limitada a conteos agregados. No se mostraron
identificadores, correos ni valores de configuración.
**Cambios de datos/runtime:** ninguno.

## 1. Cobertura por entorno

| Entorno | Estado | Evidencia y límite |
| --- | --- | --- |
| **LOCAL** | **Disponible; medido** | Mongo respondió al ping; base `punto_cero_local`. La medición cubrió las colecciones existentes en ese entorno en el momento de consulta. Es un snapshot pequeño y no representa otras bases ni población histórica. |
| **STAGING** | **DESCONOCIDO / no consultado** | No se usaron credenciales ni conexiones de staging. No afirmar conteos, cobertura ni existencia de datos. |
| **PRODUCCIÓN** | **DESCONOCIDO / no consultado** | No se usaron credenciales ni conexiones de producción. Las cifras locales no permiten inferir métricas de producción. |

## 2. Colecciones y entidades locales observadas

| Entidad | Registros observados | Tiene `entity_id` | Riesgo / interpretación |
| --- | ---: | --- | --- |
| Usuarios One (`users`) | 4 | **4/4** tienen exactamente una identidad `pc_usr_*` válida enlazada mediante perfil `punto_cero_system` y `external_id = users.id` | Cobertura local 100% de una muestra de cuatro. No es evidencia de cobertura de cuentas fuera de esta base. |
| Identidades canónicas (`system_identities`) | 4 | **4/4** IDs válidos; 0 documentos sin perfiles; 0 perfiles de owner sin correspondencia en los `users.id` actuales | No se observaron duplicados de `entity_id`, perfiles del owner duplicados entre identidades ni links externos que apunten a varias identidades. La medida no prueba unicidad de índices en despliegue ni ownership operativo. |
| Señales de perfil profesional en `users` | 3 usuarios con uno o más campos de señal | Los 3 están entre los cuatro usuarios enlazados | Es un indicador por presencia de campos (`verticals`, `specialties`, `skills`, `headline`, `current_title`, `legal_role`), no un padrón de profesionales verificados. |
| Empresas (`companies`) | 41 | No se observó `entity_id` propio como parte de esta medición; se revisaron owner/team refs | **0/41** `owner_id` coinciden con los cuatro `users.id` observados; 0 referencias `team[].user_id`. No demuestra que las empresas sean inválidas: podrían corresponder a semillas, otra cohorte o referencias históricas. |
| Organizaciones (`organizations`) | Colección ausente | No aplica | No existe una población separada que permita medir cobertura de organización. `companies` no se convierte por ello en identidad canónica. |
| Agentes (`agents`) | Colección ausente; 0 usuarios con `role=agent` | No aplica como entidad independiente | No hay población/agente persistido visible en esta base. El rol por sí solo no es una identidad ni acredita afiliación. |
| Profesionales (`professionals`) | Colección ausente | No aplica como entidad separada | Los indicadores profesionales viven en documentos `users`; no equivalen a registro/verificación profesional. |
| Sesiones (`user_sessions`) | 22 | No se asigna `entity_id` a la sesión; su referencia de cuenta usa `user_id` | Sesión y usuario son entidades distintas. No se infiere la cobertura de sesión a partir del conteo de sesiones. |
| Preferencias Workspace (`user_workspaces`) | 0 | No aplica | No se encontró membresía en esta colección durante la medición; por semántica conocida guarda preferencias, no membresías universales. |
| Legal Core | No consultado | Desconocido | La ausencia de filas/colección local no es evidencia de que Legal no tenga usuarios o perfiles. No se realizó cruce con `user_id_core`. |

## 3. Integridad observada local

| Comprobación | Resultado local |
| --- | ---: |
| Usuarios One con exactamente una identidad canónica válida | 4/4 |
| Usuarios sin identidad canónica | 0 |
| Usuarios ligados a varios `entity_id` | 0 |
| Documentos de identidad con `entity_id` válido | 4/4 |
| Identidades sin perfil | 0 |
| Perfil `punto_cero_system` sin `external_id` | 0 |
| Perfil de owner cuyo `external_id` no corresponde a los `users.id` actuales | 0 |
| Mismo `(source, external_id)` distribuido entre múltiples `entity_id` | 0 |
| Emails repetidos después de trim/lowercase | 0 |
| Owners de company que coinciden con un usuario actual | 0/41 |
| Referencias `team[].user_id` observadas en companies | 0 |

Los conteos de correo se calcularon en memoria y solo se retuvo/publicó el
número de duplicados; no se incluyeron valores. Estos controles son conteos
del snapshot, no una auditoría de unicidad histórica o de la garantía de
índices Mongo.

## 4. Referencias huérfanas e inconsistencias visibles

### Observadas

- No se observaron perfiles de identidad huérfanos respecto a los cuatro
  `users.id` actuales bajo el token `punto_cero_system`.
- No se observaron usuarios sin identidad, múltiples identidades para un
  usuario, email repetido normalizado o un perfil externo compartido entre
  varios `entity_id`.
- No se resolvieron los 41 `companies.owner_id` contra el conjunto actual de
  cuatro IDs de usuario, y no aparecen miembros `team[].user_id`. Debe
  clasificarse la cohorte antes de llamar a estos datos “usuarios huérfanos”:
  no se conoce aquí si son semillas, registros antiguos o personas de otra
  población.
- Hay 22 sesiones y 4 usuarios. El número de sesiones no equivale a cuentas
  distintas, no prueba referencias válidas y no indica cuántas sesiones tienen
  sujeto canónico; no se realizó un análisis de valores individuales.
- No existen colecciones locales separadas para organizaciones, agentes o
  profesionales en la lista observada. Esto limita el universo consultable; no
  prueba que las entidades no existan fuera de One.

### No observables/no resueltos

- Duplicidad semántica de personas entre One y Legal.
- Estado, cobertura o huérfanos en staging/producción.
- Cobertura de usuarios históricos eliminados o de fuentes externas no
  representadas en la base actual.
- Si los 41 owner IDs de empresa tienen una correspondencia válida fuera de los
  cuatro usuarios actuales.
- Si las constraints/índices únicos existen y están sanos en cada entorno
  operacional.
- Linaje de quién creó las cuatro identidades locales: la presencia de los
  documentos no demuestra qué flujo, actor o fecha los materializó.

## 5. Auditoría de Access Bridge

### Qué lee

En `backend/routes/access_bridge_routes.py`, `_access_context()`:

1. Toma la base desde `request.app.state.db`.
2. Obtiene el usuario de comunidad con `current_user_or_none()` y recibe el
   usuario JWT desde la dependencia de la ruta.
3. Resuelve estado efectivo mediante `_resolved_status()`.
4. Llama a `identity_core.resolve_identity()` para contexto, verticales y
   organizaciones; convierte `IdentityConflictError` en HTTP 409
   `identity_conflict`.
5. Llama a `system_identity.resolve_system_identity()` en lectura para
   resolver la referencia `(punto_cero_system, users.id)` y obtener
   `entity_id`.
6. Usa el sujeto canónico, contexto de identidad, organizaciones, rol y estado
   para resolver entitlements.

La resolución canónica no recibe `create_missing=True`; por defecto es
read-only. Si el `entity_id` no es válido/resuelto, el Bridge responde HTTP
403 `identity_unresolved`. La capa `backend/services/access_bridge.py` valida
el ID canónico y crea un intent en memoria; la ruta compone ese servicio con
lecturas de contexto/identity/entitlements. El módulo de servicio y el camino
HTTP no deben describirse como si tuvieran los mismos efectos de I/O.

### Qué asume

- `request.app.state.db` contiene `users`, `system_identities` y las demás
  colecciones que esperan los resolvers.
- El ID de usuario que aparece en JWT/cookie puede normalizarse al mismo
  `users.id` y resolverse con `source=punto_cero_system`.
- La base local/operativa contiene un mapping único, válido y consultable.
- Un fallo de sujeto canónico debe impedir crear el contexto de permisos,
  aunque la autenticación de usuario haya sido válida.
- `identity_core` y `system_identity` ofrecen resoluciones complementarias:
  una del contexto One/sesión, otra del ID canónico. No se asume que tengan el
  mismo identificador.
- Los entitlements, verticales, organizaciones, rol y estado se leen/derivan
  según sus servicios actuales; `entity_id` por sí solo no autoriza.

### Qué devuelve

- `GET /api/access/spaces`: espacios del Workspace Registry.
- `GET /api/access/entitlements`: `subject_id` canónico, bloque `identity`
  (`entity_id`, `system`, `identity_type`, `available_spaces`) y
  `entitlements`.
- `POST /api/access/intent`: `{"intent": ...}` si la policy permite el intent;
  devuelve 403 cuando se deniega y 400 para errores de validación. La ruta
  pasa sujeto canónico, espacio normalizado, entitlements, contexto `entry_host`
  y estado al servicio intent.
- Conflicto de sesión One: 409 `identity_conflict`; identidad canónica ausente
  o inválida: 403 `identity_unresolved`. El fail-closed es comportamiento
  observado, no una reparación/materialización.

### Dónde falta ownership explícito

1. **Colección y credenciales:** las rutas resuelven identidad en la base One;
   no hay contrato de acceso que declare al Bridge como cliente de una
   autoridad System remota ni separación visible de credenciales.
2. **Escritor:** el servicio de persistencia puede crear y vincular identidades,
   pero el runtime del Bridge solo necesita leer. No hay enforcement de
   almacenamiento que limite escritura exclusivamente a System Core.
3. **Owner token:** `punto_cero_system` está habilitado por Registry, mientras
   los `users.id` enlazados son emitidos por flujos One. La representación y
   autenticación de ese principal no están explícitas.
4. **Contrato de datos devuelto:** `identity.system` identifica el token
   propietario, pero la respuesta no demuestra quién hospedó/operó la
   resolución ni el nivel de evidencia del vínculo.
5. **Availability/consistencia:** no está definido cache, timeout,
   degradación o SLO para una autoridad separada. Hoy la lectura ocurre dentro
   de la base del proceso; una futura extracción cambiaría esa frontera.
6. **Gobernanza:** el contrato HTTP exige un sujeto canónico y falla cerrado,
   pero no define quién verifica, suspende, revoca, adjudica conflictos,
   audita cambios o aprueba nuevos `source`.

Estas observaciones no son autorización para alterar ruta, base, Registry,
claims, autorización o contratos del Bridge.

## 6. Siguiente descubrimiento recomendado

Obtener ventanas y permisos explícitos de solo lectura por entorno y declarar
un universo por ejecución. Medir las mismas invariantes sin exponer PII,
clasificar referencias de empresa con los owners de datos, y verificar la
presencia efectiva de índices y linaje en cada entorno. No unir cuentas de
One/Legal por email. Materialización no debe empezar hasta cerrar las
decisiones de [IDENTITY-GOVERNANCE-CONTRACT.md](./IDENTITY-GOVERNANCE-CONTRACT.md).

## Fuentes técnicas consultadas

- `backend/routes/access_bridge_routes.py`
- `backend/services/access_bridge.py`
- `backend/services/identity_core.py`
- `backend/services/system_identity.py`
- `backend/services/identity_registry.py`
- `backend/services/entitlement_service.py`
- `backend/services/policy_can.py`
- `backend/server.py`
- `backend/tests/test_access_bridge_contract.py`
- [ONE-IDENTITY-COVERAGE-AUDIT.md](./ONE-IDENTITY-COVERAGE-AUDIT.md)
- [IDENTITY-OWNERSHIP-OPERATING-MODEL.md](./IDENTITY-OWNERSHIP-OPERATING-MODEL.md)
