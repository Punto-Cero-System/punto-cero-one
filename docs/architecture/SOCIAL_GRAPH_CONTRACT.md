# Social Graph Contract — v1

> **Estado:** aprobado · **Fase:** Omega F0.6 · **Ámbito:** Punto Cero One (capa social)
> **Naturaleza:** documento normativo. No describe lo implementado hoy, sino **lo que queda congelado** para las siguientes fases.

Este documento fija las reglas del grafo social **antes** de añadir nuevas entidades, para que `entity_type="group"` —y cualquier entidad futura— se implemente sin reabrir las decisiones aquí cerradas.

**No modifica lógica, no crea modelos, no migra datos y no cambia endpoints.**

---

## 1. Principios

**P1 · `follows` es la fuente primaria de relaciones sociales.**

```
follows: { user_id, entity_type, entity_id, created_at }
```

Regla de lectura: cualquier consulta que necesite saber "quién sigue a qué" se resuelve contra `follows` — **nunca** contra un campo contador ni contra una colección paralela.

**P2 · Los contadores son caché derivada.** Existen solo para evitar agregaciones en las listas. Nunca son fuente de verdad. Ver §3.

**P3 · Relación, pertenencia e interés son conceptos distintos.** Una misma persona puede seguir, pertenecer e interesarse por la misma entidad a la vez, con consecuencias distintas. No deben colapsarse. Ver §5.

**P4 · Idempotencia es obligatoria.** Repetir la misma acción nunca duplica filas ni altera contadores. Verificado en `test_omega_f0_follower_counter.py` (Caso 3).

**P5 · Compatibilidad antes que pureza.** Ningún cambio rompe un contrato existente mientras Punto Cero System no lo autorice. Ver §6.

---

## 2. Modelos actuales (congelados a F0.6)

### 2.1 Relaciones sociales

| Colección | Forma | Rol | Estado |
|---|---|---|---|
| `follows` | `{user_id, entity_type, entity_id, created_at}` | **Relación de seguimiento** | Canónico |
| `group_members` | `{group_id, user_id, role, joined_at}` | **Pertenencia** a grupo | Canónico |
| `event_rsvps` | `{event_id, user_id, status}` | **Participación** en evento | Canónico |

`entity_type` válidos hoy: `user`, `company`, `hashtag`, `country`, `vertical`, `event`.
Pendiente de aprobación: `group` (§5).

### 2.2 Identidad

| Colección | Rol |
|---|---|
| `users` | **Única** fuente de identidad. 30 campos en `ProfilePublic` (`models_profile.py:73`). No se divide, no se replica, no se migra. |
| `company_follows` | Espejo legacy. **No es fuente de verdad.** Se mantiene por compatibilidad. |

### 2.3 Capas sociales

```
RELACIONES   follows · group_members · event_rsvps
             "quién está conectado con qué" — idempotentes, persistentes

ACTIVIDAD    activities (FUTURO — no existe aún)
             "qué pasó y a quién le concierte" — append-only, sin estado

ENTREGA      notifications · realtime (SSE)
             "avisar a alguien de un hecho" — derivado, nunca fuente

MEDICIÓN     analytics_events · analytics_counters
             "cuánto y con qué frecuencia" — derivado, nunca fuente
```

**Regla de capas:** una capa **no** escribe en otra. `notifications` no crea relaciones; `follows` no emite analítica por sí mismo; `analytics` no decide nada.

### 2.4 Entregas existentes

| Canal | Colección | Consumido por |
|---|---|---|
| Notificación | `notifications` (16 `NotificationKind`) | `NotificationsBell`, `/notificaciones` |
| Realtime | SSE vía `services/realtime.emit_notification` | `RealtimeContext` |
| Bus cliente | eventos `pc:*` en `window` | `LiveFeed`, `FollowButton` |

`pc:*` es **solo cliente**, efímero y de alcance de pestaña. Nunca es fuente de verdad ni sustituye a `notifications`.

---

## 3. Contrato de contadores (caché derivada)

### 3.1 Campos reconocidos

