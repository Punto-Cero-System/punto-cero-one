"""
OMEGA FASE B1 — `entity_type="group"` en el Social Graph.

Verifica que un grupo es una entidad seguible del grafo unificado, sin
colecciones, contadores ni migraciones nuevas. Cubre los 7 casos pedidos:

  1. Follow grupo público            5. Miembro puede seguir privado
  2. Unfollow grupo                  6. Otros entity_type siguen funcionando
  3. Doble follow no duplica         7. No rompe company/user/event follows
  4. No autorizado no sigue privado

Invariantes del contrato (SOCIAL_GRAPH_CONTRACT v1):
  * `follows` es la fuente de verdad: no se escribe ningún contador en `groups`
  * idempotencia: una relación por (user, entity_type, entity_id)
  * actor correcto: `user_id` es quien llama, nunca otro
  * privacidad: seguir no puede dar más acceso que leer

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# Este test imprime su propio informe, así que acaba con frecuencia en una
# tubería, en un log o en la salida de CI. Allí el códec por defecto puede ser
# cp1252 (Windows) y un simple "→" aborta la ejecución con UnicodeEncodeError,
# perdiendo el resultado. Se fija UTF-8 con reemplazo para que el informe
# sea legible siempre y el código de salida signifique algo.
try:  # pragma: no cover - depende del interprete y de la consola
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

from fastapi import HTTPException  # noqa: E402
from routes import follows_routes as fr  # noqa: E402

FAILURES = []
GROUP = "g_ventas"
PRIV = "g_privada"


def check(label, actual, expected):
    good = actual == expected
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {actual!r}")
    if not good:
        FAILURES.append(f"{label}: {actual!r} != {expected!r}")


def ok(label, condition, detail=""):
    passed = bool(condition)
    print(f"  {'PASS' if passed else 'FAIL'}  {label} {detail}")
    if not passed:
        FAILURES.append(f"{label} {detail}")


def section(title):
    print(f"\n{title}")


def raises(label, fn, status):
    try:
        fn()
    except HTTPException as e:
        good = e.status_code == status
        print(f"  {'PASS' if good else 'FAIL'}  {label}: {e.status_code} "
              f"(esperado {status})")
        if not good:
            FAILURES.append(f"{label}: {e.status_code} != {status}")
    except Exception as e:
        print(f"  FAIL  {label}: otra excepción {type(e).__name__}")
        FAILURES.append(f"{label}: {type(e).__name__}")
    else:
        print(f"  FAIL  {label}: NO lanzó")
        FAILURES.append(f"{label}: no lanzó")


# --- doble de Mongo --------------------------------------------------------
class _Upsert:
    def __init__(self, inserted):
        self.upserted_id = "OID" if inserted else None


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.updates = []

    @staticmethod
    def _match(doc, q):
        for k, v in (q or {}).items():
            actual = doc.get(k)
            if isinstance(v, dict):
                if "$ne" in v and actual == v["$ne"]:
                    return False
                if "$in" in v and actual not in v["$in"]:
                    return False
            elif actual != v:
                return False
        return True

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find(self, q=None, proj=None):
        return _Cursor([copy.deepcopy(d) for d in self.docs
                        if self._match(d, q)])

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q)])

    async def update_one(self, q, update, upsert=False):
        self.updates.append((q, update))
        if not self._match_documents(q):
            if not upsert:
                return _Upsert(False)
            doc = copy.deepcopy(update["$setOnInsert"])
            self.docs.append(doc)
            return _Upsert(True)
        for d in self.docs:
            if self._match(d, q):
                d.update(update.get("$set", {}))
                d.update(update.get("$inc", {}))
        return _Upsert(False)

    def _match_documents(self, q):
        return any(self._match(d, q) for d in self.docs)

    async def delete_one(self, q):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not self._match(d, q)]
        return type("D", (), {"deleted_count": before - len(self.docs)})()


class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._i >= len(self._rows):
            raise StopAsyncIteration
        r = self._rows[self._i]
        self._i += 1
        return r


class FakeDB:
    def __init__(self, groups=None, members=None, follows=None):
        self.groups = _Collection(groups or [
            {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_admin"},
            {"id": PRIV, "name": "Clave", "privacy": "private", "admin_id": "usr_admin"},
        ])
        self.group_members = _Collection(members or [])
        self.follows = _Collection(follows or [])
        self.company_follows = _Collection([])
        self.companies = _Collection([
            {"id": "co_1", "name": "Acme", "owner_id": "usr_dueno",
             "followers_count": 0},
        ])
        self.notifications = _Collection([])
        self.users = _Collection([])


def make_request(db):
    return type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()


def follow(db, entity_type, entity_id, user_id):
    return asyncio.run(fr.follow(entity_type, entity_id, make_request(db),
                                 {"id": user_id, "name": "U", "role": "user"}))


def unfollow(db, entity_type, entity_id, user_id):
    return asyncio.run(fr.unfollow(entity_type, entity_id, make_request(db),
                                   {"id": user_id, "name": "U", "role": "user"}))


def rel(db, entity_type, entity_id, user_id):
    return next((d for d in db.follows.docs
                 if d["user_id"] == user_id and d["entity_type"] == entity_type
                 and d["entity_id"] == entity_id), None)


section("0. 'group' es un entity_type válido")
ok("group en VALID_TYPES", "group" in fr.VALID_TYPES)
check("7 entity_type soportados", len(fr.VALID_TYPES), 7)
check("los 6 previos siguen ahí",
      sorted(fr.VALID_TYPES - {"group"}),
      ["company", "country", "event", "hashtag", "user", "vertical"])

section("1. Follow grupo público")
db = FakeDB()
r = follow(db, "group", GROUP, "usr_ana")
check("ok=True", r["ok"], True)
check("my_following=True", r["my_following"], True)
check("count derivado en la respuesta", r["count"], 1)
check("una relación en follows", len(db.follows.docs), 1)
d = rel(db, "group", GROUP, "usr_ana")
check("actor correcto (user_id)", d["user_id"], "usr_ana")
check("entity_type", d["entity_type"], "group")
check("entity_id normalizado", d["entity_id"], GROUP)
ok("created_at ISO", isinstance(d["created_at"], str) and "T" in d["created_at"])
ok("NO se escribe contador en groups", not any(
    "followers_count" in str(u[1]) for u in db.groups.updates))
ok("groups intacto (sin followers_count)", all(
    "followers_count" not in g for g in db.groups.docs))
count = asyncio.run(fr.entity_count("group", GROUP, make_request(db)))
check("count derivado de follows", count["count"], 1)

section("2. Unfollow grupo")
r2 = unfollow(db, "group", GROUP, "usr_ana")
check("my_following=False", r2["my_following"], False)
check("count baja a 0", r2["count"], 0)
check("relación eliminada", rel(db, "group", GROUP, "usr_ana"), None)
check("follows vacío", len(db.follows.docs), 0)
r3 = unfollow(db, "group", GROUP, "usr_ana")
check("unfollow repetido es idempotente", r3["my_following"], False)

section("3. Doble follow no duplica")
db3 = FakeDB()
follow(db3, "group", GROUP, "usr_ana")
follow(db3, "group", GROUP, "usr_ana")
follow(db3, "group", GROUP, "usr_ana")
check("una sola relación", len(db3.follows.docs), 1)
c3 = asyncio.run(fr.entity_count("group", GROUP, make_request(db3)))
check("contador sigue en 1", c3["count"], 1)
# Dos usuarios distintos -> dos relaciones
follow(db3, "group", GROUP, "usr_bo")
check("otro usuario sí añade la suya", len(db3.follows.docs), 2)
c3b = asyncio.run(fr.entity_count("group", GROUP, make_request(db3)))
check("count = 2", c3b["count"], 2)

section("4. Usuario NO autorizado no sigue un grupo privado")
mem_priv = [{"group_id": PRIV, "user_id": "usr_miembro", "role": "member"},
            {"group_id": PRIV, "user_id": "usr_adminmem", "role": "admin"}]
db4 = FakeDB(members=mem_priv)
raises("externo → 403", lambda: follow(db4, "group", PRIV, "usr_externo"), 403)
check("no se creó ninguna relación", rel(db4, "group", PRIV, "usr_externo"), None)
ok("sigue having 0 follows de grupo",
   len([d for d in db4.follows.docs if d["entity_type"] == "group"]) == 0)
raises("grupo inexistente → 404",
       lambda: follow(db4, "group", "g_fantasma", "usr_miembro"), 404)

section("5. Miembro / admin SÍ pueden seguir un grupo privado")
r5 = follow(db4, "group", PRIV, "usr_miembro")
check("miembro sigue", r5["my_following"], True)
# admin de plataforma (role='admin')
db4b = FakeDB(members=mem_priv)
r5b = asyncio.run(fr.follow("group", PRIV, make_request(db4b),
                            {"id": "usr_plat", "name": "P", "role": "admin"}))
check("admin de plataforma sigue privado", r5b["my_following"], True)
# admin_id del grupo (sin estar en members)
r5c = follow(db4b, "group", PRIV, "usr_admin")
check("admin_id del grupo sigue", r5c["my_following"], True)
# admin por role en group_members
r5d = follow(db4b, "group", PRIV, "usr_adminmem")
check("admin por role sigue", r5d["my_following"], True)
raises("externo sigue sin acceso",
       lambda: follow(db4b, "group", PRIV, "usr_externo"), 403)
c5 = asyncio.run(fr.entity_count("group", PRIV, make_request(db4b)))
check("count del privado = 3", c5["count"], 3)

section("6. Otros entity_type siguen funcionando")
db6 = FakeDB()
follow(db6, "user", "usr_bo", "usr_ana")
follow(db6, "event", "ev_1", "usr_ana")
follow(db6, "hashtag", "#Ventas", "usr_ana")
follow(db6, "country", "AR", "usr_ana")
check("4 relaciones", len(db6.follows.docs), 4)
check("hashtag normalizado (lowercase, sin #)",
      rel(db6, "hashtag", "ventas", "usr_ana") is not None, True)
check("country normalizado", rel(db6, "country", "ar", "usr_ana") is not None, True)
check("user sin normalizar", rel(db6, "user", "usr_bo", "usr_ana") is not None, True)
raises("auto-follow sigue bloqueado",
       lambda: follow(db6, "user", "usr_ana", "usr_ana"), 400)
raises("entity_type inválido sigue rechazado",
       lambda: follow(db6, "planeta", "x_1", "usr_ana"), 400)
me = asyncio.run(fr.my_follows(make_request(db6), {"id": "usr_ana", "name": "A"}))
check("my_follows agrupa por tipo", sorted(k for k, v in me["follows"].items() if v),
      ["country", "event", "hashtag", "user"])
check("group aparece vacío (sin follows de grupo)", me["follows"]["group"], [])

section("7. No rompe company/user/event follows (contadores y puente)")
db7 = FakeDB()
r7 = follow(db7, "company", "co_1", "usr_ana")
check("company followed", r7["my_following"], True)
check("puente company_follows escrito", len(db7.company_follows.docs), 1)
check("contador de empresa incrementado", db7.companies.docs[0]["followers_count"], 1)
r7b = follow(db7, "company", "co_1", "usr_ana")
check("segundo follow de company no re-incrementa",
      db7.companies.docs[0]["followers_count"], 1)
check("ni duplica el puente", len(db7.company_follows.docs), 1)
# un follow de grupo NO toca el puente de company
follow(db7, "group", GROUP, "usr_bo")
check("follow de grupo no toca company_follows", len(db7.company_follows.docs), 1)
check("ni el contador de empresa", db7.companies.docs[0]["followers_count"], 1)
# y no al revés
r7c = follow(db7, "user", "usr_x", "usr_bo")
ok("follow de user no toca contadores de empresa",
   db7.companies.docs[0]["followers_count"] == 1)

section("8. Contrato: sin contadores, sin colecciones, sin migraciones")
import ast  # noqa: E402
src = (BACKEND / "routes" / "follows_routes.py").read_text(encoding="utf-8")
tree = ast.parse(src)
# Se descarta el docstring del módulo: el término "group_followers_count"
# aparece ahí A PROPÓSITO, en la frase que explica que no se crea. Buscarlo en
# el texto plano daría un falso positivo; lo que importa es el código.
if (tree.body and isinstance(tree.body[0], ast.Expr)
        and isinstance(tree.body[0].value, ast.Constant)):
    tree.body = tree.body[1:]
code = ast.unparse(tree)
ok("group_followers_count no aparece en el código", "group_followers_count" not in code)
# Las comprobaciones de abajo son ESTRUCTURALES (AST), no textuales: el estilo
# de comillas, el formato y el orden de líneas no las afectan. Un grep sobre el
# texto —incluso sobre ast.unparse, que normaliza a comillas simples— daría
# falsos negativos según cómo esté escrito el archivo, y un `grep` plano daría
# falsos positivos con lo que solo se menciona en comentarios (p. ej. la nota
# sobre `follower_count` que hay en el puente de companies).


def _const(node):
    """Valor de una constante de cadena, sea cual sea el estilo de comillas."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _is_entity_type(node, value):
    """True si `node` es (o contiene) la comparación `entity_type == <value>`."""
    if isinstance(node, ast.UnaryOp):      # `not entity_type == ...`
        return False
    if isinstance(node, ast.Compare):
        return (len(node.ops) == 1 and isinstance(node.ops[0], ast.Eq)
                and isinstance(node.left, ast.Name) and node.left.id == "entity_type"
                and _const(node.comparators[0]) == value)
    if isinstance(node, ast.BoolOp):       # `entity_type == "x" and inserted`
        return any(_is_entity_type(v, value) for v in node.values)
    return False


