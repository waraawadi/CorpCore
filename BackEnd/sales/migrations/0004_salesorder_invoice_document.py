from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("ged", "0001_initial"),
        ("sales", "0003_merge_0002_sales_updates_0002_salesorder_invoice"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesorder",
            name="invoice_document",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sales_orders",
                to="ged.document",
            ),
        ),
    ]
