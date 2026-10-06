# Identity Environment Reconciliation

**Fecha de observación:** 2026-10-03
**Alcance:** conciliación read-only de `users`, `system_identities` y
referencias de ownership de empresas en entornos accesibles. No se modificaron
datos, runtime, modelos o contratos productivos.

## A. Inventario por entorno

| Entorno | Usuarios | Identidades | Cobertura `entity_id` | Conflictos | Estado |
| --- | ---: | ---: | --- | --- | --- |
| **LOCAL** | 4 | 4 | 4/4 usuarios (100%) con exactamente un `entity_id` válido en `system_identities` | No se observaron conflictos de identidad en estos cuatro usuarios; 41 referencias `companies.owner_id` no corresponden a los cuatro `users.id` observados | **Disponible; medido** |
| **STAGING** | DESCONOCIDO | DESCONOCIDO | DESCONOCIDO | DESCONOCIDO | **DESCONOCIDO** — no había configuración/acceso de staging usado para esta auditoría |
| **PRODUCCIÓN** | DESCONOCIDO | DESCONOCIDO | DESCONOCIDO | DESCONOCIDO | **DESCONOCIDO** — no había configuración/acceso de producción usado para esta auditoría |

### Fuente, fecha y límites

- **LOCAL:** conexión Mongo configurada por `backend/.env`/proceso local y
  `DB_NAME=punto_cero_local`; ping exitoso y consultas de solo lectura el
  2026-10-03. Se consultaron conteos, enlaces anonimizados y metadatos de
  índices. No se guardaron ni publicaron IDs, emails u otros valores
  identificables.
- **STAGING:** no consultado. No se probaron credenciales externas y no se
  infiere existencia, población o estado.
- **PRODUCCIÓN:** no consultado. No se probaron credenciales externas y no se
  infiere existencia, población o estado.
- El snapshot local contiene cuatro usuarios; no es un universo suficiente
  para generalizar cobertura, vigencia, linaje o estado de producción.
- No se consultaron bases de Legal Core ni sistemas externos.

## B. Cobertura de identidad en LOCAL

| Tipo | Cantidad | Riesgo |
| --- | ---: | --- |
| Usuarios con exactamente un `entity_id` válido | 4 de 4 | Cobertura local observada completa, pero muestra muy pequeña. |
| Usuario sin identidad canónica válida enlazada | 0 | No se observaron casos en el snapshot. No implica que el proceso de alta garantice materialización. |
| Usuario enlazado a múltiples `entity_id` | 0 | No se observaron conflictos de resolución de usuario. |
| Documento `system_identities` con `entity_id` inválido | 0 de 4 | Solo se verificó el formato con el validador actual. |
| Identidad sin perfil | 0 de 4 | No se observaron documentos sin perfiles. |
| Perfil del owner (`punto_cero_system`) cuyo `external_id` no coincide con un `users.id` local | 0 | La comparación se limita a la población completa de `users` observada en esta base. |
| Identidad/perfil que apunta a un usuario local inexistente | 0 | No se observaron referencias huérfanas dentro de la base local. |
| `entity_id` duplicado entre documentos | 0 | En el contenido observado no hubo duplicados. |
| Mismo `(source, external_id)` en múltiples identidades | 0 | En el contenido observado no hubo mappings ambiguos. |
| Documento `users` sin `id` no vacío / valores `users.id` duplicados | 0 / 0 | No se observaron anomalías del ID nativo en los cuatro documentos locales; esto no valida otras poblaciones o entornos. |

### Índices observados en LOCAL

La colección local `system_identities` expuso, en la inspección de metadatos,
índices únicos sobre `entity_id` y sobre
`profiles.source + profiles.external_id`, además de `_id` y `created_at`.
Esto demuestra que esos índices estaban presentes en la base local observada
en la fecha de consulta. No certifica los índices de staging/producción, el
estado futuro del startup, controles de permisos ni un único escritor.

## C. Empresas y ownership

Colecciones locales relacionadas con estas entidades: `companies` presente;
colecciones `organizations`, `teams`, `agents`, `professionals` y `firms`
ausentes en la lista observada. `team` aparece como arreglo embebido en el
modelo de empresa, no como población/colección independiente.

| Comprobación de `companies` | Cantidad observada | Clasificación |
| --- | ---: | --- |
| Empresas/documentos | 41 | Población local; incluye el conjunto presente al medir. |
| Empresa con campo `entity_id` | 0 | No se observó ese campo en documentos de empresa. No implica ausencia de una cuenta owner; no se define identidad organizacional en este dominio. |
| `owner_id` ausente o vacío | 0 | No se encontraron empresas sin valor de owner. El campo no se validó contra datos fuera de esta base. |
| `owner_id` que coincide con un `users.id` local | 0/41 | 41 referencias no resueltas contra los cuatro usuarios locales. No concluir que las referencias sean inválidas: podrían pertenecer a otra cohorte, semillas o historial. |
| Owner resuelto a usuario local sin `entity_id` válido | 0 | Ningún owner coincidió con un usuario local; por tanto no hay muestra de esta condición. |
| Valor de `owner_id` repetido entre empresas | 1 valor distinto repetido en dos o más documentos | Repetición observada, no conflicto por sí sola: un owner puede estar relacionado con varias empresas. No se revela el valor. |
| Entradas en `team[]` | 0 | No se observaron referencias `team.user_id` ni relaciones de equipo embebidas en los documentos. |
| `company.id` duplicado / `slug` duplicado | 0 / 0 | No se observaron IDs o slugs repetidos en este snapshot. |
| Empresas con `organization_id` | 0 | No se observó un crosswalk local explícito a organización. |

