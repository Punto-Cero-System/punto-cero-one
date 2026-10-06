"""
FASE 0.6 — Identity Audit Layer. Tests de la capa append-only.

Verifica el contrato de auditoría: inserción, estructura, append-only, múltiples
eventos y `entity_id` nullable.

`pytest_asyncio` no está instalado, así que cada test corre dentro de un único
`asyncio.run` (cliente + escenario + limpieza).

NO toca la base de desarrollo: usa `test_identity_audit_<pid>` y la elimina.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.identity_audit import (  # noqa: E402
    ALLOWED_METADATA_KEYS,
    COLLECTION,
    EMITTERS,
    EVENT_ID_PREFIX,
    EVENT_TYPES,
    FORBIDDEN_KEYS,
    EventRejectedError,
    EventTooLargeError,
    EventTypeError,
    IdentityEvent,
    MAX_DOCUMENT_BYTES,
    MAX_LIST_ITEMS,
    MAX_STRING_LENGTH,
    TRUNCATION_SUFFIX,
    count_events,
    emit_identity_conflict,
    emit_provider_detached,
    enforce_limits,
    ensure_audit_indexes,
    filter_metadata,
    find_plain_emails,
    generate_event_id,
    list_events,
    mask_email,
    record_event,
    sanitize,
    strip_forbidden_keys,
    validate_audit_config,
)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

# Base única POR PROCESO: pytest-xdist lanza varios workers en paralelo y cada
# uno hace drop_database en su teardown; con nombre compartido uno aborta el
# build de índices del otro.
TEST_DB = f"test_identity_audit_{os.getpid()}"


def with_db(scenario):
    """Ejecuta `scenario(db)` en un único event loop, sobre base limpia."""
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _main():
        client = AsyncIOMotorClient(MONGO_URL)
        database = client[TEST_DB]
        try:
            await database.drop_collection(COLLECTION)
            await ensure_audit_indexes(database)
            return await scenario(database)
        finally:
            await client.drop_database(TEST_DB)
            client.close()

    return asyncio.run(_main())


def mongo_test(fn):
    """
    Decorador: `fn(db)` se ejecuta sobre la base de pruebas aislada.

    NO usa functools.wraps: `wraps` copia `__wrapped__`, pytest seguiría
    inspeccionando la firma `(self, db)` y pediría un fixture inexistente.
    """
    def wrapper(*args, **_kwargs):
        async def scenario(db):
            return await fn(*args, db)

        return with_db(scenario)

    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


# ─────────────────────────────────────────────────────────────────────────────
# Vocabulario (sin DB)
# ─────────────────────────────────────────────────────────────────────────────

class TestVocabulario:
    def test_ocho_tipos_definidos(self):
        assert len(EVENT_TYPES) == 8
        assert EVENT_TYPES == frozenset({
            "identity.created",
            "profile.linked",
            "profile.link_requested",
            "profile.link_rejected",
            "email_collision.detected",
            "identity.conflict.created",
            "provider.attached",
            "provider.detached",
        })

    def test_event_id_tiene_prefijo_propio(self):
        eid = generate_event_id()
        assert eid.startswith(EVENT_ID_PREFIX)
        assert eid != generate_event_id()

    def test_modelo_tiene_todos_los_campos_del_contrato(self):
        expected = {
            "event_id", "event_type", "occurred_at", "actor", "source",
            "profile_reference", "entity_id", "related_ids", "rule_applied",
            "evidence", "request_id", "metadata",
        }
        assert expected <= set(IdentityEvent.model_fields)


# ─────────────────────────────────────────────────────────────────────────────
# Inserción
# ─────────────────────────────────────────────────────────────────────────────

class TestInsercion:
    @mongo_test
    async def test_inserta_un_evento(self, db):
        eid = await record_event(db, "identity.created", source="community")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc is not None
        assert doc["event_type"] == "identity.created"
        assert await db[COLLECTION].count_documents({}) == 1

    @mongo_test
    async def test_rechaza_tipo_fuera_del_vocabulario(self, db):
        with pytest.raises(EventTypeError, match="event_type_no_permitido"):
            await record_event(db, "identity.destroyed")
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_rechaza_tipo_vacio(self, db):
        with pytest.raises(EventTypeError):
            await record_event(db, "")
        with pytest.raises(EventTypeError):
            await record_event(db, None)


# ─────────────────────────────────────────────────────────────────────────────
# Estructura
# ─────────────────────────────────────────────────────────────────────────────

class TestEstructura:
    @mongo_test
    async def test_persiste_todos_los_campos(self, db):
        eid = await record_event(
            db,
            "profile.linked",
            actor="user:abc",
            source="google",
            profile_reference="user_abc",
            entity_id="pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH",
            related_ids=["user_abc", "user_def"],
            rule_applied="H-1:confirmacion-explicita",
            evidence={"confirmed_by_user": True, "score": 2},
            request_id="req-1",
            metadata={"ip": "127.0.0.1"},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["actor"] == "user:abc"
        assert doc["source"] == "google"
        assert doc["profile_reference"] == "user_abc"
        assert doc["entity_id"] == "pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH"
        assert doc["related_ids"] == ["user_abc", "user_def"]
        assert doc["rule_applied"] == "H-1:confirmacion-explicita"
        assert doc["evidence"]["confirmed_by_user"] is True
        assert doc["request_id"] == "req-1"
        assert doc["metadata"]["ip"] == "127.0.0.1"
        assert doc["occurred_at"]

    @mongo_test
    async def test_campos_opcionales_por_defecto(self, db):
        eid = await record_event(db, "provider.attached")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["actor"] is None
        assert doc["related_ids"] == []
        assert doc["evidence"] == {}
        assert doc["metadata"] == {}

    @mongo_test
    async def test_normaliza_cadenas_vacias_a_null(self, db):
        eid = await record_event(db, "identity.created", actor="   ", source="")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["actor"] is None
        assert doc["source"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Append-only
# ─────────────────────────────────────────────────────────────────────────────

class TestAppendOnly:
    @mongo_test
    async def test_la_capa_no_expone_update_ni_delete(self, db):
        # La garantía es estructural: el módulo no ofrece forma de mutar.
        import services.identity_audit as audit

        public = {n for n in dir(audit) if not n.startswith("_")}
        for prohibido in ("update_event", "delete_event", "remove_event",
                          "purge_events", "drop_events"):
            assert prohibido not in public

    @mongo_test
    async def test_no_existe_indice_ttl(self, db):
        info = await db[COLLECTION].index_information()
        for name, spec in info.items():
            # TTL aparecería como `expireAfterSeconds` en el índice de occurred_at.
            assert "expireAfterSeconds" not in spec, (
                f"el índice {name} borraría eventos automáticamente"
            )

    @mongo_test
    async def test_registrar_dos_veces_no_actualiza_el_anterior(self, db):
        first = await record_event(db, "identity.created", source="community")
        second = await record_event(db, "identity.created", source="legal")
        assert first != second
        assert await db[COLLECTION].count_documents({}) == 2
        original = await db[COLLECTION].find_one({"event_id": first})
        assert original["source"] == "community"  # intacto


# ─────────────────────────────────────────────────────────────────────────────
# Múltiples eventos
# ─────────────────────────────────────────────────────────────────────────────

class TestMultiplesEventos:
    @mongo_test
    async def test_registra_cadena_completa(self, db):
        await record_event(db, "email_collision.detected", source="google",
                           profile_reference="user_a")
        await record_event(db, "profile.link_rejected", source="google",
                           profile_reference="user_a")
        await record_event(db, "profile.linked", source="google",
                           profile_reference="user_a")
        await record_event(db, "provider.attached", source="google",
                           profile_reference="user_a")
        assert await count_events(db) == 4
        assert await count_events(db, event_type="profile.linked") == 1

    @mongo_test
    async def test_lista_en_orden_temporal(self, db):
        for kind in ("identity.created", "profile.linked", "provider.detached"):
            await record_event(db, kind)
        eventos = await list_events(db)
        assert [e["event_type"] for e in eventos] == [
            "identity.created", "profile.linked", "provider.detached"
        ]

    @mongo_test
    async def test_filtra_por_tipo(self, db):
        await record_event(db, "profile.linked")
        await record_event(db, "profile.link_rejected")
        assert len(await list_events(db, event_type="profile.link_rejected")) == 1

    @mongo_test
    async def test_ids_unicos_bajo_carga(self, db):
        for _ in range(50):
            await record_event(db, "provider.attached")
        total = await count_events(db)
        ids = await db[COLLECTION].distinct("event_id")
        assert total == 50
        assert len(ids) == 50  # el índice UNIQUE no habría permitido duplicados


# ─────────────────────────────────────────────────────────────────────────────
# entity_id nullable
# ─────────────────────────────────────────────────────────────────────────────

class TestEntityIdNullable:
    @mongo_test
    async def test_eventos_sin_entity_id_se_registran(self, db):
        # Fase 0.6: la capa canónica sigue desconectada, entity_id va null.
        eid = await record_event(db, "email_collision.detected",
                                 source="community", profile_reference="user_x")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["entity_id"] is None

    @mongo_test
    async def test_acepta_entity_id_cuando_exista(self, db):
        eid = await record_event(db, "profile.linked",
                                 entity_id="pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["entity_id"] == "pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH"

    @mongo_test
    async def test_consulta_por_entity_id_no_mezcla_nulos(self, db):
        await record_event(db, "profile.linked",
                          entity_id="pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH")
        await record_event(db, "profile.linked")  # sin entity_id
        assert len(await list_events(
            db, entity_id="pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH")) == 1


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.7 · OBJETIVO 1 — configuración e índices preparados, no activados
# ─────────────────────────────────────────────────────────────────────────────

class TestPreparacionDeIndices:
    @mongo_test
    async def test_ensure_audit_indexes_no_crea_datos(self, db):
        # Preparar índices no debe escribir ni un solo evento.
        await db[COLLECTION].drop()
        await ensure_audit_indexes(db)
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_indices_esperados_quedan_cumplidos(self, db):
        await db[COLLECTION].drop()
        await ensure_audit_indexes(db)
        report = await validate_audit_config(db)
        assert report["ok"] is True, report
        assert report["missing"] == []
        assert report["problems"] == []

    @mongo_test
    async def test_event_id_es_unico(self, db):
        report = await validate_audit_config(db)
        assert report["indexes"]["event_id"]["unique"] is True

    @mongo_test
    async def test_indices_sparse_requeridos(self, db):
        report = await validate_audit_config(db)
        assert report["indexes"]["entity_and_time"]["sparse"] is True
        assert report["indexes"]["source_and_time"]["sparse"] is True

    @mongo_test
    async def test_ningun_indice_ttl(self, db):
        report = await validate_audit_config(db)
        for name, spec in report["indexes"].items():
            assert spec["expireAfterSeconds"] is None, (
                f"{name} tiene TTL: borraría eventos automáticamente"
            )

    @mongo_test
    async def test_ensure_audit_indexes_es_idempotente(self, db):
        await db[COLLECTION].drop()
        await ensure_audit_indexes(db)
        await ensure_audit_indexes(db)  # no debe fallar
        report = await validate_audit_config(db)
        assert report["ok"] is True

    @mongo_test
    async def test_validacion_detecta_coleccion_inexistente(self, db):
        await db.drop_collection(COLLECTION)
        report = await validate_audit_config(db)
        assert report["exists"] is False
        assert report["ok"] is False
        assert "coleccion_no_existe" in report["problems"]

    @mongo_test
    async def test_validacion_detecta_indice_no_unico(self, db):
        await db[COLLECTION].drop()
        # Índice deliberadamente NO único sobre event_id (mismo nombre que el
        # contrato, para que la validación lo encuentre y lo rechace).
        await db[COLLECTION].create_index("event_id", name="event_id")
        report = await validate_audit_config(db)
        assert report["ok"] is False
        assert "unique_incorrecto:event_id" in report["problems"]


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.7 · OBJETIVO 2 — cobertura completa de emisores
# ─────────────────────────────────────────────────────────────────────────────

class TestEmisores:
    def test_cada_tipo_tiene_su_emisor(self):
        assert set(EMITTERS) == set(EVENT_TYPES)

    @mongo_test
    async def test_todos_los_emisores_escriben_su_tipo(self, db):
        for tipo, emisor in EMITTERS.items():
            eid = await emisor(db, source="community", profile_reference="user_x")
            doc = await db[COLLECTION].find_one({"event_id": eid})
            assert doc["event_type"] == tipo

    @mongo_test
    async def test_emisores_no_pueden_forzar_otro_tipo(self, db):
        # Cada emisor fija su event_type: `event_type` en **rest no puede
        # sobrescribirlo porque va en conflicto con el argumento posicional.
        eid = await emit_provider_detached(db, source="google")
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["event_type"] == "provider.detached"

    @mongo_test
    async def test_emisor_rechaza_tipo_invalido_en_evidence(self, db):
        # `evidence` es libre por diseño: registra hechos, no decide.
        eid = await emit_identity_conflict(
            db, source="community", evidence={"reason": "split"})
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert doc["event_type"] == "identity.conflict.created"
        assert doc["evidence"]["reason"] == "split"


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.7 · sin endpoints públicos
# ─────────────────────────────────────────────────────────────────────────────

class TestSinEndpointsPublicos:
    def test_el_servicio_no_expone_router(self):
        import services.identity_audit as audit

        assert not hasattr(audit, "router")
        assert not hasattr(audit, "app")
        for nombre in ("include_router", "add_api_route", "APIRouter"):
            assert not hasattr(audit, nombre), f"la auditoría no debe exponer {nombre}"

    def test_la_api_publica_es_solo_registro_y_consulta(self):
        import services.identity_audit as audit

        publicas = {n for n in dir(audit) if not n.startswith("_")}
        # Nada que mute datos: ni update, ni delete, ni drop, ni replace.
        for peligroso in ("update_event", "delete_event", "drop_events",
                          "purge_events", "remove_event", "replace_event",
                          "insert_many_events", "clear_events"):
            assert peligroso not in publicas
        assert "record_event" in publicas
        assert "validate_audit_config" in publicas


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.8 · OBJETIVO 1 — enmascarado de correo
# ─────────────────────────────────────────────────────────────────────────────

class TestMasking:
    def test_formato_especificado(self):
        # Formato exigido: usuario@dominio.com --> u*****@d*****.com
        assert mask_email("usuario@dominio.com") == "u*****@d*****.com"

    def test_conserva_inicial_usuario_dominio_y_tld(self):
        assert mask_email("juan@mail.empresa.com") == "j*****@m*****.com"
        assert mask_email("admin@empresa.com") == "a*****@e*****.com"

    def test_correo_minimo(self):
        assert mask_email("a@b.co") == "a*****@b*****.co"

    def test_enmascara_dentro_de_texto_mas_largo(self):
        assert mask_email("contacto juan@x.com y maria@y.org") == (
            "contacto j*****@x*****.com y m*****@y*****.org"
        )

    def test_no_toca_cadenas_sin_correo(self):
        for texto in ("H-1:email-no-es-clave", "google", "user_abc123", "2026-01-01"):
            assert mask_email(texto) == texto

    def test_enmascarado_no_se_redetecta(self):
        # Crítico: si el valor enmascarado volviera a casar con la regex, el
        # filtro sería idempotente de forma falsa y la verificación inútil.
        assert find_plain_emails(mask_email("juan@x.com")) == []

    def test_detecta_correo_plano(self):
        assert find_plain_emails("juan@x.com") == ["juan@x.com"]

    def test_sanitize_es_recursivo(self):
        entrada = {"a": "juan@x.com", "b": {"c": ["maria@y.org", 1, True]}}
        salida = sanitize(entrada)
        assert salida["a"] == "j*****@x*****.com"
        assert salida["b"]["c"][0] == "m*****@y*****.org"
        assert salida["b"]["c"][1] == 1
        assert salida["b"]["c"][2] is True

    def test_sanitize_no_degrada_no_cadenas(self):
        # Enmascarar un booleano produciría 'Tr*****': eso es un bug, no privacy.
        assert sanitize({"ok": True, "n": 1, "z": None}) == {"ok": True, "n": 1, "z": None}


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.8 · OBJETIVO 2 — ningún emisor escribe PII sin protección
# ─────────────────────────────────────────────────────────────────────────────

class TestEmisoresSinPII:
    @mongo_test
    async def test_todos_los_emisores_enmascaran(self, db):
        for tipo, emisor in EMITTERS.items():
            eid = await emisor(
                db,
                source="google",
                profile_reference="user_x",
                evidence={"email": "juan@dominio.com"},
                # `client` está en la allowlist de metadata (FASE 0.9): aun así
                # debe enmascararse si contiene un correo.
                metadata={"client": "maria@empresa.com"},
            )
            doc = await db[COLLECTION].find_one({"event_id": eid})
            assert doc["event_type"] == tipo
            assert find_plain_emails(doc) == [], f"{tipo} dejó PII: {doc}"
            assert doc["evidence"]["email"] == "j*****@d*****.com"
            assert doc["metadata"]["client"] == "m*****@e*****.com"

    @mongo_test
    async def test_emisores_activos_en_un_evento_real(self, db):
        # Reproduce la forma exacta que emite community_auth_routes.
        await record_event(
            db, "email_collision.detected",
            source="google", profile_reference="user_a",
            rule_applied="H-1:email-no-es-clave-de-identidad",
            evidence={
                "email": "juan.perez@empresa.com",
                "incoming_provider": "google",
                "email_verified": True,
                "collision_type": "password_account",
                "existing_providers": ["password"],
            },
        )
        doc = await db[COLLECTION].find_one({})
        assert find_plain_emails(doc) == []
        # La información útil para investigar se conserva íntegra.
        ev = doc["evidence"]
        assert ev["email"] == "j*****@e*****.com"
        assert ev["email_verified"] is True
        assert ev["collision_type"] == "password_account"
        assert ev["incoming_provider"] == "google"
        assert doc["rule_applied"] == "H-1:email-no-es-clave-de-identidad"

    @mongo_test
    async def test_campos_de_texto_tambien_se_enmascaran(self, db):
        # El filtro no depende de que la PII llegue por `evidence`.
        eid = await record_event(
            db, "profile.linked",
            actor="juan@x.com",
            source="maria@y.org",
            profile_reference="user_z@correo.com",
            rule_applied="H-1:contacto admin@empresa.com",
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert find_plain_emails(doc) == []
        assert doc["actor"] == "j*****@x*****.com"
        assert doc["source"] == "m*****@y*****.org"


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.8 · OBJETIVO 3 — email plano rechazado, append-only, 12 campos
# ─────────────────────────────────────────────────────────────────────────────

class TestInvariantesPrivacidad:
    @mongo_test
    async def test_email_plano_rechazado_para_almacenarse(self, db):
        # "Rechazado" = nunca llega intacto a la base. NO se lanza excepción:
        # perder el evento de un intento de suplantación sería peor que
        # guardarlo enmascarado.
        eid = await record_event(
            db, "profile.link_rejected",
            evidence={"email": "atacante@malicioso.com"},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert "atacante@malicioso.com" not in str(doc)
        assert doc["evidence"]["email"] == "a*****@m*****.com"

    @mongo_test
    async def test_auditoria_sigue_append_only(self, db):
        primero = await record_event(
            db, "email_collision.detected", evidence={"email": "uno@x.com"})
        segundo = await record_event(
            db, "email_collision.detected", evidence={"email": "dos@x.com"})
        assert primero != segundo
        assert await db[COLLECTION].count_documents({}) == 2
        # El enmascarado no reescribe eventos ya insertados.
        original = await db[COLLECTION].find_one({"event_id": primero})
        assert original["evidence"]["email"] == "u*****@x*****.com"
        assert original["event_id"] == primero

    @mongo_test
    async def test_eventos_mantienen_estructura_de_12_campos(self, db):
        eid = await record_event(
            db, "profile.linked",
            actor="user:abc", source="google", profile_reference="user_abc",
            entity_id="pc_usr_01M3GBJ886A8NXN2HS4AJYHPZH",
            related_ids=["user_abc"], rule_applied="H-1:x",
            evidence={"email": "juan@x.com"}, request_id="req-1",
            metadata={"k": "v"},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        contrato = {
            "event_id", "event_type", "occurred_at", "actor", "source",
            "profile_reference", "entity_id", "related_ids", "rule_applied",
            "evidence", "request_id", "metadata",
        }
        # Mongo añade `_id` por su cuenta: el contrato de la aplicación son 12.
        assert set(doc) - {"_id"} == contrato
        assert len(contrato) == 12
        assert len(doc) == 13  # 12 del contrato + _id de Mongo

    @mongo_test
    async def test_ningun_correo_plano_en_la_coleccion_completa(self, db):
        for i in range(10):
            await record_event(
                db, "email_collision.detected",
                evidence={"email": f"user{i}@empresa.com", "n": i},
                metadata={"nota": f"contacto user{i}@empresa.com"},
            )
        docs = await db[COLLECTION].find({}).to_list(length=50)
        assert len(docs) == 10
        assert find_plain_emails(docs) == []


# ─────────────────────────────────────────────────────────────────────────────
# FASE 0.9 · OBJETIVO 4 — gobierno de acceso y forma
# ─────────────────────────────────────────────────────────────────────────────

class TestGobiernoDeForma:
    def test_las_excepciones_de_rechazo_estan_definidas(self):
        # El rechazo real ocurre en record_event; aquí se comprueba que la
        # jerarquía de errores existe y es coherente.
        assert issubclass(EventTooLargeError, EventRejectedError)
        assert issubclass(EventRejectedError, ValueError)

    def test_filtra_claves_prohibidas_de_la_allowlist(self):
        limpio = strip_forbidden_keys(
            {"password_hash": "x", "ok": 1, "anidado": {"token": "y", "bien": 2}}
        )
        assert limpio == {"ok": 1, "anidado": {"bien": 2}}

    def test_registra_que_claves_se_descartaron(self):
        dropped = []
        strip_forbidden_keys({"secret": "x", "ok": 1}, dropped)
        assert dropped == ["secret"]

    def test_allowlist_de_metadata_descarta_lo_no_permitido(self):
        limpio = filter_metadata({"client": "web", "inventado": "x", "ip": "1.2.3.4"})
        assert limpio == {"client": "web", "ip": "1.2.3.4"}
        assert "inventado" not in limpio

    def test_allowlist_vacia_por_defecto(self):
        assert filter_metadata(None) == {}
        assert filter_metadata({}) == {}

    def test_trunca_cadenas_largas(self):
        salida = enforce_limits({"larga": "x" * (MAX_STRING_LENGTH + 100)})
        assert len(salida["larga"]) == MAX_STRING_LENGTH + len(TRUNCATION_SUFFIX)

    def test_trunca_listas_largas(self):
        salida = enforce_limits({"items": list(range(MAX_LIST_ITEMS + 20))})
        assert len(salida["items"]) == MAX_LIST_ITEMS + 1
        assert salida["items"][-1] == TRUNCATION_SUFFIX

    def test_trunca_diccionarios_largos(self):
        salida = enforce_limits({f"k{i}": i for i in range(60)})
        assert "_truncated_keys" in salida

    def test_no_degrada_valores_normales(self):
        original = {"a": 1, "b": "texto", "c": True, "d": [1, 2, 3]}
        assert enforce_limits(original) == original


class TestGobiernoEnRecordEvent:
    @mongo_test
    async def test_claves_prohibidas_no_llegan_a_la_base(self, db):
        eid = await record_event(
            db, "profile.linked",
            evidence={"ok": 1, "password_hash": "$2b$12$secreto"},
            metadata={"client": "web", "api_key": "AKIA123"},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert "secreto" not in str(doc)
        assert "AKIA123" not in str(doc)
        assert doc["evidence"] == {"ok": 1}
        assert doc["metadata"] == {"client": "web"}

    @mongo_test
    async def test_metadata_excesiva_controlada(self, db):
        eid = await record_event(
            db, "identity.created",
            metadata={f"k{i}": i for i in range(100)},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        # Allowlist estricta: 100 claves inventadas -> metadata vacía.
        assert doc["metadata"] == {}

    @mongo_test
    async def test_evidence_gigante_se_acota(self, db):
        eid = await record_event(
            db, "email_collision.detected",
            evidence={"nota": "y" * 50_000},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert len(doc["evidence"]["nota"]) < 50_000
        assert doc["evidence"]["nota"].endswith(TRUNCATION_SUFFIX)

    @mongo_test
    async def test_pii_sigue_protegida_despues_del_gobierno(self, db):
        eid = await record_event(
            db, "email_collision.detected",
            evidence={"email": "atacante@malicioso.com"},
            metadata={"client": "maria@empresa.com"},
        )
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert find_plain_emails(doc) == []
        assert doc["evidence"]["email"] == "a*****@m*****.com"

    @mongo_test
    async def test_append_only_intacto_tras_el_gobierno(self, db):
        a = await record_event(db, "identity.created", evidence={"n": 1})
        b = await record_event(db, "identity.created", evidence={"n": 2})
        assert a != b
        assert await db[COLLECTION].count_documents({}) == 2
        assert (await db[COLLECTION].find_one({"event_id": a}))["evidence"]["n"] == 1

    @mongo_test
    async def test_evento_invalido_sigue_rechazado(self, db):
        with pytest.raises(EventTypeError, match="event_type_no_permitido"):
            await record_event(db, "identity.deleted")
        assert await db[COLLECTION].count_documents({}) == 0

    @mongo_test
    async def test_estructura_de_12_campos_preservada(self, db):
        eid = await record_event(db, "identity.created", evidence={"a": 1})
        doc = await db[COLLECTION].find_one({"event_id": eid})
        assert len(doc) - 1 == 12  # menos el _id de Mongo

    def test_las_claves_prohibidas_cubren_lo_esperado(self):
        for clave in ("password", "password_hash", "token", "session_token",
                      "api_key", "private_key", "cookie", "otp"):
            assert clave in FORBIDDEN_KEYS
        # El `sub` federado tampoco se audita (R-11).
        assert "sub" in FORBIDDEN_KEYS
        assert "provider_user_id" in FORBIDDEN_KEYS

    def test_allowlist_de_metadata_es_minima(self):
        assert "environment" in ALLOWED_METADATA_KEYS
        assert "client" in ALLOWED_METADATA_KEYS
        # Nada que huela a secreto o identidad.
        assert not (FORBIDDEN_KEYS & ALLOWED_METADATA_KEYS)

    def test_las_excepciones_heredan_de_rejected(self):
        assert issubclass(EventTooLargeError, EventRejectedError)
        assert MAX_DOCUMENT_BYTES > MAX_STRING_LENGTH


