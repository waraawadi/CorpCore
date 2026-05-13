import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ProcurementSupplier(TimeStampedModel):
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    country = models.CharField(max_length=120, blank=True, default="")
    address = models.TextField(blank=True, default="")
    tax_id = models.CharField(max_length=80, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"

    def __str__(self) -> str:
        return self.name


class ProcurementPurchaseRequest(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_FULFILLED = "fulfilled"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Brouillon"),
        (STATUS_SUBMITTED, "Soumise"),
        (STATUS_APPROVED, "Approuvee"),
        (STATUS_REJECTED, "Rejetee"),
        (STATUS_FULFILLED, "Transformee"),
    )

    reference = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True, default="")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurement_requests",
    )

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Demande d'achat"
        verbose_name_plural = "Demandes d'achat"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"DA-{timezone.now():%Y%m%d}-{str(uuid.uuid4())[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.reference or str(self.id)

    def can_be_linked_to_new_purchase_order(self) -> bool:
        """Demande utilisable pour un nouveau BC : statut approuve et aucun BC deja rattache."""
        return self.status == self.STATUS_APPROVED and not self.generated_orders.exists()


class ProcurementPurchaseRequestLine(TimeStampedModel):
    request = models.ForeignKey(
        ProcurementPurchaseRequest,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Ligne demande d'achat"
        verbose_name_plural = "Lignes demandes d'achat"

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity or Decimal("0")) * (self.unit_price or Decimal("0"))
        super().save(*args, **kwargs)
        self.request.save(update_fields=["updated_at"])

    def __str__(self) -> str:
        return f"{self.request.reference} - {self.description}"


class ProcurementPurchaseOrder(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_PARTIALLY_RECEIVED = "partially_received"
    STATUS_RECEIVED = "received"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Brouillon"),
        (STATUS_SENT, "Envoyee"),
        (STATUS_PARTIALLY_RECEIVED, "Partiellement recue"),
        (STATUS_RECEIVED, "Recue"),
        (STATUS_CANCELLED, "Annulee"),
    )

    reference = models.CharField(max_length=50, unique=True, blank=True)
    supplier = models.ForeignKey(
        ProcurementSupplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    notes = models.TextField(blank=True, default="")
    expected_delivery = models.DateField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    source_request = models.ForeignKey(
        ProcurementPurchaseRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_orders",
    )

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Bon de commande fournisseur"
        verbose_name_plural = "Bons de commande fournisseur"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"BC-{timezone.now():%Y%m%d}-{str(uuid.uuid4())[:8].upper()}"
        super().save(*args, **kwargs)

    def recompute_total(self):
        total = self.lines.aggregate(total=Sum("line_total")).get("total") or Decimal("0")
        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])

    def __str__(self) -> str:
        return self.reference or str(self.id)


class ProcurementPurchaseOrderLine(TimeStampedModel):
    order = models.ForeignKey(
        ProcurementPurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Ligne bon de commande"
        verbose_name_plural = "Lignes bons de commande"

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity or Decimal("0")) * (self.unit_price or Decimal("0"))
        super().save(*args, **kwargs)
        self.order.recompute_total()

    def delete(self, *args, **kwargs):
        order = self.order
        super().delete(*args, **kwargs)
        order.recompute_total()

    def __str__(self) -> str:
        return f"{self.order.reference} - {self.description}"
