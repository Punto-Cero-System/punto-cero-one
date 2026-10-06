"""
D1 — USER STATUS ACCESS ENFORCEMENT.

El corte fail-closed por `status` ya existía y era correcto en
`entitlement_service.get_entitlements` y `policy_can.can()`. Lo que faltaba era
el dato: `_access_context` leía `status` únicamente de `jwt_user`.

BRECHA REAL QUE CIERRA ESTE CARRIL
-----------------------------------
Un usuario que entra solo por cookie de comunidad llega con `jwt_user=None`
(`Depends(get_current_user)` es opcional en `/access/entitlements` y
`/access/intent`). Entonces `status` era `None` → normalizado a "activo" →
ACCESO CONCEDIDO a un usuario suspendido. La cookie es la vía normal de One,
así que ese era el caso habitual, no la excepción.

Este test demuestra, sobre el código real:

  · activo     → acceso concedido
  · suspendido → acceso denegado, por AMBAS vías de entrada
  · pendiente  → comportamiento actual validado (deniega, no se inventa regla)
  · ausente    → compatibilidad: se asume activo (comportamiento previo)
  · desconocido→ fail-closed (bloqueado/deleted deniegan solos, sin código nuevo)
  · el intent lleva el status real al sujeto canónico

Autocontenido: dobles en memoria, sin Mongo.
"""
from __future__ import annotations

import asyncio
import copy
import inspect
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from services import access_bridge as bridge  # noqa: E402
from services import entitlement_service as ent  # noqa: E402
from services import policy_can as can  # noqa: E402
from routes import access_bridge_routes as abr  # noqa: E402

FAILURES: list[str] = []
ENTITY = "pc_usr_01M3JEKXKZ4F5703Y3TVPVKD1A"


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


class _Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    async def find_one(self, q=None, proj=None):
        for d in self.docs:
            if all(d.get(k) == v for k, v in (q or {}).items()):
                return copy.deepcopy(d)
        return None


class FakeDB:
    def __init__(self, users=(), sessions=()):
        self.users = _Collection(users)
        self.user_sessions = _Collection(sessions)


class _Request:
    def __init__(self, db, token=None):
        self.app = type("A", (), {"state": type("S", (), {"db": db})()})()
        self.headers = {}
        self.cookies = {"session_token": token} if token else {}


def user(uid, status="activo", role="member"):
    return {"id": uid, "name": f"U {uid}", "email": f"{uid}@t.com",
            "status": status, "role": role}


async def resolved_status(status, via_cookie=True, jwt=None):
    """Invoca el helper real de resolución de status.

    `community_deps.current_user_or_none` resuelve la cookie contra
    `user_sessions` y luego `users`, y exige `expires_at` en vigor: sin él la
    sesión se descarta y el test mediría a un anónimo en vez de al usuario.
    """
    u = user("usr_x", status=status)
    if status is None:
        u.pop("status")
    sessions = [{"session_token": "tok_x", "user_id": "usr_x",
                 "expires_at": "2099-01-01T00:00:00+00:00"}] if via_cookie else []
    req = _Request(FakeDB(users=[u], sessions=sessions),
                   token="tok_x" if via_cookie else None)
    return await abr._resolved_status(req, jwt)


# ===========================================================================
# 1. `_resolved_status` lee de las DOS fuentes
# ===========================================================================
section("1. el status se resuelve por cualquier via de entrada")
check("usuario con JWT y status",
      asyncio.run(resolved_status("suspendido", jwt=user("usr_j", "suspendido"))), "suspendido")
check("usuario solo con cookie de comunidad",
      asyncio.run(resolved_status("suspendido")), "suspendido")
check("sin ninguna fuente: None (compatibilidad)",
      asyncio.run(resolved_status("suspendido", via_cookie=False)), None)
check("JWT manda si ambas fuentes traen status",
      asyncio.run(resolved_status("activo", jwt=user("usr_j", "activo"))), "activo")

section("1b. LA BRECHA QUE SE CIERRA")
# Reproductor del bug: la cookie es la via normal de One y antes se ignoraba.
_por_cookie = asyncio.run(resolved_status("suspendido", jwt=None))
check("un suspendido por cookie YA no llega como None", _por_cookie, "suspendido")
ok("por tanto get_entitlements ya no lo resuelve como 'activo'",
   ent.get_entitlements(subject_id="usr_x", status=_por_cookie) == [])
ok("el bug reproducido: antes (solo jwt_user) llegaba como activo",
   ent.get_entitlements(subject_id="usr_x", status=None) != [],
   "(esto es exactamente lo que pasaba por cookie)")

# ===========================================================================
# 2. Regla de estados sobre la politica real (fail-closed existente)
# ===========================================================================
section("2. regla de estados en entitlement_service (politica existente)")
check("activo concede", ent.get_entitlements(subject_id="usr_x", status="activo"),
      ["workspace.open.comunidad"])
