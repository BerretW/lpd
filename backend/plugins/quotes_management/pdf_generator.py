"""
PDF generator for quotes using reportlab.
Replicates the LP Dvoracek budget layout from the sample document.
"""
import io
from datetime import datetime, timedelta
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ─── Color palette ────────────────────────────────────────────────────────────

RED = colors.HexColor("#CC0000")
DARK_GRAY = colors.HexColor("#333333")
LIGHT_GRAY = colors.HexColor("#F5F5F5")
MEDIUM_GRAY = colors.HexColor("#E0E0E0")
YELLOW_BG = colors.HexColor("#FFFF99")
HEADER_BG = colors.HexColor("#1A1A1A")
SECTION_BG = colors.HexColor("#EEEEEE")
WHITE = colors.white
BLACK = colors.black


def _fmt_price(val: float) -> str:
    """Format price in CZK: 12 345,67 Kč"""
    if val == 0:
        return "0,00 Kč"
    formatted = f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", " ")
    return f"{formatted} Kč"


def _fmt_qty(val: float) -> str:
    if val == int(val):
        return str(int(val))
    return f"{val:.2f}".replace(".", ",")


def generate_quote_pdf(quote_data: dict, company_data: dict) -> bytes:
    """
    Generate a PDF for a quote.

    quote_data: serialized Quote with nested sections/items/category_assemblies
    company_data: company info dict (name, address, ico, dic, etc.)

    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    margin = 12 * mm
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=8, leading=10)
    bold = ParagraphStyle("bold", fontName="Helvetica-Bold", fontSize=8, leading=10)
    small = ParagraphStyle("small", fontName="Helvetica", fontSize=7, leading=9, textColor=colors.HexColor("#666666"))
    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=WHITE)
    section_style = ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=BLACK)
    right_style = ParagraphStyle("right", fontName="Helvetica", fontSize=8, leading=10, alignment=TA_RIGHT)
    right_bold = ParagraphStyle("right_bold", fontName="Helvetica-Bold", fontSize=9, leading=11, alignment=TA_RIGHT)

    story = []
    page_w = A4[0] - 2 * margin

    # ─── Company header ───────────────────────────────────────────────────────

    header_data = [[
        Paragraph(f"<b>{company_data.get('name', 'LP Dvoracek spol. s.r.o')}</b>", bold),
        Paragraph(
            f"{company_data.get('address', '')}<br/>"
            f"IČO: {company_data.get('ico', '')}  DIČ: {company_data.get('dic', '')}<br/>"
            f"www.lpdweb.cz  •  info@lpdweb.cz",
            small
        ),
    ]]
    header_table = Table(header_data, colWidths=[page_w * 0.35, page_w * 0.65])
    header_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, RED),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    # ─── Title bar ────────────────────────────────────────────────────────────

    title_text = "ZABEZPEČOVACÍ, POŽÁRNÍ, KAMEROVÉ, PŘÍSTUPOVÉ SYSTÉMY A ELEKTROINSTALACE"
    title_table = Table([[Paragraph(title_text, title_style)]], colWidths=[page_w])
    title_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [HEADER_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(title_table)
    story.append(Spacer(1, 3 * mm))

    # ─── Quote metadata ───────────────────────────────────────────────────────

    valid_until = ""
    if quote_data.get("created_at") and quote_data.get("validity_days"):
        try:
            created = datetime.fromisoformat(str(quote_data["created_at"]).replace("Z", "+00:00"))
            valid_dt = created + timedelta(days=int(quote_data["validity_days"]))
            valid_until = valid_dt.strftime("%d.%m.%Y")
        except Exception:
            valid_until = f"{quote_data['validity_days']} dní"

    created_str = ""
    if quote_data.get("created_at"):
        try:
            created = datetime.fromisoformat(str(quote_data["created_at"]).replace("Z", "+00:00"))
            created_str = created.strftime("%d.%m.%Y")
        except Exception:
            pass

    meta_data = [
        [Paragraph("Předmět:", bold), Paragraph("Elektroinstalace a slaboproud", normal)],
        [Paragraph("Název zakázky:", bold), Paragraph(str(quote_data.get("name", "")), normal)],
        [Paragraph("Zákazník:", bold), Paragraph(str(quote_data.get("customer_name") or ""), normal)],
        [Paragraph("Kontaktní osoba:", bold), Paragraph(str(quote_data.get("prepared_by") or ""), normal)],
        [Paragraph("Zpracoval:", bold), Paragraph(
            f"{quote_data.get('prepared_by') or ''}"
            + (f"  tel. {quote_data.get('prepared_by_phone')}" if quote_data.get("prepared_by_phone") else ""),
            normal
        )],
        [Paragraph("Platnost nabídky:", bold), Paragraph(f"{quote_data.get('validity_days', 14)} dní (do {valid_until})", normal)],
        [Paragraph("Datum:", bold), Paragraph(created_str, normal)],
    ]
    meta_table = Table(meta_data, colWidths=[35 * mm, page_w - 35 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, MEDIUM_GRAY),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4 * mm))

    # ─── Column widths ────────────────────────────────────────────────────────
    # prefix | name | unit | qty | material | assembly | price/unit | total
    col_w = [10 * mm, page_w - 10 * mm - 12 * mm - 14 * mm - 22 * mm - 22 * mm - 22 * mm - 22 * mm,
             12 * mm, 14 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm]

    # ─── Table header ─────────────────────────────────────────────────────────

    hdr_style = ParagraphStyle("hdr", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=WHITE)
    hdr_right = ParagraphStyle("hdr_r", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=WHITE, alignment=TA_RIGHT)

    col_headers = [
        Paragraph("", hdr_style),
        Paragraph("Položka", hdr_style),
        Paragraph("m.j.", hdr_style),
        Paragraph("Počet", hdr_right),
        Paragraph("Materiál", hdr_right),
        Paragraph("Montáž", hdr_right),
        Paragraph("Cena/ks", hdr_right),
        Paragraph("Cena celkem", hdr_right),
    ]

    # ─── Separate sections into regular and extras ────────────────────────────

    regular_sections = [s for s in quote_data.get("sections", []) if not s.get("is_extras")]
    extras_sections = [s for s in quote_data.get("sections", []) if s.get("is_extras")]

    grand_total_before_discount = 0.0
    reduced_work_total = 0.0   # méněpráce savings (negative items)
    extras_total = 0.0
    all_rows = [col_headers]
    all_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ROWHEIGHT", (0, 0), (-1, 0), 14),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("GRID", (0, 0), (-1, -1), 0.25, MEDIUM_GRAY),
    ]

    row_idx = 1  # current table row index (0 = header)

    def _add_section(section: dict, is_extras_section: bool = False) -> float:
        nonlocal row_idx
        section_total = 0.0
        prefix = section.get("prefix") or ""
        section_name = section.get("name", "")

        # Section header row
        label = f"{'[VÍCEPRÁCE] ' if is_extras_section else ''}{section_name}"
        all_rows.append([
            Paragraph(prefix, ParagraphStyle("sp", fontName="Helvetica-Bold", fontSize=7)),
            Paragraph(label, section_style),
            "", "", "", "", "", "",
        ])
        all_style_cmds.extend([
            ("BACKGROUND", (0, row_idx), (-1, row_idx), SECTION_BG),
            ("SPAN", (1, row_idx), (7, row_idx)),
            ("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold"),
        ])
        row_idx += 1

        items = section.get("items", [])
        for item in items:
            qty = float(item.get("quantity", 1))
            mat = float(item.get("material_price", 0))
            asm = float(item.get("assembly_price", 0))
            price_per = mat + asm
            total = round(qty * price_per, 2)
            is_reduced = item.get("is_reduced_work", False)

            item_style = ParagraphStyle("it", fontName="Helvetica", fontSize=7, leading=9)
            item_right = ParagraphStyle("itr", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_RIGHT)

            all_rows.append([
                Paragraph(prefix, item_style),
                Paragraph(str(item.get("name", "")), item_style),
                Paragraph(str(item.get("unit", "ks")), item_style),
                Paragraph(_fmt_qty(qty), item_right),
                Paragraph(_fmt_price(mat), item_right),
                Paragraph(_fmt_price(asm), item_right),
                Paragraph(_fmt_price(price_per), item_right),
                Paragraph(_fmt_price(total), item_right),
            ])

            if is_reduced:
                all_style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), YELLOW_BG))
            elif row_idx % 2 == 0:
                all_style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), LIGHT_GRAY))

            section_total += total
            row_idx += 1

        # Section subtotal row
        st_style = ParagraphStyle("st", fontName="Helvetica-Bold", fontSize=7, alignment=TA_RIGHT)
        all_rows.append([
            "", Paragraph(f"{section_name} celkem:", st_style),
            "", "", "", "", "",
            Paragraph(_fmt_price(section_total), ParagraphStyle("stv", fontName="Helvetica-Bold", fontSize=7, alignment=TA_RIGHT, textColor=RED)),
        ])
        all_style_cmds.extend([
            ("SPAN", (0, row_idx), (6, row_idx)),
            ("BACKGROUND", (0, row_idx), (-1, row_idx), MEDIUM_GRAY),
            ("FONTNAME", (0, row_idx), (-1, row_idx), "Helvetica-Bold"),
        ])
        row_idx += 1

        return section_total

    # Regular sections
    for sec in regular_sections:
        sec_total = _add_section(sec, False)
        # Count méněpráce separately
        for item in sec.get("items", []):
            qty = float(item.get("quantity", 1))
            mat = float(item.get("material_price", 0))
            asm = float(item.get("assembly_price", 0))
            total = round(qty * (mat + asm), 2)
            if item.get("is_reduced_work"):
                reduced_work_total += total
            else:
                grand_total_before_discount += total

    # Extras sections
    for sec in extras_sections:
        sec_total = _add_section(sec, True)
        extras_total += sec_total

    # Build the main items table
    items_table = Table(all_rows, colWidths=col_w, repeatRows=1)
    items_table.setStyle(TableStyle(all_style_cmds))
    story.append(items_table)
    story.append(Spacer(1, 5 * mm))

    # ─── Summary / Rekapitulace ───────────────────────────────────────────────

    story.append(Paragraph("Rekapitulace", ParagraphStyle("recap_hdr", fontName="Helvetica-Bold", fontSize=10, textColor=RED)))
    story.append(Spacer(1, 2 * mm))

    vat_rate = float(quote_data.get("vat_rate", 21.0))
    discount = float(quote_data.get("global_discount", 0.0))
    discount_type = str(quote_data.get("global_discount_type", "percent"))

    subtotal = grand_total_before_discount
    discount_amount = 0.0
    if discount > 0:
        if discount_type == "percent":
            discount_amount = round(subtotal * discount / 100, 2)
        else:
            discount_amount = discount

    net_total = subtotal - discount_amount - reduced_work_total + extras_total
    vat_amount = round(net_total * vat_rate / 100, 2)
    gross_total = net_total + vat_amount

    recap_rows = []
    r_label = ParagraphStyle("rl", fontName="Helvetica", fontSize=8, alignment=TA_RIGHT)
    r_value = ParagraphStyle("rv", fontName="Helvetica", fontSize=8)
    r_label_bold = ParagraphStyle("rlb", fontName="Helvetica-Bold", fontSize=9, alignment=TA_RIGHT)
    r_value_bold = ParagraphStyle("rvb", fontName="Helvetica-Bold", fontSize=9)

    recap_rows.append([Paragraph("Celkem bez DPH (před slevou):", r_label), Paragraph(_fmt_price(subtotal), r_value)])

    if reduced_work_total > 0:
        recap_rows.append([
            Paragraph("Úspora - méněpráce:", ParagraphStyle("rl_y", fontName="Helvetica", fontSize=8, alignment=TA_RIGHT, textColor=colors.HexColor("#996600"))),
            Paragraph(f"− {_fmt_price(reduced_work_total)}", ParagraphStyle("rv_y", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#996600"))),
        ])

    if discount_amount > 0:
        label = f"Poskytnutá sleva ({discount}{'%' if discount_type == 'percent' else ' Kč'}):"
        recap_rows.append([
            Paragraph(label, ParagraphStyle("rl_d", fontName="Helvetica", fontSize=8, alignment=TA_RIGHT, textColor=colors.HexColor("#006600"))),
            Paragraph(f"− {_fmt_price(discount_amount)}", ParagraphStyle("rv_d", fontName="Helvetica", fontSize=8, textColor=colors.HexColor("#006600"))),
        ])

    if extras_total > 0:
        recap_rows.append([
            Paragraph("Vícepráce:", ParagraphStyle("rl_e", fontName="Helvetica-Bold", fontSize=8, alignment=TA_RIGHT, textColor=colors.HexColor("#CC0000"))),
            Paragraph(f"+ {_fmt_price(extras_total)}", ParagraphStyle("rv_e", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#CC0000"))),
        ])

    recap_rows.append([Paragraph("DODÁVKA A MONTÁŽ CELKEM BEZ DPH:", r_label_bold), Paragraph(_fmt_price(net_total), r_value_bold)])
    recap_rows.append([Paragraph(f"DPH {vat_rate:.0f}%:", r_label), Paragraph(_fmt_price(vat_amount), r_value)])
    recap_rows.append([
        Paragraph("DODÁVKA CELKEM S DPH:", ParagraphStyle("rlf", fontName="Helvetica-Bold", fontSize=11, alignment=TA_RIGHT, textColor=RED)),
        Paragraph(_fmt_price(gross_total), ParagraphStyle("rvf", fontName="Helvetica-Bold", fontSize=11, textColor=RED)),
    ])

    col_recap = [page_w * 0.65, page_w * 0.35]
    recap_table = Table(recap_rows, colWidths=col_recap)
    recap_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEABOVE", (0, -3), (-1, -3), 0.5, DARK_GRAY),
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, RED),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GRAY),
    ]))
    story.append(recap_table)

    if quote_data.get("notes"):
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("Poznámky:", bold))
        story.append(Paragraph(str(quote_data["notes"]), normal))

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=MEDIUM_GRAY))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"{company_data.get('name', '')}  •  {company_data.get('address', '')}  •  www.lpdweb.cz  •  info@lpdweb.cz",
        ParagraphStyle("footer", fontName="Helvetica", fontSize=6, textColor=colors.HexColor("#999999"), alignment=TA_CENTER)
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