| Campo | Colección | Derivado de | Estado |
|---|---|---|---|
| `followers_count` | `companies` | `follows{entity_type:"company"}` | Canónico (corregido en F0) |
| `members_count` | `groups` | `group_members` | Canónico |
| `attendees_count` | `events` | `event_rsvps{status:"going"}` | Canónico |
| `interested_count` | `events` | `event_rsvps{status:"interested"}` | Canónico |
| `applications_count` | `jobs` | `job_applications` | Canónico |
| `posts_count` | `companies`, `groups` | `posts`, `group_posts` | Canónico |

### 3.2 Reglas invariables

1. **Nombre en plural siempre.** `followers_count`, no `follower_count`. El singular fue un bug real (F0): nada lo leía y el decremento nunca ocurría.
2. **Incrementar solo en inserción efectiva.** Patrón `if res.upserted_id is not None`, no "si no existía antes" (carrera). Vigente en `follows_routes.py:86`.
3. **Decrementar con guarda `{"$gt": 0}`.** Impide bajar de cero ante reintentos.
4. **El decremento solo si hubo borrado real.** `if r.deleted_count:`.
5. **Si se desincroniza, la verdad es `follows`.** Un contador nunca justifica escribir en `follows` para hacerlo cuadrar.

### 3.3 Procedimiento de reconciliación (obligatorio tras cualquier bug de contador)

1. Leer el conteo real desde la colección de relaciones.
2. Comparar con el campo del documento.
3. Reportar la diferencia **antes** de corregir.
4. Corregir solo con backup previo.
5. Ejecutar evidencia de regresión equivalente a `test_omega_f0_follower_counter.py`.

**El campo `follower_count` (singular) queda oficialmente prohibido.** Si aparece, es deuda a eliminar — nunca a leer.

---

## 4. Reglas para entidades futuras

Al añadir un `entity_type` nuevo a `follows`, el cambio debe cumplir:

| # | Regla |
|---|---|
| R1 | El contador vive en el documento de la entidad, en plural y conforme a §3. |
| R2 | La escritura pasa por el servicio único de relaciones, no desde la ruta de la entidad. |
| R3 | Idempotencia verificada con prueba equivalente a `test_omega_f0_follower_counter.py`. |
| R4 | Si existe endpoint legacy equivalente, se mantiene activo y espeja en `follows`. |
| R5 | El frontend usa siempre `followsService`. Nunca una implementación local. |
| R6 | Si no hay relación social real, **no** se añade el `entity_type`. Un catálogo no es un grafo. |

---

## 5. Preparación para `entity_type="group"` (definido, no implementado)

### 5.1 Distinción semántica — el punto central

```
group_members                = PERTENENCIA
    "soy miembro de este grupo, con este rol, desde esta fecha"
    → da derecho a publicar, ver el grupo y recibir su notificación
    → fuente: group_members

follows(entity_type:"group") = INTERÉS / SEGUIMIENTO
    "me interesa este grupo, quiero su actividad en mi feed"
    → no otorga permiso ni aparece en la lista de miembros
    → fuente: follows
```

**Por qué son distintos:** el modelo permite seguir un grupo **sin** unirse, y ser ambas cosas a la vez. Colapsarlos perdería la capacidad de recomendar grupos a alguien que no pertenece a ellos — el caso de uso más valioso para el ranking.

### 5.2 Reglas propuestas

| # | Regla |
|---|---|
| G1 | `group_members` **no** se replica en `follows`. Son hechos distintos (P3). |
| G2 | Unirse **no** crea follow. Seguir **no** da membresía. |
| G3 | Si se requiere puente, debe ser explícito y unidireccional, nunca implícito. |
| G4 | `follows{entity_type:"group"}` alimenta el motor de feed como **afinidad**, no como permiso. |
| G5 | `members_count` sigue derivado de `group_members`. **No** de `follows`. |

### 5.3 Impacto esperado

