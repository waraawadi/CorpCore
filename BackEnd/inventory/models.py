import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class InventoryCategory(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Categorie inventaire"
        verbose_name_plural = "Categories inventaire"

    def __str__(self) -> str:
        return self.name


class InventoryLocation(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=40, blank=True, default="")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Emplacement inventaire"
        verbose_name_plural = "Emplacements inventaire"

    def __str__(self) -> str:
        return self.name


class InventoryItem(TimeStampedModel):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        InventoryCategory,
        on_delete=models.SET_NULL,
        related_name="items",
        blank=True,
        null=True,
    )
    unit = models.CharField(max_length=24, default="unite")
    quantity_on_hand = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    reorder_level = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    selling_price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Article inventaire"
        verbose_name_plural = "Articles inventaire"

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"


class InventoryMovement(TimeStampedModel):
    TYPE_IN = "in"
    TYPE_OUT = "out"
    TYPE_ADJUSTMENT = "adjustment"

    MOVEMENT_TYPES = (
        (TYPE_IN, "Entree"),
        (TYPE_OUT, "Sortie"),
        (TYPE_ADJUSTMENT, "Ajustement"),
    )

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="movements")
    location = models.ForeignKey(
        InventoryLocation,
        on_delete=models.SET_NULL,
        related_name="movements",
        blank=True,
        null=True,
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    reference = models.CharField(max_length=120, blank=True, default="")
    note = models.TextField(blank=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    moved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="inventory_movements",
    )

    class Meta:
        ordering = ("-occurred_at", "-created_at")
        verbose_name = "Mouvement inventaire"
        verbose_name_plural = "Mouvements inventaire"

    def __str__(self) -> str:
        return f"{self.item.sku} - {self.movement_type} - {self.quantity}"


class InventoryAssetReference(TimeStampedModel):
    STATUS_IN_STOCK = "in_stock"
    STATUS_ASSIGNED = "assigned"
    STATUS_OUT = "out"
    STATUS_CHOICES = (
        (STATUS_IN_STOCK, "En stock"),
        (STATUS_ASSIGNED, "Affecte"),
        (STATUS_OUT, "Sorti"),
    )

    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="asset_references")
    serial_number = models.CharField(max_length=140, unique=True)
    source_movement_in = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="created_references",
    )
    source_movement_out = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="output_references",
    )
    location = models.ForeignKey(
        InventoryLocation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="asset_references",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_STOCK)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="assigned_inventory_assets",
    )
    assigned_at = models.DateTimeField(blank=True, null=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Reference inventaire"
        verbose_name_plural = "References inventaire"

    def __str__(self) -> str:
        return f"{self.item.sku} - {self.serial_number}"
