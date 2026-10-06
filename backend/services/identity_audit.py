"""
Identity Audit Layer (FASE 0.6) — registro append-only de eventos de identidad.

ALCANCE ESTRICTO: SOLO REGISTRO.

Esta capa NO decide identidad, NO enlaza perfiles, NO modifica usuarios y NO
expone endpoints. Escribe y nada más.

Invariantes garantizados por diseño:

    1. Nunca se actualiza un evento existente.   → solo `insert_one`
    2. Nunca se elimina un evento.               → no hay update/delete/TTL
    3. Sin endpoint público.                     → no hay rutas ni router
    4. Sin lógica de decisión.                   → ninguna rama de negocio
    5. Solo registro.                            → el resto son ayudas de forma

Vocabulario cerrado (`EVENT_TYPES`). Un tipo fuera del conjunto es un error de
programación y se rechaza.

Sobre `entity_id`: es NULLABLE a propósito. La capa de identidad canónica sigue
DESCONECTADA (Fase 0.3), así que todavía no existe `entity_id` que anotar. La
columna se prepara ahora para que la Fase 0.7 la rellene sin migración.
"""
from __future__ import annotations

import logging
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("punto-cero-api.identity_audit")

# ─────────────────────────────────────────────────────────────────────────────
# Constantes
# ─────────────────────────────────────────────────────────────────────────────

COLLECTION = "identity_events"

EVENT_ID_PREFIX = "evt_"
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

# Vocabulario cerrado, ordenado por el ciclo de vida de una identidad.
EVENT_TYPES: frozenset = frozenset({
    "identity.created",
    "profile.linked",
    "profile.link_requested",
    "profile.link_rejected",
    "email_collision.detected",
    "identity.conflict.created",
    "provider.attached",
    "provider.detached",
})


class EventTypeError(ValueError):
    """Tipo de evento fuera del vocabulario permitido."""


# ─────────────────────────────────────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────────────────────────────────────

def _b32(value: int, length: int) -> str:
    out = []
    for _ in range(length):
        out.append(_CROCKFORD[value & 0x1F])
        value >>= 5
    return "".join(reversed(out))


def generate_event_id() -> str:
    """
    `evt_` + timestamp ms (base32) + 80 bits aleatorios.

    Ordenable por tiempo, opaco y sin `ObjectId`. Sufijo propio del dominio de
    auditoría para no confundirse con un `entity_id` (`pc_usr_`) ni con un id de
    usuario (`user_`).
    """
    stamp = _b32(int(time.time() * 1000), 10)
    return f"{EVENT_ID_PREFIX}{stamp}{_b32(secrets.randbits(80), 16)}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


# ─────────────────────────────────────────────────────────────────────────────
# PRIVACIDAD (FASE 0.8) — enmascarado de correo
#
# Por qué enmascarar y no rechazar: si `record_event` lanzara una excepción al
# detectar un email, el evento se PERDERÍA. Una auditoría que pierde el registro
# de un intento de suplantación es peor que una que guarda el correo enmascarado.
# El enmascarado es total y automático, no opcional.
#
# Dónde se aplica: en `record_event`, el ÚNICO punto por el que pasa todo. Un
# filtro aplicado emitter por emitter depende de que cada uno se acuerde.
# ─────────────────────────────────────────────────────────────────────────────

MASK_CHAR = "*"
MASK_RUN = MASK_CHAR * 5

# Local@dominio.tld. Tres grupos capturados para poder reconstruir el enmascarado.
_EMAIL_RE = re.compile(
    r"(?i)([a-z0-9._%+\-]+)@([a-z0-9\-]+(?:\.[a-z0-9\-]+)*)\.([a-z]{2,})"
)

