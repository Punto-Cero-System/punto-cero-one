// Codemod no-unused-vars sobre frontend/src (Herramienta Omega Etapa 3).
//   node tools/omega/remove-unused-vars.js            -> simulacion (por defecto)
//   node tools/omega/remove-unused-vars.js --write    -> aplica los cambios
// Seguro por disenio: no borra initializers con posibles efectos (Call/New),
// omite hooks y patrones de array, convierte catch (e) sin uso en catch, y
// re-parsea el resultado antes de escribir.
const fs = require('fs');
const { FRONTEND, AUDIT_CONFIG, fromFrontend, rel } = require('./lib/paths');
const { parse, walk } = require('./lib/parse');
const { smartWrite } = require('./lib/smart-write');

const WRITE = process.argv.includes('--write');
const NL = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const { ESLint } = fromFrontend('eslint');

const SAFE = ['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral', 'BigIntLiteral',
  'RegExpLiteral', 'TemplateLiteral', 'ObjectExpression', 'ArrayExpression', 'ArrowFunctionExpression',
  'FunctionExpression', 'Identifier', 'JSXElement', 'JSXFragment', 'UnaryExpression', 'BinaryExpression',
  'LogicalExpression', 'ConditionalExpression', 'MemberExpression', 'ThisExpression', 'OptionalMemberExpression'];
const safeInit = (i) => !i || SAFE.includes(i.type);

// Extiende el rango a toda la línea si alrededor solo queda espacio o punto y coma.
function lineRange(src, start, end) {
  let s = start;
  while (s > 0 && src[s - 1] !== NL) s--;
  let e = end;
  while (e < src.length && (src[e] === ' ' || src[e] === TAB || src[e] === ';')) e++;
  if (src.slice(s, start).trim() === '' && src.slice(end, e).trim() === '') {
    if (src[e] === NL) e++;
    return [s, e];
  }
  return [start, end];
}

// Reescribe las líneas de import resultantes y colapsa saltos triples. Sin regex.
function tidy(text) {
  const kept = [];
  for (const ln of text.split(NL)) {
    const t = ln.trim();
    if (t.startsWith('import')) {
      if (t.includes('{') && t.includes('}')) {
        const a = ln.indexOf('{');
        const b = ln.lastIndexOf('}');
        const parts = ln.slice(a + 1, b).split(',').map((x) => x.trim()).filter(Boolean);
        if (!parts.length) continue;
        kept.push((ln.slice(0, a) + '{ ' + parts.join(', ') + ' }' + ln.slice(b + 1)).trimEnd());
        continue;
      }
      let after = t.slice(6).trim();
      if (after.startsWith(',')) after = after.slice(1).trim();
      if (after === '' || after.startsWith('from')) continue;
      kept.push(ln.slice(0, ln.length - t.length) + 'import ' + after);
      continue;
    }
    kept.push(ln.trimEnd());
  }
  let out = kept.join(NL);
  while (out.indexOf(NL + NL + NL) >= 0) out = out.split(NL + NL + NL).join(NL + NL);
  if (!out.endsWith(NL)) out += NL;
  return out;
}

const QUOTE = String.fromCharCode(39);
const varName = (msg) => {
  const t = msg.message;
  if (t[0] !== QUOTE) return null;
  const j = t.indexOf(QUOTE, 1);
  return j > 0 ? t.slice(1, j) : null;
};

