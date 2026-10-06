# Punto Cero One Evolution — Architecture

**Estado:** Diseño de arquitectura; no modifica runtime, identidad, login ni datos.

**Alcance:** posición de One como capa de experiencia/orquestación del
ecosistema, y sus límites frente a Identity, Workspace y verticales.

## 1. Qué es Punto Cero One

Punto Cero One es la **capa de entrada y experiencia de usuario del
ecosistema**. Presenta la cuenta y perfil de One, navegación, comunidad,
preferencias y acceso hacia experiencias/workspaces disponibles. Puede
coordinar el consumo de contratos compartidos, pero no convierte a One en dueño
de los datos ni políticas de todos los productos que conecta.

Arquitectura objetivo conceptual:

```text
                         Punto Cero One
                  entrada / contexto / navegación
                              │
                    One account (users.id)
                              │
            optional canonical identity reference
             (entity_reference; not implemented)
                              │
                 Workspace Access / entitlement
                              │
                  Vertical experience(s)
                  ├── Legal Core
                  ├── Medical
                  ├── Odontología
                  ├── Psicología
                  └── Enfermería
```

La identidad canónica aún no es requisito para todas las capacidades de One.
El `entity_reference` del diagrama es únicamente conceptual. La operación
Identity permanece **BLOCKED — NOT READY** para materialización automática.

## 2. Conceptos que no deben confundirse

| Concepto | Definición | Ejemplo / autoridad | No significa |
| --- | --- | --- | --- |
| **Usuario** | Cuenta autenticable dentro de un producto; tiene un ID nativo y credenciales/sesiones propias. | `users.id`, credenciales, sesión y perfil de cuenta pertenecen hoy a One. | Persona universal ni autorización automática en otras verticales. |
| **Identidad** | Referencia canónica transversal a una persona, enlazada a IDs de sistemas con evidencia aprobada. | `entity_id` de Identity System, autoridad lógica propuesta en System Core; operación pendiente. | Cuenta, email, sesión, membership o grant. |
| **Perfil profesional** | Datos/credenciales que describen la relación o práctica profesional de una persona dentro de un dominio. | Campos profesionales pueden existir dentro del perfil `users`; una vertical futura/Legal debe validar su propio registro. | Identidad canónica ni prueba suficiente de licencia o permiso. |
| **Empresa** | Organización/entidad de negocio y sus relaciones (owner, equipo, contenido). | `companies` y `owner_id` pertenecen hoy a One. | Usuario persona o `entity_id` personal. |
| **Workspace** | Destino de experiencia/operación que reúne navegación y acceso a un producto/espacio. Tiene `key` estable y ejes propios. | Workspace Registry backend; lifecycle, availability derivada, launchMode y location. | Vertical, perfil, rol o permiso concedido por sí mismo. |
| **Vertical** | Dominio funcional del ecosistema con datos, reglas, permisos y experiencia especializada. | Legal, Medical y subverticales profesionales. | Workspace necesariamente 1:1, una identidad nueva ni una partición de cuenta obligatoria. |

Relaciones: un usuario One puede corresponder a una persona; una persona puede
tener perfiles en múltiples dominios; una vertical puede ofrecer uno o más
workspaces; una empresa puede tener varias personas relacionadas. Las
cardinalidades y memberships universales no quedan creadas por este documento.

## 3. One como puerta de entrada

Responsabilidades objetivo de la experiencia One:

- presentar la cuenta y preferencias del usuario One;
- consultar los contextos de sistema y acceso disponibles sin sustituir a sus
  autoridades;
- presentar workspaces que el contrato de acceso ya permite ofrecer;
- dirigir al usuario a la experiencia apropiada respetando el destino definido
  por la autoridad correspondiente;
- mantener separación entre navegación, lifecycle, launchability,
  authorization y location;
- permitir evolución gradual, consumidor por consumidor, sin forzar migración
  de todos los catálogos o verticales a la vez.

