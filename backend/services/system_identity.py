"""
System Identity Layer (FASE 0.3) — núcleo de identidad canónica de Punto Cero System.

Decisión de arquitectura (aprobada):
    `entity_id` es la identidad global. Inmutable, generada por System, independiente
    del email y de cualquier vertical. Cada sistema existente aporta un PERFIL
    identificado por `(source, external_id)`.

Alcance ESTA fase — deliberadamente limitado:
    · Modelo + colección + índices + servicio de enlace.
    · NO se activa ningún flujo real, NO se modifica `identity_core.py`,
      NO se sustituye `resolve_identity()`, NO se conecta con ninguna vertical.

Diseño técnico (justificación):
    · Sincrónico (pymongo) — igual que `services/access_bridge.py` y que el fixture
      `mongo_db` de `tests/conftest.py`. El proyecto no tiene `pytest_asyncio` ni
      `mongomock` instalados. Cuando esta capa se enchufe en las rutas async de
      FastAPI deberá ir envuelta (`run_in_threadpool` o variante con motor); esa
      integración NO forma parte de esta fase.

Invariantes garantizados por índice único en Mongo:
    Un `(source, external_id)` pertenece como máximo a UNA `entity_id`.
"""
from __future__ import annotations

import os
import re
import secrets
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .identity_registry import can_emit, get_owner_token, is_valid_system, list_tokens

# ─────────────────────────────────────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────────────────────────────────────

COLLECTION = "system_identities"
ENTITY_ID_PREFIX = "pc_usr_"

# Fuentes permitidas en esta fase. `legal` y `medical` quedan deliberadamente
# fuera: cada vertical declarará su propio origen en su propia capa.
# PROYECCIÓN del Registry, no autoridad propia. La autoridad es
# `identity_registry` (ADR-IDENT-002). El nombre se conserva porque otros
# módulos lo importan; su valor lo determina el catálogo.
ALLOWED_SOURCES = tuple(list_tokens())

_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford base32 (sin I, L, O, U)
_ULID_LEN = 26
# Longitud del bloque temporal dentro del entity_id (50 bits).
_TIME_LEN = 10
# Rango plausible de epoch-ms para el bloque temporal.
# 2020-01-01 .. 2100-01-01: amplio paraClock-skew, estrecho para rejecting ruido.
_MIN_TIMESTAMP_MS = 1_577_836_800_000
_MAX_TIMESTAMP_MS = 4_102_444_800_000

# Estados de conflicto al resolver dos sesiones simultáneas.
CONFLICT_NONE = "none"          # 0 o 1 sesión
CONFLICT_LINKED = "linked"      # 2 sesiones, mismo entity_id
CONFLICT_SPLIT = "split"        # 2 sesiones, entidades distintas (no se auto-unen)
CONFLICT_MIXED = "mixed"        # 2 sesiones, 1 con perfil y otra sin resolver



# ─────────────────────────────────────────────────────────────────────────────
# Generación de entity_id — ULID-like, ordenable por tiempo, sin dependencias
# ─────────────────────────────────────────────────────────────────────────────

def _b32(value: int, length: int) -> str:
    out = []
    for _ in range(length):
        out.append(_CROCKFORD[value & 0x1F])
        value >>= 5
    return "".join(reversed(out))


def _b32_to_int(text: str) -> Optional[int]:
    """Decodifica Crockford base32. Devuelve None si hay un caracter invalido."""
    value = 0
    for ch in text:
        idx = _CROCKFORD.find(ch)
        if idx < 0:
            return None
        value = (value << 5) | idx
    return value


def generate_entity_id() -> str:
    """
    `pc_usr_` + ULID (timestamp ms en Crockford base32 + 80 bits aleatorios).

    Ordenable por creación, opaco, sin `ObjectId` de Mongo y sin revelar nada
    del usuario. Formato: `pc_usr_01J8ZQK3M7F0000000000000A`.
    """
    timestamp = int(time.time() * 1000)
    randomness = secrets.randbits(80)
    return f"{ENTITY_ID_PREFIX}{_b32(timestamp, 10)}{_b32(randomness, 16)}"


def is_valid_entity_id(value: Any) -> bool:
    """
    Valida prefijo, longitud, alfabeto y estructura (ADR-IDENT-001 FASE 1.5A).

    Antes solo comprobaba prefijo + longitud, de modo que un identificador con
    caracteres ajenos al alfabeto Crockford pasaba como valido. La generacion no
    cambia: esta funcion solo acepta o rechaza; nunca construye.
    """
    if not isinstance(value, str):
        return False
    if not value.startswith(ENTITY_ID_PREFIX):
        return False
    if len(value) != len(ENTITY_ID_PREFIX) + _ULID_LEN:
        return False
    body = value[len(ENTITY_ID_PREFIX):]
    if any(ch not in _CROCKFORD for ch in body):
        return False
    # Estructura temporal: los primeros 10 chars codifican el timestamp en
    # Crockford base32 (50 bits). Debe producir un epoch-ms plausible.
    stamp = _b32_to_int(body[:_TIME_LEN])
    if stamp is None or not _MIN_TIMESTAMP_MS <= stamp <= _MAX_TIMESTAMP_MS:
        return False
    return True


