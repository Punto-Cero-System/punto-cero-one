# MASTER_IDENTITY_HARDENING_CHANGELOG

**Proyecto:** Punto Cero System — Punto Cero One
**Fase:** 0.5 · Identity Governance Hardening
**Alcance:** capa de autenticación existente (`backend/routes/community_auth_routes.py`)
**Base de datos:** NO modificada. No se ejecutó ninguna migración.

---

## Regla rectora de esta fase

```
EMAIL MATCH ≠ IDENTITY MATCH
```

El email deja de ser clave de identidad. Pasa a ser **atributo verificable** y,
como mucho, **señal de colisión que requiere clasificación explícita**.

---

## H-1 — Fusión automática por email

**Estado anterior:** 🔴 ACTIVO — crítico
**Estado actual:** ✅ CERRADO

### Hallazgo
`_upsert_user_from_identity` buscaba por email y, si encontraba coincidencia,
**fusionaba automáticamente** la identidad:

```python
existing = await db.users.find_one({"email": identity.email}, {"_id": 0})
# ...
# merge
providers = existing.get("auth_providers") or []
if not any(p.get("provider") == identity.provider for p in providers):
    providers.append(link)
await db.users.update_one({"id": existing["id"]}, {"$set": update})
```

Consecuencia: un atacante que controle un correo de un proveedor OAuth sin
verificación de correo se fusionaba con la identidad real de la víctima.
**Un email igual se traducía en "misma persona" sin ninguna evidencia.**

### Archivo afectado
`backend/routes/community_auth_routes.py`

### Cambio realizado

| Punto | Antes | Después |
|---|---|---|
| Clave de búsqueda primaria | `email` | `(provider, provider_user_id)` vía `$elemMatch` |
| Email | decisión de identidad | **Solo detección** de colisión |
| Fusión silenciosa | Sí | **Eliminada** |
| Función nueva | — | `check_email_collision()` — detecta y clasifica, **nunca decide** |
| Respuesta ante colisión no confirmada | (no existía) | **HTTP 409 `identity_unresolved`** |
| Confirmación explícita | (no existía) | `SessionExchangeInput.confirm_link` (bool, default `False`) |

### Condiciones para enlazar (las TRES, obligatorias)

Ante colisión de email, el enlace solo procede si:

1. `email_verified == true` en la cuenta existente
2. El provider es **federado** y trae `provider_user_id` real (un `sub`, no un email)
3. El usuario confirma explícitamente (`confirm_link: true`)

Si falta cualquiera de las tres → `409 identity_unresolved`, con `reason` estable:
`email_no_verificado_en_cuenta_existente` · `provider_sin_identidad_externa_real` ·
`falta_confirmacion_explicita` · `cuenta_existente_desaparecio`.

### Clasificación de colisión
`same_provider_link` (no es colisión) · `password_account` · `other_provider`

### Riesgo eliminado
Suplantación de cuenta vía colisión de email. La fusión pasa de ser implícita e
invisible a exigir tres pruebas explícitas.

### Compatibilidad futura con `system_identity`
La Fase 0.6 heredará datos ya libres de fusiones silenciosas por email. `users`
seguirá siendo la fuente de perfiles, pero **nunca emitirá una decisión de
identidad**. El único camino de emisión sigue siendo
`create_system_identity(source, external_id)`.

---

## H-2 — `provider_user_id` contenía el email

**Estado anterior:** 🔴 ACTIVO — crítico
**Estado actual:** ✅ CERRADO

### Hallazgo
Las cuentas de password guardaban el email en `provider_user_id`:

```python
"auth_providers": [{
    "provider": "password",
    "provider_user_id": email,   # ← email como identidad del proveedor
    "linked_at": now,
}],
```

El campo representa la identidad **en el proveedor**. Un email no lo es.
Además, como el email es mutable, un cambio de email desvinculaba el perfil en
silencio, y "mismo email" quedaba indistinguible de "mismo subject del
proveedor", anulando la prueba de posesión.

### Archivo afectado
`backend/routes/community_auth_routes.py`

### Cambio realizado
`_new_password_credential_id()` → `pwd_<uuid4hex>` y
`_password_credential_id(user)`, que **reutiliza el id existente si ya es válido**
y migra los registros heredados (cuyo `provider_user_id` es un email) en el mismo
`$set` que ya se ejecutaba en login. No requiere migración de datos.

| Punto | Antes | Después |
|---|---|---|
| Alta con password | `provider_user_id: email` | `provider_user_id: pwd_<uuid4hex>` |
| Login | `_touch_provider_link(user, "password", email)` | `_password_credential_id(user)` |
| Enlace password↔social | `..., email)` | `_password_credential_id(existing)` |
| Reset de contraseña | `..., user["email"])` | `_password_credential_id(user)` |
| **OAuth Google** | `sub` real | **Sin cambios** — ya cumplía |

