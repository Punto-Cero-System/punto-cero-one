"""
OMEGA FASE C2 — consumidores de Activities (notifications / realtime / analytics).

Cubre los 10 checks obligatorios del brief:

  1. notifications recibe Activities
  2. realtime recibe Activities
  3. analytics recibe Activities
  4. fallo de notifications no rompe realtime
  5. fallo de realtime no rompe analytics
  6. fallo de analytics no rompe notifications
  7. publish() nunca lanza
  8. Activities no recibe escrituras desde consumidores
  9. no aparecen dobles notificaciones
 10. no aparecen importaciones circulares

Autocontenido y sin Mongo: dobles en memoria + el broker SSE real, igual que
el resto de la suite OMEGA (el pytest del repo está atado a un contenedor Linux
y a un Mongo remoto).
"""
from __future__ import annotations

import ast
import asyncio
import copy
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import activities as act            # noqa: E402
from services import activity_consumers as cons   # noqa: E402
from services import notification_fanout as nf   # noqa: E402
from services import realtime as rt              # noqa: E402

FAILURES: list[str] = []
ACTOR = "usr_ana"
RECIPIENT = "usr_bo"
GROUP = "g_ventas"

#: Colecciones que YA existen en el proyecto. Un consumidor no puede crear otras.
PREEXISTING_COLLECTIONS = {
    "activities", "notifications", "notification_preferences",
    "analytics_events", "analytics_counters", "group_members", "follows", "groups",
}


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


# --- dobles ----------------------------------------------------------------
class _Cursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._i = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._i >= len(self._rows):
            raise StopAsyncIteration
        row = self._rows[self._i]
        self._i += 1
        return row

    async def to_list(self, length=None):
        chunk = self._rows[self._i:self._i + length] if length else self._rows[self._i:]
        self._i += len(chunk)
        return chunk


class _Result:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _Collection:
    """Doble de una colección Motor, con contabilidad de escrituras."""

    def __init__(self, docs=None, fail=False):
        self.docs = list(docs or [])
        self.fail = fail
        self.insert_one_calls = 0
        self.insert_many_calls = 0
        self.update_one_calls = 0
        self.delete_calls = 0

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

    def _guard(self):
        if self.fail:
            raise RuntimeError("mongo no disponible")

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find(self, q=None, proj=None):
        return _Cursor([copy.deepcopy(d) for d in self.docs if self._match(d, q)])

    async def insert_one(self, doc):
        self._guard()
        self.insert_one_calls += 1
        self.docs.append(copy.deepcopy(doc))
        return _Result(inserted_id=1)

    async def insert_many(self, ops):
        self._guard()
        self.insert_many_calls += 1
        for op in ops:
            self.docs.append(copy.deepcopy(getattr(op, "_doc", op)))
        return _Result(inserted_ids=[])

    async def update_one(self, q, update, upsert=False):
        self._guard()
        self.update_one_calls += 1
        inc = update.get("$inc") or {}
        for d in self.docs:
            if self._match(d, q):
                for k, v in inc.items():
                    d[k] = d.get(k, 0) + v
                return _Result(matched_count=1)
        if upsert:
            doc = dict(update.get("$setOnInsert") or {})
            for k, v in (update.get("$set") or {}).items():
                doc[k] = v
            for k, v in inc.items():
                doc[k] = v
            self.docs.append(doc)
        return _Result(matched_count=0, upserted_id=1 if upsert else None)

    async def delete_one(self, q):
        self.delete_calls += 1
        before = len(self.docs)
        self.docs = [d for d in self.docs if not self._match(d, q)]
        return _Result(deleted_count=before - len(self.docs))

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q)])


