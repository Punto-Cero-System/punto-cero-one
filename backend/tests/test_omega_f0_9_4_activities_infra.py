"""
OMEGA F0.9.4 — evidencia de la infraestructura Mongo de `activities`.

Verifica los índices REALES declarados en `backend/server.py`, extrayéndolos
con AST y ejecutándolos contra un doble. No se prueba una copia: se prueba el
código de producción, para que no pueda divergir del arranque.

Restricciones comprobadas (brief "revisión arquitectónica obligatoria"):
  1. Ningún import desde routes/feed/notifications/analytics hacia activities
  2. Ningún emisor activo escribiendo activities
  3. Ningún índice ÚNICO sobre activity_key

LIMITACIÓN DECLARADA: no hay MongoDB accesible en este entorno
(WinError 10061 en localhost:27017; Docker no instalado). La sección 6 lo
detecta y se salta con un mensaje explícito. NO se simula una certificación
real: lo verificado aquí es el código que se ejecutará al arrancar, no el
comportamiento del servidor de base de datos.
"""
from __future__ import annotations

import ast
import asyncio
import copy
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services import activities as act  # noqa: E402

FAILURES = []
SKIPPED = []


def check(label, actual, expected):
    good = actual == expected
    print(f"  {'PASS' if good else 'FAIL'}  {label}: {actual!r}")
    if not good:
        FAILURES.append(f"{label}: {actual!r} != {expected!r}")
    return good


def ok(label, condition, detail=""):
    passed = bool(condition)
    print(f"  {'PASS' if passed else 'FAIL'}  {label} {detail}")
    if not passed:
        FAILURES.append(f"{label} {detail}")
    return passed


def section(title):
    print(f"\n{title}")


# --- extracción de los índices reales de server.py -----------------------
def extract_activities_indexes(server_path: Path):
    """Devuelve [(name, unique, expireAfterSeconds)] tal como se declararon."""
    tree = ast.parse(server_path.read_text(encoding="utf-8"))
    found = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != "create_index":
            continue
        try:
            owner = ast.unparse(func.value)
        except Exception:
            continue
        if owner != "db.activities":
            continue
        keys = ast.literal_eval(node.args[0]) if node.args else None
        kwargs = {kw.arg: ast.literal_eval(kw.value) for kw in node.keywords}
        found.append((keys, kwargs.get("unique", False),
                      kwargs.get("expireAfterSeconds", None)))
    return found


def keyset(keys):
    # frozenset (not set): se usa como clave de dict para comparar los índices.
    return frozenset({k for k, _ in keys} if isinstance(keys, list) else {keys})


SERVER = ROOT / "server.py"

section("0. Los índices declarados en server.py (código de producción)")
INDEXES = extract_activities_indexes(SERVER)
check("índices de activities encontrados", len(INDEXES), 5)
for keys, uniq, ttl in INDEXES:
    print(f"        {keys}  unique={uniq} expireAfterSeconds={ttl}")

section("1. Índice TTL obligatorio")
ttls = [(k, t) for k, _, t in INDEXES if t is not None]
check("exactamente un índice TTL", len(ttls), 1)
check("sobre expires_at", ttls[0][0], "expires_at")
check("expireAfterSeconds = 0", ttls[0][1], 0)
ok("expireAfterSeconds=0 → expira en el valor almacenado, no en now+N días",
   ttls[0][1] == 0)

section("2. Índices de consulta futura")
by_keys = {keyset(k): (u, t) for k, u, t in INDEXES}
ok("audience.type + audience.id + created_at",
   keyset([("audience.type", 1), ("audience.id", 1), ("created_at", -1)])
   in by_keys)
ok("actor_id + created_at",
   keyset([("actor_id", 1), ("created_at", -1)]) in by_keys)
ok("subject_type + subject_id + created_at",
   keyset([("subject_type", 1), ("subject_id", 1), ("created_at", -1)])
   in by_keys)
