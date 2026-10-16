# MASTER_IDENTITY_AUDIT_ACCESS_POLICY

**Proyecto:** Punto Cero System OS
**Fase:** 0.9 · Identity Audit Access Governance
**Objeto:** `identity_events` (colección de auditoría de identidad)
**Estado:** política **documentada y aplicada en escritura**. Sin endpoint de lectura.

---

## 1. Principio rector

`identity_events` es **append-only**: no se corrige, no se borra, no se reescribe.

Consecuencia directa y no negociable:

> **La higiene en el momento de la escritura es la ÚNICA defensa disponible.**
> Lo que se acepta hoy queda para siempre. Por eso el control está en
> `record_event()` —el único punto de entrada— y no en quien consulta.

Esta fase aplica control en **escritura**. El control en **lectura** (§4) está
diseñado y documentado, pero **no implementado**: hacerlo exigiría un endpoint,
que esta fase prohíbe explícitamente.

---

## 2. Controles aplicados en escritura (FASE 0.9)

| Control | Constante | Efecto |
|---|---|---|
| Allowlist de `metadata` | `ALLOWED_METADATA_KEYS` (10 claves) | Lo no permitido se descarta y se avisa |
| Claves prohibidas | `FORBIDDEN_KEYS` (21 claves) | Secretos eliminados a cualquier profundidad |
| Tamaño de cadena | `MAX_STRING_LENGTH` = 512 | Truncado + `…[truncated]` |
| Elementos de lista | `MAX_LIST_ITEMS` = 50 | Truncado + marca |
| Claves de dict | `MAX_DICT_KEYS` = 40 | Truncado + `_truncated_keys` |
| Profundidad | `MAX_NESTING_DEPTH` = 5 | Truncado + marca |
| Tamaño de documento | `MAX_DOCUMENT_BYTES` = 16 KB | **Rechazo** (`EventTooLargeError`) |

### Orden del tubo

```
limpiar claves → filtrar metadata → enmascarar PII → acotar → medir → verificar → insertar
```

Enmascarar **antes** de acotar evita que un correo gigante sobreviva a la
truncatura. Medir **al final** decide sobre el documento definitivo.

### Normalizar, no rechazar

| Situación | Decisión | Motivo |
|---|---|---|
| Clave prohibida | **Eliminar** + avisar | Perder el evento de un intento de suplantación es peor que guardarlo sin ese campo |
| Clave fuera de allowlist | **Eliminar** + avisar | Igual |
| Valor demasiado largo | **Truncar** + marcar | Un registro recortado es más útil que un hueco |
| Documento patológico | **Rechazar** | Tras truncar, es inalcanzable en la práctica |

> El aviso registra **qué** se descartó y **por qué**, nunca el valor: en el caso
> de `password_hash`, el valor es justamente el secreto que se elimina.

### Campos prohibidos (21)

`password` · `password_hash` · `passwd` · `secret` · `token` · `access_token` ·
`refresh_token` · `session_token` · `bearer` · `authorization` · `auth` ·
`api_key` · `apikey` · `private_key` · `credential` · `credentials` · `cookie` ·
`cookies` · `otp` · `mfa_secret` · `provider_user_id` · `sub`

Los dos últimos merecen nota: son **identidad federada estable**, el dato más
sensible que existe. No se audita (R-11).

### Allowlist de `metadata` (10)

`environment` · `client` · `client_version` · `app_version` · `correlation_id` ·
`duration_ms` · `server_region` · `trace_id` · `ip` · `user_agent`

Verificado: **cero intersección** con `FORBIDDEN_KEYS`.

> `ip` y `user_agent` son PII adyacente y **no** están enmascarados (el filtro de
> FASE 0.8 solo cubre correos). Ver R-14.

---

## 3. Quién puede escribir

| Actor | Puede escribir | Condición |
|---|---|---|
| `record_event()` / emisores tipados | ✅ | Único camino. Todo pasa por el tubo |
| `community_auth_routes._audit()` | ✅ | *fail-open*: un fallo de auditoría no tumba el login |
| `_record_identity_event()` (log) | ✅ | Ahora también enmascara |
| Cualquier endpoint HTTP | ❌ | No existe ninguno |

---

## 4. Quién puede leer — POLÍTICA (no implementada)

### 4.1 Niveles de acceso