def normalize_email(value: Any) -> Optional[str]:
    """Minúsculas y trim. El email NUNCA es clave: solo atributo."""
    if not value:
        return None
    text = str(value).strip().lower()
    return text or None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Modelos
# ─────────────────────────────────────────────────────────────────────────────

class SystemProfile(BaseModel):
    """Perfil de un sistema existente. No es identidad: es una referencia."""

    source: str = Field(description="community | workspace")
    external_id: str = Field(description="Id nativo en la colección de origen")
    email: Optional[str] = None
    role: Optional[str] = None
    verified: bool = False
    linked_at: str = ""


class SystemIdentity(BaseModel):
    """
    Identidad canónica. `entity_id` es inmutable y único. `profiles[]` referencia
    los ids nativos de cada sistema. `attributes` guarda datos mutables y NUNCA se
    usa para deduplicar.
    """

    entity_id: str
    created_at: str
    updated_at: str = ""
    profiles: List[SystemProfile] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    providers: List[Dict[str, Any]] = Field(default_factory=list)
    workspaces: List[Dict[str, Any]] = Field(default_factory=list)


def _validate_source(source: Any, *, for_emission: bool = False) -> str:
    """Valida contra el Registry (ADR-IDENT-002).

    Normaliza igual que antes: recortar y minusculas. La autoridad ya no es la
    tupla local sino `identity_registry.is_valid_system`, que aplica el Test
    del Espacio de Nombres: un token no registrado no es un Sistema.
    """
    value = str(source or "").strip().lower()
    if not is_valid_system(value):
        raise ValueError(f"source_no_permitido:{value}")
    if for_emission and not can_emit(value):
        # El token existe pero su Sistema ya no emite: legible, no emisible.
        raise ValueError(f"source_no_emisible:{value}")
    return value


# ─────────────────────────────────────────────────────────────────────────────
# Índices
# ─────────────────────────────────────────────────────────────────────────────

async def ensure_indexes(db) -> Dict[str, str]:
    """
    Crea los índices de la colección. Idempotente.

    Índice crítico: compuesto UNIQUE sobre `profiles.source` + `profiles.external_id`.
    Ambos campos salen del MISMO array, lo que Mongo permite (una sola clave de
    array por índice). Garantía: un perfil externo jamás pertenece a dos entidades.

    NO se llama desde el lifespan en esta fase: la colección no se usa en ningún
    flujo todavía. Conectarlo al arranque sería activar la capa.
    """
    col = db[COLLECTION]
    created = {}
    created["entity_id"] = await col.create_index("entity_id", unique=True)
    created["profiles_source_external"] = await col.create_index(
        [("profiles.source", 1), ("profiles.external_id", 1)], unique=True
    )
    created["created_at"] = await col.create_index("created_at")
    return created


# ─────────────────────────────────────────────────────────────────────────────
# Servicio
# ─────────────────────────────────────────────────────────────────────────────