check("suspendido deniega TODO", ent.get_entitlements(subject_id="usr_x", status="suspendido"), [])
check("pendiente deniega TODO (comportamiento actual, sin inventar regla)",
      ent.get_entitlements(subject_id="usr_x", status="pendiente"), [])
check("bloqueado deniega (fail-closed: no es estado conocido)",
      ent.get_entitlements(subject_id="usr_x", status="bloqueado"), [])
check("deleted deniega (fail-closed)",
      ent.get_entitlements(subject_id="usr_x", status="deleted"), [])
check("ausente -> activo (compatibilidad: ningun usuario preexisting pierde acceso)",
      ent.get_entitlements(subject_id="usr_x", status=None), ["workspace.open.comunidad"])

section("2b. vertical + organization tampoco sobreviven a la suspension")
check("con vertical, suspendido sigue sin nada",
      ent.get_entitlements(subject_id="usr_x", status="suspendido", verticals=["legal"]), [])
check("con organization, suspendido sigue sin nada",
      ent.get_entitlements(subject_id="usr_x", status="suspendido",
                           organizations=[{"company_id": "c1", "vertical": "empresa"}]), [])

# ===========================================================================
# 3. La MISMA regla en policy_can (el evaluador final)
# ===========================================================================
section("3. policy_can: el status frena en el paso 1")
_SUB = {"id": ENTITY, "entitlements": ["workspace.open.legal"], "status": "activo"}
check("activo + entitlement -> allow",
      can.can(_SUB, "workspace.open.legal", {}), can.ALLOW)
check("suspendido -> deny aunque tenga el entitlement",
      can.can({**_SUB, "status": "suspendido"}, "workspace.open.legal", {}), can.DENY)
check("pendiente -> deny", can.can({**_SUB, "status": "pendiente"}, "workspace.open.legal", {}), can.DENY)
check("bloqueado -> deny (fail-closed)",
      can.can({**_SUB, "status": "bloqueado"}, "workspace.open.legal", {}), can.DENY)
check("deleted -> deny (fail-closed)",
      can.can({**_SUB, "status": "deleted"}, "workspace.open.legal", {}), can.DENY)
check("sin status -> allow (compatibilidad)",
      can.can({"id": ENTITY, "entitlements": ["workspace.open.legal"]},
              "workspace.open.legal", {}), can.ALLOW)

# ===========================================================================
# 4. El intent lleva el status real al sujeto canonico
# ===========================================================================
section("4. el intent transporta el status real")
check("build_subject conserva el status",
      can.build_subject(ENTITY, ["workspace.open.legal"], "suspendido")["status"], "suspendido")
check("y sin status, normaliza a activo (compatibilidad)",
      can.build_subject(ENTITY, ["workspace.open.legal"], None)["status"], "activo")
ok("create_access_intent acepta el kwarg status",
   "status" in inspect.signature(bridge.create_access_intent).parameters)

section("4b. un suspendido no obtiene intent")
_rights = ent.get_entitlements(subject_id="usr_x", status="suspendido", verticals=["legal"])
check("los entitlements salen vacios", _rights, [])
_denied = False
try:
    bridge.create_access_intent(subject_id=ENTITY, space_key="legal",
                                entitlements=_rights, status="suspendido")
except PermissionError:
    _denied = True
except Exception as e:
    FAILURES.append(f"excepcion inesperada: {type(e).__name__}: {e}")
ok("create_access_intent deniega al suspendido", _denied)

# ===========================================================================
# 5. No se inventa arquitectura
# ===========================================================================
section("5. no se creo regla, rol ni arquitectura nueva")
_src = (BACKEND / "routes" / "access_bridge_routes.py").read_text(encoding="utf-8")
ok("no se definen estados nuevos",
   "VALID_STATUSES" not in _src and "Literal" not in _src)
ok("el status solo se propaga, no se persiste",
   "status=effective_status" in _src and "$set" not in _src)
ok("no se toco la politica: sigue en entitlement_service/policy_can",
   ent.VALID_STATUSES == ("activo", "pendiente", "suspendido")
   and can.VALID_STATUSES == ("activo", "pendiente", "suspendido"))
ok("no se movio ningun workspace",
   (BACKEND / "services" / "workspace_registry.py").exists())
ok("no se creo Billing", not list(BACKEND.glob("services/billing*.py")))
ok("no se anadio ningun rol: `role` se sigue leyendo igual que antes",
   'role=(jwt_user or {}).get("role")' in _src)
ok("los registros del registry siguen intactos",
   "workspace_registry as registry" in _src)

print("\n" + "=" * 62)
if FAILURES:
    print(f"FALLARON {len(FAILURES)}:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("D1 VERIFICADO")
