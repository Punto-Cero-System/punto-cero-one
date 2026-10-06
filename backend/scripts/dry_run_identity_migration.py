"""
Dry-run de la migración de identidad (FASE 0.3 · FASE 4).

SIMULACIÓN. NO ESCRIBE NADA.

Lee la colección `users` existente, agrupa por email normalizado y reporta qué
identidades canónicas se proponerían. No invoca `insert_one`, `update_one` ni
`create_index`. No toca `users`. No toca ninguna vertical.

Uso:
    python -m scripts.dry_run_identity_migration
    python -m scripts.dry_run_identity_migration --json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# Permite ejecutar el script directamente desde backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.system_identity import (  # noqa: E402
    ALLOWED_SOURCES,
    COLLECTION,
    generate_entity_id,
    normalize_email,
)


def _source_of(user: dict) -> str:
    """
    Deduce la fuente a partir del FORMATO del `id`, que hoy es heterogéneo:

      · `user_<hex12>`  → generado por `community_auth_routes.py:132` → community
      · UUID4           → seed de administración            → workspace

    Es una inferencia de MIGRACIÓN, no una regla de negocio. En producción la
    fuente debe persistirse explícitamente; aquí sirve para estimar el trabajo.
    """
    raw = str(user.get("id") or "")
    if raw.startswith("user_"):
        return "community"
    return "workspace"


def _has_session(db, user_id: str) -> bool:
    return db.user_sessions.count_documents({"user_id": user_id}, limit=1) > 0


def simulate(db) -> dict:
    users = list(db.users.find({}, {"_id": 0, "id": 1, "email": 1, "role": 1}))

    by_email = defaultdict(list)
    for user in users:
        email = normalize_email(user.get("email"))
        if email:
            by_email[email].append(user)

    proposed, duplicates, orphans, conflicts = [], [], [], []

    for email, group in sorted(by_email.items()):
        profiles = [
            {
                "source": _source_of(user),
                "external_id": user.get("id"),
                "email": email,
                "role": user.get("role"),
                "verified": bool(email),
                "linked_at": None,
            }
            for user in group
        ]
        entry = {
            "entity_id_preview": generate_entity_id(),
            "canonical_email": email,
            "profiles": profiles,
            "profile_count": len(profiles),
        }
        proposed.append(entry)

        if len(profiles) > 1:
            duplicates.append(entry)
            if len({p["source"] for p in profiles}) > 1:
                conflicts.append({
                    "email": email,
                    "reason": "mismo_email_dos_sistemas",
                    "sources": sorted({p["source"] for p in profiles}),
                    "external_ids": [p["external_id"] for p in profiles],
                })

    for user in users:
        if not normalize_email(user.get("email")):
            orphans.append({"external_id": user.get("id"), "reason": "sin_email"})

    with_sessions = sum(1 for u in users if _has_session(db, str(u.get("id") or "")))

    return {
        "modo": "DRY_RUN",
        "escrito": False,
        "coleccion_origen": "users",
        "coleccion_destino": COLLECTION,
        "fuentes_permitidas": list(ALLOWED_SOURCES),
        "resumen": {
            "usuarios_encontrados": len(users),
            "emails_unicos": len(by_email),
            "identidades_propuestas": len(proposed),
            "identidades_con_varios_perfiles": len(duplicates),
            "conflictos_email_dos_sistemas": len(conflicts),
            "usuarios_sin_email": len(orphans),
            "usuarios_con_sesion_cookie": with_sessions,
        },
        "conflictos": conflicts,
        "duplicados": duplicates,
        "sin_email": orphans,
        "propuestas": proposed,
    }


def _print_text(report: dict) -> None:
    r = report["resumen"]
    print("\n=== DRY RUN — Migración de Identidad Canónica ===")
    print("  Modo             : DRY_RUN (no se escribió nada)")
    print(f"  usuarios         : {r['usuarios_encontrados']}")
    print(f"  emails únicos    : {r['emails_unicos']}")
    print(f"  entidades nuevas : {r['identidades_propuestas']}")
    print(f"  con N perfiles   : {r['identidades_con_varios_perfiles']}")
    print(f"  conflictos       : {r['conflictos_email_dos_sistemas']}")
    print(f"  sin email        : {r['usuarios_sin_email']}")
    print("\n--- Conflictos (requieren decisión manual) ---")
    for c in report["conflictos"]:
        print(f"  {c['email']}: {c['reason']} -> {c['sources']} {c['external_ids']}")
    if not report["conflictos"]:
        print("  (ninguno)")
    print("\n--- Propuestas ---")
    for p in report["propuestas"][:15]:
        profs = ", ".join(f"{x['source']}:{x['external_id']}" for x in p["profiles"])
        print(f"  {p['canonical_email']:<34} -> {p['profile_count']} perfil(es) [{profs}]")
    if len(report["propuestas"]) > 15:
        print(f"  ... y {len(report['propuestas']) - 15} más")
    print(f"\n  Total propuestas: {len(report['propuestas'])}")
    print("\n  Recordatorio: NO se crearon índices ni documentos.\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run de migración de identidad")
    parser.add_argument("--json", action="store_true", help="Salida en JSON")
    args = parser.parse_args()

    from pymongo import MongoClient  # import tardío: solo hace falta al ejecutar

    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    name = os.environ.get("DB_NAME", "punto_cero_local")
    db = MongoClient(url)[name]

    report = simulate(db)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False, default=str))
    else:
        _print_text(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
