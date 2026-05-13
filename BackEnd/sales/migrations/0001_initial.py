import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SalesCustomer",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=160)),
                ("email", models.EmailField(blank=True, default="", max_length=254)),
                ("phone", models.CharField(blank=True, default="", max_length=40)),
                ("address", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Client vente",
                "verbose_name_plural": "Clients ventes",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="SalesProduct",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=180)),
                ("sku", models.CharField(max_length=80, unique=True)),
                ("description", models.TextField(blank=True, default="")),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Produit vente",
                "verbose_name_plural": "Produits ventes",
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="SalesOrder",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(blank=True, max_length=50, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Brouillon"), ("confirmed", "Confirmee"), ("cancelled", "Annulee")],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("ordered_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("notes", models.TextField(blank=True, default="")),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                (
                    "customer",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="orders", to="sales.salescustomer"),
                ),
            ],
            options={
                "verbose_name": "Commande vente",
                "verbose_name_plural": "Commandes ventes",
                "ordering": ("-ordered_at", "-created_at"),
            },
        ),
        migrations.CreateModel(
            name="SalesOrderLine",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("quantity", models.DecimalField(decimal_places=2, default=1, max_digits=14)),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("line_total", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                (
                    "order",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="sales.salesorder"),
                ),
                (
                    "product",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="order_lines", to="sales.salesproduct"),
                ),
            ],
            options={
                "verbose_name": "Ligne commande vente",
                "verbose_name_plural": "Lignes commandes ventes",
                "ordering": ("created_at",),
            },
        ),
    ]
