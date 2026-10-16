# ACTIVITIES LAYER — Diseño (OMEGA F0.9.2)

> **Fase de diseño. Sin código productivo.** No se creó la colección, ni
> endpoints, ni se modificó `notifications.py`, `follows`, `groups` o el Feed.
> Rutas bajo `c:\Users\darwi\puntoceroone\punto-cero-one`.

Contexto: `SOCIAL_GRAPH_CONTRACT.md` §2.3 reserve `activities` como capa social
*"qué pasó y a quién le concierte"*. Este documento fija su contrato antes de
que exista. Predecesores: `GROUP_FANOUT_REDESIGN_F0_9.md`, F0.9.1.

---

## 1. Eventos sociales existentes (estado real, verificado)

### 1.1 Hallazgo principal: el fan-out y la analítica están desalineados

`record_event()` (analytics) y `dispatch()` (notificaciones) se llaman desde
lugares **distintos y parciales**:

| Dominio | `record_event` (analytics) | `dispatch` (notificación) | ¿Simétrico? |
|---|---|---|---|
| Feed (post, comment, react, share) | ❌ ninguno | ✅ 4 sitios | 🔴 **No** |
| Grupos (join, group_post) | ❌ ninguno | ✅ 2 sitios | 🔴 **No** |
| Follows (`entity_type:*`) | ❌ ninguno | ✅ 1 sitio | 🔴 **No** |
| Mensajería | ❌ ninguno | ✅ 1 sitios | 🔴 **No** |
| Empresas | ✅ 4 | ✅ 1 | 🟢 Sí |
| Eventos | ✅ 2 | ✅ 1 | 🟢 Sí |
| Empleos | ✅ 3 | ✅ 1 | 🟢 Sí |
| Perfil | ✅ 1 | ❌ ninguno | 🟡 Inverso |
| Auth comunidad | ✅ 1 (genérico) | ❌ ninguno | 🟡 Inverso |

**4 de 9 dominios notifican pero no miden.** El Feed —la superficie más
importante— no produce una sola fila de analítica.

**Y el docstring miente.** `services/analytics.py:12` declara
`post.created, post.reacted, post.commented, post.shared, post.saved`.
**Ninguno existe**: `feed_routes.py` no llama `record_event` en ningún punto.
Es documentación aspiracional que ya desincronizó del código.

> **Consecuencia para el diseño:** una capa de actividades unifica la
> asimetría, pero solo si la vía de entrada se vuelve común. Si cada productor
> sigue decidiendo a mano cuándo emitir, la asimetría se perpetúa.

### 1.2 Inventario de productores

| Acción | Actor | Sujeto | Audiencia actual | Notif. | Analytics |
|---|---|---|---|---|---|
| `create_post` | usuario | `post` | menciones | `mention` | ❌ |
| `add_comment` | usuario | `post` | autor del post + menciones | `comment` | ❌ |
| `react_to_post` | usuario | `post` | autor del post | `reaction` | ❌ |
| `share_post` | usuario | `post` | autor del post | — | ❌ |
| `save_post` | usuario | `post` | — (privado) | — | ❌ |
| `join_group` | usuario | `group` | admins del grupo | `group_join` | ❌ |
| `create_group_post` | miembro | `group_post` | resto de miembros (F0.9.1) | `group_post` | ❌ |
| `follow` (unificado) | usuario | `user`/`company`/… | dueño del sujeto | `follower` | ❌ |
| company follow legacy | usuario | `company` | dueño de la empresa | `follower` | ✅ |
| `rsvp` | usuario | `event` | organizador | `rsvp` | ✅ |
| `apply_job` | usuario | `job` | empresa / recruiter | `application` | ✅ |
| `send_message` | usuario | `conversation` | participantes | `message` | ❌ |
| `register_view` | usuario | `post` | — | — | ❌ |

**Veredicto:** 13 acciones sociales reales, 4 vocabularios distintos
(`NotificationKind` de 16, `analytics_events` con 9 nombres, `pc:*` de cliente
y las colecciones de relaciones). No hay un registro unificado.

---

## 2. Contrato de `activity`

### 2.1 Esquema propuesto

