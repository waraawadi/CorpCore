from django.contrib import admin

from .models import (
    ProcurementPurchaseOrder,
    ProcurementPurchaseOrderLine,
    ProcurementPurchaseRequest,
    ProcurementPurchaseRequestLine,
    ProcurementSupplier,
)


@admin.register(ProcurementSupplier)
class ProcurementSupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "email", "phone", "city", "is_active", "created_at")
    search_fields = ("name", "company", "email", "phone")


class ProcurementPurchaseRequestLineInline(admin.TabularInline):
    model = ProcurementPurchaseRequestLine
    extra = 0


@admin.register(ProcurementPurchaseRequest)
class ProcurementPurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ("reference", "title", "status", "requested_by", "created_at")
    list_filter = ("status",)
    search_fields = ("reference", "title")
    inlines = [ProcurementPurchaseRequestLineInline]


class ProcurementPurchaseOrderLineInline(admin.TabularInline):
    model = ProcurementPurchaseOrderLine
    extra = 0


@admin.register(ProcurementPurchaseOrder)
class ProcurementPurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("reference", "supplier", "status", "total_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("reference", "notes")
    inlines = [ProcurementPurchaseOrderLineInline]
