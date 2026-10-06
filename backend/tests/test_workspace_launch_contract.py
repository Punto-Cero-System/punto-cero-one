"""
D2.2-C.4 — CONTRATO DE LANZAMIENTO DEL WORKSPACE (documentación ejecutable).

QUÉ ES ESTE ARCHIVO
-------------------
La versión ejecutable de `docs/architecture/WORKSPACE-LAUNCH-CONTRACT.md`. No
añade comportamiento: CONGELA el estado real para que un cambio futuro que
toque cualquiera de los cuatro ejes sea visible de inmediato.

POR QUÉ EXISTE
--------------
D2.2-C.3 encontró que "disponible" y "lanzable" son DOS fronteras distintas que
el frontend respondía con el mismo `status`:

    preview  ->  OPEN           (lifecycle: `derive_availability`)
    preview  ->  NOT LAUNCHABLE (`isLaunchable`: exige `status === 'live'`)

Esa divergencia es intencional pero no estaba escrita en ningún contrato. Aquí
queda escrita y protegida.

LO QUE ESTE ARCHIVO PROHÍBE HACER
---------------------------------
Este contrato conserva lifecycle y disponibilidad sin cambiar sus decisiones. En concreto:
  · NO cambia `medical` ni `empresa`.
  · NO introduce `launchMode` ni `external` en la proyección.
  · NO unifica lifecycle con launchability.
  · NO decide D4 (`external`). D3 (`launchMode`) se resolvió en
    `WORKSPACE-LAUNCHMODE-CONTRACT.md`.

Un fallo aquí significa "alguien movió un eje congelado", no "el contrato está
mal". La deuda se congela, no se corrige.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from services import workspace_registry as registry  # noqa: E402

CONTRACT = ROOT / "docs" / "architecture" / "WORKSPACE-LAUNCH-CONTRACT.md"
PROJECTION = ROOT / "docs" / "architecture" / "workspace_projection.json"

# Eje A — el ÚNICO vocabulario de lifecycle.
VALID_LIFECYCLE = ("live", "preview", "declared", "deprecated")

# Eje D — vocabulario de navegación, NO lifecycle. Prohibido como status.
NOT_LIFECYCLE = ("available", "coming_soon", "external")

# Ejes C y D — atributos de los ejes ABIERTOS en este carril.
BLOCKED_AXES = ("launchMode", "launch_mode", "external")


@pytest.fixture(scope="module")
def spaces() -> dict:
    return {s["space_key"]: s for s in registry.WORKSPACE_REGISTRY}


@pytest.fixture(scope="module")
def projection() -> list:
    return json.loads(PROJECTION.read_text(encoding="utf-8"))["workspaces"]


# ===========================================================================
# EJE A — LIFECYCLE
# ===========================================================================

class TestLifecycleEsLaUnicaAutoridad:
    def test_todo_status_del_registro_es_lifecycle(self, spaces):
        fuera = sorted(
            k for k, s in spaces.items() if s.get("status") not in VALID_LIFECYCLE
        )
        assert not fuera, (
            f"Status fuera del vocabulario canonico: {fuera}. "
            f"`available`/`coming_soon`/`external` NO son lifecycle."
        )

    def test_el_vocabulario_del_registro_cubre_los_cuatro_ejes(self):
        assert set(registry.LIFECYCLE_STATUSES) == set(VALID_LIFECYCLE)

    def test_el_registro_no_declara_availability_como_campo(self, spaces):
        # Availability es DERIVACION. Si algun dia aparece como campo, este
        # test cae: significaria que alguien empezo a almacenarlo.
        con_availability = sorted(k for k, s in spaces.items() if "availability" in s)
        assert not con_availability, (
            f"Availability no es un dato: {con_availability} lo declara."
        )


# ===========================================================================
# EJE B — AVAILABILITY ES DERIVACION
# ===========================================================================

class TestAvailabilityEsDerivada:
    def test_el_mapa_de_derivacion_no_cambia(self):
        esperado = {
            "live": "open", "preview": "open",
            "declared": "closed", "deprecated": "closed",
        }
        for status, want in esperado.items():
            assert registry.derive_availability(status) == want, status

    def test_status_desconocido_cierra(self):
        # Fail-closed: un status ausente NO se asume disponible.
        assert registry.derive_availability("inventado") == "closed"
        assert registry.derive_availability(None) == "closed"

    def test_la_frontera_coincide_con_policy_can(self):
        # La razon de seguridad de B.3-A: "disponible aqui" y "autorizado sin
        # flag" dicen lo mismo.
        assert set(registry.LIFECYCLE_OPEN) == {"live", "preview"}
        assert set(registry.LIFECYCLE_CLOSED) == {"declared", "deprecated"}

    def test_vocabulario_de_navegacion_no_es_lifecycle(self):
        for status in NOT_LIFECYCLE:
            assert status not in registry.LIFECYCLE_STATUSES, (
                f"`{status}` no es lifecycle y no debe aparecer en el Registry."
            )


# ===========================================================================
# EJE C — LAUNCHABILITY ES UNA FRONTERA INDEPENDIENTE (D3 pendiente)
# ===========================================================================

class TestLaunchabilityNoCoincideConLifecycle:
    """`preview` está OPEN pero NO es launchable. Divergencia congelada."""

    def test_preview_esta_abierto_por_lifecycle(self):
        # La divergencia que D2.2-C.3 encontró y que este contrato vuelve
        # explícita. Si algún día cambia, es una DECISIÓN (D3), no un refactor:
        # este test obliga a que esa decisión sea consciente y documentada.
        assert registry.derive_availability("preview") == "open"

    def test_el_registro_no_modela_launchability(self, spaces):
        # Launchability NO es un eje del Registry: es frontend. Si apareciera
        # aquí, estaríamos mezclando un eje local con la autoridad de lifecycle.
        modeladas = sorted(
            k for k, s in spaces.items()
            if any(k2 in s for k2 in ("launchable", "is_launchable", "launchMode"))
        )
        assert not modeladas, (
            f"Launchability/launchMode no son ejes del Registry: {modeladas}"
        )


# ===========================================================================
# EJE D — LAUNCHMODE Y EXTERNAL SIGUEN PENDIENTES
# ===========================================================================

class TestEjesAbiertosSiguenAbiertos:
    def test_la_proyeccion_no_incluye_los_ejes_bloqueados(self, projection):
        for space in projection:
            for eje in BLOCKED_AXES:
                assert eje not in space, (
                    f"{space['space_key']}: la proyección congila un eje abierto "
                    f"(`{eje}`). D3/D4 siguen pendientes."
                )

    def test_launchability_no_se_transporta_en_la_proyeccion(self, projection):
        campos = set()
        for space in projection:
            campos |= set(space)
        assert "launchable" not in campos

    def test_el_snapshot_declara_su_generador(self):
        # Si esto falla, la proyección fue editada a mano.
        data = json.loads(PROJECTION.read_text(encoding="utf-8"))
        assert "workspace_registry.py" in data["authority"]
        assert "GENERADO" in data["note"]


# ===========================================================================
# DEUDA CONGELADA — medical / empresa NO se sincronizan
# ===========================================================================

class TestDivergenciasCongeladas:
    """Estas divergencias son INTENCIONALES. Sincronizarlas es decisión."""

    def test_medical_sigue_declared_en_backend(self, spaces):
        assert spaces["medical"]["status"] == "declared", (
            "`medical` cambió de estado en el Registry. Eso es decisión de "
            "producto (D2.2), no parte de este carril."
        )

    def test_empresa_sigue_preview_en_backend(self, spaces):
        assert spaces["empresa"]["status"] == "preview", (
            "`empresa` cambió de estado en el Registry. Misma razón."
        )

    def test_medical_y_empresa_siguen_siendo_workspaces_reales(self, spaces):
        # Congelamos también que EXISTEN: que nadie los borre por "simplificar".
        for key in ("medical", "empresa"):
            assert key in spaces


# ===========================================================================
# EL DOCUMENTO EXISTE Y DICE LO QUE DICE
# ===========================================================================

class TestElContratoEstaEscrito:
    @pytest.fixture(scope="class")
    def doc(self) -> str:
        if not CONTRACT.exists():
            pytest.fail(
                f"Falta el contrato: {CONTRACT}\n"
                "Es la parte documental de D2.2-C.4."
            )
        return CONTRACT.read_text(encoding="utf-8")

    def test_documenta_los_cuatro_ejes(self, doc):
        for eje in ("LIFECYCLE", "AVAILABILITY", "LAUNCHABILITY", "LAUNCHMODE"):
            assert eje in doc, f"El contrato no nombra el eje {eje}."

    def test_d3_resuelto_y_d4_pendiente(self, doc):
        assert "D3 — LaunchMode (resuelto en D2.2-D)" in doc
        assert "PENDIENTE D4" in doc
        launchmode_contract = ROOT / "docs" / "architecture" / "WORKSPACE-LAUNCHMODE-CONTRACT.md"
        assert launchmode_contract.exists()
        assert "single declarative source" in launchmode_contract.read_text(encoding="utf-8")

    def test_declara_que_no_sincroniza_medical_ni_empresa(self, doc):
        assert "No sincronizar" in doc
        assert "medical" in doc and "empresa" in doc

    def test_launchmode_runtime_tiene_contrato_separado(self, doc):
        assert "WORKSPACE-LAUNCHMODE-CONTRACT.md" in doc