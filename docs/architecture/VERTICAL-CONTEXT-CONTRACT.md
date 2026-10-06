# Vertical Context Contract

**Estado:** Contrato conceptual de integración; no crea DTO, acceso, vínculo de
Identity ni integración con datos productivos.

## 1. Objetivo y límites

Definir la información y límites de confianza para que cualquier vertical
consuma una experiencia a través de Punto Cero One y Workspace sin perder la
autoridad de su dominio.

```text
Contexto One
    ↓
Workspace
    ↓
Vertical
    ↓
Dominio propio
```

Cada salto pasa referencias mínimas, no propiedad de datos. El contrato no
convierte a One en un broker de autorización universal ni al Workspace en una
vertical.

## 2. Capas

### Contexto One

One autentica su propia cuenta bajo su contrato actual y puede aportar
`user_id` nativo, preferencias de experiencia y una selección de navegación.
`entity_reference` es opcional/conceptual hasta que Identity tenga autoridad
operativa y linking aprobados. One no envía credenciales One a verticales y no
declara por sí solo grants de otro dominio.

### Workspace

Workspace identifica un espacio del Registry mediante `key`. El contexto puede
incluir lifecycle, availability derivada, launchMode y location conforme a
contratos separados. Workspace resuelve presentación/entrada y consume acceso;
no verifica una licencia profesional, asigna membership universal ni crea una
identidad personal.

### Vertical

Vertical identifica un dominio funcional y el contrato versionado que
consume. Define sus campos, sus estados, sus permisos y cómo valida el
principal nativo. Vertical puede rechazar un contexto insuficiente aunque
Workspace lo muestre como disponible.

### Dominio propio

El owner conserva datos y reglas dentro de su frontera. Un identificador
transmitido no transfiere el registro de origen. Para datos sensibles, Legal,
clínicos, profesionales, comerciales o financieros, aplicar minimización,
finalidad y autorización del owner en cada request.

## 3. Envelope conceptual

```text
VerticalRequestContext {
  context_version: string,
  source_system: string,
  user_reference: { source: string, user_id: string } | null,
  entity_reference: { authority: string, entity_id: string } | null,
  workspace: {
    key: string,
    lifecycle: string,
    availability: string,
    launchMode: string,
    location: string
  },
  vertical: { key: string },
  permissions: PermissionReference[],
  organization_reference: DomainReference | null,
  professional_reference: DomainReference | null,
  locale: string | null,
  country: string | null,
  correlation_id: string
}
```

El envelope es un artefacto de diseño, no request implementado. Los tokens,
credenciales y PII no forman parte del contexto general. Las referencias son
namespaced; cualquier access token de servicio sería parte de un contrato de
seguridad separado y no se copia como dato.

### Reglas de interpretación

- `user_reference` identifica una cuenta en su propio sistema; no es la
  identidad universal.
- `entity_reference` solo puede ser emitida por Identity Authority cuando una
  relación está resuelta y autorizada. Ausencia no invalida identidad nativa
  de One/Legal.
- Workspace `availability` no es entitlement; el servicio de policy del
  recurso decide.
- `permissions` son de una autoridad definida, scope y audiencia. Nunca
  combinar permisos de One y Legal por unión ingenua.
- `organization_reference` y `professional_reference` apuntan a datos
  mantenidos por sus owners. No revelar más que el mínimo requerido.
- `country` y `locale` no acreditan residencia, ciudadanía, jurisdicción o
  elegibilidad regulatoria.
- `correlation_id` permite auditoría y soporte, no es secreto ni ID de persona.

## 4. Verticales cubiertas