| Nivel | Rol | Puede leer | No puede |
|---|---|---|---|
| **L0 · Ninguno** | Vertical, frontend, usuario final | — | Cualquier cosa |
| **L1 · Agregado** | Analítica de producto | Recuentos por `event_type` y rango de fechas | Eventos individuales, `evidence` |
| **L2 · Operativo** | Soporte / fiabilidad | Eventos de una cuenta concreta, en ventana reciente | Exportación masiva, otros entornos |
| **L3 · Seguridad** | Seguridad / RRII | Todos los eventos, `evidence` enmascarado incluido | Escribir, modificar o borrar |
| **L4 · Datos** | Responsable de tratamiento | Acceso break-glass, justificado y auditado | Uso rutinario |

### 4.2 Quién NO puede leer

| Actor | Motivo |
|---|---|
| **Cualquier vertical** (One, Legal, Medical) | La identidad pertenece a System. Una vertical que lee la auditoría conoce la actividad de identidad de **todas** las verticales. Rompe la separación de §4.3 |
| **El usuario final** | Podría enumerar los cambios de identidad de su cuenta y, por colisión, de otras |
| **El frontend** | No hay endpoint; el token del navegador no debe tener alcance de auditoría |
| **Cualquiera con solo lectura en Mongo** | ⚠️ **Riesgo R-2, el punto ciego real.** Mongo no tiene control de acceso por colección: quien tiene la cadena de conexión, lee. Ver §6 |

### 4.3 Separación System vs Verticales

```
        System Identity Layer     ← ÚNICA recolectora y ÚNICA lectora
                 │
      ┌──────────┼──────────┐
      │          │          │
    One       Legal     Medical
   L0: sin acceso a identity_events
```

**Regla:** las verticales reciben **hechos de identidad mediante el contrato de
`entity_id`**, nunca la auditoría. Una vertical que necesite saber cómo se
enlazó una identidad lo pide a System por un contrato de lectura, no leyendo la
colección.

Esta separación se sostiene hoy por la **ausencia de interfaz**, no por
autorización. Añadir un endpoint de lectura la rompería salvo que lleve control
de acceso propio: por eso §4 queda como diseño, no como implementación.

### 4.4 Auditoría de lecturas futuras

Cuando exista un endpoint de lectura, **toda lectura debe dejar rastro**:

| Regla | Detalle |
|---|---|
| RA-1 | Toda lectura se registra en `identity_audit_reads` (colección **nueva**, separada) |
| RA-2 | **Nunca** dentro de `identity_events`: auditar la lectura en la colección que se lee es recursivo y genera contención |
| RA-3 | Se registra: actor, nivel (L1-L4), filtros usados, `count` devuelto, `request_id`, `occurred_at` |
| RA-4 | Lecturas masivas exigen L3 y generan alerta |
| RA-5 | Acceso L4 (break-glass) exige justificación escrita y se reporta a RRII |
| RA-6 | El registro de lecturas es append-only, igual que el de eventos |

---

## 5. Crecimiento — PROPUESTA (nada implementado)

### 5.1 Realidad de volumen

Los eventos se emiten **solo ante excepción**: colisión de email, enlace
rechazado, enlace confirmado, provider agregado. Un login normal **no genera
ningún evento**.

| Escenario | Eventos/día estimado |
|---|---|
| Base actual (4 usuarios) | < 10 |
| 10k usuarios activos | ~100-500 |
| Incidente de suplantación | Pico de miles en minutos |

**Conclusión: el crecimiento es marginal.** Un evento ocupa ~1 KB. Un año a 500
eventos/día son ~180 MB. **El archivado no es una urgencia hoy**; sí lo sería
tras un incidente o al conectar las verticales.

### 5.2 Retención

| Opción | Evaluación |
|---|---|
| **Sin TTL (actual)** | ✅ Correcto. TTL contradice el principio append-only |
| TTL a 90 días o 1 año | ❌ **Prohibido**: borraría evidencia de incidentes |
| Archivado manual a 1 año | 🟡 Aceptable, requiere decisión explícita |

> **Regla:** la retención la decide RRII, no ingeniería, y **exige copia
> verificada antes de eliminar**. La capa no implementará borrado automático.

### 5.3 Almacenamiento frío

