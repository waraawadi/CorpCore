import django.db.models.deletion
import django.utils.timezone
import uuid
from decimal import Decimal

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryCategory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Categorie inventaire",
                "verbose_name_plural": "Categories inventaire",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="InventoryLocation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120, unique=True)),
                ("code", models.CharField(blank=True, default="", max_length=40)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Emplacement inventaire",
                "verbose_name_plural": "Emplacements inventaire",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="InventoryItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200)),
                ("sku", models.CharField(max_length=80, unique=True)),
                ("description", models.TextField(blank=True)),
                ("unit", models.CharField(default="unite", max_length=24)),
                ("quantity_on_hand", models.DecimalField(decimal_places=3, default=Decimal("0"), max_digits=14)),
                ("reorder_level", models.DecimalField(decimal_places=3, default=Decimal("0"), max_digits=14)),
                ("cost_price", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("selling_price", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="items",
                        to="inventory.inventorycategory",
                    ),
                ),
            ],
            options={
                "verbose_name": "Article inventaire",
                "verbose_name_plural": "Articles inventaire",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="InventoryMovement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("movement_type", models.CharField(choices=[("in", "Entree"), ("out", "Sortie"), ("adjustment", "Ajustement")], max_length=20)),
                ("quantity", models.DecimalField(decimal_places=3, max_digits=14)),
                ("unit_cost", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("reference", models.CharField(blank=True, default="", max_length=120)),
                ("note", models.TextField(blank=True)),
                ("occurred_at", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "item",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movements", to="inventory.inventoryitem"),
                ),
                (
                    "location",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="movements",
                        to="inventory.inventorylocation",
                    ),
                ),
                (
                    "moved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inventory_movements",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Mouvement inventaire",
                "verbose_name_plural": "Mouvements inventaire",
                "ordering": ("-occurred_at", "-created_at"),
            },
        ),
    ]
