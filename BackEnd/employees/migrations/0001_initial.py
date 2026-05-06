from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EmployeeProfile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("employee_number", models.CharField(blank=True, default="", max_length=60)),
                ("nationality", models.CharField(max_length=120)),
                ("date_of_birth", models.DateField()),
                ("place_of_birth", models.CharField(max_length=120)),
                ("gender", models.CharField(choices=[("male", "Male"), ("female", "Female"), ("other", "Other")], max_length=20)),
                (
                    "marital_status",
                    models.CharField(
                        choices=[("single", "Single"), ("married", "Married"), ("divorced", "Divorced"), ("widowed", "Widowed")],
                        max_length=20,
                    ),
                ),
                ("national_id_number", models.CharField(max_length=120)),
                ("id_document_type", models.CharField(blank=True, default="", max_length=120)),
                ("job_title", models.CharField(max_length=120)),
                ("department", models.CharField(max_length=120)),
                ("hire_date", models.DateField()),
                ("professional_email", models.EmailField(max_length=254)),
                ("phone_number", models.CharField(max_length=40)),
                ("residential_country", models.CharField(max_length=120)),
                ("residential_city", models.CharField(max_length=120)),
                ("residential_address", models.CharField(max_length=255)),
                ("is_company_admin", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="employee_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
