# Contribuir en Punto Cero One

Gracias por contribuir a **Punto Cero One**, la plataforma fundacional de Punto Cero System. Este documento recoge las reglas de colaboración del repositorio.

## Flujo de trabajo

1. abre un issue describiendo el cambio antes de implementarlo;
2. rama de trabajo a partir de `main` con prefijo de tipo: `feat/…`, `fix/…`, `chore/…`, `docs/…`;
3. pull request al `main` con descripción clara del **qué** y el **por qué**.

## Convenciones de commits

El historial usa convención de tipos con alcance, en inglés o español según el área:

- `feat(…)` — funcionalidad nueva
- `fix(…)` — corrección
- `chore(…)` — mantenimiento (limpieza, tooling, consolidación)
- `docs(…)` — documentación

Ejemplos reales del historial: `feat(identity): release universal login core integration`, `chore(m1): consolidate repository cleanup`.

## Reglas del código

- **No romper contratos**: las rutas `/api/*`, modelos, servicios, autenticación JWT y RBAC son estables; cualquier cambio sobre ellos requiere actualización del contrato en `docs/architecture/` y aprobación explícita.
- **Integración con System Core**: los puentes (`coreLegalAdapter`, `workspaceBridge`, `accessBridge*`, `identity_core`) se modifican solo con el equipo Core informado.
- **Configuración**: nunca subir `.env`, credenciales ni tokens; usa siempre los `.env.example` como plantilla. Los secretos viven fuera del repositorio.
- **Datos**: `data/uploads/` contiene contenido de usuarios; no editar manualmente.

## Pruebas

Ejecuta las suites antes de abrir el PR:

```bash
cd backend  && pytest        # pytest -n 2 --dist loadscope (ver backend/pytest.ini)
cd frontend && npm test      # Jest vía craco
```

Un PR debe llegar con suites verdes y sin regresiones en build (`npm run build`).

## Documentación

- cambios de producto → actualiza `memory/CHANGELOG.md`;
- cambios de arquitectura/contratos → actualiza `docs/architecture/`;
- decisiones de gobierno (identidad, acceso, despliegue) → `docs/governance/`.

## Licencia

Al contribuir aceptas la [LICENSE](./LICENSE) MIT del proyecto (© 2026 Punto Cero System).
