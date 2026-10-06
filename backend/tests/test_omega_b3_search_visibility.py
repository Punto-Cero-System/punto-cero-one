"""
OMEGA · CARRIL B3 — Search Visibility Protection.

Fuga B3 de la auditoría: el bloque `if "posts" in results:` de `search_routes`
leía `posts` con `{"status": "published", "$or": [...]}` y SIN condición de
visibilidad. Un post `members` se localizaba escribiendo su texto y devolvía:

    title    → los primeros 80 caracteres de su body
    subtitle → sus hashtags
    url      → /?post={id}

Es decir, contenido y existencia. Y por el `.limit()` el bloque se convertía en
un oráculo de extracción: los posts ocultos ocupaban plazas del límite y
desplazaban a los públicos, de modo que la ausencia de un resultado delataba
que el post existe pero no es visible para quien busca.

Este carril reutiliza el modelo de A2/A4.1: `search_routes` importa
`_visibility_clause` y `_viewer_group_ids` de `feed_routes`, y aplica el
resultado EN LA QUERY.

Contrato verificado aquí:

  anónimo            → NO encuentra posts members
  sin grupo          → NO encuentra posts members
  miembro del grupo  → SÍ encuentra posts members
  autorizado         → conserva íntegra la búsqueda pública
  sin filtrado tarde → los ocultos no ocupan plazas del `limit`
  envelope           → sin cambios

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

from routes import search_routes as sr  # noqa: E402
from routes import feed_routes as fr  # noqa: E402
# B4.1: la aserción final compara los TRES consumidores, así que hace falta
# importar también el tercero.
from routes import content_sources_routes as cs  # noqa: E402

FAILURES: list[str] = []
GROUP = "g_ventas"
GROUP2 = "g_privada"
ANON = object()  # centinela: "sin sesión", distinto de None
TERM = "secreto"


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


def post_ids(res) -> list:
    return [it["id"] for it in res["by_type"].get("posts", [])]


def blob(res) -> str:
    return json.dumps(res["by_type"].get("posts", []), ensure_ascii=False, default=str)


# --- dobles ----------------------------------------------------------------
class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0
        self.sorted_by = None
        self.limited = None

    def sort(self, field, direction=-1):
        self.sorted_by = (field, direction)
        self._rows.sort(key=lambda d: d.get(field) or "", reverse=direction < 0)
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
    """Soporta `$regex`, `$or`, `$and` e igualdad — lo que el search usa.

    `$and` importa de verdad aquí: es como B3 mete la cláusula de visibilidad
    sin pisar el `$or` de búsqueda. Un doble que lo ignorara dejaría pasar la
    fuga y la prueba sería verde por el motivo equivocado.
    """

    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.last_query = None

    def _match_field(self, actual, cond) -> bool:
        if isinstance(cond, dict):
            if "$in" in cond:
                return actual in cond["$in"] or (actual is None and None in cond["$in"])
            if "$ne" in cond:
                return actual != cond["$ne"]
            if "$regex" in cond:
                import re as _re
                flags = _re.I if "i" in (cond.get("$options") or "") else 0
                if not isinstance(actual, str):
                    return False
                return bool(_re.search(cond["$regex"], actual, flags))
        if isinstance(actual, list):
            return cond in actual
        return actual == cond

    def _match(self, doc, q) -> bool:
        for k, cond in (q or {}).items():
            if k == "$or":
                if not any(self._match(doc, b) for b in cond):
                    return False
                continue
            if k == "$and":
                if not all(self._match(doc, b) for b in cond):
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
    def __init__(self, posts=(), members=(), groups=(), sessions=None,
                 users=None, categories=()):
        self.posts = _Collection(posts)
        self.group_members = _Collection(members)
        self.groups = _Collection(groups)
        self.user_sessions = _Collection(sessions or [])
        self.users = _Collection(users or [])
        self.companies = _Collection([])
        self.jobs = _Collection([])
        self.events = _Collection([])
        self.hashtags = _Collection([])
        self.categories = _Collection(categories or [{"key": "k", "label": "L", "active": True}])
        self.growth_items = _Collection([])
        self.github_repos = _Collection([])


class _Headers(dict):
    """`request.headers` — `_viewer_country` lee `x-region-country` y
    `accept-language`. Con un dict vacío, el país queda en None y se aísla el
    eje de visibilidad del eje geográfico."""


class _Cookies(dict):
    pass


class _Request:
    def __init__(self, db, token=None):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()
        self.headers = _Headers()
        self.cookies = _Cookies({"session_token": token} if token else {})


def post(pid, visibility="public", group_id=None, body=None, created="2026-01-01T00:00:00+00:00"):
    doc = {
        "id": pid, "author_id": "usr_ana",
        "body": body if body is not None else f"publicación {pid} sobre {TERM}",
        "hashtags": ["tag"], "category_key": None, "visibility": visibility,
        "counts": {}, "status": "published",
        "created_at": created, "updated_at": created,
    }
    if group_id is not None:
        doc["group_id"] = group_id
    return doc


def user(uid):
    return {"id": uid, "name": f"User {uid}", "email": f"{uid}@test.com", "country": None}


def db_with(post_docs, members=(), groups=()):
    """Sesiones con `expires_at` válido: `current_user_or_none` descarta las
    caducadas, y una sesión sin él sería indistinguible de un anónimo."""
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    expires = "2099-01-01T00:00:00+00:00"
    return FakeDB(
        posts=post_docs, members=members, groups=groups,
        sessions=[{"session_token": f"tok_{u}", "user_id": u, "expires_at": expires}
                  for u in uids],
        users=[user(u) for u in uids],
    )


MEMBER = {"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}
GROUP_OWNER = {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_dueno"}


def search(db, token=None, q=TERM, types="posts", limit=8, country=None):
    """Invoca la ruta real. `token=None` = anónimo.

    El token viaja por la cookie, que es como lo lee `current_user_or_none`
    (igual que haría FastAPI con un cliente real). También se pasa como
    `session_token` para que `_viewer_country` se comporte igual que en
    producción.
    """
    return asyncio.run(sr.search(
        _Request(db, token), q, types, limit, country, token, None))


# ===========================================================================
# 1. Usuario anónimo NO encuentra posts members
# ===========================================================================
section("1. anónimo: no encuentra posts members")
db1 = db_with([post("p_mem", "members", group_id=GROUP)], members=[MEMBER])
res = search(db1, None)
check("no devuelve nada", post_ids(res), [])
ok("ni siquiera la existencia (nada del id ni del body)",
   "p_mem" not in blob(res) and TERM not in blob(res))

# ===========================================================================
# 2. Usuario SIN grupo NO encuentra posts members
# ===========================================================================
section("2. autenticado sin grupo: no encuentra posts members")
db2 = db_with([post("p_mem", "members", group_id=GROUP)],
              members=[{"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}],
              groups=[GROUP_OWNER])
res = search(db2, "tok_usr_externo")
check("no devuelve nada", post_ids(res), [])
ok("ni el id ni el body en la respuesta",
   "p_mem" not in blob(res) and TERM not in blob(res))

# ===========================================================================
# 3. Usuario MIEMBRO SÍ encuentra posts members
# ===========================================================================
section("3. miembro del grupo: sí encuentra el post members")
# db2 se construyó para `usr_externo`, que NO es miembro de este grupo. Para
# probar al miembro hace falta su propia DB: si se reutilizara db2, `tok_usr_miembro`
# no resolvería y la prueba mediría a un anónimo.
db_member = db_with([post("p_mem", "members", group_id=GROUP)],
                    members=[MEMBER], groups=[GROUP_OWNER])
res = search(db_member, "tok_usr_miembro")
ok("guarda: la sesión del miembro existe y resuelve",
   "tok_usr_miembro" in [s["session_token"] for s in db_member.user_sessions.docs])
check("lo encuentra", post_ids(res), ["p_mem"])
ok("con el body truncado a 80 chars, como siempre",
   res["by_type"]["posts"][0]["title"].startswith("publicación p_mem"),
   f"({res['by_type']['posts'][0]['title']!r})")
check("y con su url", res["by_type"]["posts"][0]["url"], "/?post=p_mem")

section("3b. el admin del grupo (groups.admin_id) también lo encuentra")
db3 = db_with([post("p_mem", "members", group_id=GROUP)], groups=[GROUP_OWNER])
check("el dueño lo encuentra", post_ids(search(db3, "tok_usr_dueno")), ["p_mem"])

# ===========================================================================
# 4. Usuario autorizado CONSERVA posts públicos
# ===========================================================================
section("4. el usuario autorizado conserva los posts públicos")
db4 = db_with([
    post("pub1", "public", created="2026-01-05T00:00:00+00:00"),
    post("mem1", "members", group_id=GROUP, created="2026-01-04T00:00:00+00:00"),
    post("pub2", "public", created="2026-01-03T00:00:00+00:00"),
], members=[MEMBER], groups=[GROUP_OWNER])
check("el anónimo ve solo los públicos", post_ids(search(db4, None)), ["pub1", "pub2"])
check("el miembro ve los 3, en orden created_at desc",
      post_ids(search(db4, "tok_usr_miembro")), ["pub1", "mem1", "pub2"])
check("un miembro de OTRO grupo ve solo los públicos",
      post_ids(search(db4, "tok_usr_otro")), ["pub1", "pub2"])

section("4b. `unlisted` conserva la semántica de A2 (no restringe)")
db_unl = db_with([post("unl1", "unlisted")])
check("el anónimo sigue viendo `unlisted`", post_ids(search(db_unl, None)), ["unl1"])

# ===========================================================================
# 5. NO se filtra después de paginar (el `limit` no lo ocupan los ocultos)
# ===========================================================================
section("5. los posts ocultos no consumen plazas del limit")
# limit=2 con 1 post members + 2 public: si la visibilidad se filtrara en
# Python DESPUÉS del .limit(2), el members ocuparía una de las dos plazas y el
# anónimo vería solo 1 público. Con la visibilidad en la query ve los 2.
db5 = db_with([
    post("mem1", "members", group_id=GROUP, created="2026-01-05T00:00:00+00:00"),
    post("pub1", "public", created="2026-01-04T00:00:00+00:00"),
    post("pub2", "public", created="2026-01-03T00:00:00+00:00"),
], members=[MEMBER], groups=[GROUP_OWNER])
check("el anónimo con limit=2 ve los 2 públicos, no 1",
      post_ids(search(db5, None, limit=2)), ["pub1", "pub2"])
ok("el total también cuadra (2, no 1)",
   search(db5, None, limit=2)["total"] == 2,
   f"({search(db5, None, limit=2)['total']})")
check("el miembro con limit=2 ve el members + 1 público",
      post_ids(search(db5, "tok_usr_miembro", limit=2)), ["mem1", "pub1"])

# ===========================================================================
# 6. No cambia el envelope JSON
# ===========================================================================
section("6. envelope JSON intacto")
res = search(db4, None)
ok("las 5 claves del envelope se conservan",
   set(res.keys()) == {"q", "total", "by_type", "user_country", "generated_at"},
   f"({sorted(res.keys())})")
check("`q` se devuelve tal cual", res["q"], TERM)
ok("`by_type` contiene la clave pedida", "posts" in res["by_type"])
check("`total` es la suma de by_type", res["total"],
      sum(len(v) for v in res["by_type"].values()))
ok("`generated_at` es ISO-8601", len(res["generated_at"]) >= 20)

item = search(db4, "tok_usr_miembro")["by_type"]["posts"][0]
ok("cada item de post conserva su forma exacta",
   set(item.keys()) == {"type", "id", "title", "subtitle", "url"},
   f"({sorted(item.keys())})")
check("`type` sigue siendo 'posts'", item["type"], "posts")

section("6b. la búsqueda pública no cambia de comportamiento")
db_pub = db_with([post("pub1", "public"), post("pub2", "public")])
res = search(db_pub, None)
check("un anónimo sigue encontrando todos los públicos",
      post_ids(res), ["pub1", "pub2"])
ok("y los posts públicos NO se recortan ni se filtran",
   all(it["title"] for it in res["by_type"]["posts"]))
res_auth = search(db_pub, "tok_usr_miembro")
check("un autenticado sin grupos ve lo mismo que el anónimo",
      post_ids(res_auth), ["pub1", "pub2"])

# ===========================================================================
# 7. Contrato: reutilización real (sin lógica paralela) y no-regresión
# ===========================================================================
section("7. reutiliza el modelo de A2/A4.1, no crea lógica paralela")
ok("`_visibility_clause` ES la función de feed_routes (mismo objeto)",
   sr._visibility_clause is fr._visibility_clause)
ok("`_viewer_group_ids` ES la función de feed_routes (mismo objeto)",
   sr._viewer_group_ids is fr._viewer_group_ids)
ok("no hay copia local de la cláusula",
   sr._visibility_clause.__module__ == "services.feed_visibility")

_src = (BACKEND / "routes" / "search_routes.py").read_text(encoding="utf-8")
ok("la visibilidad se aplica EN LA QUERY de posts",
   "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer_user))" in _src
   and "post_query[" in _src)
ok("el import viene del servicio compartido, no de una ruta",
   "from services.feed_visibility import _visibility_clause, _viewer_group_ids" in _src
   and "from routes.feed_routes import" not in _src)
ok("el `$or` de búsqueda no se pisa: la cláusula entra por `$and`",
   'post_query["$and"] = [vis_clause]' in _src
   and '"$or": [{"body": _regex(q)}, {"hashtags"' in _src)
ok("el resolver de sesión es el compartido, no uno nuevo",
   "from services.community_deps import current_user_or_none" in _src
   and "viewer_user = await current_user_or_none(request)" in _src)
ok("no se añadió una segunda resolución de sesión",
   _src.count("user_sessions.find_one") == 1)  # solo la de _viewer_country
ok("no se tocó `_viewer_country` (el país sigue igual)",
   "async def _viewer_country(" in _src
   and 'return normalize_country(override)' in _src)
ok("el sort y el limit no cambian",
   '.sort("created_at", -1).limit(limit)' in _src)
ok("la proyección no cambia",
   '{"_id": 0, "id": 1, "body": 1, "author_id": 1, "hashtags": 1},' in _src)

section("7b. no se tocó nada fuera del carril")
ok("las rutas de /api/search no cambian (siguen siendo 2)",
   _src.count("@router.") == 2)
ok("`suggest` sigue delegando con los mismos types",
   'types="people,companies,hashtags"' in _src)
ok("los otros bloques de búsqueda no se tocaron",
   "db.companies.find(" in _src and "db.jobs.find(" in _src
   and "db.events.find(" in _src and "db.hashtags.find(" in _src
   and "db.github_repos.find(" in _src)
ok("el ponderado regional sigue igual",
   "results[\"companies\"] = regional_sort(" in _src)
ok("no se añadió ningún índice ni migración",
   "create_index" not in _src and "ensure_index" not in _src)

# OMEGA B4.1 — la regla se extrajo a `services/feed_visibility.py`; los archivos
# ya no son idénticos a como estaban en B3. Lo que se protege es que B3 no cambió
# la query de posts y que ambos siguen usando la MISMA autoridad.
_feeds = (BACKEND / "routes" / "feed_routes.py").read_text(encoding="utf-8")
ok("feed_routes conserva la estructura de B3: 16 rutas y el helper de A3",
   _feeds.count("@router.") == 16
   and _feeds.count("async def _load_visible_post(") == 1
   and _feeds.count("await _load_visible_post(db, post_id") == 6)
ok("feed_routes usa la autoridad compartida, sin copiar la cláusula",
   "from services.feed_visibility import" in _feeds
   and _feeds.count("def _visibility_clause(") == 0)
ok("la query de posts de A2 sigue intacta",
   "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))" in _feeds)
_cs = (BACKEND / "routes" / "content_sources_routes.py").read_text(encoding="utf-8")
ok("content_sources_routes sigue usando la misma autoridad (A4.1 intacto)",
   "from services.feed_visibility import _visibility_clause, _viewer_group_ids" in _cs
   and "vis_clause = _visibility_clause(await _viewer_group_ids(db, viewer))" in _cs
   and _cs.count("def _visibility_clause(") == 0)
ok("y los tres consumidores comparten literalmente la MISMA función",
   fr._visibility_clause is sr._visibility_clause
   and cs._visibility_clause is sr._visibility_clause)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")
