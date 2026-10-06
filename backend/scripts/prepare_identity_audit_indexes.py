"""
Preparación manual de índices de `identity_events` (FASE 0.7 · OBJETIVO 1).

Este script es la ÚNICA vía para preparar la capa. Deliberadamente NO se invoca
desde el lifespan de `server.py`: conectarlo al arranque sería activar la capa,
y la activación pertenece a la FASE 0.8.

    Preparar:   python -m scripts.prepare_identity_audit_indexes --apply
    Verificar:  python -m scripts.prepare_identity_audit_indexes          (dry-run)

Sin `--apply` solo LEE y muestra el informe: no crea nada.

Prohibido por diseño: índices TTL, update y delete sobre `identity_events`.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.identity_audit import (  # noqa: E402
    COLLECTION,
    EVENT_TYPES,
    ensure_audit_indexes,
    validate_audit_config,
)


async def _run(apply: bool) -> int:
    from motor.motor_asyncio import AsyncIOMotorClient

    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    name = os.environ.get("DB_NAME", "punto_cero_local")
    db = AsyncIOMotorClient(url)[name]

    before = await validate_audit_config(db)
    print(f"\n=== Identity Audit · {name} ===")
    print(f"  colección '{COLLECTION}' existe: {before['exists']}")
    print(f"  documentos actuales          : {before['documents']}")
    print(f"  vocabulario de eventos       : {len(EVENT_TYPES)}")
    if not before["exists"]:
        print("  índices presentes            : (colección sin crear)")
    else:
        for name_, spec in sorted(before["indexes"].items()):
            ttl = spec["expireAfterSeconds"]
            flags = []
            if spec["unique"]:
                flags.append("unique")
            if spec["sparse"]:
                flags.append("sparse")
            if ttl is not None:
                flags.append(f"TTL={ttl}")
            print(f"    - {name_:<18} {spec['key']}  [{', '.join(flags) or '-'}])")
    if before["missing"]:
        print(f"  faltantes: {', '.join(before['missing'])}")
    if before["problems"]:
        print(f"  PROBLEMAS: {', '.join(before['problems'])}")

    if not apply:
        print("\n  Modo lectura. Usa --apply para crear los índices.")
        client = db.client
        client.close()
        return 0

    created = await ensure_audit_indexes(db)
    print(f"\n  índices preparados: {', '.join(sorted(created))}")

    after = await validate_audit_config(db)
    print(f"  configuración válida: {after['ok']}")
    if not after["ok"]:
        print(f"  PROBLEMAS: {', '.join(after['problems'])}")
        print(f"  faltantes: {', '.join(after['missing'])}")
        db.client.close()
        return 1

    print(f"  documentos tras preparar índices: {after['documents']} (debe seguir igual)")
    db.client.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prepara (o verifica) los índices de identity_events."
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Crea los índices. Sin esta flag solo se verifica.",
    )
    args = parser.parse_args()
    return asyncio.run(_run(args.apply))


if __name__ == "__main__":
    raise SystemExit(main())