class FakeDB:
    def __init__(self, members=(), followers=(), silenced=()):
        self.group_members = _Collection(
            [{"group_id": GROUP, "user_id": u, "role": "member"} for u in members])
        self.follows = _Collection(
            [{"user_id": u, "entity_type": "group", "entity_id": GROUP} for u in followers])
        self.groups = _Collection([{"id": GROUP, "name": "Ventas", "privacy": "public"}])
        self.activities = _Collection([])
        self.notifications = _Collection([])
        self.notification_preferences = _Collection(
            [{"user_id": RECIPIENT, "disabled_kinds": list(silenced)}] if silenced else [])
        self.analytics_events = _Collection([])
        self.analytics_counters = _Collection([])

    def writes(self):
        """Escrituras por colección, para el invariante de una sola escritura."""
        return {name: c.insert_one_calls + c.insert_many_calls + c.update_one_calls
                + c.delete_calls
                for name, c in vars(self).items() if isinstance(c, _Collection)}


def direct_activity(**overrides):
    """Activity válida dirigida a UN usuario (audience.type == 'user')."""
    doc = act.build_activity(
        kind="user.followed", actor_id=ACTOR, subject_type="user",
        subject_id=RECIPIENT, audience={"type": "user", "id": RECIPIENT},
        visibility="followers",
    )
    doc.update(overrides)
    return doc


def group_activity(**overrides):
    """Activity de post de grupo: audiencia que el PRODUCTOR ya entregó."""
    doc = act.build_activity(
        kind="group.post_created", actor_id=ACTOR, subject_type="group_post",
        subject_id="gp_1", audience={"type": "group", "id": GROUP},
        visibility="members", metadata={"group_id": GROUP},
    )
    doc.update(overrides)
    return doc


def use_db(db):
    cons.set_db_provider(lambda: db)


def with_fresh_broker():
    """Aísla el singleton del broker SSE. Devuelve (broker, valor guardado)."""
    saved = rt._broker
    rt._broker = rt.RealtimeBroker()
    return rt._broker, saved


def break_consumer(name, exc=RuntimeError):
    """Sustituye un consumidor por uno que revienta. Devuelve el original."""
    original = cons.CONSUMERS[name]

    async def _boom(activity):
        raise exc("consumidor roto a propósito")

    cons.CONSUMERS[name] = _boom
    return original


# ===========================================================================
# 1. notifications recibe Activities
# ===========================================================================
section("1. notifications recibe Activities")
db = FakeDB()
use_db(db)
act_doc = direct_activity()
rep = asyncio.run(cons.publish(act_doc))

check("consumidor registrado", "notifications" in cons.CONSUMERS, True)
ok("estado ok", rep["consumers"]["notifications"] == "ok", rep["consumers"]["notifications"])
check("una notificación escrita", db.notifications.insert_one_calls, 1)
note = db.notifications.docs[0]
check("recipient_id", note["recipient_id"], RECIPIENT)
check("kind mapeado desde la activity", note["kind"], "follower")
check("actor_id", note["actor_id"], ACTOR)
check("subject_id", note["subject_id"], RECIPIENT)
check("subject_type", note["subject_type"], "user")
ok("el kind mapeado está en el vocabulario de notifications",
   note["kind"] in {"reaction", "comment", "follower", "message", "group_join",
                    "group_post", "application", "rsvp"})
ok("no se crea ninguna colección nueva",
   set(db.writes()) <= PREEXISTING_COLLECTIONS, sorted(set(db.writes())))

# El actor nunca se notifica a sí mismo (mismo contrato que dispatch()).
db_self = FakeDB()
use_db(db_self)
asyncio.run(cons.publish(direct_activity(actor_id=RECIPIENT)))
check("el actor no se auto-notifica", db_self.notifications.insert_one_calls, 0)

# Un kind silenciado por el usuario tampoco genera notificación.
db_sil = FakeDB(silenced=("follower",))
use_db(db_sil)
rep_sil = asyncio.run(cons.publish(direct_activity()))
check("kind silenciado → 0 notificaciones", db_sil.notifications.insert_one_calls, 0)
ok("y el reporte lo dice", rep_sil["consumers"]["notifications"].startswith("skipped"),
   rep_sil["consumers"]["notifications"])

