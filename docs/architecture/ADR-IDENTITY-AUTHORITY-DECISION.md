# ADR — Identity Authority Operativa

**Fecha:** 2026-10-03
**Estado:** **PENDIENTE DE APROBACIÓN — BLOCKED**
**Decisión propuesta:** opción C, servicio Identity dedicado bajo el gobierno
lógico de System Core.
**Efecto:** documental. No autoriza escritores, materialización, migraciones ni
cambios de runtime.

## Resumen ejecutivo

`entity_id` está definido contractualmente como identidad canónica transversal
de una persona. System Core es la autoridad lógica propuesta, pero la
implementación existente —servicio, colección `system_identities` y lectura
del Access Bridge— vive actualmente en el backend y la base de One. No se ha
demostrado un servicio System independiente, un owner operativo aprobado ni
un escritor único impuesto por controles operativos.

Se comparan tres alternativas:

- **A. One como autoridad operativa:** menor cambio inmediato, pero acopla
  identidad transversal a un producto y no representa el límite lógico
  propuesto salvo mandato temporal explícito.
- **B. Backend compartido actual:** conserva la ubicación técnica presente,
  pero “compartido” no define owner, separación de permisos o independencia
  operativa. Mantiene una frontera ambigua.
- **C. Servicio Identity dedicado:** hace explícita una frontera multi-sistema,
  siempre gobernada por System Core, con un único escritor y lectores
  autorizados.

La recomendación arquitectónica es **C**. La decisión operativa no se considera
aprobada hasta que el responsable competente acepte owner, operación, recursos,
SLO, seguridad, auditoría, coste y plan de migración. Readiness permanece
**BLOCKED — NOT READY**; no iniciar materialización automática.

## Contexto y realidad observada

1. `backend/services/system_identity.py` genera y valida `entity_id` y dispone
   de operaciones de creación y vinculación.
2. `system_identities` se persiste en la base configurada por One. En el
   snapshot local medido el 2026-10-03 se observaron índices únicos para
   `entity_id` y `(profiles.source, profiles.external_id)`; esto no acredita
   staging/producción ni control de writer.
3. El Access Bridge resuelve el mapping en lectura y falla cerrado si no
   encuentra un `entity_id` válido. No materializa identidades en el flujo
   revisado.
4. `identity_registry.py` declara `punto_cero_system` como owner token emisor;
   los flujos de One crean los `users.id` que aparecen como `external_id`.
   Esta discrepancia de ownership está documentada, no resuelta.
5. No se ha demostrado una instancia Identity System separada del backend One
   ni un proceso de creación garantizado para cada usuario.

## Opciones comparadas

