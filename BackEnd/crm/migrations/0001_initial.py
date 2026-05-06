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
            name="CrmContact",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("first_name", models.CharField(max_length=120)),
                ("last_name", models.CharField(blank=True, default="", max_length=120)),
                ("email", models.EmailField(blank=True, default="", max_length=254)),
                ("phone", models.CharField(blank=True, default="", max_length=60)),
                ("company_name", models.CharField(blank=True, default="", max_length=255)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="crm_contacts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("last_name", "first_name"),
            },
        ),
        migrations.CreateModel(
            name="CrmLead",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=255)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "New"),
                            ("contacted", "Contacted"),
                            ("qualified", "Qualified"),
                            ("lost", "Lost"),
                            ("converted", "Converted"),
                        ],
                        default="new",
                        max_length=32,
                    ),
                ),
                ("source", models.CharField(blank=True, default="", max_length=120)),
                ("estimated_value", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("next_follow_up_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "contact",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="leads",
                        to="crm.crmcontact",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="crm_leads",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="CrmOpportunity",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                (
                    "stage",
                    models.CharField(
                        choices=[
                            ("discovery", "Discovery"),
                            ("proposal", "Proposal"),
                            ("negotiation", "Negotiation"),
                            ("closed_won", "Closed won"),
                            ("closed_lost", "Closed lost"),
                        ],
                        default="discovery",
                        max_length=32,
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("probability", models.PositiveSmallIntegerField(default=0)),
                ("expected_close_date", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "contact",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="opportunities",
                        to="crm.crmcontact",
                    ),
                ),
                (
                    "lead",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="opportunities",
                        to="crm.crmlead",
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="crm_opportunities",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.CreateModel(
            name="CrmActivity",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "activity_type",
                    models.CharField(
                        choices=[
                            ("call", "Call"),
                            ("email", "Email"),
                            ("meeting", "Meeting"),
                            ("note", "Note"),
                        ],
                        default="note",
                        max_length=32,
                    ),
                ),
                ("subject", models.CharField(max_length=255)),
                ("body", models.TextField(blank=True, default="")),
                (
                    "contact",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="crm.crmcontact",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="crm_activities",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "lead",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="crm.crmlead",
                    ),
                ),
                (
                    "opportunity",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="crm.crmopportunity",
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
    ]
