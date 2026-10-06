"""
FASE 3A - Identity Contract expuesto por el Access Bridge.

Verifica que la identidad canonica viaja junto a los permisos sin romper
los contratos previos: subject_id y entitlements siguen presentes,
y identity es la clave nueva.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.access_bridge_routes import (  # noqa: E402
    _spaces_from_entitlements,
)
from services import workspace_registry as registry  # noqa: E402
from services.system_identity import build_identity_contract, generate_entity_id  # noqa: E402

OWNER = "punto_cero_system"


class TestDerivacionDeEspacios:
    """available_spaces NO se inventa: sale de permisos + registry."""

    def test_deriva_desde_permisos_conocidos(self):
        spaces = _spaces_from_entitlements([
            "workspace.open.legal",
            "workspace.open.comunidad",
        ])
        assert spaces == ["legal", "comunidad"]

    def test_ignora_permisos_ajenos(self):
        assert _spaces_from_entitlements(["otro.permiso", "x"]) == []

    def test_ignora_permiso_sin_espacio_registrado(self):
        # El registry es la unica fuente: un permiso sin espacio no entra.
        assert _spaces_from_entitlements(["workspace.open.noexiste"]) == []

    def test_deduplica_y_normaliza(self):
        spaces = _spaces_from_entitlements([
            "WORKSPACE.OPEN.LEGAL",
            "  workspace.open.legal  ",
        ])
        assert spaces == ["legal"]

    def test_entrada_vacia(self):
        assert _spaces_from_entitlements([]) == []
        assert _spaces_from_entitlements(None) == []


class TestContratoDeIdentidad:
    """La forma que el Access Bridge expone bajo la clave identity."""

    def test_forma_completa_del_contrato(self):
        eid = generate_entity_id()
        contract = build_identity_contract(
            eid, available_spaces=_spaces_from_entitlements(["workspace.open.legal"]),
        )
        assert set(contract) == {"entity_id", "system",
                                 "identity_type", "available_spaces"}
        assert contract["entity_id"] == eid
        assert contract["system"] == OWNER
        assert contract["identity_type"] == "personal"
        assert contract["available_spaces"] == ["legal"]

    def test_entity_id_del_contrato_coincide_con_subject_id(self):
        eid = generate_entity_id()
        contract = build_identity_contract(eid)
        assert contract["entity_id"] == eid

    def test_contrato_preserva_claves_del_contrato_anterior(self):
        # Compatibilidad: las claves previas del Bridge siguen siendo las mismas.
        eid = generate_entity_id()
        old_shape = {"subject_id", "entitlements"}
        new_shape = old_shape | {"identity"}
        assert old_shape.issubset(new_shape)


class TestRegistryComoFuenteDeEspacios:
    """El contrato de espacios no puede desincronizarse del registry."""

    def test_todo_espacio_derivado_existe_en_el_registry(self):
        permisos = ["workspace.open." + s["space_key"]
                    for s in registry.list_spaces()]
        for key in _spaces_from_entitlements(permisos):
            assert registry.get_space(key) is not None

    def test_espacios_conservan_orden_del_registry(self):
        permisos = ["workspace.open." + s["space_key"]
                    for s in registry.list_spaces()]
        derivadas = _spaces_from_entitlements(permisos)
        registro = [s["space_key"] for s in registry.list_spaces()
                    if s["space_key"] in derivadas]
        assert derivadas == registro
