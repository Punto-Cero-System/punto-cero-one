"""SEO / social share helpers — Wave 11.1.

* `/api/seo/sitemap.xml` — dynamic sitemap covering companies + verticals.
* `/api/seo/og/{kind}/{id_or_slug}` — server-side rendered page with proper
  Open Graph / Twitter Card / JSON-LD tags. Called by external crawlers
  (LinkedIn, WhatsApp, Slack, Twitter) via the share short-links from the
  frontend. Real users land on the SPA thanks to the meta `refresh` tag.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse


router = APIRouter(prefix="/api/seo", tags=["seo"])


def _public_base() -> str:
    return (os.environ.get("PUBLIC_APP_URL") or "").rstrip("/")


@router.get("/sitemap.xml", response_class=PlainTextResponse)
async def sitemap(request: Request):
    db = request.app.state.db
    base = _public_base() or ""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls: list[tuple[str, str]] = [
        (f"{base}/", "1.0"),
        (f"{base}/join", "0.7"),
        (f"{base}/empresas", "0.9"),
        (f"{base}/comunidad", "0.9"),
        (f"{base}/noticias", "0.8"),
        (f"{base}/eventos", "0.7"),
    ]
    async for c in db.companies.find(
        {"is_public_seed": True, "is_deleted": {"$ne": True}},
        {"_id": 0, "slug": 1},
    ).limit(2000):
        urls.append((f"{base}/empresas/{c['slug']}", "0.8"))
    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, prio in urls:
        body.append(
            f"<url><loc>{escape(loc)}</loc><lastmod>{now}</lastmod>"
            f"<changefreq>daily</changefreq><priority>{prio}</priority></url>"
        )
    body.append("</urlset>")
    return Response("\n".join(body), media_type="application/xml")


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    base = _public_base() or ""
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /admin/\n"
        f"Sitemap: {base}/api/seo/sitemap.xml\n"
    )


@router.get("/og/company/{slug}", response_class=HTMLResponse)
async def og_company(slug: str, request: Request):
    db = request.app.state.db
    c = await db.companies.find_one({"slug": slug, "is_deleted": {"$ne": True}},
                                     {"_id": 0, "name": 1, "tagline": 1,
                                      "description": 1, "logo_url": 1,
                                      "vertical": 1, "country": 1})
    if not c:
        return HTMLResponse(_meta_fallback(request), status_code=404)
    base = _public_base() or str(request.base_url).rstrip("/")
    canonical = f"{base}/empresas/{slug}"
    title = f"{c.get('name')} · Punto Cero One"
    desc = (c.get("tagline") or c.get("description") or "")[:180]
    image = c.get("logo_url") or f"{base}/og-default.png"
    jsonld = {
        "@context": "https://schema.org", "@type": "Organization",
        "name": c.get("name"), "description": desc,
        "url": canonical, "logo": image,
    }
    import json
    html = _og_shell(title=title, desc=desc, image=image, canonical=canonical,
                    jsonld=json.dumps(jsonld, ensure_ascii=False),
                    body_content=f"<h1>{escape(c.get('name') or '')}</h1>"
                                 f"<p>{escape(desc)}</p>")
    return HTMLResponse(html)


def _meta_fallback(request: Request) -> str:
    base = _public_base() or str(request.base_url).rstrip("/")
    return _og_shell(
        title="Punto Cero One — Comunidad profesional LATAM",
        desc="Conecta con empresas, profesionales y oportunidades en Latinoamérica.",
        image=f"{base}/og-default.png",
        canonical=f"{base}/", jsonld="{}",
        body_content="<h1>Punto Cero One</h1>",
    )


def _og_shell(*, title: str, desc: str, image: str, canonical: str,
              jsonld: str, body_content: str) -> str:
    return f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8" />
<title>{escape(title)}</title>
<meta name="description" content="{escape(desc)}" />
<link rel="canonical" href="{escape(canonical)}" />
<meta name="robots" content="index,follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{escape(title)}" />
<meta property="og:description" content="{escape(desc)}" />
<meta property="og:image" content="{escape(image)}" />
<meta property="og:url" content="{escape(canonical)}" />
<meta property="og:site_name" content="Punto Cero One" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{escape(title)}" />
<meta name="twitter:description" content="{escape(desc)}" />
<meta name="twitter:image" content="{escape(image)}" />
<script type="application/ld+json">{jsonld}</script>
<meta http-equiv="refresh" content="0; url={escape(canonical)}" />
</head><body>{body_content}
<p><a href="{escape(canonical)}">Continuar</a></p></body></html>"""
