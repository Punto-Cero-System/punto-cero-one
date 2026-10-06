# One Core Architecture

**Estado:** Arquitectura objetivo y análisis del código existente; no implementa
ni activa módulos.

**Límites vigentes:** sin cambios de runtime, Login/JWT, Identity, Billing,
Access Bridge, Legal Core, Medical, lifecycle, launchMode ni proyecciones.

## 1. Definición de One Core

**Punto Cero One** es la capa de experiencia común que permite a una persona
usar la entrada, navegación y capacidades transversales de la plataforma y
acceder —cuando la autoridad correspondiente lo permita— a productos y
verticales independientes.

**One Core** es el conjunto acotado de contratos y capacidades de plataforma
que puede reutilizarse sin importar reglas, datos o autorizaciones propias de
una vertical. No es una base de datos única que absorba todos los dominios, ni
un superusuario capaz de conceder todos los accesos. Su regla de diseño es:

> Compartir infraestructura y contratos; mantener autoridad, datos y policy
> en cada dominio propietario.

Una vertical nueva debería poder reutilizar identidad de cuenta del sistema
que la autentica, referencias de Workspace, contexto común, preferencias de
experiencia y servicios compartidos aprobados; debe seguir siendo dueña de su
perfil, datos, permisos de dominio y reglas de negocio.

```text
One Core (experiencia + servicios compartidos)
       │
       ├── User / Workspace Context
       ├── Workspace Registry / Access contracts
       ├── Preferences / Notifications / Activity (shared services)
       ├── optional gateways: Files, Calendar, Messaging, Search
       └── gateways: Billing / Darwin IA (only when owned contracts exist)
                    │
              Vertical boundary
       ├── Punto Cero Legal → Legal Core
       ├── Punto Cero Medical → Medical domain
       ├── odontología / psicología / enfermería
       └── future: Finance / Accounting / Real Estate / Education
```

El diagrama es conceptual. No certifica que cada gateway exista o esté
integrado.

## 2. Criterios de pertenencia al Core

Un módulo pertenece al Core permanente solo si:

1. cubre una capacidad transversal y sin semántica exclusiva de una vertical;
2. tiene owner, contrato versionado, límites de datos y seguridad claros;
3. no interpreta un rol de vertical ni convierte perfil en permiso;
4. admite consumidores independientes sin requerir acceso a sus bases;
5. tiene disponibilidad, observabilidad, lifecycle y rollback definidos;
6. su ausencia no obliga a replicar datos sensibles dentro de One.

Que un módulo esté en el backend/frontend actual no lo convierte
automáticamente en Core. “Reutilizable” describe potencial de diseño; no prueba
que ya sea independiente o READY.

## 3. Módulos evaluados

| Módulo | Clasificación objetivo | Decisión arquitectónica |
| --- | --- | --- |
| **Workspace Registry / Context / Access contract** | **Core permanente** | Contratos comunes de key, lifecycle, launchMode, location y referencias. Authorization sigue en Policy/owner; no hacer Registry equivalente a grant. |
| **User Context composition** | **Core permanente** | Envelope común que combina referencias autorizadas con owners separados; no servicio que adquiera propiedad de todas las fuentes. |
| **Identity Reference** | **Core permanente (bloqueado)** | One Core debe poder portar una referencia canónica nullable. El servicio/escritor Identity queda bajo la decisión operativa pendiente; no incluir materialización en One Core todavía. |
| **Preferences** | **Core permanente, scope limitado** | Preferencias de experiencia y presentación. Layout/preferencias por Workspace se mantienen separadas; no mezclar con membership ni settings clínicos/jurídicos. |
| **Notifications** | **Core permanente como canal/infraestructura; contenido por dominio** | Preferencias, entrega, unread state y routing pueden compartirse; contenido y autorización pertenecen al producer vertical. |
| **Audit** | **Core permanente como plataforma** | Actoría, correlación, append-only e integridad para acciones compartidas. Cada dominio conserva eventos y decisiones de negocio propios. |
| **Feature Flags** | **Core permanente como mecanismo** | Evaluación/configuración por entorno y audiencia. Un flag no sustituye policy, lifecycle ni entitlement. Implementación común no confirmada. |
| **Settings** | **Core permanente para configuración de plataforma; vertical para settings de dominio** | Perfil/preferencias comunes pueden pertenecer al Core; términos, compliance clínico y reglas legales nunca se globalizan por conveniencia. |
| **Activity Stream** | **Core opcional** | Infraestructura/event envelope y lectura cross-domain solo si hay contratos de visibilidad; cada vertical es owner de actividades y reglas de publicación. |
| **Feed** | **Core opcional** | Un feed común es superficie/producto de One, no dependencia universal de cada vertical. Sources y visibilidad son propiedad del dominio emisor. |
| **Community** | **Core opcional / producto One** | Comunidad social no es requisito para Legal/Medical ni una capa obligatoria de toda vertical. Mantener separada de autenticación y workspace access. |
| **Search** | **Core opcional como gateway; índices/query semantics por dominio** | Federación solo con permisos, fuente y purpose explícitos; no crear un índice universal de PII por defecto. |
| **Directory** | **Core opcional como navegación; registros por dominio** | Directorios profesionales/empresas/Legal/Medical siguen bajo owner de dominio y validación; no consolidar entidades en One. |
| **Files** | **Core opcional como storage gateway** | Abstracción de storage/presigned access puede compartirse; clasificación, ACL, retención y contenido pertenecen al dominio. No centralizar documentos legales/clínicos por defecto. |
| **Calendar** | **Core opcional** | Scheduling transport/UX compartible si hay owner y consentimiento; calendarios de audiencias, citas clínicas o trabajo profesional siguen bajo vertical. No se localizó un core calendar en auditoría. |
| **Messaging** | **Core opcional como transporte** | Transporte, delivery y presencia pueden compartirse; threads, contenido, retention y autorización son del dominio. Implementación actual es comunidad/One, no servicio universal. |
| **Darwin IA Gateway** | **Core opcional/futuro** | Gateway común de modelos, cuotas, safety, auditoría y data boundary si Darwin Core ofrece contrato. Darwin IA no es requisito universal y no se confirmó gateway runtime. |
| **Billing Gateway** | **Core opcional/futuro** | Contrato de consumo para billing externo, no sistema contable dentro de One. Producto/verticales conservan entitlement mapping conforme al owner de Billing. No se encontró runtime Billing integrado. |
| **Vertical Profile / Domain Data** | **Propio de vertical** | Credenciales, historia clínica, casos legales, registros profesionales y workflows no suben a One Core. |
| **Organizations / Companies / Tenants** | **Propio de dominio** | One puede tener `companies`; Legal mantiene firmas/organizaciones/tenants. No se colapsan en una entidad Core sin contrato y ownership separado. |
| **Vertical permissions / entitlements** | **Propio del owner/policy que protege el recurso** | Se pueden transportar referencias/scopes, pero One Core no decide licencia, permiso legal ni clinical authorization. |
| **Investor / Growth / Content Sources** | **Propio de producto One o plugin opcional** | No es infraestructura obligatoria para cada vertical; conservar límites de producto y fuentes externas. |

