"""
FASE 0.3 — System Identity Layer. Tests de los 5 casos de diseño.

El servicio es asíncrono (motor) sobre un Mongo real. Como `pytest_asyncio` NO
está instalado, cada test corre dentro de UN SOLO `asyncio.run` que envuelve
cliente + escenario + limpieza: un cliente motor queda ligado al event loop con
el que se crea, y abrir otro produce "Event loop is closed".

NO toca la base de desarrollo: usa `test_system_identity` y la elimina al final.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.identity_registry import is_valid_system, list_tokens  # noqa: E402
from services.system_identity import (  # noqa: E402
    ALLOWED_SOURCES,
    CONFLICT_LINKED,
    CONFLICT_NONE,
    CONFLICT_SPLIT,
    COLLECTION,
    create_system_identity,
    ensure_indexes,
    find_by_external_profile,
    generate_entity_id,
    get_identity,
    is_valid_entity_id,
    link_profile,
    normalize_email,
    resolve_system_identity,
    project_user_by_id,
    project_user_identity,
)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

# Base única POR PROCESO. pytest-xdist lanza varios workers en paralelo y cada
# uno hace drop_database en su teardown: si compartieran nombre, el drop de uno
# abortaría el build de índices del otro ("IndexKeySpecsConflict"/"IndexBuildAborted").
TEST_DB = f"test_system_identity_{os.getpid()}"


def with_db(scenario):
    """Ejecuta `scenario(db)` en un único event loop, sobre base limpia e indexada."""
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _main():
        client = AsyncIOMotorClient(MONGO_URL)
        database = client[TEST_DB]
        try:
            await database.drop_collection(COLLECTION)
            await ensure_indexes(database)
            return await scenario(database)
        finally:
            await client.drop_database(TEST_DB)
            client.close()

    return asyncio.run(_main())


def mongo_test(fn):
    """
    Decorador: `fn(db)` se ejecuta sobre la base de pruebas aislada.

    NO usa functools.wraps a propósito: `wraps` copia `__wrapped__`, pytest
    seguiría inspeccionando la firma `(self, db)` y pediría un fixture llamado
    `db` que ya no existe.
    """
    def wrapper(*args, **_kwargs):
        # `self` llega como primer argumento posicional (el test está en una
        # clase), y `fn` sigue siendo la función cruda: hay que reinyectarlo.
        async def scenario(db):
            return await fn(*args, db)

        return with_db(scenario)

    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


class TestEntityId:
    """Pruebas puras de generación y validación del entity_id (sin DB)."""

    def test_formato_y_prefijo(self):
        eid = generate_entity_id()
        assert eid.startswith("pc_usr_")
        assert is_valid_entity_id(eid)
        assert len(eid) == len("pc_usr_") + 26

    def test_es_unico(self):
        ids = [generate_entity_id() for _ in range(200)]
        assert len(set(ids)) == 200

    def test_prefijo_temporal_estable_dentro_del_milisegundo(self):
        # El sufijo es aleatorio; los 10 chars de tiempo codifican el milisegundo.
        # Generar 50 ids es instantáneo, pero puede cruzar un límite de ms, así que
        # se admiten como mucho 2 prefijos distintos.
        ids = [generate_entity_id() for _ in range(50)]
        prefijos = {eid[len("pc_usr_"):len("pc_usr_") + 10] for eid in ids}
        assert len(prefijos) <= 2
        # El sufijo, en cambio, sí debe variar siempre.
        sufijos = {eid[len("pc_usr_") + 10:] for eid in ids}
        assert len(sufijos) == 50

    def test_ordenable_por_tiempo(self, monkeypatch):
        from services import system_identity as si

        base = 1_700_000_000_000
        ids = []
        for offset in (0, 1_000, 2_000, 60_000):
            monkeypatch.setattr(si.time, "time", lambda o=offset: (base + o) / 1000)
            ids.append(si.generate_entity_id())
        assert ids == sorted(ids)

    def test_rechaza_formato_invalido(self):
        assert not is_valid_entity_id("user_abc")
        assert not is_valid_entity_id("")
        assert not is_valid_entity_id(None)
        assert not is_valid_entity_id("pc_usr_short")

    def test_email_normalizado_nunca_es_clave(self):
        assert normalize_email("  Juan@Mail.COM ") == "juan@mail.com"
        assert normalize_email(None) is None
        assert normalize_email("") is None

    def test_allowed_sources_es_proyeccion_del_registry(self):
        """El vocabulario ya no es una lista fija: lo decide el Registry."""
        assert tuple(ALLOWED_SOURCES) == tuple(list_tokens())

    def test_registry_define_los_sistemas_admitidos(self):
        from services import identity_registry as reg

        # Un Sistema registrado es valido; el resto no existe como Sistema.
        for token in reg.list_tokens():
            assert is_valid_system(token)

        for token in ("legal", "medical", "anonymous", "a@b.com", "", None):
            assert not is_valid_system(token)

    def test_registry_tiene_un_unico_sistema_propietario(self):
        from services import identity_registry as reg

        # Test del Espacio de Nombres: `users.id` tiene un solo emisor.
        owner = reg.get_owner_system()
        assert owner["token"] == "punto_cero_system"
        assert owner["maturity"] == "activo"
        assert reg.is_valid_system(reg.get_owner_token())


class TestCaso1CommunityNuevo:
    """CASO 1 — Usuario community nuevo → entity_id creado + perfil community."""

    @mongo_test
    async def test_crea_identidad_y_agrega_perfil_community(self, db):
        eid = await create_system_identity(
            db, source="punto_cero_system", external_id="user_fcbb01296d4e",
            email="nuevo@ejemplo.com", role="member",
        )
        doc = await get_identity(db, eid)
        assert is_valid_entity_id(eid)
        assert len(doc["profiles"]) == 1
        p = doc["profiles"][0]
        assert p["source"] == "punto_cero_system"
        assert p["external_id"] == "user_fcbb01296d4e"
        assert p["email"] == "nuevo@ejemplo.com"
        assert doc["attributes"] == {}
        assert doc["providers"] == []
        assert doc["workspaces"] == []

    @mongo_test
    async def test_es_idempotente_mismo_perfil_no_crea_dos(self, db):
        a = await create_system_identity(db, source="punto_cero_system", external_id="user_x1")
        b = await create_system_identity(db, source="punto_cero_system", external_id="user_x1")
        assert a == b
        assert await db[COLLECTION].count_documents({}) == 1

    def test_rechaza_fuente_no_permitida(self):
        with pytest.raises(ValueError, match="source_no_permitido"):
            with_db(lambda db: create_system_identity(db, source="legal", external_id="x"))


class TestCaso2WorkspaceExistente:
    """CASO 2 — Usuario workspace existente → entity_id creado + perfil workspace."""

    @mongo_test
    async def test_crea_identidad_y_agrega_perfil_workspace(self, db):
        eid = await create_system_identity(
            db, source="punto_cero_system",
            external_id="29390858-8d23-4e91-afab-56d8c62b7f0e",
            email="admin@ejemplo.com", role="admin", verified=True,
        )
        doc = await get_identity(db, eid)
        assert len(doc["profiles"]) == 1
        p = doc["profiles"][0]
        assert p["source"] == "punto_cero_system"
        assert p["role"] == "admin"
        assert p["verified"] is True

    @mongo_test
    async def test_acepta_id_uuid_heterogeneo(self, db):
        eid = await create_system_identity(
            db, source="punto_cero_system",
            external_id="cff8c1b6-1470-4475-876f-3783ac368acf")
        assert is_valid_entity_id(eid)


class TestCaso3DosPerfiles:
    """CASO 3 — Dos perfiles distintos → mismo entity_id con dos profiles."""

    @mongo_test
    async def test_misma_entidad_dos_perfiles(self, db):
        eid = await create_system_identity(db, source="punto_cero_system", external_id="user_abc")
        await link_profile(db, eid, "punto_cero_system", "uuid-1", email="x@y.com", role="member")
        doc = await get_identity(db, eid)
        assert len(doc["profiles"]) == 2
        assert {p["source"] for p in doc["profiles"]} == {"punto_cero_system"}

    @mongo_test
    async def test_link_profile_es_idempotente(self, db):
        eid = await create_system_identity(db, source="punto_cero_system", external_id="user_abc")
        await link_profile(db, eid, "punto_cero_system", "uuid-1")
        await link_profile(db, eid, "punto_cero_system", "uuid-1")
        doc = await get_identity(db, eid)
        assert len(doc["profiles"]) == 2

    @mongo_test
    async def test_no_permite_mover_perfil_entre_entidades(self, db):
        a = await create_system_identity(db, source="punto_cero_system", external_id="user_a")
        b = await create_system_identity(db, source="punto_cero_system", external_id="user_b")
        await link_profile(db, a, "punto_cero_system", "uuid-shared")
        with pytest.raises(ValueError, match="perfil_ya_pertenece_a"):
            await link_profile(db, b, "punto_cero_system", "uuid-shared")


class TestCaso4ExternalIdRepetido:
    """CASO 4 — Mismo external_id repetido → RECHAZADO por el índice único."""

    @mongo_test
    async def test_indice_unico_impide_dos_entidades(self, db):
        await create_system_identity(db, source="punto_cero_system", external_id="user_dup")
        # Inserción manual que intenta robar el perfil → el índice unique bloquea.
        with pytest.raises(Exception):
            await db[COLLECTION].insert_one({
                "entity_id": generate_entity_id(),
                "created_at": "2026-01-01T00:00:00",
                "profiles": [{"source": "punto_cero_system", "external_id": "user_dup"}],
            })
        assert await db[COLLECTION].count_documents({}) == 1

    @mongo_test
    async def test_perfil_existente_devuelve_entidad_original(self, db):
        a = await create_system_identity(db, source="punto_cero_system", external_id="user_dup")
        found = await find_by_external_profile(db, "punto_cero_system", "user_dup")
        assert a == found["entity_id"]

    @mongo_test
    async def test_crear_dos_veces_mismo_perfil_no_duplica(self, db):
        a = await create_system_identity(db, source="punto_cero_system", external_id="uuid-z")
        b = await create_system_identity(db, source="punto_cero_system", external_id="uuid-z")
        assert a == b
        assert await db[COLLECTION].count_documents({}) == 1


class TestCaso5EmailsDiferentes:
    """CASO 5 — Emails diferentes → NO unir automáticamente."""

    @mongo_test
    async def test_distintos_emails_no_se_autounen(self, db):
        a = await create_system_identity(
            db, source="punto_cero_system", external_id="user_same", email="a@x.com")
        b = await create_system_identity(
            db, source="punto_cero_system", external_id="user_other", email="b@x.com")
        assert a != b
        assert await db[COLLECTION].count_documents({}) == 2  # NO se unieron

    @mongo_test
    async def test_resolve_reporta_split_no_una(self, db):
        await create_system_identity(db, source="punto_cero_system", external_id="user_1", email="a@x.com")
        await create_system_identity(db, source="punto_cero_system", external_id="ws_1", email="b@x.com")
        res = await resolve_system_identity(
            db,
            community_user={"id": "user_1", "email": "a@x.com"},
            jwt_user={"id": "ws_1", "email": "b@x.com"},
        )
        assert res["conflict_state"] == CONFLICT_SPLIT
        assert len(res["candidate_entity_ids"]) == 2
        assert res["detail"].startswith("entidades_distintas")


class TestResolveStates:
    """Estados de resolución: ninguna sesión, una, dos sesiones."""

    @mongo_test
    async def test_una_sesion(self, db):
        await create_system_identity(db, source="punto_cero_system", external_id="user_s", email="s@x.com")
        res = await resolve_system_identity(db, community_user={"id": "user_s"})
        assert res["conflict_state"] == CONFLICT_NONE
        assert res["entity_id"]

    @mongo_test
    async def test_dos_sesiones_mismo_perfil_linked(self, db):
        eid = await create_system_identity(db, source="punto_cero_system", external_id="user_c", email="c@x.com")
        await link_profile(db, eid, "punto_cero_system", "ws_c")
        res = await resolve_system_identity(
            db, community_user={"id": "user_c"}, jwt_user={"id": "ws_c"})
        assert res["entity_id"] == eid
        assert res["conflict_state"] == CONFLICT_LINKED
        assert res["sources"] == ["community", "workspace"]

    @mongo_test
    async def test_sin_sesiones(self, db):
        res = await resolve_system_identity(db, community_user=None, jwt_user=None)
        assert res["entity_id"] is None
        assert res["conflict_state"] == CONFLICT_NONE

    @mongo_test
    async def test_no_crea_nada_sin_create_missing(self, db):
        res = await resolve_system_identity(db, community_user={"id": "user_nuevo"})
        assert res["entity_id"] is None
        assert await db[COLLECTION].count_documents({}) == 0  # NO creó nada


class TestFase15aTokensRetirados:
    """Los tokens historicos siguen legibles pero NO pueden emitir."""

    def test_can_emit_solo_owner(self):
        from services import identity_registry as reg

        assert reg.can_emit("punto_cero_system")
        for token in ("community", "workspace"):
            assert reg.is_valid_system(token), "debe seguir siendo legible"
            assert not reg.can_emit(token), "no debe poder emitir"

    def test_estados_historicos_no_permiten_emision(self):
        from services import identity_registry as reg

        for token in ("community", "workspace"):
            state = reg.get_system_by_token(token)["state"]
            assert state == reg.SYSTEM_STATE_COMPATIBILITY_ONLY
            assert state not in reg.EMISSION_ALLOWED_STATES
            assert reg.get_system_by_token(token)["deprecated"] is True

    def test_create_rechaza_token_historico(self):
        for token in ("community", "workspace"):
            with pytest.raises(ValueError, match="source_no_emisible"):
                with_db(lambda db: create_system_identity(db, source=token, external_id="x"))

    def test_create_permite_token_propietario(self):
        eid = with_db(lambda db: create_system_identity(
            db, source="punto_cero_system", external_id="x"))
        assert is_valid_entity_id(eid)

    def test_lectura_historica_no_se_rompe(self):
        # Un perfil historico sigue encontrandose aunque su token no emita.
        async def scenario(db):
            await db[COLLECTION].insert_one({
                "entity_id": generate_entity_id(),
                "created_at": "2026-01-01T00:00:00",
                "profiles": [{"source": "community",
                                  "external_id": "legacy_user"}],
            })
            found = await find_by_external_profile(db, "community", "legacy_user")
            assert found is not None, "la lectura historica debe seguir funcionando"

        with_db(scenario)


class TestFase15aEntityIdEstricto:
    """La validacion ya no acepta alfabetos fuera de Crockford."""

    @pytest.mark.parametrize("bad", [
        "punto_cero_system",
    ])
    def test_prefijo_incorrecto_rechazado(self, bad):
        assert not is_valid_entity_id(bad)

    @pytest.mark.parametrize("ch", list("ILOU"))
    def test_caracteres_excluidos_del_alfabeto(self, ch):
        assert not is_valid_entity_id("pc_usr_" + ch * 26)

    def test_alfabeto_completo_rechazado(self):
        assert not is_valid_entity_id("pc_usr_" + "Z" * 26)

    def test_longitud_incorrecta(self):
        assert not is_valid_entity_id("pc_usr_" + "0" * 25)
        assert not is_valid_entity_id("pc_usr_" + "0" * 27)

    def test_timestamps_inverosimiles_rechazados(self):
        # Todo ceros: el bloque temporal no representa una fecha plausible.
        assert not is_valid_entity_id("pc_usr_" + "0" * 26)

    def test_ids_generados_siguen_validos(self):
        ids = [generate_entity_id() for _ in range(200)]
        assert all(is_valid_entity_id(i) for i in ids)
        assert len(set(ids)) == 200


class TestFase15aContratoIdentidad:
    """Estructura que consumira el futuro Login Bridge (sin endpoint)."""

    def test_contrato_forma_esperada(self):
        from services.system_identity import build_identity_contract

        eid = generate_entity_id()
        out = build_identity_contract(eid, available_spaces=["One", "workspace", "one"])
        assert out == {
            "entity_id": eid,
            "system": "punto_cero_system",
            "identity_type": "personal",
            "available_spaces": ["one", "workspace"],
        }

    def test_contrato_rechaza_entity_id_invalido(self):
        from services.system_identity import build_identity_contract

        with pytest.raises(ValueError, match="entity_id_invalido"):
            build_identity_contract("user_abc")

    def test_contrato_sin_espacios(self):
        from services.system_identity import build_identity_contract

        assert build_identity_contract(generate_entity_id())["available_spaces"] == []


class TestFase15bBootstrap:
    """Proyeccion user.id -> external_id -> entity_id (FASE 1.5B)."""

    @mongo_test
    async def test_caso1_usuario_nuevo_crea_identidad(self, db):
        user = {"id": "bootstrap_u1", "email": "b1@x.com", "role": "member"}
        eid = await project_user_identity(db, user, create_missing=True)
        assert is_valid_entity_id(eid), "debe crear un entity_id valido"
        doc = await get_identity(db, eid)
        assert len(doc["profiles"]) == 1
        assert doc["profiles"][0]["source"] == "punto_cero_system"
        assert doc["profiles"][0]["external_id"] == "bootstrap_u1"

    @mongo_test
    async def test_caso2_dos_ejecuciones_mismo_entity_id(self, db):
        user = {"id": "bootstrap_u2", "email": "b2@x.com", "role": "member"}
        first = await project_user_identity(db, user, create_missing=True)
        second = await project_user_identity(db, user, create_missing=True)
        third = await project_user_identity(db, user, create_missing=True)
        assert first == second == third, "debe ser idempotente"
        assert await db[COLLECTION].count_documents({}) == 1, "no debe duplicar"

    @mongo_test
    async def test_caso3_usuario_inexistente_rechazado(self, db):
        # Sin documento en users: no hay identity que crear.
        result = await project_user_by_id(db, "no_existe_xyz", create_missing=True)
        assert result is None
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_caso3b_usuario_sin_id_rechazado(self, db):
        assert await project_user_identity(db, {"email": "x@y.com"}, create_missing=True) is None
        assert await project_user_identity(db, None) is None
        assert await project_user_identity(db, {"id": "  "}, create_missing=True) is None
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_modo_lectura_no_escribe(self, db):
        user = {"id": "bootstrap_u3", "email": "b3@x.com", "role": "member"}
        assert await project_user_identity(db, user) is None, "sin create_missing no crea"
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_invariante_un_usuario_una_identidad(self, db):
        user = {"id": "bootstrap_u4", "email": "b4@x.com", "role": "member"}
        eid = await project_user_identity(db, user, create_missing=True)
        docs = await db[COLLECTION].find({"profiles": {"$elemMatch": {"source": "punto_cero_system", "external_id": "bootstrap_u4"}}}).to_list(20)
        assert len(docs) == 1
        assert docs[0]["entity_id"] == eid

    @mongo_test
    async def test_proyeccion_no_puede_usar_tokens_historicos(self, db):
        # El emisor lo fija el Registry: el usuario no puede elegirlo.
        user = {"id": "bootstrap_u5", "email": "b5@x.com", "role": "member"}
        eid = await project_user_identity(db, user, create_missing=True)
        doc = await get_identity(db, eid)
        assert doc["profiles"][0]["source"] == "punto_cero_system"

    @mongo_test
    async def test_resolve_encuentra_la_identidad_proyectada(self, db):
        """Puente: lo que proyecta bootstrap es lo que resuelve el Bridge."""
        user = {"id": "bootstrap_u6", "email": "b6@x.com", "role": "member"}
        eid = await project_user_identity(db, user, create_missing=True)
        res = await resolve_system_identity(db, jwt_user=user)
        assert res["entity_id"] == eid, "el resolver debe ver la proyeccion"
        assert res["conflict_state"] == CONFLICT_NONE