# Un kind sin mapeo no debe inventarse una notificación.
db_unmapped = FakeDB()
use_db(db_unmapped)
rep_un = asyncio.run(cons.publish(direct_activity(kind="user.profile_updated")))
check("kind sin mapeo → 0 notificaciones", db_unmapped.notifications.insert_one_calls, 0)
ok("y el salto es explícito", rep_un["consumers"]["notifications"].startswith("skipped"),
   rep_un["consumers"]["notifications"])


# ===========================================================================
# 2. realtime recibe Activities
# ===========================================================================
section("2. realtime recibe Activities")
broker, saved_broker = with_fresh_broker()


async def _realtime_roundtrip():
    """Publica una activity y recoge los eventos que llegan al suscriptor.

    OJO: llegan DOS eventos y no es un duplicado. `notifications.dispatch()`
    ya emitía `notification` (efecto colateral del write del inbox, F0.9.1), y
    el consumidor de realtime añade `feed`, que es la señal de actividad.
    Son contratos distintos y ambos son correctos.
    """
    stream = broker.subscribe(RECIPIENT)
    await stream.__anext__()                       # system.hello
    activity = direct_activity()
    report = await cons.publish(activity)
    chunks = [await stream.__anext__() for _ in range(3)]
    await stream.aclose()
    return activity, report, chunks


rt_activity, rep_rt, chunks = asyncio.run(_realtime_roundtrip())
rt._broker = saved_broker

ok("estado ok", rep_rt["consumers"]["realtime"] == "ok", rep_rt["consumers"]["realtime"])
kinds_seen = [c.split("\n", 1)[0] for c in chunks if c.strip()]
ok("llega el evento 'feed' (contrato ya existente en el broker y el front)",
   "event: feed" in kinds_seen, kinds_seen)
ok("'notification' y 'feed' son eventos distintos, no un duplicado",
   len(set(kinds_seen)) == len(kinds_seen), kinds_seen)

feed_chunk = next(c for c in chunks if c.startswith("event: feed"))
payload = json.loads(feed_chunk.split("data: ", 1)[1])
check("kind en el payload", payload["data"]["kind"], "user.followed")
check("activity_id en el payload", payload["data"]["activity_id"], rt_activity["id"])
ok("el payload es JSON-serializable (expires_at BSON excluido)",
   "expires_at" not in payload["data"])
ok("el actor no recibe su propio evento",
   asyncio.run(cons.publish(direct_activity(actor_id=RECIPIENT)))["consumers"]["realtime"]
   .startswith("skipped"))


# ===========================================================================
# 3. analytics recibe Activities
# ===========================================================================
section("3. analytics recibe Activities")
db_an = FakeDB()
use_db(db_an)
doc_an = group_activity()          # audiencia broadcast: analytics no depende de la audiencia
rep_an = asyncio.run(cons.publish(doc_an))

ok("estado ok", rep_an["consumers"]["analytics"] == "ok", rep_an["consumers"]["analytics"])
check("un evento de analytics", db_an.analytics_events.insert_one_calls, 1)
ev = db_an.analytics_events.docs[0]
check("name = kind de la activity (sin tabla de traducción)", ev["name"], "group.post_created")
check("actor_id", ev["actor_id"], ACTOR)
check("subject_type", ev["subject_type"], "group_post")
check("subject_id", ev["subject_id"], "gp_1")
check("payload.activity_id", ev["payload"]["activity_id"], doc_an["id"])
ok("el contador diario se rolls", db_an.analytics_counters.update_one_calls >= 1)
counters = {(c.get("name"), c.get("day")) for c in db_an.analytics_counters.docs}
ok("contador con el nombre del evento", ("group.post_created", ev["day"]) in counters, counters)

# analytics NO debe duplicar: el productor (groups_routes) no llama a record_event.
gr_src = (BACKEND / "routes" / "groups_routes.py").read_text(encoding="utf-8")
ok("el productor de activities no llama a record_event (analytics no duplica)",
   "record_event" not in gr_src)


