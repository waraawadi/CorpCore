import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="salescustomer",
            name="city",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="salescustomer",
            name="company",
            field=models.CharField(blank=True, default="", max_length=180),
        ),
        migrations.AddField(
            model_name="salescustomer",
            name="country",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="salescustomer",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="salescustomer",
            name="tax_id",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="salesproduct",
            name="reorder_level",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="salesproduct",
            name="stock_quantity",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AlterField(
            model_name="salesproduct",
            name="sku",
            field=models.CharField(blank=True, max_length=80, unique=True),
        ),
        migrations.CreateModel(
            name="SalesStockMovement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("movement_type", models.CharField(choices=[("in", "Entree"), ("out", "Sortie"), ("adjustment", "Ajustement")], default="adjustment", max_length=20)),
                ("quantity", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("note", models.TextField(blank=True, default="")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_movements", to="sales.salesproduct")),
            ],
            options={
                "verbose_name": "Mouvement de stock vente",
                "verbose_name_plural": "Mouvements de stock ventes",
                "ordering": ("-created_at",),
            },
        ),
    ]
