from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0008_client_currency_code"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="hero_image",
            field=models.ImageField(blank=True, null=True, upload_to="tenants/heroes/"),
        ),
        migrations.AddField(
            model_name="client",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="tenants/logos/"),
        ),
        migrations.AddField(
            model_name="client",
            name="slogan",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
