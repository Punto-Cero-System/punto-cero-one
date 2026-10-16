# MASTER_IDENTITY_GOVERNANCE_PHASE07_REPORT

**Proyecto:** Punto Cero System OS
**Fase:** 0.7 · Activación Controlada de Identity Governance
**Estado:** índices **preparados pero NO activados**; `entity_id` sigue desconectado

---

## 1. Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/services/identity_audit.py` | `EXPECTED_INDEXES`, `validate_audit_config()`, `ensure_audit_indexes()` con nombre explícito, 8 emisores tipados, `EMITTERS` |
| `backend/routes/community_auth_routes.py` | +1 punto de auditoría (`profile.link_requested`) |
| `backend/tests/test_identity_audit.py` | +14 tests (índices, emisores, ausencia de endpoints) |

## 2. Archivos nuevos

| Archivo | Función |
|---|---|
| `backend/scripts/prepare_identity_audit_indexes.py` | **Única** vía de preparación. Modo lectura por defecto, `--apply` para escribir |

## 3. Archivos intactos (verificado por timestamp)

| Archivo | Regla |
|---|---|
| `backend/services/system_identity.py` | ⛔ No modificado |
| `backend/services/identity_core.py` | ⛔ No modificado |
| `backend/services/access_bridge.py` | ⛔ No modificado |
| `backend/server.py` | ⛔ No modificado — **sin autorización explícita** |
| `frontend/src/contexts/AuthContext.jsx` | 🔒 Congelado |
| `frontend/src/services/workspaceBridge.js` | 🔒 Congelado |
| `frontend/src/services/coreLegalAdapter.js` | 🔒 Congelado |
| `frontend/src/system/coreLegalContext.js` | 🔒 Congelado |

Legal y Medical: **no abiertos**.

## 4. Eventos activos (se emiten hoy)

| Evento | Punto de integración | `rule_applied` |
|---|---|---|
| `email_collision.detected` | `check_email_collision` | `H-1:email-no-es-clave-de-identidad` |
| `profile.link_rejected` | `_identity_unresolved` (×4 motivos) | `H-1:{reason}` |
| `profile.link_requested` | `_upsert_user_from_identity` (nuevo en 0.7) | `H-1:confirmacion-explicita` |
| `profile.linked` | `_upsert_user_from_identity` | `H-1:confirmacion-explicita` |
| `provider.attached` | `_upsert_user_from_identity` | `H-4:par-provider-provider_user_id` |

**5 de 8 eventos activos.** Traza E2E verificada: login nuevo → 0 eventos · mismo
proveedor → 0 eventos · colisión sin confirmar → 2 eventos · colisión
confirmada → 6 eventos.

## 5. Eventos pendientes (definidos, sin emisor en producción)

| Evento | Por qué está pendiente |
|---|---|
| `identity.created` | Solo `system_identity.create_system_identity()` puede emitirlo, y ese fichero está **prohibido** en esta fase |
| `identity.conflict.created` | Requiere dos `entity_id` enfrentados. La capa canónica está desconectada: no hay entidades que comparar |
| `provider.detached` | **Ningún flujo actual desenlaza proveedores.** `_touch_provider_link` solo añade |

Los 3 tienen emisor tipado, verificado por `TestEmisores`
(`set(EMITTERS) == set(EVENT_TYPES)`).

> Principio aplicado: **evento ≠ decisión**. No se emite un evento porque "debería
> haber Conflicts"; se emite cuando el hecho ocurre. Por eso los 3 pendientes
> no se "inventan".

## 6. Índices preparados (NO activados)

| Índice | Clave | Flags |
|---|---|---|
| `event_id` | `event_id: 1` | **UNIQUE** |
| `occurred_at` | `occurred_at: 1` | — |
| `type_and_time` | `event_type: 1, occurred_at: -1` | — |
| `entity_and_time` | `entity_id: 1, occurred_at: -1` | **sparse** |
| `source_and_time` | `source: 1, occurred_at: -1` | **sparse** |

**Ningún índice TTL.** Un TTL borraría eventos automáticamente y violaría la
regla append-only. `validate_audit_config()` falla con `ttl_prohibido:<name>` si
alguien lo añade.

**Los nombres se dan explícitamente.** Si se deja que Mongo los genere
(`event_id_1`, `event_type_1_occurred_at_-1`…), la validación por nombre deja de
encontrarlos. Es un fallo silencioso que los tests ahora cubren.

### Estado en producción

```
identity_events en punto_cero_local: False      ← NO creada
system_identities en punto_cero_local: False    ← capa canónica dormida
users: 4 documentos (sin cambios)
```

Preparación verificada sobre base temporal: 5 índices creados, `ok: True`,
**0 documentos**. Preparar índices no escribe eventos.


## 7. Riesgos

| # | Riesgo | Severidad | Mitigación actual |
|---|---|---|---|
| **R-1** | `evidence.email` en **texto plano**. Con acceso a Mongo, `identity_events` es un inventario de correos | 🔴 Alto | **Pendiente de decisión (§8)** |
| **R-2** | Sin control de acceso a nivel de colección: cualquier cliente Mongo lee la auditoría | 🔴 Alto | Abierta |
| **R-3** | `metadata` libre y sin restringir: cualquiera puede escribir PII o payloads grandes | 🟠 Medio | Sin validación de tamaño ni allowlist |
| **R-4** | Crecimiento ilimitado: sin archivado ni política de retención | 🟠 Medio | Sin TTL, por diseño |
| **R-5** | Sin endpoint de lectura: la auditoría solo se consulta por Mongo | 🟠 Medio | Correcto por diseño, pero no hay herramienta de soporte |
| **R-6** | `entity_id` siempre `null` hasta la FASE 0.8 | 🟡 Bajo | Campo e índices ya preparados |
| **R-7** | Si nadie ejecuta `validate_audit_config`, un TTL podría colarse sin detección | 🟡 Bajo | Cubierto por test |

