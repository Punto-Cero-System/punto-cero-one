"""CKAN Datasets connector — cubre la mayoría de portales de Datos Abiertos
LATAM que usan CKAN estándar (datos.gob.co, datos.gob.mx, datos.gob.ar,
datos.gob.cl, datos.gob.pe, datosabiertos.gob.pa, datos.gob.es, etc.).

CKAN expone `/api/3/action/package_search?q=&rows=` en TODOS estos portales.
Con un solo conector parametrizado por `base_url + query` cubrimos 12 países.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from services.integrations.base import http
from services.discovery.autotag import get_company_aliases, autotag_item_payload
from . import PublicDataConnector


class CKANConnector(PublicDataConnector):
    kind = "public_dataset"
    vertical = "instituciones"
    ttl_seconds = 3 * 3600  # 3 h — open-data portals move slowly

    #: e.g. "https://www.datos.gov.co"
    base_url: str = ""
    #: Search query CKAN sends to package_search
    query: str = "*:*"
    #: Optional filter, e.g. "organization:mintic"
    fq: Optional[str] = None
    #: Max results per sync
    rows: int = 25

    _db_ref = None  # for autotag aliases cache

    async def _fetch(self) -> list[dict]:
        params = {"q": self.query, "rows": self.rows,
                  "sort": "metadata_modified desc"}
        if self.fq:
            params["fq"] = self.fq
        r = await http().get(f"{self.base_url}/api/3/action/package_search",
                              params=params, timeout=15.0,
                              headers={"User-Agent": "PuntoCeroOne/1.0"})
        r.raise_for_status()
        data = r.json()
        if not data.get("success"):
            raise RuntimeError(f"CKAN error: {data.get('error')}")
        return (data.get("result") or {}).get("results") or []

    def normalize(self, entry: dict) -> Optional[dict]:
        cid = entry.get("id") or entry.get("name")
        if not cid:
            return None
        title = entry.get("title") or entry.get("name") or ""
        notes = (entry.get("notes") or "").strip()[:400]
        organization = (entry.get("organization") or {}).get("title") or ""
        # CKAN portals expose the dataset UI at /dataset/{name}
        slug = entry.get("name") or cid
        url = entry.get("url") or f"{self.base_url}/dataset/{slug}"
        # Build a stable per-portal id.
        doc_id = "ck_" + hashlib.sha1(
            f"{self.id}::{cid}".encode()
        ).hexdigest()[:16]
        now = datetime.now(timezone.utc).isoformat()
        published = entry.get("metadata_modified") or entry.get("metadata_created") or now
        tags = [t.get("name", "").lower() for t in (entry.get("tags") or []) if t.get("name")][:12]
        return {
            "id": doc_id,
            "source_id": self.id,
            "source_name": self.name,
            "url": url,
            "title": title,
            "summary": notes,
            "author": organization or self.name,
            "image_url": None,
            "language": "es" if self.country != "BR" else "pt",
            "country": self.country,
            "city": None,
            "vertical": self.vertical,
            "category": "Datos Abiertos",
            "tags": tags,
            "kind": self.kind,
            "published_at": published,
            "ingested_at": now,
            "priority": 4,
            "meta": {
                "organization": organization,
                "portal": self.base_url,
                "connector": self.id,
                "resources_count": len(entry.get("resources") or []),
            },
        }
