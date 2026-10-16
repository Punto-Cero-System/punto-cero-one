# MASTER_IDENTITY_GOVERNANCE_PHASE08_REPORT

**Proyecto:** Punto Cero System OS
**Fase:** 0.8 · Identity Audit Privacy Hardening
**Estado:** `identity_events` sin correos completos · `entity_id` sigue desconectado

---

## 1. Cambios realizados

### `backend/services/identity_audit.py`

| Añadido | Función |
|---|---|
| `_EMAIL_RE` | Detección de correos (`local@dominio.tld`), 3 grupos capturados |
| `mask_email()` | `usuario@dominio.com` → `u*****@d*****.com` |
| `sanitize()` | Aplicación recursiva sobre dicts/listas/cadenas |
| `find_plain_emails()` | Verificación posterior: demuestra que no queda PII |
| `_PRIVACY_FIELDS` | Los 9 campos de texto por los que pasa el filtro |
| `_log_pii_leak()` | Avisa de fuga residual **sin volcar la PII al log** |

**Modificado:** `record_event()` ahora construye el documento, aplica el filtro a
los 9 campos, verifica que no sobreviva ningún correo plano y solo entonces
inserta.

### `backend/routes/community_auth_routes.py`

`_record_identity_event()` ahora enmascara con `sanitize()`. Motivo en §2.

### `backend/tests/test_identity_audit.py`

+16 tests (33 → 49).

### Sin tocar

`system_identity.py` · `identity_core.py` · `access_bridge.py` · `server.py` ·
`AuthContext.jsx` · `workspaceBridge.js` · `coreLegalAdapter.js` ·
`coreLegalContext.js` — **verificado por timestamp**.

Sin migraciones, sin endpoints, sin cambios JWT, sin cambios de login, sin
conexión Legal/Medical.

---

## 2. Decisiones de diseño

### El filtro va en `record_event`, no en cada emisor

Es el **único** punto de entrada a la colección. Un filtro aplicado emisor por
emisor depende de que los ocho se acuerden, y uno se acabará olvidando. Con el
filtro en el choke point la garantía es estructural: no existe forma de escribir
en `identity_events` saltándoselo.

### Enmascarar, no rechazar

`record_event` **no lanza excepción** al detectar un correo. Si lo hiciera, el
evento se perdería: `_audit()` en las rutas es *fail-open* y solo dejaría un
warning. **Una auditoría que pierde el registro de un intento de suplantación es
peor que una que guarda el correo enmascarado.**

El requisito "nunca almacenar email completo" se cumple por enmascarado total y
automático. El test `test_email_plano_rechazado_para_almacenarse` documenta esta
interpretación: "rechazado" = nunca llega intacto a la base.

### Segunda fuga: el log de aplicación

La prueba E2E destapó que `_record_identity_event()` (buffer en memoria de
FASE 0.5) escribía el correo **completo** en el log:

```
identity_event email_collision {'email': 'a@x.com', ...}
```

El log suele ser **más accesible que la base** (CI, agregadores, copias de
seguridad). Dejarlo habría sido cerrar la puerta y dejar la ventana abierta.
`community_auth_routes.py` no estaba en la lista de prohibidos, así que se
enmascaró también. Verificado: cero correos planos en log ni en base.

### Por qué el valor enmascarado no vuelve a casar con la regex

`u*****@d*****.com` **no** cumple `_EMAIL_RE`, porque `*` no está en la clase de
caracteres del local. Eso convierte `find_plain_emails()` en un verificador real:
distingue "enmascarado" de "no detectado" en lugar de ser un `if` vacío.
Cubierto por `test_enmascarado_no_se_redetecta`.

---

## 3. Eventos afectados

Los 8 emisores están protegidos por construcción. Verificado emitter por emitter
en `test_todos_los_emisores_enmascaran`.

| Evento | Estado | Contenido de `evidence` |
|---|---|---|
| `email_collision.detected` | 🟢 | `email`, `incoming_provider`, `existing_providers` |
| `profile.link_rejected` | 🟢 | `email`, `provider` |
| `profile.link_requested` | 🟢 | sin email (solo `collision_type`) |
| `profile.linked` | 🟢 | sin email (solo `collision_type`) |
| `provider.attached` | 🟢 | sin email (solo `provider`) |
| `identity.created` | 🟢 | emisor definido, sin punto de integración |
| `identity.conflict.created` | 🟢 | emisor definido, sin punto de integración |
| `provider.detached` | 🟢 | emisor definido, sin punto de integración |

### Información preservada (requisito de OBJETIVO 1)

| Se conserva | Ejemplo tras enmascarar |
|---|---|
| Dominio (parcial) | `j*****@e*****.com` |
| TLD | `.com` |
| Estado de verificación | `email_verified: true` (bool intacto) |
| Tipo de colisión | `collision_type: "password_account"` |
| Proveedor | `incoming_provider: "google"` |
| Regla aplicada | `rule_applied: "H-1:email-no-es-clave-de-identidad"` |

Los no-cadena (`bool`, `int`, `None`, listas) pasan **intactos**. Enmascarar un
booleano produciría `'Tr*****'`: eso es un bug, no privacy. Cubierto por

---

## 4. Pruebas

