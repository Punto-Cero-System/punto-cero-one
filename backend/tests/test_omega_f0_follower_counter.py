"""
OMEGA F0 — evidencia de la normalizacion del contador de seguidores.

Ejercita las funciones reales de `routes.follows_routes` contra un doble de
MongoDB en memoria. Cubre los 3 casos del brief:

  Caso 1: seguir empresa  -> companies.followers_count aumenta
  Caso 2: dejar de seguir -> relacion eliminada + contador disminuye
  Caso 3: seguir dos veces -> NO duplica el contador (idempotencia)

Motivo: la suite pytest del repo esta atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes import follows_routes as fr  # noqa: E402


class _Result:
    def __init__(self, upserted_id=None, deleted_count=0):
        self.upserted_id = upserted_id
        self.deleted_count = deleted_count


class _Collection:
    """Subconjunto de Mongo: update_one / find_one / delete_one / count_documents."""

    def __init__(self, docs=None):
        self.docs = docs or []

    @staticmethod
    def _match(doc, q):
        for k, v in q.items():
            actual = doc.get(k)
            if isinstance(v, dict):
                if "$gt" in v and not (actual is not None and actual > v["$gt"]):
                    return False
            elif actual != v:
                return False
        return True

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    async def update_one(self, q, upd, upsert=False):
        for d in self.docs:
            if self._match(d, q):
                if "$setOnInsert" in upd and not d.get("_inserted"):
                    d.update(upd["$setOnInsert"])
                    d["_inserted"] = True
                return _Result()
        if upsert:
            doc = copy.deepcopy(upd.get("$setOnInsert", {}))
            doc["_inserted"] = True
            self.docs.append(doc)
            return _Result(upserted_id=f"oid{len(self.docs)}")
        return _Result()

    async def delete_one(self, q):
        for i, d in enumerate(self.docs):
            if self._match(d, q):
                self.docs.pop(i)
                return _Result(deleted_count=1)
        return _Result()

    async def count_documents(self, q):
        return sum(1 for d in self.docs if self._match(d, q))


class _Companies(_Collection):
    """Replica $inc para poder observar el contador de la empresa."""

    async def update_one(self, q, upd, upsert=False):
        for d in self.docs:
            if self._match(d, q):
                if "$inc" in upd:
                    for k, v in upd["$inc"].items():
                        d[k] = d.get(k, 0) + v
                return _Result()
        return _Result()


class _DB:
    def __init__(self):
        self.follows = _Collection()
        self.company_follows = _Collection()
        self.companies = _Companies([{"id": "co_1", "name": "Acme", "followers_count": 0}])
        self.users = _Collection()
        self.notifications = _Collection()
        self.notification_preferences = _Collection()


class _Request:
    def __init__(self, db):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()


def _user():
    return {"id": "u_1", "name": "Tester", "picture": None}


def _seed(db, followers=0):
    db.companies.docs = [{"id": "co_1", "name": "Acme", "followers_count": followers}]


FAILURES = []


def check(label, actual, expected):
    if asyncio.iscoroutine(actual):
        actual = asyncio.run(actual)
    ok = actual == expected
    print(f"  {'PASS' if ok else 'FAIL'}  {label}: {actual!r} (esperado {expected!r})")
    if not ok:
        FAILURES.append(f"{label}: {actual!r} != {expected!r}")


# ==== CASO 1: seguir empresa ====
print("\n[CASO 1] Usuario sigue empresa nueva")
db = _DB(); _seed(db)
req = _Request(db)
r1 = asyncio.run(fr.follow("company", "co_1", req, _user()))
check("follows registra relacion", db.follows.count_documents({"entity_type": "company", "entity_id": "co_1"}), 1)
check("bridge company_follows", len(db.company_follows.docs), 1)
check("companies.followers_count aumenta", db.companies.docs[0]["followers_count"], 1)
check("respuesta my_following", r1["my_following"], True)
check("respuesta count", r1["count"], 1)
check("campo fantasma follower_count NO se escribe", db.companies.docs[0].get("follower_count"), None)

# ==== CASO 2: dejar de seguir ====
print("\n[CASO 2] Usuario deja de seguir")
r2 = asyncio.run(fr.unfollow("company", "co_1", req, _user()))
check("follows relacion eliminada", db.follows.count_documents({"entity_type": "company", "entity_id": "co_1"}), 0)
check("company_follows vacio", len(db.company_follows.docs), 0)
check("companies.followers_count disminuye", db.companies.docs[0]["followers_count"], 0)
check("respuesta my_following", r2["my_following"], False)

asyncio.run(fr.unfollow("company", "co_1", req, _user()))
check("contador nunca baja de 0", db.companies.docs[0]["followers_count"], 0)

# ==== CASO 3: idempotencia ====
print("\n[CASO 3] Seguir dos veces (idempotencia)")
db2 = _DB(); _seed(db2)
req2 = _Request(db2)
r_a = asyncio.run(fr.follow("company", "co_1", req2, _user()))
r_b = asyncio.run(fr.follow("company", "co_1", req2, _user()))
check("contador tras doble follow", db2.companies.docs[0]["followers_count"], 1)
check("count 1er follow", r_a["count"], 1)
check("count 2do follow", r_b["count"], 1)
check("sigue siendo 1 relacion", db2.follows.count_documents({"entity_type": "company", "entity_id": "co_1"}), 1)

# ==== REGRESION: otros entity_type no tocan companies ====
print("\n[REGRESION] entity_type != company no toca companies")
db3 = _DB(); _seed(db3, followers=7)
asyncio.run(fr.follow("user", "u_2", _Request(db3), _user()))
check("contador de empresa intacto", db3.companies.docs[0]["followers_count"], 7)

print("\n" + "=" * 58)
if FAILURES:
    print(f"RESULTADO: {len(FAILURES)} FALLO(S)")
    for f in FAILURES:
        print(f"  - {f}")
    sys.exit(1)
print("RESULTADO: TODAS LAS COMPROBACIONES OK")