async def create_system_identity(
    db,
    *,
    source: str,
    external_id: str,
    email: Optional[str] = None,
    role: Optional[str] = None,
    verified: bool = False,
    attributes: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Crea una identidad con su primer perfil y devuelve el `entity_id`.

    Idempotente por diseño: si el perfil `(source, external_id)` ya existe, no
    crea una segunda entidad — devuelve la existente. Eso es lo que impide que dos
    altas del mismo perfil generen dos identidades.
    """
    source = _validate_source(source, for_emission=True)
    external_id = str(external_id or "").strip()
    if not external_id:
        raise ValueError("external_id_requerido")

    existing = await find_by_external_profile(db, source, external_id)
    if existing:
        return existing["entity_id"]

    entity_id = generate_entity_id()
    now = _now_iso()
    doc = {
        "entity_id": entity_id,
        "created_at": now,
        "updated_at": now,
        "profiles": [
            {
                "source": source,
                "external_id": external_id,
                "email": normalize_email(email),
                "role": role,
                "verified": bool(verified),
                "linked_at": now,
            }
        ],
        "attributes": dict(attributes or {}),
        "providers": [],
        "workspaces": [],
    }
    try:
        await db[COLLECTION].insert_one(doc)
    except Exception:
        found = await find_by_external_profile(db, source, external_id)
        if found:
            return found["entity_id"]
        raise
    return entity_id


async def find_by_external_profile(db, source: str, external_id: str) -> Optional[Dict[str, Any]]:
    """Devuelve la entidad que posee el perfil, o None."""
    source = _validate_source(source)
    external_id = str(external_id or "").strip()
    if not external_id:
        return None
    return await db[COLLECTION].find_one(
        {"profiles": {"$elemMatch": {"source": source, "external_id": external_id}}}
    )


async def get_identity(db, entity_id: str) -> Optional[Dict[str, Any]]:
    if not is_valid_entity_id(entity_id):
        return None
    return await db[COLLECTION].find_one({"entity_id": entity_id})


async def link_profile(
    db,
    entity_id: str,
    source: str,
    external_id: str,
    *,
    email: Optional[str] = None,
    role: Optional[str] = None,
    verified: bool = False,
) -> str:
    """
    Añade un perfil a una identidad existente.

    - Si el perfil ya pertenece a OTRA entidad → `ValueError`. No se mueve en
      silencio: la reconciliación es una decisión explícita, no automática.
    - Si ya pertenece a ESTA entidad → no-op idempotente.
    - Si no pertenece a ninguna → se añade.
    """
    source = _validate_source(source, for_emission=True)
    external_id = str(external_id or "").strip()
    if not external_id:
        raise ValueError("external_id_requerido")

    owner = await find_by_external_profile(db, source, external_id)
    if owner and owner.get("entity_id") != entity_id:
        raise ValueError(f"perfil_ya_pertenece_a:{owner.get('entity_id')}")
    if owner:  # ya es de esta entidad → no-op idempotente
        return entity_id

    now = _now_iso()
    result = await db[COLLECTION].update_one(
        {"entity_id": entity_id},
        {
            "$push": {
                "profiles": {
                    "source": source,
                    "external_id": external_id,
                    "email": normalize_email(email),
                    "role": role,
                    "verified": bool(verified),
                    "linked_at": now,
                }
            },
            "$set": {"updated_at": now},
        },
    )
    if result.matched_count == 0:
        raise ValueError(f"identidad_no_existe:{entity_id}")
    return entity_id



# ─────────────────────────────────────────────────────────────────────────────
# Resolución de identidad
# ─────────────────────────────────────────────────────────────────────────────

def _session_id(user: Optional[Dict[str, Any]]) -> Optional[str]:
    if not user or not isinstance(user, dict):
        return None
    value = user.get("id")
    return str(value).strip() if value else None


async def resolve_system_identity(
    db,
    *,
    community_user: Optional[Dict[str, Any]] = None,
    jwt_user: Optional[Dict[str, Any]] = None,
    create_missing: bool = False,
) -> Dict[str, Any]:
    """
    Resuelve las sesiones existentes a una identidad canónica.

    A diferencia de `identity_core.resolve_identity()` — que compara `id` crudos y
    lanza `IdentityConflictError` — esta capa devuelve SIEMPRE un estado:

      · 0 o 1 sesión           → conflict_state = none
      · 2 sesiones, mismo id   → conflict_state = linked
      · 2 sesiones, perfil compartido pero entidad distinta → split (NO se auto-unen)
      · 2 sesiones, sin vínculo → split

    Nunca muta nada salvo que `create_missing=True` (usado solo por la simulación
    y los tests, nunca desde rutas).

    Devuelve `{entity_id, profiles, conflict_state, sources, detail}`.
    """
    # FASE 1.5A: el source de un perfil es el SISTEMA propietario del
    # external_id, no el canal de sesion. Antes se etiquetaba la sesion con
    # community/workspace, lo que hacia que un mismo usuario no encontrara
    # su perfil. Ahora ambos canales resuelven contra el token del Sistema.
    # El canal se conserva aparte, en sources de la respuesta, que es
    # Concepto 2 (origen de sesion) y no participa de la identidad.
    sessions = []
    if community_user:
        sessions.append((get_owner_token(), "community", community_user))
    if jwt_user:
        sessions.append((get_owner_token(), "workspace", jwt_user))

    resolved: List[Dict[str, Any]] = []
    for source, _channel, user in sessions:
        external_id = _session_id(user)
        if not external_id:
            continue
        doc = await find_by_external_profile(db, source, external_id)
        if doc is None and create_missing:
            entity_id = await create_system_identity(
                db,
                source=source,
                external_id=external_id,
                email=user.get("email"),
                role=user.get("role"),
            )
            doc = await get_identity(db, entity_id)
        if doc:
            resolved.append(doc)

    # Concepto 2: la respuesta expone el CANAL de cada sesion, no el Sistema.
    # Se mantiene la clave publica "sources" por compatibilidad.
    sources = [channel for _source, channel, u in sessions if _session_id(u)]

    if not resolved:
        return {
            "entity_id": None,
            "profiles": [],
            "conflict_state": CONFLICT_NONE,
            "sources": sources,
            "detail": "sin_identidad",
        }

    entity_ids = {d["entity_id"] for d in resolved}
    primary = resolved[0]

    if len(entity_ids) == 1:
        state = CONFLICT_LINKED if len(resolved) > 1 else CONFLICT_NONE
        detail = "ok"
    else:
        state = CONFLICT_SPLIT
        detail = "entidades_distintas:" + ",".join(sorted(entity_ids))

    if len(resolved) < len(sessions) and len(entity_ids) == 1:
        state = CONFLICT_MIXED
        detail = "sesion_sin_perfil"

    return {
        "entity_id": primary["entity_id"],
        "profiles": primary.get("profiles", []),
        "conflict_state": state,
        "sources": sources,
        "detail": detail,
        "candidate_entity_ids": sorted(entity_ids),
    }


# -----------------------------------------------------------------------------
# Contrato de identidad (FASE 1.5A, OBJETIVO 4)
#
# Forma que el futuro Login Bridge consumira. NO es un endpoint: no hay
# ruta, no hay I/O y no se expone en la API publica. Es la estructura
# interna que Identity Core entrega a sus consumidores.
#
# available_spaces lo decide el consumidor (Access Bridge), no Identity
# Core. Aqui solo se normaliza; la decision es de politica, no de identidad.
# -----------------------------------------------------------------------------
IDENTITY_TYPE_PERSONAL = "personal"


def build_identity_contract(
    entity_id: str,
    *,
    system: Optional[str] = None,
    identity_type: str = IDENTITY_TYPE_PERSONAL,
    available_spaces: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Construye el contrato de identidad que el Login Bridge consumira.

    entity_id es el unico campo obligatorio y debe superar
    is_valid_entity_id. system por defecto es el Sistema propietario del
    namespace segun el Registry: no lo elige el consumidor.

    available_spaces se normaliza a minusculas, sin duplicados y en orden
    estable. No se valida contra el registry de espacios: decidir que
    espacios se abren es competencia de la politica, no de la identidad.
    """
    if not is_valid_entity_id(entity_id):
        raise ValueError("entity_id_invalido")
    resolved_system = system or get_owner_token()
    if not is_valid_system(resolved_system):
        raise ValueError(f"source_no_permitido:{resolved_system}")
    spaces: List[str] = []
    for space in available_spaces or []:
        key = str(space or "").strip().lower()
        if key and key not in spaces:
            spaces.append(key)
    return {
        "entity_id": entity_id,
        "system": resolved_system,
        "identity_type": identity_type,
        "available_spaces": spaces,
    }


# -----------------------------------------------------------------------------
# Bootstrap / Proyeccion (FASE 1.5B)
#
# Relacion user.id -> external_id -> system_identity -> entity_id.
#
# Reglas duras:
#   - El emisor es SIEMPRE el Sistema propietario segun el Registry. Nunca
#     community ni workspace: esos tokens estan bloqueados para emision.
#   - Es idempotente por construccion: create_system_identity ya lo es,
#     asi que re-ejecutar devuelve el mismo entity_id.
#   - No muta users. Solo lee el documento y escribe en la coleccion de
#     identidades, que es su propio dominio.
#   - No crea endpoints ni altera el Bridge: el Bridge sigue resolviendo
#     por resolve_system_identity.
# -----------------------------------------------------------------------------
async def project_user_identity(
    db,
    user: Optional[Dict[str, Any]],
    *,
    create_missing: bool = False,
) -> Optional[str]:
    """
    Proyecta un usuario a la identidad canonica y devuelve su entity_id.

    create_missing=False (por defecto) es SOLO LECTURA: si el usuario ya
    esta proyectado devuelve su entity_id; si no, devuelve None sin escribir.
    Con create_missing=True crea la identidad si falta.

    Devuelve None si el usuario no trae id: un usuario sin identificador
    no es proyectable y nunca se inventa uno.
    """
    if not user or not isinstance(user, dict):
        return None
    external_id = _session_id(user)
    if not external_id:
        return None

    # El token lo decide el Registry, no el llamador: es la autoridad.
    source = get_owner_token()

    existing = await find_by_external_profile(db, source, external_id)
    if existing:
        return existing["entity_id"]
    if not create_missing:
        return None

    return await create_system_identity(
        db,
        source=source,
        external_id=external_id,
        email=user.get("email"),
        role=user.get("role"),
        verified=bool(user.get("email")),
    )


async def project_user_by_id(
    db,
    user_id: Any,
    *,
    create_missing: bool = False,
) -> Optional[str]:
    """
    Proyecta un usuario buscandolo por su id en la coleccion users.

    No escribe en users. Si el id no existe devuelve None.
    """
    if not str(user_id or "").strip():
        return None
    user = await db["users"].find_one(
        {"id": str(user_id).strip()}, {"_id": 0})
    if not user:
        return None
    return await project_user_identity(db, user, create_missing=create_missing)
