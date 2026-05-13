from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0002_finance_billing_and_documents"),
        ("sales", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesorder",
            name="invoice",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sales_orders",
                to="finance.financeinvoice",
            ),
        ),
    ]