La ruta actual de creación asigna `owner_id` desde `user["id"]`; el contrato
`TeamMember.user_id` es opcional. Este comportamiento explica el tipo de
referencia modelado, pero no certifica el linaje de las 41 filas. Una
coincidencia inexistente en el conjunto local queda **no resuelta**, no
clasificada automáticamente como huérfana. No se corrigieron ni etiquetaron
registros.

### Relaciones ambiguas y alcance

- El valor `owner_id` repetido entre más de una empresa puede representar
  ownership legítimo compartido; no es evidencia suficiente para llamarlo
  ambigüedad.
- No hay equipos o organizaciones separados observables con los que probar
  cardinalidad, membresía o validez de owner.
- No se consultó `company_follows` para identidad/ownership; seguidores no son
  owners ni memberships.
- No se unieron empresas, usuarios ni identidades por email, nombre u otros
  atributos personales.

## D. Auditoría de namespace

| Elemento | Realidad observada | Conclusión |
| --- | --- | --- |
| `entity_id` | Generador `generate_entity_id()` dentro de `services/system_identity.py`; formato `pc_usr_*` | Implementación local de generación. La autoridad lógica System Core sigue siendo propuesta documental, no frontera operacional probada. |
| `external_id` | Perfil en `system_identities` con `source` y referencia emitida por un sistema fuente | El ID conserva la semántica/ownership del origen. No es el canónico ni un permiso. |
| `punto_cero_system` | Único `OWNER_TOKEN` y única fuente con `emission_allowed=True` según Identity Registry; `community` y `workspace` están en compatibilidad y no emiten | El Registry modela exactamente un owner token conceptual/emisor permitido. |
| `users.id` | Referencia usada como `external_id`; distintos puntos de alta de One crean IDs nativos en la misma colección `users` | Hay varios puntos de producción/código, pero pertenecen al mismo dominio/namespace One según el contrato actual. No se verificó un segundo sistema independiente que emita esos mismos IDs. |

**Respuesta:** no se observan múltiples tokens de emisión habilitados en el
Identity Registry: el único es `punto_cero_system`. Sí existe una **divergencia
de ownership/emisión conceptual**: el Registry y documentos nombran a Punto
Cero System como owner, mientras los flujos del backend One producen los
`users.id` usados como `external_id`. Los diversos puntos de creación de
usuarios no prueban por sí solos múltiples namespaces independientes, pero
tampoco se ha demostrado que estén operados por una Authority System separada.
Por ello no puede afirmarse que el ownership operativo del namespace esté
reconciliado.

La cadena `punto_cero_system` debe mantenerse como namespace reservado para
compatibilidad en tanto no exista una decisión versionada. Cambiarla,
reasignarla o habilitar nuevas fuentes queda fuera de este descubrimiento.

## E. Preparación para materialización

Antes de cualquier proceso automático faltan, como mínimo:

1. **Autoridad operativa:** responsable único, deployment/store, identidad
   técnica, separación de credenciales y enforcement de escritor único.
2. **Namespace:** ratificar qué principal representa
   `punto_cero_system`, quién emite `users.id`, cómo One acredita ownership y
   cómo se versionarían nuevos `source`.
3. **Evidencia:** criterios verificables de elegibilidad para cuenta One,
   email, invitaciones, profesionales y, separadamente, Legal. Coincidencia de
   email no puede ser clave de identidad.
4. **Permisos:** autenticación/autorización entre sistemas, permisos de create,
   link, modify, suspend, resolve y audit; separación de solicitante,
   adjudicador y auditor.
5. **Integridad:** verificación de índices y restricciones en cada entorno,
   detección de duplicados y clasificación de empresas/owners con su data
   owner.
6. **Auditoría:** registro append-only, actor, evidencia/procedencia,
   resultado, retención, minimización de PII y tratamiento de fallo de
   auditoría.
7. **Conflictos:** estados y procesos para perfil huérfano, múltiples
   identidades, empresa sin owner resoluble y merge/split sin automatismo.
8. **Operación/rollback:** idempotencia, retries, disponibilidad y timeouts,
   kill switch, comportamiento fail-closed del consumidor y rollback que
   preserve identidades ya emitidas.
9. **Cobertura por entorno:** universo y métricas explícitos de staging y
   producción; el snapshot local no satisface este requisito.

## Fuentes consultadas

- Código read-only: `backend/services/system_identity.py`,
  `backend/services/identity_registry.py`, `backend/routes/access_bridge_routes.py`,
  `backend/routes/company_routes.py`, `backend/models_business.py`,
  `backend/routes/community_auth_routes.py`, `backend/routes/investor_routes.py`,
  `backend/server.py`.
- Colecciones y agregados Mongo de `punto_cero_local`; no se imprimieron valores
  de identidad o contacto.
- [IDENTITY-ENVIRONMENT-DISCOVERY.md](./IDENTITY-ENVIRONMENT-DISCOVERY.md)
- [IDENTITY-GOVERNANCE-CONTRACT.md](./IDENTITY-GOVERNANCE-CONTRACT.md)
- [IDENTITY-OWNERSHIP-OPERATING-MODEL.md](./IDENTITY-OWNERSHIP-OPERATING-MODEL.md)
- [ONE-IDENTITY-COVERAGE-AUDIT.md](./ONE-IDENTITY-COVERAGE-AUDIT.md)
