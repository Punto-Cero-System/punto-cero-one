"""Identity Core V1 — resolución de identidad de solo lectura (FASE 13.1).

Diseño: IDENTITY_CORE_ARCHITECTURE_V1.md. Resuelve la identidad Punto Cero
System a partir de las DOS sesiones existentes sin modificarlas:
  - Sesión A (JWT sistema)   → auth.get_current_user (Authorization: Bearer)
  - Sesión B (comunidad One) → services.community_deps (cookie session_token)
Lectura pura: no emite tokens, no muta sesiones ni colecciones.
`account_type`, verticales y espacios se CALCULAN; nada se almacena.

Casos (regla de negocio F13.1):
  1 solo JWT        → contexto JWT (unified=False)
  2 solo comunidad  → contexto comunidad (unified=False)
  3 ambas, mismo id → unified=True, sources=[jwt, community]
  4 ambas, distinto → IdentityConflictError → endpoint responde 409
  5 ninguna         → el endpoint responde 401
"""
from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Optional, Tuple

# Espejo del catálogo frontend `frontend/src/config/workspaceSpaces.js`
# (única fuente de verdad de navegación). Nota de mapeo: el nombre comercial
# "Punto Cero One" corresponde a la key frontend `comunidad` (status external).
#
# ESTE ES EL CUARTO CATALOGO. `ONE-SYSTEM-BOUNDARY.md` §2.bis declara que el
# mismo catálogo de espacios está escrito cuatro veces: aquí, en
# `services/workspace_registry.py` (la AUTORIDAD) y en dos catálogos del
# frontend. Los cuatro congelan su estado real en
# `docs/architecture/workspace_registry.contract.json`.
#
# NO es la autoridad y no debe aspirar a serlo: `workspace_registry.py` es quien
# concede permisos. Este espejo alimenta `compute_workspaces()`, que solo pinta
# el selector de navegación.
#
# Pendientes:
#   - F13.2: evaluar migrar el catálogo completo al backend y deprecar el JS.
#
# HECHO (D2.2-B.3-B): el test de contrato que esta nota pedia desde hace tiempo
# ya existe, en `backend/tests/test_workspace_registry_contract.py`. No obliga a
# que los status coincidan con el backend —no coinciden, y decidir eso es D2.2—
# sino que este espejo siga siendo un espejo: sin keys huérfanas, con las mismas
# keys que `workspaceSpaces.js`, y sin colar vocabulario de lifecycle
# (`live`/`declared`…) donde solo tiene sentido el de navegación
# (`available`/`coming_soon`/`external`).
SPACE_CATALOG: List[Dict[str, Any]] = [
    {"key": "legal", "label": "Punto Cero Legal", "status": "available", "vertical": "legal"},
    {"key": "medical", "label": "Punto Cero Medical", "status": "coming_soon", "vertical": "health"},
    {"key": "empresa", "label": "Punto Cero Empresa", "status": "coming_soon", "vertical": "empresa"},
    {"key": "comunidad", "label": "Punto Cero One", "status": "external", "vertical": "one"},
]
_AVAILABLE_STATUSES = {"available", "external"}
_PROFESSIONAL_VERTICALS = {"legal", "medical", "empresa"}

# Mismas señales que la heurística del Gateway (WorkspaceGatewayPage.jsx),
# normalizadas sin acentos. Orden = prioridad de recomendación.
_VERTICAL_RULES: List[Tuple[str, Tuple[str, ...]]] = [
    ("legal", ("legal", "abogad", "derecho", "juridic", "lawyer", "attorney")),
    ("medical", ("salud", "medic", "health", "clinica", "hospital", "doctor", "enfermer")),
    ("empresa", ("empresa", "negocio", "business", "company", "organizacion", "contabilidad", "accounting")),
    ("comunidad", ("one", "comunidad", "community", "miembro", "member")),
]


class IdentityConflictError(Exception):
    """Caso 4: sesión A y sesión B apuntan a usuarios distintos."""

    def __init__(self, jwt_user_id: Optional[str], community_user_id: Optional[str]):
        self.jwt_user_id = jwt_user_id
        self.community_user_id = community_user_id
        super().__init__("identity_conflict")


