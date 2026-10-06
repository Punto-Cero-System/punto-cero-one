# Group Fan-out Redesign — Auditoría F0.9

> **Estado:** auditoría técnica y propuesta · **Fase:** Omega F0.9
> **Naturaleza:** diseño. **No implementa nada** — sin cambios de código, sin modelos nuevos, sin colas, sin migraciones, sin tocar `follows`, Social Graph ni Feed.

---

## 1. Archivos revisados

| Archivo | Qué aporta al análisis |
|---|---|
| `backend/routes/groups_routes.py:249-300` | `create_group_post` — origen del fan-out |
| `backend/services/notifications.py:82-134` | `dispatch()` — entrega + realtime |
| `backend/services/notifications.py:24-40` | `NotificationKind` (16 tipos) |
| `backend/services/realtime.py:1-217` | Broker SSE in-process, `emit_notification` |
| `backend/server.py:233-235` | Índices de `notifications` |
| `backend/requirements.txt` | Verificación de infraestructura asíncrona |
| `frontend/src/contexts/RealtimeContext.jsx` | Consumidor SSE en cliente |

**Hallazgo de infraestructura:** `requirements.txt` **no contiene** redis, celery, rq, arq, dramatiq, huey ni ningún broker. En todo el backend no hay `BackgroundTasks`, `asyncio.create_task`, `to_thread` ni `run_in_executor` — el único paralelismo es un `asyncio.gather` puntual en `widget_routes.py:71`. **Punto Cero One no tiene hoy capacidad asíncrona alguna.**

---

## 2. Flujo actual

### 2.1 Quién, qué y dónde

```
groups_routes.create_group_post          ← GENERADOR
  ├─ group_posts.insert_one              ← persistencia del post
  ├─ groups.$inc posts_count             ← contador
  └─ for each member (limit 500):        ← PUNTO DE FAN-OUT (línea 282)
       └─ notifications.dispatch(...)
            ├─ notification_preferences.find_one   ← 1 query POR DESTINATARIO
            ├─ notifications.insert_one            ← 1 write POR DESTINATARIO
            └─ realtime.emit_notification          ← SSE in-process
```

| Aspecto | Valor real |
|---|---|
| Genera | `POST /api/groups/{id}/posts` |
| Recibe | Todos los `group_members` del grupo, **excluyendo al autor** (`$ne`) |
| Dónde ocurre el fan-out | `groups_routes.py:282-293`, dentro del request |
| Tope actual | **500** (`.limit(500)`, línea 281) |
| Acumulado en el request | **Sí** — el `for` es `await` secuencial |

### 2.2 El coste real (medido por lectura del código)

`dispatch()` hace **2 round-trips a Mongo por destinatario**:
- `notification_preferences.find_one` (línea 103)
- `notifications.insert_one` (línea 123)

Más el publish SSE (in-process, sin red).

**Coste en el peor caso:**

| Destinatarios | Queries prefs | Inserts | Total ops Mongo |
|---|---|---|---|
| 100 | 100 | 100 | 200 |
| 500 (tope) | 500 | 500 | **1.000** |
| 5.000 (futuro) | 5.000 | 5.000 | **10.000** |

A ~1–3 ms por round-trip local, **500 destinatarios ≈ 0,5–1,5 s bloqueando el request**. Es decir: **el usuario no ve confirmación de publicación hasta que se notifica a medio mundo.**

### 2.3 Puntos de bloqueo

| # | Punto | Tipo |
|---|---|---|
| B1 | `async for m in cursor` → `await dispatch_notif` (línea 282-283) | **Secuencial** — ninguna concurrencia |
| B2 | `find_one` de preferencias por destinatario (dispatch:103) | Redundante — el 90% no tiene prefs |
| B3 | `insert_one` por destinatario (dispatch:123) | Redundante — debería ser `bulk_write` |
| B4 | Sin `bulk_write` en todo el backend (verificado: 0 usos) | Capacidad desaprovechada |
| B5 | El `limit(500)` **trunca silenciosamente**: en un grupo de 5.000, 4.500 miembros **nunca se enteran** | Corrección funcional |

### 2.4 El patrón se repite