# El resultado enmascarado (`u*****@d*****.com`) NO vuelve a casar con esta
# regex, porque `*` no está en la clase de caracteres del local. Por eso
# `find_plain_emails` puede usarse para demostrar que no queda PII suelta.
#
# Campos por los que pasa el filtro. Se recorren todos, no solo `evidence`: un
# `actor` mal puesto o un `profile_reference` heredado también acabarían en la
# base, y el filtro no debe depender de que el campo "correcto" sea el esperado.
_PRIVACY_FIELDS = (
    "actor", "source", "profile_reference", "entity_id",
    "related_ids", "rule_applied", "evidence", "request_id", "metadata",
)


def mask_email(value: str) -> str:
    """
    Enmascara cualquier correo dentro de `value`.

        usuario@dominio.com   →  u*****@d*****.com
        juan@mail.empresa.com  →  j*****@m*****.com

    Conserva la primera letra del usuario, la del primer label del dominio y el
    TLD: suficiente para triage (gmail frente a empresa), insuficiente para
    identificar a la persona.
    """
    def _sub(match: "re.Match[str]") -> str:
        local, domain, tld = match.group(1), match.group(2), match.group(3)
        first_local = local[0] if local else ""
        first_domain = domain[0] if domain else ""
        return f"{first_local}{MASK_RUN}@{first_domain}{MASK_RUN}.{tld}"

    return _EMAIL_RE.sub(_sub, str(value))


def sanitize(value: Any) -> Any:
    """
    Aplica `mask_email` recursivamente sobre cualquier estructura JSON-ish.

    Los no-cadena (int, bool, None, listas de índices) pasan intactos: enmascarar
    un booleano convertiría `True` en `'Tr*****'`, que es un bug, no privacy.
    """
    if isinstance(value, str):
        return mask_email(value)
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize(v) for v in value]
    return value


def find_plain_emails(value: Any) -> List[str]:
    """
    Devuelve los correos SIN enmascarar que sobrevivan en una estructura.

    Se usa en tests y en la validación posterior a la escritura: sirve para
    demostrar, no para suponer, que no se ha filtrado PII.
    """
    found: List[str] = []
    if isinstance(value, str):
        found.extend(m.group(0) for m in _EMAIL_RE.finditer(value))
    elif isinstance(value, dict):
        for item in value.values():
            found.extend(find_plain_emails(item))
    elif isinstance(value, (list, tuple)):
        for item in value:
            found.extend(find_plain_emails(item))
    return found


# ─────────────────────────────────────────────────────────────────────────────
# Modelo
# ─────────────────────────────────────────────────────────────────────────────

class IdentityEvent(BaseModel):
    """
    Evento de auditoría. Inmutable una vez insertado.

    `entity_id` es nullable mientras la capa canónica siga desconectada.
    `related_ids` permite encadenar eventos (p. ej. las dos identidades
    enfrentadas en una colisión) sin estructura de grafo.
    """

    event_id: str
    event_type: str
    occurred_at: str

    actor: Optional[str] = None
    source: Optional[str] = None
    profile_reference: Optional[str] = None

    # NULLABLE POR DISEÑO hasta que exista entity_id.
    entity_id: Optional[str] = None

    related_ids: List[str] = Field(default_factory=list)
    rule_applied: Optional[str] = None
    evidence: Dict[str, Any] = Field(default_factory=dict)
    request_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Contrato de índices — fuente de verdad para la validación
# ─────────────────────────────────────────────────────────────────────────────

# Literal esperado por la arquitectura. `validate_audit_config()` lo compara
# contra el estado real de Mongo. Cambiar aquí cambia el contrato, y el test que
# lo cubre fallará si la base no se migró.
EXPECTED_INDEXES: Dict[str, Dict[str, Any]] = {
    "event_id": {"key": [("event_id", 1)], "unique": True},
    "occurred_at": {"key": [("occurred_at", 1)], "unique": False},
    "type_and_time": {
        "key": [("event_type", 1), ("occurred_at", -1)], "unique": False,
    },
    "entity_and_time": {
        "key": [("entity_id", 1), ("occurred_at", -1)],
        "unique": False, "sparse": True,
    },
    "source_and_time": {
        "key": [("source", 1), ("occurred_at", -1)],
        "unique": False, "sparse": True,
    },
}


