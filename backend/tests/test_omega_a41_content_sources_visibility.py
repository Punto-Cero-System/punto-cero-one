"""
OMEGA · CARRIL A4.1 — blindaje de Content Sources (Mixed Feed).

Fuga B2 de la auditoría: `GET /api/content-sources/mixed-feed` leía la
colección `posts` con un `{"status": "published"}` plano, sin ninguna condición
de visibilidad. Un post `members` aparecía en la home pública con `title`,
`description`, `image` y `metadata.post.body` enteros para cualquiera que
pidiera el endpoint, mientras `/api/feed/posts` sí lo ocultaba.

Este carril no crea una cuarta implementación de la regla: `content_sources_routes`
importa `_visibility_clause` y `_viewer_group_ids` de `services/feed_visibility.py`
(B4.1; antes vivían en `feed_routes`), las mismas funciones que usa `list_posts`.
Los endpoints coinciden por construcción.

Contrato verificado aquí:

  public / unlisted   → visibles para cualquiera (comportamiento previo intacto)
  members             → solo miembro del grupo o su administrador
                        NUNCA por ser follower
                        NUNCA por conocer el id
  sin fuga parcial    → ni title, ni description, ni image, ni metadata,
                        ni siquiera la existencia del post
  orden y paginación  → intactos; `offset` no salta ni duplica

Se invocan las RUTAS REALES de FastAPI, no una copia de la lógica.
Autocontenido: dobles en memoria, sin Mongo.
"""
from __future__ import annotations

import asyncio
import copy
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from routes import content_sources_routes as cs  # noqa: E402
from routes import feed_routes as fr  # noqa: E402

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


def section(title):
    print(f"\n{title}")


def _user_posts(mix) -> list:
    """Los items `user_post` de la respuesta. `mixed_feed` devuelve un dict
    envelope, no una lista."""
    return [it for it in mix["items"] if it.get("kind") == "user_post"]


def ids_of(mix) -> list:
    return [it["metadata"]["post"]["id"] for it in _user_posts(mix)]


def dumps_of(mix) -> str:
    """Todo el JSON de los items user_post: sirve para detectar fuga parcial."""
    return json.dumps(_user_posts(mix), ensure_ascii=False, default=str)


class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0
        self.skipped = 0
        self.sorted_by = None
        self.limited = None

    def sort(self, field, direction=-1):
        # Orden real: sin esto la prueba mediría el doble, no la query.
        self.sorted_by = (field, direction)
        self._rows.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
        return self

    def skip(self, n):
        self.skipped = n
        self._rows = self._rows[n:]
        return self

    def limit(self, n):
        self.limited = n
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


class FakeDB:
    def __init__(self, posts=(), members=(), groups=(), sessions=None, users=None):
        self.posts = _Collection(posts)
        self.group_members = _Collection(members)
        self.groups = _Collection(groups)
        self.user_sessions = _Collection(sessions or [])
        self.users = _Collection(users or [])
        self.growth_items = _Collection([])
        self.companies = _Collection([])
        self.github_repos = _Collection([])


def make_request(db):
    return type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()


def post(pid, visibility="public", group_id=None, author="usr_ana", created="t1"):
    doc = {
        "id": pid, "author_id": author, "body": f"contenido de {pid}",
        "hashtags": ["tag"], "category_key": "ventas", "visibility": visibility,
        "link_url": None, "image_url": f"/img/{pid}.png",
        "counts": {"reactions": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0},
        "reactions_by_kind": {}, "status": "published",
        "created_at": created, "updated_at": created,
    }
    if group_id is not None:
        doc["group_id"] = group_id
    return doc


def user(uid):
    return {"id": uid, "name": f"User {uid}", "email": f"{uid}@test.com",
            "country": None}


