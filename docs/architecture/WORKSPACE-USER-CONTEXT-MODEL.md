# Workspace User Context Model

**Estado:** Contrato conceptual de diseño; no es DTO ni contrato runtime.
**Restricciones:** no implementa Identity, no cambia autenticación/autorización,
no crea memberships y no conecta la proyección Workspace.

## 1. Propósito

Definir el contexto mínimo y extensible que podría recibir un Workspace para
renderizar una experiencia de usuario sin convertir al Workspace en autoridad
de cuenta, identidad, permiso o datos de dominio. Cada campo indica owner,
semántica y si existe actualmente. La forma final de transporte/implementación
queda pendiente.

## 2. Forma conceptual

```text
WorkspaceUserContext {
  user_id: string,
  entity_reference: string | null,
  profile_type: string | null,
  active_workspace: WorkspaceReference | null,
  available_workspaces: WorkspaceReference[],
  enabled_verticals: VerticalReference[],
  permissions: PermissionReference[],
  preferences: PreferenceSet,
  organization_context: OrganizationContext | null,
  professional_context: ProfessionalContext | null,
  agent_context: AgentContext | null,
  notifications: NotificationContext,
  feature_flags: FeatureFlagSet,
  subscription_context: SubscriptionContext | null,
  locale: string | null,
  timezone: string | null,
  country: string | null
}
```

La forma ilustra conceptos; no prescribe que todos los campos estén en una
respuesta, se guarden en un único documento, ni se carguen sincrónicamente.
Consumidores deben pedir solo lo que necesiten y tolerar campos opcionales o
fuentes no disponibles según contratos de cada servicio.

## 3. Campos y ownership conceptual

| Campo | Tipo conceptual | Owner / fuente autorizada | Significado y límites | Estado observado |
| --- | --- | --- | --- | --- |
| `user_id` | `string` | Sistema de cuenta que autentica la sesión; One para su cuenta local. | ID nativo de cuenta dentro de ese sistema. No identificar globalmente sin `source`; no sustituirlo por `entity_reference`. | One usa `users.id`; APIs/contexts lo exponen como `id` o `user_id`. |
| `entity_reference` | `string \| null` | Identity Authority cuando se apruebe y opere. | Referencia opcional a persona transversal. No es credencial, permiso, membership ni fallback. | No está conectado en este modelo runtime; Identity permanece BLOCKED. |
| `profile_type` | `string \| null` | Dominio que mantiene el perfil; One para clasificación local, Legal/Vertical para clasificación de su dominio. | Tipo de perfil/experiencia (p. ej. personal, profesional u organización). No es rol ni autorización. | Hay derivación `account_type` y adaptaciones de `profile_type`; no hay vocabulario global uniforme. |
| `active_workspace` | `WorkspaceReference \| null` | Contexto de navegación actual y Registry/servicio de acceso que valida destino. | Workspace seleccionado en la sesión/experiencia. No implica acceso si entitlement/policy no lo permite. | Varios contextos guardan recomendación/destino; no se identificó campo global único. |
| `available_workspaces` | `WorkspaceReference[]` | Workspace Registry declara configuración; Bridge/Policy determina los permitidos para el sujeto. | Lista de destinos que el consumidor puede ofrecer en este contexto. No persistir como membership ni volverla autoridad paralela. | Access Bridge devuelve `identity.available_spaces`; `system-context` también tiene `workspaces.available`; frontend normaliza por separado. |
| `enabled_verticals` | `VerticalReference[]` | Workspace/Vertical owner y policy/entitlements del dominio. | Verticales habilitadas para el usuario/operación conforme a fuentes autorizadas. No derivar solo de perfil o nombre. | `identity_core` extrae/deriva verticals y entitlements; Legal adapter combina `verticals` y `active_verticals`. |
| `permissions` | `PermissionReference[]` | Policy/entitlement authority del sistema que protege la acción/recurso. | Capacidades explícitas y acotadas. Deben evaluarse en servidor; visibilidad cliente no autoriza. | Access Bridge devuelve `entitlements`; Legal context lleva `permissions`. No existe un único vocabulario demostrado entre ambos. |
| `preferences` | `PreferenceSet` | One para preferencias UI; Workspace backend para layout/widget preferences existentes. | Personalización, layout, tema, locale de UI si aplica. No equivale a disponibilidad, rol, membership o permiso. | `UIPreferencesContext` persiste `ui_preferences`; `WorkspaceContext` persiste layout/widgets y identity de layout en localStorage. |
| `organization_context` | `OrganizationContext \| null` | Dominio organizacional que mantiene miembros/ownership (hoy One para `companies`; Legal para sus organizaciones/firmas). | Relación activa con una organización, identificador con namespace, relación/rol organizacional y datos mínimos. No es identidad de persona. | `identity_core` resuelve companies donde usuario es owner/team; Legal adapter normaliza firm/organization/tenant IDs. |
| `professional_context` | `ProfessionalContext \| null` | Vertical competente y fuente de credenciales. | Profesión, perfiles y referencias verificadas que necesita la experiencia. No inferir licencia/vigencia de campos de perfil libres. | Campos/signales profesionales están dentro de `users`; no se encontró entidad profesional separada confirmada. |
| `agent_context` | `AgentContext \| null` | Sistema/vertical que administra la relación de agente. | Vínculo/mandato con principal, organización y alcance; incluir solo si un producto lo requiere. | `agent` existe como valor de rol/tipo y una ruta `/agent` usa placeholder Legal; no hay workspace/entidad agent canónica localizada. |
| `notifications` | `NotificationContext` | Servicio de notificaciones del dominio y preferencias One para presentación. | Conteos/resúmenes o referencias de notificación autorizadas, no contenido irrestricto de otros dominios. | Existen superficies de notificaciones comunitarias; no se encontró un contexto universal. |
| `feature_flags` | `FeatureFlagSet` | Servicio/configuración que gobierna cada flag y entorno. | Habilita UI/experimento, no grants de acceso ni estados de Workspace. | No se encontró una fuente universal de feature flags del contexto de usuario en las superficies auditadas. |
| `subscription_context` | `SubscriptionContext \| null` | Billing Core/owner de suscripciones, si se integra. | Referencia/estado mínimo necesario para una experiencia; no replicar datos de pago. | No se identificó ruta/servicio de Billing en el alcance consultado; contrato/owner externo no confirmado. |
| `locale` | `string \| null` | Preferencia del usuario/cliente y configuración regional del producto, sujeto a soporte. | Idioma/locale de presentación. No determina nacionalidad ni jurisdicción legal. | No se confirmó un campo común centralizado en los contextos revisados. |
| `timezone` | `string \| null` | Preferencia explícita/entorno del cliente con fuente acordada. | Presentación de fechas/horas. No inferir zona legal desde IP. | No se confirmó campo común centralizado. |
| `country` | `string \| null` | Dato del perfil verificado o fuente consentida para una finalidad declarada. | Contexto país cuando es necesario. No asumir residencia o ciudadanía desde geolocalización. | Existen datos country en modelos/perfiles; definición y verificación varían por dominio. |

