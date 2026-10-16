# Group Privacy Fix Plan

> **Estado:** plan de corrección · **Fase:** Omega F0.8 · **Origen:** `GROUP_GRAPH_DESIGN_REVIEW.md` §1.4 (riesgo G1)
> **Naturaleza:** diseño de corrección. **No implementa nada** — sin cambios de código, sin `entity_type="group"`, sin tocar `follows` ni el Feed.

---

## 1. Auditoría de las reglas actuales

### 1.1 Estados posibles de `privacy`

| Valor | Origen | ¿Se aplica en lecturas? |
|---|---|---|
| `"public"` | `GroupCreate.privacy` (línea 51), default | N/A — siempre visible |
| `"private"` | `GroupCreate.privacy` (línea 51) | 🔴 **No. Nunca.** |
| `null` / ausente | Grupos previos a la columna | ⚠️ Se serializa como `"public"` (línea 65: `doc.get("privacy", "public")`) |

`privacy` se escribe solo en `create_group` (línea 103). **No existe ningún endpoint que lo modifique después** — un grupo es privado o público desde su creación, sinmutable.

### 1.2 Comportamiento actual (verificado)

```
GET /api/groups                  → TODOS los grupos, sin filtro       🔴
GET /api/groups/{id}             → cualquier grupo por id              🔴
GET /api/groups/{id}/members     → cualquiera, sin filtro              🔴
GET /api/groups/{id}/posts       → cualquiera, sin filtro              🔴
```

Las 4 lecturas son públicas por defecto. `privacy` se persiste, se devuelve en el JSON (`_serialize_group:65`) y **nunca se usa como condición de filtro**.

### 1.3 Usuarios autorizados — modelo actual

| Actor | Cómo se determina | Dónde |
|---|---|---|
| Miembro | `group_members.find_one({group_id, user_id})` | líneas 162, 239, 143 |
| Administrador | `groups.admin_id == user_id` (booleano derivado) | líneas 73, 334, 361 |
| Superusuario | `viewer.get("role") == "admin"` | ⚠️ **No se usa en grupos** |
| Invitado | — | ❌ **No existe el concepto** |

### 1.4 Vacíos detectados

| # | Vacío | Consecuencia |
|---|---|---|
| V1 | **No hay invitaciones.** No existe colección, token ni endpoint. | El requisito *"usuarios autorizados si existe invitación"* del brief **no es implementable hoy**. |
| V2 | **No hay moderación.** `join`/`posts` solo validan existencia y membresía. | Un admin no puede expulsar ni banningue. |
| V3 | **No hay estado de solicitud.** Unirse es inmediato, incluso en privado. | Privado sin control de acceso real. |
| V4 | **El admin puede abandonar su grupo.** `leave_group` no comprueba `admin_id`. | Grupos huérfanos (riesgo G6 de la revisión anterior). |
| V5 | **No hay moderación de plataforma sobre grupos.** El `role == admin` global no se consulta. | Un grupo privado no tiene vía de fiscalización. |

---

## 2. Filtro de acceso propuesto

### 2.1 Matriz de decisión

| Recurso | Público | Privado + no miembro | Privado + miembro |
|---|---|---|---|
| Listado (`GET /api/groups`) | ✅ visible | ❌ **excluido** | ✅ visible |
| Detalle (`GET /{id}`) | ✅ 200 | 🔴 **403** | ✅ 200 |
| Miembros (`GET /{id}/members`) | ✅ 200 | 🔴 **403** | ✅ 200 |
| Posts (`GET /{id}/posts`) | ✅ 200 | 🔴 **403** | ✅ 200 |
| Publicar (`POST /{id}/posts`) | ✅ si es miembro | 🔴 403 | ✅ 200 |
| Unirse (`POST /{id}/join`) | ✅ | ⚠️ **403** (ver 2.3) | — idempotente |
| Portada (`PUT/DELETE /cover`) | 🔒 solo admin | 🔒 403 | 🔒 solo admin |

### 2.2 Código de acceso autorizado

Un usuario tiene acceso a un grupo **si** se cumple cualquiera de:

```
es_miembro(user, group)      → existe group_members{group_id, user_id}
es_admin_de_grupo(user, g)   → g.admin_id == user.id
es_admin_de_plataforma(user) → user.role == "admin"   [NUEVO]
es_miembro_admin(g)          → group_members{..., role:"admin"}   [ver 2.4]
```

> **Nota sobre `admin_id`:** el modelo actual tiene **doble fuente de verdad** para "administrador": `groups.admin_id` (booleano derivado) y `group_members.role == "admin"` (creado en línea 116). El filtro debe consultar **ambas**, porque el admin siempre tiene fila en `group_members`, pero un traspaso de propiedad futuro solo actualizaría una.

### 2.3 El caso más delicado: ¿se puede unirse a un privado?

