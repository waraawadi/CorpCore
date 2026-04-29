from django.contrib import admin

from .models import InventoryAssetReference, InventoryCategory, InventoryItem, InventoryLocation, InventoryMovement


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("is_active",)


@admin.register(InventoryLocation)
class InventoryLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active", "created_at")
    search_fields = ("name", "code")
    list_filter = ("is_active",)


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "category", "quantity_on_hand", "reorder_level", "is_active")
    search_fields = ("name", "sku")
    list_filter = ("is_active", "category")


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ("item", "movement_type", "quantity", "location", "occurred_at", "moved_by")
    search_fields = ("item__name", "item__sku", "reference")
    list_filter = ("movement_type", "location")


@admin.register(InventoryAssetReference)
class InventoryAssetReferenceAdmin(admin.ModelAdmin):
    list_display = ("serial_number", "item", "status", "assigned_to", "location", "created_at")
    search_fields = ("serial_number", "item__name", "item__sku", "assigned_to__email")
    list_filter = ("status", "location")