# ===========================================================================
# 4-6. Aislamiento: un consumidor roto no rompe a los demás
# ===========================================================================
def isolation_case(broken_name, witness_names):
    """Rompe un consumidor y comprueba que los demás siguen entregando."""
    db_iso = FakeDB()
    use_db(db_iso)
    broker, saved = with_fresh_broker()

    async def _run():
        stream = broker.subscribe(RECIPIENT)
        await stream.__anext__()                       # system.hello
        original = break_consumer(broken_name)
        try:
            return await cons.publish(direct_activity()), await stream.__anext__()
        finally:
            cons.CONSUMERS[broken_name] = original
            await stream.aclose()

    report, _ = asyncio.run(_run())
    rt._broker = saved

    check(f"{broken_name} roto queda reportado como error",
          report["consumers"][broken_name], "error: RuntimeError")
    for witness in witness_names:
        ok(f"{witness} sigue funcionando con {broken_name} caído",
           report["consumers"][witness] == "ok", report["consumers"][witness])
    # La notificación del testigo de notifications es la prueba material.
    if "notifications" in witness_names:
        check("la notificación sí se escribió pese al fallo", db_iso.notifications.insert_one_calls, 1)
    if "analytics" in witness_names:
        check("el evento de analytics sí se escribió pese al fallo",
              db_iso.analytics_events.insert_one_calls, 1)
    return db_iso


section("4. fallo de notifications no rompe realtime / analytics")
iso4 = isolation_case("notifications", ["realtime", "analytics", "observability"])

section("5. fallo de realtime no rompe analytics / notifications")
iso5 = isolation_case("realtime", ["notifications", "analytics", "observability"])

section("6. fallo de analytics no rompe notifications / realtime")
iso6 = isolation_case("analytics", ["notifications", "realtime", "observability"])


# ===========================================================================
# 7. publish() nunca lanza
# ===========================================================================
section("7. publish nunca lanza")
db7 = FakeDB()
use_db(db7)
saved_all = {n: cons.CONSUMERS[n] for n in list(cons.CONSUMERS)}

# Rompe los cuatro a la vez: ni siquiera así publish puede propagar.
for name in list(cons.CONSUMERS):
    break_consumer(name)
try:
    rep7 = asyncio.run(cons.publish(direct_activity()))
    check("publish no lanzó con los 4 consumidores rotos", rep7["published"], 0)
    ok("los 4 quedan reportados como error",
       all(v == "error: RuntimeError" for v in rep7["consumers"].values()), rep7["consumers"])
    # publish tampoco lanza con basura como entrada.
    check("publish(None) es no-op", asyncio.run(cons.publish(None)),
          {"published": 0, "consumers": {}})
    check("publish({}) es no-op", asyncio.run(cons.publish({})),
          {"published": 0, "consumers": {}})
    check("publish('texto') es no-op", asyncio.run(cons.publish("no soy una activity")),
          {"published": 0, "consumers": {}})
    ok("nunca se escribió nada en notifications ni analytics",
       db7.notifications.insert_one_calls == 0 and db7.analytics_events.insert_one_calls == 0)
finally:
    cons.CONSUMERS.update(saved_all)

ok("consumidores restaurados", sorted(cons.CONSUMERS) == sorted(saved_all))


# ===========================================================================
# 8. Activities no recibe escrituras desde los consumidores
# ===========================================================================
section("8. Activities no recibe escrituras desde consumidores")
db8 = FakeDB()
use_db(db8)
stored = asyncio.run(act.record(
    db8, kind="group.post_created", actor_id=ACTOR, subject_type="group_post",
    subject_id="gp_1", audience={"type": "group", "id": GROUP}, visibility="members",
    metadata={"group_id": GROUP},
))
ok("la activity se escribió una vez", stored is not None)
check("una escritura en activities", db8.activities.insert_one_calls, 1)

