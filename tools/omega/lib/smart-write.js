// Escritor robusto: algunos archivos no admiten truncado (O_TRUNC) porque otro
// proceso los tiene mapeados en memoria (editores, indexadores, antivirus).
// Estrategias en orden:
//   1) writeFileSync normal            -> vale para casi todos
//   2) open('r+') + write              -> si el contenido nuevo es MAS largo
//   3) open('r+') + write + ftruncate  -> si es MAS corto y ftruncate es permitido
//   4) unlink + writeFileSync          -> último recurso (modo 'recreate')
const fs = require('fs');

function smartWrite(file, text) {
  const before = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const buf = Buffer.from(text, 'utf8');
  try {
    fs.writeFileSync(file, buf);
    return { ok: true, mode: 'write', before, after: fs.statSync(file).size };
  } catch (e) {
    if (e.code !== 'UNKNOWN' && e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
  }
  let fd;
  try {
    fd = fs.openSync(file, 'r+');
    fs.writeSync(fd, buf, 0, buf.length, 0);
    if (buf.length < before) {
      try {
        fs.ftruncateSync(fd, buf.length);
        return { ok: true, mode: 'ftruncate', before, after: buf.length };
      } catch (e2) {
        try { fs.closeSync(fd); fd = undefined; } catch (e3) { /* ya cerrado */ }
        fs.unlinkSync(file);
        fs.writeFileSync(file, buf);
        return { ok: true, mode: 'recreate', before, after: fs.statSync(file).size };
      }
    }
    return { ok: true, mode: 'rewrite', before, after: fs.fstatSync(fd).size };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Escritura simple para reportes: crea la carpeta si falta.
function writeReport(file, text) {
  fs.mkdirSync(require('path').dirname(file), { recursive: true });
  smartWrite(file, text.endsWith('\n') ? text : text + '\n');
  return file;
}

module.exports = { smartWrite, writeReport };