from django.contrib import admin

from .models import SalesCustomer, SalesOrder, SalesOrderLine, SalesProduct, SalesStockMovement


@admin.register(SalesCustomer)
class SalesCustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "is_active", "created_at")
    search_fields = ("name", "email", "phone")
    list_filter = ("is_active",)


@admin.register(SalesProduct)
class SalesProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "unit_price", "is_active", "created_at")
    search_fields = ("name", "sku")
    list_filter = ("is_active",)


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("reference", "customer", "status", "ordered_at", "total_amount")
    list_filter = ("status",)
    search_fields = ("reference", "customer__name")
    inlines = [SalesOrderLineInline]


@admin.register(SalesStockMovement)
class SalesStockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "created_at")
    list_filter = ("movement_type",)
    search_fields = ("product__name", "product__sku", "note")
