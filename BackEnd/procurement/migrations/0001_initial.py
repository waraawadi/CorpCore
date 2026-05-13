import uuid
from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProcurementSupplier",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200)),
                ("company", models.CharField(blank=True, default="", max_length=200)),
                ("email", models.EmailField(blank=True, default="", max_length=254)),
                ("phone", models.CharField(blank=True, default="", max_length=40)),
                ("city", models.CharField(blank=True, default="", max_length=120)),
                ("country", models.CharField(blank=True, default="", max_length=120)),
                ("address", models.TextField(blank=True, default="")),
                ("tax_id", models.CharField(blank=True, default="", max_length=80)),
                ("notes", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Fournisseur",
                "verbose_name_plural": "Fournisseurs",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="ProcurementPurchaseRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(blank=True, max_length=50, unique=True)),
                ("title", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Brouillon"),
                            ("submitted", "Soumise"),
                            ("approved", "Approuvee"),
                            ("rejected", "Rejetee"),
                            ("fulfilled", "Transformee"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "requested_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="procurement_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Demande d'achat",
                "verbose_name_plural": "Demandes d'achat",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="ProcurementPurchaseOrder",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(blank=True, max_length=50, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Brouillon"),
                            ("sent", "Envoyee"),
                            ("partially_received", "Partiellement recue"),
                            ("received", "Recue"),
                            ("cancelled", "Annulee"),
                        ],
                        default="draft",
                        max_length=30,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("expected_delivery", models.DateField(blank=True, null=True)),
                ("total_amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                (
                    "source_request",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="generated_orders",
                        to="procurement.procurementpurchaserequest",
                    ),
                ),
                (
                    "supplier",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="purchase_orders",
                        to="procurement.procurementsupplier",
                    ),
                ),
            ],
            options={
                "verbose_name": "Bon de commande fournisseur",
                "verbose_name_plural": "Bons de commande fournisseur",
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="ProcurementPurchaseRequestLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("description", models.CharField(max_length=255)),
                ("quantity", models.DecimalField(decimal_places=2, default=Decimal("1"), max_digits=14)),
                ("unit_price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("line_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                (
                    "request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="procurement.procurementpurchaserequest",
                    ),
                ),
            ],
            options={
                "verbose_name": "Ligne demande d'achat",
                "verbose_name_plural": "Lignes demandes d'achat",
                "ordering": ("created_at",),
            },
        ),
        migrations.CreateModel(
            name="ProcurementPurchaseOrderLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("description", models.CharField(max_length=255)),
                ("quantity", models.DecimalField(decimal_places=2, default=Decimal("1"), max_digits=14)),
                ("unit_price", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("line_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="procurement.procurementpurchaseorder",
                    ),
                ),
            ],
            options={
                "verbose_name": "Ligne bon de commande",
                "verbose_name_plural": "Lignes bons de commande",
                "ordering": ("created_at",),
            },
        ),
    ]