async def validate_audit_config(db) -> Dict[str, Any]:
    """
    Valida la configuración REAL de `identity_events` contra el contrato.

    SOLO LECTURA: no crea índices, no escribe documentos. Sirve para comprobar
    en un entorno que la capa quedó bien preparada antes de activarla, y para
    detectar que alguien añadió un TTL o aflojó el índice único.

    Devuelve un informe con `ok: bool` y la lista concreta de `problems`.
    """
    # `list_collection_names()` pertenece a la base de datos, no a la colección.
    names = await db.list_collection_names()
    if COLLECTION not in names:
        return {
            "collection": COLLECTION,
            "exists": False,
            "ok": False,
            "missing": sorted(EXPECTED_INDEXES),
            "unexpected": [],
            "problems": ["coleccion_no_existe"],
            "indexes": {},
            "documents": 0,
        }

    raw = await db[COLLECTION].index_information()
    indexes = {name: spec for name, spec in raw.items() if name != "_id_"}
    documents = await db[COLLECTION].count_documents({})

    problems: List[str] = []
    missing: List[str] = []
    unexpected: List[str] = []

    for name, expected in EXPECTED_INDEXES.items():
        spec = indexes.get(name)
        if spec is None:
            missing.append(name)
            continue
        actual_key = [
            (k, v) for k, v in spec.get("key", []) if k != "_id"
        ]
        if actual_key != expected["key"]:
            problems.append(f"clave_incorrecta:{name}")
        if bool(spec.get("unique")) != bool(expected["unique"]):
            problems.append(f"unique_incorrecto:{name}")
        if bool(spec.get("sparse")) != bool(expected.get("sparse", False)):
            problems.append(f"sparse_incorrecto:{name}")
        # PROHIBICIÓN ABSOLUTA: un TTL borraría eventos automáticamente y
        # contradice la regla append-only.
        if spec.get("expireAfterSeconds") is not None:
            problems.append(f"ttl_prohibido:{name}")

    for name in indexes:
        if name not in EXPECTED_INDEXES:
            unexpected.append(name)
            if indexes[name].get("expireAfterSeconds") is not None:
                problems.append(f"ttl_prohibido:{name}")

    return {
        "collection": COLLECTION,
        "exists": True,
        "ok": not problems and not missing,
        "missing": sorted(missing),
        "unexpected": sorted(unexpected),
        "problems": sorted(problems),
        "indexes": {
            name: {
                "key": [list(k) for k in spec.get("key", [])],
                "unique": bool(spec.get("unique")),
                "sparse": bool(spec.get("sparse")),
                "expireAfterSeconds": spec.get("expireAfterSeconds"),
            }
            for name, spec in indexes.items()
        },
        "documents": documents,
        "vocabulary_size": len(EVENT_TYPES),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Índices
# ─────────────────────────────────────────────────────────────────────────────

async def ensure_audit_indexes(db) -> Dict[str, str]:
    """
    Crea los índices de `identity_events`. Idempotente y SIN datos.

    NO se invoca desde el lifespan. Debe ejecutarse MANUALMENTE:

        python -m scripts.prepare_identity_audit_indexes

    Conectarla al arranque del servidor sería activar la capa, y la activación
    va después de la FASE 0.8.

    NO hay índice TTL. Una auditoría con retención automática contradice la
    regla "nunca eliminar eventos"; la retención, si se decide, será una
    política explícita de archivo, no un `expireAfterSeconds`.
    """
    col = db[COLLECTION]
    created = {}
    for name, spec in EXPECTED_INDEXES.items():
        # Nombre EXPLÍCITO: si se deja que Mongo lo genere (`event_id_1`, etc.),
        # la validación por nombre dejaría de encontrar los índices.
        created[name] = await col.create_index(
            spec["key"],
            name=name,
            unique=spec["unique"],
            sparse=spec.get("sparse", False),
        )
    return created


# ─────────────────────────────────────────────────────────────────────────────
# Registro — única operación de escritura de esta capa
# ─────────────────────────────────────────────────────────────────────────────

async def record_event(
    db,
    event_type: str,
    *,
    actor: Optional[str] = None,
    provider: Optional[str] = None,
    source: Optional[str] = None,
    profile_reference: Optional[str] = None,
    entity_id: Optional[str] = None,
    related_ids: Optional[List[str]] = None,
    rule_applied: Optional[str] = None,
    evidence: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Inserta UN evento y devuelve su `event_id`.

    No actualiza, no borra, no decide. Un `event_type` fuera del vocabulario
    lanza `EventTypeError` antes de tocar la base.

    FASE 0.8 · PRIVACIDAD. Este es el ÚNICO punto de entrada a la colección, así
    que el enmascarado se aplica aquí y no en cada emisor: un filtro por emisor
    depende de que los ocho se acuerden, y uno se acabará olvidando.

    Se recorren los nueve campos de texto, no solo `evidence`. Después de
    construir el documento se verifica que no sobreviva ningún correo plano; si
    sobrevive, se registra el evento enmascarando lo que se pueda y se avisa por
    log, en vez de perder el registro.
    """
    # CONCEPTO 3 (ADR-IDENT-001): este campo es el PROVEEDOR de
    # autenticacion, nunca el `source` de identidad. `provider` es el
    # nombre canonico; `source` se acepta como alias deprecado para no
    # romper los llamadores existentes. El valor persistido no cambia.
    if provider is None and source is not None:
        provider = source

    kind = str(event_type or "").strip()
    if kind not in EVENT_TYPES:
        raise EventTypeError(f"event_type_no_permitido:{kind}")

    doc = IdentityEvent(
        event_id=generate_event_id(),
        event_type=kind,
        occurred_at=_now_iso(),
        actor=_clean(actor),
        source=_clean(provider),
        profile_reference=_clean(profile_reference),
        entity_id=_clean(entity_id),
        related_ids=[str(r) for r in (related_ids or []) if r],
        rule_applied=_clean(rule_applied),
        evidence=dict(evidence or {}),
        request_id=_clean(request_id),
        metadata=dict(metadata or {}),
    )

    # ── FASE 0.9 · tubo de gobierno ────────────────────────────────────────
    # Orden deliberado: limpiar → enmascarar → acotar → medir → verificar.
    # Enmascarar antes de acotar para que un correo gigante no sobreviva a la
    # truncatura, y medir al final para decidir sobre el documento definitivo.

    payload = doc.model_dump()

    # 1) Claves prohibidas (secretos), a cualquier profundidad.
    dropped: List[str] = []
    payload = strip_forbidden_keys(payload, dropped)
    if dropped:
        _log_governance(kind, "forbidden_keys_dropped", {"keys": sorted(set(dropped))})

    # 2) `metadata` es el único campo libre: allowlist estricta.
    allowed_before = set(payload.get("metadata") or {})
    payload["metadata"] = filter_metadata(payload.get("metadata"))
    discarded = allowed_before - set(payload["metadata"])
    if discarded:
        _log_governance(kind, "metadata_keys_discarded",
                        {"keys": sorted(discarded)})

    # 3) Privacidad (FASE 0.8): los nueve campos de texto.
    for field in _PRIVACY_FIELDS:
        payload[field] = sanitize(payload.get(field))

    # 4) Límites de forma: truncar y marcar, nunca perder el evento.
    payload = enforce_limits(payload)

    # 5) Tamaño final. Tras truncar, exceder el límite es patológico.
    size = _estimate_bytes(payload)
    if size > MAX_DOCUMENT_BYTES:
        _log_governance(kind, "event_too_large",
                        {"bytes": size, "limit": MAX_DOCUMENT_BYTES})
        raise EventTooLargeError(
            f"evento_demasiado_grande:{size}>{MAX_DOCUMENT_BYTES}"
        )

    # 6) Comprobación posterior: no confiar en el filtro, verificarlo.
    leaked = find_plain_emails(payload)
    if leaked:
        _log_pii_leak(kind, leaked)

    await db[COLLECTION].insert_one(payload)
    return doc.event_id


# ─────────────────────────────────────────────────────────────────────────────
# GOBIERNO DE ACCESO Y FORMA (FASE 0.9)
#
# `identity_events` es append-only: no se corrige, se acumula. Eso convierte la
# HIGIENE EN EL MOMENTO DE LA ESCRITURA en la única defensa disponible: una
# vez insertado, un evento no se puede quitar ni reescribir.
#
# Estrategia: NORMALIZAR en lugar de RECHAZAR.
#   · Clave prohibida      → se elimina y se avisa (el evento se conserva)
#   · Clave fuera de lista → se elimina y se avisa
#   · Valor demasiado largo→ se trunca y se marca
#   · Documento patológico→ se rechaza (inalcanzable en la práctica)
#
# Se prefiere perder exactitud a perder el registro: una auditoría con huecos
# es peor que una auditoría con un valor recortado. Solo se rechaza cuando el
# documento sigue siendo irrecuperablemente grande tras truncar.
# ─────────────────────────────────────────────────────────────────────────────

# Claves que NUNCA pueden almacenarse, a ninguna profundidad. Un nombre de clave
# no es una barrera de seguridad por sí solo, pero evita el accidente — que es
# el caso real: alguien pasa `password_hash` en metadata sin pensarlo.
FORBIDDEN_KEYS: frozenset = frozenset({
    "password", "password_hash", "passwd", "secret", "token",
    "access_token", "refresh_token", "session_token", "bearer",
    "authorization", "auth", "api_key", "apikey", "private_key",
    "credential", "credentials", "cookie", "cookies", "otp", "mfa_secret",
    "provider_user_id", "sub",  # identidad federada: no se audita (R-11)
})

# `metadata` es el único campo realmente libre. Allowlist estricta: todo lo demás
# se descarta. En producción NUNCA se ha usado, así que el coste es cero.
ALLOWED_METADATA_KEYS: frozenset = frozenset({
    "environment", "client", "client_version", "app_version",
    "correlation_id", "duration_ms", "server_region", "trace_id",
    "ip", "user_agent",  # PII adyacente: ver R-14 en el informe
})

MAX_DOCUMENT_BYTES = 16 * 1024      # 16 KB por evento
MAX_STRING_LENGTH = 512              # por cadena
MAX_LIST_ITEMS = 50                  # por lista
MAX_DICT_KEYS = 40                   # por diccionario
MAX_NESTING_DEPTH = 5                # niveles

TRUNCATION_SUFFIX = "…[truncated]"


class EventRejectedError(ValueError):
    """El evento viola el gobierno de la capa y no se escribe."""


class EventTooLargeError(EventRejectedError):
    """El documento supera `MAX_DOCUMENT_BYTES` incluso tras truncar."""


def _estimate_bytes(payload: Any) -> int:
    """
    Tamaño aproximado en bytes del documento.

    Se estima con JSON en vez de `bson.BSON.encode` para no depender del
    serializador. Es deliberadamente una APROXIMACIÓN: BSON puede ser algo
    mayor, y el límite lleva margen de sobra para que la diferencia no importe.
    """
    import json

    return len(json.dumps(payload, default=str, ensure_ascii=False).encode("utf-8"))


def strip_forbidden_keys(value: Any, dropped: Optional[List[str]] = None,
                         depth: int = 0) -> Any:
    """
    Elimina recursivamente las claves de `FORBIDDEN_KEYS`.

    No registra el VALOR descartado, solo el nombre de la clave: el valor suele
    ser precisamente el secreto que se quiere quitar.
    """
    if depth > MAX_NESTING_DEPTH:
        return value
    if isinstance(value, dict):
        limpio = {}
        for key, item in value.items():
            if str(key).lower() in FORBIDDEN_KEYS:
                (dropped if dropped is not None else []).append(str(key))
                continue
            limpio[key] = strip_forbidden_keys(item, dropped, depth + 1)
        return limpio
    if isinstance(value, (list, tuple)):
        return [strip_forbidden_keys(v, dropped, depth + 1) for v in value]
    return value


def enforce_limits(value: Any, depth: int = 0) -> Any:
    """
    Trunca lo que exceda los límites de forma y marca el recorte.

    Nunca lanza: recortar es preferible a perder el evento. El rechazo real
    ocurre más arriba, si el documento completo sigue siendo demasiado grande.
    """
    if depth > MAX_NESTING_DEPTH:
        return f"{TRUNCATION_SUFFIX}depth"
    if isinstance(value, str):
        if len(value) > MAX_STRING_LENGTH:
            return value[:MAX_STRING_LENGTH] + TRUNCATION_SUFFIX
        return value
    if isinstance(value, dict):
        items = list(value.items())[:MAX_DICT_KEYS]
        recortado = {
            k: enforce_limits(v, depth + 1) for k, v in items
        }
        if len(value) > MAX_DICT_KEYS:
            recortado["_truncated_keys"] = len(value) - MAX_DICT_KEYS
        return recortado
    if isinstance(value, (list, tuple)):
        items = list(value)[:MAX_LIST_ITEMS]
        recortado = [enforce_limits(v, depth + 1) for v in items]
        if len(value) > MAX_LIST_ITEMS:
            recortado.append(TRUNCATION_SUFFIX)
        return recortado
    return value


def filter_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deja en `metadata` solo las claves de la allowlist."""
    if not metadata:
        return {}
    return {
        key: value
        for key, value in metadata.items()
        if str(key).lower() in ALLOWED_METADATA_KEYS
    }

    """
    Avisa de una fuga residual sin volcar la PII al log.

    Deliberadamente NO registra los correos encontrados: el log suele ser más
    accesible que la base (CI, agregadores) y sería un segundo vector de fuga.
    """
    import logging

    logging.getLogger("punto_cero-api.identity_audit").error(
        "identity_audit_pii_leak event_type=%s count=%d", event_type, len(leaked)
    )


# ─────────────────────────────────────────────────────────────────────────────
# Lectura (interno / verificación). Sin endpoint público.
# ─────────────────────────────────────────────────────────────────────────────

async def list_events(
    db,
    *,
    event_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Lectura por orden temporal. SOLO para verificación y herramientas internas.

    Sin endpoint HTTP a propósito: publicar la auditoría exigiría su propia
    fase con su propia autorización.
    """
    capped = max(1, min(int(limit or 100), 1000))
    query: Dict[str, Any] = {}
    if event_type:
        query["event_type"] = event_type
    if entity_id:
        query["entity_id"] = entity_id
    cursor = db[COLLECTION].find(query).sort("occurred_at", 1).limit(capped)
    return await cursor.to_list(length=capped)


async def count_events(db, *, event_type: Optional[str] = None) -> int:
    query = {"event_type": event_type} if event_type else {}
    return await db[COLLECTION].count_documents(query)


# ─────────────────────────────────────────────────────────────────────────────
# Emisores tipados (FASE 0.7 · OBJETIVO 2)
#
# "evento ≠ decisión": cada emisor REGISTRA un hecho ya ocurrido. Ninguno
# decide, enlaza, resuelve ni bloquea. Todos delegan en `record_event`, que es
# la única operación de escritura de la capa.
#
# Cada emisor fija su `event_type`, de modo que ningún punto de integración
# pueda emitir un tipo arbitrario por error de tipografía.
# ─────────────────────────────────────────────────────────────────────────────

async def emit_identity_created(
    db, *, source: Optional[str] = None, entity_id: Optional[str] = None,
    profile_reference: Optional[str] = None, actor: Optional[str] = None,
    request_id: Optional[str] = None, **rest,
) -> str:
    """Una identidad canónica nueva acaba de ser creada."""
    return await record_event(
        db, "identity.created", source=source, entity_id=entity_id,
        profile_reference=profile_reference, actor=actor,
        request_id=request_id, **rest,
    )


async def emit_profile_link_requested(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """El usuario ha pedido enlazar una credencial a un perfil existente."""
    return await record_event(
        db, "profile.link_requested", source=source,
        profile_reference=profile_reference, actor=actor,
        request_id=request_id, **rest,
    )


async def emit_profile_linked(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """El enlace se ha materializado tras superar las comprobaciones."""
    return await record_event(
        db, "profile.linked", source=source, profile_reference=profile_reference,
        actor=actor, request_id=request_id, **rest,
    )


async def emit_profile_link_rejected(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """El enlace se ha rechazado. La decisión ya la tomó otro, antes."""
    return await record_event(
        db, "profile.link_rejected", source=source,
        profile_reference=profile_reference, actor=actor,
        request_id=request_id, **rest,
    )


async def emit_email_collision(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """Se ha detectado una coincidencia de email. Detectar NO es resolver."""
    return await record_event(
        db, "email_collision.detected", source=source,
        profile_reference=profile_reference, actor=actor,
        request_id=request_id, **rest,
    )


async def emit_identity_conflict(
    db, *, source: Optional[str] = None, entity_id: Optional[str] = None,
    profile_reference: Optional[str] = None, actor: Optional[str] = None,
    request_id: Optional[str] = None, **rest,
) -> str:
    """Un conflicto de identidad canónica se ha abierto y queda en revisión."""
    return await record_event(
        db, "identity.conflict.created", source=source, entity_id=entity_id,
        profile_reference=profile_reference, actor=actor,
        request_id=request_id, **rest,
    )


async def emit_provider_attached(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """Un proveedor se ha enlazado a un perfil."""
    return await record_event(
        db, "provider.attached", source=source, profile_reference=profile_reference,
        actor=actor, request_id=request_id, **rest,
    )


async def emit_provider_detached(
    db, *, source: Optional[str] = None, profile_reference: Optional[str] = None,
    actor: Optional[str] = None, request_id: Optional[str] = None, **rest,
) -> str:
    """Un proveedor se ha desenlazado de un perfil."""
    return await record_event(
        db, "provider.detached", source=source, profile_reference=profile_reference,
        actor=actor, request_id=request_id, **rest,
    )


# Mapa emisor → tipo. Permite verificar cobertura por introspección.
EMITTERS = {
    "identity.created": emit_identity_created,
    "profile.link_requested": emit_profile_link_requested,
    "profile.linked": emit_profile_linked,
    "profile.link_rejected": emit_profile_link_rejected,
    "email_collision.detected": emit_email_collision,
    "identity.conflict.created": emit_identity_conflict,
    "provider.attached": emit_provider_attached,
    "provider.detached": emit_provider_detached,
}


# ─────────────────────────────────────────────────────────────────────────────
# Observabilidad del gobierno (nunca escribe PII)
# ─────────────────────────────────────────────────────────────────────────────

def _log_pii_leak(event_type: str, leaked: List[str]) -> None:
    """
    Avisa de una fuga residual de correo sin volcar la PII al log.

    Deliberadamente NO registra los correos encontrados: el log suele ser más
    accesible que la base (CI, agregadores) y sería un segundo vector de fuga.
    """
    logger.error(
        "identity_audit_pii_leak event_type=%s count=%d", event_type, len(leaked)
    )


def _log_governance(event_type: str, action: str, detail: Optional[dict] = None) -> None:
    """
    Avisa de una acción del tubo de gobierno (FASE 0.9).

    Registra QUÉ se descartó y POR QUÉ, nunca el valor descartado: en el caso de
    `forbidden_keys_dropped`, el valor es justamente el secreto que se elimina.
    """
    logger.warning(
        "identity_audit_governance event_type=%s action=%s detail=%s",
        event_type, action, detail or {},
    )
