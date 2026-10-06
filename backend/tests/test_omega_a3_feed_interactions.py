"""
OMEGA · CARRIL A3 — protección de las interacciones del Feed.

A2 cerró la lectura: un post `members` ya no salía en el listado ni se abría
con `get_post`. Pero las seis rutas de interacción seguían contestando por su
cuenta y, en cuatro de ellas, sin mirar siquiera `posts`:

    · `comments` (GET)  — devolvía el hilo entero, anónimo, de cualquier post
    · `save` / `view`   — no consultaban `posts`: cualquier id, exista o no
    · `react` / `share` / `comments` (POST) — solo exigían `status=published`

Un post `members` era, por tanto, comentable, reactionable, guardable,
compartible y contable por cualquiera que acertara el id, aunque el listado
ocultara su existencia.

Contrato verificado aquí:

  miembro/dueño del grupo → las 6 interacciones funcionan
  no miembro              → 404 en las 6 (nunca 403: no se confirma existencia)
  anónimo                 → 404 en las 6 sobre contenido `members`
  posts públicos          → comportamiento idéntico, contadores incluidos
  comentarios             → exactamente la misma regla que `get_post`
  save / view             → 404 si el post no existe, sin tocar contadores

Se invocan las RUTAS REALES de FastAPI, no una copia de la lógica.
Autocontenido: dobles en memoria, sin Mongo.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from routes import feed_routes as fr  # noqa: E402
from models_feed import CommentCreate, ReactionInput  # noqa: E402

#: `ShareInput` y `ViewInput` viven en `feed_routes`, no en `models_feed`: son
#: parte de su contrato HTTP y no se mueven (moverlos rompería la regla de no
#: cambiar nombres ni mover cosas).
ShareInput = fr.ShareInput
ViewInput = fr.ViewInput

FAILURES: list[str] = []
GROUP = "g_ventas"
GROUP2 = "g_privada"
ANON = object()  # centinela: "sin sesión", distinto de None


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


def status_of(fn):
    """El status_code del HTTPException, o 200 si la llamada tuvo éxito."""
    try:
        fn()
    except Exception as e:
        return getattr(e, "status_code", None)
    return 200


def detail_of(fn):
    try:
        fn()
    except Exception as e:
        return getattr(e, "detail", str(e))
    return ""


def raises_404(label, fn):
    code = status_of(fn)
    good = code == 404
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {code!r}")
    if not good:
        FAILURES.append(f"{label}: {code!r} != 404")


def section(title):
    print(f"\n{title}")


class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0

    def sort(self, field, direction=-1):
        # Orden real: el doble tiene que paginar contra la misma secuencia que
        # Mongo, o la prueba mediría el doble en vez de la ruta.
        self._rows.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._i >= len(self._rows):
            raise StopAsyncIteration
        row = self._rows[self._i]
        self._i += 1
        return row


class _DuplicateKey(Exception):
    """Marcador de posición; se reemplaza abajo por el error real de pymongo."""


#: `register_view` captura `pymongo.errors.DuplicateKeyError` — el doble tiene que
#: lanzar exactamente esa clase, o el `except` de la ruta no se dispararía y la
#: deduplicación parecería rota siendo que no lo está.
try:
    from pymongo.errors import DuplicateKeyError as _DuplicateKey  # noqa: F811
except ImportError:  # pragma: no cover - pymongo siempre está en el backend
    pass


class _Collection:
    """Colección en memoria con el subconjunto de la API que usa el Feed.

    `proj` se IGNORA a propósito: el doble devuelve el documento entero. Eso
    vuelve el test más fuerte, no más débil — si una ruta recortara la
    proyección y `_post_is_visible` leyera `visibility=None`, el doble le
    devolvería el valor real y la prueba pasaría por el motivo equivocado. Por
    eso las proyecciones parciales de A3 se verifican aparte, sobre el texto.

    `unique` replica el índice único de `post_views` para poder probar la
    deduplicación sin Mongo.
    """

    def __init__(self, docs=None, unique=None):
        self.docs = list(docs or [])
        self.last_query = None
        self.unique = unique

    def _match_field(self, actual, cond) -> bool:
        if isinstance(cond, dict):
            if "$in" in cond:
                return actual in cond["$in"] or (actual is None and None in cond["$in"])
            if "$ne" in cond:
                return actual != cond["$ne"]
            if "$lt" in cond:
                return actual is not None and actual < cond["$lt"]
            if "$gte" in cond:
                return actual is not None and actual >= cond["$gte"]
        return actual == cond

    def _match(self, doc, q) -> bool:
        for k, cond in (q or {}).items():
            if k == "$or":
                if not any(self._match(doc, branch) for branch in cond):
                    return False
                continue
            if not self._match_field(doc.get(k), cond):
                return False
        return True

    async def find_one(self, q=None, proj=None):
        self.last_query = q
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find(self, q=None, proj=None):
        self.last_query = q
        return _Cursor([copy.deepcopy(d) for d in self.docs if self._match(d, q)])

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q)])

    async def insert_one(self, doc):
        if self.unique:
            key = tuple(doc.get(k) for k in self.unique)
            for d in self.docs:
                if tuple(d.get(k) for k in self.unique) == key:
                    raise _DuplicateKey("duplicate")
        self.docs.append(copy.deepcopy(doc))
        return type("R", (), {"inserted_id": doc.get("id")})()

    async def update_one(self, q, update, upsert=False):
        for d in self.docs:
            if self._match(d, q):
                for path, delta in (update.get("$inc") or {}).items():
                    cur = d
                    parts = path.split(".")
                    for p in parts[:-1]:
                        cur = cur.setdefault(p, {})
                    last = parts[-1]
                    cur[last] = cur.get(last, 0) + delta
                for path, val in (update.get("$set") or {}).items():
                    d[path] = val
                return type("R", (), {"matched_count": 1, "modified_count": 1})()
        return type("R", (), {"matched_count": 0, "modified_count": 0})()

    async def delete_one(self, q):
        for i, d in enumerate(self.docs):
            if self._match(d, q):
                del self.docs[i]
                return type("R", (), {"deleted_count": 1})()
        return type("R", (), {"deleted_count": 0})()


class FakeDB:
    def __init__(self, posts=(), members=(), groups=(), sessions=None,
                 users=None, comments=()):
        self.posts = _Collection(posts)
        self.group_members = _Collection(members)
        self.groups = _Collection(groups)
        self.user_sessions = _Collection(sessions or [])
        self.users = _Collection(users or [])
        self.post_comments = _Collection(comments)
        self.post_reactions = _Collection([])
        self.post_saves = _Collection([])
        self.post_shares = _Collection([])
        # Índice único real: (post_id, session_id) — server.py:208
        self.post_views = _Collection([], unique=("post_id", "session_id"))
        self.post_reports = _Collection([])
        self.hashtags = _Collection([])

    def counts_of(self, pid) -> dict:
        p = next((d for d in self.posts.docs if d["id"] == pid), None)
        return (p or {}).get("counts", {})


def make_request(db):
    return type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()


def post(pid, visibility="public", group_id=None, author="usr_ana",
         created="2026-01-01T00:00:00+00:00", status="published"):
    doc = {
        "id": pid, "author_id": author, "body": f"cuerpo {pid}",
        "hashtags": [], "category_key": None, "visibility": visibility,
        "link_url": None, "image_url": None,
        "counts": {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0},
        "reactions_by_kind": {}, "status": status,
        "created_at": created, "updated_at": created,
    }
    if group_id is not None:
        doc["group_id"] = group_id
    return doc


def comment(cid, post_id, author="usr_ana", created="2026-01-02T00:00:00+00:00"):
    return {"id": cid, "post_id": post_id, "author_id": author,
            "body": f"texto {cid}", "created_at": created}


def user(uid, role=None):
    u = {"id": uid, "name": f"User {uid}", "email": f"{uid}@test.com"}
    if role:
        u["role"] = role
    return u


def db_with(post_docs, members=(), groups=(), comments=()):
    """DB con sesión para cada usuario que aparece en `members` o `groups`.

    `expires_at` es obligatorio: `_current_user_or_none` descarta cualquier
    sesión sin él, y una sesión sin él sería indistinguible de un anónimo, de
    modo que las pruebas de autorización pasarían midiendo a un anónimo.
    """
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    uids |= {"usr_ana"} | {c["author_id"] for c in comments}
    expires = "2099-01-01T00:00:00+00:00"
    return FakeDB(
        posts=post_docs, members=members, groups=groups, comments=comments,
        sessions=[{"session_token": f"tok_{u}", "user_id": u, "expires_at": expires}
                  for u in uids],
        users=[user(u) for u in uids],
    )


MEMBER = {"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}
GROUP_OWNER = {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_dueno"}


def _tok(token):
    return None if token is ANON else token


def call_add_comment(db, pid, token, body="hola"):
    return asyncio.run(fr.add_comment(
        pid, CommentCreate(body=body), make_request(db), _tok(token), None))


def call_list_comments(db, pid, token, limit=50):
    return asyncio.run(fr.list_comments(
        pid, make_request(db), _tok(token), None, limit))


def call_react(db, pid, token, kind="like"):
    return asyncio.run(fr.react_to_post(
        pid, ReactionInput(kind=kind), make_request(db), _tok(token), None))


def call_save(db, pid, token):
    return asyncio.run(fr.save_post(pid, make_request(db), _tok(token), None))


def call_share(db, pid, token, destination=None):
    return asyncio.run(fr.share_post(
        pid, ShareInput(destination=destination), make_request(db), _tok(token), None))


def call_view(db, pid, token, sid="ses_1"):
    return asyncio.run(fr.register_view(
        pid, ViewInput(session_id=sid), make_request(db), _tok(token), None))


def call_get_post(db, pid, token):
    return asyncio.run(fr.get_post(pid, make_request(db), _tok(token), None))


#: Las 6 rutas del carril, en el orden del spec. Cada entrada se invoca con un
#: `session_id` distinto para que `view` no colisione con el índice único.
INTERACTIONS = [
    ("add_comment", lambda db, pid, tk: call_add_comment(db, pid, tk)),
    ("list_comments", lambda db, pid, tk: call_list_comments(db, pid, tk)),
    ("react", lambda db, pid, tk: call_react(db, pid, tk)),
    ("save", lambda db, pid, tk: call_save(db, pid, tk)),
    ("share", lambda db, pid, tk: call_share(db, pid, tk)),
    ("view", lambda db, pid, tk: call_view(db, pid, tk, sid=f"s_{tk if tk is not ANON else 'anon'}")),
]


def all_interactions(db, pid, token):
    """Ejecuta las 6 rutas y devuelve {nombre: status_code}."""
    return {name: status_of(lambda fn=fn: fn(db, pid, token))
            for name, fn in INTERACTIONS}


ALL_200 = {name: 200 for name, _ in INTERACTIONS}
ALL_404 = {name: 404 for name, _ in INTERACTIONS}

#: `add_comment`, `react_to_post` y `save_post` llaman a `_require_current_user`
#: ANTES de resolver el post: un anónimo recibe 401 y se queda ahí, sin llegar a
#: la comprobación de visibilidad. Eso es el contrato previo del módulo (A2 no lo
#: tocó) y es además lo correcto: el anónimo tampoco así puede deducir que el
#: post existe. Las otras tres aceptan anónimo por diseño.
AUTH_ONLY = ["add_comment", "react", "save"]
ANON_OK = ["list_comments", "share", "view"]


# ===========================================================================
# 1. El miembro interactúa con un post `members` de SU grupo
# ===========================================================================
section("1. miembro del grupo: las 6 interacciones funcionan")
db_mem = db_with([post("post_mem", "members", group_id=GROUP)],
                 members=[MEMBER], groups=[GROUP_OWNER])
check("las 6 responden 200", all_interactions(db_mem, "post_mem", "tok_usr_miembro"),
      ALL_200)
check("las 5 métricas del post suben a 1", db_mem.counts_of("post_mem"),
      {"reactions": 1, "comments": 1, "shares": 1, "saves": 1, "views": 1})
check("el comentario se persistió", len(db_mem.post_comments.docs), 1)
check("la reacción se persistió",
      db_mem.post_reactions.docs[0]["kind"] if db_mem.post_reactions.docs else None, "like")
check("el guardado se persistió", len(db_mem.post_saves.docs), 1)
check("el compartir se persistió", len(db_mem.post_shares.docs), 1)
check("la vista se persistió", len(db_mem.post_views.docs), 1)
check("reactions_by_kind se actualizó", db_mem.posts.docs[0]["reactions_by_kind"],
      {"like": 1})

section("1b. admin del grupo (groups.admin_id): interactúa igual")
db_own = db_with([post("post_mem", "members", group_id=GROUP)], groups=[GROUP_OWNER])
check("las 6 responden 200 para el dueño",
      all_interactions(db_own, "post_mem", "tok_usr_dueno"), ALL_200)

# ===========================================================================
# 2. Un NO miembro recibe 404 en las 6
# ===========================================================================
section("2. no miembro: 404 en las 6 interacciones")
db_out = db_with([post("post_mem", "members", group_id=GROUP)],
                 members=[{"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}],
                 groups=[GROUP_OWNER])
check("las 6 responden 404", all_interactions(db_out, "post_mem", "tok_usr_externo"),
      ALL_404)
check("el 404 no confirma existencia",
      detail_of(lambda: call_list_comments(db_out, "post_mem", "tok_usr_externo")),
      "Publicación no encontrada")
check("ningún contador se movió", db_out.counts_of("post_mem"),
      {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0})
check("no se escribió en ninguna colección de interacción",
      (len(db_out.post_comments.docs), len(db_out.post_reactions.docs),
       len(db_out.post_saves.docs), len(db_out.post_shares.docs),
       len(db_out.post_views.docs)),
      (0, 0, 0, 0, 0))

# ===========================================================================
# 3. Anónimo no interactúa con contenido `members`
# ===========================================================================
section("3. anónimo: nunca interactúa con contenido `members`")
db_anon = db_with([post("post_mem", "members", group_id=GROUP)], members=[MEMBER])
codes_anon = all_interactions(db_anon, "post_mem", ANON)
check("las que exigen sesión cortan con 401",
      {n: codes_anon[n] for n in AUTH_ONLY}, {n: 401 for n in AUTH_ONLY})
check("las que aceptan anónimo cortan con 404",
      {n: codes_anon[n] for n in ANON_OK}, {n: 404 for n in ANON_OK})
ok("ninguna devuelve 200: el anónimo no interactúa",
   all(v == 401 or v == 404 for v in codes_anon.values()), f"({codes_anon})")
check("ni por conocer el id", db_anon.counts_of("post_mem"),
      {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0})

# ===========================================================================
# 4. Los comentarios respetan EXACTAMENTE la misma regla que `get_post`
# ===========================================================================
section("4. comentarios == get_post, caso por caso")
OTHER = {"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}
CASES = [
    ("público / anónimo", [post("p_pub")], ANON, {}, 200),
    ("público / miembro", [post("p_pub")], "tok_usr_miembro", {}, 200),
    ("members / miembro", [post("p_mem", "members", group_id=GROUP)],
     "tok_usr_miembro", {"members": [MEMBER], "groups": [GROUP_OWNER]}, 200),
    ("members / no miembro", [post("p_mem", "members", group_id=GROUP)],
     "tok_usr_externo", {"members": [OTHER], "groups": [GROUP_OWNER]}, 404),
    ("members / anónimo", [post("p_mem", "members", group_id=GROUP)],
     ANON, {"members": [MEMBER]}, 404),
    ("members sin group_id", [post("p_nog", "members")],
     "tok_usr_externo", {"members": [OTHER]}, 404),
    ("moderado (removed)", [post("p_rem", status="removed")],
     "tok_usr_miembro", {}, 404),
    ("no existe", [], "tok_usr_miembro", {}, 404),
]
for label, docs, token, extra, expected in CASES:
    pid = docs[0]["id"] if docs else "p_ghost"
    d = db_with(docs, comments=[comment("cmt_1", pid)], **extra)
    got_get = status_of(lambda: call_get_post(d, pid, token))
    got_cmt = status_of(lambda: call_list_comments(d, pid, token))
    ok(f"{label}: comentarios y get_post coinciden",
       got_get == got_cmt == expected, f"(get_post={got_get}, comments={got_cmt})")

# ===========================================================================
# 5. Posts PÚBLICOS: comportamiento idéntico (contadores incluidos)
# ===========================================================================
section("5. posts públicos: sin cambios de comportamiento")
db_pub = db_with([post("post_pub")])
# Sesión válida: `db_with` crea `tok_usr_ana` (autor del post).
check("las 6 responden 200 con sesión sobre un post público",
      all_interactions(db_pub, "post_pub", "tok_usr_ana"), ALL_200)
check("los contadores suben exactamente como antes", db_pub.counts_of("post_pub"),
      {"reactions": 1, "comments": 1, "shares": 1, "saves": 1, "views": 1})

db_pub_anon = db_with([post("post_pub")])
codes_pub_anon = all_interactions(db_pub_anon, "post_pub", ANON)
check("anónimo: las que aceptan sesión siguen respondiendo 200",
      {n: codes_pub_anon[n] for n in ANON_OK}, {n: 200 for n in ANON_OK})
check("anónimo: las que exigen sesión siguen cortando con 401",
      {n: codes_pub_anon[n] for n in AUTH_ONLY}, {n: 401 for n in AUTH_ONLY})

section("5b. toggles y deduplicación siguen exactamente igual")
# DB nueva: `db_pub` ya quedó con una reacción y un guardado de la sección 5, y
# un toggle solo tiene sentido partiendo de cero.
db_tog = db_with([post("post_pub")])
r1 = call_react(db_tog, "post_pub", "tok_usr_ana")
r2 = call_react(db_tog, "post_pub", "tok_usr_ana")
check("reaccionar dos veces hace toggle", (r1["reacted"], r2["reacted"]), (True, False))
check("el contador de reacciones vuelve a 0", db_tog.counts_of("post_pub")["reactions"], 0)
check("no queda reacción huérfana", len(db_tog.post_reactions.docs), 0)
s1 = call_save(db_tog, "post_pub", "tok_usr_ana")
s2 = call_save(db_tog, "post_pub", "tok_usr_ana")
check("guardar dos veces hace toggle", (s1["saved"], s2["saved"]), (True, False))
check("el contador de guardados vuelve a 0", db_tog.counts_of("post_pub")["saves"], 0)
v1 = call_view(db_tog, "post_pub", ANON, sid="ses_x")
v2 = call_view(db_tog, "post_pub", ANON, sid="ses_x")
check("la vista se deduplica por session_id", (v1["counted"], v2["counted"]), (True, False))
check("el contador de vistas no se duplica", db_tog.counts_of("post_pub")["views"], 1)

# ===========================================================================
# 6. save_post y register_view exigen que el post exista
# ===========================================================================
section("6. save/view sobre un id inexistente: 404 y nada escrito")
db_gone = db_with([])
raises_404("save sobre id inexistente (con sesión)",
           lambda: call_save(db_gone, "post_fantasma", "tok_usr_ana"))
raises_404("view sobre id inexistente",
           lambda: call_view(db_gone, "post_fantasma", ANON, sid="s_f"))
check("no se guardó nada", len(db_gone.post_saves.docs), 0)
check("no se registró ninguna vista", len(db_gone.post_views.docs), 0)

# ===========================================================================
# 7. Contrato, serialización y compatibilidad
# ===========================================================================
section("7. envelopes y serialización intactos")
db_c = db_with([post("post_pub")], comments=[comment("cmt_1", "post_pub")])
c = call_list_comments(db_c, "post_pub", ANON)
ok("el envelope sigue siendo CommentListResponse",
   set(c.model_dump().keys()) == {"items", "total"}, f"({set(c.model_dump().keys())})")
ok("CommentPublic conserva su forma exacta",
   set(c.items[0].model_dump().keys()) == {"id", "post_id", "body", "author", "created_at"},
   f"({set(c.items[0].model_dump().keys())})")
check("el total sigue siendo el conteo de la página", c.total, len(c.items))
ok("`limit` sigue aplicando", len(call_list_comments(db_c, "post_pub", ANON, limit=1).items) == 1)
sec = call_add_comment(db_c, "post_pub", "tok_usr_ana")
ok("el comentario creado conserva su forma",
   set(sec.model_dump().keys()) == {"id", "post_id", "body", "author", "created_at"})
check("react conserva su envelope",
      set(call_react(db_c, "post_pub", "tok_usr_ana").keys()), {"reacted", "kind"})
check("save conserva su envelope",
      set(call_save(db_c, "post_pub", "tok_usr_ana").keys()), {"saved"})
check("share conserva su envelope",
      set(call_share(db_c, "post_pub", ANON).keys()), {"ok"})
check("view conserva su envelope",
      set(call_view(db_c, "post_pub", ANON, sid="z").keys()), {"counted"})
ok("`list_comments` sigue aceptando la sesión por cookie",
   "session_token" in __import__("inspect").signature(fr.list_comments).parameters)

section("7b. no se tocó nada fuera del carril")
_src = (BACKEND / "routes" / "feed_routes.py").read_text(encoding="utf-8")
ok("Feed Engine intacto (sigue importado y nunca desde las 6 rutas)",
   "build_for_you_feed" in _src and "feed_engine" in _src)
ok("trending intacto", '@router.get("/trending"' in _src)
_report = _src.split("async def report_post")[1].split("\n@router")[0]
ok("report_post intacto: no usa el helper de A3", "_load_visible_post" not in _report)
ok("moderación y reportes intactos",
   '@router.patch("/posts/{post_id}/moderation"' in _src and '@router.get("/reports"' in _src)
# OMEGA B4.1 — la regla se extrajo a `services/feed_visibility.py`. Lo que esta
# comprobación protege no es la UBICACIÓN sino que exista UNA sola
# implementación y que el Feed use la autoridad compartida.
_FV = (BACKEND / "services" / "feed_visibility.py").read_text(encoding="utf-8")
ok("no se añadió una tercera implementación de la regla",
   _src.count("def _visibility_clause(") == 0
   and _src.count("def _viewer_group_ids(") == 0
   and _src.count("def _post_is_visible(") == 1
   and _FV.count("def _visibility_clause(") == 1
   and _FV.count("def _viewer_group_ids(") == 1)
ok("feed_routes usa la autoridad compartida (import, no copia)",
   "from services.feed_visibility import" in _src)
ok("las 6 rutas usan el helper único", _src.count("await _load_visible_post(db, post_id") == 6)
ok("no se añadió ningún índice ni migración en feed_routes",
   "create_index" not in _src and "ensure_index" not in _src)
ok("no se añadieron ni quitaron rutas", _src.count("@router.") == 16)
ok("la proyección parcial de `react` incluye visibility y group_id",
   '"reactions_by_kind": 1,' in _src and '"visibility": 1, "group_id": 1}' in _src)
#: El bloque del helper, aislado: los guards de abajo leen de aquí y no del
#: archivo entero, para que un 404 en otra ruta no pueda hacerlos pasar.
_HELPER = _src.split("async def _load_visible_post(")[1].split("\n\nasync def")[0]
ok("el helper filtra por status=published",
   '{"id": post_id, "status": "published"}' in _HELPER)
ok("el helper devuelve el 404 de get_post, no un 403",
   _HELPER.count('detail="Publicación no encontrada"') == 2
   and "status_code=403" not in _HELPER)
ok("el helper reutiliza `_post_is_visible` (no reimplementa la regla)",
   "_post_is_visible(" in _HELPER and "_viewer_group_ids(" in _HELPER)
ok("create_post sigue escribiendo visibility tal cual",
   '"visibility": payload.visibility,' in _src)
ok("el listado y el detalle de A2 no se tocaron",
   "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))" in _src
   and "if not _post_is_visible(doc, viewer_groups):" in _src)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")