rep8 = asyncio.run(cons.publish(stored))
ok("todos los consumidores corrieron", rep8["published"] >= 2, rep8["consumers"])
check("publish NO vuelve a escribir en activities", db8.activities.insert_one_calls, 1)
check("ni borra", db8.activities.delete_calls, 0)
check("ni actualiza", db8.activities.update_one_calls, 0)
ok("los consumidores escriben en sus propias colecciones, no en activities",
   set(db8.writes()) <= PREEXISTING_COLLECTIONS, sorted(db8.writes()))

# Ningún consumidor llama a activities.record(): se comprueba sobre el AST,
# no con un `in` sobre el texto (el docstring menciona activities.record()).
cons_src = (BACKEND / "services" / "activity_consumers.py").read_text(encoding="utf-8")
cons_tree = ast.parse(cons_src)
write_calls = [
    node.func.attr for node in ast.walk(cons_tree)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    and node.func.attr in {"record", "insert_one", "insert_many", "update_one",
                           "update_many", "delete_one", "delete_many",
                           "find_one_and_update", "create_index", "ensure_index"}
]
ok("ningún consumidor escribe en activities",
   "record" not in write_calls, write_calls)
ok("y las únicas escrituras son las de sus propias colecciones",
   set(write_calls) <= {"record_event"}, sorted(set(write_calls)))


# ===========================================================================
# 9. No aparecen dobles notificaciones
# ===========================================================================
section("9. No aparecen dobles notificaciones")

# (a) El caso real: un post de grupo. La ruta hace el fan-out (F0.9.1) y
#     publish() se llama también. El consumidor NO debe añadir un segundo envío.
db_dup = FakeDB(members=[ACTOR, RECIPIENT, "usr_ca"], followers=["usr_ca"])
use_db(db_dup)
grp = asyncio.run(act.record(
    db_dup, kind="group.post_created", actor_id=ACTOR, subject_type="group_post",
    subject_id="gp_9", audience={"type": "group", "id": GROUP}, visibility="members",
    metadata={"group_id": GROUP},
))
rep_dup = asyncio.run(cons.publish(grp))
ok("el consumidor NO notifica a una audiencia del productor",
   rep_dup["consumers"]["notifications"].startswith("skipped"),
   rep_dup["consumers"]["notifications"])
check("0 notificaciones del consumidor", db_dup.notifications.insert_one_calls, 0)

# Ahora la ruta real ejecuta su fan-out: el resultado debe ser 1 por miembro.
fanout = asyncio.run(nf.fanout_to_group_members(
    db_dup, GROUP, exclude_user_id=ACTOR, kind="group_post",
    title="Alguien publicó en Ventas", actor={"id": ACTOR},
    subject_type="group_post", subject_id="gp_9",
))
check("miembro+follower entrega una vez", fanout["sent"], 2)
check("duplicados colapsados en el ciclo", fanout["duplicates"], 0)
per_recipient = {}
for n in db_dup.notifications.docs:
    per_recipient.setdefault(n["recipient_id"], []).append(n["id"])
ok("exactamente 1 notificación por receptor",
   all(len(v) == 1 for v in per_recipient.values()), per_recipient)
ok("el actor nunca aparece", ACTOR not in per_recipient, sorted(per_recipient))

# (b) Una audiencia broadcast tampoco se re-entrega.
db_bc = FakeDB()
use_db(db_bc)
rep_bc = asyncio.run(cons.publish(direct_activity(
    audience={"type": "followers", "id": None}, visibility="public")))
ok("una audiencia broadcast tampoco se entrega dos veces",
   rep_bc["consumers"]["notifications"].startswith("skipped"),
   rep_bc["consumers"]["notifications"])
check("0 notificaciones", db_bc.notifications.insert_one_calls, 0)

# (c) Estructural: el consumidor solo acepta audiencia de tipo 'user'.
ok("'group' está declarado como audiencia del productor",
   "group" in cons.PRODUCER_OWNED_AUDIENCES, sorted(cons.PRODUCER_OWNED_AUDIENCES))
