import uuid

from django.db import models
from django.utils import timezone

from tenants.models import Client


class BillingModule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    monthly_price_xof = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class TenantSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_GRACE = "grace"
    STATUS_SUSPENDED = "suspended"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_GRACE, "Grace period"),
        (STATUS_SUSPENDED, "Suspended"),
        (STATUS_CANCELLED, "Cancelled"),
    )

    tenant = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="subscriptions")
    module = models.ForeignKey(BillingModule, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    started_at = models.DateTimeField(default=timezone.now)
    grace_until = models.DateTimeField(blank=True, null=True)
    renewal_at = models.DateTimeField(blank=True, null=True)
    auto_renew = models.BooleanField(default=True)
    fedapay_transaction_id = models.CharField(max_length=120, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("tenant", "module")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.tenant} - {self.module} ({self.status})"
