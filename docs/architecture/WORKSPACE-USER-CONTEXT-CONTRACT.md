# Workspace / User Context Contract

**Estado:** Contrato conceptual; no es DTO runtime y no crea memberships,
permisos ni referencias canónicas.

## Propósito

Describir el contexto que One podría componer para mostrar navegación del
ecosistema, manteniendo separadas cuenta, identidad, perfil, preferencias,
Workspace Access y verticales. Las estructuras marcadas como conceptuales no
deben interpretarse como campos existentes en `/api/auth/me` o en Access
Bridge.

## Contexto de usuario propuesto

```text
UserContext {
  user_id: string,                    // ID nativo de cuenta One
  entity_reference: string | null,    // conceptual; no implementado aquí
  profiles: ProfileReference[],       // referencias a perfiles del dominio
  preferences: UserPreferences,       // preferencias UI propiedad de One
  available_workspaces: WorkspaceRef[],
  enabled_verticals: VerticalRef[]
}
```

| Campo | Significado | Fuente/owner esperado | Estado y límite |
| --- | --- | --- | --- |
| `user_id` | Identificador nativo de la cuenta One. | One (`users.id`; usado hoy por auth/JWT/sesiones y relaciones One). | Existe en runtime como `id`, no se renombra con este contrato. |
| `entity_reference` | Referencia a una identidad personal transversal cuando exista vínculo autorizado. | Identity Authority futura; operación pendiente. | **No implementado como campo del user context.** No generar, inferir ni usar como fallback de autenticación/autorización. |
| `profiles` | Referencias y metadatos mínimos a perfiles por dominio. | Cada sistema fuente; One conserva su perfil local. | Contrato conceptual; no transportar perfil completo de Legal/Medical a One. |
| `preferences` | Preferencias de presentación/configuración del usuario. | One; `user_workspaces` guarda preferencias/layout según auditorías previas. | No equivale a membership o entitlement. |
| `available_workspaces` | Espacios que la capa puede ofrecer según el contexto de acceso y Registry. | Access Bridge/entitlements para autorización; Registry para configuración. | Debe ser resultado del acceso vigente, no una copia autoritativa de roles o perfil. |
| `enabled_verticals` | Referencias a verticales que el contexto/contratos permiten presentar. | Fuente que gobierna vertical + policy/entitlements; no asumir que `user.verticals` basta. | El campo conceptual no otorga acceso ni certifica lifecycle del workspace. |

### Distinciones obligatorias

- `profiles` describen información/contextos de dominio; no son necesariamente
  membresías.
- `available_workspaces` no es la lista de todos los workspaces existentes ni
  una propiedad persistente del usuario.
- `enabled_verticals` no se deriva automáticamente de la existencia de un
  perfil profesional.
- `entity_reference` no sustituye a `user_id`, no es una credencial y no es un
  permiso.
- Las preferencias sobreviven o cambian bajo el lifecycle propio de One; no
  abren workspaces.

## Contrato de Workspace

```text
Workspace {
  key: string,
  lifecycle: "live" | "preview" | "declared" | "deprecated",
  availability: "open" | "closed",      // derivada de lifecycle; no persistida
  launchMode: "workspace" | "controlled",
  location: "internal" | "external"
}
```

| Campo | Semántica | Regla |
| --- | --- | --- |
| `key` | Identificador estable del espacio. | Fuente de catálogo/Registry; no confundir con vertical key o ID de cuenta. |
| `lifecycle` | Etapa del workspace. | Fuente efectiva: `backend/services/workspace_registry.py`; valores válidos `live`, `preview`, `declared`, `deprecated`. |
| `availability` | Estado abierto/cerrado derivado. | `live`/`preview` → `open`; `declared`/`deprecated` o desconocido → `closed`. No almacenar como autoridad paralela. |
| `launchMode` | Cómo se permite el lanzamiento. | Contrato separado; lo declara el Registry correspondiente y se valida contra lifecycle. `preview` requiere `controlled`; `live` admite `workspace` o `controlled`; `declared`/`deprecated` no lanzan. |
| `location` | Dónde vive la experiencia en sentido lógico de producto. | Declaración explícita `internal` o `external`; no inferir por route o `entry_url`. No determina lifecycle, availability o permiso. |

Este contrato es el shape conceptual. La proyección segura ya existente para
frontend no incluye todos esos campos: la proyección Lifecycle/Location y
LaunchMode se mantienen separadas según sus contratos vigentes. No conectar una
forma conceptual al runtime por este documento.

