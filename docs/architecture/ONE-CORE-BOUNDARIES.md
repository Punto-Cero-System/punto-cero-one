# One Core Boundaries

**Estado:** Límites de arquitectura propuestos; no modifican ownership o
permisos runtime.

## 1. Qué pertenece al Core

One Core contiene mecanismos transversales, contratos e integración de
experiencia que no requieren conocer el significado interno de una vertical:

- composición/versionado de User Context con referencias namespaced y
  procedencia por campo;
- Workspace Registry contracts y contexto de navegación; el Registry no
  sustituye a Policy/entitlements;
- referencias a cuenta/sesión emitidas por sus owners, sin compartir
  credenciales;
- preferencias de experiencia con scopes separados de acceso y de settings
  de dominio;
- canales comunes opcionales para notificaciones, activity/audit, flags y
  settings de plataforma bajo sus contratos y controles;
- gateways opcionales de Files, Messaging, Search/Directory, Calendar, Billing
  y Darwin IA, solo cuando exista owner y contrato de seguridad;
- presentación/orquestación de ecosistema que consume, pero no redefine, las
  decisiones de cada owner;
- futura capacidad de transportar `entity_reference` nullable cuando Identity
  tenga un owner operativo y contrato aprobado. La existencia de la referencia
  no hace a One dueño de Identity.

Un servicio compartido solo se considera Core oficial si hay owner,
responsabilidad operacional, SLA/fallo, contrato de datos, permisos,
observabilidad, política de retención y proceso de deprecación.

## 2. Qué permanece en cada vertical/dominio

- **Legal Core:** usuarios/IDs legales, firmas, tenants, organizaciones,
  clientes, casos, documentos jurídicos, policies y procesos legales.
- **Medical y subverticales clínicas:** historia clínica, consultas,
  expedientes, prescripciones, diagnósticos, credenciales clínicas, consentimiento
  y autorización de tratamiento, según owners competentes.
- **Futuras verticales** (Finance, Accounting, Real Estate, Education, etc.):
  registros, roles, workflows, permisos, datos sensibles y cumplimiento propios.
- **One product/community:** posts, grupos, follow graph, feed social, perfil
  One y relaciones de producto locales. Pueden ser features opcionales de One,
  pero no requisito universal para las verticales.
- **Billing Core:** ledger, payment instruments, transacciones, planes,
  suscripciones y reglas de facturación como autoridad de Billing.
- **Darwin Core:** modelos/serving de IA, policy de modelos/datos y evaluación
  de Darwin según su contrato.
- **Identity System:** persona canónica, mappings y su auditoría cuando se
  apruebe. El owner operativo sigue pendiente; One no absorbe esos datos por
  tener la implementación local actual.

## 3. Qué nunca debe subir al One Core

- datos clínicos, legales, financieros o de casos/documentos privados;
- reglas de negocio o thresholds de una sola vertical;
- rol/licencia profesional como rol universal;
- grants, entitlements o excepciones específicas presentadas como preferencias;
- credenciales, secretos, JWT o tokens de otra vertical;
- payloads completos de sistemas fuente cuando basta una referencia mínima;
- decisiones de merge de identidad por email/nombre;
- ownership de empresas, firmas, tenants o memberships locales;
- lógica que haga de una vertical un requisito de login para todo el ecosistema.

## 4. Qué nunca debe bajar a una vertical

- credenciales de One, sesiones, secret keys u otros datos de autenticación;
- datos de otras verticales fuera de la finalidad, permiso y consentimiento
  aprobados;
- perfil profesional o licencia de un dominio distinto como si fuera
  verificado localmente;
- permisos de una vertical como grants transferibles a otra;
- `entity_reference` sin source/authority, estado o finalidad documentados;
- datos agregados de organización/tenant que no pertenezcan a esa vertical;
- referencias o catálogos de Workspace usados para evitar Policy;
- flags/preferencias que permitan saltarse autorización o lifecycle.

Una vertical puede recibir references/claims mínimos definidos en contrato,
pero siempre debe autenticar al caller y revalidar permisos sobre su recurso.

## 5. Fronteras de confianza y llamadas

```text
One UI / experience
  ├─ account provider → cuenta/session owner
  ├─ Workspace Registry → metadata de destino
  ├─ Policy / Access Bridge → decisión/intención según el contrato actual
  ├─ Identity Reference → opcional; BLOCKED hasta decisión/servicio
  └─ gateway opcional → servicio compartido dueño del capability
         │
         └── Vertical API
               ├─ valida autenticación/audience
               ├─ aplica policy propia
               └─ accede únicamente a datos propios
```

El frontend no es autoridad de permisos. Datos de contexto enviados por browser
no deben ser aceptados como source of truth sin validación server-side. Una
falla de servicio opcional no debe producir un contexto con grants ficticios.

## 6. Límites de contexto y persistencia

- User Context es un **composite view**; no implica una sola tabla ni un único
  servicio dueño de cada campo.
- Cada ID conserva namespace/source; no comparar IDs como strings globales si
  no son del mismo sistema.
- Workspace preferences y UI preferences conservan scopes distintos.
- Notifications/Activity llevan source y visibility metadata; consumidores no
  amplían audiencia.
- Files abstrae storage, pero domain owner define ACL, encryption, retention,
  legal hold y clasificación.
- Search/Directory son gateways/UX opcionales; indexar un dato no transfiere
  ownership o autorización para revelarlo.
- Billing/AI context debe ser mínimo: plan/feature entitlement derivado por su
  owner, no token de pago/modelo dentro de One Core.

## 7. Excepciones

Una excepción a estos límites requiere ADR por dominio, owner accountable,
purpose, threat/privacy assessment, permisos, data flow, auditoría, rollout y
rollback. No basta con que un dato “sea útil para el dashboard”.

## Referencias

- [ONE-CORE-ARCHITECTURE.md](./ONE-CORE-ARCHITECTURE.md)
- [VERTICAL-CONTEXT-CONTRACT.md](./VERTICAL-CONTEXT-CONTRACT.md)
- [WORKSPACE-USER-CONTEXT-MODEL.md](./WORKSPACE-USER-CONTEXT-MODEL.md)
- [IDENTITY-AUTHORITY-BOUNDARY.md](./IDENTITY-AUTHORITY-BOUNDARY.md)
