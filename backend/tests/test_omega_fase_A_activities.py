"""
OMEGA FASE A — cierre de la capa Activities (F0.9.5 → F0.9.7).

Cubre los 7 casos obligatorios del brief:

  1. Crear post de grupo genera activity
  2. Fallo de activities no rompe el post
  3. Miembro + follower no genera duplicado
  4. Actor excluido
  5. Grupo privado respeta permisos
  6. Activities mantiene el contrato actual
  7. No existen imports circulares

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import ast
import asyncio
import copy
import sys
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import activities as act  # noqa: E402
from services import activity_consumers as cons  # noqa: E402
from services import social_audience as aud  # noqa: E402

FAILURES = []
GROUP = "g_ventas"
AUTHOR = "usr_ana"


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


def raises(label, fn, exc=act.ActivityValidationError):
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
class _Collection:
    def __init__(self, docs=None, fail=False):
        self.docs = list(docs or [])
        self.fail = fail
        self.insert_one_calls = 0
        self.deleted = []

    @staticmethod
    def _match(doc, q):
        for k, v in (q or {}).items():
            actual = doc.get(k)
            if isinstance(v, dict) and ("$ne" in v or "$in" in v):
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
        rows = [copy.deepcopy(d) for d in self.docs if self._match(d, q)]
        return _Cursor(rows)

    async def insert_one(self, doc):
        if self.fail:
            raise RuntimeError("mongo no disponible")
        self.insert_one_calls += 1
        self.docs.append(copy.deepcopy(doc))
        return type("R", (), {"inserted_id": 1})()

    async def insert_many(self, ops):
        for op in ops:
            await self.insert_one(getattr(op, "_doc", op))

    async def update_one(self, q, update, upsert=False):
        return _Result()

    async def delete_one(self, q):
        before = len(self.docs)
        self.docs = [d for d in self.docs
                     if not all(d.get(k) == v for k, v in q.items())]
        self.deleted.append(q)
        return type("R", (), {"deleted_count": before - len(self.docs)})()

    async def count_documents(self, q=None):
        return len(self.docs)

    async def find_one_and_update(self, flt, update, upsert=False,
                                   return_document=None):
        ex = await self.find_one(flt)
        if ex is not None:
            return ex
        self.docs.append(copy.deepcopy(update["$setOnInsert"]))
        return copy.deepcopy(update["$setOnInsert"])


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

    async def to_list(self, length=None):
        chunk = self._rows[self._i:self._i + length] if length else self._rows[self._i:]
        self._i += len(chunk)
        return chunk


class _Result:
    inserted_ids = []
    deleted_count = 0
    upserted_id = None


class FakeDB:
    def __init__(self, members=(), followers=(), group=None,
                 activities_fail=False, groups_fail=False):
        self.group_members = _Collection(
            [{"group_id": GROUP, "user_id": u, "role": "member"} for u in members])
        self.follows = _Collection(
            [{"user_id": u, "entity_type": "group", "entity_id": GROUP}
             for u in followers])
        self.groups = _Collection([group] if group else
                                  [{"id": GROUP, "name": "Ventas", "privacy": "public"}],
                                  fail=groups_fail)
        self.activities = _Collection([], fail=activities_fail)
        self.group_posts = _Collection([])
        self.notifications = _Collection([])
        # Necesaria: notification_fanout consulta preferencias por lote.
        # Sin ella el fan-out cae en su soft-fail y no entrega nada.
        self.notification_preferences = _Collection([])


def make_request(db):
    return type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()


def call_route(db, body="Hola equipo", user_id=AUTHOR):
    """Invoca la ruta REAL de FastAPI, no una copia del emisor."""
    from routes import groups_routes as gr
    payload = gr.GroupPostCreate(body=body)
    return asyncio.run(gr.create_group_post(
        GROUP, payload, make_request(db), {"id": user_id, "name": "Ana", "picture": "p1"}))


section("1. Crear post de grupo genera activity")
db = FakeDB(members=["usr_ana", "usr_bo", "usr_ca"])
res = call_route(db)
check("post creado", res["group_id"], GROUP)
check("una activity persistida", len(db.activities.docs), 1)
act_doc = db.activities.docs[0]
check("actor_id", act_doc["actor_id"], AUTHOR)
check("kind", act_doc["kind"], "group.post_created")
check("subject_type", act_doc["subject_type"], "group_post")
check("subject_id", act_doc["subject_id"], res["id"])
check("audience", act_doc["audience"], {"type": "group", "id": GROUP})
check("visibility", act_doc["visibility"], "members")
check("metadata.group_id", act_doc["metadata"]["group_id"], GROUP)
ok("expires_at es Date", isinstance(act_doc["expires_at"], datetime))
ok("created_at es ISO string", isinstance(act_doc["created_at"], str))
check("el flujo de notificaciones sigue vivo", len(db.notifications.docs) > 0, True)
check("y sin duplicar al actor", AUTHOR in
      [d["recipient_id"] for d in db.notifications.docs], False)

section("2. Fallo de activities NO rompe el post")
# El autor debe ser miembro: la ruta exige membresía para publicar.
db_fail = FakeDB(members=[AUTHOR, "usr_bo", "usr_ca"], activities_fail=True)
res2 = call_route(db_fail)
check("el post se creó igualmente", res2["group_id"], GROUP)
ok("el body del post está intacto", res2["body"] == "Hola equipo")
check("no se registró activity", len(db_fail.activities.docs), 0)
check("las notificaciones se entregaron igual", len(db_fail.notifications.docs) > 0, True)

# Y si la ruta misma fallara (no solo record): el try/except del callsite
# es la garantía. Se comprueba aislando el registro.
async def exploding_record(*a, **k):
    raise RuntimeError("activities totalmente caída")
import routes.groups_routes as gr  # noqa: E402
saved = gr.record_activity
gr.record_activity = exploding_record
try:
    db3 = FakeDB(members=[AUTHOR, "usr_bo"])
    res3 = call_route(db3)
    check("aun con record() explo, el post se creó", res3["group_id"], GROUP)
    check("y las notificaciones salieron", len(db3.notifications.docs) > 0, True)
finally:
    gr.record_activity = saved

section("3. Miembro + follower NO genera duplicado (caso que motivó F0.9.6)")
db_dup = FakeDB(members=["usr_bo", "usr_ca"], followers=["usr_ca", "usr_de"])
out = asyncio.run(aud.resolve_group_audience(
    db_dup, GROUP, exclude_user_id=AUTHOR, group={"id": GROUP, "privacy": "public"}))
check("audiencia única", out["user_ids"], ["usr_bo", "usr_ca", "usr_de"])
check("duplicado fusionado", out["duplicates_merged"], 1)
ok("ningún usuario repetido", len(out["user_ids"]) == len(set(out["user_ids"])))
check("miembros contados", out["members"], 2)
check("followers contados", out["followers"], 2)

# Y el fan-out real no duplica cuando recibe la audiencia resuelta
from services.notification_fanout import dispatch_batch  # noqa: E402
db_nb = FakeDB()
asyncio.run(dispatch_batch(
    db_nb, out["user_ids"], kind="group_post", title="t", body="b",
    actor={"id": AUTHOR, "name": "Ana"}, subject_type="group_post",
    subject_id="gp_1", subject_url="/x"))
check("una notificación por usuario", len(db_nb.notifications.docs), 3)
check("sin destinatario repetido",
      len({d["recipient_id"] for d in db_nb.notifications.docs}), 3)

section("4. Actor excluido")
out_ex = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=["usr_bo"], followers=["usr_ca"]),
    GROUP, exclude_user_id=AUTHOR, group={"id": GROUP, "privacy": "public"}))
check("el actor no aparece", AUTHOR in out_ex["user_ids"], False)
ok("actor_excluded True", out_ex["actor_excluded"])
out_noex = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=[AUTHOR, "usr_bo"]), GROUP, group={"id": GROUP, "privacy": "public"}))
check("sin exclude, el autor sí está", AUTHOR in out_noex["user_ids"], True)

section("5. Grupo privado respeta permisos")
pub = {"id": GROUP, "name": "Ventas", "privacy": "public"}
priv = {"id": GROUP, "name": "Clave", "privacy": "private"}
out_pub = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=["usr_bo"], followers=["usr_ca"]), GROUP, group=pub))
check("público: miembros + followers", out_pub["user_ids"], ["usr_bo", "usr_ca"])
check("público: ninguno excluido", out_pub["followers_excluded"], 0)
out_priv = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=["usr_bo"], followers=["usr_ca"]), GROUP, group=priv))
check("privado: solo miembros", out_priv["user_ids"], ["usr_bo"])
check("followers excluidos", out_priv["followers_excluded"], 1)
ok("la privacidad se aplica en el resolver, no en el caller",
   len(out_priv["user_ids"]) < len(out_pub["user_ids"]))
out_priv2 = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=["usr_bo", "usr_ca"], followers=["usr_ca"]), GROUP, group=priv))
check("miembro+follower en privado → una vez", out_priv2["user_ids"], ["usr_bo", "usr_ca"])
check("y fusionado, no excluido", out_priv2["duplicates_merged"], 1)
# legacy sin privacy = público
out_leg = asyncio.run(aud.resolve_group_audience(
    FakeDB(members=["usr_bo"], followers=["usr_ca"]), GROUP, group={"id": GROUP}))
check("legacy sin privacy → público", out_leg["user_ids"], ["usr_bo", "usr_ca"])

section("6. Activities mantiene el contrato actual")
check("CONTRACT_VERSION", act.CONTRACT_VERSION, 1)
check("11 campos en el documento", len(act_doc), 11)
check("mismas claves que F0.9.3", set(act_doc), {
    "id", "activity_key", "actor_id", "kind", "subject_type", "subject_id",
    "audience", "visibility", "metadata", "created_at", "expires_at"})
raises("vocabulario cerrado sigue estricto",
       lambda: act.build_activity(
           kind="group.post_created", actor_id=AUTHOR, subject_type="group_post",
           subject_id="gp_1", audience={"type": "group", "id": GROUP},
           visibility="members", metadata={"group_id": GROUP},
           idempotency_key="k", retention_days=0))
# El emisor usa un kind y un subject_type declarados en el vocabulario.
ok("'group.post_created' está en ACTIVITY_KINDS",
   "group.post_created" in act.ACTIVITY_KINDS)
ok("'group_post' está en SUBJECT_TYPES", "group_post" in act.SUBJECT_TYPES)
ok("'group' está en AUDIENCE_TYPES", "group" in act.AUDIENCE_TYPES)
ok("'members' está en VISIBILITIES", "members" in act.VISIBILITIES)
# El post sigue siendo la fuente del contenido; la activity solo lo referencia
ok("la activity no duplica el body del post", "body" not in act_doc)
ok("ni el nombre del grupo", "group_name" not in act_doc.get("metadata", {}))

section("6b. Puente de consumidores (F0.9.7)")
# OMEGA FASE C2 registró los consumidores reales (notifications, realtime,
# analytics). La guarda original de Fase A —"solo observability, todavía no
# cables los otros"— la invierte C2 a propósito; lo que NO puede cambiar es que
# el puente siga siendo inocuo para una activity de audiencia de grupo, que es
# la que produce esta fase.
ok("observability sigue registrado", "observability" in cons.CONSUMERS, sorted(cons.CONSUMERS))
ok("notifications, realtime y analytics registrados (C2)",
   {"notifications", "realtime", "analytics"} <= set(cons.CONSUMERS), sorted(cons.CONSUMERS))
rep = asyncio.run(cons.publish(act_doc))
check("consumidor ok", rep["consumers"]["observability"], "ok")
# Sin `db` los consumidores con base de datos hacen skip explícito, no excepción.
ok("los consumidores con DB hacen skip, no error",
   rep["consumers"]["analytics"].startswith("skipped"), rep["consumers"]["analytics"])
# Y la audiencia de grupo la entrega el PRODUCTOR (F0.9.1), no el consumidor.
ok("una audiencia de grupo no la re-entrega el consumidor",
   rep["consumers"]["notifications"].startswith("skipped"),
   rep["consumers"]["notifications"])
check("publish(None) es no-op", asyncio.run(cons.publish(None)),
      {"published": 0, "consumers": {}})

# Aislamiento: un consumidor roto no impide a los demás
async def broken(a):
    raise RuntimeError("consumidor roto")
async def fine(a):
    return "ok"
cons.register("broken", broken)
cons.register("fine", fine)
try:
    rep2 = asyncio.run(cons.publish(act_doc))
    check("el roto se aísla", rep2["consumers"]["broken"], "error: RuntimeError")
    check("el sano corre igual", rep2["consumers"]["fine"], "ok")
    check("ambos intentados", rep2["published"], 2)
    ok("publish no lanzó pese al consumidor roto", True)
finally:
    cons.unregister("broken")
    cons.unregister("fine")

# Invariante de escritura única: los consumidores no escriben activities
db_w = FakeDB()
asyncio.run(act.record(db_w, kind="group.post_created", actor_id=AUTHOR,
                       subject_type="group_post", subject_id="gp_1",
                       audience={"type": "group", "id": GROUP},
                       visibility="members"))
check("una escritura", db_w.activities.insert_one_calls, 1)
asyncio.run(cons.publish(db_w.activities.docs[0]))
check("publish NO vuelve a escribir", db_w.activities.insert_one_calls, 1)
# C2: los consumidores están cableados, pero el de notificaciones NO duplica el
# fan-out que ya hace `create_group_post` para la misma activity de grupo.
check("el consumidor NO duplica el fan-out del productor",
      db_w.notifications.insert_one_calls, 0)

section("7. No existen imports circulares")
def imports_of(path: Path):
    """Módulos de primer nivel importados por el fichero dado."""
    mods = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            base = (node.module or "").split(".")
            for alias in node.names:
                mods.add(".".join([b for b in base if b != ""] + [alias.name]))
        elif isinstance(node, ast.Import):
            mods.update(a.name for a in node.names)
    return mods


SVC = {p.stem: imports_of(p) for p in (BACKEND / "services").glob("*.py")}
NEW = ["activities", "activity_consumers", "social_audience"]
for mod in NEW:
    deps = sorted({d for d in SVC[mod] if d.startswith("services.")})
    print(f"        {mod} -> {deps}")

# Grafo dirigido entre los 3 módulos nuevos: debe ser acíclico.
# imports_of devuelve "modulo.submodulo.nombre", así que un import de
# `from services.group_permissions import PUBLIC` aparece como
# "services.group_permissions.PUBLIC": se compara por prefijo de módulo.
edges = {m: {d.split(".")[-1] for d in SVC[m] if d.startswith("services.")}
         for m in NEW}
deps_of = {m: {d for d in SVC[m] if d.startswith("services.")} for m in NEW}
for a in NEW:
    print(f"        {a} -> {sorted(deps_of[a])}")

cycles = []
for a in NEW:
    for b in edges[a] & set(NEW):
        if a in edges.get(b, set()):
            cycles.append(f"{a} <-> {b}")
check("sin ciclos entre los módulos nuevos", cycles, [])
ok("activity_consumers -> activities (unidireccional)",
   any(d.startswith("services.activities") for d in deps_of["activity_consumers"])
   and not any(d.startswith("services.activity_consumers")
               for d in deps_of["activities"]))
ok("activities no depende de consumers ni de audience",
   not any(d.startswith(("services.activity_consumers", "services.social_audience"))
           for d in deps_of["activities"]))
ok("social_audience no depende de activities",
   not any(d.startswith("services.activities") for d in deps_of["social_audience"]))
ok("social_audience -> group_permissions (reutiliza F0.8, no lo reimplementa)",
   any(d.startswith("services.group_permissions") for d in deps_of["social_audience"]))

# No hay cola ni worker
for mod in NEW:
    src = (BACKEND / "services" / f"{mod}.py").read_text(encoding="utf-8")
    ok(f"{mod}: sin BackgroundTasks/redis/celery",
       not any(w in src for w in ("BackgroundTasks", "redis", "celery", "dramatiq")))

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")