def _norm(value: Any) -> str:
    text = str(value) if value is not None else ""
    return (
        unicodedata.normalize("NFKD", text)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
        .strip()
    )


def _text_tokens(value: Any) -> List[str]:
    """Normaliza str / lista de str / lista de dicts (key|value|name|label)."""
    out: List[str] = []
    if isinstance(value, dict):
        value = [value]
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                out.append(_norm(item))
            elif isinstance(item, dict):
                for key in ("key", "value", "name", "label"):
                    if item.get(key):
                        out.append(_norm(item[key]))
                        break
    elif isinstance(value, str):
        out.append(_norm(value))
    return [t for t in out if t]


def _match_keys(tokens: List[str]) -> List[str]:
    joined = " | ".join(tokens)
    out: List[str] = []
    for key, needles in _VERTICAL_RULES:
        if key not in out and any(needle in joined for needle in needles):
            out.append(key)
    return out


def extract_verticals(user: Dict[str, Any]) -> Tuple[List[str], Optional[str]]:
    """Verticales calculadas. Prioridad 1: campo `verticals` del usuario.
    Prioridad 2: texto de perfil (specialties, skills, interests, headline,
    bio, current_title, current_company). Devuelve (claves, origen)."""
    direct = _match_keys(_text_tokens(user.get("verticals")))
    if direct:
        return direct, "verticals"
    profile: List[str] = []
    for field in ("specialties", "skills", "interests"):
        profile.extend(_text_tokens(user.get(field)))
    profile.extend(_text_tokens([user.get(f) for f in ("headline", "bio", "current_title", "current_company")]))
    matched = _match_keys(profile)
    if matched:
        return matched, "profile"
    return [], None


def compute_account_type(organizations: List[Dict[str, Any]], verticals: List[str]) -> str:
    """Derivado, NUNCA almacenado (decisión de diseño V1).

    Semántica F13.1.1: describe la NATURALEZA de la persona, no su
    pertenencia. Un profesional con vertical activa es "profesional" aunque
    sea owner/miembro de una firma (la relación queda en organizations[]).
    "empresa" solo si no hay vertical profesional propia pero sí organización.
    """
    if any(v in _PROFESSIONAL_VERTICALS for v in verticals):
        return "profesional"
    if organizations:
        return "empresa"
    return "personal"