- `feed_engine/engine.py:28-41` ya lee `follows` por `entity_type`; añadir `group` es una rama más.
- `FollowButton` ya acepta `entityType` arbitrario → **cero cambios de frontend** para seguir un grupo.
- El `NotificationKind` `group_post` ya existe pero hoy se dirige al autor. Difundirlo a seguidores es **decisión pendiente**, fuera de alcance.

---

## 6. Compatibilidad

| Elemento | Estado | Regla |
|---|---|---|
| `POST/DELETE /api/companies/{id}/follow` | **ACTIVO** | No eliminar. Contrato público; clientes externos pueden usarlo. |
| `POST/DELETE /api/follows/{type}/{id}` | **CANÓNICO** | Único camino para código nuevo. |
| `companyService.follow` (frontend) | **SIN CONSUMIDORES** | Marcar `@deprecated`. Eliminable. |
| `company_follows` | **ESPEJO** | Se mantiene hasta decisión de Core. |
| `users` | **NO SE TOCA** | La identidad no se migra ni se divide. |
| Feed (`/api/feed/*`, `mixed-feed`) | **NO SE TOCA** | Contrato estable. |

**Principio:** Punto Cero One es una capa independiente conectable al futuro Punto Cero System. Toda migración de endpoint o de modelo es **decisión de Core**, nunca de una fase de One.

---

## 7. Decisiones congeladas

| # | Decisión | Estado |
|---|---|---|
| C1 | `follows` es la fuente primaria de relaciones sociales | **Congelada** |
| C2 | Los contadores son caché derivada, nunca fuente de verdad | **Congelada** |
| C3 | Los contadores se nombran en plural | **Congelada** |
| C4 | Relación / pertenencia / interés son conceptos separados | **Congelada** |
| C5 | El endpoint legacy de company follow permanece activo | **Congelada** |
| C6 | El frontend usa `followsService` exclusivamente | **Congelada** |
| C7 | `users` es la única fuente de identidad | **Congelada** |
| C8 | Las capas no se escriben entre sí | **Congelada** |
| C9 | `follower_count` (singular) está prohibido | **Congelada** |
| C10 | Ninguna entidad entra al grafo sin relación social real (R6) | **Congelada** |

---

## 8. Riesgos

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| **R1** | Doble escritura de contadores (legacy + unificado) mientras ambos endpoints sigan activos | 🟠 Alto | Idempotencia verificada en F0. Reconciliación periódica contra `follows`. |
| **R2** | Contadores desalineados por follows creados vía unificado pre-F0 | 🟠 Alto | Pendiente: ejecutar §3.3 con acceso a Mongo. |
| **R3** | Colapso de pertenencia e interés al añadir `'group'` | 🟡 Medio | §5.1 lo define; G1/G2 lo impiden. |
| **R4** | Replicar el bug de contador en el siguiente `entity_type` | 🟡 Medio | R1–R5 de §4 + evidencia obligatoria por entidad. |
| **R5** | Divergencia `slug` vs `id` en relaciones de empresa | 🟡 Medio | Bug histórico real. Normalizar siempre a `id`. |
| **R6** | Dependencia de un entorno con Mongo para validar | 🟡 Medio | La suite `pytest` requiere Docker/Mongo no disponible en local. |
| **R7** | Crecimiento del contrato público `follows` | 🟢 Bajo | Todo aditivo: solo crece `entity_type`. No cambian campos existentes. |

---

## 9. Qué sigue

### Antes de implementar `entity_type="group"`

| # | Acción | Depende de |
|---|---|---|
| 1 | Ejecutar la reconciliación §3.3 y reportar diferencias | Acceso a MongoDB |
| 2 | Eliminar el campo residual `follower_count` (opcional, cosmético) | Acción 1 |
| 3 | Marcar `companyService.follow` como `@deprecated` | — |
| 4 | Revalidar la suite completa con backend accesible | Entorno |

Ninguna es bloqueante para iniciar Fase 1 **salvo la 1**: sin reconciliación, un nuevo `entity_type` hereda deuda que luego habría que corregir en dos dominios a la vez.

---

*Fin del contrato v1. Cualquier cambio requiere decisión explícita y actualización de la tabla §7.*