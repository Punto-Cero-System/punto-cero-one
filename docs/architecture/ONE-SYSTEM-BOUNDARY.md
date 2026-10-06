# ONE / SYSTEM BOUNDARY

> **Certificación arquitectónica.** Documenta la frontera entre **Punto Cero
> System** (núcleo operativo) y **Punto Cero One** (producto comunidad / entrada
> comercial), a partir de lo que el código realmente contiene.
>
> **No introduce funcionalidad.** No mueve código. No altera permisos.
> Documento de auditoría, sin efecto operativo.

## 0. Principio rector

> **One es la puerta. System es la cerradura.**

One atrae, registra, muestra y comercializa. System decide, autoriza, cobra y
ejecuta. La frontera no es una frontera de *código*: el Core no está en este
repositorio. Es una frontera de **autoridad**.

La consecuencia práctica: **una respuesta de permiso nunca se decide en One.**
One puede *preguntar*; la respuesta llega del System.

## 1. Mapa arquitectónico final

```
┌────────────────────────── PUNTO CERO SYSTEM (Core) ──────────────────────────┐
│                                                                               │
│  Identity Core   System Identity   Identity Registry   Identity Audit         │
│  Tenant Core     Workspace Core    Entitlement Core    Permission Core        │
│  Billing Core    Darwin Core       Communication Core  Directory Core         │
│                                                                               │
│  ⚠  En el repositorio de One existen piezas de identidad, workspace,             │
│     entitlement y permission. Su autoridad lógica y su ubicación actual no son  │
│     equivalentes: System Identity tiene implementación/persistencia local.       │
│     Tenant, Billing, Darwin, Communication y Directory NO existen aquí.          │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │  frontera de autoridad
                                    │  · System concede / deniega
                                    │  · One presenta y comercializa
                                    │  · Ningún permiso se decide en One
                                    ▼
┌────────────────────────── PUNTO CERO ONE (producto) ─────────────────────────┐
│                                                                               │
│  Comunidad · Feed · Perfiles · Empresas · Eventos · Empleos                   │
│  Descubrimiento · Marketplace · Usuario comunitario                           │
│                                                                               │
│  Acceso al catálogo de espacios:                                             │
│    GET  /api/access/spaces          (público)                                 │
│    GET  /api/access/entitlements    (lee del Core)                            │
│    POST /api/access/intent          (prepara intención, TTL 300 s)             │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2. Qué pertenece a Punto Cero One

Todo lo verificado en `backend/routes/` y `backend/services/` que constituye
producto comunidad.

| Dominio | Rutas | Pertenece a |
|---|---|---|
| Comunidad / auth | `/api/community/auth`, `/api/auth` | **One** |
| Perfiles | `/api/community/users`, `/api/community/users/media` | **One** |
| Feed | `/api/feed` | **One** |
| Grupos | `/api/groups` | **One** |
| Empresas | `/api/company`, `/api/companies` | **One** |
| Eventos | `/api/events` | **One** |
| Empleos | `/api/jobs` | **One** |
| Descubrimiento | `/api/discovery` | **One** |
| Marketplace / contenido | `/api/content-sources`, `/api/growth` | **One** |
| Grafo social | `/api/follows` | **One** |
| Mensajería / realtime | `/api/messaging`, `/api/realtime`, `/api/notifications` | **One** |
| Búsqueda | `/api/search` | **One** |
| Mi Espacio (layout) | `/api/workspace/me` | **One** |
| **Acceso a Core** | `/api/access/*` | **Frontera** |

El último es el único punto de contacto. **No pertenece a ninguno de los dos
sentidos**: es el puente, y por eso no se mueve ni se reescribe.

## 3. Qué pertenece a Punto Cero System

| Core | Dónde vive hoy | Quiere decir |
|---|---|---|
| Identity Core | Implementación/proyección local (`services/identity_core.py`) | Resolución de contexto actual; no crea `entity_id` |
| System Identity | Implementación local (`services/system_identity.py`) | Autoridad lógica objetivo propuesta en `ADR-IDENTITY-OWNERSHIP.md`; `entity_id` y vínculos canónicos |
| Tenant Core | **Core externo; ausente aquí** | Aislamiento de datos por cliente |
| Workspace Core | Catálogo del Core; aquí espejo (`services/workspace_registry.py`) | Fuente única de espacios |
| Entitlement Core | Core externo; aquí derivación (`services/entitlement_service.py`) | Quién tiene derecho a qué |
| Permission Core | Core externo; aquí evaluador (`services/policy_can.py`) | `can()` fail-closed |
| Billing Core | **Core externo; ausente aquí** | Planes, límites, pagos |
| Darwin Core | **Core externo; ausente aquí** | IA. One consume, no ejecuta |

**Regla de tenencia de datos:** `users`, `posts`, `companies` y datos de producto
son de One. `system_identities` es lógicamente de System según la frontera y la
ADR de ownership; sin embargo, su implementación actual está en este repositorio
y el Bridge consulta la base configurada por One. Esta ubicación física no
certifica una separación de despliegue ni un servicio System remoto. La topología
operativa queda pendiente; no se debe introducir un segundo escritor.

**Estado actual vs objetivo:** `system_identity.py` implementa creación,
vinculación y resolución persistentes, y `server.py` solicita sus índices durante
startup. Los flujos de alta de usuario no materializan identidad de forma
garantizada y el Access Bridge resuelve en modo lectura. Por tanto, System
Identity no es únicamente una proyección de lectura, pero tampoco existe aún un
flujo de materialización garantizado para cada usuario.

`services/access_bridge.py` prepara intents en memoria y no realiza llamadas de
red ni I/O Mongo por sí mismo. La ruta `routes/access_bridge_routes.py` integra
esa pieza con lecturas a Mongo para resolver `system_identities` y construir el
contexto/entitlements. La etiqueta “puente a Core” describe la frontera
arquitectónica deseada, no una integración remota confirmada en este código.

Ver [ADR-IDENTITY-OWNERSHIP.md](./ADR-IDENTITY-OWNERSHIP.md) y
[IDENTITY-LIFECYCLE-CONTRACT.md](./IDENTITY-LIFECYCLE-CONTRACT.md) para la
autoridad objetivo y el ciclo de vida propuesto; ambos son contractuales y no
activan cambios runtime.

## 4. Flujo correcto: usuario → activación

```
┌─────────────┐
│  Usuario    │  se registra en One (contenido, gratuito)
└──────┬──────┘
       ▼
┌─────────────────────────────────────────┐
│  One Community Experience               │  ← TODO lo que ocurre dentro de One
│  feed · perfiles · grupos · contenido    │
└──────┬──────────────────────────────────┘
       ▼  descubre una vertical y se suscribe
┌─────────────────────────────────────────┐
│  Contrata un servicio                   │  ← One PRESENTA, no cobra
└──────┬──────────────────────────────────┘
       ▼  System procesa el pago
┌─────────────────────────────────────────┐
│  SYSTEM (Core)                          │  ← Aquí ocurre todo lo que decide
│  · verifica pago                        │
│  · crea/actualiza tenant                │
│  · concede entitlements                 │
│  · activa workspace correspondiente      │
│  · habilita Darwin especializado si aplica │
└──────┬──────────────────────────────────┘
       ▼
┌─────────────────────────────────────────┐
│  Workspace de la vertical               │  ej. legal.puntocerosystem.com/one
└─────────────────────────────────────────┘
```

### Ejemplo trabajado

```
Usuario   →  registro en One          (perfil comunitario, feed, grupos)
Compra    →  Punto Cero Legal Profesional
System    →  crea tenant
             concede workspace.open.legal
             registra suscripción y estado de plan
             activa el workspace "legal"
             habilita Darwin especializado (si el plan lo incluye)
```

**Dónde termina One y empieza System:** en la línea *"One presenta y
comercializa"* → *"System procesa el pago"*. One puede mostrar un botón de
contratación que lleva a un flujo del Core. **One no debe procesar el pago ni
decidir el entitlement resultante.**

## 5. Auditoría de Workspaces

### 5.1 Hallazgo principal: "workspace" significa dos cosas

Este es el riesgo real que encontró la auditoría. **No confundir:**

| Concepto | Dónde | Qué es |
|---|---|---|
| **Workspace Universal** (`workspace_registry.py`) | Core | Un *espacio de vertical*: legal, medical, empresa… |
| **Mi Espacio** (`workspace_routes.py`) | One | *Layout* personal: widgets, paneles, tema |

`routes/workspace_routes.py:1-28` persiste en `user_workspaces` qué widgets se
ven y en qué orden. **No tiene relación con las verticales.** Comparte nombre y
no comparte propósito. Confundirlos sería un error de diseño caro.

### 5.2 Los espacios del Workspace Universal

Todos viven en `WORKSPACE_REGISTRY` y apuntan a `CORE_OPERATIVO_UNICO`.

| `space_key` | Etiqueta | Estado | Ruta | ¿De quién es? |
|---|---|---|---|---|
| `legal` | Punto Cero Legal | `live` | `/workspace/legal` | **System** |
| `comunidad` | **Punto Cero One** | `live` | `/` | **One** |
| `empresa` | Punto Cero Empresa | `preview` | `/workspace/empresa` | **System** |
| `medical` | Punto Cero Medical | `declared` | `/workspace/medical` | **System** |
| `odontologia` | Odontología | `declared` | `/workspace/odontologia` | **System** |
| `psicologia` | Psicología | `declared` | `/workspace/psicologia` | **System** |
| `enfermeria` | Enfermería | `declared` | `/workspace/enfermeria` | **System** |
| `finance` | Finanzas | `declared` | `/workspace/finance` | **System** |
| `accounting` | Contabilidad | `declared` | `/workspace/accounting` | **System** |
| `inmobiliaria` | Inmobiliaria | `declared` | `/workspace/inmobiliaria` | **System** |

**Resultado:** de los 10 espacios, **9 son del System y 1 es de One**
(`comunidad` = Punto Cero One, que es este producto).

### 5.3 Los cuatro workspaces del brief

El brief nombra *Professional, Organization, Agent y One*. La auditoría **no
supuso** su correspondencia y verificó el código:

| Nombre del brief | ¿Existe en código? | Correspondencia real |
|---|---|---|
| **One Workspace** | Sí | `space_key: "comunidad"`, label "Punto Cero One", route `/` |
| **Organization Workspace** | Parcial | `space_key: "empresa"`, status `preview`. Se otorga por organización (`company_id`) |
| **Professional Workspace** | **No existe como tal** | El concepto está *disperso*: las verticales profesionales (`legal`, `medical`) se conceden por `verticals` del usuario |
| **Agent Workspace** | **No existe** | Sin código, sin entrada en el registry, sin permiso |

**Conclusión:** *Professional* y *Agent* son **conceptos de System** cuya
implementación aún no existe. One no debe crearlos ni nombrarlos: el Registry es
la única fuente de espacios, y ampliarlo aquí sería inventar Core desde el
producto.

## 6. Monetización: dónde vive cada cosa

| Elemento | Dónde vive | Razón |
|---|---|---|
| Planes y límites | **System** | Son capacidad contratada, no contenido |
| Trial | **System** | Regla de negocio y estado de cuenta |
| Pagos | **System** | Dinero real, pasarela, impuestos, reembolsos |
| Facturación | **System** | Dato fiscal |
| Permisos por plan | **System** | `entitlement_service` los deriva del Core |
| **Presentación de planes** | **One** | UX y argumento de venta |
| **Estado del plan (lectura)** | **One** | Se *muestra*, no se decide |

**Conclusión:** Billing pertenece al **System Core**. One únicamente presenta,
comercializa y **muestra** el estado que el Core le devuelve.

En este repositorio **no hay nada de esto**: `stripe` está en
`requirements.txt:116` pero ningún módulo lo importa. No existe `class Plan`,
`class Billing` ni campo de suscripción. One está hoy en un estado coherente con
la frontera: **presenta, pero no cobra**.

## 7. Qué NO debe moverse

Mover cualquiera de estos elementos introduce una regresión con alta probabilidad
de romper producción. Son **invariantes certificadas**:

1. **`services/feed_visibility.py`** — autoridad única de visibilidad tras OMEGA
   (A2–B4.2). Seis endpoints dependen de la misma función por identidad de
   objeto. Moverla o duplicarla reabre las fugas que OMEGA cerró.
2. **`services/workspace_registry.py`** y su constante `CORE_OPERATIVO_UNICO`.
   `validate_registry()` lanza si algún espacio apunta a otro Core: es el candado
   estructural.
3. **`services/policy_can.py`** — orden fail-closed. Reordenar etapas cambia
   decisiones de seguridad.
4. **`services/entitlement_service.py`** — decisiones D1/D2. El rol no concede
   acceso; el status corta todo.
5. **`routes/access_bridge_routes.py`** — cuello de botella único del núcleo de
   acceso. Partirlo duplica la lógica de identidad.
6. **El par `identity_core` ↔ `community_auth`.** Son **dos sesiones que
   conviven deliberadamente**. Unificarlas destruye el caso 4 (409 por
   conflicto), que hoy es una decisión de negocio, no un descuido.
7. **Los `space_key`.** `comunidad` no es un nombre bonito: es la clave que el
   frontend ya consume. Renombrarla rompe la navegación.
8. **Los cuatro catálogos de workspaces**, aunque hoy divergen (§8). Son deuda
   conocida: corregirlos es un carril propio, no un efecto colateral de mover
   otra cosa. Consolidarlos exige un test de contrato primero; hacerlo "de
   paso" reintroduciría el problema en otro sitio.

## 8. Deuda detectada por esta auditoría

Ninguna de estas es un defecto del código: son **deudas declaradas por el propio
código** que la frontera hace visibles. Se listan para que no se confundan con
trabajo pendiente de One.

| Deuda | Ubicación | Gravedad | Naturaleza |
|---|---|---|---|
| **D1 no aplicado**: un usuario `suspendido` conserva el acceso a los workspaces | `access_bridge_routes._access_context` no pasa `status` | **Alta** | Una línea. El propio docstring lo marca como "fase posterior" |
| **Cuatro catálogos de workspaces y ya divergen** | `workspace_registry.py` · `identity_core.SPACE_CATALOG` · `config/workspaceSpaces.js` · `system/workspaceRegistry.js` | **Alta** | `medical` es `declared` en backend y `preview` en `system/`. `status` decide si un espacio exige `allow_non_live` |
| **System Identity síncrono en rutas async** | `system_identity.py` | Media | Reconocido en su propio docstring |
| **Access Bridge no conecta con ningún Core** | `access_bridge.py` | Media | Por diseño (FASE 7 declarada fuera) |
| **Comunicaciones sin dueño claro** | `notifications`, `realtime`, `messaging` | Baja | Requiere decisión del dueño del Core |
| **Capa de frontera replicada en cliente (18 módulos)** | `frontend/src/system/` | Baja | Coherente con la frontera, pero sin contrato que la ate al backend |

## 9. Cómo verificar esta certificación

```bash
# 1. El servidor arranca: la frontera no rompe la aplicación
python -c "import server; print('OK')"

# 2. La autoridad de workspaces sigue apuntando a un único Core
python -c "from services.workspace_registry import validate_registry; validate_registry(); print('OK')"

# 3. La visibilidad de OMEGA sigue siendo UNA sola función
python -c "from services import feed_visibility as fv; \
           from routes import feed_routes as fr, search_routes as sr, content_sources_routes as cs; \
           assert fr._visibility_clause is fv._visibility_clause is sr._visibility_clause is cs._visibility_clause; \
           print('OK')"

# 4. Ningún Core de decisión se ha introducido en One
grep -rE "class (Tenant|Billing|Plan|Agent)\b" backend/ || echo "OK"
```

Las cuatro verificaciones pasan sobre el estado certificado.

---

**Documentos relacionados**
- [`SYSTEM-CORE-MAP.md`](./SYSTEM-CORE-MAP.md) — inventario detallado de los 8 Cores.
- `memory/PRD.md:1042` — el marco acordado que origina esta frontera.
- `ECOSYSTEM_FUSION_MASTER_AUDIT.md` — auditoría de fusión que ya la declaraba.
