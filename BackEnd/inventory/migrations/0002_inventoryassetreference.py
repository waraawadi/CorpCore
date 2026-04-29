import django.db.models.deletion
import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryAssetReference",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("serial_number", models.CharField(max_length=140, unique=True)),
                ("status", models.CharField(choices=[("in_stock", "En stock"), ("assigned", "Affecte"), ("out", "Sorti")], default="in_stock", max_length=20)),
                ("assigned_at", models.DateTimeField(blank=True, null=True)),
                ("note", models.TextField(blank=True)),
                (
                    "assigned_to",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="assigned_inventory_assets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="asset_references", to="inventory.inventoryitem"),
                ),
                (
                    "location",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asset_references",
                        to="inventory.inventorylocation",
                    ),
                ),
                (
                    "source_movement_in",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_references",
                        to="inventory.inventorymovement",
                    ),
                ),
                (
                    "source_movement_out",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="output_references",
                        to="inventory.inventorymovement",
                    ),
                ),
            ],
            options={
                "verbose_name": "Reference inventaire",
                "verbose_name_plural": "References inventaire",
                "ordering": ("-created_at",),
            },
        ),
    ]
