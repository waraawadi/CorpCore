import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _
from django_tenants.models import DomainMixin, TenantMixin


class Client(TenantMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=63, unique=True)
    paid_until = models.DateField(blank=True, null=True)
    on_trial = models.BooleanField(default=True)
    currency_code = models.CharField(max_length=3, default="XOF")
    slogan = models.CharField(max_length=255, blank=True, default="")
    logo = models.ImageField(upload_to="tenants/logos/", blank=True, null=True)
    hero_image = models.ImageField(upload_to="tenants/heroes/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    auto_create_schema = True

    class Meta:
        ordering = ("-created_at",)
        verbose_name = _("Tenant")
        verbose_name_plural = _("Tenants")

    def __str__(self) -> str:
        return f"{self.name} ({self.schema_name})"


class Domain(DomainMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Tenant domain")
        verbose_name_plural = _("Tenant domains")


class CompanyLegalProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.OneToOneField(Client, on_delete=models.CASCADE, related_name="legal_profile")
    legal_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=120, blank=True, default="")
    tax_identification_number = models.CharField(max_length=120, blank=True, default="")
    legal_status = models.CharField(max_length=120, blank=True, default="")
    industry = models.CharField(max_length=120, blank=True, default="")
    country = models.CharField(max_length=120)
    city = models.CharField(max_length=120, blank=True, default="")
    address_line = models.CharField(max_length=255)
    postal_code = models.CharField(max_length=20, blank=True, default="")
    company_email = models.EmailField()
    company_phone = models.CharField(max_length=40, blank=True, default="")
    admin_phone = models.CharField(max_length=40, blank=True, default="")
    representative_full_name = models.CharField(max_length=180)
    representative_role = models.CharField(max_length=120, blank=True, default="")
    representative_id_number = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Company legal profile")
        verbose_name_plural = _("Company legal profiles")

    def __str__(self) -> str:
        return f"{self.legal_name} ({self.tenant.slug})"
