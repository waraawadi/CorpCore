from django.contrib import admin

from .models import FinanceAccount, FinanceCategory, FinanceTransaction


@admin.register(FinanceAccount)
class FinanceAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "account_type", "currency_code", "opening_balance", "is_active", "owner")
    list_filter = ("account_type", "is_active")
    search_fields = ("name",)


@admin.register(FinanceCategory)
class FinanceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "is_active", "owner")
    list_filter = ("kind", "is_active")
    search_fields = ("name",)


@admin.register(FinanceTransaction)
class FinanceTransactionAdmin(admin.ModelAdmin):
    list_display = ("title", "transaction_type", "amount", "booked_on", "account", "category", "owner")
    list_filter = ("transaction_type", "booked_on")
    search_fields = ("title", "reference", "notes")

