// Verificacion integral de release candidate (Fase Omega).
//   node tools/omega/rc-verify.js            -> estaticos (lint, a11y, grafo)
//   node tools/omega/rc-verify.js --tests    -> anade la suite Jest
//   node tools/omega/rc-verify.js --build    -> anade el build de produccion
// Cada paso deja su evidencia en test_reports/omega/ y se resume en resumen.txt.
const { spawnSync } = require('child_process');
const path = require('path');
const { ROOT, FRONTEND, REPORTS } = require('./lib/paths');
const { writeReport } = require('./lib/smart-write');

const NODE = process.execPath;
// Se invoca craco con node directamente: en Node >=20 lanzar un .cmd sin shell
// falla con EINVAL, y npx añade ruido y latencia.
const CRACO = path.join(FRONTEND, 'node_modules', '@craco', 'craco', 'dist', 'bin', 'craco.js');
const paso = (nombre, bin, args, cwd, env) => {
  const t0 = Date.now();
  const r = spawnSync(bin, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(env || {}) },
  });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  const archivo = path.join(REPORTS, `${nombre}.log`);
  writeReport(archivo, salida || '(sin salida)');
  const ok = r.status === 0;
  console.log(`${ok ? 'OK  ' : 'FALLO'}  ${nombre}  (${((Date.now() - t0) / 1000).toFixed(1)}s)  ${archivo}`);
  return { nombre, ok, salida };
};

const pasos = [
  { nombre: 'lint', bin: NODE, args: [path.join(__dirname, 'lint-audit.js')], cwd: ROOT },
  { nombre: 'a11y', bin: NODE, args: [path.join(__dirname, 'a11y-scan.js')], cwd: ROOT },
  { nombre: 'import-graph', bin: NODE, args: [path.join(__dirname, 'import-graph.js')], cwd: ROOT },
];

if (process.argv.includes('--tests')) {
  pasos.push({
    nombre: 'tests',
    bin: NODE,
    args: [CRACO, 'test', '--watchAll=false'],
    cwd: FRONTEND,
    env: { CI: 'true' },
  });
}
if (process.argv.includes('--build')) {
  pasos.push({
    nombre: 'build',
    bin: NODE,
    args: [CRACO, 'build'],
    cwd: FRONTEND,
  });
}

const resultados = [];
for (const p of pasos) resultados.push(paso(p.nombre, p.bin, p.args, p.cwd));

const lineas = [
  '=== VERIFICACION DE RELEASE CANDIDATE · FASE OMEGA ===',
  `generado: ${new Date().toISOString()}`,
  `comando: node tools/omega/rc-verify.js ${process.argv.slice(2).join(' ')}`.trim(),
  '',
  ...resultados.map((r) => `  ${r.ok ? 'OK   ' : 'FALLO'}  ${r.nombre}`),
  '',
  'Evidencia detallada en test_reports/omega/: lint.txt, a11y.txt, import-graph.txt',
  '(informes de las herramientas) y lint.log, a11y.log, import-graph.log, tests.log,',
  'build.log (salida de consola de cada paso).',
];
const resumen = writeReport(path.join(REPORTS, 'resumen.txt'), lineas.join('\n'));
console.log('');
console.log(resumen);

const fallidos = resultados.filter((r) => !r.ok).map((r) => r.nombre);
if (fallidos.length) {
  console.log('PASOS CON HALLO O FALLO: ' + fallidos.join(', '));
  process.exitCode = 1;
} else {
  console.log('TODO CORRECTO');
}