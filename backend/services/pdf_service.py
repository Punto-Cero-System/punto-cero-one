"""ReportLab PDF generator for the Investor Pitch Deck.

Design: institutional Punto Cero System brand — navy background covers, gold accents,
one page per slide, curated content (no HTML/CSS rendering, so we author the content
manually to match the 12-slide narrative).
"""
from io import BytesIO
from datetime import datetime, timezone

from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

NAVY = HexColor("#0B1F3A")
NAVY_DEEP = HexColor("#071527")
EMERALD = HexColor("#00C896")
GOLD = HexColor("#D4AF37")
IVORY = HexColor("#F7F5F0")
WHITE = HexColor("#FFFFFF")
MUTED = HexColor("#8A9BB5")

PAGE_W, PAGE_H = landscape(A4)  # 842 x 595 pts

SLIDES = [
    {
        "n": "01", "kicker": "COVER", "title": "PUNTO CERO SYSTEM",
        "subtitle": "Where everything begins.",
        "body": [
            "One core. Multiple verticals. One connected ecosystem.",
            "Shared technology infrastructure for a connected Latin America.",
        ],
    },
    {
        "n": "02", "kicker": "01 · THE OPPORTUNITY", "title": "A fragmented Latin America",
        "subtitle": "Different currencies, cultures, regulations — similar operational challenges.",
        "body": [
            "Professionals and companies solve the same technology problems in isolation.",
            "The opportunity is one shared technology foundation across multiple markets.",
        ],
    },
    {
        "n": "03", "kicker": "02 · THE VISION", "title": "This is not an application.",
        "subtitle": "It is a platform. It is a long-term technology vision.",
        "body": [
            "Punto Cero System · Shared Technology Core · Specialized verticals",
            "Professionals · Entrepreneurs · Companies · Communities · Connected opportunities.",
        ],
    },
    {
        "n": "04", "kicker": "03 · SHARED TECHNOLOGY CORE", "title": "Build once. Reuse. Adapt. Expand.",
        "subtitle": "Reusable technology foundation supporting multiple specialized platforms.",
        "body": [
            "AI · CRM · Automation · Document management",
            "Dashboards · Roles & permissions · Security",
            "APIs · Data architecture · Scalable infrastructure",
        ],
    },
    {
        "n": "05", "kicker": "04 · FIRST REAL PRODUCT", "title": "Punto Cero Legal · LIVE in production",
        "subtitle": "The first commercial vertical of the shared technology vision — already live.",
        "body": [
            "AI · CRM · Client & document management · Automation",
            "Dashboards · Users · Roles · Security · Reporting",
            "puntocerolegal.com",
        ],
    },
    {
        "n": "06", "kicker": "05 · 18-COUNTRY OPPORTUNITY", "title": "Multiple markets. One architecture.",
        "subtitle": "Latin America as a long-term expansion vision — not current operations.",
        "body": [
            "MX · GT · SV · HN · NI · CR · PA · CO · VE · EC · PE · BO · CL · AR · UY · PY · DO · PR",
            "One shared technology foundation. Local adaptation. One connected ecosystem.",
        ],
    },
    {
        "n": "07", "kicker": "06 · WHY THE ARCHITECTURE MATTERS", "title": "Reusable. Modular. Institutional.",
        "subtitle": "Each vertical becomes the foundation for the next.",
        "body": [
            "Shared Core → Specialized verticals → Professional & industrial users",
            "The technology core is a strategic asset — not just a product.",
        ],
    },
    {
        "n": "08", "kicker": "07 · THE ECOSYSTEM", "title": "A living technology network.",
        "subtitle": "Long-term ecosystem vision — not a completed catalog of products.",
        "body": [
            "Available: Legal (LIVE in production)",
            "Future vision: Medical · Dental · Commerce · Accounting · Business · Real Estate ·",
            "Insurance · Travel · Education · HR · Hospitality · Logistics · Construction · Agro",
        ],
    },
    {
        "n": "09", "kicker": "08 · THE ROADMAP", "title": "Now · Next · Expansion · Future",
        "subtitle": "Progressive execution — not simultaneous everything.",
        "body": [
            "Now — Punto Cero Legal LIVE · Scale commercial acquisition",
            "Next — Recurring revenue · Product refinement · Team expansion",
            "Expansion — Market validation · New verticals · Regional launch",
        ],
    },
    {
        "n": "10", "kicker": "09 · BUSINESS MODEL", "title": "SaaS · Enterprise · Integrations · Services",
        "subtitle": "Multiple revenue paths supported by the same shared core.",
        "body": [
            "Subscription (professionals / firms)",
            "Enterprise (companies · institutions)",
            "Integrations & Services (implementation · consulting)",
        ],
    },
    {
        "n": "11", "kicker": "10 · CURRENT STAGE", "title": "First vertical LIVE · Real foundation · Founding team",
        "subtitle": "Built by a small founding team with significant personal investment.",
        "body": [
            "Founding leadership:",
            "Darwin Jose Gomez Gomez — Founder, Chairman & CTO (Vision · Governance · Technology)",
            "Jonathan Alejandro Cetina Guerrero — Co-Founder & CEO (International Economic Relations · Executive Leadership · Global Expansion)",
            "A real technology foundation is already operating in production.",
            "The first real product — Punto Cero Legal — is LIVE.",
            "No invented traction · customers · revenue · KPIs.",
        ],
    },
    {
        "n": "12", "kicker": "11 · THE CONVERSATION", "title": "Start a strategic conversation.",
        "subtitle": "Not: invest now. Not: guaranteed returns.",
        "body": [
            "We are building the technology infrastructure for a connected Latin American ecosystem.",
            "Punto Cero Legal is where the journey begins.",
            "Request investor access · puntocerosystem.com",
        ],
    },
]