## 4. Módulos permanentes mínimos

El núcleo permanente se limita a:

1. identidad de cuenta por el sistema autenticador, sin reemplazar credenciales;
2. contexto de usuario común, compuesto y namespaced;
3. Workspace Registry/contract y referencias de acceso, separado de policy;
4. preferencias de experiencia con scopes explícitos;
5. contratos transversales de notifications, flags y settings de plataforma;
6. audit/correlation para acciones de plataforma;
7. identidad canónica únicamente como referencia opcional cuando su authority
   operativa esté resuelta.

Activity, feed, community, search, directory, files, calendar, messaging,
Billing y Darwin son capacidades opcionales: solo se vuelven componentes
oficiales del Core cuando cumplen criteria, tienen owner/contrato y las
verticales pueden consumirlos sin ceder su dominio.

## 5. Modelo de reutilización por vertical

Cada vertical declara:

- `vertical_key`, owner, contrato/version y workspace keys asociados;
- su principal/ID nativo y método de autenticación aceptado;
- referencias mínimas que consume de One/Identity;
- datos, perfiles, permisos, política de retención y auditoría del dominio;
- datos que publica a servicios Core (p. ej. notification/activity) y reglas de
  visibilidad;
- dependencias opcionales y comportamiento si el Core opcional no está
  disponible;
- país/jurisdicción y revisión de privacidad/safety cuando aplique.

La vertical nunca necesita que One copie todo su modelo interno. La existencia
de One account o `entity_reference` no concede una cuenta, rol o permiso
vertical.

## 6. No objetivos

- Crear un “universal user” con credenciales o permisos compartidos.
- Materializar `entity_id`, implementar Identity Service o decidir su owner.
- Absorber Legal Core, Medical, Billing o Darwin dentro de One.
- Activar workspaces/verticales o cambiar status del Registry.
- Conectar Workspace Projection o migrar consumidores.
- Convertir Feed/Community en dependencia del Core para cada vertical.
- Crear catálogo común de roles de negocio o memberships universales sin
  decision/owner.

## Referencias

- [ONE-EVOLUTION-ARCHITECTURE.md](./ONE-EVOLUTION-ARCHITECTURE.md)
- [WORKSPACE-USER-CONTEXT-MODEL.md](./WORKSPACE-USER-CONTEXT-MODEL.md)
- [VERTICAL-CONTEXT-CONTRACT.md](./VERTICAL-CONTEXT-CONTRACT.md)
- [IDENTITY-MATERIALIZATION-READINESS.md](./IDENTITY-MATERIALIZATION-READINESS.md)
- [ONE-CONTEXT-CONSUMERS-AUDIT.md](./ONE-CONTEXT-CONSUMERS-AUDIT.md)
- [WORKSPACE-PROJECTION-MIGRATION.md](./WORKSPACE-PROJECTION-MIGRATION.md)