| Suite | Antes | Ahora | Resultado |
|---|---|---|---|
| `test_identity_audit.py` | 33 | **49** | ✅ passed |
| `test_system_identity.py` | 24 | 24 | ✅ passed |
| **Total, serie y paralelo** | 57 | **73** | ✅ passed |
| Regresión FASE 0.5 (H-1/H-2/H-4) | 8/8 | 8/8 | ✅ |

Tests añadidos (16):

| Grupo | Nº | Cobertura |
|---|---|---|
| `TestMasking` | 8 | formato exacto, iniciales, mínimo, subcadena, no-cadenas, no-redetección, recursión, no-degradación de tipos |
| `TestEmisoresSinPII` | 3 | los 8 emisores, evento real de colisión, campos de texto |
| `TestInvariantesPrivacidad` | 5 | email plano rechazado, append-only, 12 campos, colección completa |

**Traza E2E real** (login completo contra Mongo):

```
email_collision.detected  evidence={'email': 'a*****@x*****.com', 'email_verified': True,
                                     'collision_type': 'same_provider_link', ...}
profile.link_rejected     evidence={'email': 'a*****@x*****.com', 'provider': 'google'}
profile.link_requested    evidence={'collision_type': 'same_provider_link', 'confirmed_by_user': True}
profile.linked            evidence={'collision_type': ..., 'email_verified': True, ...}
provider.attached         evidence={'provider': 'google'}
```

> **Nota sobre "12 campos":** el documento almacenado tiene 13 porque Mongo añade
> `_id`. El contrato de la aplicación son 12. El test lo asserta explícitamente
> en lugar de relajar la comprobación.

---

## 5. Riesgos cerrados

| # | Riesgo | Estado |
|---|---|---|
| **R-1** | `evidence.email` en texto plano dentro de `identity_events` | ✅ **CERRADO** — enmascarado en el choke point |
| **R-3** | PII en campos derivados (`actor`, `source`, `profile_reference`, `rule_applied`, `related_ids`, `request_id`) | ✅ **CERRADO** — los 9 campos pasan el filtro |
| **R-8** *(nuevo)* | Correo completo en el log de aplicación y en el buffer en memoria | ✅ **CERRADO** — detectado por E2E |
| **R-9** *(nuevo)* | Un emisor futuro podría saltarse el filtro | ✅ **CERRADO** — no existe otro camino de escritura |

---

## 6. Riesgos pendientes

| # | Riesgo | Severidad |
|---|---|---|
| **R-2** | Sin control de acceso a nivel de colección: cualquier cliente Mongo lee la auditoría | 🔴 Alto |
| **R-4** | Crecimiento ilimitado: sin archivado ni política de retención | 🟠 Medio |
| **R-5** | Sin endpoint de lectura: la auditoría solo se consulta por Mongo | 🟠 Medio |
| **R-10** *(nuevo)* | `metadata` sigue libre: admite cualquier contenido, incluido un payload grande | 🟠 Medio |
| **R-11** *(nuevo)* | `provider_user_id` no se audita (bien), pero impide correlacionar un `sub` federado concreto | 🟡 Bajo |
| **R-12** *(nuevo)* | La regex no cubre IDN unicode, comillas ni `mailto:` | 🟡 Bajo |
| **R-13** *(nuevo)* | Los eventos ya escritos en otro entorno no se re-maskean | 🟡 Bajo |

> **R-12:** la regex cubre `[a-z0-9._%+\-]+@[dominio].[tld{2,}]`. Riesgo bajo
> porque un email no llega en esos formatos vía OAuth, pero conviene saberlo.
>
> **R-13:** no afecta a este entorno (la colección no existe), pero en uno que ya
> tenga eventos, el enmascarado **no** corrige el histórico. Habría que migrarlo,
> lo que contradice el principio append-only y requeriría su propia fase.

---

## 7. Decisiones bloqueadas

Sin cambios respecto a FASE 0.7. **No implementadas:**

| # | Decisión | Bloqueo |
|---|---|---|
| **D-1** | `entity_id` como `sub` de JWT | Contradice `D-12` del informe de gobernanza |
| **D-2** | Conectar `access_bridge` | Su auditoría sigue en memoria (H-5) |
| **D-3** | Modificar el login | `confirm_link` sigue en `false`; frontend congelado |
| **D-4** | Eliminar `users.email` UNIQUE | H-7. Rompe `register_email` / `login_email` / `forgot_password` |
| **D-5** | Migrar usuarios | Requiere Gate humano `M-1` |
| **D-6** | Activar índices en el lifespan | Requiere `server.py` |
| **D-7** | Emitir `identity.created` / `identity.conflict.created` | Requiere `system_identity.py` |

---

## 8. Criterio de éxito

| # | Criterio | Estado |
|---|---|---|
| 1 | `identity_events` sin correos completos | ✅ enmascarado en el punto único de escritura, verificado con `find_plain_emails()` |
| 2 | Tests verdes | ✅ **73 passed** |
| 3 | Identidad desconectada | ✅ `system_identities` no existe; `identity_events` tampoco |
| 4 | Login sin cambios | ✅ sin cambios de flujo; el 409 sigue siendo 409 |
| 5 | Legal/Medical intactos | ✅ no abiertos |

`test_sanitize_no_degrada_no_cadenas`.
