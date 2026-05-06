from django.contrib import admin

from .models import CrmActivity, CrmContact, CrmLead, CrmOpportunity


@admin.register(CrmContact)
class CrmContactAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "email", "company_name", "owner", "created_at")
    search_fields = ("first_name", "last_name", "email", "company_name")


@admin.register(CrmLead)
class CrmLeadAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "owner", "estimated_value", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "notes")


@admin.register(CrmOpportunity)
class CrmOpportunityAdmin(admin.ModelAdmin):
    list_display = ("name", "stage", "amount", "probability", "owner", "created_at")
    list_filter = ("stage",)
    search_fields = ("name",)


@admin.register(CrmActivity)
class CrmActivityAdmin(admin.ModelAdmin):
    list_display = ("subject", "activity_type", "created_by", "created_at")
    list_filter = ("activity_type",)
