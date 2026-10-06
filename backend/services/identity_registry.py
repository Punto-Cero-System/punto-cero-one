"""
Identity Registry — autoridad del vocabulario `source` (ADR-IDENT-002).

QUÉ ES
    Un catálogo en memoria de los Sistemas admitidos. NO es un almacén de
    identidades: no guarda Entidades, Perfiles ni Personas. Solo responde
    "¿qué Sistemas existen y qué token nombra a cada uno?".

POR QUÉ EXISTE
    Antes de ADR-IDENT-002 el vocabulario vivía como una tupla literal
    (`ALLOWED_SOURCES`) dentro de `system_identity.py`. Esa tupla era a la vez
    definición y autoridad, y por eso no podía gobernarse. Aquí la autoridad
    queda en un objeto único, con lectura explícita.

REGLAS QUE ENCIERRA (ADR-IDENT-002)
    · Un token identifica UN Sistema. Nunca dos.
    · Un token no registrado NO es un Sistema.
    · El significado de un token es inmutable; cambiarlo crea un Sistema nuevo.
    · El canal de autenticación, la Vertical y el Proveedor NUNCA son tokens.

ALCANCE DE ESTA FASE
    · Sin persistencia. Sin MongoDB. Sin lógica de negocio.
    · La proyección en `system_identity.py` valida REGISTRO, no ESTADO: la
      aplicación del ciclo de vida corresponde a una fase posterior.

VINCULACIÓN CON EL ESTADO REAL (auditoría Fase 1.5B)
    Los cuatro escritores de `users.id` —`server.py:317`,
    `community_auth_routes.py:448,749` y `investor_routes.py:203`—
    pertenecen al MISMO proceso y al MISMO namespace. Por el Test del Espacio
    de Nombres (ADR-IDENT-002 §1.2) existe UN (1) Sistema, no dos. Los tokens
    históricos `community` y `workspace` nombraban SUPERFICIES (cookie y JWT
    respectivamente), no Sistemas; se conservan como entradas provisionales
    para no invalidar ninguna referencia existente.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Ciclo de vida del Sistema (ADR-IDENT-002 §4.1)
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_STATE_ALTA = "alta"
SYSTEM_STATE_ACTIVACION = "activacion"
SYSTEM_STATE_SUSPENSION = "suspension"
SYSTEM_STATE_OBSOLETO = "obsoleto"
SYSTEM_STATE_RETIRO = "retiro"
SYSTEM_STATE_ARCHIVADO = "archivado"
SYSTEM_STATE_PROHIBIDO = "prohibido"
SYSTEM_STATE_DEPRECATED = "deprecated"
SYSTEM_STATE_RETIRED = "retired"
SYSTEM_STATE_COMPATIBILITY_ONLY = "compatibility_only"

SYSTEM_STATES = (
    SYSTEM_STATE_ALTA,
    SYSTEM_STATE_ACTIVACION,
    SYSTEM_STATE_SUSPENSION,
    SYSTEM_STATE_OBSOLETO,
    SYSTEM_STATE_RETIRO,
    SYSTEM_STATE_ARCHIVADO,
    SYSTEM_STATE_PROHIBIDO,
    SYSTEM_STATE_DEPRECATED,
    SYSTEM_STATE_RETIRED,
    SYSTEM_STATE_COMPATIBILITY_ONLY,
)

# Estados terminales: sin transición de salida (ADR-IDENT-002 §4.3).
SYSTEM_TERMINAL_STATES = (SYSTEM_STATE_ARCHIVADO, SYSTEM_STATE_PROHIBIDO)

# Estados que AUTORIZAN emitir external_id nuevo.
# Lista blanca, no negra: un estado que no figure aqui BLOQUEA la emision
# (fail-closed). Un token retirado sigue siendo legible por compatibilidad.
EMISSION_ALLOWED_STATES = (SYSTEM_STATE_ACTIVACION, SYSTEM_STATE_ALTA)

# ─────────────────────────────────────────────────────────────────────────────
# Madurez de la entrada (ADR-IDENT-002 §3.3)
# `provisional` = declarada, pendiente de re-anclado al Sistema propietario.
# `activo`      = registrada y alineada con el Test del Espacio de Nombres.
# ─────────────────────────────────────────────────────────────────────────────
MATURITY_PROVISIONAL = "provisional"
MATURITY_ACTIVO = "activo"



# ────────────────────────────────────────────────────────────────────────────
# El Sistema propietario del namespace de `external_id`
# ────────────────────────────────────────────────────────────────────────────
OWNER_TOKEN = "punto_cero_system"

# ─────────────────────────────────────────────────────────────────────────────
# Catálogo de Sistemas
#
# Nueve atributos de ADR-IDENT-002 §3.1 más la madurez de §3.3. Los campos
# de fecha se dejan en None porque este catálogo no tiene historial: el
# versionado del vocabulario corresponde a la gobernanza, no al runtime.
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEMS: Dict[str, Dict[str, Any]] = {
    OWNER_TOKEN: {
        "token": OWNER_TOKEN,
        "emission_allowed": True,
        "deprecated": False,
        "canonical_name": "Punto Cero System",
        "description": (
            "Proceso que emite y posee el namespace de `external_id` (colección "
            "`users`). Única autoridad de emisión registrada en el ecosistema."
        ),
        "state": SYSTEM_STATE_ACTIVACION,
        "maturity": MATURITY_ACTIVO,
        "owner": "Punto Cero System",
        "created_at": None,
        "retired_at": None,
        "compatibility": (
            "Es el único emisor de `external_id`. No emite permisos, no es "
            "Vertical, no es Proveedor y no es Canal."
        ),
        "notes": (
            "Token re-anclado según ADR-IDENT-001: `source` designa al Sistema "
            "propietario del identificador, no al canal de autenticación."
        ),
    },
    "community": {
        "token": "community",
        "emission_allowed": False,
        "deprecated": True,
        "canonical_name": "Superficie Community (histórico)",
        "description": (
            "Designación histórica de la superficie de alta y de la sesión por "
            "cookie (`session_token`). No es un Sistema: no posee namespace."
        ),
        "state": SYSTEM_STATE_COMPATIBILITY_ONLY,
        "maturity": MATURITY_PROVISIONAL,
        "owner": "Punto Cero System",
        "created_at": None,
        "retired_at": None,
        "compatibility": (
            "Se conserva para no invalidar referencias históricas. No debe "
            "usarse como `source` de nuevos perfiles."
        ),
        "notes": "Superficie, no Sistema. Reemplazado por el token propietario.",
    },
    "workspace": {
        "token": "workspace",
        "emission_allowed": False,
        "deprecated": True,
        "canonical_name": "Canal JWT (histórico)",
        "description": (
            "Designación histórica del canal de autenticación por JWT "
            "(`Authorization: Bearer`). No es un Sistema: no posee namespace."
        ),
        "state": SYSTEM_STATE_COMPATIBILITY_ONLY,
        "maturity": MATURITY_PROVISIONAL,
        "owner": "Punto Cero System",
        "created_at": None,
        "retired_at": None,
        "compatibility": (
            "Se conserva para no invalidar referencias históricas. No debe "
            "usarse como `source` de nuevos perfiles."
        ),
        "notes": "Canal de autenticación, no Sistema. Reemplazado por el token propietario.",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Lectura
#
# Única superficie pública del Registry. No escribe, no decide, no persiste.
# ─────────────────────────────────────────────────────────────────────────────
def list_systems() -> List[Dict[str, Any]]:
    """Todos los Sistemas registrados, en orden de token."""
    return [dict(_SYSTEMS[token]) for token in sorted(_SYSTEMS)]


def get_system_by_token(token: Any) -> Optional[Dict[str, Any]]:
    """Devuelve la entrada del Sistema que `token` nombra, o None.

    La comparación es insensible a mayúsculas y espacios, igual que la
    normalización histórica de `system_identity._validate_source`.
    """
    value = str(token or "").strip().lower()
    entry = _SYSTEMS.get(value)
    return dict(entry) if entry else None


def get_system(canonical_name: str) -> Optional[Dict[str, Any]]:
    """Devuelve la entrada de un Sistema por su nombre canónico, o None."""
    target = str(canonical_name or "").strip().lower()
    for entry in _SYSTEMS.values():
        if str(entry["canonical_name"]).strip().lower() == target:
            return dict(entry)
    return None


def is_valid_system(token: Any) -> bool:
    """¿`token` nombra un Sistema registrado?

   .True = registrado. False = no es un Sistema, y por tanto no puede ser
    `source` (ADR-IDENT-002 INV-08).
    """
    return get_system_by_token(token) is not None


def can_emit(token: Any) -> bool:
    """
    Distingue "existe" de "puede emitir" (ADR-IDENT-002 RR-04/RR-05).

    Un token puede seguir LEYENDOSE por compatibilidad historica y, a la vez,
    tener la emision de "external_id" bloqueada porque su Sistema ya no es
    emisor. Regla de lista blanca: solo un estado en EMISSION_ALLOWED_STATES
    autoriza, y la entrada debe marcarlo explicitamente.
    """
    entry = get_system_by_token(token)
    if entry is None:
        return False
    if not entry.get("emission_allowed", False):
        return False
    return str(entry.get("state") or "") in EMISSION_ALLOWED_STATES


def is_emission_allowed(token: Any) -> bool:
    """Alias explicito de "can_emit" para leer el contrato."""
    return can_emit(token)


def list_tokens() -> List[str]:
    """Tokens registrados. Es la proyección que consume `system_identity`."""
    return sorted(_SYSTEMS)


def get_owner_token() -> str:
    """Token del Sistema propietario del namespace de `external_id`.

    Es el único token que `resolve_system_identity` debe usar para resolver
    un perfil: el canal de autenticación no participa (ADR-IDENT-001 L2).
    """
    return OWNER_TOKEN


def get_owner_system() -> Dict[str, Any]:
    """Entrada completa del Sistema propietario."""
    return get_system_by_token(OWNER_TOKEN) or {}