| Opción | Ventajas | Riesgos | Impacto técnico | Impacto en One | Impacto en Legal Core | Impacto en verticales futuras | Impacto multi-país LATAM | Migración futura |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A) One como autoridad operativa** | Reutiliza servicio, base y operación ya presentes; menor coste inicial y sin nueva frontera de red. | Un producto controlaría el identificador transversal; conflicto con autoridad lógica System Core; posible acoplamiento a releases/login One; ambigüedad del token `punto_cero_system`; presión para hacer de One reconciliador de Legal. | Deja escrituras y datos en backend One; exige separar módulos/permisos dentro de ese backend, credenciales de writer, auditoría y mandato de delegación con caducidad explícita. | Aumenta responsabilidad de One desde cuenta/perfil fuente hasta decisiones de identidad transversal; requiere preservar límites de login y datos. | One no puede decidir equivalencia entre cuenta One e identidad Legal. Legal necesitaría un proceso bilateral de evidencia/consentimiento y sin dependencia implícita de One. | Nuevas verticales dependerían de un servicio/owner de producto; riesgo de añadir fuentes y perfiles sin gobernanza System. | Requiere política para IDs, verificación, privacidad y soporte por país; aumenta el riesgo de que reglas del producto One se interpreten como reglas regionales. | Transferir ownership y operación posteriormente al System/servicio dedicado sin writers simultáneos; conservar IDs y links. Requiere delegación temporal, fecha/exit criteria y reconciliación previa. |
| **B) Backend compartido actual** | Evita mover datos inmediatamente; puede permitir que varios consumidores usen el backend y aprovechar el store actual. | “Compartido” no define quién gobierna o opera, cómo se autentican lectores, quién escribe o quién responde por incidentes. Backend/base actuales son de One; la etiqueta compartido puede ocultar el mismo ownership ambiguo. | Mantiene el código y DB actuales; necesita frontera de servicio real, RBAC, credenciales, contratos de acceso y separación de despliegue/responsabilidad. Sin ello, todos los callers con DB pueden potencialmente escribir. | One sigue alojando la operación y asume riesgo de disponibilidad/cambio aun si otros dominios consumen. | Legal dependería de infraestructura gobernada/operada ambiguamente; no puede asumir que el backend One sea su autoridad o su frontera de confianza. | Acceso potencialmente común, pero con dependencia de un backend que no declara un owner System independiente. | Escala técnica compartida no garantiza gobernanza de residencia, privacidad, soporte local ni separación de obligaciones por país. | Formalizar el backend como recurso compartido con owner, controles y SLO o extraerlo después; sin definición, no hay trayectoria segura de cutover ni una autoridad operativa nombrable. |
| **C) Servicio Identity dedicado** | Separa identidad transversal de productos; hace visible el límite de confianza; permite writer único, lectores con permisos mínimos y gobierno multi-sistema. | Mayor coste/latencia y superficie operacional; dependencia de red, necesidad de SLO, disponibilidad, autenticación servicio-a-servicio, gestión de claves y plan de recuperación. Puede convertirse en tercera autoridad si queda fuera del gobierno de System Core. | Nuevo servicio/store o extracción controlada, contratos versionados, seguridad, monitorización, auditoría y operación. Service es executor; System Core conserva gobierno y policy de identidad. | One sigue siendo autoridad de sus cuentas y emisor de `users.id`; actúa como fuente autenticada y consumidor. Debe acreditar referencias sin cambiar login/JWT. | Legal conserva sus IDs y datos; vínculo separado, bilateral y apagado por defecto hasta aprobar fuente/evidencia/legal review. | Cada vertical se integra como source/consumer registrado; obtiene mapping mínimo y no crea una identidad paralela ni convierte profesión en ID canónico. | Permite gobernanza transversal, pero exige revisión de privacidad, residencia/transferencia de datos, localización, soporte y obligaciones por país. El ID opaco no elimina esos requisitos. | Extraer con inventario read-only y reconciliación; congelar escritor previo, verificar store/constraints y cutover a autoridad única; rollback detiene writes sin borrar/reasignar IDs. |

### Impacto por ecosistema

#### One

One conserva la fuente autoritativa de cuenta, credenciales, sesiones, perfil y
`users.id`. La opción C no requiere sustituir el subject JWT ni mover perfiles.
One presentaría una referencia nativa a Identity Authority solamente cuando
una futura política de evidencia lo permita. La lectura actual del Bridge no
se altera en esta decisión.

#### Legal Core

Legal mantiene usuarios/IDs jurídicos, firmas, organizaciones, tenants y datos
legales dentro de su dominio. Ninguna de las opciones autoriza el linking
automático por email, convertir Legal IDs a `entity_id`, cambiar su
autorización o hacer a One propietario de decisiones legales. La integración
sería explícita, gobernada conjuntamente y separada de la primera materialización
de One.

#### Verticales actuales y futuras

Medical, odontología, psicología, enfermería y futuras verticales pueden
necesitar una misma persona transversal con perfiles y credenciales propios.
Identity solo debe guardar el mapping mínimo entre persona y referencias
verificadas, no historia clínica, licencia profesional ni atributos de dominio.
Cada vertical sería fuente de sus IDs y pruebas, sujeto a aprobación de
privacidad, evidencia y permisos. Compartir `entity_id` no comparte acceso a
datos ni acredita licencia, colegiación, rol o autorización profesional.

#### Multi-país LATAM

Un identificador opaco y no derivado de datos personales reduce acoplamiento a
formatos nacionales, pero no determina residencia ni cumplimiento. Antes de
operar en más de un país deben revisarse: base legal/consentimiento,
minimización y retención, residencia/transferencia internacional, derechos de
acceso/corrección/borrado, respuesta a incidentes, evidencia aceptable por
jurisdicción, fuentes de identidad oficiales y operación/soporte regional.
No asumir que un documento, correo verificado o registro profesional tiene el
mismo valor jurídico en todos los países.

## Recomendación final
