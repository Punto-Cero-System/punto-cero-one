# Herramientas Fase Omega (`tools/omega`)

Utilidades de auditoría y limpieza técnico-arquitectónica para `frontend/src`.
Todas resuelven sus rutas respecto al repositorio, así que funcionan desde
cualquier directorio de trabajo y reutilizan las dependencias ya instaladas en
`frontend/node_modules` (ESLint 9, `@babel/parser`). No añaden dependencias.

## Uso

| Comando | Qué hace | Evidencia |
| --- | --- | --- |
| `node tools/omega/rc-verify.js` | Verificación rápida: lint + a11y + grafo de imports | `test_reports/omega/*` |
| `node tools/omega/rc-verify.js --tests --build` | Lo anterior más Jest y build de producción | `test_reports/omega/*` |
| `node tools/omega/lint-audit.js` | ESLint con `frontend/eslint.audit.config.mjs` (reglas `recommended` + `no-undef` + React + hooks) | `test_reports/omega/lint.txt` |
| `node tools/omega/a11y-scan.js` | Botones solo-icono sin nombre accesible (WCAG 4.1.2) | `test_reports/omega/a11y.txt` |
| `node tools/omega/import-graph.js` | Huérfanos, módulos solo-usados-por-tests, imports sin resolver y duplicados exactos | `test_reports/omega/import-graph.txt` |
| `node tools/omega/remove-unused-vars.js` | Codemod `no-unused-vars` (simulación por defecto; `--write` aplica) | consola |

Códigos de salida: `0` sin incidencias, `1` con errores o hallos. `rc-verify`
escribe además `test_reports/omega/resumen.txt` con el semáforo de cada paso.

## Salvaguardas del codemod

`remove-unused-vars.js` está diseñado para no cambiar comportamiento:

- Simulación por defecto: solo escribe con `--write`.
- No elimina inicializadores con posibles efectos de efecto secundario
  (`CallExpression` / `NewExpression`), hooks ni patrones de desestructuración
  de array; esas omisiones se listan al final para revisión manual.
- Reconstruye las sentencias `import` afectadas y colapsa líneas en blanco.
- Re-parsea el resultado con Babel antes de escribir; si algo no parsea, aborta
  ese archivo (`post-parse-fallo`) en lugar de escribir código roto.

## Notas de mantenimiento

- `frontend/eslint.audit.config.mjs` es configuración de auditoría: **no** forma
  parte del build (CRA/craco conserva su propio ESLint). Debe listarse
  `...js.configs.recommended.rules` antes de las reglas propias; si se
  reemplaza el bloque `rules`, reglas como `no-undef` se apagan en silencio y
  bugs de `ReferenceError` pasan desapercibidos (así ocurrió en la auditoría
  previa con `workspaceRegistryService.js` y `AiPage.jsx`).
- `lib/smart-write.js` evita bloqueos de escritura en Windows (`O_TRUNC` sobre
  archivos mapeados por indexadores o antivirus) mediante reintento con
  `r+`, `ftruncate` o recreación del archivo.
- El grafo de imports es informativo: **no borra código**. Decidir qué hacer
  con los huérfanos requiere criterio de producto (rutas dinámicas, perezosos,
  componentes registrados por nombre, etc.).