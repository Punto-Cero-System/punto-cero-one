"""
OMEGA · CARRIL B4.2 — For You Feed Visibility Enforcement.

Con B4.1 cerrado, `services/feed_visibility` es la autoridad única. B4.0 audito
esta superficie y concluyo que la visibilidad debia aplicarse AL CONSTRUIR EL
POOL: el ranking termina en `top = ranked[:limit]`, asi que un post invisible
que entrara en el pool expulsaria a uno visible del `limit`. Filtrar despues no
solo deja pasar la fuga — convierte "Para Ti" en un oraculo.

Este test verifica las cuatro propiedades que el carril promete:

  publico   → el anonimo sigue recibiendo `public`, en el orden de siempre
  privado   → el anonimo NO recibe `members`; el miembro SI
  ranking   → un `members` reciente NO desplaza a un `public`
  limit     → opera sobre contenido visible, no sobre el total

Y congela lo que NO debe cambiar: firma publica, `FeedMode`, `FeedItem`,
providers, pesos y desempate.

Se invocan los servicios REALES, con dobles en memoria y sin Mongo.
"""
from __future__ import annotations

import asyncio
import copy
import inspect
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import feed_visibility as fv  # noqa: E402
from services import feed_engine as fe  # noqa: E402
from services.feed_engine import engine as eng  # noqa: E402
from services.feed_engine import providers as prov  # noqa: E402
from services.feed_engine.base import FeedItem, FeedMode, FeedSignals  # noqa: E402

FAILURES: list[str] = []
GROUP = "g_ventas"
GROUP2 = "g_otra"

#: Fechas relativas a HOY: el camino autenticado filtra por
#: `created_at >= now - lookback_days` (30 dias). Con fechas fijas en el pasado el
#: pool saldria vacio y se mediria una ventana vacia en vez de la fuga.
_NOW = datetime.now(timezone.utc)


def _days_ago(n: float) -> str:
    return (_NOW - timedelta(days=n)).isoformat()


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


def ids_of(items) -> list:
    """Ids de un feed. Tolera tanto la tupla `(items, mode)` que devuelve
    `build_for_you_feed` como la lista de items suelta."""
    if isinstance(items, tuple):
        items = items[0]
    return [i.post["id"] for i in items]


def ids(db, viewer=None, **kw) -> list:
    """Atajo: ids del feed. `feed()` devuelve la tupla (items, mode)."""
    return ids_of(feed(db, viewer, **kw)[0])


class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0
        self.sorted_by = None
        self.limited = None

    def sort(self, field, direction=-1):
        # Orden real: sin esto la prueba mediria el doble, no la query.
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
    """Soporta `$in`, `$or`, `$and` e igualdad — lo que usa el motor.

    `$or` importa de verdad: la clausula de visibilidad lo devuelve cuando el
    viewer pertenece a algun grupo. Un doble que lo ignorara dejaria pasar la
    fuga y la prueba seria verde por el motivo equivocado.
    """

    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.last_query = None
        self.queries: list = []

    def _match_field(self, actual, cond) -> bool:
        if isinstance(cond, dict):
            if "$in" in cond:
                return actual in cond["$in"] or (actual is None and None in cond["$in"])
            if "$ne" in cond:
                return actual != cond["$ne"]
            if "$gte" in cond:
                return actual is not None and actual >= cond["$gte"]
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
        self.queries.append(q)
        self.last_query = q
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find(self, q=None, proj=None):
        self.queries.append(q)
        self.last_query = q
        return _Cursor([copy.deepcopy(d) for d in self.docs if self._match(d, q)])

    def __aiter__(self):
        rows = [copy.deepcopy(d) for d in self.docs]
        state = {"i": 0}

        class _It:
            def __aiter__(inner):
                return inner

            async def __anext__(inner):
                if state["i"] >= len(rows):
                    raise StopAsyncIteration
                row = rows[state["i"]]
                state["i"] += 1
                return row

        return _It()


class FakeDB:
    def __init__(self, posts=(), members=(), groups=(), users=()):
        self.posts = _Collection(posts)
        self.group_members = _Collection(members)
        self.groups = _Collection(groups)
        self.users = _Collection(users)
        self.follows = _Collection([])
        self.company_follows = _Collection([])
        self.companies = _Collection([])
        self.post_reactions = _Collection([])
        self.post_saves = _Collection([])
        self.post_comments = _Collection([])