```
{
  id:            "act_<hex>",         // estable, único
  actor_id:      "usr_x",             // OBLIGATORIO → users.id
  kind:          "group.post_created", // OBLIGATORIO, vocabulario cerrado
  subject_type:  "group_post",        // OBLIGATORIO, vocabulario cerrado
  subject_id:    "gp_abc",            // OBLIGATORIO
  audience:      { type: "group", id: "g_1" },   // OBLIGATORIO
  visibility:    "members",           // OBLIGATORIO
  metadata:      { },                 // acotado, sin PII sensible
  created_at:    "2026-01-08T...",    // ISO-8601 string
  expires_at:    ISODate(...),        // BSON date — solo para TTL
}
```

### 2.2 Campos obligatorios y su justificación

| Campo | ¿Por qué obligatorio? |
|---|---|
| `actor_id` | Sin actor no hay atribución. Único puntero a identidad: `users.id` (contrato §2.2). **Nunca** `actor_type`+`actor_id`: la identidad no se replica. |
| `kind` | Vocabulario **cerrado y versionado**. Un `kind` desconocido debe ser error de desarrollo, no string libre. |
| `subject_type` / `subject_id` | Una actividad **siempre** cuelga de un sujeto. Sin sujeto no es un hecho social, es telemetría → eso es `analytics_events`. |
| `audience` | Es lo que convierte un hecho en "le concierne a alguien". Sin audiencia ningún consumidor puede filtrar y la colección es inútil. |
| `visibility` | Un mismo `kind` puede tener visibilidad distinta según el caso (`group_post` es `members`, `post` es `public`). Sin separarlo, la privacidad de F0.8 se erosiona. |

### 2.3 `audience`: objeto vs. dos campos

| Opción | A favor | En contra |
|---|---|---|
| **`{type, id}`** (objeto) | extensible (`group`, `followers`, `user`), un solo campo | índice compuesto sobre subcampos |
| `audience_type` + `audience_id` | índice trivial, consultas planas | dos campos que siempre van juntos |

**Recomendación: objeto.** El contrato §4 ya define un vocabulario de entidades
extensible; aplanar obligaría a **migrar el esquema** el día que
`audience.type = "followers"` aparezca. Mongo indexa subcampos igual de bien.

### 2.4 Compatibilidad con MongoDB actual

**Punto crítico: `created_at` como ISO-8601 *string* no admite TTL.**

Todo el codebase usa strings ISO (`posts`, `notifications`, `analytics_events`),
y esa coherencia vale más que la comodidad. Solución: **`created_at` string +
`expires_at` BSON Date**, con índice TTL solo sobre `expires_at`. Así la
colección conserva legibilidad y gana la capacidad de retención.

**Índices propuestos:**

| Índice | Consumidor |
|---|---|
| `[(subject_type, subject_id, created_at desc)]` | "qué pasó con X" (perfil, ficha) |
| `[(audience.type, audience.id, created_at desc)]` | actividad de una audiencia (Feed) |
| `[(actor_id, created_at desc)]` | "qué hizo X" (perfil propio, auditoría) |
| `[(kind, created_at)]` | diagnóstico y analítica exploratoria |
| TTL sobre `expires_at` | retención |

**No crear índice único de dedupe aquí.** Ver §3.

### 2.5 Relación con `users`

`actor_id` es la **única** llave foránea lógica, y `users` la única fuente de
identidad. **No** desnormalizar `actor_name`/`actor_picture`: se resuelven con
join a `users` al leer, como hoy hace `list_members` con `users_by_id`.
Desnormalizar el nombre convertiría la actividad en una segunda fuente de
identidad — justo lo que el contrato prohíbe.

---

## 3. Dedupe — la decisión más importante del documento

### 3.1 Corrección de una premisa del brief

El brief plantea dos casos. **Uno ya está resuelto y otro no existe todavía.**

| Caso | Estado real |
|---|---|
| "usuario siguiendo empresa por dos caminos" | ✅ **Ya resuelto.** `follows` tiene índice único `(user_id, entity_type, entity_id)` y ambos endpoints hacen `$setOnInsert` (F0). Un solo registro. **No requiere nada nuevo.** |
| "miembro + follower de grupo" | 🔴 **No ocurre aún** — no existe `entity_type='group'`. Se activará en F1. |

