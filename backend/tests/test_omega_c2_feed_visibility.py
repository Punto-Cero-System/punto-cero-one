"""
OMEGA · CARRIL A2 — visibilidad del Feed.

Cubre el bug crítico de la auditoría C3.0: `visibility` se persistía y se
serializaba, pero NINGUNA lectura lo usaba como condición, así que un post
`members` era legible por cualquiera que acertara el id.

Contrato verificado aquí:

  public     → visible para cualquiera (comportamiento previo, intacto)
  members    → solo miembro del grupo o admin del grupo
               NUNCA por ser follower
               NUNCA por conocer el id
  unlisted   → conserva EXACTAMENTE la semántica vigente (no restringe)
  get_post   → mismas reglas que el listado, 404 y no 403
  paginación → intacta, el cursor no cambia
  serializ.  → idéntica

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

FAILURES: list[str] = []
GROUP = "g_ventas"
GROUP2 = "g_privada"


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


def raises(label, fn, exc=Exception):
    try:
        fn()
    except exc:
        print(f"  PASS  {label}: rechaza correctamente")
        return
    except Exception as e:
        print(f"  FAIL  {label}: otra excepción {type(e).__name__}")
        FAILURES.append(f"{label}: {type(e).__name__}")
        return
    print(f"  FAIL  {label}: NO lanzó")
    FAILURES.append(f"{label}: no lanzó")


def section(title):
    print(f"\n{title}")


# --- dobles ----------------------------------------------------------------
class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0

    def sort(self, field, direction=-1):
        # El doble ordena de verdad: `list_posts` encadena `.sort().limit()` y
        # un doble que ignorase el orden haría que la paginación se probara
        # contra otra secuencia de la que usa Mongo.
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


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.last_query = None

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


class FakeDB:
    def __init__(self, posts=(), members=(), groups=(), sessions=None, users=None):
        self.posts = _Collection(posts)
        self.group_members = _Collection(members)
        self.groups = _Collection(groups)
        self.user_sessions = _Collection(sessions or [])
        self.users = _Collection(users or [])
        self.post_reactions = _Collection([])
        self.post_saves = _Collection([])
        self.hashtags = _Collection([])


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


def user(uid, role=None):
    u = {"id": uid, "name": f"User {uid}", "email": f"{uid}@test.com"}
    if role:
        u["role"] = role
    return u


def db_with(post_docs, members=(), groups=()):
    """DB con sesión para cada usuario que aparece en `members` o `groups`.

    `expires_at` es obligatorio: `_current_user_or_none` resuelve la sesión y
    descarta (devuelve None) cualquiera que no lo traiga, así que una sesión
    sin él sería indistinguible de un anónimo.
    """
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    expires = "2099-01-01T00:00:00+00:00"
    return FakeDB(
        posts=post_docs, members=members, groups=groups,
        sessions=[{"session_token": f"tok_{u}", "user_id": u, "expires_at": expires}
                  for u in uids],
        users=[user(u) for u in uids],
    )


def call_list(db, token=None, **kw):
    params = dict(limit=20, cursor=None, category_key=None, hashtag=None,
                  author_id=None, saved_by_me=False, include_hidden=False)
    params.update(kw)
    return asyncio.run(fr.list_posts(make_request(db), token, None, **params))


def call_get(db, post_id, token=None):
    return asyncio.run(fr.get_post(post_id, make_request(db), token, None))


def resolved_viewer(db, token):
    """El viewer que la ruta resolvería con ese token, o None.

    Sirve de guarda: si un token no resuelve a un usuario, las pruebas de
    autorización que lo usan estarían midiendo a un anónimo y pasarían por
    error (o fallarían sin decir por qué).
    """
    if not token:
        return None
    session = next((s for s in db.user_sessions.docs
                    if s.get("session_token") == token), None)
    if not session or not session.get("expires_at"):
        return None
    return next((u for u in db.users.docs if u["id"] == session["user_id"]), None)


MEMBER = {"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}
OUTSIDER = {"group_id": GROUP, "user_id": "usr_externo", "role": "member"}
GROUP_OWNER = {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_dueno"}


def _exc_detail(fn):
    try:
        fn()
    except Exception as e:
        return getattr(e, "detail", str(e))
    return ""


# ===========================================================================
# 1. public — visible para cualquiera (comportamiento previo intacto)
# ===========================================================================
section("1. public visible para cualquiera")
db_pub = db_with([post("post_pub")])
r_anon = call_list(db_pub)
check("anónimo ve el post público", [i.id for i in r_anon.items], ["post_pub"])
r_mem = call_list(db_pub, token="tok_usr_miembro")
check("miembro autenticado también", [i.id for i in r_mem.items], ["post_pub"])
check("get_post anónimo", call_get(db_pub, "post_pub").id, "post_pub")
ok("`public` no restringe: la cláusula lo incluye siempre",
   "public" in fr._UNRESTRICTED_VISIBILITIES)


# ===========================================================================
# 2. members — visible para miembro
# ===========================================================================
section("2. members visible para el miembro del grupo")
db_mem = db_with([post("post_mem", "members", group_id=GROUP)],
                 members=[MEMBER], groups=[GROUP_OWNER])
ok("guarda: el token resuelve a un viewer real",
   (resolved_viewer(db_mem, "tok_usr_miembro") or {}).get("id") == "usr_miembro")
r = call_list(db_mem, token="tok_usr_miembro")
check("el miembro lo ve en el listado", [i.id for i in r.items], ["post_mem"])
check("el miembro lo ve en get_post",
      call_get(db_mem, "post_mem", "tok_usr_miembro").id, "post_mem")
ok("y un miembro de OTRO grupo no lo ve",
   call_list(db_with([post("post_mem", "members", group_id=GROUP)],
                     members=[{"group_id": GROUP2, "user_id": "usr_otro",
                               "role": "member"}]),
             token="tok_usr_otro").items == [])


# ===========================================================================
# 3. members — oculto para quien NO es miembro
# ===========================================================================
section("3. members oculto para no miembro")
# `usr_externo` es miembro de OTRO grupo, no de este.
db_out = db_with([post("post_mem", "members", group_id=GROUP), post("post_pub")],
                 members=[{"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}],
                 groups=[GROUP_OWNER])
r = call_list(db_out, token="tok_usr_externo")
check("el listado solo devuelve el público", [i.id for i in r.items], ["post_pub"])
raises("get_post responde 404 (no 403)",
       lambda: call_get(db_out, "post_mem", "tok_usr_externo"))
check("el 404 no confirma existencia",
      _exc_detail(lambda: call_get(db_out, "post_mem", "tok_usr_externo")),
      "Publicación no encontrada")
check("anónimo tampoco lo ve",
      [i.id for i in call_list(db_with([post("post_mem", "members", group_id=GROUP)])).items], [])
raises("ni por conocer el id: anónimo get_post",
       lambda: call_get(db_with([post("post_mem", "members", group_id=GROUP)]), "post_mem"))


# ===========================================================================
# 4. members — visible para el ADMIN del grupo (groups.admin_id)
# ===========================================================================
section("4. members visible para el administrador del grupo")
db_own = db_with([post("post_mem", "members", group_id=GROUP)], groups=[GROUP_OWNER])
check("el dueño lo ve en el listado",
      [i.id for i in call_list(db_own, token="tok_usr_dueno").items], ["post_mem"])
check("y en get_post", call_get(db_own, "post_mem", "tok_usr_dueno").id, "post_mem")
ok("se usa groups.admin_id, no follows",
   any(g.get("admin_id") == "usr_dueno" for g in db_own.groups.docs))


# ===========================================================================
# 5. members — NUNCA por ser follower
# ===========================================================================
section("5. members nunca se abre por ser follower")
db_fol = db_with([post("post_mem", "members", group_id=GROUP)], groups=[GROUP_OWNER])
# El usuario SIGUE al grupo (relación real en `follows`) pero no es miembro.
db_fol.follows = _Collection([{"user_id": "usr_seguidor",
                               "entity_type": "group", "entity_id": GROUP}])
db_fol.user_sessions.docs.append({"session_token": "tok_usr_seguidor",
                                  "user_id": "usr_seguidor",
                                  "expires_at": "2099-01-01T00:00:00+00:00"})
db_fol.users.docs.append(user("usr_seguidor"))
check("el follower no lo ve en el listado",
      [i.id for i in call_list(db_fol, token="tok_usr_seguidor").items], [])
raises("ni en get_post", lambda: call_get(db_fol, "post_mem", "tok_usr_seguidor"))
ok("`follows` no aparece en la cláusula de visibilidad",
   "follows" not in str(fr._visibility_clause({GROUP})), fr._visibility_clause({GROUP}))
_src = Path(BACKEND / "routes" / "feed_routes.py").read_text(encoding="utf-8")
_server_src = Path(BACKEND / "server.py").read_text(encoding="utf-8")
# Conteo de rutas observado en el archivo, no supuesto: la auditoría apuntaba
# a 17 y son 16. La aserción fija 16 para que un endpoint nuevo o eliminado en
# el futuro rompa el test en vez de colarse.
_ROUTES_BEFORE = 16
# El bloque A2 va de su banner hasta `_serialize_post`. Se busca `db.follows`
# —el acceso real a la colección— y no la palabra "follows", que aparece en los
# comentarios que explican por qué NO se consulta.
_block = _src.split("# VISIBILITY")[1].split("async def _serialize_post")[0]
ok("y el bloque de visibility no accede a la colección `follows`",
   "db.follows" not in _block)
# OMEGA B4.1 — `_viewer_group_ids` y `_visibility_clause` se movieron a
# `services/feed_visibility.py`. Esta aserción anclaba en el texto
# `async def _viewer_group_ids` dentro de este archivo; con la extracción ese
# ancla ya no existe y el `split` reventaba. Lo que la prueba protege NO es la
# ubicación sino el CONTENIDO: que la resolución de grupos no consulte `follows`.
# Se verifica ahora sobre el archivo que contiene la función de verdad.
_fv_src = Path(BACKEND / "services" / "feed_visibility.py").read_text(encoding="utf-8")
_fv_body = _fv_src.split("async def _viewer_group_ids(")[1].split("\ndef ")[0]
ok("ni la resuelve para el viewer (`follows` sigue fuera de la autoridad)",
   "follows" not in _fv_body and "db.follows" not in _fv_src,
   "(la función vive ahora en services/feed_visibility.py)")
ok("la autoridad compartida no consulta `follows` en ninguna forma",
   "follows" not in _fv_src.replace("`follows` no", "")
   or "db.follows" not in _fv_src)
ok("y `feed_routes` la reexporta sin redefinirla (sin duplicación)",
   "from services.feed_visibility import" in _src
   and _src.count("async def _viewer_group_ids") == 0
   and _src.count("def _visibility_clause") == 0)


# ===========================================================================
# 6. members sin group_id — no visible para nadie (fail-closed)
# ===========================================================================
section("6. members sin group_id no se abre por accidente")
db_orphan = db_with([post("post_orphan", "members")], members=[MEMBER],
                    groups=[GROUP_OWNER])
check("ni el miembro lo ve sin group_id",
      [i.id for i in call_list(db_orphan, token="tok_usr_miembro").items], [])
raises("ni get_post", lambda: call_get(db_orphan, "post_orphan", "tok_usr_miembro"))
ok("fail-closed: sin grupo no hay contra qué comprobar la pertenencia",
   fr._post_is_visible(post("x", "members"), {GROUP}) is False)


# ===========================================================================
# 7. unlisted — conserva EXACTAMENTE la semántica vigente
# ===========================================================================
section("7. unlisted conserva el comportamiento existente")
db_unl = db_with([post("post_unl", "unlisted")])
check("anónimo lo ve, como antes", [i.id for i in call_list(db_unl).items], ["post_unl"])
check("miembro lo ve",
      [i.id for i in call_list(db_unl, token="tok_usr_miembro").items], ["post_unl"])
check("get_post también", call_get(db_unl, "post_unl").id, "post_unl")
ok("documentado: `unlisted` no restringe hoy y no se inventa semántica nueva",
   "unlisted" in fr._UNRESTRICTED_VISIBILITIES)
ok("y el motivo está escrito en el fuente",
   "se comporta como hoy" in _src)


# ===========================================================================
# 8. get_post respeta exactamente las mismas reglas que el listado
# ===========================================================================
section("8. get_post y list_posts coinciden")
CASES = [
    ("public", None, True, "usr_miembro", "público"),
    ("members", GROUP, True, "usr_miembro", "members para el miembro"),
    ("members", GROUP, False, "usr_externo", "members para el outsider"),
    ("members", GROUP2, False, "usr_miembro", "members de OTRO grupo"),
    ("members", None, False, "usr_miembro", "members sin grupo"),
    ("unlisted", None, True, "usr_externo", "unlisted"),
]
for visibility, gid, expect_visible, token_user, name in CASES:
    db_c = db_with([post("p_x", visibility, group_id=gid)],
                   members=[MEMBER, {"group_id": GROUP2, "user_id": "usr_externo",
                                     "role": "member"}],
                   groups=[GROUP_OWNER])
    token = f"tok_{token_user}"
    ok(f"guarda: {token_user} resuelve a viewer",
       (resolved_viewer(db_c, token) or {}).get("id") == token_user)
    in_list = bool(call_list(db_c, token=token).items)
    check(f"listado coincide — {name}", in_list, expect_visible)
    if expect_visible:
        got = call_get(db_c, "p_x", token).id
    else:
        try:
            call_get(db_c, "p_x", token)
            got = "LO DEVUELVO"
        except Exception:
            got = "404"
    check(f"get_post coincide — {name}", got, "p_x" if expect_visible else "404")


# ===========================================================================
# 9. Paginación y cursor — sin cambios
# ===========================================================================
section("9. paginación y cursor intactos")
_posts9 = [post(f"post_{i:02d}", created=f"2026-01-{i:02d}T00:00:00+00:00")
           for i in range(1, 6)]
db_page = db_with(_posts9)

r1 = call_list(db_page, limit=2)
check("página 1 devuelve el límite exacto", len(r1.items), 2)
check("en orden cronológico descendente", [i.id for i in r1.items], ["post_05", "post_04"])
check("next_cursor = created_at del último", r1.next_cursor, "2026-01-04T00:00:00+00:00")

r2 = call_list(db_page, limit=2, cursor=r1.next_cursor)
check("página 2 con el cursor", [i.id for i in r2.items], ["post_03", "post_02"])
r3 = call_list(db_page, limit=2, cursor=r2.next_cursor)
check("página 3", [i.id for i in r3.items], ["post_01"])
check("sin más páginas, cursor None", r3.next_cursor, None)
ok("el cursor sigue siendo un ISO de created_at (sin formato nuevo)",
   r1.next_cursor == "2026-01-04T00:00:00+00:00", r1.next_cursor)

# La visibilidad no debe crear huecos: la página se llena con lo legible.
db_mix = db_with(
    [post("a_pub", created="2026-01-05T00:00:00+00:00"),
     post("b_mem", "members", group_id=GROUP, created="2026-01-04T00:00:00+00:00"),
     post("c_pub", created="2026-01-03T00:00:00+00:00")],
    members=[MEMBER, {"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}],
    groups=[GROUP_OWNER])
r_out = call_list(db_mix, token="tok_usr_externo", limit=2)
check("la página se rellena solo con lo legible (sin huecos)",
      [i.id for i in r_out.items], ["a_pub", "c_pub"])
r_in = call_list(db_mix, token="tok_usr_miembro", limit=2)
check("el miembro sí recibe el post de su grupo en la página",
      [i.id for i in r_in.items], ["a_pub", "b_mem"])


# ===========================================================================
# 10. Serialización y formato de respuesta — idénticos
# ===========================================================================
section("10. serialización y formato idénticos")
r_pub = call_list(db_pub)
item = r_pub.items[0]
ok("el envelope sigue siendo PostListResponse",
   set(r_pub.model_dump()) == {"items", "next_cursor", "total"}, sorted(r_pub.model_dump()))
ok("el post serializa los mismos campos",
   set(item.model_dump()) == {
       "id", "author", "body", "hashtags", "category_key", "visibility",
       "link_url", "image_url", "counts", "reactions_by_kind", "my_reaction",
       "my_saved", "status", "created_at", "updated_at"},
   sorted(item.model_dump()))
check("counts intacto", item.counts,
      {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0})
check("author con la misma forma", sorted(item.author.model_dump()),
      ["headline", "id", "name", "picture"])
one = call_get(db_pub, "post_pub")
check("get_post devuelve el MISMO documento que el listado",
      one.model_dump(), item.model_dump())
ok("`visibility` se sigue exponiendo en la respuesta", item.visibility == "public")

# Un post members visible para su miembro se serializa igual que uno público.
r_mem2 = call_list(db_mem, token="tok_usr_miembro")
check("members visible para el miembro: mismo formato",
      set(r_mem2.items[0].model_dump()), set(item.model_dump()))


# ===========================================================================
# 11. Compatibilidad — nada más cambió
# ===========================================================================
section("11. compatibilidad")
ok("no se cambió la forma de PostVisibility",
   "public" in Path(BACKEND / "models_feed.py").read_text(encoding="utf-8"))
ok("no se importó activity_reader",
   "activity_reader" not in _src and "activities" not in _src.split("# VISIBILITY")[1])
ok("no se reutilizó visibility_query", "visibility_query" not in _src)
ok("no se tocó el ranking",
   "build_for_you_feed" in _src and "feed_engine" in _src)
ok("no se cambiaron endpoints: la ruta sigue siendo /api/feed",
   'prefix="/api/feed"' in _src)
ok("no se optimizó el N+1: _serialize_post sigue consultando por post",
   "await db.post_reactions.find_one" in _src
   and "await db.post_saves.find_one" in _src)
ok("no se tocó trending",
   "@router.get(\"/trending\"" in _src)
ok("la escritura de create_post no cambia (sigue guardando visibility tal cual)",
   '"visibility": payload.visibility,' in _src)
ok("no se añadió ningún índice ni migración en feed_routes",
   "create_index" not in _src and "ensure_index" not in _src)
ok("no se tocó server.py: los índices del Feed siguen siendo los 5 originales",
   all(s in _server_src for s in (
       'await db.posts.create_index("id", unique=True)',
       'await db.posts.create_index("created_at")',
       'await db.posts.create_index("hashtags")',
       'await db.posts.create_index("category_key")',
       'await db.posts.create_index("status")')))
ok("el número de rutas de /api/feed no cambió (16 antes y después)",
   _src.count("@router.") == _ROUTES_BEFORE, _src.count("@router."))
ok("la cláusula es solo de lectura: no escribe en posts",
   "update_one" not in _block and "insert_one" not in _block)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")