def post(pid, visibility="public", author="usr_ana", group_id=None,
         created=None, reactions=0):
    doc = {
        "id": pid, "author_id": author, "body": f"cuerpo {pid}",
        "hashtags": [], "category_key": None, "visibility": visibility,
        "status": "published",
        "counts": {"reactions": reactions, "comments": 0, "shares": 0,
                   "saves": 0, "views": 0},
        "reactions_by_kind": {},
        "created_at": created or _days_ago(1),
        "updated_at": created or _days_ago(1),
    }
    if group_id is not None:
        doc["group_id"] = group_id
    return doc


def user(uid):
    return {"id": uid, "name": f"User {uid}", "email": f"{uid}@t.com",
            "country": None, "verticals": [], "interests": []}


def db_with(post_docs, members=(), groups=()):
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    return FakeDB(posts=post_docs, members=members, groups=groups,
                  users=[user(u) for u in uids])


MEMBER = {"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}
OUTSIDER = {"group_id": GROUP2, "user_id": "usr_externo", "role": "member"}
OWNER = {"id": GROUP, "name": "Ventas", "privacy": "public", "admin_id": "usr_dueno"}


def feed(db, viewer=None, **kw):
    """Invoca el motor real. `viewer=None` = anonimo."""
    return asyncio.run(fe.build_for_you_feed(db, viewer, **kw))


# ===========================================================================
# CASO PÚBLICO — el anónimo recibe `public` y mantiene el orden
# ===========================================================================
section("CASO PUBLICO: el anonimo recibe posts public, en orden")
db_pub = db_with([
    post("p1", "public", created=_days_ago(1)),
    post("p2", "public", created=_days_ago(2)),
    post("p3", "public", created=_days_ago(3)),
])
items, mode = feed(db_pub, None, limit=10)
check("recibe los 3 publicos", ids_of(items), ["p1", "p2", "p3"])
check("en orden created_at descendente (el mas reciente primero)",
      ids_of(items), ["p1", "p2", "p3"])
check("el modo sigue siendo CHRONOLOGICAL", mode, FeedMode.CHRONOLOGICAL)
check("el score del anonimo sigue siendo 0.0",
      [i.score for i in items], [0.0, 0.0, 0.0])
check("la query del anonimo conserva status=published",
      db_pub.posts.queries[0].get("status"), "published")

section("CASO PUBLICO: `unlisted` conserva la semantica de A2 (no restringe)")
db_unl = db_with([post("u1", "unlisted"), post("p1", "public")])
check("el anonimo sigue viendo `unlisted`", ids(db_unl, None, limit=10), ["u1", "p1"])

# ===========================================================================
# CASO PRIVADO — el anónimo NO recibe members; el miembro SÍ
# ===========================================================================
section("CASO PRIVADO: el anonimo NO recibe posts members")
db_priv = db_with([
    post("pub1", "public", created=_days_ago(1)),
    post("mem1", "members", group_id=GROUP, created=_days_ago(2)),
], members=[MEMBER], groups=[OWNER])
items, _ = feed(db_priv, None, limit=10)
check("solo ve el public", ids_of(items), ["pub1"])
ok("ni el id ni el body del post restringido en ningun item",
   all(i.post["id"] != "mem1" for i in items))

section("CASO PRIVADO: autenticado SIN grupo NO recibe members")
db_out = db_with([
    post("pub1", "public", created=_days_ago(1)),
    post("mem1", "members", group_id=GROUP, created=_days_ago(2)),
], members=[OUTSIDER], groups=[OWNER])
check("el outsider solo ve el public",
      ids_of(feed(db_out, user("usr_externo"), limit=10)), ["pub1"])

section("CASO PRIVADO: el miembro SI recibe posts members")
db_mem = db_with([
    post("pub1", "public", created=_days_ago(1)),
    post("mem1", "members", group_id=GROUP, created=_days_ago(2)),
], members=[MEMBER], groups=[OWNER])
check("el miembro ve ambos, en orden", ids_of(feed(db_mem, user("usr_miembro"), limit=10)),
      ["pub1", "mem1"])

section("CASO PRIVADO: el admin del grupo (groups.admin_id) tambien lo ve")
db_own = db_with([post("mem1", "members", group_id=GROUP)], groups=[OWNER])
check("el dueno ve el post members",
      ids_of(feed(db_own, user("usr_dueno"), limit=10)), ["mem1"])

section("CASO PRIVADO: `members` sin group_id no se abre por accidente")
db_orph = db_with([post("orph", "members")], members=[MEMBER])
check("nadie lo ve, ni el miembro de otro grupo",
      ids(db_orph, user("usr_miembro"), limit=10), [])

# ===========================================================================
# RANKING — un members reciente NO desplaza a un public
# ===========================================================================
section("RANKING: un members reciente no puede desplazar a un public")
# El camino anónimo ordena por created_at desc y corta con limit. Antes de B4.2,
# con limit=1 el top-1 era el `members` y el público NUNCA aparecía: el oráculo.
db_oracle = db_with([
    post("mem1", "members", group_id=GROUP, created=_days_ago(1)),
    post("pub1", "public", created=_days_ago(3)),
], members=[MEMBER], groups=[OWNER])
check("con limit=1 el anonimo ve el public, no el members",
      ids_of(feed(db_oracle, None, limit=1)), ["pub1"])
check("con limit=2 ve solo el public",
      ids_of(feed(db_oracle, None, limit=2)), ["pub1"])
check("el miembro si ve ambos con limit=2",
      ids_of(feed(db_oracle, user("usr_miembro"), limit=2)), ["mem1", "pub1"])

section("RANKING: el mismo criterio en el camino autenticado (con ranking real)")
# Aquí el ranking scorea de verdad. El `members` es más reciente (RecencyProvider
# +3) y muy reactivado (Trending), pero no debe aparecer para quien no puede leerlo.
db_rank = db_with([
    post("mem1", "members", group_id=GROUP, created=_days_ago(1), reactions=50),
    post("pub1", "public", created=_days_ago(3)),
], members=[MEMBER, OUTSIDER], groups=[OWNER])
_r_out, _ = feed(db_rank, user("usr_externo"), limit=10)
check("el outsider rankea pero nunca ve el members", ids_of(_r_out), ["pub1"])
_r_mem, _ = feed(db_rank, user("usr_miembro"), limit=10)
ok("el miembro si lo ve, y el public tambien",
   set(ids_of(_r_mem)) == {"mem1", "pub1"}, f"({sorted(ids_of(_r_mem))})")

# ===========================================================================
# LIMIT — opera sobre contenido visible, no sobre el total
# ===========================================================================
section("LIMIT: se aplica sobre el contenido visible")
db_lim = db_with([
    post("mem1", "members", group_id=GROUP, created=_days_ago(1)),
    post("pub1", "public", created=_days_ago(2)),
    post("pub2", "public", created=_days_ago(3)),
    post("pub3", "public", created=_days_ago(4)),
], members=[MEMBER], groups=[OWNER])
check("anonimo con limit=2 recibe 2 publicos (el members no ocupa plaza)",
      ids_of(feed(db_lim, None, limit=2)), ["pub1", "pub2"])
check("miembro con limit=2 recibe members + 1 publico",
      ids_of(feed(db_lim, user("usr_miembro"), limit=2)), ["mem1", "pub1"])
check("el anonimo con limit=10 sigue viendo los 3 publicos",
      ids_of(feed(db_lim, None, limit=10)), ["pub1", "pub2", "pub3"])

section("LIMIT: el pool de ranking se llena solo con visibles")
# pool_size=2 con 1 members + 3 public: el outsider debe rankear los 2 publicos
# más recientes, no 1 members + 1 publico (que es lo que pasaría filtrando tarde
# en memoria: se perdería una de las dos plazas del presupuesto de ranking).
db_pool = db_with([
    post("mem1", "members", group_id=GROUP, created=_days_ago(1)),
    post("pub1", "public", created=_days_ago(2)),
    post("pub2", "public", created=_days_ago(3)),
    post("pub3", "public", created=_days_ago(4)),
])
_items, _mode = feed(db_pool, user("usr_externo"), limit=2, pool_size=2)
check("el outsider rankea 2 posts VISIBLES del pool, no 1+1",
      ids_of(_items), ["pub1", "pub2"])

# ===========================================================================
# CONTRATOS CONGELADOS — nada de lo prohibido cambió
# ===========================================================================
section("CONTRATOS: firma publica, FeedMode, FeedItem y providers intactos")
check("firma de build_for_you_feed sin cambios",
      str(inspect.signature(fe.build_for_you_feed)),
      "(db, user: 'Optional[dict]', *, limit: 'int' = 20, pool_size: 'int' = 200, "
      "lookback_days: 'int' = 30) -> 'tuple[list[FeedItem], FeedMode]'")
check("FeedMode sigue con sus 4 estados", [m.value for m in FeedMode],
      ["CHRONOLOGICAL", "FOLLOW_BASED", "TRENDING", "AI_RECOMMENDED"])
ok("FeedItem sigue siendo post + score + reasons",
   set(FeedItem.model_fields) == {"post", "score", "reasons"})
ok("FeedSignals NO gano campos de visibilidad",
   not any("visib" in f for f in FeedSignals.model_fields))
check("los 6 providers y su orden no cambian",
      [p.name for p in prov.DEFAULT_PROVIDERS],
      ["follow", "category", "hashtag", "interaction", "recency", "trending"])
ok("los pesos no cambian",
   prov.FollowProvider.WEIGHT == 3.0 and prov.CategoryProvider.WEIGHT == 2.0
   and prov.HashtagProvider.WEIGHT == 1.0 and prov.InteractionProvider.WEIGHT == 1.5)
ok("ningun provider mira `visibility` (el ranking es agnostico)",
   all("visibility" not in inspect.getsource(type(p)) for p in prov.DEFAULT_PROVIDERS))

section("CONTRATOS: el desempate y el corte final no cambian")
_src = (BACKEND / "services" / "feed_engine" / "engine.py").read_text(encoding="utf-8")
ok("el desempate sigue siendo (score, created_at) desc",
   'ranked.sort(key=lambda x: (x.score, x.post["created_at"]), reverse=True)' in _src)
ok("el corte sigue siendo ranked[:limit]", "top = ranked[:limit]" in _src)
ok("el pool sigue truncado a pool_size en Mongo", ".limit(pool_size)" in _src)
ok("lookback_days sigue aplicando solo al camino autenticado",
   'created_at": {"$gte": since}' in _src)
ok("el camino anonimo conserva score=0.0 y CHRONOLOGICAL",
   "FeedItem(post=d, score=0.0)" in _src)

# ===========================================================================
# LA VISIBILIDAD SE APLICA EN EL POOL, NUNCA DESPUÉS DEL RANKING
# ===========================================================================
section("ORDEN: la clausula va en la QUERY del pool, no despues del ranking")
_db_q = db_with([post("m1", "members", group_id=GROUP), post("p1", "public")])
feed(_db_q, None, limit=5)
_query = _db_q.posts.queries[0]
ok("la query anonima lleva la clausula de visibilidad",
   _query.get("visibility") == {"$in": ["public", "unlisted", None]}, f"({_query})")
ok("no se filtra despues: el helper se aplica ANTES de db.posts.find",
   _src.index("_pool_query(") < _src.index("db.posts.find("))
_db_q2 = db_with([post("m1", "members", group_id=GROUP), post("p1", "public")],
                 members=[MEMBER], groups=[OWNER])
feed(_db_q2, user("usr_miembro"), limit=5)
_query2 = _db_q2.posts.queries[0]
ok("la query autenticada lleva el `$or` de grupo-scoped",
   "$or" in _query2 and _query2["$or"][1]["visibility"] == "members", f"({_query2})")
ok("y ambas ramas del pool pasan por el helper (2 llamadas)",
   _src.count("_pool_query(") == 3)  # 1 def + 2 usos

# ===========================================================================
# DEPENDENCIA — la autoridad viene del servicio, nunca de una ruta
# ===========================================================================
section("DEPENDENCIA: importa del servicio, no de routes")
ok("importa de services.feed_visibility",
   "from services.feed_visibility import _visibility_clause, _viewer_group_ids" in _src)
ok("NO importa de routes en ningun sentido",
   "from routes" not in _src and "import routes" not in _src)
ok("es la MISMA funcion que usa el servicio compartido (identidad)",
   eng._visibility_clause is fv._visibility_clause
   and eng._viewer_group_ids is fv._viewer_group_ids)
from routes import feed_routes as _fr  # noqa: E402
ok("y que las rutas de verdad usan esa misma funcion",
   _fr._visibility_clause is eng._visibility_clause)

# ===========================================================================
# COSTE — resolver grupos solo cuando hace falta
# ===========================================================================
section("CONSULTAS: el anonimo no lanza consultas de grupo")
_db_anon = db_with([post("p1", "public")])
feed(_db_anon, None, limit=5)
ok("el anonimo NO toca group_members", _db_anon.group_members.queries == [])
ok("el anonimo NO toca groups", _db_anon.groups.queries == [])
ok("el anonimo solo consulta posts",
   len(_db_anon.posts.queries) == 1, f"({len(_db_anon.posts.queries)})")

_db_auth = db_with([post("p1", "public")], members=[MEMBER])
feed(_db_auth, user("usr_miembro"), limit=5)
ok("el autenticado SI resuelve sus grupos (1 consulta a group_members)",
   len(_db_auth.group_members.queries) == 1, f"({len(_db_auth.group_members.queries)})")
ok("y se resuelven UNA sola vez por peticion",
   len(_db_auth.posts.queries) == 1)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")
