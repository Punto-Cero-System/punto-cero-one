"""Access Bridge — capa de intención de acceso hacia el Core único (FASES 1+6).

- NO autentica usuarios. NO crea JWT. NO reemplaza auth actual.
- Genera intención de acceso (assertion preparatoria) + códigos temporales
  en memoria con TTL + registro de eventos en memoria.
- FASE 7 (token exchange real con Legal) queda EXPLÍCITAMENTE FUERA:
  este módulo no llama a ningún Core, no hace HTTP, no persiste en Mongo.
"""
from __future__ import annotations

import secrets
import time
from typing import Any, Dict, List, Optional

from .workspace_registry import get_space, CORE_OPERATIVO_UNICO
from .policy_can import can
from .system_identity import is_valid_entity_id

INTENT_TTL_SECONDS = 300  # 5 minutos
MAX_INTENTS = 500

_intents: Dict[str, Dict[str, Any]] = {}
_events: List[Dict[str, Any]] = []


def _now() -> float:
    return time.time()


def _prune() -> None:
    expired = [k for k, v in _intents.items() if v.get("expires_at", 0) <= _now()]
    for k in expired:
        _intents.pop(k, None)
    while len(_intents) > MAX_INTENTS:
        oldest = min(_intents, key=lambda k: _intents[k].get("created_at", 0))
        _intents.pop(oldest, None)


def _log_event(kind: str, payload: Dict[str, Any]) -> None:
    _events.append({"kind": kind, "at": _now(), **payload})
    if len(_events) > 1000:
        del _events[: len(_events) - 1000]


def create_access_intent(
    *,
    subject_id: str,
    space_key: str,
    entitlements: List[str],
    entry_host: Optional[str] = None,
) -> Dict[str, Any]:
    """Prepara la intención de acceso a un espacio del Workspace Universal.

    Valida con can(): sin entitlement -> deny (no se emite código).
    Retorna {intent_code, space, core_id, expires_in} o lanza ValueError.
    """
    if not is_valid_entity_id(subject_id):
        # Fail-closed (FASE 1.2): sin `entity_id` canonico valido no hay sujeto.
        # Cubre None, "", "anonymous" y email. Reutiliza PermissionError -> 403.
        raise PermissionError("invalid_subject")

    space = get_space(space_key)
    if not space:
        raise ValueError(f"unknown_space:{space_key}")
    if space.get("core_id") != CORE_OPERATIVO_UNICO:
        raise ValueError("forbidden_core")
    subject = {"id": subject_id, "entitlements": list(entitlements or [])}
    # El intent puede prepararse para espacios declared (preview) pero el
    # guard de apertura real sigue siendo can() en el router de entrada.
    decision = can(subject, space.get("permission", ""), {"allow_non_live": True})
    if decision != "allow":
        _log_event("intent_denied", {"subject_id": subject_id, "space_key": space_key})
        raise PermissionError("denied")

    _prune()
    code = secrets.token_urlsafe(24)
    record = {
        "intent_code": code,
        "subject_id": subject_id,
        "space_key": space_key,
        "core_id": CORE_OPERATIVO_UNICO,
        "entry_host": entry_host,
        "created_at": _now(),
        "expires_at": _now() + INTENT_TTL_SECONDS,
    }
    _intents[code] = record
    _log_event("intent_created", {"subject_id": subject_id, "space_key": space_key})
    return {
        "intent_code": code,
        "space_key": space_key,
        "core_id": CORE_OPERATIVO_UNICO,
        "route": space.get("route"),
        "expires_in": INTENT_TTL_SECONDS,
    }


def consume_intent(intent_code: str) -> Optional[Dict[str, Any]]:
    """Valida un intent de un solo uso. Retorna el record o None si inválido."""
    _prune()
    record = _intents.pop(intent_code, None)
    if not record:
        return None
    _log_event("intent_consumed", {"subject_id": record.get("subject_id"), "space_key": record.get("space_key")})
    return record


def recent_events(limit: int = 50) -> List[Dict[str, Any]]:
    return [dict(e) for e in _events[-max(1, min(limit, 200)):]]