def _branches(tree_, value):
    """Los `if` cuyo test menciona `entity_type == <value>`."""
    return [n for n in ast.walk(tree_)
            if isinstance(n, ast.If) and _is_entity_type(n.test, value)]


_PARENTS = {}
for _p in ast.walk(tree):
    for _c in ast.iter_child_nodes(_p):
        _PARENTS[_c] = _p


def _inside(node, value):
    """¿`node` está dentro de un `if entity_type == <value>`?"""
    cur = _PARENTS.get(node)
    while cur is not None:
        if isinstance(cur, ast.If) and _is_entity_type(cur.test, value):
            return True
        cur = _PARENTS.get(cur)
    return False


def _names(node):
    """Nombres y cadenas que aparecen en `node` (los comentarios no existen)."""
    out = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Name):
            out.add(n.id)
        elif isinstance(n, ast.Constant) and isinstance(n.value, str):
            out.add(n.value)
    return out


def _called(node):
    """Funciones llamadas dentro de `node`, por nombre."""
    return [n.func.id for n in ast.walk(node)
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)]


def _db_collection(call):
    """Colección de `db.<coleccion>.<metodo>(...)`, o None si no lo es."""
    f = call.func
    if (isinstance(f, ast.Attribute) and isinstance(f.value, ast.Attribute)
            and isinstance(f.value.value, ast.Name) and f.value.value.id == "db"):
        return f.value.attr
    return None


