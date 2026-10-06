"""
OMEGA F0.9.1 — evidencia de la optimización del fan-out de notificaciones.

Ejercita `services.notification_fanout` contra un doble de MongoDB. Cubre los
4 casos mínimos del brief:

  1. Grupo pequeño funciona igual              → paridad con dispatch()
  2. Grupo mayor a 500 no pierde destinatarios  → el tope silencioso desapareció
  3. Error de notificación no rompe publicación → soft-fail intacto
  4. Miembros duplicados no reciben duplicados  → dedupe en todo el ciclo

Más los invariantes de `dispatch()` que NO pueden romperse: el actor nunca se
notifica, quien silenció el kind no recibe, realtime es best-effort y ocurre
después del write, y la forma del documento es idéntica.

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services import notification_fanout as nf  # noqa: E402
from services import notifications as notif  # noqa: E402

FAILURES = []
GROUP = "g_ventas"
ACTOR = {"id": "u_author", "name": "Ana", "picture": "p1"}


def check(label, actual, expected):
    if asyncio.iscoroutine(actual):
        actual = asyncio.run(actual)
    good = actual == expected
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {actual!r} (esperado {expected!r})")
    if not good:
        FAILURES.append(f"{label}: {actual!r} != {expected!r}")


def ok(label, condition, detail=""):
    passed = bool(condition)
    print(f"  {'PASS' if passed else 'FAIL'}  {label} {detail}")
    if not passed:
        FAILURES.append(f"{label} {detail}")


class _Cursor:
    """Cursor de Motor: soporta `async for` y `to_list(length=N)`."""

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
        return copy.deepcopy(chunk)


class _Result:
    def __init__(self, inserted_ids=None):
        self.inserted_ids = inserted_ids or []


class _Collection:
    def __init__(self, docs=None, fail_on=None):
        self.docs = docs or []
        self.fail_on = fail_on
        self.insert_many_calls = 0
        self.inserted = 0

    @staticmethod
    def _match(doc, q):
        for k, v in (q or {}).items():
            actual = doc.get(k)
            if isinstance(v, dict):
                if "$in" in v and actual not in v["$in"]:
                    return False
                if "$ne" in v and actual == v["$ne"]:
                    return False
            elif actual != v:
                return False
        return True

    def find(self, q=None, proj=None):
        return _Cursor([d for d in self.docs if self._match(d, q)])

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    async def insert_many(self, ops):
        if self.fail_on == "insert":
            raise RuntimeError("mongo unavailable")
        self.insert_many_calls += 1
        for op in ops:
            self.inserted += 1
            self.docs.append(getattr(op, "_doc", op))
        return _Result()

    async def insert_one(self, doc):
        await self.insert_many([doc])
        return _Result()


class FakeDB:
    def __init__(self, members=None, prefs=None, fail_notifications=False):
        self.group_members = _Collection(members or [])
        self.notification_preferences = _Collection(prefs or [])
        self.notifications = _Collection(
            [], fail_on="insert" if fail_notifications else None)


def members(n, group=GROUP):
    return [{"group_id": group, "user_id": f"u_{i}", "role": "member"}
            for i in range(n)]


async def run(members_n, *, batch_size=nf.DEFAULT_BATCH_SIZE, group=GROUP,
              exclude=ACTOR["id"], db=None, **payload):
    db = db or FakeDB(members=members(members_n, group))
    args = dict(
        kind="group_post",
        title="Ana publicó en Ventas",
        body="hola",
        actor=ACTOR,
        subject_type="group_post",
        subject_id="gp_1",
        subject_url=f"/comunidad?group={group}",
    )
    args.update(payload)
    result = await nf.fanout_to_group_members(
        db, group, exclude_user_id=exclude, batch_size=batch_size, **args)
    return result, db


def section(title):
    print(f"\n{title}")


section("1. Grupo pequeño — paridad con dispatch()")
res, db = asyncio.run(run(3))
check("miembros notificados", res["recipients"], 3)
check("documentos insertados", res["sent"], 3)
check("duplicados", res["duplicates"], 0)
ok("el autor no se notifica",
   all(d["recipient_id"] != ACTOR["id"] for d in db.notifications.docs))
ok("un insert_many por lote", db.notifications.insert_many_calls == 1,
   f"(llamadas={db.notifications.insert_many_calls})")

section("2. Grupo mayor a 500 — el tope silencioso desapareció")
res, db = asyncio.run(run(1200, batch_size=200))
check("todos los destinatarios", res["recipients"], 1200)
check("todos notificados", res["sent"], 1200)
check("nadie se perdió", len(db.notifications.docs), 1200)
check("lotes procesados", res["batches"], 6)
ok("ningún límite de 500", res["sent"] > 500, f"(enviados={res['sent']})")
check("un insert_many por lote de 200", db.notifications.insert_many_calls, 6)

section("3. Error de notificación no rompe la publicación")
db = FakeDB(members=members(50), fail_notifications=True)
res, _ = asyncio.run(run(50, db=db))
ok("dispatch_batch no lanza", True)
check("fallos contabilizados", res["failed"] > 0, True)
check("nada se marca como enviado", res["sent"], 0)

section("4. Miembros duplicados no reciben duplicados")
dupes = members(10) + members(10)
dupes += [{"group_id": GROUP, "user_id": "u_3", "role": "member"}]
db = FakeDB(members=dupes)
res, db = asyncio.run(run(0, db=db))
check("destinatarios únicos", res["recipients"], 10)
check("documentos insertados", res["sent"], 10)
check("duplicados detectados", res["duplicates"], 11)
check("sin duplicados en BD",
      len({d["recipient_id"] for d in db.notifications.docs}), 10)

db = FakeDB(members=members(3) + members(3) + members(3))
res, _ = asyncio.run(run(0, batch_size=2, db=db))
check("dedupe cruzando lotes", res["recipients"], 3)
check("duplicados cruzando lotes", res["duplicates"], 6)


section("5. Invariantes de dispatch() que no pueden romperse")
db = FakeDB(members=members(3) + [{"group_id": GROUP, "user_id": ACTOR["id"]}])
res, _ = asyncio.run(run(0, db=db))
check("actor excluido", res["recipients"], 3)

prefs = [{"user_id": "u_1", "disabled_kinds": ["group_post"]},
         {"user_id": "u_2", "disabled_kinds": ["reaction"]}]
db = FakeDB(members=members(3), prefs=prefs)
res, db = asyncio.run(run(0, db=db))
check("silenced omitido", res["skipped_silenced"], 1)
check("resto notificado", res["sent"], 2)
ok("u_1 sin notificación",
   all(d["recipient_id"] != "u_1" for d in db.notifications.docs))

db = FakeDB(members=members(1))
asyncio.run(run(0, db=db))
doc = db.notifications.docs[0]
check("mismas claves que dispatch()", set(doc.keys()), {
    "id", "recipient_id", "kind", "title", "body", "actor_id", "actor_name",
    "actor_picture", "subject_type", "subject_id", "subject_url", "image_url",
    "vertical", "is_read", "created_at"})
check("kind correcto", doc["kind"], "group_post")
check("no leído", doc["is_read"], False)
ok("id con prefijo ntf_", str(doc["id"]).startswith("ntf_"), f"({doc['id']})")

import services.realtime as rt  # noqa: E402
_orig = rt.emit_notification


async def _boom(*a, **k):
    raise RuntimeError("broker down")


rt.emit_notification = _boom
try:
    db = FakeDB(members=members(2))
    res, db = asyncio.run(run(0, db=db))
    check("realtime caido no afecta el insert", res["sent"], 2)
    check("documentos presentes", len(db.notifications.docs), 2)
finally:
    rt.emit_notification = _orig

section("6. grupo vacío / sin destinatarios")
res, _ = asyncio.run(run(0))
check("sin destinatarios", res["recipients"], 0)
check("sin documentos", res["sent"], 0)
ok("no lanza con grupo vacío", True)

section("7. Timings (indicativos)")
for n in (100, 1000, 5000):
    t0 = time.perf_counter()
    asyncio.run(run(n, batch_size=200))
    print(f"  INFO  {n:>5} miembros -> {time.perf_counter() - t0:.3f}s (doble en memoria)")

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")

