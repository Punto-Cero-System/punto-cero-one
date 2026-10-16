# Group Graph Design Review

> **Estado:** análisis técnico · **Fase:** Omega F1-A · **Contrato vigente:** `SOCIAL_GRAPH_CONTRACT.md` v1
> **Naturaleza:** revisión previa. **No implementa nada** — no añade `entity_type="group"`, no crea modelos, no migra datos y no modifica el Feed.

Este documento determina qué se necesita para integrar grupos con el Social Graph **sin violar el contrato v1**, y qué deuda debe cerrarse antes de intentarlo.

---

## 1. Estado actual

### 1.1 Modelo de grupos (tres colecciones)

| Colección | Estructura real | Notas |
|---|---|---|
| `groups` | `{id, name, description, category, privacy, rules, admin_id, cover_url, members_count, posts_count, created_at, updated_at}` | `admin_id` es **un solo usuario**, no una colección de roles |
| `group_members` | `{id, group_id, user_id, role, joined_at}` | `role ∈ {admin, member}` — valor literal, **no validado por enum** |
| `group_posts` | `{id, group_id, author_id, body, created_at}` | **No tiene `counts`, ni reacciones, ni comentarios, ni hashtags** |

> **Discrepancia documentada:** el docstring de `groups_routes.py:13` afirma que *"los posts del grupo reutilizan la colección `posts` con `group_id` + `visibility='group'`"*. **Es falso.** El código real inserta en `group_posts` (línea 250). Esta divergencia debe corregirse en la documentación antes de F1, porque induciría a un implementador a asumir que el feed ya recibe los posts de grupo.

### 1.2 Endpoints existentes

```
POST   /api/groups                  crear            (admin se auto-une)
GET    /api/groups                  listar           (público, sort por members_count)
GET    /api/groups/categories       taxonomía        (10 categorías fijas)
GET    /api/groups/{id}             detalle          (público)
POST   /api/groups/{id}/join        unirse           (idempotente)
POST   /api/groups/{id}/leave       salir
GET    /api/groups/{id}/members     miembros         (público)
POST   /api/groups/{id}/posts       publicar         (requiere membresía)
GET    /api/groups/{id}/posts       timeline         (público)
```

### 1.3 Permisos reales (verificados)

| Acción | Condición | Nota |
|---|---|---|
| Ver grupo | **Ninguna** | Público |
| Listar miembros | **Ninguna** | Público, sin filtro de privacidad |
| Publicar | `group_members` existe | 403 si no es miembro (línea 241) |
| Moderar | **No existe** | ⚠️ Sin endpoint de borrado ni de sanción |
| Salir | Cualquiera, **incluido el admin** | ⚠️ Un admin puede abandonar su propio grupo y dejarlo huérfano |

### 1.4 `privacy` — declarada pero inoperante 🔴

`privacy: Literal["public","private"]` se acepta y persiste (líneas 51, 65, 103), pero **no se consulta en ningún filtro**:

| Endpoint | Filtra por `privacy` |
|---|---|
| `GET /api/groups` | ❌ No |
| `GET /api/groups/{id}` | ❌ No |
| `GET /api/groups/{id}/members` | ❌ No |
| `GET /api/groups/{id}/posts` | ❌ No |

**Un grupo privado es visible, listable y con timeline legible por cualquiera.** Esto es un bug preexistente, independiente del Social Graph, y **debe resolverse antes** de exponer grupos a un motor de recomendación: un ranking que distribuye contenido privado lo convertiría en una fuga.

### 1.5 Estado de membresía

No hay estados. `group_members` es una **presencia o ausencia**: no existe `pending`, `banned`, `muted` ni `solicitud de ingreso`. Unirse es inmediato y automático incluso en grupos privados.

---
## 2. Eventos sociales posibles

### 2.1 Acciones reales que existen hoy