## Contrato de Vertical

```text
Vertical {
  key: string,
  identity: VerticalIdentityReference,
  data_domain: DomainReference,
  permissions: PermissionReference[],
  workspaces: WorkspaceRef[]
}
```

- **Identidad propia:** la vertical tiene clave/namespace de producto y origen
  identificable; no crea por eso una persona `entity_id` ni usa ese valor como
  workspace key.
- **Datos propios:** perfiles especializados y datos sensibles permanecen en
  el dominio competente (por ejemplo, Legal o Medical).
- **Permisos propios:** policy/entitlements del dominio son la fuente de
  decisión. La vertical no infiere permiso por `user_id`, `entity_reference`,
  profesión declarada o workspace visible.
- **Dominio independiente:** sus reglas, lifecycle y evidencia pueden ser
  distintos de One. El vínculo de usuario/persona requiere contrato explícito.
- **Cardinalidad:** una vertical puede abarcar varios workspaces; múltiples
  perfiles pueden referenciar a una persona. No fijar 1:1 sin decisión propia.

## Composición del contexto y límites de confianza

```text
One account/session (user_id)
       │ authenticated request
       ├── One profile + preferences
       ├── Identity reference (optional, future)
       └── Workspace Access / entitlements (read from current authority)
                 │
                 └── available workspace references
                           │
                           └── Vertical experience
                                  ├── own profile/data
                                  └── own permission decision
```

1. Autenticación identifica la cuenta One según el contrato actual.
2. Identity (si en el futuro se aprueba y existe un link) devuelve una
   referencia canónica mínima; no autentica ni autoriza.
3. Access Bridge/Policy resuelven acceso según las fuentes y reglas vigentes.
4. One muestra workspace solo a partir del contexto autorizado, sin convertir
   visibilidad en permiso.
5. La vertical vuelve a aplicar su autorización y conserva sus datos.

Hoy `AuthContext` mantiene `user`, `token`, `systemContext` y `accessContext`.
El login puede quedar autenticado aunque falle la carga de contextos; el
frontend deja esos contextos en `null`. El contrato conceptual no debe hacer que
la disponibilidad de Identity cambie autenticación existente.

## Mapeo del estado runtime (solo lectura)

| Superficie | Lo que ofrece hoy | Lo que no demuestra |
| --- | --- | --- |
| Auth `/api/auth/me` / `AuthContext.user` | User de One normalizado y estado de sesión/token existente. | `entity_reference` implementado ni membership universal. |
| `/api/auth/system-context` | Contexto de sistema/vertical/workspace normalizado por `coreLegalContext.js` cuando la fuente es Legal Core; conserva `path`/`workspace_id`. | Identidad canónica `entity_id` o que One sea autoridad de Legal. |
| `/api/access/entitlements` | `subject_id`, `identity` con `entity_id` y `available_spaces`, más entitlements; requiere identidad canónica resuelta en backend. | Creación de identidad o cuenta One. |
| `workspaceRegistry.js` frontend | Espejo frontend de verticales/workspaces, status y `launchMode`. | Fuente canónica backend ni consistencia garantizada. |
| Workspace Registry backend | Claves, lifecycle, availability derivada, launchMode y location. | Que consumidores frontend hayan migrado al snapshot o que el permiso se otorgue por Registry. |

## Decisiones fuera de este contrato

- Owner operativo de Identity y su despliegue: pendiente.
- Forma final de `entity_reference` y mecanismo de linking: pendiente y no
  implementado.
- Membresía universal usuario ↔ workspace: no se crea ni se infiere.
- Reconciliación de drift de lifecycle entre backend y frontend: pendiente;
  no alterar los status existentes como parte de este diseño.
- Relaciones Organization/Agent/Professional con workspace: requieren
  definición funcional independiente.

## Referencias

- [ONE-EVOLUTION-ARCHITECTURE.md](./ONE-EVOLUTION-ARCHITECTURE.md)
- [IDENTITY-AUTHORITY-BOUNDARY.md](./IDENTITY-AUTHORITY-BOUNDARY.md)
- [WORKSPACE-LAUNCH-CONTRACT.md](./WORKSPACE-LAUNCH-CONTRACT.md)
- [WORKSPACE-LOCATION-CONTRACT.md](./WORKSPACE-LOCATION-CONTRACT.md)
- [WORKSPACE-PROJECTION-MIGRATION.md](./WORKSPACE-PROJECTION-MIGRATION.md)