def _public_user(user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Proyección segura del usuario (sin password_hash ni datos sensibles).

    D1 — SYSTEM CORE HARDENING: `status` viaja aquí A PROPÓSITO.

    Antes esta proyección lo descartaba, y `entitlement_service.entitlements_for_identity`
    lee justamente `user["status"]` para aplicar el corte fail-closed. Con el
    campo ausente, el estado llegaba como `None` → normalizado a "activo" → un
    usuario `suspendido` recibía `workspace.open.comunidad` al recorrer la
    cadena pública de este módulo. El corte ya existía y era correcto: faltaba
    el dato. Es la misma clase de fallo que la brecha D1 original del Bridge
    (la política existía, el dato se perdía en la frontera), en el otro sentido.

    No es un dato sensible: describe la cuenta del propio solicitante, que ya
    puede leer en `/api/auth/me`, y no revela nada de terceros. Mantenerlo aquí
    permite además que la UI refleje la suspensión en vez de ofrecer espacios
    que el backend le va a negar en la llamada siguiente.

    Ausencia del campo en `users` (usuarios preexistentes) se sigue proyectando
    como `None`: cada consumidor mantiene su compatibilidad "ausente → activo",
    así que ningún usuario anterior pierde acceso.
    """
    if not user:
        return {}
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "status": user.get("status"),
    }


async def resolve_organizations(db, user_id: Optional[str]) -> List[Dict[str, Any]]:
    """Empresas donde el usuario es owner o team member (solo lectura).

    Resuelve la relación Usuario → Empresa desde `companies.owner_id` y
    `companies.team[].user_id` (única fuente existente hoy). No crea ni
    modifica documentos de empresas.
    """
    if not user_id:
        return []
    cursor = db.companies.find(
        {"$or": [{"owner_id": user_id}, {"team.user_id": user_id}]},
        {"id": 1, "name": 1, "vertical": 1, "owner_id": 1, "team": 1, "_id": 0},
    )
    out: List[Dict[str, Any]] = []
    async for company in cursor:
        is_owner = company.get("owner_id") == user_id
        role = "owner"
        if not is_owner:
            role = "member"
            for member in company.get("team") or []:
                if member.get("user_id") == user_id:
                    role = member.get("role") or "member"
                    break
        out.append(
            {
                "company_id": company.get("id"),
                "name": company.get("name"),
                "vertical": company.get("vertical"),
                "relation": "owner" if is_owner else "member",
                "role": role,
            }
        )
    return out


def compute_workspaces(
    verticals: List[str],
    account_type: str,
    organizations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Espacios derivados del catálogo compartido (workspaceSpaces.js).

    Prioridad de recomendación F13.1.1: verticales del usuario (profesional)
    → organización (empresa) → default personal (One/comunidad). Las claves
    de vertical coinciden con las keys del catálogo por diseño.
    """
    available = [s for s in SPACE_CATALOG if s["status"] in _AVAILABLE_STATUSES]
    coming_soon = [s for s in SPACE_CATALOG if s["status"] not in _AVAILABLE_STATUSES]
    recommended: Optional[str] = None
    reason: Optional[str] = None
    for vertical in verticals:
        recommended, reason = vertical, "verticals"
        break
    if recommended is None and account_type == "empresa" and organizations:
        recommended, reason = "empresa", "organizations"
    if recommended is None:
        recommended, reason = "comunidad", "default_personal"
    return {
        "available": [{"key": s["key"], "label": s["label"]} for s in available],
        "coming_soon": [{"key": s["key"], "label": s["label"]} for s in coming_soon],
        "recommended": recommended,
        "recommended_reason": reason,
    }


async def resolve_identity(
    db,
    jwt_user: Optional[Dict[str, Any]] = None,
    community_user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Núcleo de F13.1: identidad unificada de SOLO LECTURA.

    Casos:
      1 solo JWT        → contexto JWT (unified=False)
      2 solo comunidad  → contexto comunidad (unified=False)
      3 ambos mismo id  → unified=True, sources=[jwt, community]
      4 ambos distinto  → IdentityConflictError (endpoint → 409)
    (caso 5, sin identidad, lo resuelve el endpoint con 401.)
    """
    jwt_id = (jwt_user or {}).get("id")
    community_id = (community_user or {}).get("id")
    if jwt_id and community_id and jwt_id != community_id:
        raise IdentityConflictError(jwt_user_id=jwt_id, community_user_id=community_id)

    # CONCEPTO 2 (ADR-IDENT-001): esto son Or?genes de SESION, no "source"
    # de identidad. `source` nombra al Sistema propietario del external_id y
    # vive en system_identity. Renombrado para que los dos conceptos nunca
    # vuelvan a confundirse.
    session_sources: List[str] = []
    session_sources.append("jwt")
    session_sources.append("community")

    base = jwt_user or community_user or {}
    verticals, verticals_source = extract_verticals(base)
    organizations = await resolve_organizations(db, jwt_id or community_id)
    account_type = compute_account_type(organizations, verticals)
    return {
        "user": _public_user(base),
        "session": {
            # La clave publica sigue siendo "sources" para no romper el
            # contrato HTTP; el concepto ya esta separado en el nombre local.
            "sources": session_sources,
        },
        "identity": {
            "account_type": account_type,
            "verticals": verticals,
            "verticals_source": verticals_source,
            "primary_vertical": verticals[0] if verticals else None,
            "profile_ref": "/api/profile/me",
        },
        "organizations": organizations,
        "workspaces": compute_workspaces(verticals, account_type, organizations),
    }