| Acción | Endpoint | Estado |
|---|---|---|
| `create_group` | `POST /api/groups` | ✅ Existe |
| `join_group` | `POST /{id}/join` | ✅ Existe |
| `leave_group` | `POST /{id}/leave` | ✅ Existe |
| `create_group_post` | `POST /{id}/posts` | ✅ Existe |
| `comment` | — | ❌ **No existe** en grupos |
| `moderate` | — | ❌ **No existe** |
| `react` | — | ❌ **No existe** en `group_posts` |
| `delete_post` | — | ❌ **No existe** |

### 2.2 Clasificación por capa (contrato §2.3)

| Acción | RELACIÓN | ACTIVIDAD | NOTIFICACIÓN | ANALYTICS |
|---|---|---|---|---|
| `create_group` | — (crea entidad) | Futura | — | ❌ **ausente** |
| `join_group` | ✅ `group_members` | Futura | ✅ `group_join` → admin | ❌ **ausente** |
| `leave_group` | ✅ `group_members` | Futura | — (ausente hoy) | ❌ **ausente** |
| `create_group_post` | — | Futura | ✅ `group_post` → hasta 500 miembros | ❌ **ausente** |

**Hallazgo transversal:** `groups_routes.py` **no importa `record_event`**. A diferencia de `company_routes`, `job_routes` y `event_routes` —que sí lo hacen— los grupos son hoy **invisibles para la medición**. Cero eventos en `analytics_events`.

### 2.3 Notificación existente de alto costo

`create_group_post` hace fan-out a **hasta 500 miembros con un `insert_one` individual por persona** (líneas 259-274). Es un `for` secuencial dentro del request: 500 inserts bloquean la respuesta. El propio código lo reconoce (*"larger groups should use realtime"*), pero no está resuelto.

**Relevancia para F1:** al añadir una capa de actividad y seguir, este fan-out es exactamente el que habría que rediseñar — y hacerlo **antes** evita propagar el patrón a un flujo nuevo.

---
## 3. Feed

### 3.1 Estado: los grupos son invisibles para el Feed

| Verificación | Resultado |
|---|---|
| `feed_routes.py` menciona `group` | 1 coincidencia — y es `{"$group": {...}}` de agregación Mongo, **no el dominio grupos** |
| `engine.py` lee `group_members` | ❌ 0 coincidencias |
| `group_posts` aparece en `_rank_posts` / `build_for_you_feed` | ❌ No |
| `_pool_user_posts` incluye `group_posts` | ❌ No (solo `db.posts`) |
| `_compose_editorial` tiene pool `group` | ❌ No |

**Conclusión:** un post publicado en un grupo **no puede llegar hoy al feed principal**, ni por pestaña, ni por `mixed-feed`, ni por "Para Ti". Es un círculo cerrado: se publica, se notifica, se ve en la página del grupo, y muere ahí.

### 3.2 Qué necesitaría el Feed

Para integrar hay que decidir **qué llega y bajo qué forma**. Hay dos caminos, con costes muy distintos:

**Camino A — enriching (sin mover datos).** Los `group_posts` siguen donde están; el feed los *consulta* y los proyecta. Requiere un acceso nuevo a la colección en el motor.

**Camino B — unificación (mover a `posts`).** Como afirma (erróneamente) el docstring, los `group_posts` pasarían a `posts` con `group_id` + `visibility="group"`, heredando reacciones, comentarios, guardados, trends y `for_you` **sin código nuevo**.

| | Camino A | Camino B |
|---|---|---|
| Reacciones / comentarios / guardados | ❌ Reimplementar por grupo | ✅ Heredado |
| `group_id` respetado en el ranking | Manual | Automático |
| Riesgo de regresión en Feed | Bajo | **Alto** (toca la colección más sensible) |
| Coste | Alto (mucho código nuevo) | Bajo (pero mayor riesgo) |

**El contrato v1 §6 congela el Feed.** Por tanto el Camino B, tal como está descrito, **viola una decisión congelada** y requeriría decisión explícita de Core. **F1 debe asumir el Camino A.**

### 3.3 El dato que falta para recomendar bien