check("el consumidor no acepta audiencia de grupo",
      cons._recipient(group_activity()), None)
check("y sí acepta una audiencia de usuario", cons._recipient(direct_activity()), RECIPIENT)

# (d) Sin db no hay notificación, y tampoco excepción.
use_db(None)
rep_none = asyncio.run(cons.publish(direct_activity()))
ok("sin db: salto explícito, no excepción",
   rep_none["consumers"]["notifications"].startswith("skipped"),
   rep_none["consumers"]["notifications"])
ok("sin db: analytics también hace skip",
   rep_none["consumers"]["analytics"].startswith("skipped"),
   rep_none["consumers"]["analytics"])
ok("sin db: realtime no depende de la db y sigue ok",
   rep_none["consumers"]["realtime"] == "ok", rep_none["consumers"]["realtime"])

# ===========================================================================
# 10. No aparecen importaciones circulares / no hay cola ni worker
# ===========================================================================
section("10. No aparecen importaciones circulares")


def imports_of(path: Path) -> set:
    """Módulos de primer nivel importados por el fichero dado."""
    mods = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            base = [b for b in (node.module or "").split(".") if b]
            for alias in node.names:
                mods.add(".".join(base + [alias.name]))
        elif isinstance(node, ast.Import):
            mods.update(a.name for a in node.names)
    return mods


SVC = {p.stem: imports_of(p) for p in (BACKEND / "services").glob("*.py")}
deps = {m: {d for d in SVC[m] if d.startswith("services.")} for m in SVC}

# El grafo de servicios completo debe seguir siendo acíclico.
edges = {m: {d.split(".")[-1] for d in deps[m]} for m in SVC}
cycles = set()
for start in SVC:
    stack = [(start, [start])]
    while stack:
        node, path = stack.pop()
        for nxt in sorted(edges.get(node, ())):
            if nxt in path:
                cycles.add(" -> ".join(path + [nxt]))
            elif nxt in SVC and nxt not in path:
                stack.append((nxt, path + [nxt]))
check("sin ciclos en todo el paquete services", sorted(cycles), [])

CONSUMER_DEPS = {"notifications", "realtime", "analytics", "activities"}
ok("activity_consumers -> notifications, realtime, analytics, activities",
   CONSUMER_DEPS <= {d.split(".")[-1] for d in deps["activity_consumers"]},
   sorted(d.split(".")[-1] for d in deps["activity_consumers"]))
ok("ninguno de esos importa activity_consumers (unidireccional)",
   not any("activity_consumers" in d for m in CONSUMER_DEPS
           for d in deps.get(m, ())),
   {m: sorted(d for d in deps.get(m, ()) if "activity_consumers" in d)
    for m in sorted(CONSUMER_DEPS)})
ok("activities sigue sin depender de consumers",
   not any("activity_consumers" in d for d in deps["activities"]))
ok("activity_consumers no importa server (db vía sys.modules → sin arista nueva)",
   "server" not in SVC["activity_consumers"], sorted(SVC["activity_consumers"]))
ok("no hay ningún 'import server' en el fuente", "import server" not in cons_src)

# No cola, no worker, no infraestructura nueva.
FORBIDDEN = ("BackgroundTasks", "redis", "celery", "dramatiq", "kafka", "rabbitmq",
             "create_task", "ensure_future", "to_thread", "asyncio.Queue", "Thread(")
ok("sin BackgroundTasks/redis/celery/dramatiq/kafka/create_task/colas/workers",
   not any(w in cons_src for w in FORBIDDEN),
   [w for w in FORBIDDEN if w in cons_src])
ok("los consumidores son async in-process (await directo, sin task)",
   "await " in cons_src and "create_task" not in cons_src)
ok("no se define ningún índice nuevo",
   "create_index" not in cons_src and "ensure_index" not in cons_src)
ok("no se migra nada",
   not any(w in cons_src for w in ("migrate", "update_many", "drop_index", "rename")))

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")
