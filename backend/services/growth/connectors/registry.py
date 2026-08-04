"""Country registry — 18 LATAM countries + ES.

Each entry is either an active connector (auto-runs on every scheduler tick
if it has hit its TTL) or a **prepared stub** with `requires_credentials=True`
whose only job is to advertise which env vars unlock it. All follow the same
`PublicDataConnector` interface, so the Sources Center + admin dashboard show
them all uniformly.
"""
from __future__ import annotations

from . import PublicDataConnector
from .ckan import CKANConnector


class RequiresCredentialsStub(PublicDataConnector):
    """Placeholder connector — no code path fires until env vars are set."""
    kind = "public_dataset"
    vertical = "instituciones"
    ttl_seconds = 6 * 3600
    requires_credentials = True

    def normalize(self, entry): return None
    async def _fetch(self): return []


def build_registry() -> list[PublicDataConnector]:
    """Return one fresh list of connectors — never share instances between
    test runs because they carry mutable state (last_sync_at, fail_streak).
    """
    out: list[PublicDataConnector] = []

    # ------------------------------------------------------------------
    # ACTIVE — CKAN-style portals (public, no API key required)
    # ------------------------------------------------------------------
    ckan_configs = [
        # (id, name, country, base_url, query)
        ("mx-datosgob", "datos.gob.mx", "MX",
         "https://datos.gob.mx",
         "*:*"),
        ("ar-datosgob", "datos.gob.ar", "AR",
         "https://datos.gob.ar",
         "*:*"),
        ("cl-datosgob", "datos.gob.cl", "CL",
         "https://datos.gob.cl",
         "*:*"),
        ("pe-datosabiertos", "datosabiertos.gob.pe", "PE",
         "https://catalogo.datosabiertos.gob.pe",  # CKAN lives on catalog subdomain
         "*:*"),
        ("ec-datosabiertos", "datosabiertos.gob.ec", "EC",
         "https://www.datosabiertos.gob.ec",
         "*:*"),
        ("pa-datosabiertos", "datosabiertos.gob.pa", "PA",
         "https://www.datosabiertos.gob.pa",
         "*:*"),
        ("uy-catalogo", "catalogodatos.gub.uy", "UY",
         "https://catalogodatos.gub.uy",
         "*:*"),
        ("cr-datosabiertos", "datosabiertos.go.cr", "CR",
         "https://datosabiertos.presidencia.go.cr",
         "*:*"),
        ("do-datosgob", "datos.gob.do", "DO",
         "https://datos.gob.do",
         "*:*"),
        ("bo-datosgob", "datos.gob.bo", "BO",
         "https://datos.gob.bo",
         "*:*"),
        ("py-datosgov", "datos.gov.py", "PY",
         "https://www.datos.gov.py",  # canonical www host — the bare host 301s
         "*:*"),
    ]
    for cid, name, country, base_url, query in ckan_configs:
        out.append(CKANConnector(id=cid, name=name, country=country,
                                  base_url=base_url, query=query))

    # ------------------------------------------------------------------
    # PREPARED (require credentials or manual verification) — 18 countries
    # ------------------------------------------------------------------
    prepared = [
        # Colombia — datos.gov.co is Socrata (SODA API), not CKAN.
        ("co-datosabiertos", "Datos Abiertos Colombia (Socrata)", "CO",
         "public_dataset", ("CO_SOCRATA_APP_TOKEN",)),
        # Brazil — dados.gov.br requires token since 2023.
        ("br-dadosgov", "dados.gov.br", "BR", "public_dataset",
         ("BR_DADOSGOV_TOKEN",)),
        # Spain — datos.gob.es uses its own custom API (apidata).
        ("es-datosgob", "datos.gob.es (apidata)", "ES", "public_dataset",
         ("ES_APIDATA_TOKEN",)),
        # El Salvador — datos.gob.sv catálogo no público desde 2024.
        ("sv-datosgob", "datos.gob.sv", "SV", "public_dataset",
         ("SV_DATOS_TOKEN",)),
        # Honduras — catálogo pausado, requiere gestión con Presidencia.
        ("hn-datosgob", "datos.gob.hn", "HN", "public_dataset",
         ("HN_DATOS_TOKEN",)),
        # Colombia
        ("co-secop", "SECOP II — Colombia Compra Eficiente", "CO", "tender",
         ("COLOMBIA_SECOP_API_KEY",)),
        ("co-rues", "RUES — Registro Único Empresarial", "CO", "registry",
         ("COLOMBIA_RUES_API_KEY",)),
        ("co-spe", "Servicio Público de Empleo Colombia", "CO", "job",
         ("COLOMBIA_SPE_API_KEY",)),
        # México
        ("mx-denue", "DENUE — INEGI", "MX", "registry",
         ("INEGI_DENUE_TOKEN",)),
        # Argentina
        ("ar-saij", "SAIJ — Legislación Argentina", "AR", "legal",
         ("AR_SAIJ_API_KEY",)),
        # Chile
        ("cl-chilecompra", "ChileCompra — MercadoPúblico", "CL", "tender",
         ("CHILE_MERCADOPUBLICO_TICKET",)),
        ("cl-corfo", "CORFO", "CL", "event", ()),  # public catalog, no creds — skeleton
        # Perú
        ("pe-sunat", "SUNAT — Consulta RUC", "PE", "registry",
         ("PE_SUNAT_TOKEN",)),
        ("pe-sunarp", "SUNARP", "PE", "registry",
         ("PE_SUNARP_API_KEY",)),
        # Brasil
        ("br-openfinance", "Open Finance Brasil", "BR", "indicator",
         ("BR_OPENFINANCE_CLIENT_ID", "BR_OPENFINANCE_CLIENT_SECRET")),
        # Ecuador
        ("ec-sri", "SRI Ecuador", "EC", "registry",
         ("EC_SRI_API_KEY",)),
        ("ec-sercop", "SERCOP Ecuador — Sistema Nacional de Contratación", "EC", "tender",
         ("EC_SERCOP_API_KEY",)),
        # Panamá
        ("pa-panamacompra", "PanamáCompra", "PA", "tender",
         ("PA_PANAMACOMPRA_API_KEY",)),
        ("pa-sbp", "Superintendencia de Bancos de Panamá", "PA", "indicator", ()),
        # Uruguay
        ("uy-dgi", "DGI Uruguay", "UY", "registry",
         ("UY_DGI_API_KEY",)),
        # Costa Rica
        ("cr-sicop", "SICOP Costa Rica", "CR", "tender",
         ("CR_SICOP_API_KEY",)),
        # República Dominicana
        ("do-dgii", "DGII República Dominicana", "DO", "registry",
         ("DO_DGII_API_KEY",)),
        # Guatemala
        ("gt-guatecompras", "Guatecompras", "GT", "tender",
         ("GT_GUATECOMPRAS_API_KEY",)),
        # Honduras
        ("hn-honducompras", "HonduCompras", "HN", "tender",
         ("HN_HONDUCOMPRAS_API_KEY",)),
        # Bolivia
        ("bo-seprec", "SEPREC Bolivia", "BO", "registry",
         ("BO_SEPREC_API_KEY",)),
        # Paraguay
        ("py-dncp", "DNCP Paraguay", "PY", "tender",
         ("PY_DNCP_API_KEY",)),
        # España
        ("es-sepe", "SEPE — Servicio Público de Empleo Estatal", "ES", "job",
         ("ES_SEPE_API_KEY",)),
        # Global — commerce / fintech gateways
        ("global-mercadolibre", "Mercado Libre — Marketplace API", "GLOBAL", "product",
         ("MERCADOLIBRE_CLIENT_ID", "MERCADOLIBRE_CLIENT_SECRET")),
        ("global-shopify", "Shopify Storefront API", "GLOBAL", "product",
         ("SHOPIFY_ACCESS_TOKEN",)),
        ("global-belvo", "Belvo — Open Finance LATAM", "GLOBAL", "indicator",
         ("BELVO_SECRET_ID", "BELVO_SECRET_PASSWORD")),
        ("global-prometeo", "Prometeo — Open Banking LATAM", "GLOBAL", "indicator",
         ("PROMETEO_API_KEY",)),
    ]
    for cid, name, country, kind, env_keys in prepared:
        out.append(RequiresCredentialsStub(
            id=cid, name=name, country=country, kind=kind,
            requires_credentials=bool(env_keys), env_keys=env_keys or (),
        ))
    return out


# Single mutable registry — the scheduler references this. Do NOT mutate
# from application code; use `refresh()` if you seeded new sources.
_REGISTRY: list[PublicDataConnector] | None = None


def get() -> list[PublicDataConnector]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = build_registry()
    return _REGISTRY


def refresh() -> list[PublicDataConnector]:
    global _REGISTRY
    _REGISTRY = build_registry()
    return _REGISTRY
