from decimal import Decimal
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from finance.models import FinanceInvoice, FinanceInvoiceLine
from ged.models import Document, DocumentFolder
from .models import SalesCustomer, SalesOrder, SalesOrderLine, SalesProduct, SalesStockMovement
from .serializers import (
    SalesCustomerSerializer,
    SalesOrderLineSerializer,
    SalesOrderSerializer,
    SalesProductSerializer,
    SalesStockMovementSerializer,
)


class SalesCustomerViewSet(viewsets.ModelViewSet):
    serializer_class = SalesCustomerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SalesCustomer.objects.all()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )
        return queryset


class SalesProductViewSet(viewsets.ModelViewSet):
    serializer_class = SalesProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SalesProduct.objects.all()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        return queryset

    @action(detail=False, methods=["get"], url_path="stock-alerts")
    def stock_alerts(self, request):
        queryset = self.get_queryset().filter(is_active=True)
        alerts = []
        for product in queryset:
            stock = product.stock_quantity or Decimal("0")
            reorder = product.reorder_level or Decimal("0")
            if stock <= Decimal("0"):
                severity = "critical"
                message = "Rupture de stock"
            elif stock <= reorder:
                severity = "warning"
                message = "Stock en dessous du seuil"
            else:
                continue
            alerts.append(
                {
                    "product_id": str(product.id),
                    "product_name": product.name,
                    "product_sku": product.sku,
                    "stock_quantity": str(stock),
                    "reorder_level": str(reorder),
                    "severity": severity,
                    "message": message,
                }
            )
        alerts.sort(key=lambda item: (0 if item["severity"] == "critical" else 1, item["product_name"]))
        return Response(alerts)


