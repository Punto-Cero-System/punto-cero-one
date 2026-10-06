// Auditoria ESLint de Fase Omega sobre frontend/src.
//   node tools/omega/lint-audit.js
// Usa frontend/eslint.audit.config.mjs (config plana, ESLint 9) y escribe
// test_reports/omega/lint.txt. Sale con código 1 si queda algun error.
const path = require('path');
const { FRONTEND, AUDIT_CONFIG, REPORTS, fromFrontend } = require('./lib/paths');
const { writeReport } = require('./lib/smart-write');

const { ESLint } = fromFrontend('eslint');

(async () => {
  const eslint = new ESLint({
    cwd: FRONTEND,
    overrideConfigFile: AUDIT_CONFIG,
  });

  const results = await eslint.lintFiles(['src']);
  const formatter = await eslint.loadFormatter('stylish');
  const body = await formatter.format(results);

  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    errors += r.errorCount;
    warnings += r.warningCount;
  }

  const conteo = {};
  for (const r of results) {
    for (const m of r.messages) {
      const k = m.ruleId || 'error-de-parseo';
      conteo[k] = (conteo[k] || 0) + 1;
    }
  }

  const reglas = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`)
    .join('\n') || '  (sin incidencias)';

  const header = [
    '=== AUDITORIA ESLINT · FASE OMEGA ===',
    `generado: ${new Date().toISOString()}`,
    `archivos analizados: ${results.length}`,
    `archivos con incidencias: ${results.filter((r) => r.messages.length > 0).length}`,
    `ERRORES: ${errors}   AVISOS: ${warnings}`,
    '',
    '--- reglas detectadas ---',
    reglas,
    '',
    '--- detalle ---',
    '',
  ].join('\n');

  const destino = writeReport(path.join(REPORTS, 'lint.txt'), header + body);
  console.log(`archivos analizados: ${results.length}`);
  console.log(`ERRORES: ${errors}   AVISOS: ${warnings}`);
  console.log('reporte: ' + destino);
  process.exitCode = errors > 0 ? 1 : 0;
})().catch((e) => {
  console.error('FALLO:', e && e.stack ? e.stack : e);
  process.exit(1);
});