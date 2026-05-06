from django.db import migrations


def create_ged_module(apps, schema_editor):
    BillingModule = apps.get_model("subscriptions", "BillingModule")
    BillingModule.objects.get_or_create(
        code="ged",
        defaults={
            "name": "GED",
            "monthly_price_xof": 15000,
            "is_active": True,
        },
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0003_alter_billingmodule_id_alter_tenantsubscription_id"),
    ]

    operations = [
        migrations.RunPython(create_ged_module, noop),
    ]
