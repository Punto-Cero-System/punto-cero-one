"""Content classifier — heuristic country/vertical/language detection.

The RSS source already tells us country/vertical/language most of the time,
so this module is mainly here to (a) refine when a source is regional and
(b) tag items with additional signals (verticals detected by keywords).

Kept intentionally cheap — no external ML, no LLM calls. Deterministic.
"""
from __future__ import annotations

import re
from typing import Iterable

# Very small keyword dictionaries. Extend as new content patterns appear.
_VERTICAL_HINTS: dict[str, tuple[str, ...]] = {
    "legal": ("legal", "justicia", "juzgado", "abogad", "corte", "tribunal",
              "ley", "decreto", "constitucional"),
    "health": ("salud", "medic", "hospital", "clínic", "enfermedad", "vacun",
               "pandemia", "psic"),
    "contabilidad": ("contabilidad", "contabl", "impuest", "fisc", "tributari",
                     "auditor", "reforma tribut"),
    "capital": ("inversión", "capital", "fondo", "venture", "startup", "ronda",
                "financia", "bursátil", "bolsa"),
    "empleos": ("empleo", "trabajo", "vacante", "contratación", "desemple",
                "recursos humanos", "carrera"),
    "tecnologia": ("tecnología", "software", "ia ", " ai ", "algoritmo",
                   "digital", "plataforma", "app "),
    "eventos": ("evento", "conferencia", "cumbre", "foro", "congreso"),
}

# City lookups are country-specific. We only need well-known capitals + hubs.
_CITY_HINTS: dict[str, tuple[str, ...]] = {
    "AR": ("Buenos Aires", "Córdoba", "Rosario", "Mendoza"),
    "BR": ("São Paulo", "Rio de Janeiro", "Brasília", "Belo Horizonte"),
    "CL": ("Santiago", "Valparaíso", "Concepción"),
    "CO": ("Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"),
    "MX": ("Ciudad de México", "Guadalajara", "Monterrey", "Puebla"),
    "PE": ("Lima", "Arequipa", "Cusco"),
    "UY": ("Montevideo", "Punta del Este"),
    "VE": ("Caracas", "Maracaibo", "Valencia"),
    "ES": ("Madrid", "Barcelona", "Sevilla", "Valencia"),
}


def _lower_words(text: str) -> str:
    return (text or "").lower()


def detect_verticals(text_bits: Iterable[str]) -> list[str]:
    """Return the list of verticals suggested by the title+summary."""
    joined = " ".join([_lower_words(t) for t in text_bits if t])
    hits: list[str] = []
    for vertical, keywords in _VERTICAL_HINTS.items():
        for kw in keywords:
            if kw in joined:
                hits.append(vertical)
                break
    return hits


def detect_city(country: str, text_bits: Iterable[str]) -> str | None:
    if not country:
        return None
    candidates = _CITY_HINTS.get(country.upper()) or ()
    joined = " ".join([t or "" for t in text_bits if t])
    for city in candidates:
        if re.search(rf"\b{re.escape(city)}\b", joined, flags=re.IGNORECASE):
            return city
    return None


def priority(source: dict, hits_verticals: list[str]) -> int:
    """Simple priority: country-specific + vertical-tagged sources score higher."""
    score = 10
    if source.get("country") not in ("LATAM", "GLOBAL", None):
        score += 5
    if source.get("vertical") not in ("general", None):
        score += 3
    score += min(len(hits_verticals), 3)
    return score
