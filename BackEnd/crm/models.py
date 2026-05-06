import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CrmContact(TimeStampedModel):
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=60, blank=True, default="")
    company_name = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="crm_contacts")

    class Meta:
        ordering = ("last_name", "first_name")

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or (self.email or str(self.id))


class CrmLead(TimeStampedModel):
    STATUS_NEW = "new"
    STATUS_CONTACTED = "contacted"
    STATUS_QUALIFIED = "qualified"
    STATUS_LOST = "lost"
    STATUS_CONVERTED = "converted"

    STATUS_CHOICES = (
        (STATUS_NEW, "New"),
        (STATUS_CONTACTED, "Contacted"),
        (STATUS_QUALIFIED, "Qualified"),
        (STATUS_LOST, "Lost"),
        (STATUS_CONVERTED, "Converted"),
    )

    title = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_NEW)
    source = models.CharField(max_length=120, blank=True, default="")
    contact = models.ForeignKey(
        CrmContact,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="leads",
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="crm_leads")
    estimated_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    next_follow_up_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title


class CrmOpportunity(TimeStampedModel):
    STAGE_DISCOVERY = "discovery"
    STAGE_PROPOSAL = "proposal"
    STAGE_NEGOTIATION = "negotiation"
    STAGE_CLOSED_WON = "closed_won"
    STAGE_CLOSED_LOST = "closed_lost"

    STAGE_CHOICES = (
        (STAGE_DISCOVERY, "Discovery"),
        (STAGE_PROPOSAL, "Proposal"),
        (STAGE_NEGOTIATION, "Negotiation"),
        (STAGE_CLOSED_WON, "Closed won"),
        (STAGE_CLOSED_LOST, "Closed lost"),
    )

    name = models.CharField(max_length=255)
    stage = models.CharField(max_length=32, choices=STAGE_CHOICES, default=STAGE_DISCOVERY)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    probability = models.PositiveSmallIntegerField(default=0)
    lead = models.ForeignKey(
        CrmLead,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="opportunities",
    )
    contact = models.ForeignKey(
        CrmContact,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="opportunities",
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="crm_opportunities")
    expected_close_date = models.DateField(blank=True, null=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.name


class CrmActivity(TimeStampedModel):
    TYPE_CALL = "call"
    TYPE_EMAIL = "email"
    TYPE_MEETING = "meeting"
    TYPE_NOTE = "note"

    TYPE_CHOICES = (
        (TYPE_CALL, "Call"),
        (TYPE_EMAIL, "Email"),
        (TYPE_MEETING, "Meeting"),
        (TYPE_NOTE, "Note"),
    )

    activity_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_NOTE)
    subject = models.CharField(max_length=255)
    body = models.TextField(blank=True, default="")
    contact = models.ForeignKey(
        CrmContact,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="activities",
    )
    lead = models.ForeignKey(
        CrmLead,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="activities",
    )
    opportunity = models.ForeignKey(
        CrmOpportunity,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="activities",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="crm_activities",
    )

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.subject