# El detector se autocomprueba antes de usarse: comillas dobles deben
# detectarse igual que simples, y `!=` no debe confundirse con `==`.
ok("el detector tolera comillas dobles",
   len(_branches(ast.parse('if entity_type == "group":\n    pass\n'), "group")) == 1)
ok("el detector no confunde != con ==",
   len(_branches(ast.parse("if entity_type != 'group':\n    pass\n"), "group")) == 0)

group_ifs = _branches(tree, "group")
ok("se localiza el bloque de group (AST)", len(group_ifs) == 1,
   f"— {len(group_ifs)} bloque(s)")
group_block = group_ifs[0] if group_ifs else None

if group_block is not None:
    gnames = _names(group_block)
    ok("el bloque de group no escribe contadores",
       "followers_count" not in gnames and "group_followers_count" not in gnames)
    ok("el bloque de group solo valida y lanza",
       _called(group_block).count("HTTPException") == 2
       and "evaluate_access" in gnames)

# El puente de companies es el ÚNICO lugar donde existe `followers_count`
# (compatibilidad heredada de OMEGA F0). Cualquier referencia fuera de ese
# `if` es un contador nuevo y B1 queda invalidado.
counters = [n for n in ast.walk(tree)
            if _const(n) == "followers_count"
            or (isinstance(n, ast.Name) and n.id == "followers_count")]
