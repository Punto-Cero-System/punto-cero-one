"""Growth Engine — canonical sources catalogue.

Each source is a *public* RSS feed. We list only feeds whose publishers
explicitly expose them for consumption (news outlets, government portals,
official blogs). We DO NOT scrape and we DO NOT store the full article —
just the metadata that RSS itself provides.

Country codes follow ISO 3166-1 alpha-2 for the 18 ecosystem targets, plus
the pseudo-codes ``LATAM`` (region-wide) and ``GLOBAL`` (rest of world).
"""
from __future__ import annotations

from typing import Iterable, Optional


# ISO 3166-1 alpha-2 for the 18 target markets.
COUNTRIES = [
    "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO",
    "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY",
    "PE", "UY", "VE", "ES",
]

# Human-readable labels
COUNTRY_LABELS = {
    "AR": "Argentina", "BO": "Bolivia", "BR": "Brasil", "CL": "Chile",
    "CO": "Colombia", "CR": "Costa Rica", "CU": "Cuba", "DO": "República Dominicana",
    "EC": "Ecuador", "SV": "El Salvador", "GT": "Guatemala", "HN": "Honduras",
    "MX": "México", "NI": "Nicaragua", "PA": "Panamá", "PY": "Paraguay",
    "PE": "Perú", "UY": "Uruguay", "VE": "Venezuela", "ES": "España",
    "LATAM": "Latinoamérica", "GLOBAL": "Global",
}


# Verticals — kept in sync with the ecosystem taxonomy.
VERTICALS = ["legal", "health", "contabilidad", "capital", "empleos",
             "tecnologia", "empresas", "eventos", "cultura", "general"]


