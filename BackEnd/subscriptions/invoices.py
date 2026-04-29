from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone


@dataclass
class InvoiceLine:
    module_name: str
    months: int
    unit_price_xof: int
    subtotal_xof: int
    renewal_at_text: str


def _format_xof(value: int) -> str:
    return f"{int(value):,}".replace(",", " ") + " XOF"


def build_payment_invoice_pdf(
    *,
    tenant_name: str,
    buyer_name: str,
    buyer_email: str,
    transaction_id: str,
    invoice_number: str,
    payment_time: datetime,
    lines: list[InvoiceLine],
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    left = 16 * mm
    right = width - (16 * mm)

    # Header banner
    pdf.setFillColor(colors.HexColor("#0b4ca8"))
    pdf.rect(0, height - 44 * mm, width, 44 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(left, height - 24 * mm, "CorpCore")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(left, height - 31 * mm, "Facture de paiement abonnement")

    # Metadata block
    y = height - 55 * mm
    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(left, y, "FACTURE")
    pdf.setFont("Helvetica", 10)
    y -= 6 * mm
    pdf.drawString(left, y, f"Numero: {invoice_number}")
    y -= 5 * mm
    pdf.drawString(left, y, f"Date: {payment_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    y -= 5 * mm
    pdf.drawString(left, y, f"Transaction: {transaction_id}")

    # Buyer/seller boxes
    y -= 11 * mm
    box_h = 23 * mm
    box_w = (right - left - (8 * mm)) / 2
    pdf.setStrokeColor(colors.HexColor("#cbd5e1"))
    pdf.setLineWidth(1)

    pdf.roundRect(left, y - box_h, box_w, box_h, 4, stroke=1, fill=0)
    pdf.roundRect(left + box_w + (8 * mm), y - box_h, box_w, box_h, 4, stroke=1, fill=0)

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left + 4 * mm, y - 5 * mm, "Emetteur")
    pdf.drawString(left + box_w + (12 * mm), y - 5 * mm, "Client")

    pdf.setFont("Helvetica", 9)
    pdf.drawString(left + 4 * mm, y - 11 * mm, "CorpCore ERP SaaS")
    pdf.drawString(left + 4 * mm, y - 16 * mm, "support@corpcore.app")
    pdf.drawString(left + box_w + (12 * mm), y - 11 * mm, buyer_name)
    pdf.drawString(left + box_w + (12 * mm), y - 16 * mm, buyer_email)
    pdf.drawString(left + box_w + (12 * mm), y - 21 * mm, f"Tenant: {tenant_name}")

    # Table header
    y -= box_h + 10 * mm
    cols = [left, left + 62 * mm, left + 83 * mm, left + 109 * mm, right]
    pdf.setFillColor(colors.HexColor("#f1f5f9"))
    pdf.rect(left, y - 8 * mm, right - left, 8 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(cols[0] + 2 * mm, y - 5.5 * mm, "Module")
    pdf.drawString(cols[1] + 2 * mm, y - 5.5 * mm, "Mois")
    pdf.drawString(cols[2] + 2 * mm, y - 5.5 * mm, "Prix mensuel")
    pdf.drawString(cols[3] + 2 * mm, y - 5.5 * mm, "Sous-total")

    # Table rows
    y -= 8 * mm
    pdf.setFont("Helvetica", 9)
    total_amount = 0
    for line in lines:
        row_h = 8 * mm
        pdf.setStrokeColor(colors.HexColor("#e2e8f0"))
        pdf.line(left, y, right, y)
        pdf.setFillColor(colors.HexColor("#0f172a"))
        pdf.drawString(cols[0] + 2 * mm, y - 5.5 * mm, line.module_name[:38])
        pdf.drawString(cols[1] + 2 * mm, y - 5.5 * mm, str(max(int(line.months), 1)))
        pdf.drawString(cols[2] + 2 * mm, y - 5.5 * mm, _format_xof(line.unit_price_xof))
        pdf.drawRightString(cols[4] - 2 * mm, y - 5.5 * mm, _format_xof(line.subtotal_xof))
        y -= row_h
        total_amount += int(line.subtotal_xof or 0)

    pdf.line(left, y, right, y)

    # Total
    y -= 9 * mm
    pdf.setFont("Helvetica-Bold", 11)
    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.drawString(cols[2], y, "TOTAL PAYE")
    pdf.drawRightString(cols[4] - 2 * mm, y, _format_xof(total_amount))

    # Digital paid stamp
    stamp_w = 52 * mm
    stamp_h = 22 * mm
    stamp_x = right - stamp_w
    stamp_y = y - 23 * mm
    pdf.saveState()
    pdf.setStrokeColor(colors.HexColor("#dc2626"))
    pdf.setFillColor(colors.HexColor("#dc2626"))
    pdf.setLineWidth(2)
    pdf.roundRect(stamp_x, stamp_y, stamp_w, stamp_h, 4, stroke=1, fill=0)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawCentredString(stamp_x + stamp_w / 2, stamp_y + 12 * mm, "PAYE")
    pdf.setFont("Helvetica", 7.5)
    pdf.drawCentredString(stamp_x + stamp_w / 2, stamp_y + 6 * mm, f"TX: {transaction_id}")
    pdf.drawCentredString(
        stamp_x + stamp_w / 2,
        stamp_y + 3 * mm,
        f"{payment_time.strftime('%Y-%m-%d %H:%M:%S %Z')}",
    )
    pdf.restoreState()

    # Footer note
    pdf.setFillColor(colors.HexColor("#64748b"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(left, 14 * mm, "Document numerique genere automatiquement par CorpCore.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def build_invoice_filename(transaction_id: str) -> str:
    suffix = (transaction_id or "unknown").replace(" ", "")[-10:]
    return f"facture-corpcore-{suffix}.pdf"


def build_invoice_number(transaction_id: str) -> str:
    now = timezone.localtime(timezone.now())
    suffix = (transaction_id or "unknown").replace(" ", "")[-6:].upper()
    return f"INV-{now.strftime('%Y%m%d')}-{suffix}"