**Recomendación: no.** Unirse a un grupo privado debe requerir **aprobación**, y ese flujo no existe (V3).

| Opción | Comportamiento | Coste | Riesgo |
|---|---|---|---|
| **A — 403 directo** 🔴 | No se puede entrar sin invitación | Nulo | 🔴 **El admin queda bloqueado para crecer** |
| B — Solicitud pendiente | Crear `pending` y notificar al admin | Medio (nuevo estado) | 🟢 |
| C — Unirse libre | Mantener el comportamiento actual | Nulo | 🔴 Privado sin control de acceso |

**B es la opción correcta**, pero introduce estado nuevo — fuera del alcance de "cambio mínimo". **Recomendación para F0.8: aplicar A (403) como cierre de seguridad, y tratar B como fase posterior.**

> **Consecuencia operativa que debe aceptarse:** tras F0.8, un grupo privado creado por un admin **quedará sellado** salvo que sus miembros se unan por otro medio. Como `create_group` auto-une al admin (línea 113), el grupo tiene **al menos un miembro garantizado** y por tanto no queda inaccesible. **No hay riesgo de crear un grupo privado huérfano.** Pero sí se pierde la capacidad de crecer sin invitación.

### 2.4 Recomendación sobre la doble fuente de verdad

**No unificar en F0.8.** El filtro consulta ambas y listo. La unificación (transferencia de propiedad) es un cambio de modelo y va en fase posterior.

---

## 3. Puntos exactos de corrección

### 3.1 Helper único — el corazón de la solución

**Una sola función nueva**, colocada antes de los endpoints de lectura. Concentra la lógica y evita repetirla en 4 sitios:

```
async def _group_access(db, group_id, user_id) -> str
    → "public" | "member" | "admin" | "denied"
```

- Si el grupo no existe → `404`.
- Si `privacy == "public"` → `"public"`.
- Si hay fila en `group_members` → `"member"` (o `"admin"` si `role=="admin"`).
- Si `admin_id == user_id` → `"admin"`.
- Si `user.role == "admin"` (plataforma) → `"admin"`.
- Resto → `"denied"` → `403`.

**Toda la corrección se reduce a llamar a este helper en los 4 endpoints.** El resto es unchanged.

### 3.2 Endpoints afectados

| # | Endpoint | Línea | Cambio | Dificultad |
|---|---|---|---|---|
| E1 | `GET /api/groups` | 129-150 | Añadir `privacy:"public"` al filtro `q`; para viewer, además incluir sus privados (`:152` vía `$or` con `group_members`) | 🟡 Medio |
| E2 | `GET /api/groups/{id}` | 153-164 | `_group_access` → 403 si `denied` | 🟢 Fácil |
| E3 | `GET /{id}/members` | 210-227 | `_group_access` → 403 si `denied` | 🟢 Fácil |
| E4 | `GET /{id}/posts` | 284-305 | `_group_access` → 403 si `denied` | 🟢 Fácil |

**Sin cambio:** `join` (ya es idempotente), `leave` (no filtra), `create` (define el valor), `cover` (ya valida `admin_id`).

### 3.3 Restricción de privacidad en listado (E1) — la única con lógica real

El listado necesita **dos condiciones**:
1. Solo grupos públicos **salvo que el viewer sea miembro o admin**.
2. Esto implica una subconsulta a `group_members` para el viewer actual.

```js
// propuesta de filtro (NO implementar en este documento)
if (viewer) {
  const mine = [ids de group_members del viewer];
  q["$or"] = [{ "privacy": "public" }, { "id": { "$in": mine } }, { "admin_id": viewer }];
} else {
  q["privacy"] = "public";
}
```

⚠️ **Requiere una segunda lectura** de `group_members` por request. El coste es aceptable (ya se hace en la línea 143 para `is_member`), pero conviene **fusionar ambas lecturas** en una sola.

### 3.4 Cambio de comportamiento del frontend

`CommunityPage.jsx:22-23` hace `groupsService.list().catch(() => setGroups([]))` y `:36` tiene `catch { /* silent */ }`. Con F0.8:
- Grupos privados **desaparecen del listado** para no-miembros → correcto, sin cambio en frontend.
- Abrir el detalle de un privado no-miembro dará 403 → el `catch` actual ya degrada a lista vacía, pero **el usuario no verá por qué**.

**Recomendación:** dejar el frontend como está en F0.8 (degrada correctamente) y mejorar el mensaje de403 en fase posterior. **Ningún cambio de frontend es bloqueante.**

---

## 4. Riesgo de cambio

