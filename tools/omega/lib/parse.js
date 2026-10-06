// Parseo AST consistente para todos los escaneres Omega (mismos plugins que CRA).
const { fromFrontend } = require('./paths');

const parser = fromFrontend('@babel/parser');

const PARSE_OPTIONS = {
  sourceType: 'module',
  plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

const parse = (code) => parser.parse(code, PARSE_OPTIONS);

// Visitante recursivo con referencia al nodo padre. Omite metadatos de posicion.
function walk(node, visit, parent) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent || null);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value.type === 'string') walk(value, visit, node);
  }
}

module.exports = { parser, parse, walk, PARSE_OPTIONS };