def _draw_gradient_background(c: canvas.Canvas):
    """Approximate a radial navy background with subtle vertical bands."""
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Subtle vignette on top-right corner
    for i in range(24):
        alpha = 0.02 - (i * 0.0008)
        if alpha <= 0:
            break
        c.setFillColorRGB(1, 1, 1, alpha=alpha)
        c.circle(PAGE_W - 60, PAGE_H - 60, 40 + i * 10, fill=1, stroke=0)


def _draw_orbit(c: canvas.Canvas, cx: float, cy: float, r: float, color: Color, opacity: float = 0.15):
    c.setStrokeColor(Color(color.red, color.green, color.blue, alpha=opacity))
    c.setLineWidth(0.5)
    c.setDash(2, 3)
    c.circle(cx, cy, r, stroke=1, fill=0)
    c.setDash()


def _draw_footer(c: canvas.Canvas, page_num: int, total: int):
    c.setFont("Helvetica", 7)
    c.setFillColor(MUTED)
    c.drawString(24, 20, "PUNTO CERO SYSTEM · INVESTOR PITCH DECK · 2026")
    c.drawRightString(PAGE_W - 24, 20, f"{page_num:02d} / {total:02d}")
    # thin gold divider
    c.setStrokeColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.4))
    c.setLineWidth(0.5)
    c.line(24, 30, PAGE_W - 24, 30)


