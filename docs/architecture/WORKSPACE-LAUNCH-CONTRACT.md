# WORKSPACE LAUNCH CONTRACT

**Contrato conceptual que separa cuatro ejes que hoy se confunden en el frontend.**
Este documento conserva las reglas de lifecycle, availability y launchability.
LaunchMode se resolvió en D2.2-D; su contrato vigente es
[`WORKSPACE-LAUNCHMODE-CONTRACT.md`](./WORKSPACE-LAUNCHMODE-CONTRACT.md).

| | |
|---|---|
| **Estado** | Vigente · reglas de lifecycle y availability |
| **Ámbito** | 4 ejes: Lifecycle · Availability · Launchability · LaunchMode |
| **Runtime** | LaunchMode vigente en el contrato D2.2-D separado. |
| **Test que lo hace ejecutable** | `backend/tests/test_workspace_launch_contract.py` · `frontend/src/system/tests/workspaceLaunchContract.test.js` |

> **Regla de lectura.** Lifecycle y availability conservan sus reglas. LaunchMode ya no está pendiente: el Registry frontend es su fuente declarativa y el nuevo contrato especifica su validación. External continúa pendiente.

---

## 1. Los cuatro ejes

Son **cuatro preguntas distintas** que hasta D2.2-C.3 respondía el mismo `status`. Confundirlas es la causa de raíz de la deuda que este contrato congela.

```
                     ┌──────────────────────────────────────────┐
   status (dato) ───►│  A · LIFECYCLE                            │
   del Registry      │    ¿en qué estado está el workspace?       │
                     └───────────────┬──────────────────────────┘
                                     │  deriveAvailability()
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  B · AVAILABILITY   [DERIVACIÓN]          │
                     │    ¿está abierto?  open | closed           │
                     └───────────────┬──────────────────────────┘
                                     │  (frontera separada, NO derivada)
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  C · LAUNCHABILITY                        │
                     │    ¿puede lanzarse públicamente ahora?     │
                     └───────────────┬──────────────────────────┘
                                     │  + D · LAUNCHMODE
                                     ▼
                     ┌──────────────────────────────────────────┐
                     │  D · LAUNCHMODE      [RESUELTO D2.2-D]    │
                     │    ¿bajo qué modo se abre?                │
                     └──────────────────────────────────────────┘
```

---

## 2. Eje A — LIFECYCLE

**Autoridad única: `backend/services/workspace_registry.py` → `WORKSPACE_REGISTRY[].status`**

```
live · preview · declared · deprecated
```

**Reglas:**

- **No duplicar.** El vocabulario vive en el Registry y en su proyección.
- El frontend **consume la proyección**; no redeclara el conjunto.
- `available` / `coming_soon` / `external` **NO son lifecycle**. Son vocabulario de navegación (eje D4).

**Implementación actual:** `workspaceCatalog.js` → `WORKSPACE_STATUSES` + `deriveAvailability()`. Ya consolidado en D2.2-C.2 (una sola implementación de la frontera).

---

## 3. Eje B — AVAILABILITY (derivación)

**No es un dato. Es una función del lifecycle.**

```js
isWorkspaceStatusOpen(status)   // workspaceCatalog.js — autoridad funcional
```

| Lifecycle | Availability |
|---|---|
| `live` | `open` |
| `preview` | `open` |
| `declared` | `closed` |
| `deprecated` | `closed` |
| ausente / desconocido | `closed` *(fail-closed)* |

**Reglas:**

- **Ningún catálogo debe almacenar `availability` como campo.** Se calcula.
- `available` / `coming_soon` quedan **solo como presentación** de la navegación (`workspaceSpaces.js`), nunca como status.
- La frontera **coincide** con el paso 6 de `policy_can.can()`: `declared`/`deprecated` exigen `allow_non_live`. Esa coincidencia es deliberada y la verifica el contrato backend.

---

## 4. Eje C — LAUNCHABILITY (frontera independiente)

> Esta comprobación local se mantiene independiente; la decisión D2.2-D de
> LaunchMode no modifica esta regla.