### 3.2 Error conceptual a evitar: deduplicar actividades

**Una actividad NO se deduplica. Una notificación SÍ.**

Un usuario que se une a un grupo y lo sigue son **dos hechos distintos y
verdaderos**. Colapsarlos en un registro pierde información real. Peor: un
índice único sobre `activities` impide comentarios repetidos legítimos
(2 comentarios en el mismo post = 2 hechos).

> **Regla:** `activities` es *append-only* y describe lo que ocurrió.
> El dedupe pertenece a la **capa de entrega**, donde el mismo hecho puede
> legítimamente producir dos avisos.

### 3.3 Dedupe en la entrega: unión de audiencias

La causa raíz del "miembro + follower" **no es una colisión de clave, es que
el fan-out recorre dos conjuntos y los suma**. La solución es **una sola
llamada con la unión**, no un índice que descarte.

F0.9.1 ya resolvió esto: `fanout_to_group_members` deduplica con un `seen`
global sobre `recipient_id`. Cuando F1 añada seguidores, **debe entrar en el
mismo `fanout_to_group_members`**, no en un segundo bucle.

| Enfoque | Coste | ¿Previne duplicados? |
|---|---|---|
| **A. Unión de audiencias en un solo fan-out** | 🟢 **Cero** — ya existe el `seen` | ✅ Sí, por construcción |
| B. Índice único en `notifications` | 🟠 1 índice + ventana temporal | ❌ Solo oculta, no previene |
| C. Colección `notification_claims` con TTL | 🔴 Nueva colección + 1 write extra | ⚠️ Previene entre ciclos |

**Recomendación: A.** Es la única que previene en origen, cuesta cero y no
introduce estado. **B y C quedan para v2**, y solo si la evidencia muestra
duplicados entre *acciones distintas*.

**Criterio de avance a C:** dos incidencias reales de doble aviso en
producción por acciones distintas. Sin ese dato, C es sobre-ingeniería.

---

## 4. Consumidores — sin acoplamiento

### 4.1 Principio

`record()` es el **único escritor**. Cada consumidor es una función que
**lee** y **nunca** escribe en `activities`. Un consumidor que falla **no**
puede tumbar la acción que originó el hecho.

### 4.2 Matriz de consumidores

| Consumidor | Lee | Escribe | Falla si… |
|---|---|---|---|
| `notifications` | `subject_id`, `audience` | `notifications` | silencia/errores → swallowed |
| `realtime` (SSE) | lo que `notifications` ya escribió | nada (SSE) | broker caido → swallowed |
| `analytics` | `kind`, `metadata` | `analytics_events` + contadores | Mongo → swallowed |
| `feed signals` | `audience`, `kind` | nada (solo ranking) | sin efecto en la escritura |
| **Darwin IA** (futuro) | agregados, **nunca filas crudas** | — | — |

### 4.3 Reglas de acoplamiento

1. **Lectura pura.** Ningún consumidor escribe en `activities`.
2. **Aislamiento de fallos.** Todo `try/except`, como ya hace `dispatch()`.
3. **Fallo de consumidor ≠ fallo de acción.** La publicación ya está escrita
   antes del fan-out (F0.9.1); la actividad se registra, y si el consumidor
   falla, el hecho **sigue existiendo** y se puede reprocesar.
4. **Idempotencia del consumidor.** `notifications` debe poder re-ejecutarse
   sobre la misma actividad sin duplicar (de ahí §3).
5. **Darwin IA no lee filas crudas.** Perfilaría sin consentimiento. Debe
   consumir agregados ya agregados, igual que hoy `analytics_counters`.

### 4.4 Orden de activación de consumidores

**Notificaciones primero, y solo tras provenar la escritura.** Sin readership,
una colección que nadie consulta es deuda pura. Realtime y analytics ya existen
y basta con derivarlos. Feed signals y Darwin son **fase posterior** y no deben
bloquear la creación.

---

## 5. Almacenamiento — comparar y elegir una

### Opción A — Colección `activities` propia ⭐

| A favor | En contra |
|---|---|
| Modelo limpio: `audience` es un campo de primera clase | Nueva colección que mantener |
| Índice único para "actividad de una audiencia" | Crecimiento → requiere TTL |
| No contamina analytics ni notifications | Un escritor más que unificar |
| Portable a Punto Cero System | |