| Periodo | Ubicación | Acceso |
|---|---|---|
| 0-90 días | MongoDB caliente, con índices | Completo |
| 90 días-1 año | Misma base, sin índice de `occurred_at` | L3+ |
| > 1 año | Export a almacenamiento de objetos (NDJSON gzip) | L4, break-glass |

Exportación: **NDJSON + gzip**, un fichero por mes, con checksum SHA-256
verificado al escribir y al leer.

### 5.4 Particionamiento

| Opción | Evaluación |
|---|---|
| Colección por mes | 🟡 Rompe el índice único de `event_id` y complica `list_events` |
| Colección por año | 🟢 Más simple;innecesario a este volumen |
| Índices compuestos actuales | ✅ Suficientes hasta ~1M eventos |

**Recomendación: no particionar.** A 500 eventos/día, una colección responde en
milisegundos sin índices adicionales.

### 5.5 Exportación

| Destino | Cuándo | Contenido |
|---|---|---|
| NDJSON mensual | Mensual, automático | Eventos del mes, ya enmascarados |
| Export forense | A demanda, L4 | Rango acotado, justificado |

**Nunca** exportar en CSV abierto: `evidence` es JSON con estructura variable y
el CSV la destruye.


---

## 6. Riesgos

| # | Riesgo | Severidad | Estado |
|---|---|---|---|
| **R-2** | Sin control de acceso a colección: cualquier cliente Mongo lee la auditoría | 🔴 Alto | **ABIERTO.** Requiere proxy de autenticación o credenciales propias para la colección |
| **R-4** | Crecimiento sin archivado | 🟢 Bajo | **Mitigado por §5**: el volumen real es marginal |
| **R-5** | Sin endpoint de lectura | 🟠 Medio | **Por diseño**; §4 define cómo hacerlo bien cuando se autorice |
| **R-10** | `metadata` libre | ✅ **CERRADO** | Allowlist de 10 claves (FASE 0.9) |
| **R-14** *(nuevo)* | `ip` y `user_agent` en metadata no están enmascarados | 🟠 Medio | PII adyacente; el filtro de FASE 0.8 solo cubre correos |
| **R-15** *(nuevo)* | Un evento truncado puede parecer completo | 🟠 Medio | Mitigado con `…[truncated]` y `_truncated_keys`, pero un consumidor podría ignorarlos |
| **R-16** *(nuevo)* | `FORBIDDEN_KEYS` actúa por nombre de clave: un secreto con otro nombre pasa | 🟡 Bajo | Se acepta: el caso real es el accidente, no el atacante con acceso al código |

---

## 7. Decisiones bloqueadas

No implementadas, sin cambios respecto a fases anteriores:

| # | Decisión | Bloqueo |
|---|---|---|
| **D-1** | `entity_id` como `sub` de JWT | Contradice `D-12` del informe de gobernanza |
| **D-2** | Conectar `access_bridge` | Su auditoría sigue en memoria (H-5) |
| **D-3** | Modificar el login | `confirm_link` en `false`; frontend congelado |
| **D-4** | Eliminar `users.email` UNIQUE | H-7. Rompe `register_email` / `login_email` / `forgot_password` |
| **D-5** | Migrar usuarios | Requiere Gate humano `M-1` |
| **D-6** | Activar índices en el lifespan | Requiere `server.py` |
| **D-7** | Emitir `identity.created` / `identity.conflict.created` | Requiere `system_identity.py` |
| **D-8** | Endpoint de lectura de la auditoría | Esta fase lo prohíbe. §4 define cómo hacerlo bien cuando se autorice |
| **D-9** | Control de acceso por colección | Requiere proxy de autenticación: decisión de infraestructura |

---

## 8. Criterio de éxito

| # | Criterio | Estado |
|---|---|---|
| 1 | Política documentada | ✅ este documento |
| 2 | Sin endpoints | ✅ ninguno creado; `TestSinEndpointsPublicos` lo verifica |
| 3 | Sin cambios de identidad | ✅ `system_identity.py` y `identity_core.py` intactos |
| 4 | Sin cambios de login | ✅ solo el auditado; el 409 sigue siendo 409 |
| 5 | Legal/Medical intactos | ✅ no abiertos |
| 6 | Tests verdes | ✅ **92 passed** (68 auditoría + 24 identidad) |

| Script manual | ⚠️ | Solo `prepare_identity_audit_indexes`, que solo crea índices |