| Vertical | Dominio propio | Contexto que podría necesitar | Estado/condición |
| --- | --- | --- | --- |
| **Legal** | Legal Core conserva IDs de usuario, firmas, organizaciones, tenants y datos jurídicos. | Referencia Legal nativa; workspace/path; permisos emitidos por Legal; organización/firm/tenant según contrato Legal. `entity_reference` solo por linking bilateral aprobado. | Existe bridge frontend `coreLegalContext.js` que normaliza contexto. No demuestra mapping canónico ni autoriza One a leer datos legales. |
| **Medical** | Dominio médico mantiene datos clínicos y permisos clínicos en su owner. | Cuenta/principal validado por Medical, workspace y permisos de Medical; perfil profesional solo con verificación requerida. | Workspace Registry backend declara `medical` como `declared`; el espejo frontend lo marca `preview`/enabled. Reconciliar drift antes de activar/integrar runtime. |
| **Odontología** | Dominio odontológico y datos clínicos/profesionales propios. | Referencias del owner, autorización clínica específica, workspace/lifecycle aprobado. | Key `odontologia` declarada; no se infiere experiencia productiva de la key. |
| **Psicología** | Dominio psicológico y datos sensibles propios. | Referencias del owner, autorización específica, controles reforzados de privacidad, workspace/lifecycle aprobado. | Key `psicologia` declarada; disponibilidad funcional no comprobada por Registry. |
| **Enfermería** | Dominio de enfermería, relaciones clínicas y credenciales propios. | Referencias del owner, permisos y verificación correspondientes, workspace/lifecycle aprobado. | Key `enfermeria` declarada; no se infiere registro o licencia desde One profile. |
| **Futuras verticales** | Cada dominio define entidad, datos, retención, evidencia, permisos y owner. | Solo envelope mínimo, referencia nativa, workspace contract y permisos verificados. | Registrar fuente/contrato, data owner, threat model, privacidad, lifecycle y pruebas antes de conexión. |

No se afirma que las verticales clínicas compartan base, roles, jurisdicción,
credenciales o consentimiento. El hecho de que Medical reúna especialidades
no hace de una subvertical una mera etiqueta de UI: su alcance depende del
owner y de futuras decisiones de producto/compliance.

## 5. Propiedad y responsabilidades

| Elemento | Autoridad |
| --- | --- |
| Cuenta, `users.id`, credenciales y sesiones One | One |
| Identificador y cuenta nativos Legal | Legal Core |
| Persona transversal `entity_id` | Identity System bajo gobierno lógico propuesto de System Core; owner operativo pendiente, readiness blocked |
| Lifecycle, launchMode, location y key de Workspace | Workspace Registry según sus contratos |
| Entitlement/permiso de acción | Policy/servicio que protege el recurso, no el contexto de UI |
| Perfil profesional/credencial | Vertical o entidad acreditadora propietaria |
| Datos clínicos | Dominio clínico autorizado (no One por agregación de contexto) |
| Organización, empresa, firma y tenant | Dominio que los crea y mantiene |

## 6. Seguridad, privacidad y fallos

1. Autenticar origen, audiencia y propósito en cada integración; no confiar en
   un context object suministrado por el navegador.
2. Revalidar permiso y estado en servidor en cada acción sensible.
3. Limitar claims/contexto a IDs namespaced y referencias mínimas; no enviar
   credenciales, datos clínicos ni perfil completo por defecto.
4. Evitar correlación transversal por email/nombre; no hacer linking silencioso.
5. Falla de Identity no debe cerrar login One; los endpoints que requieran
   sujeto canónico continúan con fail-closed conforme al contrato actual.
6. Falla de policy/vertical no debe interpretarse como permiso ni seleccionarse
   una vertical alternativa con mayor acceso.
7. No cachear estado de acceso más allá de una política aprobada; los tiempos
   de expiración y revocación quedan por definir.
8. Auditoría conserva source, actor/servicio, purpose, correlación, decisión y
   referencia; debe minimizar PII y no registrar secretos.

## 7. Fuera de alcance y decisiones pendientes

- Owner operativo de Identity y forma final del `entity_reference`.
- Autenticación entre servicios, protocolo, scopes y credenciales.
- Membership universal y relación workspace/vertical.
- Estado de despliegue de Medical y sus subverticales.
- Ownership, datos y compliance específicos de cada vertical/país.
- Integración de Billing, Darwin IA, agentes y futuras verticales.
- Formato final/versionado del envelope y estrategia de resiliencia.

## Referencias

- [WORKSPACE-USER-CONTEXT-MODEL.md](./WORKSPACE-USER-CONTEXT-MODEL.md)
- [ONE-EVOLUTION-ARCHITECTURE.md](./ONE-EVOLUTION-ARCHITECTURE.md)
- [IDENTITY-AUTHORITY-BOUNDARY.md](./IDENTITY-AUTHORITY-BOUNDARY.md)
- [WORKSPACE-LAUNCH-CONTRACT.md](./WORKSPACE-LAUNCH-CONTRACT.md)
- [WORKSPACE-LOCATION-CONTRACT.md](./WORKSPACE-LOCATION-CONTRACT.md)