### Opción B — Reutilizar `analytics_events`

**Rechazada.** `analytics_events` tiene forma `{name, actor_id, subject_type,
subject_id, country, vertical, payload, day}`: **no tiene `audience` ni
`visibility`**, y `payload` es una bolsa libre. Meter la audiencia dentro de
`payload` la vuelve no indexable — se pierde el consumidor principal. Además
el contrato §2.3 ya la fija como capa MEDICIÓN, *"derivada, nunca fuente"*.

### Opción C — Reutilizar `notifications`

**Rechazada.** Es **por destinatario**: una acción con 500 receptores son 500
filas. Un mismo hecho no puede tener N representaciones sin duplicarse, y la
colección no puede alimentar analytics ni ranking. `notifications` es la capa
de ENTREGA, no el registro.

### Recomendación: **A**

Es la única que satisface §4 sin forzar. B y C no fallan por coste, fallan
por **modelo**.

### 5.4 Crecimiento (riesgo cuantificado)

Una actividad por acción social ≈ **5 acciones/día/usuario activo**.
A 10.000 usuarios activos: **~50.000 filas/día ≈ 18 M/año**.

Mitigación: **TTL desde el día 1** sobre `expires_at`. Retención propuesta
**180 días** para ranking y "actividad reciente", muy por encima de la ventana
de 30/90 días que ya usa `feed_engine`. Sin TTL, esto es una bomba de relojería
en un producto en crecimiento.

---

## 6. Compatibilidad con Punto Cero System

| Requisito | Cómo se cumple | Verificación |
|---|---|---|
| **No depender de Legal** | `metadata` es una whitelist por `kind`, sin campos libres. Prohibido guardar textos de consulta, documentos o datos de un tercero. | Whitelist explícita; el default es rechazar, no permitir. |
| **No depender de Medical** | No hay categorías de salud ni datos clínicos. `activities` describe *hechos sociales* (publicó, siguió,/RSVP), nunca estados de salud. | `kind` cerrado, sin dominio clínico. |
| **Identidad portable** | `actor_id` = `users.id`. El Core puede resolverlo vía `identity_core` / `system_identities` **sin migración**: One no replica identidad, la referencia. | Contrato §2.2: `users` no se toca. |
| **Organizaciones futuras** | `subject_type` acepta entidades del grafo. Una organización futura es un `subject_type` nuevo, no un campo nuevo. | Alineado con `VALID_TYPES` de `follows`. |
| **Verticales** | ⚠️ **No almacenar `vertical`.** `identity_core.py:116` establece *"derivado, NUNCA almacenado"*. Se resuelve leyendo el sujeto. | Contrato v1. |
| **Aislamiento de dominios** | `activities` es capa social; no sabe de Legal ni Medical. | Regla de capas §2.3. |

> **Decisión clave:** `activities` describe **hechos sociales**, no estados de
> negocio. `job.applied` es un hecho social; el estado de una candidatura es
> dato de negocio y vive en su propia colección. Mezclarlos obligaría a migrar
> la actividad cuando cambie el modelo de negocio.

---

## 7. Orden de implementación

Cada paso es aditivo, reversible y deja el producto en verde. **Ninguno toca
`notifications.py` en el mismo paso que crea la escritura.**

| # | Paso | Toca | Riesgo |
|---|---|---|---|
| **F0.9.3** | Crear `services/activities.py` con `record()` **write-only**, sin lector | nuevo servicio | 🟢 Nulo |
| **F0.9.4** | Índices + TTL. Sin datos aún | `server.py` | 🟢 Nulo |
| **F0.9.5** | Migrar **1 productor**: `create_group_post` (el de mayor fan-out) | `groups_routes.py` | 🟢 Bajo |
| **F0.9.6** | Migrar `join_group` y `follow` (los otros dos de grupos/grafo) | 2 rutas | 🟢 Bajo |
| **F0.9.7** | **Primer consumidor:** `notifications` deriva de la actividad | `notifications.py` | 🟡 Medio |
| **F0.9.8** | `record_event` se alimenta desde `activities` — **cierra la asimetría de §1.1** | `analytics` | 🟡 Medio |
| **F0.9.9** | Endpoint de lectura (perfil/ficha). Hasta aquí la colección se escribe pero nadie la lee | nuevo endpoint | 🟡 Medio |
| **F1+** | `entity_type='group'` y unión de audiencias en el fan-out | `follows` | 🟠 Ver F0.9 |

