from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0004_alter_client_id_alter_companylegalprofile_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="currency_code",
            field=models.CharField(default="XOF", max_length=3),
        ),
    ]