### Riesgo eliminado
Contaminación del campo de identidad del proveedor con un dato mutable y no
autoritativo. La prueba de posesión vuelve a tener valor semántico.

### Compatibilidad futura con `system_identity`
`provider_user_id` pasa a ser fiable y **copiable** como evidencia en
`providers[]`. En Fase 0.4 se marcó este campo como **nunca copiable en v1**
precisamente por este defecto; con H-2 cerrado, la v2 puede habilitar esa copia.

---

## H-4 — Comparación incompleta de proveedores

**Estado anterior:** 🟡 Riesgo medio — suplantación
**Estado actual:** ✅ CERRADO

### Hallazgo
```python
if not any(p.get("provider") == provider for p in providers):
```
Solo comparaba el **nombre** del proveedor. `google+123456` y `google+987654`
eran indistinguibles, de modo que la **segunda cuenta de Google se descartaba en
silencio**: el usuario entraba en la cuenta de otra persona sin aviso.


---

## H-7 — `users.email` con índice UNIQUE

**Estado:** ⏸️ **DEFERIDO** a propósito. No se ha tocado Mongo.

### Reporte técnico

```
índice: email_1 | unique: True | key: [('email', 1)]
```

**Por qué no se elimina en esta fase:** el índice es la **columna vertebral** del
esquema actual. `register_email` (409 "Ya existe una cuenta con este email"),
`login_email`, `forgot_password` y el reseteo dependen de que el email sea único.
Retirarlo sin una fase de migración de duplicados rompería producción.

**Por qué H-1 no podía cerrarse solo:** con `email` UNIQUE, si una colisión
intentara crear una segunda fila, Mongo devuelve `E11000 DuplicateKeyError` y el
login respondería **500**. Por eso H-1 se cerró **cambiando la clave de búsqueda**
en lugar de eliminar la consulta por email.

**Contradicción documentada:** mientras `users.email` sea UNIQUE, el modelo sigue
siendo email-centric **por esquema**, aunque el código ya no tome decisiones de
identidad por email. Esto contradice el principio `P-3` del
MASTER_IDENTITY_GOVERNANCE_REPORT y queda registrado como deuda.

### Recomendación futura (Fase 0.6+, no ejecutada)

1. Inventario de duplicados reales por email.
2. Migrarlos a `system_identities` separados, **sin unir por email**.
3. Sustituir el UNIQUE por un índice compuesto `(email, verification.verified)`
   — es decir, único solo entre verificados.
4. Convertir el 409 de `register_email` en un flujo de vinculación.
5. **Nunca** deduplicar automáticamente: producir `CONFLICT_REVIEW`.

---

## Auditoría de eventos (diseño, no implementado)

**El objetivo 5 pedía NO crear la colección definitiva.** Lo añadido es un buffer
**en memoria y acotado** (`MAX_IDENTITY_EVENTS = 200`) más logging estructurado:

```python
_identity_events: list[dict] = []
def _record_identity_event(kind: str, payload: dict) -> None: ...
```

Eventos emitidos: `email_collision` · `identity_unresolved` ·
`credential_linked_with_confirmation`.

**Deuda conocida:** el buffer se pierde al reiniciar el proceso. Es el mismo
patrón de déficit que `H-5` en `access_bridge.py` (eventos en memoria). La
Fase 0.6 debe sustituirlo por una colección **append-only, persistente y sin
endpoint de borrado**.

---

## Resumen de cambios

| # | Hallazgo | Archivo | Líneas | Riesgo eliminado |
|---|---|---|---|---|
| H-1 | Fusión automática por email | `community_auth_routes.py` | 47-61, 133-204, 264-368, 470-474 | Suplantación de cuenta |
| H-2 | `provider_user_id` = email | `community_auth_routes.py` | 174-188, 647-649, 673-679, 745-747, 819-821 | Anulación de prueba de posesión |
| H-4 | Comparación solo por `provider` | `community_auth_routes.py` | 603-626 | Suplantación por enlace descartado |
| H-7 | `users.email` UNIQUE | — | — | ⏸️ diferido, documentado |

**Archivos modificados:** 1
**Archivos nuevos de código:** 0
**Endpoints nuevos:** 0
**Migraciones ejecutadas:** 0
**Operaciones sobre Mongo de producción:** 0
**Capas no tocadas:** `system_identity.py` · `identity_core.py` · `access_bridge.py` · Legal · Medical

### Cambio realizado
`_touch_provider_link` compara ahora el **par** `(provider, provider_user_id)`:

```python
if not any(
    p.get("provider") == provider
    and p.get("provider_user_id") == provider_user_id
    for p in providers
):
```

Además `providers = list(...)` deja de mutar el documento recibido in-place.

### Riesgo eliminado
Suplantación por enlace de proveedor silenciosamente descartado.

### Compatibilidad futura con `system_identity`
Un perfil puede llevar **N** enlaces federados distintos y todos son legibles.
`providers[]` de `SystemIdentity` tendrá información fiable.
