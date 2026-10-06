"""
OMEGA FASE B3 — hardening del ciclo de vida de grupos.

Endurece la revisión de robustez del Social Graph tras B1 (seguir grupos) y
B2 (integración en Comunidad). No añade funcionalidad: comprueba que el ciclo
de vida no puede dejar datos en estado irrecuperable.

Riesgo que cubre: el dueño podía abandonar su propio grupo. `groups.admin_id`
seguía apuntando a un ex-miembro y, si el grupo era privado, `visible_filter`
lo ocultaba a todo el mundo (solo lo ven `admin_id` y los miembros): el grupo
quedaba inalcanzable sin forma de recuperarlo desde la API.

Casos:
  1. El único administrador no puede salir                → 409
  2. El dueño sí puede salir si queda otro admin
  3. Un miembro normal sí puede salir
  4. Salir dos veces es idempotente (el contador no se va de rango)
  5. Salir de un grupo inexistente                        → 404
  6. Tras el rechazo, el grupo privado sigue visible para
     los suyos y oculto para ajenos (no desaparece)
  7. Salir NO toca `follows`: membresía y grafo son cosas distintas
  8. El recuento de seguidores sale de `follows`, no de miembros
  9. Usuario eliminado: el padrón no revienta ni inventa miembros
 10. Unirse dos veces no duplica ni mueve el contador dos veces

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
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
from routes import groups_routes as gr  # noqa: E402
from routes import follows_routes as fr  # noqa: E402
from services.group_permissions import (  # noqa: E402
    ADMIN, DENIED, MEMBER, evaluate_access,
)

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


def refuses(label, coro, status):
    """Ejecuta `coro` esperando un HTTPException con ese status.

    Devuelve (status, detail) reales para poder comprobar el mensaje, y anota
    el fallo si no se produjo la excepción o si fue de otro tipo.
    """
    try:
        asyncio.run(coro)
    except HTTPException as e:
        good = e.status_code == status
        print(f"  {'PASS' if good else 'FAIL'}  {label}: {e.status_code} (esperado {status})")
        if not good:
            FAILURES.append(f"{label}: {e.status_code} != {status}")
        return e.status_code, e.detail
    except Exception as e:  # noqa: BLE001 - el doble puede fallar por otra razón
        FAILURES.append(f"{label}: excepción inesperada {type(e).__name__}: {e}")
        print(f"  FAIL  {label}: excepción inesperada {type(e).__name__}: {e}")
        return None, None
    FAILURES.append(f"{label}: no lanzó {status}")
    print(f"  FAIL  {label}: no lanzó {status}")
    return None, None


# --- doble de Mongo (subconjunto: lo que grupos y follows necesitan) ---------
class _Result:
    def __init__(self, deleted_count=0, upserted_id=None, inserted_id=None):
        self.deleted_count = deleted_count
        self.upserted_id = upserted_id
        self.inserted_id = inserted_id


class _Cursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._key = None
        self._dir = 1

    def sort(self, key, direction=1):
        self._key, self._dir = key, direction
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def __aiter__(self):
        docs = list(self.docs)
        if self._key:
            docs.sort(key=lambda d: (d.get(self._key) is None, d.get(self._key)),
                      reverse=self._dir < 0)
        return self._gen(docs)

    async def _gen(self, docs):
        for d in docs:
            yield copy.deepcopy(d)


class _Collection:
    def __init__(self, docs=None):
        self.docs = [dict(d) for d in (docs or [])]

    @staticmethod
    def _match(doc, q):
        for k, v in (q or {}).items():
            actual = doc.get(k)
            if isinstance(v, dict):
                if "$ne" in v and actual == v["$ne"]:
                    return False
                if "$in" in v and actual not in v["$in"]:
                    return False
                if "$gt" in v and not (actual is not None and actual > v["$gt"]):
                    return False
            elif actual != v:
                return False
        return True

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                out = copy.deepcopy(d)
                out.pop("_id", None)
                return out
        return None

    def find(self, q=None, proj=None):
        return _Cursor([copy.deepcopy(d) for d in self.docs if self._match(d, q)])

    async def insert_one(self, doc):
        self.docs.append(copy.deepcopy(doc))
        return _Result(inserted_id="oid")

    async def delete_one(self, q):
        for i, d in enumerate(self.docs):
            if self._match(d, q):
                self.docs.pop(i)
                return _Result(deleted_count=1)
        return _Result()

    async def delete_many(self, q):
        keep = [d for d in self.docs if not self._match(d, q)]
        removed = len(self.docs) - len(keep)
        self.docs = keep
        return _Result(deleted_count=removed)

    async def update_one(self, q, upd, upsert=False):
        for d in self.docs:
            if self._match(d, q):
                for k, v in (upd.get("$inc") or {}).items():
                    d[k] = d.get(k, 0) + v
                d.update(upd.get("$set") or {})
                d.update(upd.get("$setOnInsert") or {})
                return _Result()
        return _Result()

    async def count_documents(self, q):
        return sum(1 for d in self.docs if self._match(d, q))


class FakeDB:
    def __init__(self, groups=None, members=None, users=None, follows=None):
        self.groups = _Collection(groups)
        self.group_members = _Collection(members)
        self.users = _Collection(users)
        self.follows = _Collection(follows)
        self.notifications = _Collection()
        self.notification_preferences = _Collection()


class _Request:
    def __init__(self, db):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()


def user(uid):
    return {"id": uid, "name": f"Usuario {uid}"}


def member(gid, uid, role="member"):
    return {"id": f"gm_{gid}_{uid}", "group_id": gid, "user_id": uid,
            "role": role, "joined_at": "2026-01-01T00:00:00+00:00"}


def group(gid, admin_id, privacy="public", members_count=1):
    return {"id": gid, "name": f"Grupo {gid}", "privacy": privacy,
            "admin_id": admin_id, "members_count": members_count,
            "posts_count": 0}


GID = "grp_hard"


def leave(db, uid):
    return gr.leave_group(GID, _Request(db), user(uid))


section("1. El único administrador no puede abandonar su grupo (huérfano)")
db = FakeDB(
    groups=[group(GID, "usr_dueno", "private", members_count=1)],
    members=[member(GID, "usr_dueno", "admin"), member(GID, "usr_miembro")],
    users=[user("usr_dueno"), user("usr_miembro")],
    follows=[{"user_id": "usr_dueno", "entity_type": "group", "entity_id": GID}],
)
status, detail = refuses("el dueño no puede quedarse sin grupo", leave(db, "usr_dueno"), 409)
check("el dueño recibe 409", status, 409)
ok("el mensaje explica el motivo", bool(detail) and "administrador" in detail,
   f"({detail})")
check("sigue siendo miembro", len(db.group_members.docs), 2)
check("members_count intacto", db.groups.docs[0]["members_count"], 1)
check("admin_id intacto", db.groups.docs[0]["admin_id"], "usr_dueno")

section("2. Roles: la privacidad sigue decidiéndose en group_permissions")
g = db.groups.docs[0]
check("acceso del dueño", asyncio.run(evaluate_access(db, g, user("usr_dueno"))), ADMIN)
check("acceso de un miembro", asyncio.run(evaluate_access(db, g, user("usr_miembro"))), MEMBER)
check("acceso de un ajeno", asyncio.run(evaluate_access(db, g, user("usr_ajeno"))), DENIED)
check("acceso del admin de plataforma",
      asyncio.run(evaluate_access(db, g, {"id": "usr_root", "role": "admin"})), ADMIN)
check("acceso anónimo", asyncio.run(evaluate_access(db, g, None)), DENIED)

section("3. El dueño sí puede salir si queda otro administrador")
db3 = FakeDB(
    groups=[group(GID, "usr_dueno", "public", members_count=2)],
    members=[member(GID, "usr_dueno", "admin"), member(GID, "usr_coadmin", "admin")],
    users=[user("usr_dueno"), user("usr_coadmin")],
)
r3 = asyncio.run(leave(db3, "usr_dueno"))
check("sale", r3["left"], True)
check("members_count baja", db3.groups.docs[0]["members_count"], 1)
check("queda un administrador",
      len([m for m in db3.group_members.docs if m["role"] == "admin"]), 1)

section("4. Un miembro sale; salir dos veces es idempotente")
db4 = FakeDB(
    groups=[group(GID, "usr_dueno", "public", members_count=3)],
    members=[member(GID, "usr_dueno", "admin"), member(GID, "usr_m1"), member(GID, "usr_m2")],
    users=[user("usr_dueno"), user("usr_m1"), user("usr_m2")],
)
check("primera salida", asyncio.run(leave(db4, "usr_m1"))["left"], True)
check("el contador baja", db4.groups.docs[0]["members_count"], 2)
r4 = asyncio.run(leave(db4, "usr_m1"))
check("la segunda no repite", r4["left"], False)
ok("y lo dice (not_member)", r4.get("not_member") is True)
check("el contador no se mueve dos veces", db4.groups.docs[0]["members_count"], 2)

section("5. Salir de un grupo inexistente")
db5 = FakeDB()
refuses("grupo inexistente", gr.leave_group("grp_fantasma", _Request(db5), user("usr_x")), 404)

section("6. Salir NO toca `follows`: membresía y grafo son cosas distintas")
db6 = FakeDB(
    groups=[group(GID, "usr_dueno", "public", members_count=3)],
    members=[member(GID, "usr_dueno", "admin"), member(GID, "usr_m1"), member(GID, "usr_m2")],
    users=[user("usr_dueno"), user("usr_m1"), user("usr_m2")],
    follows=[
        {"user_id": "usr_m1", "entity_type": "group", "entity_id": GID},
        {"user_id": "usr_m2", "entity_type": "group", "entity_id": GID},
        {"user_id": "usr_x", "entity_type": "group", "entity_id": GID},
    ],
)
asyncio.run(leave(db6, "usr_m1"))
check("los follows siguen intactos", len(db6.follows.docs), 3)

section("7. El recuento de seguidores sale de `follows`, no de los miembros")
before = asyncio.run(fr.entity_count("group", GID, _Request(db6)))
check("antes de salir", before["count"], 3)
asyncio.run(leave(db6, "usr_m2"))
after = asyncio.run(fr.entity_count("group", GID, _Request(db6)))
check("salir un miembro NO reduce los seguidores", after["count"], 3)

section("8. Usuario eliminado: el padrón no revienta ni inventa miembros")
db8 = FakeDB(
    groups=[group(GID, "usr_dueno", "public", members_count=2)],
    members=[member(GID, "usr_dueno", "admin"), member(GID, "usr_fantasma")],
    users=[user("usr_dueno")],  # el otro usuario ya no existe en `users`
)
roster = asyncio.run(gr.list_members(GID, _Request(db8), limit=50, session_token=None))
ids = [i["id"] for i in roster["items"]]
check("el padrón responde", roster["total"], 2)
ok("conserva el id del miembro fantasma", "usr_fantasma" in ids)
fantasma = [i for i in roster["items"] if i["id"] == "usr_fantasma"][0]
check("con nombre por defecto", fantasma["name"], "Miembro")
check("y con su rol real", fantasma["role"], "member")

section("9. Unirse dos veces no duplica ni mueve el contador dos veces")
db9 = FakeDB(
    groups=[group(GID, "usr_dueno", "public", members_count=1)],
    members=[member(GID, "usr_dueno", "admin")],
    users=[user("usr_dueno"), user("usr_nuevo")],
)
j1 = asyncio.run(gr.join_group(GID, _Request(db9), user("usr_nuevo")))
check("primera vez se une", j1["joined"], True)
check("members_count sube", db9.groups.docs[0]["members_count"], 2)
j2 = asyncio.run(gr.join_group(GID, _Request(db9), user("usr_nuevo")))
check("segunda vez no se une", j2["joined"], False)
ok("y lo informa (already_member)", j2.get("already_member") is True)
check("members_count no se mueve dos veces", db9.groups.docs[0]["members_count"], 2)

section("10. Unirse a un grupo privado sigue siendo 403")
db10 = FakeDB(
    groups=[group(GID, "usr_dueno", "private", members_count=1)],
    members=[member(GID, "usr_dueno", "admin")],
    users=[user("usr_dueno"), user("usr_ajeno")],
)
refuses("unirse a un privado", gr.join_group(GID, _Request(db10), user("usr_ajeno")), 403)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("TODAS LAS COMPROBACIONES OK")