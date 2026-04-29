import uuid

from django.conf import settings
from django.db import models


def document_upload_to(instance, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if len(ext) > 12:
        ext = "bin"
    return f"ged/{uuid.uuid4()}.{ext}"


class DocumentFolder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ged_folders_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    folder = models.ForeignKey(
        DocumentFolder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="documents",
    )
    file = models.FileField(upload_to=document_upload_to)
    original_filename = models.CharField(max_length=255, blank=True, default="")
    mime_type = models.CharField(max_length=120, blank=True, default="")
    file_size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ged_documents",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Document GED"
        verbose_name_plural = "Documents GED"

    def __str__(self) -> str:
        return self.title


class GedShare(models.Model):
    """Partage d'un dossier ou d'un document avec un utilisateur du tenant."""

    ROLE_VIEWER = "viewer"
    ROLE_EDITOR = "editor"
    ROLE_CHOICES = (
        (ROLE_VIEWER, "Lecture"),
        (ROLE_EDITOR, "Modification"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folder = models.ForeignKey(
        DocumentFolder,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ged_shares",
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ged_shares",
    )
    shared_with = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ged_shares_received",
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ged_shares_sent",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(folder__isnull=False, document__isnull=True)
                    | models.Q(folder__isnull=True, document__isnull=False)
                ),
                name="ged_share_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=("shared_with", "folder"),
                condition=models.Q(folder__isnull=False),
                name="uniq_ged_share_folder_user",
            ),
            models.UniqueConstraint(
                fields=("shared_with", "document"),
                condition=models.Q(document__isnull=False),
                name="uniq_ged_share_document_user",
            ),
        ]
        ordering = ("-created_at",)

    def __str__(self) -> str:
        if self.folder_id:
            return f"{self.folder} -> {self.shared_with}"
        return f"{self.document} -> {self.shared_with}"
