"""
OMEGA F0.8 — evidencia del control de privacidad de grupos.

Ejercita `services.group_permissions` contra un doble de MongoDB. Cubre los
6 casos obligatorios y los 6 de borde del brief:

 1. Público + anónimo          → OK      7. Legacy sin privacy   → público
 2. Público + usuario          → OK      8. Anónimo en privado   → 403
 3. Privado + externo          → 403     9. Inexistente         → 404
 4. Privado + miembro          → OK     10. Admin fuera de members → acceso
 5. Privado + admin            → OK     11. Admin en members, otro admin_id
 6. Privado + admin plataforma → OK     12. Públicos no se rompen

Motivo: la suite pytest del repo está atada a un contenedor Linux (`/app/...`)
y a un Mongo remoto; este test es autocontenido y corre en local.
"""
from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException  # noqa: E402
from services import group_permissions as gp  # noqa: E402

PUBLIC, MEMBER, ADMIN, DENIED = gp.PUBLIC, gp.MEMBER, gp.ADMIN, gp.DENIED

FAILURES = []


def check(label, actual, expected):
    if asyncio.iscoroutine(actual):
        actual = asyncio.run(actual)
    ok = actual == expected
    print(f"  {'PASS' if ok else 'FAIL'}  {label}: {actual!r} (esperado {expected!r})")
    if not ok:
        FAILURES.append(f"{label}: {actual!r} != {expected!r}")


class _Result:
    def __init__(self, upserted_id=None, deleted_count=0):
        self.upserted_id = upserted_id
        self.deleted_count = deleted_count


class _Collection:
    """Mongo en memoria con los operadores que usa el código real."""

    def __init__(self, docs=None):
        self.docs = docs or []

    @staticmethod
    def _match(doc, q):
        # `$or` puede aparecer como clave raíz (query del filtro de listado).
        if "$or" in q:
            return any(_Collection._match(doc, sub) for sub in q["$or"])
        for k, v in q.items():
            actual = doc.get(k)
            if isinstance(v, dict):
                if "$in" in v:
                    if actual not in v["$in"]:
                        return False
                elif "$gt" in v:
                    if not (actual is not None and actual > v["$gt"]):
                        return False
                elif "$ne" in v:
                    if actual == v["$ne"]:
                        return False
                elif "$or" in v:
                    if not any(_Collection._match(doc, sub) for sub in v["$or"]):
                        return False
            elif actual != v:
                return False
        return True

    async def find_one(self, q, proj=None):
        for d in self.docs:
            if self._match(d, q):
                return copy.deepcopy(d)
        return None

    def find_sync(self, q):
        return [copy.deepcopy(d) for d in self.docs if self._match(d, q)]

    def find(self, q, proj=None):
        """Motor cursor: soportado como iterador async (`async for doc in ...`)."""
        rows = self.find_sync(q)

        class _Cursor:
            def __aiter__(self_inner):
                async def _gen():
                    for r in rows:
                        yield r
                return _gen()

        return _Cursor()

    async def update_one(self, q, upd, upsert=False):
        for d in self.docs:
            if self._match(d, q):
                if "$inc" in upd:
                    for k, v in upd["$inc"].items():
                        d[k] = d.get(k, 0) + v
                if "$set" in upd:
                    d.update(upd["$set"])
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


class _DB:
    def __init__(self, groups=None, members=None):
        self.groups = _Collection(groups or [])
        self.group_members = _Collection(members or [])
        self.group_posts = _Collection([])
        self.users = _Collection([])


def member(uid, gid, role="member"):
    return {"group_id": gid, "user_id": uid, "role": role, "joined_at": "2026-01-01"}
# ---------- 1-2: grupos PÚBLICOS ----------
print("\n[CASO 1] Público + anónimo")
db = _DB(groups=[{"id": "g_pub", "name": "Legal", "privacy": "public", "admin_id": "u_admin"}])
check("acceso anónimo = public", gp.evaluate_access(db, db.groups.docs[0], None), PUBLIC)

print("\n[CASO 2] Público + usuario autenticado")
db.group_members.docs.append(member("u_1", "g_pub"))
check("acceso usuario = public", gp.evaluate_access(db, db.groups.docs[0], {"id": "u_1"}), PUBLIC)
_, info = asyncio.run(gp.load_visible_group(db, "g_pub", {"id": "u_1"}))
check("is_member correcto", info["is_member"], True)

# ---------- 3-6: grupos PRIVADOS ----------
print("\n[CASO 3] Privado + usuario externo → 403")
PRIV = [{"id": "g_priv", "name": "Clandestino", "privacy": "private", "admin_id": "u_admin"}]
db3 = _DB(groups=copy.deepcopy(PRIV), members=[member("u_admin", "g_priv", "admin")])
check("acceso externo = denied", gp.evaluate_access(db3, db3.groups.docs[0], {"id": "u_x"}), DENIED)

print("\n[CASO 4] Privado + miembro → OK")
db4 = _DB(groups=copy.deepcopy(PRIV), members=[member("u_admin", "g_priv", "admin"), member("u_1", "g_priv")])
check("acceso miembro simple = member", gp.evaluate_access(db4, db4.groups.docs[0], {"id": "u_1"}), MEMBER)

