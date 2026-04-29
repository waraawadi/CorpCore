from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import projects.models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("ged", "0002_ged_share_and_folder_owner"),
        ("projects", "0004_inappnotification"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="taskattachment",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to=projects.models.project_attachment_upload_to),
        ),
        migrations.AddField(
            model_name="taskattachment",
            name="ged_document",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="task_attachments",
                to="ged.document",
            ),
        ),
        migrations.AddField(
            model_name="taskattachment",
            name="source",
            field=models.CharField(
                choices=[("upload", "Upload"), ("ged", "GED"), ("link", "Link")],
                default="link",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="ProjectAttachment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("file_url", models.URLField(max_length=1024)),
                ("mime_type", models.CharField(blank=True, max_length=120)),
                ("file_size", models.PositiveBigIntegerField(default=0)),
                (
                    "source",
                    models.CharField(
                        choices=[("upload", "Upload"), ("ged", "GED"), ("link", "Link")],
                        default="link",
                        max_length=16,
                    ),
                ),
                ("file", models.FileField(blank=True, null=True, upload_to=projects.models.project_attachment_upload_to)),
                (
                    "ged_document",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="project_attachments",
                        to="ged.document",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="projects.project"),
                ),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="project_attachments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
