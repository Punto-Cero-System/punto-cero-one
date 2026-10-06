"""
OMEGA F0.9.3 — pruebas unitarias del escritor de `activities`.

Cubre los 5 casos pedidos por el brief:
  1. Creación correcta      → documento con la forma del contrato §2.1
  2. Metadata opcional      → ausente, vacío y con contenido
  3. Expiración             → `expires_at` BSON Date, TTL-ready, retention configurable
  4. Fallo de persistencia  → `record()` no lanza, loguea y devuelve None
  5. Protección duplicados  → `idempotency_key` hace upsert; sin él, los repetidos
                              legítimos se registran como hechos distintos

Más la validación del vocabulario cerrado y las invariantes de privacidad.

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`) y
a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bson import ObjectId  # noqa: E402
from pymongo import ReturnDocument  # noqa: E402

from services import activities as act  # noqa: E402

FAILURES = []


def check(label, actual, expected):
    good = actual == expected
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {actual!r} (esperado {expected!r})")
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
        print(f"  FAIL  {label}: launch otra excepción {type(e).__name__}")
        FAILURES.append(f"{label}: {type(e).__name__}")
        return
    print(f"  FAIL  {label}: NO lanzó")
    FAILURES.append(f"{label}: no lanzó")


def section(title):
    print(f"\n{title}")


# --- doble de Mongo ---------------------------------------------------------
class _Collection:
    def __init__(self, fail=False):
        self.docs = []
        self.fail = fail
        self.insert_one_calls = 0
        self.find_one_and_update_calls = 0

    async def insert_one(self, doc):
        if self.fail:
            raise RuntimeError("mongo no disponible")
        self.insert_one_calls += 1
        self.docs.append(copy.deepcopy(doc))
        return type("R", (), {"inserted_id": ObjectId()})()

    async def find_one_and_update(self, flt, update, upsert=False,
                                   return_document=ReturnDocument.BEFORE):
        if self.fail:
            raise RuntimeError("mongo no disponible")
        self.find_one_and_update_calls += 1
        existing = next((d for d in self.docs if all(d.get(k) == v
                                                    for k, v in flt.items())), None)
        if existing is not None:
            return copy.deepcopy(existing) if return_document == ReturnDocument.AFTER else copy.deepcopy(existing)
        doc = copy.deepcopy(update["$setOnInsert"])
        self.docs.append(doc)
        return copy.deepcopy(doc) if return_document == ReturnDocument.AFTER else None


class FakeDB:
    def __init__(self, fail=False):
        self.activities = _Collection(fail=fail)


def base(**over):
    args = dict(
        kind="group.post_created",
        actor_id="u_ana",
        subject_type="group_post",
        subject_id="gp_1",
        audience={"type": "group", "id": "g_1"},
        visibility="members",
    )
    args.update(over)
    return args


def rec(db=None, **over):
    db = db or FakeDB()
    res = asyncio.run(act.record(db, **base(**over)))
    return res, db


section("1. Creación correcta")
doc, db = rec()
check("persisted", len(db.activities.docs), 1)
check("actor_id", doc["actor_id"], "u_ana")
check("kind", doc["kind"], "group.post_created")
check("subject_type", doc["subject_type"], "group_post")
check("subject_id", doc["subject_id"], "gp_1")
check("audience", doc["audience"], {"type": "group", "id": "g_1"})
check("visibility", doc["visibility"], "members")
ok("id con prefijo act_", str(doc["id"]).startswith("act_"), f"({doc['id']})")
ok("activity_key presente", bool(doc.get("activity_key")))
check("un insert_one", db.activities.insert_one_calls, 1)
check("no usó find_one_and_update", db.activities.find_one_and_update_calls, 0)
check("forma del documento", set(doc.keys()), {
    "id", "activity_key", "actor_id", "kind", "subject_type", "subject_id",
    "audience", "visibility", "metadata", "created_at", "expires_at"})
ok("sin _id de Mongo filtrado", "_id" not in doc)

section("1b. created_at es ISO string (consistencia con el resto del codebase)")
ok("es str", isinstance(doc["created_at"], str), f"({doc['created_at']})")
check("formato ISO-8601", datetime.fromisoformat(doc["created_at"]).tzinfo is not None, True)

section("2. Metadata opcional")
doc_none, _ = rec(metadata=None)
check("ausente -> {}", doc_none["metadata"], {})
doc_empty, _ = rec(metadata={})
check("vacío -> {}", doc_empty["metadata"], {})
payload = {"group_name": "Ventas", "member_count": 12, "nested": {"a": [1, 2]}}
doc_full, _ = rec(metadata=payload)
check("contenido intacto", doc_full["metadata"], payload)
ok("copia defensiva (no es el mismo objeto)", doc_full["metadata"] is not payload)
payload["mutated"] = True
check("mutar el original no afecta", "mutated" in doc_full["metadata"], False)

section("3. Expiración — expires_at BSON Date preparado para TTL")
ok("expires_at es datetime", isinstance(doc["expires_at"], datetime), f"({doc['expires_at']})")
check("es naive/aware consistente", doc["expires_at"].tzinfo is not None, True)
delta = doc["expires_at"] - datetime.now(timezone.utc)
ok("ttl por defecto ~180 días", 179 <= delta.days <= 180, f"({delta.days} días)")
doc_30, _ = rec(retention_days=30)
delta30 = doc_30["expires_at"] - datetime.now(timezone.utc)
ok("retention configurable", 29 <= delta30.days <= 30, f"({delta30.days} días)")
ok("created_at y expires_at son tipos distintos (string vs Date)",
   type(doc["created_at"]) is str and type(doc["expires_at"]) is datetime)
raises("retention_days=0 rechazado",
       lambda: act.build_activity(**base(retention_days=0)))
raises("retention_days negativo rechazado",
       lambda: act.build_activity(**base(retention_days=-5)))

section("4. Fallo de persistencia — nunca rompe la operación principal")
db_fail = FakeDB(fail=True)
res, _ = rec(db=db_fail)
check("devuelve None", res, None)
check("no insertó nada", len(db_fail.activities.docs), 0)
ok("no lanzó excepción", True)
res_idem, _ = rec(db=db_fail, idempotency_key="k-1")
check("upsert fallido también devuelve None", res_idem, None)

section("5. Protección contra duplicados")
# 5a. Con idempotency_key -> upsert, un reintento NO duplica
db_idem = FakeDB()
first, _ = rec(db=db_idem, idempotency_key="req-abc-1")
second, _ = rec(db=db_idem, idempotency_key="req-abc-1")
check("un solo documento", len(db_idem.activities.docs), 1)
check("mismo id", second["id"], first["id"])
check("misma key", second["activity_key"], "req-abc-1")
check("usó find_one_and_update", db_idem.activities.find_one_and_update_calls, 2)
check("nunca insert_one", db_idem.activities.insert_one_calls, 0)
ok("el reintento devuelve el doc original (no None)", second is not None)
ok("sin _id de Mongo", "_id" not in second)

# dos hechos distintos con keys distintas -> dos documentos
other, _ = rec(db=db_idem, idempotency_key="req-abc-2")
check("keys distintas -> 2 docs", len(db_idem.activities.docs), 2)
ok("ids distintos", other["id"] != first["id"])

section("5b. Sin idempotency_key — los repetidos legítimos se conservan")
db_rep = FakeDB()
c1, _ = rec(db=db_rep)   # 1er comentario
c2, _ = rec(db=db_rep)   # 2do comentario del mismo usuario al mismo post
check("dos hechos distintos", len(db_rep.activities.docs), 2)
ok("activity_key distinta en cada uno", c1["activity_key"] != c2["activity_key"])
ok("mismo actor y sujeto", (c1["actor_id"], c1["subject_id"]) ==
   (c2["actor_id"], c2["subject_id"]))
check("el dedupe NO colapsa hechos reales", len(db_rep.activities.docs), 2)

section("6. Vocabulario cerrado (contract §2.2)")
raises("kind desconocido rechazado", lambda: act.build_activity(**base(kind="no.existe")))
raises("kind vacío rechazado", lambda: act.build_activity(**base(kind="")))
raises("kind None rechazado", lambda: act.build_activity(**base(kind=None)))
raises("subject_type desconocido rechazado",
       lambda: act.build_activity(**base(subject_type="legal_case")))
raises("actor_id vacío rechazado", lambda: act.build_activity(**base(actor_id="  ")))
raises("subject_id vacío rechazado", lambda: act.build_activity(**base(subject_id="")))
raises("audience no-dict rechazado", lambda: act.build_activity(**base(audience="group")))
raises("audience.type desconocido rechazado",
       lambda: act.build_activity(**base(audience={"type": "team", "id": "t1"})))
raises("audience sin id en tipo no-broadcast rechazado",
       lambda: act.build_activity(**base(audience={"type": "group"})))
raises("visibility desconocido rechazado",
       lambda: act.build_activity(**base(visibility="secreto")))
raises("metadata no-dict rechazado", lambda: act.build_activity(**base(metadata="x")))
check("kind inválido -> record() devuelve None",
      rec(kind="no.existe")[0], None)
ok("vocabularios exportados y no vacíos",
   all([act.ACTIVITY_KINDS, act.SUBJECT_TYPES, act.AUDIENCE_TYPES, act.VISIBILITIES]))
check("CONTRACT_VERSION", act.CONTRACT_VERSION, 1)
ok("todos los kinds usan formato dominio.accion",
   all(k.count(".") == 1 for k in act.ACTIVITY_KINDS))

section("7. Invariantes de privacidad")
raises("public con visibility!=public rechazado",
       lambda: act.build_activity(**base(
           audience={"type": "public"}, visibility="members")))
raises("audience user con visibility public rechazado",
       lambda: act.build_activity(**base(
           audience={"type": "user", "id": "u_2"}, visibility="public")))
ok("public/public sí se acepta",
   act.build_activity(**base(
       audience={"type": "public"}, visibility="public")) is not None)
ok("followers no exige id",
   act.build_activity(**base(
       audience={"type": "followers"}, visibility="public")) is not None)
ok("no se guarda actor_name (identidad única en users)",
   "actor_name" not in doc and "actor_picture" not in doc)
ok("no se guarda vertical (identity_core: derivado, nunca almacenado)",
   "vertical" not in doc)

section("8. Aislamiento — write-only, ningún consumidor, capa propia")
src = (Path(__file__).resolve().parents[1] / "services" / "activities.py").read_text(
    encoding="utf-8")

# AST, no búsqueda de texto: los docstrings mencionan otras capas a propósito
# para explicar POR QUÉ no se importan. Lo que importa son los imports reales.
import ast  # noqa: E402
tree = ast.parse(src)
imported = set()
for node in ast.walk(tree):
    if isinstance(node, ast.Import):
        imported.update(a.name for a in node.names)
    elif isinstance(node, ast.ImportFrom):
        imported.add(node.module or "")
check("solo importa stdlib + pymongo", sorted(imported),
      ["__future__", "datetime", "logging", "pymongo", "typing", "uuid"])

FORBIDDEN = ("routes", "services.notifications", "services.analytics",
             "services.feed", "services.notification_fanout", "services.realtime",
             "fastapi", "starlette")
leaks = sorted(m for m in imported
               if any(m == f or m.startswith(f + ".") for f in FORBIDDEN))
check("ninguna importacion prohibida", leaks, [])
ok("no depende de ninguna otra capa del backend", not leaks, f"({leaks})")

# Módulos del backend que importan `activities` de verdad.
# Se recorre el AST, no el texto: `server.py` menciona "services/activities.py"
# en un comentario de índice, y un `git grep "services.activities"` lo marca
# como importador (el `.` actúa de comodín y casa con `/`).
BACKEND = Path(__file__).resolve().parents[1]
importers = []
for path in list((BACKEND / "routes").glob("*.py")) + list((BACKEND / "services").glob("*.py")):
    if path.name == "activities.py":
        continue
    try:
        mod_tree = ast.parse(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    for node in ast.walk(mod_tree):
        name = None
        if isinstance(node, ast.ImportFrom):
            name = node.module or ""
        elif isinstance(node, ast.Import):
            name = node.names[0].name
        if name and name.split(".")[-1] == "activities":
            importers.append(f"{path.name} -> {name}")
# FASE 2.1 — los conectores sociales (follows/feed) emiten al log SIN `publish()`
# (decisión Option A, regla R8: un solo escritor por evento). La invariante ya
# no es "solo groups" sino "exactamente los emisores previstos, y ninguno más".
EXPECTED_ACTIVITY_IMPORTERS = [
    "feed_routes.py -> services.activities",
    "follows_routes.py -> services.activities",
    "groups_routes.py -> services.activities",
]
ok("ningún módulo inesperado importa activities",
   sorted(importers) == sorted(EXPECTED_ACTIVITY_IMPORTERS), f"({importers})")
# FASE 2.1 (antes: OMEGA FASE A, `groups_routes.py` era el ÚNICO emisor). Lo que
# no puede pasar es que aparezcan OTROS emisores, o que un emisor además LEA.
check("los emisores previstos, ni uno más", sorted(importers),
      sorted(EXPECTED_ACTIVITY_IMPORTERS))
for _emitter in ("groups_routes.py", "feed_routes.py", "follows_routes.py"):
    _em_src = (BACKEND / "routes" / _emitter).read_text(encoding="utf-8")
    ok(f"el emisor {_emitter} escribe, no lee (sin find/aggregate sobre el log)",
       "db.activities.find" not in _em_src
       and "db.activities.aggregate" not in _em_src)
# Asimetría aprobada: groups publica (puente F0.9.7); los conectores sociales
# NUEVOS no publican (Option A, regla R8: ya notifican en directo y publicar
# duplicaría los avisos).
ok("groups publica por diseño (puente F0.9.7)",
   "publish_activity" in (BACKEND / "routes" / "groups_routes.py").read_text(encoding="utf-8"))
for _emitter in ("feed_routes.py", "follows_routes.py"):
    _em_src = (BACKEND / "routes" / _emitter).read_text(encoding="utf-8")
    ok(f"el conector {_emitter} NO conecta al consumidor (Option A, regla R8)",
       "activity_consumers" not in _em_src and "publish_activity" not in _em_src)

section("9. Determinismo del contrato")
d1 = act.build_activity(**base())
d2 = act.build_activity(**base())
ok("activity_key única sin idempotency_key", d1["activity_key"] != d2["activity_key"])
ok("id única", d1["id"] != d2["id"])
same = act.build_activity(**base(idempotency_key="k"))
same2 = act.build_activity(**base(idempotency_key="k"))
check("activity_key estable con idempotency_key",
      (same["activity_key"], same2["activity_key"]), ("k", "k"))
ok("el _now() propio coincide en formato con el de notifications",
   len(d1["created_at"]) == len(datetime.now(timezone.utc).isoformat()))

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")