One no convierte una recomendación de destino en entitlement. Workspace
Registry declara lifecycle/configuración de espacio; Availability se deriva
del lifecycle; policy/entitlements deciden acceso; launchability y LaunchMode
siguen contratos separados; Location declara dónde vive la experiencia.

## 4. Responsabilidades que One no tiene

- No es dueño de `entity_id` ni adjudica identidad transversal.
- No reemplaza la identidad de cuenta One (`users.id`) ni cambia JWT/login como
  parte de esta fase.
- No escribe ni armoniza usuarios, organizaciones, memberships o datos de
  Legal Core.
- No concede acceso a una vertical por inferencia de perfil, email, empresa,
  rol técnico o identidad canónica.
- No es autoridad para el lifecycle, permisos, entitlements o datos internos
  de cada vertical.
- No replica perfiles legales, clínicos, credenciales profesionales ni
  historiales en la capa de entrada.
- No asume que un mismo usuario de producto equivale a una membership
  universal del ecosistema.

## 5. Convivencia con Legal Core y Medical

### Punto Cero Legal

Legal Core mantiene sus propios IDs, cuentas, datos legales, organizaciones,
tenants, permisos y reglas jurídicas. El bridge frontend actual
`coreLegalContext.js` normaliza respuestas/contexto para la experiencia One y
conserva `path`/`workspace_id` del Core Legal como autoridad del destino. Es
compatibilidad de contexto en frontend; no equivale a migración de identidad ni
a autorización de One sobre Legal.

Un futuro link `One user ↔ entity_reference ↔ Legal profile` requiere
aprobación, prueba de control de ambos IDs y contrato explícito con Legal. No
se deduce por email ni por `user_id_core`, `firm_id`, `organization_id` o
`tenant_id`.

### Punto Cero Medical y profesiones de salud

Medical y las claves `odontologia`, `psicologia` y `enfermeria` están presentes
en los catálogos de workspace. La observación actual detecta drift:

- Workspace Registry backend: Medical y subverticales están `declared`.
- Espejo frontend `workspaceRegistry.js`: Medical está `preview`/habilitado;
  odontología, psicología y enfermería están `declared`/deshabilitadas.

El estado contractual fuente y el espejo no coinciden. Este documento no
promueve, abre ni cierra esos workspaces; la discrepancia requiere reconciliación
contractual separada. Medical conserva sus propios datos clínicos y permisos.
Los perfiles profesionales y credenciales (médico, odontólogo, psicólogo,
enfermería) pertenecen al dominio competente, no al ID canónico de persona.

## 6. Principios para evolución

1. Mantener `users.id` como la referencia nativa de One hasta una fase de
   producto/arquitectura explícita.
2. Tratar `entity_reference` como opcional, externo y no materializado; no
   usarlo para login ni como fallback de autorización.
3. Consultar Workspace Access y policy para permisos; no derivarlos solo de
   roles, verticales o presencia de perfil.
4. Aislar los datos y contratos de cada vertical; compartir identificador no
   implica compartir datos.
5. Reconciliar drift de Workspace Registry antes de consumidores nuevos que
   dependan de esos valores; no corregirlo en esta fase.
6. Dejar la decisión operativa de Identity y su readiness fuera del alcance de
   cambios de UX que no necesitan `entity_id`.

## Referencias

- [WORKSPACE-USER-CONTEXT-CONTRACT.md](./WORKSPACE-USER-CONTEXT-CONTRACT.md)
- [ONE-EVOLUTION-READINESS.md](./ONE-EVOLUTION-READINESS.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
- [IDENTITY-AUTHORITY-BOUNDARY.md](./IDENTITY-AUTHORITY-BOUNDARY.md)
- [WORKSPACE-LAUNCH-CONTRACT.md](./WORKSPACE-LAUNCH-CONTRACT.md)
- [WORKSPACE-LOCATION-CONTRACT.md](./WORKSPACE-LOCATION-CONTRACT.md)
- [WORKSPACE-PROJECTION-MIGRATION.md](./WORKSPACE-PROJECTION-MIGRATION.md)