for label, spec in [
    ("audience", [("audience.type", 1), ("audience.id", 1), ("created_at", -1)]),
    ("actor", [("actor_id", 1), ("created_at", -1)]),
    ("subject", [("subject_type", 1), ("subject_id", 1), ("created_at", -1)]),
]:
    keys, direction = spec[0][0], spec[1]
    match = next(((k, u, t) for k, u, t in INDEXES if keyset(k) == keyset(spec)), None)
    check(f"{label}: created_at descendente (-1)",
          dict(match[0]).get("created_at") if isinstance(match[0], list) else None, -1)
    ok(f"{label}: no único", match[1] is False)

section("3. Prohibido índice ÚNICO sobre activity_key (revisión arquitectónica)")
key_idx = next((i for i in INDEXES if keyset(i[0]) == {"activity_key"}), None)
ok("existe índice de activity_key", key_idx is not None)
check("activity_key NO es único", key_idx[1], False)
ok("ningún índice de activities es único",
   all(u is False for _, u, _ in INDEXES),
   f"({[i[0] for i in INDEXES if i[1]]})")
# Razón: "user A follows group X" y "user A joins group X" son 2 hechos.
follows_doc = act.build_activity(
    kind="user.followed", actor_id="usr_a", subject_type="group",
    subject_id="g_x", audience={"type": "user", "id": "usr_a"},
    visibility="private")
join_doc = act.build_activity(
    kind="group.joined", actor_id="usr_a", subject_type="group",
    subject_id="g_x", audience={"type": "user", "id": "usr_a"},
    visibility="private")
ok("los 2 hechos coexisten sin colisión de clave",
   follows_doc["activity_key"] != join_doc["activity_key"])
ok("mismo actor y mismo sujeto",
   (follows_doc["actor_id"], follows_doc["subject_id"]) ==
   (join_doc["actor_id"], join_doc["subject_id"]))
check("pero kinds distintos", (follows_doc["kind"], join_doc["kind"]),
      ("user.followed", "group.joined"))

section("4. Coherencia índice ↔ documento que produce el escritor")
doc = act.build_activity(
    kind="group.post_created", actor_id="usr_a", subject_type="group_post",
    subject_id="gp_1", audience={"type": "group", "id": "g_1"},
    visibility="members", metadata={"group_name": "Ventas"})
for field in ("actor_id", "subject_type", "subject_id", "created_at",
              "activity_key", "expires_at"):
    ok(f"el documento tiene '{field}'", field in doc)
ok("'audience.type' y 'audience.id' son indexables",
   isinstance(doc["audience"], dict) and {"type", "id"} <= set(doc["audience"]))
ok("'expires_at' es BSON Date (TTL lo requiere)",
   isinstance(doc["expires_at"], datetime), f"({type(doc['expires_at']).__name__})")
ok("'created_at' es ISO string", isinstance(doc["created_at"], str))
delta = doc["expires_at"] - datetime.now(timezone.utc)
ok("expira en el futuro (~180 días)", delta.days >= 179, f"({delta.days} días)")

section("5. Los índices se ejecutan sin error (contra un doble)")
class _IdxCollection:
    def __init__(self):
        self.created = []

    async def create_index(self, keys, **kwargs):
        self.created.append((keys, kwargs))
        return f"idx_{len(self.created)}"


class _IdxDB:
    def __init__(self):
        self.activities = _IdxCollection()


async def replay():
    """Re-ejecuta las MISMAS llamadas declaradas en server.py."""
    db = _IdxDB()
    for keys, unique, ttl in INDEXES:
        kwargs = {}
        if unique:
            kwargs["unique"] = unique
        if ttl is not None:
            kwargs["expireAfterSeconds"] = ttl
        await db.activities.create_index(keys, **kwargs)
    return db


fake = asyncio.run(replay())
check("5 índices creados sin excepción", len(fake.activities.created), 5)
ok("el TTL llega a create_index",
   any(kw.get("expireAfterSeconds") == 0 for _, kw in fake.activities.created))