# ---------------------------------------------------------------------------
# Sources catalogue
# ---------------------------------------------------------------------------
# Each entry:
#   id:       stable slug (kebab-case) — used for dedupe/idempotency
#   name:     human-readable outlet name (shown as post author)
#   url:      RSS feed URL
#   country:  ISO code (LATAM/GLOBAL allowed)
#   vertical: taxonomy key (see VERTICALS)
#   language: BCP-47 tag
#   category: additional label for tagging
#   enabled:  soft on/off default (can be overridden per-deployment in DB)
# ---------------------------------------------------------------------------
SOURCES = [
    # Regional & Global (fallback tier)
    {"id": "bbc-mundo", "name": "BBC Mundo", "url": "https://feeds.bbci.co.uk/mundo/rss.xml",
     "country": "LATAM", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "un-noticias", "name": "Noticias ONU",
     "url": "https://news.un.org/feed/subscribe/es/news/all/rss.xml",
     "country": "GLOBAL", "vertical": "general", "language": "es", "category": "Organismos", "enabled": True},

    # Argentina
    {"id": "ar-infobae", "name": "Infobae Argentina", "url": "https://www.infobae.com/argentina/rss.xml",
     "country": "AR", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "ar-boletinoficial", "name": "Boletín Oficial República Argentina",
     "url": "https://www.boletinoficial.gob.ar/edicion/rss?tipoEdicion=1",
     "country": "AR", "vertical": "instituciones", "language": "es", "category": "Gobierno", "enabled": True},
    {"id": "ar-bcra", "name": "BCRA — Banco Central Argentina",
     "url": "https://www.bcra.gob.ar/BCRAYVOS/Noticias.asp?rss=1",
     "country": "AR", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},

    # Bolivia
    {"id": "bo-eldeber", "name": "El Deber", "url": "https://eldeber.com.bo/feed",
     "country": "BO", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Brasil (portugués) — fuentes oficiales dados.gov.br + open finance
    {"id": "br-g1-mundo", "name": "G1 Mundo", "url": "https://g1.globo.com/rss/g1/mundo/",
     "country": "BR", "vertical": "general", "language": "pt", "category": "Actualidad", "enabled": True},
    {"id": "br-receita", "name": "Receita Federal",
     "url": "https://www.gov.br/receitafederal/pt-br/@@rss-noticias.xml",
     "country": "BR", "vertical": "instituciones", "language": "pt", "category": "Gobierno", "enabled": True},

    # Chile
    {"id": "cl-emol", "name": "Emol Nacional", "url": "https://www.emol.com/sitemap/noticias/rss/nacional.xml",
     "country": "CL", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "cl-bcentral", "name": "Banco Central de Chile",
     "url": "https://www.bcentral.cl/rss/comunicados-de-prensa",
     "country": "CL", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},

    # Colombia — grupos multimedia + institucionales públicos
    {"id": "co-eltiempo", "name": "El Tiempo", "url": "https://www.eltiempo.com/rss/colombia.xml",
     "country": "CO", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "co-larepublica", "name": "La República", "url": "https://www.larepublica.co/rss",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Negocios", "enabled": True},
    {"id": "co-portafolio", "name": "Portafolio",
     "url": "https://www.portafolio.co/arc/outboundfeeds/rss/",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Negocios", "enabled": True},
    {"id": "co-semana", "name": "Semana",
     "url": "https://www.semana.com/arc/outboundfeeds/rss/",
     "country": "CO", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "co-dinero", "name": "Dinero / Semana Negocios",
     "url": "https://www.semana.com/economia/rss/",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Negocios", "enabled": True},
    {"id": "co-mintic", "name": "MinTIC Colombia",
     "url": "https://www.mintic.gov.co/portal/inicio/Sala-de-prensa/Noticias/rss.xml",
     "country": "CO", "vertical": "tecnologia", "language": "es", "category": "Gobierno", "enabled": True},
    {"id": "co-supersociedades", "name": "SuperSociedades",
     "url": "https://www.supersociedades.gov.co/rss",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Regulador", "enabled": True},
    {"id": "co-ccb", "name": "Cámara de Comercio de Bogotá",
     "url": "https://www.ccb.org.co/es/rss.xml",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Cámaras", "enabled": True},
    {"id": "co-banrep", "name": "Banco de la República",
     "url": "https://www.banrep.gov.co/rss/es/noticias.xml",
     "country": "CO", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},
    {"id": "co-superfinanciera", "name": "Superintendencia Financiera",
     "url": "https://www.superfinanciera.gov.co/rss.xml",
     "country": "CO", "vertical": "instituciones", "language": "es", "category": "Regulador", "enabled": True},

    # Costa Rica
    {"id": "cr-nacion", "name": "La Nación (CR)", "url": "https://www.nacion.com/arc/outboundfeeds/rss/",
     "country": "CR", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Cuba
    {"id": "cu-cubadebate", "name": "Cubadebate", "url": "http://www.cubadebate.cu/feed/",
     "country": "CU", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # República Dominicana
    {"id": "do-diariolibre", "name": "Diario Libre", "url": "https://www.diariolibre.com/rss.xml",
     "country": "DO", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Ecuador
    {"id": "ec-eluniverso", "name": "El Universo", "url": "https://www.eluniverso.com/arc/outboundfeeds/rss/",
     "country": "EC", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # El Salvador
    {"id": "sv-laprensagrafica", "name": "La Prensa Gráfica", "url": "https://www.laprensagrafica.com/rss",
     "country": "SV", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Guatemala
    {"id": "gt-prensalibre", "name": "Prensa Libre",
     "url": "https://www.prensalibre.com/feed/",
     "country": "GT", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Honduras
    {"id": "hn-laprensa", "name": "La Prensa (HN)", "url": "https://www.laprensa.hn/rss/",
     "country": "HN", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # México — prensa + Banxico oficial
    {"id": "mx-eluniversal", "name": "El Universal", "url": "https://www.eluniversal.com.mx/rss.xml",
     "country": "MX", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "mx-jornada", "name": "La Jornada", "url": "https://www.jornada.com.mx/rss/edicion.xml",
     "country": "MX", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "mx-banxico", "name": "Banxico — Banco de México",
     "url": "https://www.banxico.org.mx/rss/es/rss-comunicados.xml",
     "country": "MX", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},

    # Nicaragua
    {"id": "ni-laprensa", "name": "La Prensa (NI)", "url": "https://www.laprensani.com/feed",
     "country": "NI", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Panamá
    {"id": "pa-laprensa", "name": "La Prensa (PA)", "url": "https://www.prensa.com/arc/outboundfeeds/rss/",
     "country": "PA", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Paraguay
    {"id": "py-abc", "name": "ABC Color", "url": "https://www.abc.com.py/rss.xml",
     "country": "PY", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Perú — prensa + BCRP + SUNAT oficial
    {"id": "pe-elcomercio", "name": "El Comercio", "url": "https://elcomercio.pe/arc/outboundfeeds/rss/",
     "country": "PE", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "pe-bcrp", "name": "BCRP — Banco Central de Reserva del Perú",
     "url": "https://www.bcrp.gob.pe/rss/notas-informativas.xml",
     "country": "PE", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},

    # Uruguay
    {"id": "uy-elobservador", "name": "El Observador", "url": "https://www.elobservador.com.uy/rss.html",
     "country": "UY", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # Venezuela
    {"id": "ve-eluniversal", "name": "El Universal (VE)", "url": "https://www.eluniversal.com/rss.xml",
     "country": "VE", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},

    # España — prensa + BOE + Banco de España
    {"id": "es-elpais", "name": "El País", "url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
     "country": "ES", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "es-elmundo", "name": "El Mundo",
     "url": "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml",
     "country": "ES", "vertical": "general", "language": "es", "category": "Actualidad", "enabled": True},
    {"id": "es-bde", "name": "Banco de España — Notas informativas",
     "url": "https://www.bde.es/webbe/es/rss/notas-informativas.xml",
     "country": "ES", "vertical": "empresas", "language": "es", "category": "Banca Central", "enabled": True},

    # Vertical-specific
    {"id": "hn-legal-boletin", "name": "Diario Oficial · LATAM Legal",
     "url": "https://www.boe.es/rss/boe.php",
     "country": "ES", "vertical": "legal", "language": "es", "category": "Boletín Oficial", "enabled": True},
]


def get_source(source_id: str) -> Optional[dict]:
    for s in SOURCES:
        if s["id"] == source_id:
            return s
    return None


def sources_by_country(country: Optional[str]) -> list[dict]:
    if not country:
        return list(SOURCES)
    c = country.upper()
    return [s for s in SOURCES if s["country"] == c]


def merge_with_overrides(overrides: Iterable[dict]) -> list[dict]:
    """Apply DB-level enable/disable to the static catalogue."""
    ov = {o["source_id"]: o for o in overrides or []}
    result = []
    for s in SOURCES:
        override = ov.get(s["id"])
        if override:
            merged = {**s, "enabled": bool(override.get("enabled", s["enabled"]))}
        else:
            merged = dict(s)
        result.append(merged)
    return result
