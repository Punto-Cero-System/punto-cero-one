"""D2.1 / D2.2-B.3-B — Genera `workspace_registry.contract.json` desde el estado REAL.

Script de generacion, no de correccion. Lee el Workspace Registry del backend, el
espejo `identity_core.SPACE_CATALOG` y los catalogos de workspace del frontend, y
escribe el snapshot contractual que `test_workspace_registry_contract.py` usa
como linea base.

REGLA DURA (PARTE E del encargo): este script NO contiene valores escritos a
mano. Todo lo que sale en el JSON sale de leer el codigo. Si alguien cambia un
status, una ruta o un permiso, el snapshot lo recoge tal cual, sin juzgarlo y
sin arreglarlo.

D2.2-B.3-B — Cuarto catalogo. `ONE-SYSTEM-BOUNDARY.md` §2.bis declara que el
mismo catalogo de espacios esta escrito CUATRO veces. Este script congela las
cuatro: `WORKSPACE_REGISTRY` (autoridad), `identity_core.SPACE_CATALOG` (espejo
backend) y los dos catalogos de navegacion del frontend. El espejo se importa
como modulo Python —los catalogos JS se parsean porque son modulos ES, pero este
es codigo nativo y releerlo con regex solo abriria la puerta a parsear mal un
diccionario que Python ya sabe leer bien.

Uso (desde `backend/`):
    .venv/Scripts/python.exe scripts/generate_workspace_contract.py

El JSON resultante se commitea a mano cuando se acepta un cambio contractual.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
FRONT = ROOT / "frontend" / "src"
OUT = ROOT / "docs" / "architecture" / "workspace_registry.contract.json"
OUT_PROJECTION = ROOT / "docs" / "architecture" / "workspace_projection.json"

sys.path.insert(0, str(BACKEND))

from services import workspace_registry as reg  # noqa: E402

# D2.2-B.3-B: el cuarto catalogo. Es Python nativo, asi que se IMPORTA — no se
# parsea con regex como los catalogos JS.
from services import identity_core as mirror  # noqa: E402

# Vocabularios tal como viven HOY en cada fuente. No se unifican aqui: unificar
# el vocabulario es D2.2. Este archivo solo las RECUERDA.
BE_STATUS = ("live", "preview", "declared", "deprecated")
FE_SPACES_STATUS = ("available", "coming_soon", "external")


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def _match(pattern: str, text: str, default=None):
    m = re.search(pattern, text, re.S)
    return m.group(1) if m else default


# ---------------------------------------------------------------------------
# Fuentes frontend: se parsean, no se importan (los catalogos son modulos ES).
# ---------------------------------------------------------------------------

def parse_workspace_spaces() -> dict:
    """frontend/src/config/workspaceSpaces.js -> WORKSPACE_SPACES."""
    text = read(FRONT / "config" / "workspaceSpaces.js")
    out = {}
    for key, body in re.findall(r"\{\s*key: '([^']+)'(.*?)\n  \},", text, re.S):
        status = _match(r"status: SPACE_STATUS\.(\w+)", body)
        out[key] = {
            "key": key,
            "status": {
                "AVAILABLE": "available",
                "COMING_SOON": "coming_soon",
                "EXTERNAL": "external",
            }.get(status, status),
            "route": _match(r"path: '([^']+)'", body),
            "label": _match(r"label: '([^']+)'", body),
        }
    return out


def parse_workspace_catalog() -> dict:
    """frontend/src/system/workspaceCatalog.js -> WORKSPACE_CATALOG.

    D2.2-B.3-A: ya NO se captura `launchable`. Ese flag se elimino porque era
    un segundo vocabulario redundante con el status; la disponibilidad ahora se
    deriva. Parsear el status y recalcular la disponibilidad es precisamente lo
    que hace que el snapshot detecte si frontend y backend divergen.
    """
    text = read(FRONT / "system" / "workspaceCatalog.js")
    out = {}
    for m in re.finditer(
        r"\{ key: '([^']+)', name: '([^']*)',\s*status: WORKSPACE_STATUSES\.(\w+)",
        text,
    ):
        status = m.group(3).lower()
        out[m.group(1)] = {
            "key": m.group(1),
            "status": status,
            "label": m.group(2),
            "availability": reg.derive_availability(status),
        }
    return out


def parse_workspace_registry() -> dict:
    """frontend/src/system/workspaceRegistry.js -> registry.workspaces[]."""
    text = read(FRONT / "system" / "workspaceRegistry.js")
    out = {}
    for m in re.finditer(
        r"verticalKey: '([^']+)'.*?lifecycle: '(\w+)', status: '(\w+)'", text
    ):
        out[m.group(1)] = {
            "key": m.group(1),
            "status": m.group(3),
            "lifecycle": m.group(2),
        }
    return out


# ---------------------------------------------------------------------------
# Fuentes backend: se IMPORTAN. `identity_core` es el cuarto catalogo y el
# unico de este lado que NO es la autoridad — el es un espejo de navegacion.
# ---------------------------------------------------------------------------

def read_identity_core_space_catalog() -> dict:
    """backend/services/identity_core.py -> SPACE_CATALOG.

    D2.2-B.3-B. Se importa el modulo en vez de releer su fuente con regex: es
    Python nativo, y el snapshot no puede ser mas fiel que el propio objeto.

    Se transporta `vertical` porque es lo que `compute_workspaces()` usa para
    recomendar, y porque compararlo contra `workspaceSpaces.js` es una de las
    invariantes del espejo: las dos caras del mismo catalogo deben apuntar a la
    misma vertical.
    """
    return {
        s["key"]: {
            "key": s["key"],
            "status": s.get("status"),
            "label": s.get("label"),
            "vertical": s.get("vertical"),
        }
        for s in mirror.SPACE_CATALOG
    }


def parse_system_entry_routes() -> dict:
    """frontend/src/system/systemEntryRules.js -> WORKSPACE_ROUTES."""
    text = read(FRONT / "system" / "systemEntryRules.js")
    out = {}
    for key, route in re.findall(r"^  (\w+): '(/workspace/[^']+)'", text, re.M):
        out[key] = {"key": key, "route": route}
    return out


# ---------------------------------------------------------------------------

def build() -> dict:
    backend = {
        s["space_key"]: {
            "space_key": s["space_key"],
            "status": s["status"],
            "permission": s["permission"],
            "route": s["route"],
            "label": s["label"],
            "core_id": s["core_id"],
        }
        for s in reg.WORKSPACE_REGISTRY
    }
    return {
        "contract_version": "D2.1",
        "authority": "backend/services/workspace_registry.py",
        "note": (
            "Snapshot GENERADO desde el codigo por "
            "backend/scripts/generate_workspace_contract.py. No editar a mano. "
            "D2.1 congela el estado real, incluidas las divergencias: no las "
            "corrige. Un cambio aqui es una decision consciente, no un efecto "
            "colateral."
        ),
        "status_vocabulary": {
            "backend": list(BE_STATUS),
            "frontend_workspace_spaces": list(FE_SPACES_STATUS),
            "backend_identity_core_mirror": sorted(
                {s.get("status") for s in mirror.SPACE_CATALOG if s.get("status")}
            ),
            "nota": (
                "Los vocabularios NO estan unificados y D2.1 no los unifica. "
                "Se documentan para que el contract test pueda reportar la "
                "divergencia en lugar de fallar en silencio. El espejo de "
                "`identity_core` comparte vocabulario con `workspaceSpaces.js` "
                "a proposito: son las dos caras del mismo catalogo de navegacion."
            ),
        },
        "backend": {
            "source": "backend/services/workspace_registry.py",
            "constant": "WORKSPACE_REGISTRY",
            "workspaces": backend,
        },
        "backend_mirror": {
            "source": "backend/services/identity_core.py",
            "constant": "SPACE_CATALOG",
            "nota": (
                "Cuarto catalogo. NO es la autoridad: es un espejo de navegacion "
                "y usa el vocabulario `available`/`coming_soon`/`external`, no el "
                "de lifecycle. Se congela aparte de `backend` a proposito, para "
                "que compararlo contra la autoridad sea una operacion explicita "
                "y no una mezcla accidental de dos cosas distintas."
            ),
            "workspaces": read_identity_core_space_catalog(),
        },
        "frontend": {
            "workspaceSpaces": {
                "source": "frontend/src/config/workspaceSpaces.js",
                "constant": "WORKSPACE_SPACES",
                "workspaces": parse_workspace_spaces(),
            },
            "workspaceCatalog": {
                "source": "frontend/src/system/workspaceCatalog.js",
                "constant": "WORKSPACE_CATALOG",
                "workspaces": parse_workspace_catalog(),
            },
            "workspaceRegistry": {
                "source": "frontend/src/system/workspaceRegistry.js",
                "constant": "workspaceRegistry.workspaces",
                "workspaces": parse_workspace_registry(),
            },
            "systemEntryRules": {
                "source": "frontend/src/system/systemEntryRules.js",
                "constant": "WORKSPACE_ROUTES",
                "workspaces": parse_system_entry_routes(),
            },
        },
        "excluded_from_contract": {
            "campos": ["emoji", "description", "presetId", "accent", "panels", "copy"],
            "motivo": (
                "Metadata puramente visual o de layout. D2.1 NO la convierte en "
                "contrato: obligarla a coincidir entre backend y frontend seria "
                "contrato sobre algo sin valor de autorizacion."
            ),
        },
    }


def build_projection() -> dict:
    """Proyección Workspace Registry -> frontend (D2.2-E).

    Se apoya en `workspace_registry.to_frontend_projection()`: la logica vive
    en el servicio, no aqui. Este script solo la serializa.
    """
    return {
        "projection_version": "D2.2-E",
        "authority": "backend/services/workspace_registry.py",
        "generator": "backend/scripts/generate_workspace_contract.py",
        "note": (
            "GENERADO desde WORKSPACE_REGISTRY. No editar a mano. Es una "
            "PROYECCION, no una fuente de verdad: para cambiar un workspace se "
            "edita el Registry y se regenera. Incluye location explícita; no "
            "incluye launchMode ni el flag de navegación external."
        ),
        "lifecycle": {
            "statuses": list(reg.LIFECYCLE_STATUSES),
            "open": list(reg.LIFECYCLE_OPEN),
            "closed": list(reg.LIFECYCLE_CLOSED),
            "no_es_lifecycle": [
                "available", "coming_soon", "developing", "future",
                "production", "beta", "alpha", "internal",
            ],
        },
        "workspaces": reg.to_frontend_projection(),
    }


def main() -> int:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"escrito: {OUT}")
    print(f"  backend       : {len(data['backend']['workspaces'])} workspaces")
    print(
        f"  espejo identity_core: "
        f"{len(data['backend_mirror']['workspaces'])} workspaces"
    )
    for name, blk in data["frontend"].items():
        print(f"  {name:<20}: {len(blk['workspaces'])} workspaces")

    proy = build_projection()
    OUT_PROJECTION.write_text(
        json.dumps(proy, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"escrito: {OUT_PROJECTION}")
    print(f"  proyeccion : {len(proy['workspaces'])} workspaces")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