Un post de grupo necesita **contexto del grupo** (`category`, `privacy`, `members_count`, `admin_id`) para que el motor pueda puntuarlo. `group_posts` no lo incluye y el motor no lo resolvería hoy.

---
## 4. Ranking

### 4.1 Cómo funciona hoy `load_user_signals`

`engine.py:12-110` carga las señales en un único recorrido:

| Origen | Señal | Campo |
|---|---|---|
| `follows{user}` | `followed_user_ids` | ✅ ya existe |
| `follows{hashtag}` | → `interaction_hashtags` | ✅ ya existe |
| `follows{country}` / `{vertical}` | → `verticals` / `country` | ✅ ya existe |
| `follows{event}` | `followed_event_ids` | ⚠️ **Se carga y se descarta** |
| `company_follows` | `followed_company_ids` + owner + tags | ✅ |
| `post_reactions` / `post_saves` / `post_comments` (90 días) | afinidad de autor y hashtags | ✅ |
| **`group_members`** | — | ❌ **No se lee** |

`FeedSignals` (`base.py:15-28`) declara 8 campos. **Ninguno es de grupos.**

### 4.2 Cómo una relación de grupo se volvería señal

**Paso 1 — Interés (`follows{entity_type:"group"}`).** Es el caso fácil y el que el contrato prioriza (§5.1): añadir `group` a `VALID_TYPES` y una rama más en el bucle de `engine.py:28-41`. El campo `followed_event_ids` es el **patrón exacto a imitar**.

Además, igual que se hace con las empresas seguidas (líneas 59-70), los grupos seguidos deberían heredar su `category` hacia `verticals`. Es el efecto de "seguir Legal me sube contenido legal".

**Paso 2 — Pertenencia (`group_members`).** Más delicada. Recomendación: **no** cargarla como señal de ranking en F1. Motivos:
- El contrato §5.1 dice que pertenencia e interés son distintos (G1: *"`group_members` no se replica en `follows`"*).
- Leer membresía en el motor crea un segundo camino de afinidad y reintroduce la ambigüedad que el contrato cerró.
- El coste es real: una consulta por usuario por request de feed.

**Propuesta: Paso 2 solo como peso, no como conjunto.** Traducir "soy miembro de N grupos de la categoría X" a `verticals`, no a una lista de grupos. Así el efecto es agregable y no necesita un provider nuevo.

### 4.3 Provider nuevo

`providers.py` tiene 6 providers. Ninguno sirve para grupos tal cual. Un `GroupAffinityProvider` **no es necesario en F1** si la señal se traduce a `verticals` + `followed_group_ids`: `CategoryProvider` y `HashtagProvider` ya consumeaffinidad que los grupos alimentan.

> **Recomendación:** F1 se limita a ** poblar señales**, sin provider nuevo. Añadirlo sería optimizer sin demanda medida.

---
## 5. Notificaciones

### 5.1 Tipos ya disponibles

`NotificationKind` (`services/notifications.py:24-40`) incluye **tres** tipos de grupo:

| Kind | Estado | Destinatario actual |
|---|---|---|
| `group_post` | ✅ Se usa | Todos los miembros, hasta 500 |
| `group_join` | ✅ Se usa | Solo el admin del grupo |
| `group_activity` | ⚠️ **Declarado, nunca usado** | — |

### 5.2 Eventos que F1 necesitaría

| Evento | Tipo propuesto | Condición | Nota |
|---|---|---|---|
| Seguir grupo | `group_activity` | Siempre | **Nuevo** — no requiere kind nuevo |
| Nuevo post en grupo seguido (no miembro) | `group_post` | El usuario sigue el grupo | **Nuevo destinatario**, tipo existente |
| Solicitud de ingreso (grupos privados) | `group_activity` | Al admin | Requiere antes el estado `pending` (§1.5) |
| Post reportado / moderado | `admin` | Al autor | Requiere endpoint de moderación (§1.3) |

**Conclusión:** **no hace falta ningún `NotificationKind` nuevo** para F1. Los tres tipos de grupo ya previstos cubren el caso de uso. Lo que falta son **destinatarios**, no tipos — y ahí hay un riesgo de coste (§2.3).

