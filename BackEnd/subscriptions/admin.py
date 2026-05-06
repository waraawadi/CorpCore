from django.contrib import admin

from .models import BillingModule, TenantSubscription


@admin.register(BillingModule)
class BillingModuleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "monthly_price_xof", "is_active", "updated_at")
    search_fields = ("code", "name")
    list_filter = ("is_active",)


@admin.register(TenantSubscription)
class TenantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "module", "status", "renewal_at", "auto_renew", "updated_at")
    search_fields = ("tenant__name", "module__name", "fedapay_transaction_id")
    list_filter = ("status", "auto_renew")
