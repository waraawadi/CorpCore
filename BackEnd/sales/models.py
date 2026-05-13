import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SalesCustomer(TimeStampedModel):
    name = models.CharField(max_length=160)
    company = models.CharField(max_length=180, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    country = models.CharField(max_length=120, blank=True, default="")
    tax_id = models.CharField(max_length=80, blank=True, default="")
    address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Client vente"
        verbose_name_plural = "Clients ventes"

    def __str__(self) -> str:
        return self.name


class SalesProduct(TimeStampedModel):
    name = models.CharField(max_length=180)
    sku = models.CharField(max_length=80, unique=True, blank=True)
    description = models.TextField(blank=True, default="")
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    stock_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    reorder_level = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Produit vente"
        verbose_name_plural = "Produits ventes"

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"

    def save(self, *args, **kwargs):
        if not self.sku:
            self.sku = f"SKU-{timezone.now():%y%m%d}-{str(uuid.uuid4())[:6].upper()}"
        super().save(*args, **kwargs)


class SalesOrder(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_CONFIRMED = "confirmed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Brouillon"),
        (STATUS_CONFIRMED, "Confirmee"),
        (STATUS_CANCELLED, "Annulee"),
    )

    reference = models.CharField(max_length=50, unique=True, blank=True)
    customer = models.ForeignKey(SalesCustomer, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    ordered_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default="")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    invoice = models.ForeignKey(
        "finance.FinanceInvoice",
        on_delete=models.SET_NULL,
        related_name="sales_orders",
        null=True,
        blank=True,
    )
    invoice_document = models.ForeignKey(
        "ged.Document",
        on_delete=models.SET_NULL,
        related_name="sales_orders",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ("-ordered_at", "-created_at")
        verbose_name = "Commande vente"
        verbose_name_plural = "Commandes ventes"

    def __str__(self) -> str:
        return self.reference or f"Commande {self.id}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"CMD-{timezone.now():%Y%m%d}-{str(uuid.uuid4())[:8].upper()}"
        super().save(*args, **kwargs)

    def recompute_total(self):
        total = self.lines.aggregate(total=models.Sum("line_total")).get("total") or Decimal("0")
        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])


class SalesOrderLine(TimeStampedModel):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(SalesProduct, on_delete=models.PROTECT, related_name="order_lines")
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Ligne commande vente"
        verbose_name_plural = "Lignes commandes ventes"

    def __str__(self) -> str:
        return f"{self.order.reference} - {self.product.name}"

    def _create_movement(self, product, movement_type: str, quantity: Decimal, note: str):
        if not quantity or quantity == Decimal("0"):
            return
        SalesStockMovement.objects.create(
            product=product,
            movement_type=movement_type,
            quantity=quantity,
            note=note,
        )

    def save(self, *args, **kwargs):
        is_create = self._state.adding
        previous_product = None
        previous_quantity = Decimal("0")
        old_quantity = Decimal("0")
        if not is_create:
            previous = SalesOrderLine.objects.filter(pk=self.pk).select_related("product").only("quantity", "product_id").first()
            if previous:
                previous_product = previous.product
                previous_quantity = previous.quantity or Decimal("0")
                if previous.product_id == self.product_id:
                    old_quantity = previous.quantity or Decimal("0")
        self.line_total = (self.quantity or Decimal("0")) * (self.unit_price or Decimal("0"))
        super().save(*args, **kwargs)
        # Les lignes en brouillon n'impactent pas le stock.
        if self.order.status != SalesOrder.STATUS_CONFIRMED:
            self.order.recompute_total()
            return
        if previous_product and previous_product.id != self.product_id:
            previous_product.stock_quantity = (previous_product.stock_quantity or Decimal("0")) + previous_quantity
            previous_product.save(update_fields=["stock_quantity", "updated_at"])
            self._create_movement(
                previous_product,
                SalesStockMovement.TYPE_IN,
                previous_quantity,
                f"Retour stock (changement produit) - {self.order.reference}",
            )
            self.product.stock_quantity = (self.product.stock_quantity or Decimal("0")) - (self.quantity or Decimal("0"))
            self.product.save(update_fields=["stock_quantity", "updated_at"])
            self._create_movement(
                self.product,
                SalesStockMovement.TYPE_OUT,
                self.quantity or Decimal("0"),
                f"Sortie stock commande - {self.order.reference}",
            )
        else:
            quantity_delta = (self.quantity or Decimal("0")) - old_quantity
            if quantity_delta:
                self.product.stock_quantity = (self.product.stock_quantity or Decimal("0")) - quantity_delta
                self.product.save(update_fields=["stock_quantity", "updated_at"])
                movement_type = SalesStockMovement.TYPE_OUT if quantity_delta > 0 else SalesStockMovement.TYPE_IN
                self._create_movement(
                    self.product,
                    movement_type,
                    abs(quantity_delta),
                    f"Ajustement ligne commande - {self.order.reference}",
                )
        self.order.recompute_total()

    def delete(self, *args, **kwargs):
        order = self.order
        product = self.product
        if order.status == SalesOrder.STATUS_CONFIRMED:
            product.stock_quantity = (product.stock_quantity or Decimal("0")) + (self.quantity or Decimal("0"))
            product.save(update_fields=["stock_quantity", "updated_at"])
            self._create_movement(
                product,
                SalesStockMovement.TYPE_IN,
                self.quantity or Decimal("0"),
                f"Suppression ligne commande - {order.reference}",
            )
        super().delete(*args, **kwargs)
        order.recompute_total()


class SalesStockMovement(TimeStampedModel):
    TYPE_IN = "in"
    TYPE_OUT = "out"
    TYPE_ADJUSTMENT = "adjustment"
    TYPE_CHOICES = (
        (TYPE_IN, "Entree"),
        (TYPE_OUT, "Sortie"),
        (TYPE_ADJUSTMENT, "Ajustement"),
    )

    product = models.ForeignKey(SalesProduct, on_delete=models.CASCADE, related_name="stock_movements")
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_ADJUSTMENT)
    quantity = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Mouvement de stock vente"
        verbose_name_plural = "Mouvements de stock ventes"

    def __str__(self) -> str:
        return f"{self.product.sku} - {self.movement_type} - {self.quantity}"