class SalesOrderViewSet(viewsets.ModelViewSet):
    serializer_class = SalesOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = (
            SalesOrder.objects.select_related("customer", "invoice", "invoice_document")
            .prefetch_related("lines__product")
            .all()
        )
        status_value = (self.request.query_params.get("status") or "").strip()
        customer_id = (self.request.query_params.get("customer") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if search:
            queryset = queryset.filter(Q(reference__icontains=search) | Q(customer__name__icontains=search))
        return queryset

    def _get_or_create_folder(self, name: str, parent, user):
        folder = DocumentFolder.objects.filter(name=name, parent=parent).first()
        if folder:
            return folder
        return DocumentFolder.objects.create(name=name, parent=parent, created_by=user)

    def _order_lines_quantities(self, order: SalesOrder):
        lines = list(order.lines.select_related("product"))
        quantities = {}
        for line in lines:
            quantities[line.product_id] = quantities.get(line.product_id, Decimal("0")) + (line.quantity or Decimal("0"))
        return lines, quantities

    def _apply_stock_on_confirmation(self, order: SalesOrder):
        lines, quantities = self._order_lines_quantities(order)
        if not lines:
            raise ValidationError({"lines": "Impossible de confirmer une commande sans lignes."})
        products = SalesProduct.objects.select_for_update().filter(id__in=quantities.keys())
        products_by_id = {product.id: product for product in products}
        for product_id, total_qty in quantities.items():
            product = products_by_id.get(product_id)
            if not product:
                continue
            projected = (product.stock_quantity or Decimal("0")) - total_qty
            if projected < Decimal("0"):
                raise ValidationError(
                    {
                        "status": (
                            f"Stock insuffisant pour confirmer la commande: "
                            f"{product.name} ({product.sku})"
                        )
                    }
                )
        for product_id, total_qty in quantities.items():
            product = products_by_id.get(product_id)
            if not product:
                continue
            product.stock_quantity = (product.stock_quantity or Decimal("0")) - total_qty
            product.save(update_fields=["stock_quantity", "updated_at"])
        for line in lines:
            SalesStockMovement.objects.create(
                product=line.product,
                movement_type=SalesStockMovement.TYPE_OUT,
                quantity=line.quantity or Decimal("0"),
                note=f"Sortie stock confirmation commande - {order.reference}",
            )

    def _restore_stock_from_confirmed_order(self, order: SalesOrder):
        lines, quantities = self._order_lines_quantities(order)
        if not lines:
            return
        products = SalesProduct.objects.select_for_update().filter(id__in=quantities.keys())
        products_by_id = {product.id: product for product in products}
        for product_id, total_qty in quantities.items():
            product = products_by_id.get(product_id)
            if not product:
                continue
            product.stock_quantity = (product.stock_quantity or Decimal("0")) + total_qty
            product.save(update_fields=["stock_quantity", "updated_at"])
        for line in lines:
            SalesStockMovement.objects.create(
                product=line.product,
                movement_type=SalesStockMovement.TYPE_IN,
                quantity=line.quantity or Decimal("0"),
                note=f"Retour stock annulation commande - {order.reference}",
            )

    def _delete_order_invoice_artifacts(self, order: SalesOrder):
        invoice_document = order.invoice_document
        invoice = order.invoice
        # Evite de re-pousser des FK supprimees lors du serializer.save().
        order.invoice = None
        order.invoice_document = None
        if invoice_document:
            invoice_document.delete()
        if invoice:
            invoice.delete()

    def _handle_status_transition(self, order: SalesOrder, previous_status: str, next_status: str):
        if previous_status == next_status:
            return
        if previous_status != SalesOrder.STATUS_CONFIRMED and next_status == SalesOrder.STATUS_CONFIRMED:
            self._apply_stock_on_confirmation(order)
        if previous_status == SalesOrder.STATUS_CONFIRMED and next_status != SalesOrder.STATUS_CONFIRMED:
            self._restore_stock_from_confirmed_order(order)
        if next_status == SalesOrder.STATUS_CANCELLED:
            self._delete_order_invoice_artifacts(order)

    def perform_update(self, serializer):
        order = serializer.instance
        previous_status = order.status
        next_status = serializer.validated_data.get("status", previous_status)
        with transaction.atomic():
            self._handle_status_transition(order, previous_status, next_status)
            serializer.save()

    def _render_invoice_pdf(self, invoice: FinanceInvoice, order: SalesOrder, tenant, payment_info=None) -> bytes:
        buf = BytesIO()
        pdf = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        margin = 36
        y = height - margin

        tenant_name = getattr(tenant, "name", "") or "Entreprise"
        tenant_slogan = getattr(tenant, "slogan", "") or ""
        legal_profile = getattr(tenant, "legal_profile", None)
        tenant_email = "-"
        tenant_phone = "-"
        tenant_address = "-"
        tenant_city = "-"
        tenant_country = "-"
        if legal_profile:
            tenant_email = legal_profile.company_email or "-"
            tenant_phone = legal_profile.company_phone or legal_profile.admin_phone or "-"
            tenant_address = legal_profile.address_line or "-"
            tenant_city = legal_profile.city or "-"
            tenant_country = legal_profile.country or "-"
        customer = order.customer
        payment_info = payment_info or {}

        # Header band
        pdf.setFillColor(colors.HexColor("#0B1220"))
        pdf.roundRect(margin, y - 70, width - (margin * 2), 64, 10, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(margin + 14, y - 30, "FACTURE")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(margin + 14, y - 46, f"{tenant_name}")
        if tenant_slogan:
            pdf.drawString(margin + 14, y - 58, tenant_slogan[:60])

        # Tenant logo
        logo = getattr(tenant, "logo", None)
        if logo:
            try:
                logo.open("rb")
                pdf.drawImage(
                    ImageReader(logo.file),
                    width - margin - 56,
                    y - 62,
                    42,
                    42,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass

        y -= 86

        # Invoice meta block
        pdf.setFillColor(colors.HexColor("#F8FAFC"))
        pdf.setStrokeColor(colors.HexColor("#D1D5DB"))
        pdf.roundRect(margin, y - 70, width - (margin * 2), 64, 8, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#0F172A"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(margin + 12, y - 22, f"Numero facture: {invoice.number}")
        pdf.drawString(margin + 12, y - 36, f"Commande: {order.reference}")
        pdf.drawString(margin + 12, y - 50, f"Date emission: {invoice.issued_on.isoformat()}")
        pdf.drawRightString(width - margin - 12, y - 22, f"Echeance: {invoice.due_on.isoformat() if invoice.due_on else '-'}")
        pdf.drawRightString(width - margin - 12, y - 36, f"Statut: {invoice.status}")
        pdf.drawRightString(width - margin - 12, y - 50, f"Devise: {invoice.currency_code}")

        y -= 82

        # Customer block
        pdf.setFillColor(colors.HexColor("#FFFFFF"))
        pdf.setStrokeColor(colors.HexColor("#D1D5DB"))
        pdf.roundRect(margin, y - 84, width - (margin * 2), 78, 8, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#111827"))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(margin + 12, y - 22, "Informations client")
        pdf.setFont("Helvetica", 9.5)
        pdf.drawString(margin + 12, y - 38, f"Nom: {customer.name}")
        pdf.drawString(margin + 12, y - 52, f"Entreprise: {customer.company or '-'}")
        pdf.drawString(margin + 12, y - 66, f"Email: {customer.email or '-'}")
        pdf.drawRightString(width - margin - 12, y - 38, f"Telephone: {customer.phone or '-'}")
        pdf.drawRightString(width - margin - 12, y - 52, f"Ville/Pays: {(customer.city or '-')}, {(customer.country or '-')}")
        pdf.drawRightString(width - margin - 12, y - 66, f"ID fiscal: {customer.tax_id or '-'}")

        y -= 96

        # Table header
        pdf.setFillColor(colors.HexColor("#0F172A"))
        pdf.setStrokeColor(colors.HexColor("#0F172A"))
        pdf.rect(margin, y - 18, width - (margin * 2), 18, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(margin + 8, y - 12, "Description")
        pdf.drawRightString(width - margin - 168, y - 12, "Qte")
        pdf.drawRightString(width - margin - 112, y - 12, "PU")
        pdf.drawRightString(width - margin - 56, y - 12, "Total")
        y -= 26

        pdf.setFillColor(colors.HexColor("#111827"))
        pdf.setFont("Helvetica", 9)
        for line in invoice.lines.all():
            if y < 120:
                pdf.showPage()
                y = height - 50
                pdf.setFont("Helvetica", 10)
            pdf.setStrokeColor(colors.HexColor("#E5E7EB"))
            pdf.line(margin, y - 3, width - margin, y - 3)
            pdf.drawString(margin + 8, y, (line.description or "")[:62])
            pdf.drawRightString(width - margin - 168, y, str(line.quantity))
            pdf.drawRightString(width - margin - 112, y, f"{line.unit_price}")
            pdf.drawRightString(width - margin - 56, y, f"{line.line_total}")
            y -= 16

        # Totals card
        y -= 6
        totals_w = 230
        totals_x = width - margin - totals_w
        pdf.setFillColor(colors.HexColor("#F8FAFC"))
        pdf.setStrokeColor(colors.HexColor("#D1D5DB"))
        pdf.roundRect(totals_x, y - 62, totals_w, 58, 8, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#111827"))
        pdf.setFont("Helvetica", 10)
        pdf.drawString(totals_x + 10, y - 20, "Sous-total")
        pdf.drawRightString(totals_x + totals_w - 10, y - 20, f"{invoice.subtotal_amount}")
        pdf.drawString(totals_x + 10, y - 34, "Taxe")
        pdf.drawRightString(totals_x + totals_w - 10, y - 34, f"{invoice.tax_amount}")
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(totals_x + 10, y - 50, "Total")
        pdf.drawRightString(totals_x + totals_w - 10, y - 50, f"{invoice.total_amount} {invoice.currency_code}")

        # Payment information block
        payment_method = payment_info.get("method_label") or "-"
        payment_reference = payment_info.get("reference") or "-"
        payment_received = payment_info.get("amount_received")
        payment_change = payment_info.get("change_amount")
        payment_y = y - 86
        pdf.setFillColor(colors.HexColor("#FFFFFF"))
        pdf.setStrokeColor(colors.HexColor("#D1D5DB"))
        pdf.roundRect(margin, payment_y - 54, width - (margin * 2), 50, 8, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#111827"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(margin + 10, payment_y - 18, "Informations de paiement")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(margin + 10, payment_y - 32, f"Mode: {payment_method}")
        pdf.drawString(margin + 180, payment_y - 32, f"Reference: {payment_reference}")
        if payment_received is not None or payment_change is not None:
            pdf.drawString(margin + 10, payment_y - 45, f"Montant recu: {payment_received or '-'} {invoice.currency_code}")
            pdf.drawString(margin + 180, payment_y - 45, f"Monnaie: {payment_change or '-'} {invoice.currency_code}")

        # Footer note
        pdf.setFont("Helvetica-Oblique", 8.5)
        pdf.setFillColor(colors.HexColor("#6B7280"))
        pdf.drawString(margin, 28, f"Contact {tenant_name} - Email: {tenant_email} | Tel: {tenant_phone}")
        pdf.drawRightString(width - margin, 28, f"{tenant_city}, {tenant_country}")
        pdf.drawString(margin, 16, f"Adresse: {tenant_address}")

        pdf.showPage()
        pdf.save()
        return buf.getvalue()

    @action(detail=True, methods=["post"], url_path="create-invoice")
    def create_invoice(self, request, pk=None):
        order = self.get_object()
        if order.status != SalesOrder.STATUS_CONFIRMED:
            raise ValidationError({"status": "Seules les commandes confirmees peuvent etre facturees."})
        if order.invoice_id:
            return Response(
                {
                    "invoice_id": str(order.invoice_id),
                    "invoice_number": order.invoice.number,
                    "message": "Cette commande est deja facturee.",
                }
            )
        if not order.lines.exists():
            raise ValidationError({"lines": "Impossible de facturer une commande sans lignes."})
        payment_method = (request.data.get("payment_method") or "").strip().lower()
        payment_reference = (request.data.get("payment_reference") or "").strip()
        amount_received_raw = request.data.get("amount_received")
        payment_labels = {
            "mobile_money": "Mobile money",
            "cheque": "Cheque",
            "bank_transfer": "Virement",
            "cash": "Especes",
            "other": "Autre",
        }
        if payment_method not in payment_labels:
            raise ValidationError({"payment_method": "Mode de paiement invalide."})
        amount_received = None
        change_amount = None
        if payment_method != "cash" and not payment_reference:
            raise ValidationError({"payment_reference": "Reference de paiement obligatoire hors especes."})

        issued_on = timezone.now().date()
        base_number = f"FAC-{order.reference.replace('CMD-', '')}"
        number = base_number
        sequence = 2
        while FinanceInvoice.objects.filter(number=number).exists():
            number = f"{base_number}-{sequence}"
            sequence += 1

        with transaction.atomic():
            invoice = FinanceInvoice.objects.create(
                number=number,
                customer_name=order.customer.name,
                customer_email=order.customer.email or "",
                customer_phone=order.customer.phone or "",
                currency_code="XOF",
                issued_on=issued_on,
                due_on=issued_on,
                status=FinanceInvoice.STATUS_ISSUED,
                notes=f"Facture generee depuis commande {order.reference}",
                owner=request.user,
            )
            subtotal = Decimal("0")
            for line in order.lines.select_related("product"):
                FinanceInvoiceLine.objects.create(
                    invoice=invoice,
                    description=f"{line.product.name} ({line.product.sku})",
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    tax_rate=Decimal("0"),
                    line_total=line.line_total,
                    owner=request.user,
                )
                subtotal += line.line_total or Decimal("0")
            invoice.subtotal_amount = subtotal.quantize(Decimal("0.01"))
            invoice.tax_amount = Decimal("0.00")
            invoice.total_amount = invoice.subtotal_amount
            if payment_method == "cash":
                if amount_received_raw in (None, ""):
                    raise ValidationError({"amount_received": "Montant recu obligatoire pour un paiement en especes."})
                try:
                    amount_received = Decimal(str(amount_received_raw))
                except Exception:
                    raise ValidationError({"amount_received": "Montant recu invalide."})
                if amount_received < invoice.total_amount:
                    raise ValidationError({"amount_received": "Le montant recu ne peut pas etre inferieur au total facture."})
                change_amount = (amount_received - invoice.total_amount).quantize(Decimal("0.01"))
                payment_reference = payment_reference or "Paiement especes"
            note_parts = [
                f"Facture generee depuis commande {order.reference}",
                f"Mode paiement: {payment_labels[payment_method]}",
                f"Reference paiement: {payment_reference or '-'}",
            ]
            if payment_method == "cash":
                note_parts.append(f"Montant recu: {amount_received}")
                note_parts.append(f"Monnaie rendue: {change_amount}")
            invoice.notes = " | ".join(note_parts)
            invoice.save(update_fields=["subtotal_amount", "tax_amount", "total_amount", "notes", "updated_at"])
            pdf_content = self._render_invoice_pdf(
                invoice,
                order,
                getattr(request, "tenant", None),
                payment_info={
                    "method_label": payment_labels[payment_method],
                    "reference": payment_reference or "-",
                    "amount_received": str(amount_received) if amount_received is not None else None,
                    "change_amount": str(change_amount) if change_amount is not None else None,
                },
            )
            sales_folder = self._get_or_create_folder("Vente", None, request.user)
            invoices_folder = self._get_or_create_folder("Facture", sales_folder, request.user)
            filename = f"{invoice.number}.pdf"
            ged_doc = Document(
                title=f"Facture {invoice.number}",
                description=f"Facture PDF de la commande {order.reference}",
                folder=invoices_folder,
                original_filename=filename,
                mime_type="application/pdf",
                file_size=len(pdf_content),
                uploaded_by=request.user,
            )
            ged_doc.file.save(filename, ContentFile(pdf_content), save=False)
            ged_doc.save()
            order.invoice = invoice
            order.invoice_document = ged_doc
            order.save(update_fields=["invoice", "invoice_document", "updated_at"])

        return Response(
            {
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.number,
                "invoice_status": invoice.status,
                "invoice_document_id": str(order.invoice_document_id),
                "invoice_document_title": order.invoice_document.title,
                "payment_method": payment_method,
                "payment_reference": payment_reference or "",
                "amount_received": str(amount_received) if amount_received is not None else "",
                "change_amount": str(change_amount) if change_amount is not None else "",
                "message": "Facture creee avec succes et enregistree dans GED/Vente/Facture.",
            },
            status=201,
        )


class SalesOrderLineViewSet(viewsets.ModelViewSet):
    serializer_class = SalesOrderLineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SalesOrderLine.objects.select_related("order", "product").all()
        order_id = (self.request.query_params.get("order") or "").strip()
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset


class SalesStockMovementViewSet(viewsets.ModelViewSet):
    serializer_class = SalesStockMovementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SalesStockMovement.objects.select_related("product").all()
        product_id = (self.request.query_params.get("product") or "").strip()
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        products = SalesProduct.objects.filter(is_active=True)
        total_products = products.count()
        out_of_stock = products.filter(stock_quantity__lte=0).count()
        low_stock = products.filter(stock_quantity__gt=0, stock_quantity__lte=F("reorder_level")).count()
        return Response(
            {
                "total_products": total_products,
                "out_of_stock": out_of_stock,
                "low_stock": low_stock,
                "healthy_stock": max(total_products - out_of_stock - low_stock, 0),
            }
        )