ok("ninguno llega como unique",
   not any(kw.get("unique") for _, kw in fake.activities.created))

section("6. Mongo real — se intenta y se declara la limitación")
try:
    from pymongo import MongoClient
    MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000).server_info()
    MONGO_UP = True
    reason = ""
except Exception as e:
    MONGO_UP = False
    reason = type(e).__name__

if MONGO_UP:
    print("  INFO  Mongo accesible: ejecutando verificación real")
    try:
        cli = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000)
        db = cli["punto_cero_f0_9_4_probe"]
        db.activities.drop()
        for keys, uniq, ttl in INDEXES:
            kw = {}
            if uniq:
                kw["unique"] = uniq
            if ttl is not None:
                kw["expireAfterSeconds"] = ttl
            db.activities.create_index(keys, **kw)
        real = {i["name"]: i for i in db.activities.list_indexes()}
        ok("índice TTL existe en Mongo real",
           any(i.get("expireAfterSeconds") == 0 for i in real.values()))
        asyncio.run(act.record(db, kind="group.post_created", actor_id="usr_a",
                               subject_type="group_post", subject_id="gp_1",
                               audience={"type": "group", "id": "g_1"},
                               visibility="members"))
        check("lectura correcta", db.activities.count_documents({}), 1)
        db.activities.drop()
    except Exception as e:
        FAILURES.append(f"Mongo real falló a media verificación: {e}")
else:
    msg = (f"Mongo real NO disponible ({reason}: WinError 10061, "
           "Docker no instalado).")
    print(f"  SKIP  {msg}")
    SKIPPED.append(msg)
    print("        NO se simula una certificacion real: lo verificado es el")
    print("        codigo de arranque de server.py, no el comportamiento de Mongo.")
    print("        Pendiente con Mongo: TTL borra segun expires_at, y")
    print("        find_one_and_update+\\$setOnInsert con ReturnDocument.AFTER.")

section("7. Revisión arquitectónica obligatoria")
full = SERVER.read_text(encoding="utf-8")

# 1. Ningún import real desde routes/feed/notifications/analytics hacia activities.
leaking = []
for path in list((ROOT / "routes").glob("*.py")) + list((ROOT / "services").glob("*.py")):
    if path.name == "activities.py":
        continue
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    for node in ast.walk(tree):
        mod = None
        if isinstance(node, ast.ImportFrom):
            mod = node.module or ""
        elif isinstance(node, ast.Import):
            mod = node.names[0].name
        if mod and "activities" in mod:
            leaking.append(f"{path.name} -> {mod}")
check("1. Solo los emisores previstos importan activities", sorted(leaking), sorted([
      "feed_routes.py -> services.activities",
      "follows_routes.py -> services.activities",
      "groups_routes.py -> services.activities",
      ]))  # FASE 2.1: follows/feed emiten SIN `publish()` (Option A, regla R8).

tree = ast.parse((ROOT / "services" / "activities.py").read_text(encoding="utf-8"))
mods = set()
for node in ast.walk(tree):
    if isinstance(node, ast.Import):
        mods.update(a.name for a in node.names)
    elif isinstance(node, ast.ImportFrom):
        mods.add(node.module or "")
check("   activities.py no depende de ninguna capa", sorted(mods),
      ["__future__", "datetime", "logging", "pymongo", "typing", "uuid"])

# 2. Emisores: FASE 2.1 añade los 4 conectores sociales (follows + feed) a la
#    lista aprobada. La invariante ya no es "solo groups" sino "exactamente los
#    previstos" — SIN `publish()` (Option A, regla R8) — y que ninguno más
#    aparezca por sorpresa.
expected_emitters = ["groups_routes.py", "follows_routes.py", "feed_routes.py"]
emitters = []
for name in ("groups_routes.py", "follows_routes.py", "feed_routes.py"):
    p = ROOT / "routes" / name
    if p.exists() and "activities" in p.read_text(encoding="utf-8"):
        emitters.append(name)
