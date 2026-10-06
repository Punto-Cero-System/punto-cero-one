# FASE OMEGA · Informe de Release Candidate

**Fecha:** 30/09/2026
**Alcance:** `frontend/` (263 archivos `.js`/`.jsx` en `src/`)
**Herramientas:** `tools/omega/` · **Evidencia:** `test_reports/omega/`

## 1. Resultado ejecutivo

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| ESLint (auditoría, `recommended` + `no-undef` + React + hooks) | **0 errores / 0 avisos** en 263 archivos | `test_reports/omega/lint.txt` |
| Accesibilidad (botones solo-icono sin nombre, WCAG 4.1.2) | **0 candidatos** (21 corregidos) | `test_reports/omega/a11y.txt` |
| Suite Jest (craco) | **232/232 pruebas, 23 suites** | `test_reports/omega/tests.log` |
| Build de producción | **Compiled successfully**, 0 avisos (57 s) | `test_reports/omega/build.log` |
| Grafo de imports | 0 rutas sin resolver · 0 duplicados exactos · 67 huérfanos | `test_reports/omega/import-graph.txt` |
| Codificación UTF-8 | Sin caracteres de reemplazo (U+FFFD) en `src/` | ver §5 |

Reproducción completa: `node tools/omega/rc-verify.js --tests --build` → `TODO CORRECTO`.

## 2. Correcciones aplicadas

### 2.1 Bugs latentes de `ReferenceError` (crash en ejecución, no cosmética)

| Archivo | Hallazgo | Arreglo |
| --- | --- | --- |
| `src/system/workspaceRegistryService.js` | `syncVerticalMembership` devolvía `return ecosystem;`, identificador que ya no existe tras el renombrado a `workspaceRegistry` → `ReferenceError` que tumbaba **11 pruebas** | `return workspaceRegistry;` |
| `src/pages/AiPage.jsx:77` | El CTA «Ver todas las herramientas» llamaba a `setCaseFilter('all')` y `setQuery('')`, identificadores **inexistentes** en el componente (copiado de otra pantalla): pulsarlo lanzaba `ReferenceError` | `onClick={() => setCategory(null)}`, coherente con el chip «Todas» de la línea 50 |

El segundo solo apareció al corregir la configuración de auditoría (§2.4): son dos
manifestaciones del mismo punto ciego — referencias a símbolos que ya no existen
tras refactors a medias.

### 2.2 Accesibilidad (21 botones)

Botones cuyo único contenido era un icono (o `<svg>`) sin nombre accesible
recibieron `aria-label` descriptivo. La detección fue por AST con Babel, no por
regex, para no marcar falsos positivos en botones cuyo texto proviene de
`{variable}`, `{t('clave')}` o condicionales, ni en los que propagan props con
spread. Tras el pase, el escáner queda en **0 candidatos** y funciona como
regresión permanente.

### 2.3 Ortografía de comentarios

Se restauraron las tildes perdidas en comentarios de `src/` (≈13 líneas en
7 archivos) y en el tooling nuevo. Cero cambios en cadenas visibles por usuario
o en lógica: el pase se aplicó solo a segmentos de comentario, con límites de
palabra para no corromper formas como «casi».

### 2.4 Lint y configuración de auditoría

- Codemod `no-unused-vars` (simulación previa, re-parseo Babel antes de
  escribir, omite hooks, patrones de array e inicializadores con posibles
  efectos) dejó el árbol en 0 avisos.
- **Corrección clave en `frontend/eslint.audit.config.mjs`:** el bloque `rules`
  propio reemplazaba por completo `js.configs.recommended`, dejando `no-undef`
  apagado en silencio. Ahora se lista `...js.configs.recommended.rules` antes de
  las reglas propias y `no-undef` pasa a `error`. Fue este cambio el que destapó
  el bug de `AiPage.jsx`.

## 3. Herramientas incorporadas (`tools/omega/`)

| Archivo | Propósito |
| --- | --- |
| `rc-verify.js` | Orquestador RC: lint + a11y + grafo (+`--tests`, `--build`) y semáforo en `resumen.txt` |
| `lint-audit.js` | ESLint con la config de auditoría; vuelca reglas y detalle |
| `a11y-scan.js` | Escáner AST de nombre accesible en botones solo-icono |
| `import-graph.js` | Huérfanos, módulos solo-usados-por-tests, rutas sin resolver, duplicados por hash (ignora comentarios) |
| `remove-unused-vars.js` | Codemod `no-unused-vars` (dry-run por defecto, `--write` para aplicar) |
| `lib/paths.js`, `lib/parse.js`, `lib/smart-write.js` | Rutas relativas al repo, parseo Babel común y escritura robusta ante bloqueos de `O_TRUNC` en Windows |
| `README.md` | Uso, salvaguardas y notas de mantenimiento |

No se añadieron dependencias: todo reutiliza `frontend/node_modules`.

## 4. Deuda no bloqueante detectada (para decidir, no borrada)

- **67 archivos no importados por nadie** (`test_reports/omega/import-graph.txt`).
  El grafo es informativo: borrarlos requiere criterio de producto (rutas
  dinámicas, carga perezosa, componentes registrados por nombre). El listado
  incluye tamaños para priorizar.
- **2 módulos importados únicamente por pruebas**: candidatos a consolidar o a
  eliminar junto con sus pruebas.
- **Ruido en consola de Jest**: avisos de deprecación
  `ReactDOMTestUtils.act` → `React.act` (viene de `@testing-library/react`) y
  navegación no implementada de jsdom. No afectan al resultado.
- En `build.log` aparece `DeprecationWarning: fs.F_OK` emitido por dependencias
  bajo Node 24; no es un aviso del compilador de CRA.

## 5. Codificación

`src/` se mantiene en UTF-8 sin BOM y sin U+FFFD. Las utilidades escriben en
UTF-8 (`Buffer.from(text, 'utf8')`) y conservan el final de línea del archivo.

## 6. Criterios de aceptación

1. Lint sin errores ni avisos con reglas reales de alcance de símbolos: **cumplido**.
2. Sin `ReferenceError` conocidos en rutas de usuario auditadas: **cumplido** (2 corregidos).
3. Nombre accesible en controles solo-icono: **cumplido** (0 candidatos).
4. Suite completa en verde: **cumplido** (232/232).
5. Build limpio: **cumplido**.
6. Evidencia versionable dentro del repositorio (`tools/omega/`, `test_reports/omega/`, este informe): **cumplido**.