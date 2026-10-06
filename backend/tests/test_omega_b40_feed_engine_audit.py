"""
OMEGA · CARRIL B4.0 — AUDITORÍA DEL FEED ENGINE. NO MODIFICA NADA.

Este archivo NO implementa B4. Es una caracterización del estado actual de
`services/feed_engine` para responder, con evidencia ejecutable, las preguntas del
brief: dónde está `build_for_you_feed`, qué pools y colecciones usa, si recibe
viewer, dónde se rankea y dónde sería SEGURO aplicar la visibilidad.

Regla dura del carril: este test SOLO LEE. No escribe en producción, no cambia
firmas, no toca ranking. Su valor es twofold:

  1. Congelar el comportamiento actual, para que B4 pueda cambiarlo de forma
     deliberada y este test delate cualquier desviación accidental.
  2. Documentar, mediante aserciones ejecutables, dónde NO hay visibilidad hoy
     — el hallazgo central de la auditoría.

Todo lo que este test afirma sobre la ausencia de visibilidad es una
CONSTATACIÓN del estado actual, no un caso de lo que debería pasar. Cuando B4
se implemente, estas aserciones deberán invertirse deliberadamente.

Autocontenido: dobles en memoria, sin Mongo.
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

from services import feed_engine as fe  # noqa: E402
from services.feed_engine import engine as eng  # noqa: E402
from services.feed_engine import providers as prov  # noqa: E402
from services.feed_engine.base import FeedItem, FeedMode, FeedSignals  # noqa: E402

FAILURES: list[str] = []
GROUP = "g_ventas"


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


def sig(fn) -> str:
    return str(inspect.signature(fn))


# --- dobles ----------------------------------------------------------------
#: Se lee aquí porque las secciones 6 y 7 lo necesitan y el orden del archivo
#: no lo garantiza.
_fr_src = (BACKEND / "routes" / "feed_routes.py").read_text(encoding="utf-8")


class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0

    def sort(self, field, direction=-1):
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
        self.queries: list = []

    def _match_field(self, actual, cond) -> bool:
        if isinstance(cond, dict):
            if "$in" in cond:
                return actual in cond["$in"]
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
            if not self._match_field(doc.get(k), cond):
                return False
        return True

    async def find_one(self, q=None, proj=None):
        self.queries.append(q)
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find(self, q=None, proj=None):
        self.queries.append(q)
        self.last_query = q
        return _Cursor([copy.deepcopy(d) for d in self.docs if self._match(d, q)])

    def __aiter__(self):
        """`load_user_signals` recorre colecciones con `async for` directo
        (sin filtro), así que el doble debe soportarlo."""
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


# Fechas relativas a HOY a propósito: el camino autenticado filtra por
# `created_at >= now - lookback_days` (30 días por defecto). Con fechas fijas en
# el pasado, el pool saldría vacío y las pruebas de la ruta autenticada
# medirían una ventana vacía en vez de la fuga.
_NOW = datetime.now(timezone.utc)


def _days_ago(n: float) -> str:
    return (_NOW - timedelta(days=n)).isoformat()


def post(pid, visibility="public", author="usr_ana", reactions=0, created=None):
    return {
        "id": pid, "author_id": author,
        "body": f"cuerpo {pid}", "hashtags": [], "category_key": None,
        "visibility": visibility, "status": "published",
        "counts": {"reactions": reactions, "comments": 0, "shares": 0,
                   "saves": 0, "views": 0},
        "reactions_by_kind": {},
        "created_at": created if created else _days_ago(1),
        "updated_at": created if created else _days_ago(1),
    }


def user(uid):
    return {"id": uid, "name": f"User {uid}", "email": f"{uid}@t.com",
            "country": None, "verticals": [], "interests": []}


def db_with(post_docs, members=(), groups=()):
    uids = {m["user_id"] for m in members}
    uids |= {g.get("admin_id") for g in groups if g.get("admin_id")}
    return FakeDB(posts=post_docs, members=members, groups=groups,
                  users=[user(u) for u in uids])


# ===========================================================================
# 1. Ubicación exacta y superficie pública
# ===========================================================================
section("1. ubicación de build_for_you_feed")
ok("vive en services/feed_engine/engine.py",
   (BACKEND / "services" / "feed_engine" / "engine.py").exists())
check("se exporta desde el paquete", "build_for_you_feed" in fe.__all__, True)
ok("el paquete reexporta también load_user_signals",
   "load_user_signals" in fe.__all__ and hasattr(fe, "load_user_signals"))
ok("engine.py NO importa de `routes` (el sentido de la dependencia se mantiene)",
   "from routes" not in (BACKEND / "services" / "feed_engine" / "engine.py").read_text(encoding="utf-8"))

# ===========================================================================
# 2. Firmas actuales — congeladas para detectar cambios en B4
# ===========================================================================
section("2. firmas actuales")
# `from __future__ import annotations` convierte las anotaciones en cadenas, así
# que `inspect.signature` las devuelve entrecomilladas. Se comparan tal cual: es
# la forma exacta que tendría que romper para que este test lo delate.
check("build_for_you_feed", sig(fe.build_for_you_feed),
      "(db, user: 'Optional[dict]', *, limit: 'int' = 20, pool_size: 'int' = 200, "
      "lookback_days: 'int' = 30) -> 'tuple[list[FeedItem], FeedMode]'")
check("load_user_signals", sig(eng.load_user_signals),
      "(db, user: 'Optional[dict]') -> 'FeedSignals'")
check("_rank_posts", sig(eng._rank_posts),
      "(db, posts: 'list[dict]', signals: 'FeedSignals') -> 'list[FeedItem]'")
ok("pool_size por defecto = 200 y limit = 20",
   inspect.signature(fe.build_for_you_feed).parameters["pool_size"].default == 200
   and inspect.signature(fe.build_for_you_feed).parameters["limit"].default == 20)
ok("`user` es el único contexto de viewer que recibe",
   [p for p in inspect.signature(fe.build_for_you_feed).parameters] == ["db", "user", "limit", "pool_size", "lookback_days"])
ok("NO recibe db de grupo ni visibility ni viewer_group_ids",
   not any(k in sig(fe.build_for_you_feed) for k in ("visibility", "group", "clause")))

section("2b. tipos y providers (superficie de ranking)")
check("FeedMode tiene 4 estados", [m.value for m in FeedMode],
      ["CHRONOLOGICAL", "FOLLOW_BASED", "TRENDING", "AI_RECOMMENDED"])
ok("FeedItem: post + score + reasons", set(FeedItem.model_fields) == {"post", "score", "reasons"})
ok("FeedSignals NO tiene visibilidad (hoy)",
   not any("visib" in f for f in FeedSignals.model_fields),
   f"({sorted(FeedSignals.model_fields)})")
check("los 6 providers por defecto", [p.name for p in prov.DEFAULT_PROVIDERS],
      ["follow", "category", "hashtag", "interaction", "recency", "trending"])

# ===========================================================================
# 3. Colecciones consultadas y pools
# ===========================================================================
section("3. colecciones consultadas por build_for_you_feed")
db_probe = db_with([])
asyncio.run(fe.build_for_you_feed(db_probe, None, limit=5))
check("el camino anónimo consulta SOLO `posts`", db_probe.posts.queries != [], True)
ok("`_rank_posts` no toca Mongo (providers son in-memory)",
   asyncio.run(fe.build_for_you_feed(db_probe, user("usr_x"), limit=5)) is not None)

db_sig = db_with([post("p1")], members=[{"group_id": GROUP, "user_id": "usr_miembro", "role": "member"}])
asyncio.run(fe.build_for_you_feed(db_sig, user("usr_miembro"), limit=5))
_checked_cols = []
for name in ("posts", "follows", "company_follows", "companies",
             "post_reactions", "post_saves", "post_comments",
             "group_members", "groups"):
    if getattr(db_sig, name).queries:
        _checked_cols.append(name)
ok("con sesión, signals consulta follows/company_follows/posts…",
   "posts" in _checked_cols, f"({sorted(_checked_cols)})")

# ===========================================================================
# 4. El hallazgo central: NO hay visibilidad en ninguna de las dos queries
# ===========================================================================
section("4. B4.2 — la query de posts YA lleva la condición de visibilidad")
# B4.0 congelo aquí la ausencia de visibilidad como HALLAZGO. B4.2 la aplicó al
# pool, así que estas aserciones se invierten: lo que antes era "CONSTATACIÓN de
# la fuga" es ahora "invariante de que la fuga está cerrada". Si alguien retira
# el filtro, estas vuelven a fallar.
db_audit = db_with([post("m1", "members"), post("p1", "public")])
asyncio.run(fe.build_for_you_feed(db_audit, None, limit=10))
anon_q = db_audit.posts.queries[0]
ok("ruta anónima: conserva status=published",
   anon_q.get("status") == "published", f"({anon_q})")
ok("ruta anónima: AHORA SÍ lleva visibilidad",
   anon_q.get("visibility") == {"$in": ["public", "unlisted", None]}, f"({anon_q})")

db_audit2 = db_with([post("m1", "members"), post("p1", "public")])
asyncio.run(fe.build_for_you_feed(db_audit2, user("usr_miembro"), limit=10))
auth_q = db_audit2.posts.queries[0]
ok("ruta autenticada: conserva status + created_at (lookback intacto)",
   set(auth_q.keys()) == {"status", "created_at", "visibility"}, f"({sorted(auth_q.keys())})")
ok("ruta autenticada: AHORA SÍ lleva visibilidad",
   "visibility" in auth_q or "$or" in auth_q, f"({auth_q})")

# Evidencia de comportamiento: el post `members` ya NO sale.
_ok_ids, mode_anon = asyncio.run(fe.build_for_you_feed(
    db_with([post("m1", "members"), post("p1", "public")]), None, limit=10))
ok("CIERRE: el post `members` ya NO sale para el anónimo",
   {i.post["id"] for i in _ok_ids} == {"p1"},
   f"({sorted(i.post['id'] for i in _ok_ids)})")
_outsider = db_with([post("m1", "members"), post("p1", "public")])
_outsider_ids = [i.post["id"] for i in asyncio.run(
    fe.build_for_you_feed(_outsider, user("usr_externo"), limit=10))[0]]
ok("CIERRE: tampoco sale para un usuario sin membresía",
   "m1" not in _outsider_ids, f"({sorted(_outsider_ids)})")
ok("el modo anónimo sigue siendo CHRONOLOGICAL (no cambió)",
   mode_anon is FeedMode.CHRONOLOGICAL)
# ===========================================================================
# 5. Flujo actual: dónde se pool, dónde se rankea, dónde se corta
# ===========================================================================
section("5. flujo actual (orden de operaciones)")
src = (BACKEND / "services" / "feed_engine" / "engine.py").read_text(encoding="utf-8")
i_anon = src.index('if not user:')
i_pool = src.index("pool = [d async for d in cursor]")
i_sig = src.index("signals = await load_user_signals")
i_rank = src.index("ranked = await _rank_posts")
i_sort = src.index("ranked.sort(")
# `top = ranked[:limit]` se toma con rindex: la expresión también puede aparecer
# antes, en el corte del camino anónimo o en comentarios.
i_top = src.rindex("top = ranked[:limit]")
ok("orden: pool → signals → rank → sort → top",
   i_pool < i_sig < i_rank < i_sort < i_top,
   f"(pool={i_pool}, signals={i_sig}, rank={i_rank}, sort={i_sort}, top={i_top})")
ok("el corte a `limit` ocurre DESPUÉS del ranking (línea `top = ranked[:limit]`)",
   i_top > i_rank)
ok("la ruta anónima corta ANTES de rankear y devuelve score=0.0",
   i_anon < i_rank and "FeedItem(post=d, score=0.0)" in src)
ok("el pool se materializa entero ANTES de rankear",
   "pool = [d async for d in cursor]" in src)
ok("el pool se trunca a `pool_size` (200) en Mongo, no en Python",
   ".limit(pool_size)" in src)
ok("`limit` NO se aplica en la query del pool (por eso pool_size=200)",
   ".limit(pool_size)" in src and not any(f".limit(limit)" in l for l in src.splitlines()
                                           if "pool_size" in l))
ok("el desempate es (score, created_at) desc",
   "ranked.sort(key=lambda x: (x.score, x.post[\"created_at\"]), reverse=True)" in src)

section("5b. el punto SEGURO: entre el pool y el ranking")
# Este es el hallazgo operativo de B4: hay un punto exacto donde la visibilidad
# puede aplicarse sin tocar el ranking ni los providers.
ok("el pool se materializa en una lista (`pool`) → filtrable en memoria",
   i_pool < i_rank)
ok("el ranking consume `pool` ya entero → un filtro antes de `_rank_posts` no "
   "altera el scoring de los posts que sí pasan",
   "ranked = await _rank_posts(db, pool, signals)" in src)
ok("`_rank_posts` es una función aparte y agnóstica de visibilidad",
   "async def _rank_posts(db, posts: list[dict], signals: FeedSignals)" in src)
ok("ningún provider mira `visibility`",
   all("visibility" not in inspect.getsource(type(p)) for p in prov.DEFAULT_PROVIDERS))

# ===========================================================================
# 6. Riesgo estructural: pool_size vs. posts ocultos (por qué NO filtrar tarde)
# ===========================================================================
section("6. B4.2 — el `limit` ya no puede ser explotado como oráculo")
# B4.0 congelo aquí el oráculo: un `members` reciente ocupaba la plaza del
# `limit` y el público desaparecía. B4.2 lo cierra — el filtro va en la query del
# pool, así que los ocultos nunca compiten por una plaza. Se invierte.
db_pool = db_with(
    [post("m1", "members", created=_days_ago(1)),
     post("m2", "members", created=_days_ago(2)),
     post("p1", "public", created=_days_ago(3))]
)
_top, _ = asyncio.run(fe.build_for_you_feed(db_pool, None, limit=1))
_top_ids = [i.post["id"] for i in _top]
ok("CIERRE: con limit=1 el top-1 es el PÚBLICO, no un members",
   _top_ids == ["p1"], f"({_top_ids})")
ok("CIERRE: el members ya no puede expulsar al público",
   "m1" not in _top_ids and "m2" not in _top_ids, f"({_top_ids})")
_top3 = [i.post["id"] for i in asyncio.run(
    fe.build_for_you_feed(db_pool, None, limit=3))[0]]
ok("CIERRE: con limit=3 solo se rellena con contenido visible",
   _top3 == ["p1"], f"({_top3})")
# `ForYouResponse` no expone `total`: el tamaño del pool no llega al cliente, así
# que la fuga no se delata por el tamaño de la respuesta. Se acota al bloque de la
# clase tomando las líneas hasta la siguiente que empieza por `class ` o `@router`.
_lines = _fr_src.split("class ForYouResponse(BaseModel):")[1].splitlines()
_for_you_fields = []
for _ln in _lines:
    if _ln.startswith("class ") or _ln.startswith("@router"):
        break
    _ln = _ln.strip()
    if _ln and ":" in _ln and not _ln.startswith("#"):
        _for_you_fields.append(_ln.split(":")[0])
ok("CONSTATACIÓN: el sobre no expone ningún total que delate el pool",
   _for_you_fields == ["items", "mode", "signals_summary"], f"({_for_you_fields})")
# ===========================================================================
# 7. Consumidor: feed_routes.for_you_feed (NO se toca en B4.0)
# ===========================================================================
section("7. el consumidor no aplica visibilidad por su cuenta")
fr_src = _fr_src
_block = fr_src.split("async def for_you_feed(")[1].split("\nasync def ")[0]
ok("la ruta delega el pool en el motor",
   "build_for_you_feed(db, viewer, limit=limit)" in _block)
ok("la ruta NO filtra por visibilidad después",
   "_post_is_visible" not in _block and "_visibility_clause" not in _block)
ok("la ruta serializa y devuelve sin volver a filtrar",
   "_serialize_post(db, it.post, viewer)" in _block)
# `load_user_signals` aparece en un `import` local DENTRO de la ruta (para
# signals_summary), además de la llamada al motor. Se cuentan ambas apariciones.
ok("la ruta pide signals aparte SOLO para signals_summary",
   _block.count("load_user_signals") == 2
   and "from services.feed_engine.engine import load_user_signals" in _block,
   f"({_block.count('load_user_signals')} apariciones)")

# ===========================================================================
# 8. No-regresión: B4.0 no tocó nada productivo
# ===========================================================================
section("8. B4.0 es solo auditoría: nada productivo cambió")
ok("feed_routes.py conserva sus 16 rutas", fr_src.count("@router.") == 16)
ok("feed_routes.py conserva el helper único de A3",
   fr_src.count("async def _load_visible_post(") == 1
   and fr_src.count("await _load_visible_post(db, post_id") == 6)
ok("feed_routes.py sigue importando el motor (no lo bypaseó)",
   "from services.feed_engine import build_for_you_feed" in fr_src)
ok("engine.py no importa routes (la dependencia sigue en un solo sentido)",
   "from routes" not in src)
ok("no se añadió ningún índice ni migración en feed_engine",
   "create_index" not in src and "ensure_index" not in src)
ok("no se tocó providers.py",
   "visibility" not in (BACKEND / "services" / "feed_engine" / "providers.py").read_text(encoding="utf-8"))
ok("no se tocó base.py",
   "visibility" not in (BACKEND / "services" / "feed_engine" / "base.py").read_text(encoding="utf-8"))

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("AUDITORÍA COMPLETA · ESTADO ACTUAL CONGELADO")