`groups_routes.py:282` no es un caso aislado: la **misma forma de fan-out** aparece en:
- `follows_routes.py` (notificar al owner de la empresa / autor de la entidad)
- `company_routes.py:248` (`dispatch_notif`)
- `event_routes`, `job_routes`, `feed_routes`, `messaging_routes`

Es decir: **arreglarlo solo en grupos deja el patrón en los otros 5 módulos.** F0.9 debe resuelverse donde nace el problema.

---

## 3. ¿Existe separación entre las cuatro capas?

**NO.** El principio *"una acción social produce un evento; los consumidores deciden cómo distribuirlo"* **no se cumple hoy.**

| Capa | ¿Separada? | Evidencia |
|---|---|---|
| Evento social | 🔴 **No existe** | No hay registro de "ocurrió algo". Solo el efecto (notificación). |
| Notificación | 🔴 Fusionada | Se escribe dentro de la acción, no como consecuencia |
| Realtime | 🟡 **Apretado pero correcto** | `dispatch:126-131` envuelve el publish en su propio `try` → *"la DB es la verdad"* |
| Analytics | 🔴 **Ausente en grupos** | `groups_routes.py` no importa `record_event` |

### Lo que sí está bien

Dos decisiones de diseño son **correctas y deben preservarse**:
1. **`dispatch()` nunca lanza** (`except: return None`, línea 133) — notificaciones no tumban la acción.
2. **El realtime es soft-fail y subordinado al write** (líneas 126-131) — la DB es la fuente de verdad.

El broker además ya está **diseñado para ser sustituible** (`realtime.py:10-12`: *"Tomorrow you can plug Redis pub/sub by implementing the same 4 methods"*).

### Lo que falta

**No hay evento intermedio.** La ruta es `acción → notificación → realtime`, tres pasos cosidos. No hay punto donde insertar un consumidor nuevo, ni donde aplicar políticas (dedupe, preferencias, priorización).

**Consecuencia directa para F1:** el día que los **grupos seguidos** deban recibir notificaciones, el fan-out pasa de 500 a `miembros + seguidores`, y el `limit(500)` empezará a truncar por ambas vías. **El rediseño es condición previa, no mejora.**

---

## 4. Opciones evaluadas

### Opción A — Mantener síncrono con optimizaciones

Sin eventos ni colas. Solo acelerar el fan-out actual.

| Dimensión | Valoración |
|---|---|
| **Complejidad** | 🟢 Baja — 1 archivo, cambios locales |
| **Riesgo** | 🟡 Medio — toca el camino de escritura de notificaciones en 6 módulos |
| **Compatibilidad Core** | 🟢 Total — sin contrato nuevo |
| **Impacto arquitectura futura** | 🔴 **Alto y negativo** — consolida exactamente el anti-patrón que se quiere eliminar. Si F1 necesita más escala, se vuelve a rediseñar. |

Optimizaciones concretas: `bulk_write` en vez de N `insert_one`; **una sola** query de preferencias para todos los destinatarios (`find({user_id: {$in: [...]}})`); `asyncio.gather` con concurrencia acotada; **eliminación del `limit(500)` silencioso**.

### Opción B — Capa intermedia de eventos ⭐

Introducir un evento de dominio; cada consumidor decide. `action → event → {notification, realtime, analytics}`.

| Dimensión | Valoración |
|---|---|
| **Complejidad** | 🟡 Media — un servicio nuevo + migrar emisores gradualmente |
| **Riesgo** | 🟡 Medio — **bajo si es aditiva**: si el evento falla, la acción sigue |
| **Compatibilidad Core** | 🟢 Alta — un log de eventos es **el** formato más portable; Core puede replicarlo o ignorarlo |
| **Impacto arquitectura futura** | 🟢 **Positivo** — es la base que piden los criterios obligatorios |

Nótese que el contrato v1 §2.3 **ya define esta capa**:

```
ACTIVIDAD    activities (FUTURO — no existe aún)
             "qué pasó y a quién le concierte" — append-only, sin estado
```

**La arquitectura ya fue aprobada; falta construirla.**

### Opción C — Sistema asíncrono (worker + cola)

Desacoplar la entrega del request con un worker.

