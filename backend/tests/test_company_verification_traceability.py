"""
1.4B — TRAZABILIDAD DE LA VERIFICACIÓN: quién, cuándo y por qué medio.

BRECHA QUE CIERRA ESTE CARRIL
-----------------------------
`POST /api/companies/{id}/verify` cambiaba `verification` y no guardaba nada
más. El badge público decía "Verificada", pero en la base no existía ningún
registro de quién lo decidió, cuándo ni bajo qué proceso. Un badge que afirma
sin respaldo es exactamente lo que el split `origin`/`verification` (1.4A)
trataba de eliminar.

Este test fija las TRES reglas que ahora gobierna el endpoint, sobre el código
real y con dobles en memoria:

  1. La transición a `verified` guarda quién, cuándo y por qué medio.
  2. TODA transición — incluida `flagged` — agrega un evento al historial.
  3. Volver a `unverified` NO borra lo anterior. El rastro es lo que hace
     defendible un "verified" pasado; el estado actual es lo que pinta el badge.

Y dos propiedades de contrato que no deben romperse al tocar esto:

  · La respuesta conserva `{ok, status}` exactamente como antes; solo se le
    agregan claves. Un cliente que ya la parsea sigue funcionando.
  · `source` es un Literal. Un llamador no puede escribir "official_registry"
    sobre una suposición: sería falsificar precisamente esto.

Dobles en memoria. Sin Mongo, sin red, sin servidor.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from models_business import (  # noqa: E402
    VERIFICATION_HISTORY_CAP,
    CompanyPublic,
    VerificationEvent,
)
from routes.company_routes import (  # noqa: E402
    VerificationUpdate,
    _load_history,
    set_verification,
)

ADMIN = {"id": "adm_1", "name": "Ana Torres", "email": "ana@punto.co"}
_UNSET = object()


# ---------------------------------------------------------------------------
# Dobles en memoria: `set_verification` solo toca `db.companies` y lee
# `request.app.state.db`.
# ---------------------------------------------------------------------------
class _Companies:
    def __init__(self, doc):
        self._doc = doc
        self.last_set = {}

    async def find_one(self, flt, *args, **kwargs):
        return self._doc

    async def update_one(self, flt, update):
        self.last_set = update["$set"]
        if self._doc is not None:
            self._doc.update(self.last_set)


class _DB:
    def __init__(self, doc):
        self.companies = _Companies(doc)


class _Request:
    def __init__(self, db):
        self.app = type("_App", (), {"state": type("_State", (), {"db": db})()})()


def _fresh_doc(**extra):
    """A company document exactly as it exists before any verification."""
    doc = {"id": "co_1", "slug": "acme", "verification": "unverified"}
    doc.update(extra)
    return doc


def _run(doc, status, source=_UNSET, admin=ADMIN):
    """Drive the real handler once against an in-memory document.

    `source=_UNSET` lets the request omit the field entirely, so we exercise
    the real default instead of passing an explicit `None`.
    """
    db = _DB(doc)
    kwargs = {} if source is _UNSET else {"source": source}
    payload = VerificationUpdate(status=status, **kwargs)
    result = asyncio.run(set_verification(
        "co_1", payload, _Request(db), admin=admin,
    ))
    return result, db.companies.last_set



# ---------------------------------------------------------------------------
# Regla 1 — quién, cuándo, por qué medio
# ---------------------------------------------------------------------------
class TestTransicionAVerificada:
    def test_escribe_quien_cuando_y_fuente(self):
        doc = _fresh_doc()
        _run(doc, "verified")

        assert doc["verification"] == "verified"
        assert doc["verified_by"] == ADMIN["id"]
        assert doc["verified_by_name"] == "Ana Torres"
        assert doc["verified_at"], "verified sin fecha = nada comprobable"
        assert doc["verification_source"] == "manual_review"

    def test_verificado_sin_responsable_es_imposible(self):
        """Nada de este mecanismo puede quedar sin actor atribuible."""
        doc = _fresh_doc()
        _, sent = _run(doc, "verified")

        assert sent["verified_by"]
        assert sent["verified_by_name"]
        assert sent["verified_at"]

    def test_source_falsificado_es_rechazado(self):
        """Literal-only: quien verifica NO puede inventar la fuente."""
        with pytest.raises(ValidationError):
            VerificationUpdate(status="verified", source="official_registry")

    def test_source_omitido_equivalente_a_manual_review(self):
        assert VerificationUpdate(status="verified").source == "manual_review"

    def test_source_nulo_deja_la_fuente_sin_declarar(self):
        """`None` en vez de falsificarla: no se afirma un proceso inexistente."""
        assert VerificationUpdate(status="verified", source=None).source is None


# ---------------------------------------------------------------------------
# Reglas 2 y 3 — historial añadido que sobrevive a la reversión
# ---------------------------------------------------------------------------
class TestElHistorialNoSeBorra:
    def test_cada_transicion_agrega_un_evento(self):
        doc = _fresh_doc()
        for status in ("verified", "flagged", "unverified", "pending"):
            _run(doc, status)
        assert len(doc["verification_history"]) == 4

    def test_flagged_conserva_la_evidencia(self):
        doc = _fresh_doc()
        _run(doc, "verified")
        at = doc["verified_at"]

        _run(doc, "flagged")

        assert doc["verification"] == "flagged", "el estado sí cambia"
        assert doc["verified_at"] == at, "pero flagged NO destruye la evidencia"
        assert doc["verified_by"] == ADMIN["id"]
        assert doc["verification_history"][-1]["status"] == "flagged"

    def test_unverified_no_borra_verified_at(self):
        """Sin esto, desverificar borraria la prueba de que alguna vez pasó."""
        doc = _fresh_doc()
        _run(doc, "verified")
        at = doc["verified_at"]

        _run(doc, "unverified")

        assert doc["verification"] == "unverified"
        assert doc["verified_at"] == at, "la reversión no puede borrar el pasado"
        assert doc["verified_by"] == ADMIN["id"]
        assert [e["status"] for e in doc["verification_history"]] == ["verified", "unverified"]

    def test_reverificar_actualiza_el_encabezado(self):
        doc = _fresh_doc()
        _run(doc, "verified")
        first = doc["verified_at"]

        _run(doc, "unverified")
        _run(doc, "verified")

        assert doc["verified_at"] >= first, "el encabezado describe la ÚLTIMA revisión"
        assert len(doc["verification_history"]) == 3, "y el rastro sigue completo"

    def test_el_evento_carga_estado_responsable_y_fuente(self):
        doc = _fresh_doc()
        _run(doc, "flagged")
        event = doc["verification_history"][-1]

        assert event["status"] == "flagged"
        assert event["by"] == ADMIN["id"]
        assert event["by_name"] == "Ana Torres"
        assert event["source"] == "manual_review"
        assert event["at"] == doc["updated_at"], "el evento y el doc comparten el sello"

    def test_historial_vacio_al_primer_cambio(self):
        doc = _fresh_doc()
        result, _ = _run(doc, "verified")

        assert len(doc["verification_history"]) == 1
        assert result["history_len"] == 1


# ---------------------------------------------------------------------------
# Tope: 20 eventos, retenidos desde el final
# ---------------------------------------------------------------------------
class TestTopeDeHistorial:
    def test_no_crece_de_20(self):
        doc = _fresh_doc()
        for _ in range(40):
            _run(doc, "flagged")

        assert VERIFICATION_HISTORY_CAP == 20
        assert len(doc["verification_history"]) == 20

    def test_conserva_los_mas_recientes(self):
        """Cortar por el FINAL: caen los viejos, sobreviven los recientes."""
        doc = _fresh_doc()
        for i in range(VERIFICATION_HISTORY_CAP + 5):
            _run(doc, "verified" if i % 2 == 0 else "flagged")

        history = doc["verification_history"]
        assert len(history) == VERIFICATION_HISTORY_CAP
        # range(25): i=24 es par -> 'verified'; i=23 es impar -> 'flagged'.
        assert history[-1]["status"] == "verified", "i=24, el último, sobrevive"
        assert history[-2]["status"] == "flagged", "i=23, el penúltimo, sobrevive"
        # i=0..4 se cortaron: el primero retenido es i=5, impar -> 'flagged'.
        assert history[0]["status"] == "flagged"


# ---------------------------------------------------------------------------
# Contrato con clientes existentes
# ---------------------------------------------------------------------------
class TestContratoDeRespuesta:
    def test_ok_y_status_no_cambian(self):
        result, _ = _run(_fresh_doc(), "verified")

        assert result["ok"] is True
        assert result["status"] == "verified"

    def test_solo_se_agregan_claves(self):
        result, _ = _run(_fresh_doc(), "verified")

        assert {"ok", "status"}.issubset(result)
        assert set(result) - {"ok", "status"} == {
            "verified_by", "verified_at", "verification_source", "history_len",
        }

    def test_al_no_ser_verified_las_claves_nuevas_quedan_en_none(self):
        """No se limpia el documento; la respuesta solo refleja lo que ESTA
        transición escribió."""
        doc = _fresh_doc()
        _run(doc, "verified")
        result, _ = _run(doc, "flagged")

        assert result["status"] == "flagged"
        assert result["verified_at"] is None
        assert doc["verified_at"], "el documento sí conserva la evidencia"


# ---------------------------------------------------------------------------
# Superficie pública: lo que el badge realmente recibe
# ---------------------------------------------------------------------------
class TestSuperficiePublica:
    def _public(self, **kwargs):
        doc = {
            "id": "co_1", "name": "Acme", "slug": "acme", "vertical": "tech",
            "owner_id": "u1", "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        }
        doc.update(kwargs)
        return CompanyPublic(**doc)

    def test_documento_legado_sin_las_5_claves_proyecta_defaults(self):
        """Escrito antes de 1.4B: ninguna clave existe. No debe reventar."""
        p = self._public(verification="verified")

        assert p.verified_at is None
        assert p.verified_by is None
        assert p.verified_by_name is None
        assert p.verification_source is None
        assert p.verification_history == []
        assert p.verification == "verified", "el estado legado viaja igual"

    def test_documento_con_trazabilidad_viaja_completo(self):
        p = self._public(
            verification="verified",
            verified_by="adm_1",
            verified_by_name="Ana Torres",
            verified_at="2026-10-05T09:15:00+00:00",
            verification_source="manual_review",
            verification_history=[{
                "status": "verified", "by": "adm_1", "by_name": "Ana Torres",
                "at": "2026-10-05T09:15:00+00:00", "source": "manual_review",
            }],
        )
        dumped = p.model_dump()

        assert dumped["verified_at"] == "2026-10-05T09:15:00+00:00"
        assert dumped["verified_by_name"] == "Ana Torres"
        assert dumped["verification_history"][0]["source"] == "manual_review"

    def test_historial_es_siempre_lista(self):
        """El badge hace `.map`; `None` rompería el render."""
        assert self._public().verification_history == []

    def test_verification_sigue_siendo_string(self):
        """El filtro `$in` de Discovery depende de que no cambie de forma."""
        assert isinstance(self._public(verification="verified").verification, str)


# ---------------------------------------------------------------------------
# Resistencia a documentos malformados
# ---------------------------------------------------------------------------
class TestCargaDeHistorial:
    def test_sin_clave_devuelve_vacio(self):
        assert asyncio.run(_load_history({})) == []

    def test_clave_nula_devuelve_vacio(self):
        assert asyncio.run(_load_history({"verification_history": None})) == []

    def test_entradas_validas_se_rehidratan(self):
        stored = {"verification_history": [{
            "status": "verified", "by": "adm_1", "by_name": "Ana",
            "at": "2026-10-05T09:15:00+00:00", "source": "manual_review",
        }]}
        events = asyncio.run(_load_history(stored))

        assert len(events) == 1
        assert isinstance(events[0], VerificationEvent)
        assert events[0].status == "verified"

    def test_entradas_malformadas_se_descartan_sin_reventar(self):
        """Perder una fila vieja no puede impedirle a un admin guardar."""
        stored = {"verification_history": [
            "esto-no-es-un-dict",
            {"status": "verified", "by": "adm_1", "by_name": "Ana",
             "at": "2026-10-05T09:15:00+00:00", "source": "manual_review"},
            {"estado": "clave-equivocada"},
            42,
        ]}
        events = asyncio.run(_load_history(stored))

        assert len(events) == 1
        assert events[0].by == "adm_1"

    def test_mezcla_de_basura_y_lo_valido(self):
        stored = {"verification_history": [
            "basura",
            {"status": "verified", "by": "a", "by_name": "A",
             "at": "2026-01-01T00:00:00+00:00", "source": "manual_review"},
        ]}
        assert len(asyncio.run(_load_history(stored))) == 1


