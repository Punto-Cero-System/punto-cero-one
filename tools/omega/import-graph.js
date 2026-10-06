// Grafo de imports de frontend/src: archivos huérfanos, modulos solo-por-test,
// imports sin resolver y duplicados exactos por contenido.
//   node tools/omega/import-graph.js
// Escribe test_reports/omega/import-graph.txt (inventario para decision manual;
// no borra código automaticamente).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SRC, REPORTS, rel } = require('./lib/paths');
const { writeReport } = require('./lib/smart-write');

const EXTS = ['.jsx', '.js', '.json', '.css'];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXTS.includes(path.extname(e.name))) files.push(p);
  }
})(SRC);

const isTest = (p) => /\.test\.[jt]sx?$/.test(p) || /[\\/]__tests__[\\/]/.test(p);

function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // paquete externo
  const cands = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))];
  for (const c of cands) {
    try { if (fs.statSync(c).isFile()) return c; } catch (e) { /* no existe */ }
  }
  return null;
}

const IMPORT_RE = /(?:import[\s*{a-zA-Z_$][^;]*?from\s*|import\s*|export\s+[\s*S{a-zA-Z_$][^;]*?from\s*)(['"])([^'"]+)\1|require\(\s*(['"])([^'"]+)\3/g;

// Los comentarios documentan ejemplos de import que no existen en el disco
// (p. ej. "import LoginCardOne from './components/LoginCardOne';" dentro del
// bloque de instrucciones de LoginCardOne.jsx). Se descartan antes de escanear
// para no ensuciar el grafo con rutas falsas. Solo comentarios de bloque y
// líneas enteras de comentario: así no se tocan URLs ni literales.
const sinComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

const edges = new Map();
const importedBy = new Map();
for (const f of files) { importedBy.set(f, new Set()); edges.set(f, new Set()); }

const unresolved = [];
for (const f of files) {
  if (path.extname(f) === '.css') continue;
  const text = sinComentarios(fs.readFileSync(f, 'utf8'));
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[2] || m[4];
    if (!spec) continue;
    const r = resolve(spec, f);
    if (r) { edges.get(f).add(r); importedBy.get(r).add(f); }
    else if (spec.startsWith('.') || spec.startsWith('@/')) unresolved.push(`${rel(f, SRC)} -> ${spec}`);
  }
}

const entries = ['index.js', 'index.css', 'App.js', 'App.css'];
const orphans = files.filter((f) => (
  !isTest(f) && !entries.includes(rel(f, SRC)) && importedBy.get(f).size === 0
));
const testOnly = files.filter((f) => (
  !isTest(f) && !entries.includes(rel(f, SRC)) &&
  importedBy.get(f).size > 0 && [...importedBy.get(f)].every((i) => isTest(i))
));

const byHash = new Map();
for (const f of files) {
  const norm = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  if (norm.length < 60) continue;
  const h = crypto.createHash('sha1').update(norm).digest('hex');
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(rel(f, SRC));
}
const dupExact = [...byHash.values()].filter((v) => v.length > 1);

const out = [
  '=== GRAFO DE IMPORTS · FASE OMEGA ===',
  `generado: ${new Date().toISOString()}`,
  `TOTAL ARCHIVOS: ${files.length}`,
  '',
  `=== IMPORTS SIN RESOLVER (${unresolved.length}) ===`,
  unresolved.join('\n'),
  '',
  `=== ARCHIVOS NO IMPORTADOS POR NADIE (${orphans.length}) ===`,
  orphans.map((f) => `  ${rel(f, SRC)}  [tam=${fs.statSync(f).size}]`).join('\n'),
  '',
  `=== SOLO IMPORTADOS POR TESTS (${testOnly.length}) ===`,
  testOnly.map((f) => `  ${rel(f, SRC)} <- ${[...importedBy.get(f)].map((i) => rel(i, SRC)).join(', ')}`).join('\n'),
  '',
  `=== DUPLICADOS EXACTOS POR CONTENIDO (${dupExact.length} grupos) ===`,
  dupExact.map((g) => '  * ' + g.join('\n    ')).join('\n'),
].join('\n');

const destino = writeReport(path.join(REPORTS, 'import-graph.txt'), out);
console.log(`archivos: ${files.length}`);
console.log(`huérfanos: ${orphans.length}   solo-por-test: ${testOnly.length}   sin-resolver: ${unresolved.length}   duplicados: ${dupExact.length}`);
console.log('reporte: ' + destino);