| Dimensión | Valoración |
|---|---|
| **Complejidad** | 🔴 Alta — broker, worker, reintentos, DLQ, despliegue |
| **Riesgo** | 🔴 Alto — nueva dependencia de infraestructura; sin Redis hoy en `requirements` |
| **Compatibilidad Core** | 🟡 Media — atada a una implementación concreta de cola |
| **Impacto arquitectura futura** | 🟢 Alto, pero **innecesario hoy** |

**Requiere** añadir redis/celery/rq a `requirements.txt` — hoy **no existe ninguno** (verificado). Eso es una decisión de infraestructura, no de producto.

---

## 5. Comparativa

| | A — Optimizar | B — Capa de eventos ⭐ | C — Asíncrono |
|---|---|---|---|
| Reduce latencia del request | 🟢 Sí | 🟢 Sí | 🟢 Sí |
| Elimina la truncanza (B5) | 🟢 Sí | 🟢 Sí | 🟢 Sí |
| Escala a miles de miembros | 🟡 Parcial | 🟢 Sí | 🟢 Sí |
| Prepara `follows` de grupos | 🔴 No | 🟢 Sí | 🟢 Sí |
| Prepara actividades sociales | 🔴 No | 🟢 Sí | 🟢 Sí |
| Prepara notificaciones personalizadas | 🟡 Con esfuerzo | 🟢 Sí | 🟢 Sí |
| Prepara integración con Darwin IA | 🔴 No | 🟢 Sí | 🟢 Sí |
| Coste de infraestructura | 🟢 Cero | 🟢 Cero | 🔴 Nuevo broker |
| Reversibilidad | 🟢 Total | 🟢 Alta | 🔴 Baja |
| Riesgo de sobre-ingeniería | 🟢 Bajo | 🟢 Bajo | 🔴 Alto |

**Veredicto: B.** A es insuficiente para los criterios obligatorios; C es prematuro — resuelve un problema que todavía no existe y añade una dependencia que el proyecto hoy no tiene.

---

## 6. Recomendación

### 6.1 ¿Necesitamos nueva colección?

**Sí — una: `activities`.** Pero es exactamente la que el contrato v1 §2.3 **ya aprobó como futura**. No es una invención nueva.

```
activities:
{ id, actor_id, kind, subject_type, subject_id, group_id?,
  audience: {type, id}, visibility, created_at }
```

Es un **log append-only**, no estado de negocio. Por eso es portable: Core puede replicarlo, consumirlo o ignorarlo sin migración.

> **Nota de alcance:** crearla es una decisión posterior. Esta auditoría solo la recomienda.

### 6.2 ¿Necesitamos worker?

**No, todavía.** Con la Opción B el evento se persiste y los consumidores se ejecutan **dentro del request**, pero desacoplados: si un consumidor falla, la acción y el evento sobreviven.

Un worker solo será necesario cuando el volumen lo justifique — y ese punto aún no existe (verificado: sin broker alguno en el proyecto).

### 6.3 ¿Necesitamos Redis o cola?

**No.** El broker SSE ya está diseñado para sustituirse sin tocar consumidores (`realtime.py:10-12`). Añadir Redis ahora sería decidir infraestructura sin necesidad demostrada.

### 6.4 ¿Podemos resolverlo con servicios internos primero?

**Sí — y esa es la respuesta.** La solución propuesta es:

1. `services/activities.py` — `record()` + `emit()` (append-only, fire-and-forget).
2. `services/notification_fanout.py` — resuelve destinatarios + preferencias + `bulk_write` + SSE.
3. `groups_routes` deja de conocer destinatarios: emite un evento y termina.
4. `NotificationPublic` **no cambia**. Los clientes no se ven afectados.

**Cero dependencias nuevas. Cero cambios de contrato público.**

### 6.5 Por qué esto satisface los criterios obligatorios

| Criterio | Cómo lo cubre |
|---|---|
| Grupos con miles de miembros | `bulk_write` + `audience:{type:"group"}` → escala sin enumerar en la ruta crítica |
| Follows de grupos | `audience` resuelve `members ∪ followers` **con dedupe por `(recipient, subject)`** |
| Actividades sociales | `activities` **es** la actividad; feed y notificaciones la consumen |
| Notificaciones personalizadas | El consumidor decide por usuario: prefs, hora, digest, dedupe |
| Integración con Darwin IA | Un log de eventos es el insumo natural para IA: quién hizo qué, cuándo y con qué contexto |