```js
isLaunchable(space)   // sessionManager.js
  = space.entry_url && space.permission && space.status === 'live'
```

| Lifecycle | Availability | Launchable | Nota |
|---|---|---|---|
| `live` | open | ✅ sí | |
| `preview` | open | ❌ **no** | 🔴 **frontera distinta** |
| `declared` | closed | ❌ no | |
| `deprecated` | closed | ❌ no | |
| ausente | closed | ❌ no | |

### La divergencia documentada

`preview` está **abierto** por lifecycle, pero `sessionManager.isLaunchable`
no permite su lanzamiento público/externo porque requiere `status === 'live'`.
Esto no impide que `workspaceActivation` active un preview en modo `controlled`;
son contratos distintos.

La regla live-only de lanzamiento público se conserva en esta fase y no equivale
a la regla de lifecycle ni a la selección de LaunchMode.

---

## 5. Eje D — LAUNCHMODE

LaunchMode tiene una única autoridad declarativa: el Registry frontend.
`workspaceOrchestrator.js` consume el valor declarado y no lo deriva desde
status. `workspaceActivation.js` valida la combinación con lifecycle. Los
valores soportados y la matriz completa están en
[`WORKSPACE-LAUNCHMODE-CONTRACT.md`](./WORKSPACE-LAUNCHMODE-CONTRACT.md).

---

## 6. Matriz de responsabilidades

| Concepto | Autoridad | Consumidores | Estado |
|---|---|---|---|
| **Lifecycle** | Backend Registry (`WORKSPACE_REGISTRY[].status`) | Backend + Frontend | 🟢 Cerrado |
| **Availability** | Derivación (`isWorkspaceStatusOpen`) | Selector + catálogo | 🟢 Cerrado (C.2) |
| **Permission** | Backend Policy (`policy_can`) | Access Bridge | 🟢 Cerrado |
| **Launchability** | `isLaunchable` (frontend, local) | `sessionManager` | 🟡 Independiente de lifecycle |
| **LaunchMode** | `workspaceRegistry.js` | Orchestrator + activation | 🟢 Cerrado en D2.2-D |
| **External** | — | Routing | 🔴 **PENDIENTE D4** |
| **Visual metadata** | Frontend presentation | UI | 🟢 Fuera del contrato |

> `permission` es derivada por regla (`workspace.open.<key>`), no declarada. Derivado en D2.2-A.
> `external` **no es lifecycle**: describe ubicación fuera del Workspace. No aparece en la proyección.

---

## 7. Decisiones y límites vigentes

### D3 — LaunchMode (resuelto en D2.2-D)

El Registry frontend declara `launchMode`; el orchestrator lo lee sin
derivarlo de lifecycle; activation valida la combinación. Los modos soportados
son `workspace` y `controlled`. La matriz está en
[`WORKSPACE-LAUNCHMODE-CONTRACT.md`](./WORKSPACE-LAUNCHMODE-CONTRACT.md).

### D4 — External (pendiente)

- `external` describe **ubicación**, no lifecycle. No es derivable de `entry_url`.
- Requiere definición de producto y no aparece en la proyección.

### `medical` y `empresa` — divergencias congeladas

No sincronizar los estados entre backend y frontend como parte de este
contrato. Resolver cuándo se abren requiere una decisión de producto.

## 8. Reglas para quien siga

1. **Lifecycle se lee del Registry.** Availability se **deriva**. Launchability
   se mantiene independiente.
2. **No usar `available`/`coming_soon` como lifecycle.** Son presentación.
3. **No sincronizar `medical` ni `empresa`** como efecto colateral.
4. **LaunchMode se declara en `workspaceRegistry.js`** y se valida según el
   contrato D2.2-D; no derivarlo del status.
5. **No introducir `external` en la proyección** sin resolver D4.

---

*Contrato de lifecycle/availability. LaunchMode tiene runtime documentado en
`WORKSPACE-LAUNCHMODE-CONTRACT.md`. Verificable con:*
`pytest backend/tests/test_workspace_launch_contract.py` ·
`npm test -- workspaceLaunchContract`