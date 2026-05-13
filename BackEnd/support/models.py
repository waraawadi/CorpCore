import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SupportTicket(TimeStampedModel):
    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_WAITING_CUSTOMER = "waiting_customer"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = (
        (STATUS_OPEN, "Ouvert"),
        (STATUS_IN_PROGRESS, "En cours"),
        (STATUS_WAITING_CUSTOMER, "En attente demandeur"),
        (STATUS_RESOLVED, "Resolu"),
        (STATUS_CLOSED, "Ferme"),
    )

    PRIORITY_LOW = "low"
    PRIORITY_NORMAL = "normal"
    PRIORITY_HIGH = "high"
    PRIORITY_URGENT = "urgent"
    PRIORITY_CHOICES = (
        (PRIORITY_LOW, "Basse"),
        (PRIORITY_NORMAL, "Normale"),
        (PRIORITY_HIGH, "Haute"),
        (PRIORITY_URGENT, "Urgente"),
    )

    CATEGORY_GENERAL = "general"
    CATEGORY_ACCESS = "access"
    CATEGORY_BILLING = "billing"
    CATEGORY_BUG = "bug"
    CATEGORY_FEATURE = "feature"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = (
        (CATEGORY_GENERAL, "General"),
        (CATEGORY_ACCESS, "Acces et comptes"),
        (CATEGORY_BILLING, "Facturation et abonnement"),
        (CATEGORY_BUG, "Bug ou incident"),
        (CATEGORY_FEATURE, "Demande d evolution"),
        (CATEGORY_OTHER, "Autre"),
    )

    reference = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default=CATEGORY_GENERAL)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_OPEN)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets_created",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets_assigned",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Ticket support"
        verbose_name_plural = "Tickets support"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"TCK-{timezone.now():%Y%m%d}-{str(uuid.uuid4())[:8].upper()}"
        if self.status in (self.STATUS_RESOLVED, self.STATUS_CLOSED) and not self.resolved_at:
            self.resolved_at = timezone.now()
        if self.status in (self.STATUS_OPEN, self.STATUS_IN_PROGRESS, self.STATUS_WAITING_CUSTOMER):
            self.resolved_at = None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.reference or str(self.id)


class SupportTicketComment(TimeStampedModel):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_comments")
    body = models.TextField()

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Commentaire ticket"
        verbose_name_plural = "Commentaires tickets"

    def __str__(self) -> str:
        return f"{self.ticket.reference} — {self.author_id}"
