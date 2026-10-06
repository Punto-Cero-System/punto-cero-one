// Rutas canonicas del tooling Omega. Todo se resuelve relativo al repositorio,
// de modo que las herramientas funcionan desde cualquier directorio de trabajo.
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FRONTEND = path.join(ROOT, 'frontend');
const SRC = path.join(FRONTEND, 'src');
const REPORTS = path.join(ROOT, 'test_reports', 'omega');
const AUDIT_CONFIG = path.join(FRONTEND, 'eslint.audit.config.mjs');

// Dependencias del frontend (eslint, @babel/parser, plugins) residen ahi.
const fromFrontend = (name) => require(path.join(FRONTEND, 'node_modules', name));

const rel = (p, base) => path.relative(base || ROOT, p).split(path.sep).join('/');

module.exports = { ROOT, FRONTEND, SRC, REPORTS, AUDIT_CONFIG, fromFrontend, rel };