---

## 7. Orden de implementación posterior

> Ningún paso se ejecuta hasta recibir aprobación.

| Paso | Contenido | Riesgo | Reversible |
|---|---|---|---|
| **F0.9.1** | Extraer `notification_fanout.py` con `bulk_write` y **query única de preferencias**. Sin cambiar comportamiento. Elimina la truncanza (B5). | 🟢 Bajo | 🟢 Sí |
| **F0.9.2** | `services/activities.py` + colección `activities`. `record()` no altera las rutas. | 🟢 Bajo | 🟢 Sí |
| **F0.9.3** | `create_group_post` emite el evento y delega el fan-out. **Aditivo**: si el evento falla, cae al camino actual. | 🟡 Medio | 🟢 Sí |
| **F0.9.4** | Migrar los otros emisores (`follows`, `company`, `job`, `event`, `feed`, `messaging`). | 🟡 Medio | 🟢 Sí |
| **F0.9.5** | `audience:{type:"group"}` con dedupe. **Prepara F1** (grupos seguidos). | 🟡 Medio | 🟢 Sí |
| **F3** | Worker/cola — **solo si** el volumen lo demuestra. | 🔴 Alto | 🔴 No |

**F0.9.1 por sí solo ya resuelve el request bloqueado** y no requiere ninguna decisión estructural. Es el punto de entrada de menor riesgo.

---

## 8. Riesgos

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| **R1** | **Doble notificación** al llegar los follows: un usuario miembro *y* seguidor recibe dos avisos idénticos. | 🔴 Crítico | Dedupe por `(recipient_id, subject_id)`. **Debe existir antes de F1.** |
| **R2** | **Pérdida de notificaciones** si el consumidor falla sin reintento. | 🟠 Alto | `activities` es append-only: el evento sobrevive y se puede reprocesar. Esa es su razón de ser. |
| **R3** | **Truncanza silenciosa** actual (`limit(500)`), desapercibida hasta ahora. | 🟠 Alto | F0.9.1 la elimina. **Mientras tanto es un bug vivo.** |
| **R4** | Sobre-ingeniería: construir más de lo que el volumen exige. | 🟡 Medio | F0.9.1 y F0.9.2 son pequeños y medibles. El worker se difiere explícitamente. |
| **R5** | `activities` sin retención → crecimiento indefinido. | 🟡 Medio | Índice `{created_at}` + retención cuando se implemente. Hoy no aplica: la colección no existe. |
| **R6** | Acoplar `activities` al Feed, congelado por el contrato §6. | 🟡 Medio | `activities` **no** alimenta el Feed en F0.9. Su consumo por el motor es F3, decisión de Core. |
| **R7** | Doble fuente de verdad entre `notifications` y `activities`. | 🟢 Bajo | `notifications` sigue siendo lo que el usuario lee; `activities` es el log. Responsabilidades separadas. |

---

## 9. Conclusión

El problema de fondo **no es el rendimiento**: es que **no existe el concepto de evento**. Hay cuatro capas —actividad, notificación, realtime, medición— que el contrato v1 §2.3 define separadas, pero el código las ejecuta cosidas dentro de la acción.

**Opción B es la recomendada** porque:

1. Es la **única** que satisface los cinco criterios obligatorios.
2. **No añade infraestructura**: cero redis, cero worker, cero cola.
3. **Ya está aprobada** en el contrato v1 — esto es construir lo decidido, no inventar.
4. Es **aditiva**: cada paso se revierte sin pérdida.

**Secuencia sugerida:** empezar por **F0.9.1**, que por sí solo elimina el request bloqueado y la truncanza sin tocar arquitectura. La capa `activities` viene después, con el comportamiento ya medido.

**Advertencia crítica para F1:** el riesgo **R1 (doble notificación)** no puede resolverse después. Con grupos seguidos, un usuario que sea miembro *y* seguidor recibirá dos avisos idénticos del mismo post. **El dedupe debe existir antes de activar `entity_type="group"`.**

---

*Auditoría previa a la implementación. No se modificó código, no se creó `activities`, no se añadió cola ni worker.*