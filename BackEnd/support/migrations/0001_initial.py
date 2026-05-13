import uuid

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
            name="SupportTicket",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(blank=True, max_length=50, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("general", "General"),
                            ("access", "Acces et comptes"),
                            ("billing", "Facturation et abonnement"),
                            ("bug", "Bug ou incident"),
                            ("feature", "Demande d evolution"),
                            ("other", "Autre"),
                        ],
                        default="general",
                        max_length=32,
                    ),
                ),
                (
                    "priority",
                    models.CharField(
                        choices=[
                            ("low", "Basse"),
                            ("normal", "Normale"),
                            ("high", "Haute"),
                            ("urgent", "Urgente"),
                        ],
                        default="normal",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Ouvert"),
                            ("in_progress", "En cours"),
                            ("waiting_customer", "En attente demandeur"),
                            ("resolved", "Resolu"),
                            ("closed", "Ferme"),
                        ],
                        default="open",
                        max_length=32,
                    ),
                ),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "assignee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="support_tickets_assigned",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "requester",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="support_tickets_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
                "verbose_name": "Ticket support",
                "verbose_name_plural": "Tickets support",
            },
        ),
        migrations.CreateModel(
            name="SupportTicketComment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("body", models.TextField()),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="support_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "ticket",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="support.supportticket",
                    ),
                ),
            ],
            options={
                "ordering": ("created_at",),
                "verbose_name": "Commentaire ticket",
                "verbose_name_plural": "Commentaires tickets",
            },
        ),
    ]
