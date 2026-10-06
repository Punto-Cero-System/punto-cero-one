// Escaneo AST de botones solo-icono sin nombre accesible (WCAG 4.1.2).
//   node tools/omega/a11y-scan.js
// Criterios: <button> sin aria-label / aria-labelledby / title (y sin spread de
// props), sin texto renderizable y con un componente de icono o <svg>.
// Escribe test_reports/omega/a11y.txt y sale con 1 si quedan candidatos.
const path = require('path');
const fs = require('fs');
const { SRC, REPORTS, rel } = require('./lib/paths');
const { parse, walk } = require('./lib/parse');
const { writeReport } = require('./lib/smart-write');

const hasTextChild = (el) => (el.children || []).some((c) => {
  if (c.type === 'JSXText') return c.value.replace(/\s+/g, '') !== '';
  if (c.type === 'JSXExpressionContainer') {
    const e = c.expression;
    if (e.type === 'StringLiteral') return true;
    if (e.type === 'TemplateLiteral' && e.quasis.some((q) => q.value.raw.trim())) return true;
    if (e.type === 'ConditionalExpression') return true;
    if (e.type === 'Identifier' || e.type === 'MemberExpression' || e.type === 'CallExpression') return true;
    return false;
  }
  if (c.type === 'JSXElement') return hasTextChild(c);
  return false;
});

const hasIcon = (el) => (el.children || []).some((c) => {
  if (c.type !== 'JSXElement') return false;
  const nm = c.openingElement.name;
  const name = nm.type === 'JSXIdentifier' ? nm.name : (nm.type === 'JSXMemberExpression' ? nm.property.name : '');
  if (/^svg$/i.test(name)) return true;
  return /^[A-Z]/.test(name);
});

const namedByAttr = (open, names) => open.attributes.some((a) => (
  a.type === 'JSXAttribute' && names.includes(a.name.name)
));

const hits = [];

const revisar = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parse(code); } catch (e) { return; }
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.type === 'JSXElement') {
      const nm = n.openingElement.name;
      if (nm.type === 'JSXIdentifier' && nm.name === 'button') {
        const spread = n.openingElement.attributes.some((a) => a.type !== 'JSXAttribute');
        const named = namedByAttr(n.openingElement, ['aria-label', 'title', 'aria-labelledby']) || spread;
        if (!named && !hasTextChild(n) && hasIcon(n)) {
          const linea = code.slice(0, n.openingElement.start).split('\n').length;
          hits.push({
            file: rel(file, SRC),
            linea,
            snip: code.slice(n.openingElement.start, Math.min(code.length, n.end)).replace(/\s+/g, ' ').slice(0, 190),
          });
        }
      }
    }
    for (const k in n) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') continue;
      visit(n[k]);
    }
  };
  visit(ast.program.body);
};

(function walkDir(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walkDir(f);
    if (!/\.jsx$/.test(e.name) || /\.test\.jsx$/.test(e.name)) return;
    revisar(f);
  });
})(SRC);

const lineas = [
  '=== BOTONES SOLO-ICONO SIN NOMBRE ACCESIBLE · FASE OMEGA ===',
  `generado: ${new Date().toISOString()}`,
  `candidatos: ${hits.length}`,
  '',
];
for (const h of hits) lineas.push(`  ${h.file}:${h.linee}`.replace('linee', String(h.linea)), `      ${h.snip}`);

const destino = writeReport(path.join(REPORTS, 'a11y.txt'), lineas.join('\n'));
console.log(`botones solo-icono sin nombre: ${hits.length}`);
console.log('reporte: ' + destino);
process.exitCode = hits.length > 0 ? 1 : 0;