**Regla de fan-out a aplicar:** si un grupo tiene N seguidores y M miembros, la notificación debe llegar a **miembros + seguidores no-miembros**, con **dedupe por `(recipient, subject)`**. Sin ese dedupe, seguir un grupo popular y ser miembro dispararía **dos notificaciones idénticas**.

---

## 6. Datos que ya existen (reutilizables sin migración)

| Dato | Ubicación | Reutilizable en F1 |
|---|---|---|
| Grupos con `category`, `privacy`, `admin_id` | `groups` | ✅ Sí |
| Membresía con rol y fecha | `group_members` | ✅ Sí |
| Posts de grupo con autor y fecha | `group_posts` | ✅ Sí |
| Contadores `members_count`, `posts_count` | `groups` | ✅ Sí |
| Esquema genérico de follows | `follows` + `follows_routes.py` | ✅ Solo añadir `'group'` al enum |
| Componente de follow universal | `FollowButton.jsx` | ✅ Ya acepta `entityType` arbitrario |
| Cliente de follows | `followsService.js` | ✅ Sin cambios |
| Tipos de notificación de grupo | `notifications.py:37-39` | ✅ Sin cambios |
| Infraestructura de señales | `feed_engine/engine.py` | ✅ Una rama más |

**Conclusión de inventario: F1 no necesita ni una migración ni un modelo nuevo.** El grafo ya es genérico; solo falta declararlo.

---

## 7. Cambios mínimos requeridos

### 7.1 Bloqueantes (antes de escribir código de integración)

| # | Cambio | Tamaño | Por qué |
|---|---|---|---|
| B1 | Aplicar `privacy` en los 4 endpoints de lectura | Medio | Un ranking que distribuye contenido privado es una fuga. **Bug preexistente.** |
| B2 | Corregir el docstring de `groups_routes.py:13` | 1 línea | Dice que los posts van a `posts`; van a `group_posts`. Induciría a error. |
| B3 | Impedir que el admin abandone su grupo sin transferir | Pequeño | Hoy deja grupos huérfanos (`leave_group` no comprueba `admin_id`). |

### 7.2 Mínimos de F1 (integración)

| # | Cambio | Archivo |
|---|---|---|
| M1 | `'group'` en `VALID_TYPES` + literal | `routes/follows_routes.py:42-43` |
| M2 | Rama `elif et == "group"` en el bucle de señales | `services/feed_engine/engine.py:28-41` |
| M3 | `followed_group_ids` en `FeedSignals` | `services/feed_engine/base.py` |
| M4 | Herencia de `category` → `verticals` (como empresas) | `engine.py` (~líneas 59-70) |
| M5 | Botón "Seguir grupo" con `FollowButton` | `pages/CommunityPage.jsx` |
| M6 | Evidencia de idempotencia equivalente a F0 | `backend/tests/` |

**M1–M4 son backend puro y no tocan el Feed.** M5 es frontend. **Ninguno modifica `posts`, `feed_routes` ni `mixed-feed`** → compatible con el contrato §6.

### 7.3 Explícitamente fuera de F1

- ❌ Llevar `group_posts` al feed (§3.2, Camino B) — viola el contrato.
- ❌ Provider de ranking nuevo (§4.3).
- ❌ Moderación, reacciones o comentarios en grupos.
- ❌ Estados de membresía (`pending`, `banned`).
- ❌ Nada en `activities` (capa futura, §2.3 del contrato).

---