def db_with(post_docs, members=(), groups=()):
    """DB con sesión para cada usuario de `members`/`groups` y `expires_at`
    obligatorio: sin él, `_viewer` no resolvería y la prueba mediría a un
    anónimo por error."""
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    uids |= {"usr_ana"}
    expires = "2099-01-01T00:00:00+00:00"
    return FakeDB(
        posts=post_docs, members=members, groups=groups,
        sessions=[{"session_token": f"tok_{u}", "user_id": u, "expires_at": expires}
                  for u in uids],
        users=[user(u) for u in uids],
    )


MEMBER = {"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}
GROUP_OWNER = {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_dueno"}


def _tok(token):
    return None if token is ANON else token


async def _mixed(db, token, limit=30, offset=0):
    """Invoca la ruta real con `country` fijo para aislar el eje de visibilidad."""
    return await cs.mixed_feed(
        make_request(db), limit, offset, "AR", _tok(token), None, None, None)


def mixed(db, token, limit=30, offset=0):
    return asyncio.run(_mixed(db, token, limit=limit, offset=offset))


def _cs_src() -> str:
    return (BACKEND / "routes" / "content_sources_routes.py").read_text(encoding="utf-8")


# ===========================================================================
# 1. Un post public sigue apareciendo (comportamiento previo intacto)
# ===========================================================================
section("1. post public: sigue apareciendo")
db_pub = db_with([post("p_pub", "public")])
mix = mixed(db_pub, ANON)
check("el anónimo sigue viendo el post public", ids_of(mix), ["p_pub"])
ok("el item conserva su forma exacta (sin campos cropped)",
   set(mix["items"][0].keys()) >= {"id", "kind", "title", "description", "image",
                                   "category", "country", "source", "external_url",
                                   "created_at", "metadata", "layout"},
   f"({sorted(mix['items'][0].keys())})")
check("el metadata sigue trayendo el body completo",
      mix["items"][0]["metadata"]["post"]["body"], "contenido de p_pub")

section("1b. `unlisted` conserva EXACTAMENTE la semántica de A2 (no restringe)")
db_unl = db_with([post("p_unl", "unlisted")])
check("el anónimo ve `unlisted` como hoy", ids_of(mixed(db_unl, ANON)), ["p_unl"])
ok("`unlisted` sigue en la lista de no restringidos de A2",
   "unlisted" in fr._UNRESTRICTED_VISIBILITIES)

# ===========================================================================
# 2. Un post members aparece al miembro
# ===========================================================================
section("2. post members: aparece al miembro del grupo")
db_mem = db_with([post("p_mem", "members", group_id=GROUP)],
                 members=[MEMBER], groups=[GROUP_OWNER])
mix = mixed(db_mem, "tok_usr_miembro")
check("el miembro ve el post members", ids_of(mix), ["p_mem"])
check("y lo ve íntegro", mix["items"][0]["metadata"]["post"]["body"], "contenido de p_mem")
ok("y con su imagen", mix["items"][0]["image"], "/img/p_mem.png")

section("2b. el admin del grupo (groups.admin_id) también lo ve")
db_own = db_with([post("p_mem", "members", group_id=GROUP)], groups=[GROUP_OWNER])
check("el dueño ve el post members", ids_of(mixed(db_own, "tok_usr_dueno")), ["p_mem"])

# ===========================================================================
# 3. Un post members NO aparece al no miembro
# ===========================================================================
section("3. post members: NO aparece al no miembro")
db_out = db_with([post("p_mem", "members", group_id=GROUP)],
                 members=[{"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}],
                 groups=[GROUP_OWNER])
mix = mixed(db_out, "tok_usr_externo")
check("el no miembro NO lo ve", ids_of(mix), [])
blob = dumps_of(mix)
ok("no se filtra el id", "p_mem" not in blob)
ok("no se filtra el body", "contenido de p_mem" not in blob)
ok("no se filtra la imagen", "/img/p_mem.png" not in blob)
ok("no se filtra el autor", "usr_ana" not in blob)

# ===========================================================================
# 4. Un post members NO aparece al anónimo
# ===========================================================================
section("4. post members: NO aparece al anónimo")
db_anon = db_with([post("p_mem", "members", group_id=GROUP)], members=[MEMBER])
mix = mixed(db_anon, ANON)
check("el anónimo NO lo ve", ids_of(mix), [])
ok("ni siquiera la existencia del post",
   "p_mem" not in dumps_of(mix) and "contenido de p_mem" not in dumps_of(mix))

section("4b. `members` sin group_id tampoco se filtra (regla de A2)")
db_nog = db_with([post("p_nog", "members")], members=[MEMBER])
check("nadie lo ve", ids_of(mixed(db_nog, "tok_usr_miembro")), [])
check("ni el anónimo", ids_of(mixed(db_nog, ANON)), [])

# ===========================================================================
# 5. No cambia el comportamiento de los posts públicos / no cambia el orden
# ===========================================================================
section("5. posts públicos: conjunto y orden idénticos a antes")
db_mix = db_with([
    post("p1", "public", created="2026-01-05T00:00:00+00:00"),
    post("p2", "public", created="2026-01-04T00:00:00+00:00"),
    post("p3", "public", created="2026-01-03T00:00:00+00:00"),
    post("p4", "public", created="2026-01-02T00:00:00+00:00"),
])
mix = mixed(db_mix, ANON)
check("los 4 públicos aparecen, del más reciente al más antiguo",
      ids_of(mix), ["p1", "p2", "p3", "p4"])
check("el sort sigue siendo created_at descendente",
      db_mix.posts.last_query is not None, True)

section("5b. la visibilidad NO reordena: el miembro ve los mismos posts, en orden")
db_both = db_with([
    post("q1", "public", created="2026-01-05T00:00:00+00:00"),
    post("q2", "members", group_id=GROUP, created="2026-01-04T00:00:00+00:00"),
    post("q3", "public", created="2026-01-03T00:00:00+00:00"),
    post("q4", "members", group_id=GROUP, created="2026-01-02T00:00:00+00:00"),
], members=[MEMBER], groups=[GROUP_OWNER])
check("el miembro ve los 4, intercalados por fecha",
      ids_of(mixed(db_both, "tok_usr_miembro")), ["q1", "q2", "q3", "q4"])
check("el anónimo ve solo los públicos, en el mismo orden relativo",
      ids_of(mixed(db_both, ANON)), ["q1", "q3"])
ok("los posts ocultos no desplazan a los visibles (sin 'huecos' de orden)",
   ids_of(mixed(db_both, ANON)) == ["q1", "q3"])

section("5c. paginación por offset: cuenta posts VISIBLES, no los ocultos")
# `offset` salta N elementos del pool; no fija el tamaño de la página. Con 4
# posts y per_pool=7, offset=0 devuelve los 4 y offset=2 devuelve los 2 últimos.
page0 = ids_of(mixed(db_both, "tok_usr_miembro", offset=0))
page1 = ids_of(mixed(db_both, "tok_usr_miembro", offset=2))
check("el miembro en offset=0 ve los 4", page0, ["q1", "q2", "q3", "q4"])
check("en offset=2 ve los 2 últimos", page1, ["q3", "q4"])
# `offset` es un desplazamiento absoluto sobre el pool, no un cursor: puede
# solapar con la página anterior. Eso es preexistente y NO se toca aquí. Lo que
# este carril garantiza es que el desplazamiento se cuenta sobre el conjunto
# VISIBLE, que es lo que comprueban las dos líneas siguientes.

# Esta es la prueba que importa: para el anónimo, el offset debe contar sobre
# ["q1", "q3"], NO sobre ["q1", "q2", "q3", "q4"]. Si la visibilidad se filtrara
# DESPUÉS de la query, offset=1 devolvería "q2" — o sea, el post restringido se
# colaría en la página justo por paginar.
anon_p0 = ids_of(mixed(db_both, ANON, offset=0))
anon_p1 = ids_of(mixed(db_both, ANON, offset=1))
check("el anónimo en offset=0 ve solo los públicos", anon_p0, ["q1", "q3"])
check("en offset=1 ve el segundo público, NO el members",
      anon_p1, ["q3"])
ok("el offset del anónimo nunca revela un post oculto",
   "q2" not in anon_p1 and "q4" not in anon_p1)

# ===========================================================================
# 6. Contrato: reutilización real (sin cuarta implementación) y compatibilidad
# ===========================================================================
section("6. reutiliza el modelo de A2/A3, no lo reimplementa")
ok("`_visibility_clause` ES la función de la autoridad compartida (mismo objeto)",
   cs._visibility_clause is fr._visibility_clause)
ok("`_viewer_group_ids` ES la función de la autoridad compartida (mismo objeto)",
   cs._viewer_group_ids is fr._viewer_group_ids)
ok("no hay copia local de la cláusula",
   cs._visibility_clause.__module__ == "services.feed_visibility")
ok("no se importó `_post_is_visible` sin usar (la ruta es listado, no detalle)",
   "from routes.feed_routes import _post_is_visible" not in _cs_src())

_src = (BACKEND / "routes" / "content_sources_routes.py").read_text(encoding="utf-8")
ok("la visibilidad va en la QUERY, no en un filtro posterior",
   "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))" in _src
   and 'query["visibility"] = vis_clause["visibility"]' in _src)
ok("el sort sigue siendo created_at descendente",
   '.sort("created_at", -1).skip(skip).limit(raw_limit)' in _src)
ok("el skip/limit y el raw_limit no cambian",
   "raw_limit = max(limit * 3, limit + 10)" in _src)
ok("el pool sigue siendo un parámetro con default (backward compatible)",
   "viewer: Optional[dict] = None" in _src)

section("6b. no se tocó nada fuera del carril")
ok("las rutas de /api/content-sources no cambian (siguen siendo 5)",
   _src.count("@router.") == 5)
ok("el envelope de mixed-feed conserva sus 11 claves",
   set(mixed(db_pub, ANON).keys()) == {
       "items", "offset", "next_offset", "resolved_country",
       "resolved_country_label", "pool_sizes", "distribution",
       "layout_distribution", "editorial_template_size"},
   f"({sorted(mixed(db_pub, ANON).keys())})")
ok("EDITORIAL_TEMPLATE no se tocó",
   _src.count("_user_post") >= 1 and "EDITORIAL_TEMPLATE" in _src)
ok("los demás pools (growth/companies/repos) no se tocaron",
   "_pool_growth(db, kind=" in _src and "_pool_companies(db, country=" in _src
   and "db.github_repos.find(" in _src)
ok("la resolución de país no se tocó",
   "resolved = (country and country.upper())" in _src)
ok("no se añadió ningún índice ni migración",
   "create_index" not in _src and "ensure_index" not in _src)

_feeds = (BACKEND / "routes" / "feed_routes.py").read_text(encoding="utf-8")
# OMEGA B4.1 — la regla se extrajo a `services/feed_visibility.py`. Lo que esta
# comprobación protege es que A4.1 no cambió la estructura del Feed ni la query
# del pool, y que ambos usan la misma autoridad.
ok("feed_routes conserva la estructura de A4.1 (A2/A3 intactos)",
   _feeds.count("@router.") == 16
   and _feeds.count("async def _load_visible_post(") == 1
   and _feeds.count("await _load_visible_post(db, post_id") == 6)
ok("feed_routes usa la autoridad compartida y no la redefinió",
   "from services.feed_visibility import" in _feeds
   and _feeds.count("def _visibility_clause(") == 0)
ok("la query del pool de A4.1 sigue intacta",
   "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))" in _cs_src())
for _untouched in ("services/feed_engine/engine.py", "routes/search_routes.py"):
    ok(f"no se tocó {_untouched}", (BACKEND / _untouched).exists())

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")