ok("followers_count sigue existiendo (compat de companies)", len(counters) >= 2,
   f"— {len(counters)} referencia(s)")
rogue = [n for n in counters if not _inside(n, "company")]
ok("followers_count solo existe en el puente de companies", not rogue,
   f"— {len(rogue)} fuera del puente")
ok("ningún contador dentro del bloque de group",
   all(not _inside(n, "group") for n in counters))

# Sin contadores nuevos y sin colección nueva para grupos.
extra = ({"members_count", "follower_count", "group_followers_count",
          "group_members_count"} & _names(tree))
ok("ningún contador nuevo en el código", not extra, f"— {sorted(extra)}")
WRITES = {"insert_one", "insert_many", "update_one", "update_many",
          "replace_one", "find_one_and_update", "delete_one", "delete_many"}
writes = [c for c in ast.walk(tree)
          if isinstance(c, ast.Call) and isinstance(c.func, ast.Attribute)
          and c.func.attr in WRITES and _db_collection(c) == "groups"]
ok("no se escribe en la colección groups", not writes,
   f"— {len(writes)} escritura(s)")
ok("no hay create_index en follows_routes", "create_index" not in _called(tree))
ok("no hay migraciones", not any(c.lower().startswith("migrat") for c in _called(tree)))
# El resolver de F0.9.6 ahora puede encontrar seguidores de grupo reales.
from services import social_audience as sa  # noqa: E402
db8 = FakeDB(
    members=[{"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}],
    follows=[{"user_id": "usr_seguidor", "entity_type": "group", "entity_id": GROUP}])
aud = asyncio.run(sa.resolve_group_audience(
    db8, GROUP, group={"id": GROUP, "privacy": "public"}))
check("el resolver ya ve al seguidor de grupo", aud["user_ids"],
      ["usr_miembro", "usr_seguidor"])
check("sin duplicados", aud["duplicates_merged"], 0)
db9 = FakeDB(
    members=[{"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}],
    follows=[{"user_id": "usr_seguidor", "entity_type": "group", "entity_id": GROUP},
             {"user_id": "usr_miembro", "entity_type": "group", "entity_id": GROUP}])
aud2 = asyncio.run(sa.resolve_group_audience(
    db9, GROUP, group={"id": GROUP, "privacy": "public"}))
check("miembro+seguidor → uno solo", aud2["user_ids"], ["usr_miembro", "usr_seguidor"])
check("duplicado fusionado", aud2["duplicates_merged"], 1)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")