| # | Riesgo | Sev. | Mitigación |
|---|---|---|---|
| P1 | **Regresión de UX.** Grupos privados que hoy son visibles desaparecerán del listado para no-miembros. Si alguien creó un privado esperando que fuera visible, pierde contenido. | 🟠 Alto | **Comunicar el cambio.** Es el comportamiento correcto, pero visible. |
| P2 | **403 inesperado en `CommunityPage`.** Un `detailOpen` sobre un grupo ya no visible produce fallo silencioso. | 🟡 Medio | El `catch` actual degrada a lista vacía (`:23`). Aceptable en F0.8. |
| P3 | **Coste del listado (E1).** Subconsulta extra a `group_members` por request. | 🟢 Bajo | Fusionar con la lectura existente de `is_member` (línea 143). Índice recomendado `{user_id, group_id}`. |
| P4 | **Pérdida de catálogo.** Un cliente que léía el listado como catálogo abierto pierde los privados. | 🟡 Medio | Es el objetivo. Único consumidor: `CommunityPage` (verificado). |
| P5 | **Doble fuente de verdad (admin).** Consultar solo `admin_id` perdería acceso tras un futuro traspaso. | 🟡 Medio | El helper consulta **ambas** (§2.2). |
| P6 | **Grupo privado inaccesible.** Si el admin saliera (V4), nadie tendría acceso. | 🟡 Medio | Mitigado: `create_group` auto-une al admin (línea 113). Aun así, resolver V4 antes. |

**Riesgo residual bajo.** La corrección es **aditiva** (un filtro), no destructiva: no cambia esquemas, no migra datos, no toca `follows` ni el Feed. Lo único que cambia es **qué se ve**.

---

## 5. Casos de prueba obligatorios

### 5.1 Matriz mínima (cubre los 4 casos del brief)

| # | Escenario | Precondición | Endpoint | Esperado |
|---|---|---|---|---|
| **T1** | Público — anónimo ve | grupo `public` | `GET /{id}` | ✅ 200, `privacy:"public"` |
| **T2** | Público — anónimo lista | grupo `public` | `GET /api/groups` | ✅ 200, presente |
| **T3** | Privado — externo NO ve detalle | `private`, U no miembro | `GET /{id}` | 🔴 **403** |
| **T4** | Privado — externo NO ve miembros | idem | `GET /{id}/members` | 🔴 **403** |
| **T5** | Privado — externo NO ve posts | idem | `GET /{id}/posts` | 🔴 **403** |
| **T6** | Privado — NO aparece en listado | idem | `GET /api/groups` | ✅ 200, **ausente** |
| **T7** | Miembro ve contenido | `private`, U miembro | `/{id}`, `/members`, `/posts` | ✅ 200 en los tres |
| **T8** | Miembro ve su privado en listado | idem | `GET /api/groups` | ✅ 200, **presente** |
| **T9** | Administrador administra | U = `admin_id` | `PUT /{id}/cover` | ✅ 200 |
| **T10** | Admin de plataforma accede | U `role=="admin"` | `GET /{id}` privado | ✅ 200 |
| **T11** | Anónimo NO accede a privado | `private`, sin sesión | `GET /{id}` | 🔴 **403** |
| **T12** | Grupo inexistente | id inexistente | `GET /{id}` | 🔴 **404** (no 403) |

### 5.2 Casos de borde

| # | Escenario | Esperado | Nota |
|---|---|---|---|
| T13 | Grupo sin campo `privacy` (legacy) | ✅ Tratar como público | `doc.get("privacy","public")` |
| T14 | Doble `join` en privado (miembro) | ✅ Idempotente | Comportamiento existente |
| T15 | Listar sin sesión | Solo públicos | Rama `else` de §3.3 |
| T16 | `admin_id` distinto del viewer | 403 | Verifica que solo coincide el admin |

### 5.3 Evidencia mínima de no-regresión

Además de la matriz, la evidencia debe demostrar que **no se rompió lo público**:

- Un grupo público se sigue listando y viendo igual que antes.
- `GET /api/groups` autenticado mantiene `is_member` correcto.
- El conteo del listado no cambia para grupos públicos.

**Estrategia:** la suite existente (`test_wave12_final.py`) cubre join/post/members de un grupo **público**. Al ser público, **debe seguir pasando sin modificación** — esa es la prueba de no-regresión más barata y valiosa.

---

## 6. Conclusión

La corrección es **acotada y reversible**: un helper de acceso + un filtro en 4 endpoints de lectura. No toca esquemas, no migra datos, no altera `follows` ni el Feed, y **no requiere ningún modelo nuevo**.

Dos decisiones de producto que conviene confirmar antes de implementar:

1. **§2.3 — ¿Unirse a un privado?** Recomiendo **403** (cierre de seguridad inmediato) y tratar la solicitud pendiente como fase posterior. El admin nunca queda fuera porque `create_group` lo auto-une.
2. **§2.2 — `admin` de plataforma.** Recomiendo concederle acceso (coherente con el resto del producto) aunque no se use hoy.

Con esas dos confirmadas, F0.8 puede ejecutarse con **12 casos de prueba** y evidencia de no-regresión reaprovechando la suite actual.

---

*Fin del documento.*