## 8. Exposición de datos sensibles — recomendación (OBJETIVO 3)

**Análisis de lo que realmente llega hoy** (verificado sobre la traza E2E):

| Dato | ¿Se almacena? | Detalle |
|---|---|---|
| `evidence.email` | 🔴 **SÍ, texto plano** | 3 puntos: `email_collision.detected` (×2) y `profile.link_rejected` |
| `provider_user_id` | 🟢 **NO** | Solo el *nombre* del proveedor (`google`, `password`). El `sub` **no** se audita |
| `metadata` | ⚪ **Nunca usado** | Campo libre, sin restricción de tamaño ni allowlist |

Buena noticia: `provider_user_id` **no** se persiste. Es el dato más sensible
(identidad federada estable) y queda fuera.

### Las tres opciones

| | A) Texto plano | B) Masking | C) Hash parcial |
|---|---|---|---|
| **Qué** | email tal cual | `j***@e***.com` | `sha256(email)[:16]` |
| **Investigación de colisión** | ✅ total | 🟡 se ve el dominio | ❌ no se ve el dominio |
| **Correlación entre eventos** | ✅ trivial | 🟡 posible si el mask es estable | ✅ por hash |
| **Fuga si roban la BD** | 🔴 PII completa | 🟡 PII parcial | 🟢 sin PII |
| **Reversibilidad** | n/a | n/a | n/a |
| **Coste de cambio** | — | 🟢 bajo | 🟡 requiere migrar lo ya escrito |

### Recomendación: **B) Masking**, con C) como complemento opcional

1. **El email no es necesario para la investigación de fondo.** La colisión se
   investiga con `collision_type`, `email_verified`, `existing_providers`,
   `rule_applied` y `profile_reference`. El email identifica a la persona, no
   explica el conflicto.
2. **A) convierte la auditoría en un segundo `users`.** Duplicar PII en una capa
   *append-only* agrava R-2: lo que se añade hoy no se puede borrar mañana.
3. **C) rompe la operabilidad.** Un hash es irreversible; si hay que reconstruir
   un caso, no hay vuelta atrás, y en una auditoría eso es inaceptable.
4. **B) es operable**: el dominio y la inicial siguen visibles para triage.

**Regla propuesta si se aprueba B:**

```
juan.perez@empresa.com   →  j***@e***.com
admin@empresa.com        →  a***@e***.com
```

Estable por usuario (mismo prefijo y mismo dominio) para poder correlacionar
eventos, sin exponer el resto.

> **NO SE HA APLICADO NINGÚN CAMBIO AL MODELO.** `evidence` sigue en texto
> plano. Requiere aprobación explícita.

## 9. Qué queda bloqueado para la FASE 0.8

### Bloqueos duros (archivos prohibidos en 0.7)

| # | Bloqueo | Archivo que lo bloquea |
|---|---|---|
| **B-1** | Emitir `identity.created` | Requiere tocar `system_identity.py` |
| **B-2** | Emitir `identity.conflict.created` | Requiere `system_identity.py` conectado |
| **B-3** | Activar índices en el arranque | Requiere `server.py` (lifespan) |
| **B-4** | Conectar `entity_id` a sesiones/JWT | Requiere `identity_core.py` |

### Decisiones arquitectónicas pendientes — DETENIDO Y REPORTADO

Conforme a la instrucción de detenerse, **no se ha implementado** ninguna:

| # | Decisión | Por qué se ha parado |
|---|---|---|
| **D-1** | `entity_id` como `sub` de JWT | Cambia el emisor de identidad, rompe sesiones existentes y exige firma verificada. Contradice `D-12` del informe de gobernanza |
| **D-2** | Conectar `access_bridge` | Su auditoría sigue **en memoria** (H-5). Conectar antes de arreglarla pierde la trazabilidad de los intents |
| **D-3** | Modificar el login | Fuera de alcance. Además `confirm_link` sigue en `false` por defecto: el frontend congelado no lo envía |
| **D-4** | Eliminar `users.email` UNIQUE | H-7. Rompe `register_email`, `login_email` y `forgot_password` sin migración de duplicados |
| **D-5** | Migrar usuarios existentes | Requiere el Gate humano `M-1` y autorización de `--apply` |

## 10. Criterio de éxito

| # | Criterio | Estado |
|---|---|---|
| 1 | Auditoría tiene todos los eventos definidos | ✅ 8 tipos, 8 emisores |
| 2 | Índices preparados pero no activados | ✅ función aislada + script manual; colección no creada |
| 3 | Sin cambios en Identity Core | ✅ `identity_core.py` intacto |
| 4 | Sin integración con Legal/Medical | ✅ no abiertos |
| 5 | Sin migración de usuarios | ✅ `users` en 4 documentos |
| 6 | Tests verdes | ✅ **57 passed** (33 auditoría + 24 identidad) |
| 7 | Informe generado | ✅ este documento |