(async () => {
  const eslint = new ESLint({
    cwd: FRONTEND,
    overrideConfigFile: AUDIT_CONFIG,
  });
  const results = await eslint.lintFiles(['src']);
  const done = {};
  const skip = {};
  const skipAdd = (k) => { skip[k] = (skip[k] || 0) + 1; };

  for (const r of results) {
    const msgs = r.messages.filter((m) => m.ruleId === 'no-unused-vars');
    if (!msgs.length) continue;
    const src = fs.readFileSync(r.filePath, 'utf8');
    let ast;
    try { ast = parse(src); } catch (e) { skipAdd('no-parsea'); continue; }

    const imports = [];
    const decls = [];
    const groups = [];
    const catches = [];
    walk(ast, (n) => {
      if (n.type === 'ImportDeclaration') imports.push(n);
      else if (n.type === 'VariableDeclarator') decls.push(n);
      else if (n.type === 'VariableDeclaration') groups.push(n);
      else if (n.type === 'CatchClause') catches.push(n);
    });

    const edits = [];
    const deadImp = new Map();

    for (const m of msgs) {
      const name = varName(m);
      if (!name) { skipAdd('sin-nombre'); continue; }

      const imp = imports.find((s) => (s.specifiers || []).some((sp) => sp.local && sp.local.name === name));
      if (imp) {
        const set = deadImp.get(imp) || new Set();
        set.add(name);
        deadImp.set(imp, set);
        continue;
      }

      const cc = catches.find((c) => c.param && c.param.type === 'Identifier' && c.param.name === name);
      if (cc) { edits.push([[cc.param.start - 1, cc.param.end + 1], '']); continue; }

      const vd = decls.find((d) => d.id && ((d.id.type === 'Identifier' && d.id.name === name) ||
        (d.id.type === 'ObjectPattern' && (d.id.properties || []).some((p) => p.value && p.value.name === name))));
      if (vd) {
        if (vd.id.type === 'ArrayPattern') { skipAdd('patron-array'); continue; }
        const initTxt = vd.init ? src.slice(vd.init.start, vd.init.end) : '';
        const callee = initTxt.split('(')[0].trim();
        if (callee.startsWith('use') && callee.length > 3 && callee[3] !== callee[3].toLowerCase()) { skipAdd('hook'); continue; }
        if (!safeInit(vd.init)) { skipAdd('initializer-con-posible-efecto'); continue; }
        if (vd.id.type === 'ObjectPattern') {
          const p = vd.id.properties.find((pp) => pp.value && pp.value.name === name);
          edits.push([[p.start, p.end], '']);
        } else {
          const grp = groups.find((g) => g.declarations.includes(vd));
          if (!grp) { skipAdd('sin-declaracion'); continue; }
          if (grp.declarations.length > 1) edits.push([[vd.start, vd.end], '']);
          else edits.push([lineRange(src, grp.start, grp.end), '']);
        }
        continue;
      }
      skipAdd('no-localizado-en-AST');
    }

    // Reconstruye los imports con especificadores eliminados (una sola vez por sentencia).
    for (const [imp, names] of deadImp) {
      const keep = imp.specifiers.filter((sp) => !names.has(sp.local.name));
      if (!keep.length) { edits.push([lineRange(src, imp.start, imp.end), '']); continue; }
      const head = keep.filter((sp) => sp.type !== 'ImportSpecifier').map((sp) => src.slice(sp.start, sp.end));
      const named = keep.filter((sp) => sp.type === 'ImportSpecifier').map((sp) => src.slice(sp.start, sp.end));
      const parts = named.length ? head.concat('{ ' + named.join(', ') + ' }') : head;
      edits.push([[imp.start, imp.end], 'import ' + parts.join(', ') + ' from ' + src.slice(imp.source.start, imp.source.end) + ';']);
    }

    if (!edits.length) continue;
    const byRange = new Map();
    for (const [rg, txt] of edits) byRange.set(rg[0] + ':' + rg[1], [rg, txt]);
    const uniq = [...byRange.values()].sort((a, b) => b[0][0] - a[0][0]);
    let out = src;
    for (const [[s, e], txt] of uniq) out = out.slice(0, s) + txt + out.slice(e);
    out = tidy(out);
    try {
      parse(out);
    } catch (err) {
      console.log('  ABORT post-parse ' + rel(r.filePath, FRONTEND) + ': ' + err.message);
      skipAdd('post-parse-fallo');
      continue;
    }
    done[r.filePath] = uniq.length;
    if (WRITE) smartWrite(r.filePath, out);
  }

  let tot = 0;
  for (const v of Object.values(done)) tot += v;
  console.log((WRITE ? 'APLICADO' : 'SIMULACIÓN') + ': ' + tot + ' ediciones en ' + Object.keys(done).length + ' archivos');
  for (const [f, n] of Object.entries(done)) console.log('   ' + String(n).padStart(2) + '  ' + rel(f, FRONTEND));
  console.log('--- OMISIONES (requieren revision manual) ---');
  for (const [k, v] of Object.entries(skip).sort((a, b) => b[1] - a[1])) console.log('   ' + String(v).padStart(2) + '  ' + k);
})().catch((e) => {
  console.error('FALLO:', e && e.stack ? e.stack : e);
  process.exit(1);
});