### Tipos de referencia (conceptuales)

```text
WorkspaceReference {
  key: string,
  lifecycle: "live" | "preview" | "declared" | "deprecated",
  availability: "open" | "closed", // derivada de lifecycle
  launchMode: "workspace" | "controlled",
  location: "internal" | "external"
}

VerticalReference {
  key: string,
  source: string,
  status: string | null
}

OrganizationContext {
  source: string,
  organization_id: string,
  relation: string,
  role: string | null
}

ProfessionalContext {
  source: string,
  profile_id: string | null,
  profession: string | null,
  verification_state: string | null
}

AgentContext {
  source: string,
  agent_id: string,
  principal_reference: string | null,
  scope: string[]
}
```

Las referencias llevan `source` porque IDs nativos de sistemas distintos no
son comparables solo por su string. Las propiedades de Workspace conservan
contratos independientes: `availability` se deriva; LaunchMode se declara y
valida por su contrato; `location` no es autorización. La proyección existente
no contiene todos esos ejes; no se debe conectar este shape por inferencia.

## 4. Invariantes

1. Todo `user_id` lleva el contexto/issuer del sistema que lo emitió.
2. `entity_reference` es nullable y se omite cuando Identity no resuelve; no
   bloquear auth One ni degradar a coincidencia por email.
3. Permissions/entitlements son resultados del dominio de autorización y se
   verifican en backend; no aceptar como prueba un array enviado por UI.
4. Workspace disponible, workspace activo, lifecycle y launchability son
   conceptos separados. El destino recomendado no concede acceso.
5. Organización, profesional y agente son contextos/relaciones separados de
   persona, cuenta y workspace.
6. Preferencias y feature flags afectan presentación/experiencia según su
   policy; no alteran lifecycle ni autorización.
7. Suscripción no se incluye hasta que Billing publique contrato y permiso;
   One no calcula estado de pago.
8. País, timezone y locale son dimensiones diferentes; no inferir jurisdicción
   ni nacionalidad desde `locale` o ubicación IP.
9. Vertical recibe la porción mínima y propia; no obtiene perfiles completos
   de otros dominios por compartir la referencia.
10. Contextos no disponibles producen estado/error explícito definido por cada
    contrato, no un contexto success-shaped con permisos por defecto.

## 5. Composición y orden de confianza

```text
autenticación de dominio → identidad de cuenta
                              │
                optional Identity reference
                              │
         current workspace + Registry configuration
                              │
            Policy / entitlements for this request
                              │
    domain-specific organization/professional/agent context
                              │
            preferences / locale / presentation
```

No implica que el contexto se construya en un servicio ni en ese orden de
llamadas. Explicita que datos de presentación nunca sustituyen autenticación,
policy o autoridad de dominio.

## 6. Decisiones abiertas

- **DECISIÓN PENDIENTE:** contrato final de transporte, versionado, composición
  síncrona/asíncrona, cache/TTL y reglas de indisponibilidad.
- **DECISIÓN PENDIENTE:** vocabularios comunes y namespaces de profile,
  organization, professional, agent y vertical, sin colapsar IDs de Legal/One.
- **DECISIÓN PENDIENTE:** campos mínimos de contexto por consumidor y política
  de datos sensibles.
- **DECISIÓN PENDIENTE:** owner y contrato de Billing, notificaciones y flags.
- **DECISIÓN PENDIENTE:** autoridad de región/locale y reglas por país LATAM.
- **DECISIÓN PENDIENTE:** reconciliación del drift backend/frontend de
  lifecycle Workspace; los estados existentes quedan intactos.
- Identity permanece **BLOCKED — NOT READY**; no decidir aquí ownership
  operativo ni crear `entity_reference`.
