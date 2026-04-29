from django.contrib import admin

from .models import Client, CompanyLegalProfile, Domain


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("name", "schema_name", "slug", "on_trial", "paid_until", "created_at")
    search_fields = ("name", "schema_name", "slug")


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary", "created_at")
    search_fields = ("domain",)


@admin.register(CompanyLegalProfile)
class CompanyLegalProfileAdmin(admin.ModelAdmin):
    list_display = ("legal_name", "tenant", "country", "company_email", "created_at")
    search_fields = ("legal_name", "tenant__name", "registration_number", "tax_identification_number", "company_email")