print("\n[CASO 5] Privado + admin del grupo → OK")
check("acceso admin_id = admin", gp.evaluate_access(db3, db3.groups.docs[0], {"id": "u_admin"}), ADMIN)

print("\n[CASO 6] Privado + admin de plataforma → OK")
check("acceso admin plataforma", gp.evaluate_access(db3, db3.groups.docs[0], {"id": "u_root", "role": "admin"}), ADMIN)

# ---------- 7: legacy sin privacy ----------
print("\n[CASO 7] Grupo legacy sin campo privacy → público")
db7 = _DB(groups=[{"id": "g_legacy", "name": "Viejo", "admin_id": "u_admin"}])
check("normaliza a public", gp.group_privacy(db7.groups.docs[0]), PUBLIC)
check("acceso anónimo = public", gp.evaluate_access(db7, db7.groups.docs[0], None), PUBLIC)
db7b = _DB(groups=[{"id": "g_null", "name": "Null", "privacy": None, "admin_id": "u_admin"}])
check("privacy null = public", gp.group_privacy(db7b.groups.docs[0]), PUBLIC)

# ---------- 8: anónimo en privado ----------
print("\n[CASO 8] Anónimo en grupo privado → 403")
check("acceso anónimo = denied", gp.evaluate_access(db3, db3.groups.docs[0], None), DENIED)

# ---------- 9: inexistente → 404 ----------
print("\n[CASO 9] Grupo inexistente → 404")
group9, info9 = asyncio.run(gp.load_visible_group(db, "no_existe", {"id": "u_1"}))
check("group es None (→ 404)", group9, None)
check("info es None", info9, None)

# ---------- 10: admin fuera de group_members ----------
print("\n[CASO 10] Admin eliminado de members pero presente en admin_id")
db10 = _DB(groups=copy.deepcopy(PRIV), members=[])
check("acceso por admin_id = admin", gp.evaluate_access(db10, db10.groups.docs[0], {"id": "u_admin"}), ADMIN)

# ---------- 11: admin en members con admin_id distinto ----------
print("\n[CASO 11] Admin en members pero con admin_id diferente")
db11 = _DB(groups=copy.deepcopy(PRIV), members=[member("u_2", "g_priv", "admin")])
check("acceso por role = admin", gp.evaluate_access(db11, db11.groups.docs[0], {"id": "u_2"}), ADMIN)
check("ajeno sigue denied", gp.evaluate_access(db11, db11.groups.docs[0], {"id": "u_3"}), DENIED)

# ---------- 12: no romper públicos + filtro de listado ----------
print("\n[CASO 12] Públicos siguen visibles; privados filtrados")
db12 = _DB(
    groups=[
        {"id": "g_pub", "privacy": "public", "admin_id": "u_a"},
        {"id": "g_leg", "admin_id": "u_a"},
        {"id": "g_p1", "privacy": "private", "admin_id": "u_a"},
        {"id": "g_p2", "privacy": "private", "admin_id": "u_other"},
    ],
    members=[member("u_1", "g_p2"), member("u_1", "g_p1")],
)
q_anon, _ = asyncio.run(gp.visible_filter(db12, None))
check("anónimo ve solo públicos/legacy", sorted(d["id"] for d in db12.groups.find_sync(q_anon)), ["g_leg", "g_pub"])

q_u1, mine_u1 = asyncio.run(gp.visible_filter(db12, "u_1"))
check("miembro ve sus privados", sorted(d["id"] for d in db12.groups.find_sync(q_u1)), ["g_leg", "g_p1", "g_p2", "g_pub"])
check("member_ids reflejados", sorted(mine_u1), ["g_p1", "g_p2"])

q_admin, _ = asyncio.run(gp.visible_filter(db12, "u_a"))
check("admin_id ve sus privados", sorted(d["id"] for d in db12.groups.find_sync(q_admin)), ["g_leg", "g_p1", "g_pub"])

# ---------- join a privado bloqueado ----------
print("\n[EXTRA] Join: privado rechazado (403), público permitido")
db_j = _DB(groups=[{"id": "g_priv", "privacy": "private", "admin_id": "u_admin"},
                   {"id": "g_pub", "privacy": "public", "admin_id": "u_admin"}])


async def _join(gid):
    """Reproduce el guard de join_group sin escribir en la colección."""
    doc = await db_j.groups.find_one({"id": gid}, {"_id": 0, "id": 1, "privacy": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if doc.get("privacy") == "private":
        raise HTTPException(status_code=403, detail="Este grupo es privado")
    return {"ok": True, "joined": True}


try:
    asyncio.run(_join("g_priv"))
    check("join privado -> 403", "sin error", "403")
except HTTPException as e:
    check("join privado -> 403", e.status_code, 403)
check("join público -> permitido", asyncio.run(_join("g_pub")), {"ok": True, "joined": True})

print("\n" + "=" * 60)
if FAILURES:
    print(f"RESULTADO: {len(FAILURES)} FALLO(S)")
    for f in FAILURES:
        print(f"  - {f}")
    sys.exit(1)
print("RESULTADO: TODAS LAS COMPROBACIONES OK")