def _draw_slide(c: canvas.Canvas, slide: dict, page_num: int, total: int, is_cover: bool = False):
    _draw_gradient_background(c)
    # decorative orbits on the right
    _draw_orbit(c, PAGE_W - 60, PAGE_H / 2, 320, GOLD, 0.12)
    _draw_orbit(c, PAGE_W - 60, PAGE_H / 2, 220, GOLD, 0.10)
    _draw_orbit(c, PAGE_W - 60, PAGE_H / 2, 140, EMERALD, 0.14)

    if is_cover:
        # Central point + rings
        cx, cy = PAGE_W / 2, PAGE_H / 2 + 30
        _draw_orbit(c, cx, cy, 220, EMERALD, 0.18)
        _draw_orbit(c, cx, cy, 150, EMERALD, 0.14)
        _draw_orbit(c, cx, cy, 80, GOLD, 0.35)
        c.setFillColor(EMERALD)
        c.circle(cx, cy, 8, fill=1, stroke=0)

        # Kicker
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(GOLD)
        c.drawCentredString(PAGE_W / 2, PAGE_H - 90, "INVESTOR  PITCH  DECK  ·  2026")

        # Title
        c.setFont("Helvetica-Bold", 52)
        c.setFillColor(WHITE)
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 40, slide["title"])

        # Subtitle
        c.setFont("Helvetica-Oblique", 12)
        c.setFillColor(MUTED)
        c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 70, slide["subtitle"].upper())

        # Body
        c.setFont("Helvetica", 11)
        c.setFillColor(Color(1, 1, 1, alpha=0.7))
        y = PAGE_H / 2 - 110
        for line in slide["body"]:
            c.drawCentredString(PAGE_W / 2, y, line)
            y -= 16

        # Bottom brand strip
        c.setFont("Helvetica", 8)
        c.setFillColor(MUTED)
        c.drawCentredString(PAGE_W / 2, 60, "puntocerosystem.com · puntocerolegal.com")
    else:
        # Left column: kicker + title + subtitle + body
        margin_x = 40
        top_y = PAGE_H - 60

        # Slide number pill
        c.setFillColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.14))
        c.roundRect(margin_x, top_y - 12, 42, 20, 10, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(GOLD)
        c.drawCentredString(margin_x + 21, top_y - 5, slide["n"])

        # Kicker
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(EMERALD)
        c.drawString(margin_x + 55, top_y - 5, slide["kicker"])

        # Title
        c.setFont("Helvetica-Bold", 30)
        c.setFillColor(WHITE)
        _draw_wrapped(c, slide["title"], margin_x, top_y - 60, max_width=PAGE_W - margin_x * 2 - 40, leading=34, font_size=30)

        # Subtitle
        c.setFont("Helvetica", 13)
        c.setFillColor(Color(1, 1, 1, alpha=0.75))
        _draw_wrapped(c, slide["subtitle"], margin_x, top_y - 130, max_width=PAGE_W - margin_x * 2 - 40, leading=17, font_size=13)

        # Body
        y = top_y - 200
        c.setFont("Helvetica", 11)
        c.setFillColor(Color(1, 1, 1, alpha=0.85))
        for line in slide["body"]:
            # bullet
            c.setFillColor(GOLD)
            c.circle(margin_x + 5, y + 4, 2, fill=1, stroke=0)
            c.setFillColor(Color(1, 1, 1, alpha=0.85))
            wrapped_y = _draw_wrapped(c, line, margin_x + 18, y, max_width=PAGE_W - margin_x * 2 - 60, leading=15, font_size=11)
            y = wrapped_y - 8

        # Right sidebar accent
        c.setStrokeColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.35))
        c.setLineWidth(1)
        c.line(PAGE_W - margin_x - 50, 100, PAGE_W - margin_x - 50, PAGE_H - 100)

        # Vertical brand text on right
        c.saveState()
        c.translate(PAGE_W - margin_x - 30, PAGE_H / 2)
        c.rotate(90)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(Color(GOLD.red, GOLD.green, GOLD.blue, alpha=0.6))
        c.drawCentredString(0, 0, "PUNTO  CERO  SYSTEM  ·  WHERE  EVERYTHING  BEGINS")
        c.restoreState()

    _draw_footer(c, page_num, total)


def _draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, leading: float, font_size: float) -> float:
    """Manual word-wrap that returns the y-cursor after drawing."""
    words = text.split()
    line = ""
    cur_y = y
    font = c._fontname
    for word in words:
        candidate = f"{line} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font, font_size) <= max_width:
            line = candidate
        else:
            c.drawString(x, cur_y, line)
            cur_y -= leading
            line = word
    if line:
        c.drawString(x, cur_y, line)
        cur_y -= leading
    return cur_y


def _draw_closing_page(c: canvas.Canvas, page_num: int, total: int):
    _draw_gradient_background(c)
    cx, cy = PAGE_W / 2, PAGE_H / 2 + 30
    _draw_orbit(c, cx, cy, 220, EMERALD, 0.18)
    _draw_orbit(c, cx, cy, 140, GOLD, 0.30)
    c.setFillColor(EMERALD)
    c.circle(cx, cy, 6, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(GOLD)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 90, "THANK  YOU")

    c.setFont("Helvetica-Bold", 32)
    c.setFillColor(WHITE)
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 40, "Punto Cero Legal is where the journey begins.")

    c.setFont("Helvetica", 11)
    c.setFillColor(MUTED)
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 70, "REQUEST INVESTOR ACCESS  ·  puntocerosystem.com")
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 88, "EXPLORE THE FIRST PRODUCT  ·  puntocerolegal.com")

    _draw_footer(c, page_num, total)


def build_pitch_deck_pdf() -> bytes:
    """Return raw PDF bytes."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    c.setTitle("Punto Cero System — Investor Pitch Deck")
    c.setAuthor("Punto Cero System")
    c.setSubject("Investor Pitch Deck")

    total = len(SLIDES) + 1  # slides + closing
    for i, slide in enumerate(SLIDES):
        _draw_slide(c, slide, page_num=i + 1, total=total, is_cover=(i == 0))
        c.showPage()

    _draw_closing_page(c, page_num=total, total=total)
    c.showPage()

    c.save()
    return buf.getvalue()


def build_filename() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"Punto-Cero-System-Investor-Pitch-Deck-{ts}.pdf"
