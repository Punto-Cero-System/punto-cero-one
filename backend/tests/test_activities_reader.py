"""
OMEGA FASE C1 — Activities Reader (capa de lectura).

Comprueba la capa de lectura de `activities` sin tocar el escritor: el doble de
Mongo de este archivo RECHAZA cualquier escritura, así que la prueba falla si
alguien intenta mutar el log (append-only por construcción, no por costumbre).

Casos:
  1. El usuario ve sus propias actividades (incluidas las privadas)
  2. Las privadas de otro no se ven ni en lista ni en detalle
  3. Grupos: solo miembros y dueño; un grupo público NO filtra su interior
  4. `followers` se resuelve contra `follows`, sin reglas propias
  5. Orden descendente por `created_at` + paginación por cursor sin huecos
  6. Actividad inexistente: el servicio devuelve None y la ruta responde 404
  7. Un cursor corrupto se rechaza (400), no se ignora en silencio
  8. La capa de lectura no escribe jamás

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

try:  # pragma: no cover - la salida suele ir a una tubería (cp1252 en Windows)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

from fastapi import HTTPException  # noqa: E402
from services import activity_reader as reader  # noqa: E402
from services.activity_reader import CursorError  # noqa: E402

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


def section(title):
    print(f"\n{title}")


def raises(label, fn, exc_type):
    try:
        fn()
    except exc_type as e:
        print(f"  PASS  {label}: {type(e).__name__}")
        return e
    except Exception as e:  # noqa: BLE001
        FAILURES.append(f"{label}: {type(e).__name__}")
        print(f"  FAIL  {label}: {type(e).__name__}: {e}")
        return None
    FAILURES.append(f"{label}: no lanzó {exc_type.__name__}")
    print(f"  FAIL  {label}: no lanzó {exc_type.__name__}")
    return None


# --- doble de Mongo: SOLO LECTURA -----------------------------------------
def _get(doc, path):
    value = doc
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _match(doc, query):
    for key, expected in (query or {}).items():
        if key == "$or":
            if not any(_match(doc, c) for c in expected):
                return False
        elif key == "$and":
            if not all(_match(doc, c) for c in expected):
                return False
        elif isinstance(expected, dict):
            actual = _get(doc, key)
            for op, operand in expected.items():
                if op == "$in":
                    if actual not in operand:
                        return False
                elif op == "$lt":
                    if actual is None or not actual < operand:
                        return False
                elif op == "$ne":
                    if actual == operand:
                        return False
                else:
                    raise AssertionError(f"operador no soportado por el doble: {op}")
        elif _get(doc, key) != expected:
            return False
    return True


class _Cursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._sort = []
        self._limit = None

    def sort(self, spec):
        self._sort = spec if isinstance(spec, list) else [spec]
        return self

    def limit(self, n):
        self._limit = n
        return self

    def __aiter__(self):
        docs = list(self.docs)
        for key, direction in reversed(self._sort):
            docs.sort(key=lambda d: (_get(d, key) is None, _get(d, key)),
                      reverse=direction < 0)
        if self._limit:
            docs = docs[:self._limit]
        return self._gen(docs)

    async def _gen(self, docs):
        for d in docs:
            yield dict(d)


class ReadOnlyCollection:
    """Cualquier escritura es un fallo de la prueba, no un dato devuelto."""

    def __init__(self, docs=None):
        self.docs = [dict(d) for d in (docs or [])]

    async def find_one(self, query, proj=None):
        for d in self.docs:
            if _match(d, query):
                return dict(d)
        return None

    def find(self, query=None, proj=None):
        return _Cursor([d for d in self.docs if _match(d, query)])

    def _write(self, name):
        raise AssertionError(
            f"la capa de lectura intentó escribir: {name} (activities es append-only)")

    async def insert_one(self, *a, **k):
        self._write("insert_one")

    async def insert_many(self, *a, **k):
        self._write("insert_many")

    async def update_one(self, *a, **k):
        self._write("update_one")

    async def update_many(self, *a, **k):
        self._write("update_many")

    async def delete_one(self, *a, **k):
        self._write("delete_one")

    async def delete_many(self, *a, **k):
        self._write("delete_many")

    async def find_one_and_update(self, *a, **k):
        self._write("find_one_and_update")


class FakeDB:
    def __init__(self, activities=None, groups=None, members=None,
                 follows=None, users=None, sessions=None):
        self.activities = ReadOnlyCollection(activities)
        self.groups = ReadOnlyCollection(groups)
        self.group_members = ReadOnlyCollection(members)
        self.follows = ReadOnlyCollection(follows)
        self.users = ReadOnlyCollection(users)
        self.user_sessions = ReadOnlyCollection(sessions)


class _Request:
    def __init__(self, db):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()


def act(aid, actor, visibility, audience, created, *,
        subject_type="group_post", subject_id=None, kind="group.post_created"):
    return {
        "_id": aid, "id": aid, "activity_key": f"key_{aid}",
        "actor_id": actor, "kind": kind, "subject_type": subject_type,
        "subject_id": subject_id or aid, "audience": audience,
        "visibility": visibility, "metadata": {},
        "created_at": created, "expires_at": "2099-01-01T00:00:00+00:00",
    }


def user(uid):
    return {"id": uid, "name": uid}


def member(gid, uid, role="member"):
    return {"id": f"gm_{gid}_{uid}", "group_id": gid, "user_id": uid, "role": role}


def ids(result):
    return [a["id"] for a in result["items"]]


T = [f"2026-01-0{i}T10:00:00+00:00" for i in range(1, 6)]

section("1. El usuario ve sus actividades (las públicas y las suyas privadas)")
db1 = FakeDB(activities=[
    act("act_pub", "usr_bruno", "public", {"type": "public", "id": None},
        T[0], subject_type="post", kind="post.created"),
    act("act_ana", "usr_ana", "private", {"type": "user", "id": "usr_ana"},
        T[1], subject_type="user", kind="user.profile_updated"),
])
r_ana = asyncio.run(reader.list_activities(db1, viewer=user("usr_ana")))
check("ana ve la suya y la pública", ids(r_ana), ["act_ana", "act_pub"])
r_bruno = asyncio.run(reader.list_activities(db1, viewer=user("usr_bruno")))
check("bruno solo ve la pública", ids(r_bruno), ["act_pub"])
ok("el _id técnico no sale", all("_id" not in a for a in r_ana["items"]))

section("2. Las privadas de otro no se ven ni en lista ni en detalle")
db2 = FakeDB(activities=[
    act("act_priv", "usr_ana", "private", {"type": "user", "id": "usr_ana"},
        T[0], subject_type="user"),
])
check("lista vacía para el otro",
      ids(asyncio.run(reader.list_activities(db2, viewer=user("usr_bruno")))), [])
check("detalle: None",
      asyncio.run(reader.get_activity(db2, "act_priv", viewer=user("usr_bruno"))), None)
check("la autora sí la obtiene",
      asyncio.run(reader.get_activity(db2, "act_priv", viewer=user("usr_ana")))["id"],
      "act_priv")
check("anónimo tampoco",
      asyncio.run(reader.get_activity(db2, "act_priv", viewer=None)), None)

section("3. Grupos: solo miembros y dueño; un grupo público NO filtra su interior")
db3 = FakeDB(
    activities=[
        act("act_gpriv", "usr_diego", "members", {"type": "group", "id": "grp_priv"},
            T[0], subject_id="post_p"),
        act("act_gpub", "usr_eva", "members", {"type": "group", "id": "grp_pub"},
            T[1], subject_id="post_q"),
    ],
    groups=[
        {"id": "grp_priv", "privacy": "private", "admin_id": "usr_diego"},
        {"id": "grp_pub", "privacy": "public", "admin_id": "usr_eva"},
    ],
    members=[
        member("grp_priv", "usr_ana"), member("grp_priv", "usr_diego", "admin"),
        member("grp_pub", "usr_eva", "admin"),
    ],
)
check("miembro del grupo privado",
      ids(asyncio.run(reader.list_activities(db3, viewer=user("usr_ana")))), ["act_gpriv"])
check("dueño del grupo privado",
      ids(asyncio.run(reader.list_activities(db3, viewer=user("usr_diego")))), ["act_gpriv"])
check("dueño del grupo público",
      ids(asyncio.run(reader.list_activities(db3, viewer=user("usr_eva")))), ["act_gpub"])
check("ajeno: nada",
      ids(asyncio.run(reader.list_activities(db3, viewer=user("usr_carlos")))), [])
check("anónimo: nada",
      ids(asyncio.run(reader.list_activities(db3, viewer=None))), [])
check("ver el grupo público NO da acceso a su interior",
      asyncio.run(reader.get_activity(db3, "act_gpub", viewer=user("usr_ana"))), None)

section("4. `followers` se resuelve contra `follows`, sin reglas propias")
db4 = FakeDB(
    activities=[
        act("act_fol", "usr_eva", "followers", {"type": "company", "id": "co_1"},
            T[0], subject_type="company", kind="user.followed"),
    ],
    follows=[{"user_id": "usr_ana", "entity_type": "company", "entity_id": "co_1"}],
)
check("quien la sigue la ve",
      ids(asyncio.run(reader.list_activities(db4, viewer=user("usr_ana")))), ["act_fol"])
check("quien no, no",
      ids(asyncio.run(reader.list_activities(db4, viewer=user("usr_bruno")))), [])

section("5. Orden descendente y paginación sin huecos ni repeticiones")
db5 = FakeDB(activities=[
    act(f"act_{i}", "usr_x", "public", {"type": "public", "id": None},
        T[i - 1], subject_type="post") for i in range(1, 6)])
page = asyncio.run(reader.list_activities(db5, viewer=user("usr_ana"), limit=2))
check("página 1: tamaño", len(page["items"]), 2)
check("página 1: más reciente primero", ids(page), ["act_5", "act_4"])
check("página 1: hay más", page["has_more"], True)
ok("página 1: hay cursor", bool(page["next_cursor"]))
collected, cursor, guard = list(ids(page)), page["next_cursor"], 0
while cursor and guard < 10:
    nxt = asyncio.run(reader.list_activities(
        db5, viewer=user("usr_ana"), limit=2, cursor=cursor))
    collected += ids(nxt)
    cursor = nxt["next_cursor"]
    guard += 1
check("todo, en orden y sin repetir", collected,
      ["act_5", "act_4", "act_3", "act_2", "act_1"])
check("la última página no ofrece cursor", cursor, None)
check("el límite se acota al máximo",
      len(asyncio.run(reader.list_activities(db5, viewer=user("usr_ana"),
                                             limit=9999))["items"]), 5)

section("6. Actividad inexistente: el servicio y la ruta")
db6 = FakeDB(activities=[
    act("act_x", "usr_ana", "public", {"type": "public", "id": None},
        T[0], subject_type="post")])
check("servicio: None",
      asyncio.run(reader.get_activity(db6, "no_existe", viewer=user("usr_ana"))), None)
from routes import activities_routes  # noqa: E402
err = None
try:
    asyncio.run(activities_routes.get_activity("no_existe", _Request(db6)))
except HTTPException as e:
    err = e
check("ruta: 404", getattr(err, "status_code", None), 404)
ok("detalle visible: la ruta lo devuelve",
   asyncio.run(activities_routes.get_activity("act_x", _Request(db6)))["id"] == "act_x")

section("7. Un cursor corrupto se rechaza, no se ignora")
raises("cursor basura", lambda: asyncio.run(
    reader.list_activities(db5, viewer=user("usr_ana"), cursor="%%%not-base64%%%")),
    CursorError)
err = None
try:
    asyncio.run(activities_routes.list_activities(_Request(db5), cursor="@@@"))
except HTTPException as e:
    err = e
check("ruta: 400", getattr(err, "status_code", None), 400)

section("8. La capa de lectura no escribe jamás")
ok("todas las lecturas anteriores funcionaron con un doble que rechaza escrituras", True)
raises("el doble rechaza insert_one (append-only)",
       lambda: asyncio.run(db5.activities.insert_one({"id": "x"})), AssertionError)
raises("el doble rechaza delete_many (append-only)",
       lambda: asyncio.run(db5.activities.delete_many({"id": "x"})), AssertionError)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")