for name in ("notifications.py", "analytics.py"):
    p = ROOT / "services" / name
    if p.exists() and "activities" in p.read_text(encoding="utf-8"):
        emitters.append(name)
check("2. Emisores previstos (groups + follows + feed)", sorted(emitters),
      sorted(expected_emitters))
ok("   notifications/analytics siguen sin tocar activities",
   not any(e in emitters for e in ("notifications.py", "analytics.py")))
ok("   groups publica por diseño (puente F0.9.7)",
   "publish_activity" in (ROOT / "routes" / "groups_routes.py").read_text(encoding="utf-8"))
ok("   los conectores nuevos NO conectan al consumidor (Option A, regla R8)",
   all("activity_consumers" not in (ROOT / "routes" / name).read_text(encoding="utf-8")
       and "publish_activity" not in (ROOT / "routes" / name).read_text(encoding="utf-8")
       for name in ("feed_routes.py", "follows_routes.py")))

# 3. Sin indice unico sobre activity_key
check("3. Sin indice unico sobre activity_key", key_idx[1], False)

# 4. server.py es el unico backend que declara infraestructura de activities.
#    Ojo: el working tree ya traia cambios de fases anteriores (F0, F0.8,
#    F0.9.1), asi que "unico archivo modificado" no es verificable con git.
#    Lo que si es verificable: solo server.py crea indices de activities.
import subprocess  # noqa: E402
res2 = subprocess.run(["git", "--no-pager", "diff", "--stat", "--", "backend"],
                      cwd=str(ROOT.parent), capture_output=True, text=True)
changed = sorted({l.split("|")[0].strip().split("\\")[-1]
                  for l in res2.stdout.split("\n") if "|" in l})
print(f"        ficheros backend modificados en el working tree: {changed}")
idx_owners = []
for path in list((ROOT / "routes").glob("*.py")) + list((ROOT / "services").glob("*.py")):
    if "db.activities.create_index" in path.read_text(encoding="utf-8"):
        idx_owners.append(path.name)
check("4. Solo server.py crea indices de activities", idx_owners, [])
ok("   server.py es quien los crea", "db.activities.create_index" in full)
ok("   ninguna ruta crea indices de activities", idx_owners == [])

section("8. Sin colas ni emisores; y desde C1, SOLO lectura")
# OMEGA C1 invierte a propósito la invariante anterior: F0.9 dejó el log
# escrito y sin exponer nada ("no hay endpoint /activities"). C1 abre la
# PRIMERA lectura, así que la ausencia de endpoint deja de ser lo esperado.
# Lo que sigue vigente —y ahora se vigila con más precisión— es que la
# superficie nueva sea de SOLO LECTURA y que no aparezcan colas ni procesos
# de fondo.
ok("el endpoint de lectura sí está montado", "activities_router" in full)
ok("no hay BackgroundTasks en activities.py",
   "BackgroundTasks" not in (ROOT / "services" / "activities.py").read_text(encoding="utf-8"))
ok("no se anadio redis/celery/dramatiq",
   not any(m in full.lower() for m in ("redis", "celery", "dramatiq")))

# La capa de lectura no puede escribir: ni update, ni delete, ni upsert.
_reader = (ROOT / "services" / "activity_reader.py").read_text(encoding="utf-8")
ok("el lector no escribe en activities",
   not any(op in _reader for op in
           ("insert_one", "insert_many", "update_one", "update_many",
            "delete_one", "delete_many", "find_one_and_update")))
ok("el lector no importa al escritor",
   "from services.activities" not in _reader)
ok("no hay BackgroundTasks en activities.py",
   "BackgroundTasks" not in (ROOT / "services" / "activities.py").read_text(encoding="utf-8"))
ok("no se anadio redis/celery/dramatiq",
   not any(m in full.lower() for m in ("redis", "celery", "dramatiq")))

print("\n" + "=" * 62)
for s in SKIPPED:
    print("SKIPPED: " + s)
if FAILURES:
    print(f"\nFALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print("  - " + f)
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")