## 8. Riesgos

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| **G1** | **Fuga de contenido privado.** `privacy` no se aplica; un motor de recomendación distribuiría posts de grupos privados. | 🔴 Crítico | **B1 antes de F1.** Es un bug preexistente, pero F1 lo amplifica de "visible por URL" a "visible en el feed". |
| **G2** | **Fan-out duplicado.** Ser miembro *y* seguidor de un grupo → 2 notificaciones idénticas. | 🟠 Alto | Dedupe por `(recipient, subject)` (§5.2). |
| **G3** | **Coste del fan-out.** 500 inserts secuenciales por post (§2.3). Con seguidores, el número crece. | 🟠 Alto | Degradar a realtime/bulk insert **antes** de F1, no durante. |
| **G4** | **Colapsar pertenencia e interés.** La tentación de usar `group_members` como señal de follow. | 🟠 Alto | Contrato §5.1 G1/G2 lo prohíbe. Solo `verticals` como peso (§4.2). |
| **G5** | **Docstring engañoso.** Afirma que los posts van a `posts`. | 🟡 Medio | **B2.** Barato y elimina una fuente de error crítico. |
| **G6** | **Grupos huérfanos.** El admin puede salir y dejar `admin_id` colgando. | 🟡 Medio | **B3.** |
| **G7** | **Replicar el bug de contador.** Si se añade un contador de seguidores de grupo, hereda el patrón F0. | 🟡 Medio | Reglas §3.2 del contrato + evidencia M6. **Recomendación: no crear contador de seguidores de grupo en F1.** |
| **G8** | **Invisible para medición.** Grupos no emiten `record_event`. | 🟢 Bajo | No bloquea F1, pero deja el módulo sin datos para evaluar su impacto. |
| **G9** | **Reglas del contrato violadas** por "optimizar" el feed con grupos. | 🟢 Bajo | §7.3 delimita explícitamente el perímetro. |

---

## 9. Orden recomendado de implementación

| Fase | Trabajo | Bloqueado por | Riesgo |
|---|---|---|---|
| **F0.7** | B2 (docstring) + B3 (admin no abandona) | — | 🟢 Nulo |
| **F0.8** | B1 — aplicar `privacy` en lecturas | — | 🟡 Medio |
| **F0.9** | Rediseñar el fan-out de notificaciones (§2.3) | — | 🟠 Medio |
| **F1-B** | M1 + M6 — `'group'` en `VALID_TYPES` + evidencia de idempotencia | F0.8 | 🟢 Bajo |
| **F1-C** | M2 + M3 + M4 — poblar señales (sin provider) | F1-B | 🟢 Bajo |
| **F1-D** | M5 — botón de seguir en Comunidad | F1-B | 🟢 Bajo |
| **F2** *(futuro)* | Moderación, estados de membresión, reacciones | — | 🟠 Alto |
| **F3** *(futuro, decisión Core)* | `group_posts` → Feed | Decisión Core | 🔴 Crítico |

**Regla:** F1-B/C/D son backend de señales + un botón. **Ninguno toca `posts`, `feed_routes` ni `mixed-feed`.** El primer cambio que toca el Feed está en F3 y es, explícitamente, una decisión de Core.

---

## 10. Conclusión

**La integración es viable y barata en su núcleo.** El grafo ya es genérico: añadir `'group'` es una constante en un enum y una rama en un bucle. No hay migración, ni modelo nuevo, ni cambio de frontend en `FollowButton` ni en `followsService`.

**Pero F1 no está lista para empezar**, por un motivo que no es de arquitectura sino de **corrección**: `privacy` se persiste y no se aplica. Un motor de recomendación que distribute contenido privado convierte un bug preexistente de "visible por URL" en "visible en el feed de cualquiera". **Ese es el único hallazgo que bloquea, y no está en el Social Graph — está en los grupos.**

La segunda observación es de diseño: el docstring de `groups_routes.py:13` promete una integración con `posts` que **no existe**. Quien implemente F1 confiando en él creerá que el Feed ya recibe los posts de grupo, y diseñará sobre una premisa falsa. Corregirlo cuesta una línea.

**Recomendación:** ejecutar F0.7–F0.9 (todo deuda preexistente, sin tocar el grafo), y recién entonces F1-B. La secuencia mantiene el Social Graph intacto y ataca los riesgos en orden de gravedad.

---

*Revisión de diseño previa a F1. No implementa `entity_type="group"`. Sujeto a `SOCIAL_GRAPH_CONTRACT.md` v1.*