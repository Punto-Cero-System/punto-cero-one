"""
FASE 2.1 — Centro de Notificaciones: los 4 eventos sociales → Notification ∥ Activity.

Congela el comportamiento de los PRIMEROS 4 conectores del Activity Layer
(decisión Option A: conectar `activities` SIN tocar `publish` ni nada que ya
funcione):

  user.followed   → follows_routes.follow
  post.commented  → feed_routes.add_comment
  post.reacted    → feed_routes.react_to_post
  post.mentioned  → feed_routes._dispatch_mentions

Por cada evento se exige DOBLE escritura:
  * UNA notificación (`services.notifications.dispatch`) con el texto
    personalizado que escribe el PRODUCTOR (los textos congelados de la
    Fase 1.1B — nunca el genérico del consumidor), y
  * UNA fila en el log append-only `activities` (`services.activities.record`,
    vocabulario cerrado, `visibility="private"` → legible por su actor).

SIN `publish()`: el consumidor `notifications` de `activity_consumers` no se
conecta todavía. Si se conectara hoy, emitiría una SEGUNDA notificación
genérica ("Alguien te siguió…") junto a la personalizada — la regla R8 del
contrato (un solo escritor por evento) queda congelada por el test de
vocabulario/origen de más abajo.

El centro de notificaciones (listar / marcar leída / marcar todo) se prueba
contra `routes.notification_routes` con el MISMO doble: esas rutas solo
existían en la suite de integración apuntada a producción
(`test_wave25_core.py`), que no corre de forma aislada.

Estilo: funciones de ruta llamadas directamente (patrón de
`test_group_follow_graph`) sobre un doble de Mongo en memoria — sin red, sin
servidor, sin SSE. Cada test hace su propio `asyncio.run`.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from models_feed import CommentCreate, ReactionInput          # noqa: E402
from services import activity_consumers as consumers            # noqa: E402
from services import activity_reader                           # noqa: E402
from routes import feed_routes, follows_routes                 # noqa: E402
from routes import notification_routes as nroutes              # noqa: E402
from services.activities import (                             # noqa: E402
    ACTIVITY_KINDS, ActivityValidationError, build_activity,
)


# ---------------------------------------------------------------------------
# Doubles — colecciones en memoria con la superficie Mongo que usan estas rutas
# ---------------------------------------------------------------------------
def _match(doc: dict, flt: dict) -> bool:
    for key, cond in (flt or {}).items():
        if key == "$or":
            if not any(_match(doc, sub) for sub in cond):
                return False
            continue
        if isinstance(cond, dict) and any(str(k).startswith("$") for k in cond):
            for op, val in cond.items():
                if op == "$in":
                    if doc.get(key) not in val:
                        return False
                elif op == "$ne":
                    if doc.get(key) == val:
                        return False
                else:
                    raise AssertionError(f"operador no soportado en el doble: {op}")
        elif doc.get(key) != cond:
            return False
    return True


def _set_path(doc: dict, path: str, value) -> None:
    parts = path.split(".")
    cur = doc
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def _apply_update(doc: dict, update: dict) -> None:
    for op, fields in update.items():
        if op == "$set":
            for path, value in fields.items():
                _set_path(doc, path, value)
        elif op == "$setOnInsert":
            # Mongo lo aplica SOLO en inserción; sobre un doc existente se ignora.
            continue
        elif op == "$inc":
            for path, value in fields.items():
                parts = path.split(".")
                cur = doc
                for p in parts[:-1]:
                    cur = cur.setdefault(p, {})
                cur[parts[-1]] = cur.get(parts[-1], 0) + value
        else:
            raise AssertionError(f"update no soportado en el doble: {op}")


def _upsert_doc(flt: dict, update: dict) -> dict:
    doc = {k: v for k, v in (flt or {}).items()
           if not str(k).startswith("$") and not isinstance(v, dict)}
    for op, fields in update.items():
        if op in ("$set", "$setOnInsert"):
            for path, value in fields.items():
                _set_path(doc, path, value)
    return doc


class _Result:
    def __init__(self, upserted_id=None, modified_count=0, deleted_count=0):
        self.upserted_id = upserted_id
        self.modified_count = modified_count
        self.deleted_count = deleted_count


class _Cursor:
    """Cursor encadenable: .sort(...).limit(...) + iteración async."""

    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, key, direction=1):
        specs = key if isinstance(key, list) else [(key, direction)]
        for spec in reversed(specs):
            field, direction = spec
            self._docs.sort(key=lambda d: (d.get(field) is None, d.get(field)),
                            reverse=(direction == -1))
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    def __aiter__(self):
        async def _gen():
            for d in self._docs:
                yield d
        return _gen()


class _Collection:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    async def find_one(self, flt, projection=None):
        for d in self.docs:
            if _match(d, flt):
                return dict(d)
        return None

    def find(self, flt, projection=None):
        return _Cursor(dict(d) for d in self.docs if _match(d, flt))

    async def insert_one(self, doc):
        stored = dict(doc)
        stored.setdefault("_id", f"oid_{len(self.docs) + 1}")
        self.docs.append(stored)
        return _Result(upserted_id=stored["_id"])

    async def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if _match(d, flt):
                _apply_update(d, update)
                return _Result(modified_count=1)
        if upsert:
            new = _upsert_doc(flt, update)
            new.setdefault("_id", f"oid_{len(self.docs) + 1}")
            self.docs.append(new)
            return _Result(upserted_id=new["_id"])
        return _Result()

    async def update_many(self, flt, update):
        n = 0
        for d in self.docs:
            if _match(d, flt):
                _apply_update(d, update)
                n += 1
        return _Result(modified_count=n)

    async def delete_one(self, flt):
        for i, d in enumerate(self.docs):
            if _match(d, flt):
                del self.docs[i]
                return _Result(deleted_count=1)
        return _Result()

    async def count_documents(self, flt):
        return sum(1 for d in self.docs if _match(d, flt))


COLLECTION_NAMES = (
    "posts", "post_comments", "post_reactions", "follows",
    "notifications", "notification_preferences", "activities",
    "users", "user_sessions", "groups", "group_members",
    "companies", "company_follows",
)


class _FakeDB:
    def __init__(self, **collections):
        desconocidas = set(collections) - set(COLLECTION_NAMES)
        assert not desconocidas, f"colecciones mal escritas en el test: {desconocidas}"
        self._collections = {
            name: _Collection(collections.get(name, ())) for name in COLLECTION_NAMES
        }

    def __getattr__(self, name):
        if name in self._collections:
            return self._collections[name]
        raise AttributeError(name)


class _BrokenCollection:
    """`activities` fuera de servicio: `record()` lo traga, el hecho user no."""

    async def insert_one(self, doc):
        raise RuntimeError("activities no disponible")


def _request(db) -> SimpleNamespace:
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=db)))


def _session(user_id: str) -> dict:
    return {
        "session_token": "tok",
        "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    }


# --- datos base ------------------------------------------------------------
# ANA usa la forma canónica `user_` + 12 hex para poder autocitarse (@mención).
ANA = {"id": "user_a1b2c3d4e5f6", "name": "Ana", "email": "ana@punto.cero"}
BRUNO = {"id": "usr_bruno", "name": "Beto", "email": "beto@punto.cero"}
MARTA = {"id": "user_0badf00d1234", "name": "Marta", "email": "marta@punto.cero"}
POST_ID = "pst_000000000001"


def _post(author_id=BRUNO["id"], post_id=POST_ID) -> dict:
    return {
        "id": post_id, "author_id": author_id, "status": "published",
        "visibility": "public", "body": "Hola comunidad",
        "counts": {"comments": 0, "reactions": 0, "shares": 0, "saves": 0, "views": 0},
        "reactions_by_kind": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _kinds(coll) -> list:
    return [d.get("kind") for d in coll.docs]


# ---------------------------------------------------------------------------
# 1) user.followed — follows_routes.follow
# ---------------------------------------------------------------------------
def test_seguir_registra_notificacion_y_actividad_sin_duplicados():
    db = _FakeDB(users=[ANA, BRUNO])
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))

    # La notificación sale del PRODUCTOR con su texto congelado (Fase 1.1B),
    # dirigida al que es seguido — nunca el genérico del consumidor.
    assert _kinds(db.notifications) == ["follower"]
    n = db.notifications.docs[0]
    assert n["recipient_id"] == BRUNO["id"]
    assert n["title"] == "Ana empezó a seguirte"          # texto congelado
    assert n["title"] != consumers.NOTIFICATION_TITLES["user.followed"]
    assert n["actor_id"] == ANA["id"]                      # nombre/foto presentes
    assert n["actor_name"] == ANA["name"]
    assert n["subject_url"] == f"/u/{ANA['id']}"           # abre el perfil de Ana
    assert n["created_at"]

    # El mismo hecho, una sola vez, en el log append-only `activities`.
    assert _kinds(db.activities) == ["user.followed"]
    a = db.activities.docs[0]
    assert a["actor_id"] == ANA["id"]
    assert a["audience"] == {"type": "user", "id": BRUNO["id"]}
    assert a["visibility"] == "private"                    # legible por su actor
    assert a["metadata"].get("subject_url")                # navegable


def test_seguir_repetido_no_duplica_la_actividad():
    db = _FakeDB(users=[ANA, BRUNO])
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))
    # El segundo POST no insertó nada → no hay hecho nuevo en el log.
    assert _kinds(db.activities) == ["user.followed"]


# ---------------------------------------------------------------------------
# 2) post.commented — feed_routes.add_comment
# ---------------------------------------------------------------------------
def test_comentario_registra_notificacion_y_actividad():
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    asyncio.run(feed_routes.add_comment(
        POST_ID, CommentCreate(body="¡Gran post!"), _request(db),
        session_token="tok", authorization=None))

    assert _kinds(db.notifications) == ["comment"]
    n = db.notifications.docs[0]
    assert n["recipient_id"] == BRUNO["id"]               # el dueño del post
    assert n["title"] == "Ana comentó tu publicación"
    assert n["actor_id"] == ANA["id"]
    assert n["actor_name"] == ANA["name"]
    assert n["subject_url"] == f"/?post={POST_ID}"
    assert n["created_at"]

    assert _kinds(db.activities) == ["post.commented"]
    a = db.activities.docs[0]
    assert a["audience"] == {"type": "user", "id": BRUNO["id"]}
    assert a["metadata"]["excerpt"] == "¡Gran post!"

    # El feed no se descuadra: el contador avanza (el hecho es real).
    post = asyncio.run(db.posts.find_one({"id": POST_ID}))
    assert post["counts"]["comments"] == 1


# ---------------------------------------------------------------------------
# 3) post.reacted — feed_routes.react_to_post
# ---------------------------------------------------------------------------
def test_reaccion_nueva_registra_notificacion_y_actividad():
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    out = asyncio.run(feed_routes.react_to_post(
        POST_ID, ReactionInput(kind="like"), _request(db),
        session_token="tok", authorization=None))
    assert out == {"reacted": True, "kind": "like"}

    assert _kinds(db.notifications) == ["reaction"]
    assert db.notifications.docs[0]["title"] == "Ana reaccionó con like"
    assert db.notifications.docs[0]["actor_name"] == ANA["name"]
    assert db.notifications.docs[0]["subject_url"] == f"/?post={POST_ID}"
    assert db.notifications.docs[0]["created_at"]
    assert _kinds(db.activities) == ["post.reacted"]
    assert db.activities.docs[0]["audience"] == {"type": "user", "id": BRUNO["id"]}


def test_toggle_off_y_cambio_de_tipo_no_registran_nada():
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    # nueva → registra
    asyncio.run(feed_routes.react_to_post(
        POST_ID, ReactionInput(kind="like"), _request(db),
        session_token="tok", authorization=None))
    # cambio de tipo sobre la existente → cambia el voto, no crea hecho nuevo
    out = asyncio.run(feed_routes.react_to_post(
        POST_ID, ReactionInput(kind="insight"), _request(db),
        session_token="tok", authorization=None))
    assert out == {"reacted": True, "kind": "insight"}
    # mismo tipo → se apaga: el hecho "reaccionó" ya no es cierto
    out = asyncio.run(feed_routes.react_to_post(
        POST_ID, ReactionInput(kind="insight"), _request(db),
        session_token="tok", authorization=None))
    assert out == {"reacted": False}

    assert _kinds(db.activities) == ["post.reacted"]       # solo la primera
    assert _kinds(db.notifications) == ["reaction"]        # sin avisos de más


# ---------------------------------------------------------------------------
# 4) post.mentioned — feed_routes._dispatch_mentions (via add_comment)
# ---------------------------------------------------------------------------
def test_mencion_registra_notificacion_y_actividad():
    db = _FakeDB(users=[ANA, BRUNO, MARTA], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    body = f"¡Hola @{MARTA['id']}, mira esto!"
    asyncio.run(feed_routes.add_comment(
        POST_ID, CommentCreate(body=body), _request(db),
        session_token="tok", authorization=None))

    # DOS hechos: el comentario (para el dueño del post) y la mención
    # (para la mencionada) — cada uno con su doble escritura.
    assert _kinds(db.activities) == ["post.commented", "post.mentioned"]
    mentioned = [a for a in db.activities.docs if a["kind"] == "post.mentioned"][0]
    assert mentioned["audience"] == {"type": "user", "id": MARTA["id"]}
    assert mentioned["visibility"] == "private"
    assert MARTA["id"] in mentioned["metadata"]["excerpt"]

    assert _kinds(db.notifications) == ["comment", "mention"]
    n = [x for x in db.notifications.docs if x["kind"] == "mention"][0]
    assert n["recipient_id"] == MARTA["id"]
    assert n["title"] == "Ana te mencionó"                 # texto congelado
    assert n["actor_name"] == ANA["name"]
    assert n["subject_url"] == f"/?post={POST_ID}"
    assert n["created_at"]


def test_automenion_y_mencion_sin_destinatario_no_generan_nada():
    db = _FakeDB(users=[ANA], user_sessions=[_session(ANA["id"])],
                 posts=[_post(author_id=ANA["id"])])
    body = f"me apuesto @{ANA['id']} y @{'user_ffffffffffff'}"
    asyncio.run(feed_routes.add_comment(
        POST_ID, CommentCreate(body=body), _request(db),
        session_token="tok", authorization=None))

    # No te comentas a ti mismo, no te mencionas a ti mismo y un @ a un
    # usuario inexistente no inventa destinatarios → nada que registrar.
    assert _kinds(db.activities) == ["post.commented"]     # sin post.mentioned
    assert db.notifications.docs == []


def test_accion_propia_registra_el_hecho_pero_no_se_avisa_a_si_mismo():
    db = _FakeDB(users=[ANA], user_sessions=[_session(ANA["id"])],
                 posts=[_post(author_id=ANA["id"])])
    asyncio.run(feed_routes.react_to_post(
        POST_ID, ReactionInput(kind="like"), _request(db),
        session_token="tok", authorization=None))

    assert db.notifications.docs == []                     # no te avisas a ti mismo
    assert _kinds(db.activities) == ["post.reacted"]       # el hecho sí ocurrió


# ---------------------------------------------------------------------------
# 5) El log es opcional: si falla, el producto sigue vivo (R8 no rompe nada)
# ---------------------------------------------------------------------------
def test_si_el_log_de_actividades_falla_el_comentario_no_se_rompe():
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    db.activities = _BrokenCollection()

    asyncio.run(feed_routes.add_comment(
        POST_ID, CommentCreate(body="¡Gran post!"), _request(db),
        session_token="tok", authorization=None))

    assert len(db.post_comments.docs) == 1                 # el comentario vive
    assert _kinds(db.notifications) == ["comment"]         # y el aviso también


# ---------------------------------------------------------------------------
# 6) Centro de notificaciones — routes.notification_routes (list / marcar)
# ---------------------------------------------------------------------------
def test_centro_de_notificaciones_listar_marcar_y_marcar_todo():
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))
    asyncio.run(feed_routes.add_comment(
        POST_ID, CommentCreate(body="¡Hola!"), _request(db),
        session_token="tok", authorization=None))

    page = asyncio.run(nroutes.list_notifications(
        request=_request(db), user=BRUNO, limit=20, cursor=None,
        unread_only=False))
    assert len(page.items) == 2
    assert page.unread == 2                                # ninguna leída aún

    target = page.items[0]
    asyncio.run(nroutes.mark_read(
        notification_id=target.id, request=_request(db), unread=False, user=BRUNO))
    page2 = asyncio.run(nroutes.list_notifications(
        request=_request(db), user=BRUNO, limit=20, cursor=None,
        unread_only=False))
    assert page2.unread == 1

    solo_no_leidas = asyncio.run(nroutes.list_notifications(
        request=_request(db), user=BRUNO, limit=20, cursor=None,
        unread_only=True))
    assert [i.id for i in solo_no_leidas.items] == [
        i.id for i in page2.items if i.id != target.id]

    res = asyncio.run(nroutes.mark_all_read(request=_request(db), user=BRUNO))
    assert res == {"ok": True, "updated": 1}
    page3 = asyncio.run(nroutes.list_notifications(
        request=_request(db), user=BRUNO, limit=20, cursor=None,
        unread_only=False))
    assert page3.unread == 0


def test_el_no_leido_del_centrismo_no_se_filtra_por_otro_usuario():
    """La campana de ANA no ve las no leídas de BRUNO."""
    db = _FakeDB(users=[ANA, BRUNO], user_sessions=[_session(ANA["id"])],
                 posts=[_post()])
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))

    solo_ana = asyncio.run(nroutes.list_notifications(
        request=_request(db), user=ANA, limit=20, cursor=None, unread_only=True))
    assert solo_ana.items == []                            # la seguir fue para BETO
    assert solo_ana.unread == 0


# ---------------------------------------------------------------------------
# 7) Lectura del log: visible para su actor, jamás para el destinatario
# ---------------------------------------------------------------------------
def test_el_hecho_es_legible_por_su_actor_y_no_por_el_destinatario():
    db = _FakeDB(users=[ANA, BRUNO])
    asyncio.run(follows_routes.follow("user", BRUNO["id"], _request(db), user=ANA))

    # ANA (la actor) ve su hecho: `visibility="private"` es legible por actor.
    para_ana = asyncio.run(activity_reader.list_activities(
        db, viewer={"id": ANA["id"]}))
    assert [i["kind"] for i in para_ana["items"]] == ["user.followed"]

    # BETO (el destinatario) recibió una NOTIFICACIÓN, no una fila del log:
    # su feed de actividad no contiene el hecho dirigido a él.
    para_bruno = asyncio.run(activity_reader.list_activities(
        db, viewer={"id": BRUNO["id"]}))
    assert para_bruno["items"] == []

    # Sin sesión no hay nada que leer.
    anonimo = asyncio.run(activity_reader.list_activities(db, viewer=None))
    assert anonimo["items"] == []


# ---------------------------------------------------------------------------
# 8) Vocabulario cerrado + regla R8: los productores solo escriben
# ---------------------------------------------------------------------------
def test_vocabulario_cerrado_y_productores_sin_publish():
    # El 4º conector está en el vocabulario y el consumidor lo sabe mapear
    # POR SI ALGÚN DÍA se conecta (hoy no: sería el duplicador de avisos).
    assert "post.mentioned" in ACTIVITY_KINDS
    assert consumers.NOTIFICATION_KINDS["post.mentioned"] == "mention"
    assert consumers.NOTIFICATION_TITLES["post.mentioned"] == "Alguien te mencionó"

    doc = build_activity(
        kind="post.mentioned", actor_id=ANA["id"], subject_type="post",
        subject_id=POST_ID, audience={"type": "user", "id": MARTA["id"]},
        visibility="private", metadata={"excerpt": "hola @marta"})
    assert doc["kind"] == "post.mentioned"
    assert doc["expires_at"] is not None

    with pytest.raises(ActivityValidationError):
        build_activity(
            kind="post.tweet", actor_id=ANA["id"], subject_type="post",
            subject_id=POST_ID, audience={"type": "user", "id": MARTA["id"]},
            visibility="private")

    # Regla R8: los conectores NUEVOS solo IMPORTAN `record_activity`. Importar
    # el publicador aquí (o llamar a `publish_activity`) duplicaría los avisos:
    # ya notifican en directo Y el consumidor `notifications` emitiría además
    # su aviso genérico. (`groups` sí publica por diseño — puente F0.9.7 — y
    # se vigila por separado en los guards f0_9_3/f0_9_4.)
    for nombre in ("feed_routes.py", "follows_routes.py"):
        origen = (BACKEND / "routes" / nombre).read_text(encoding="utf-8")
        assert "record_activity(" in origen, nombre
        assert "activity_consumers" not in origen, nombre
        assert "publish_activity" not in origen, nombre