**Regla de oro:** F0.9.3-F0.9.6 son **puramente additive**. El primer punto de
no-retorno es **F0.9.7** (cuando `notifications` empieza a derivar), y por eso
exige evidencia de que la escritura funciona.

---

## 8. Riesgos

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| R1 | **Colección huérfana**: se escribe y nadie lee | 🟠 Alto | F0.9.9 en el mismo ciclo. Si tras 2 semanas no hay endpoint, **detener el proyecto**. |
| R2 | **Crecimiento sin TTL** (~18 M/año) | 🟠 Alto | TTL desde el día 1 (F0.9.4), no después |
| R3 | Sobre-ingeniería: 9 pasos para un problema | 🟡 Medio | F0.9.3 es < 80 líneas. Si el equipo no llega a F0.9.7, el coste sigue siendo bajo. |
| R4 | Romper el feed si `feed signals` lee `activities` | 🟠 Alto | `feed signals` **fuera de alcance**. `load_user_signals` sigue leyendo `follows`. |
| R5 | Doble notificación al activar F1 | 🟠 Alto | §3.3 Opción A, ya resuelta en F0.9.1 |
| R6 | Consumidores que escriben en `activities` | 🟡 Medio | Regla §4.3.1 + revisión de diff |
| R7 | Asimetría de §1.1 perpetuada | 🟡 Medio | F0.9.8 la cierra explícitamente |
| R8 | Doble escritura si se emite en la ruta **y** en el consumidor | 🔴 Crítico | **Invariante:** la escritura ocurre en **exactamente un** sitio. Si aparece un `record()` en un consumidor, es un bug. |

---

## 9. Qué NO debe hacerse

| ❌ Prohibido | Por qué |
|---|---|
| Crear `activities` sin consumidor de lectura | Deuda pura (§8 R1) |
| Deduplicar en `activities` | Colapsa hechos legítimos (§3.2) |
| Almacenar `actor_name`/`actor_picture` | Segunda fuente de identidad |
| Almacenar `vertical` | `identity_core`: derivado, nunca almacenado |
| Almacenar datos de negocio en `metadata` | Obliga a migrar al cambiar el dominio |
| `metadata` como bolsa libre | Sin whitelist, se vuelve `payload` de analytics |
| Consumer que escriba en `activities` | Rompe la regla de capas |
| Mover `group_posts` a `posts` en esta fase | Es decisión de Core (F3), no de F0.9 |
| Conectar `feed signals` a `activities` | Rompe el ranking actual (§8 R4) |
| Reemplazar `record_event` antes de F0.9.8 | Rompe `/api/analytics/summary` |
| Añadir cola, worker o Redis | F0.9.1 ya resolvió el bloqueo; la cola es F0.9.2+ |
| Habilitar `entity_type='group'` aquí | F1, tras F0.8 + F0.9 |

---

## 10. Conclusión

**`activities` no es un bus de eventos en el sentido de una cola: es un
registro de hechos sociales append-only, con audiencia, que hoy no existe y
que 4 de 9 dominios necesitan.**

Tres decisiones que este documento fija:

1. **Colección propia (A).** B y C fallan por modelo, no por coste.
2. **El dedupe pertenece a la entrega, no a la actividad.** Y el caso
   "empresa por dos caminos" **ya está resuelto** desde F0.
3. **Nada de esto es urgente para F1.** F0.9.1 ya resolvió el bloqueo y la
   truncanza. `activities` es la respuesta al *diseño de señales*, no al
   problema de rendimiento — y por eso puede ir después de F1 sin bloquear.

**La asimetría de §1.1 es el argumento más fuerte a favor:** el Feed notifica
pero no mide, y el docstring de `analytics.py` promete eventos que nadie
emite. Una capa común corrige ambas cosas a la vez.

**No se escribió código productivo. No se creó la colección. No se modificaron
`notifications.py`, `follows`, `groups` ni el Feed.**

---

*Fin del documento.*




